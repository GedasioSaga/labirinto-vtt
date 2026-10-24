#![allow(clippy::unwrap_used, clippy::expect_used)]

//! SONS AO VIVO, F5a: a rota `/sons/{id}`, a chave por conexão, o `liberar` do
//! `net_send` e o `net_sons_aventura`, contra o servidor de verdade (sem Tauri).
//! Contrato: `docs/planos/sons-f5-plano-tecnico-2026-10-23.md`, seções 2 e 6.

use std::net::{IpAddr, Ipv4Addr, SocketAddr};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use futures_util::{SinkExt, StreamExt};
use labirinto_lib::net::commands;
use labirinto_lib::net::conexao;
use labirinto_lib::net::media;
use labirinto_lib::net::server::{self, AssetSource, ClientId, NetSink, PeerEvent, Room};
use labirinto_lib::net::sons;
use serde_json::{json, Value};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpSocket, TcpStream};
use tokio_tungstenite::tungstenite::client::IntoClientRequest;
use tokio_tungstenite::tungstenite::http::HeaderValue;
use tokio_tungstenite::tungstenite::Message;
use tokio_tungstenite::{MaybeTlsStream, WebSocketStream};

const CODE: &str = "ABC234";
const WAIT: Duration = Duration::from_secs(10);
const MP3: &[u8] = b"ID3\x04\x00\x00\x00\x00\x00\x00";
const OGG: &[u8] = b"OggS\x00\x02\x00\x00\x00\x00";
const WAV: &[u8] = b"RIFF\x24\x00\x00\x00WAVEfmt ";
const M4A: &[u8] = b"\x00\x00\x00\x18ftypM4A \x00\x00\x00\x00isomM4A ";
const PNG: &[u8] = b"\x89PNG\r\n\x1a\n\x00\x00\x00\x0dIHDR";

type Ws = WebSocketStream<MaybeTlsStream<TcpStream>>;

#[derive(Default)]
struct Sink {
    peers: Mutex<Vec<(ClientId, PeerEvent, Option<String>)>>,
}

impl NetSink for Sink {
    fn on_message(&self, _client_id: ClientId, _msg: Value) {}
    fn on_peer(&self, client_id: ClientId, event: PeerEvent, name: Option<&str>) {
        self.peers.lock().unwrap().push((client_id, event, name.map(str::to_owned)));
    }
}

struct Sala {
    addr: SocketAddr,
    room: Arc<Room>,
    sink: Arc<Sink>,
    aventura: PathBuf,
}

impl Sala {
    fn midia(&self) -> PathBuf {
        self.aventura.join(media::PASTA_DE_MIDIA)
    }
}

impl Drop for Sala {
    fn drop(&mut self) {
        self.room.shutdown();
        let _ = std::fs::remove_dir_all(&self.aventura);
    }
}

/// Pasta de aventura só deste teste (os testes rodam em paralelo).
fn criar_aventura(nome: &str) -> PathBuf {
    let pasta = std::env::temp_dir().join(format!("labirinto-net-sons-{nome}-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&pasta);
    std::fs::create_dir_all(pasta.join(media::PASTA_DE_MIDIA)).unwrap();
    std::fs::write(pasta.join(sons::ARQUIVO_DA_AVENTURA), br#"{"scenes":[]}"#).unwrap();
    pasta
}

async fn abrir_sala(nome: &str) -> Sala {
    abrir_sala_com_prazo(nome, conexao::PRAZO_SEM_PROGRESSO).await
}

/// Sala com outro prazo de escrita sem progresso (o teste não espera 30 s).
async fn abrir_sala_com_prazo(nome: &str, prazo: Duration) -> Sala {
    let sink = Arc::new(Sink::default());
    let assets: AssetSource = Arc::new(|_: &str| None);
    let room = Room::new(CODE.to_owned(), sink.clone(), assets);
    let listener = server::bind(IpAddr::V4(Ipv4Addr::LOCALHOST), 0, 1).await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(server::serve_com_prazo(listener, room.clone(), prazo));
    let aventura = criar_aventura(nome);
    commands::definir_aventura_dos_sons(&room, Some(aventura.to_string_lossy().into_owned())).await.unwrap();
    Sala { addr, room, sink, aventura }
}

/// Grava `bytes` com o nome do hash deles; devolve o id.
fn gravar(pasta: &Path, bytes: &[u8], extensao: &str) -> String {
    let id = format!("{}.{extensao}", media::hash_hex(bytes));
    std::fs::write(pasta.join(&id), bytes).unwrap();
    id
}

/// Bytes de áudio de `tamanho`, começando pela assinatura.
fn audio(assinatura: &[u8], tamanho: usize, recheio: u8) -> Vec<u8> {
    let mut bytes = assinatura.to_vec();
    bytes.resize(tamanho, recheio);
    bytes
}

async fn proximo_texto(ws: &mut Ws) -> String {
    loop {
        match tokio::time::timeout(WAIT, ws.next()).await.expect("timeout esperando mensagem") {
            Some(Ok(Message::Text(t))) => return t.to_string(),
            Some(Ok(Message::Ping(_) | Message::Pong(_))) => continue,
            outro => panic!("esperava texto, veio {outro:?}"),
        }
    }
}

struct Jogador {
    ws: Ws,
    chave: String,
    id: ClientId,
    /// O aparelho (`127.0.0.<origem>`) do socket: a chave só vale dele.
    origem: u8,
}

async fn esperar_peer(sala: &Sala, achar: impl Fn(&(ClientId, PeerEvent, Option<String>)) -> bool) -> ClientId {
    let prazo = tokio::time::Instant::now() + WAIT;
    loop {
        // O mais recente: quem volta com o mesmo nome é a conexão nova.
        if let Some(peer) = sala.sink.peers.lock().unwrap().iter().rev().find(|peer| achar(peer)) {
            return peer.0;
        }
        assert!(tokio::time::Instant::now() < prazo, "o evento de conexão não chegou ao mestre");
        tokio::time::sleep(Duration::from_millis(20)).await;
    }
}

/// Entra na sala com o socket saindo de `127.0.0.<origem>` (o aparelho).
async fn entrar(sala: &Sala, nome: &str, origem: u8) -> Jogador {
    let mut req = format!("ws://{}/ws", sala.addr).into_client_request().unwrap();
    req.headers_mut().insert("Origin", HeaderValue::from_str(&format!("http://{}", sala.addr)).unwrap());
    let tcp = tcp_de(sala, origem).await;
    let (mut ws, _) = tokio_tungstenite::client_async(req, MaybeTlsStream::Plain(tcp)).await.unwrap();
    ws.send(Message::text(json!({"type":"join","code":CODE,"name":nome}).to_string())).await.unwrap();
    let primeiro: Value = serde_json::from_str(&proximo_texto(&mut ws).await).unwrap();
    assert_eq!(primeiro["type"], "midia.chave", "o primeiro frame não foi a chave: {primeiro}");
    let chave = primeiro["chave"].as_str().unwrap().to_owned();
    let id = esperar_peer(sala, |(_, evento, quem)| *evento == PeerEvent::Connected && quem.as_deref() == Some(nome)).await;
    Jogador { ws, chave, id, origem }
}

/// O que o host faz ao mandar `som.tocar`: libera no mesmo `net_send`.
fn liberar(sala: &Sala, jogador: &Jogador, ids: &[String]) {
    commands::send_to_liberando(&sala.room, &jogador.id.to_string(), &json!({"type":"som.tocar"}), ids).unwrap();
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct Resposta {
    status: u16,
    /// Nome em minúscula e valor, na ordem; sem `date` (muda a cada segundo).
    cabecalhos: Vec<(String, String)>,
    corpo: Vec<u8>,
}

impl Resposta {
    fn cabecalho(&self, nome: &str) -> Option<&str> {
        self.cabecalhos.iter().find(|(n, _)| n == nome).map(|(_, v)| v.as_str())
    }
}

fn ler_resposta(bruta: &[u8]) -> Resposta {
    let fim = bruta.windows(4).position(|w| w == b"\r\n\r\n").expect("resposta sem fim de cabeçalho");
    let cabeca = String::from_utf8(bruta[..fim].to_vec()).unwrap();
    let mut linhas = cabeca.split("\r\n");
    let status = linhas.next().unwrap().split(' ').nth(1).unwrap().parse().unwrap();
    let cabecalhos = linhas
        .map(|linha| {
            let (nome, valor) = linha.split_once(':').unwrap();
            (nome.to_ascii_lowercase(), valor.trim().to_owned())
        })
        .filter(|(nome, _)| nome != "date")
        .collect();
    Resposta { status, cabecalhos, corpo: bruta[fim + 4..].to_vec() }
}

/// Conexão TCP saindo de `127.0.0.<origem>`: cada origem é um aparelho.
async fn tcp_de(sala: &Sala, origem: u8) -> TcpStream {
    let socket = TcpSocket::new_v4().unwrap();
    socket.bind(SocketAddr::new(IpAddr::V4(Ipv4Addr::new(127, 0, 0, origem)), 0)).unwrap();
    socket.connect(sala.addr).await.unwrap()
}

fn requisicao(metodo: &str, caminho: &str, host: &str, chave: Option<&str>) -> String {
    let extra = chave.map(|c| format!("X-Labirinto-Chave: {c}\r\n")).unwrap_or_default();
    format!("{metodo} {caminho} HTTP/1.1\r\nHost: {host}\r\nConnection: close\r\n{extra}\r\n")
}

async fn pedir_bruto(sala: &Sala, origem: u8, texto: &str) -> Resposta {
    let mut tcp = tcp_de(sala, origem).await;
    tcp.write_all(texto.as_bytes()).await.unwrap();
    let mut out = Vec::new();
    tokio::time::timeout(WAIT, tcp.read_to_end(&mut out)).await.unwrap().unwrap();
    ler_resposta(&out)
}

async fn pedir_som(sala: &Sala, origem: u8, id: &str, chave: Option<&str>) -> Resposta {
    pedir_bruto(sala, origem, &requisicao("GET", &format!("/sons/{id}"), &sala.addr.to_string(), chave)).await
}

/// Repete o pedido até a resposta não ser 429 (as vagas voltando).
async fn esperar_sem_429(sala: &Sala, origem: u8, id: &str, chave: &str) -> Resposta {
    let prazo = tokio::time::Instant::now() + WAIT;
    loop {
        let resposta = pedir_som(sala, origem, id, Some(chave)).await;
        if resposta.status != 429 {
            return resposta;
        }
        assert!(tokio::time::Instant::now() < prazo, "as vagas não voltaram");
        tokio::time::sleep(Duration::from_millis(100)).await;
    }
}

fn assert_recusa(resposta: &Resposta, caso: &str) {
    assert_eq!(resposta.status, 404, "{caso}: {resposta:?}");
    assert!(resposta.corpo.is_empty(), "{caso}: 404 com corpo");
    assert_eq!(resposta.cabecalho("cache-control"), Some("private, no-store"), "{caso}");
    assert_eq!(resposta.cabecalho("x-content-type-options"), Some("nosniff"), "{caso}");
}

/// O ACHADO da F5: `/media` serve áudio de `<appData>/midia` sem chave nem
/// sala (é a música da dança). Fica verde até a F5d, que o inverte.
#[tokio::test]
async fn achado_f5d_media_ainda_serve_audio_sem_chave() {
    let sala = abrir_sala("achado").await;
    let id = gravar(&sala.midia(), MP3, "mp3");
    sala.room.set_media_dir(sala.midia());
    let resposta = pedir_bruto(&sala, 1, &requisicao("GET", &format!("/media/{id}"), &sala.addr.to_string(), None)).await;
    assert_eq!(resposta.status, 200);
    // A rota nova não tem esse buraco: o mesmo id, sem chave, é 404.
    assert_recusa(&pedir_som(&sala, 1, &id, None).await, "sons sem chave");
}

#[tokio::test]
async fn chave_e_o_primeiro_frame_e_unica_por_conexao() {
    let sala = abrir_sala("chave").await;
    let mut ana = entrar(&sala, "Ana", 1).await;
    let bruno = entrar(&sala, "Bruno", 2).await;
    for chave in [&ana.chave, &bruno.chave] {
        assert_eq!(chave.len(), 64);
        assert!(chave.bytes().all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b)), "{chave}");
    }
    assert_ne!(ana.chave, bruno.chave);
    // Depois da chave, o resto chega na ordem de sempre.
    commands::send_to(&sala.room, &ana.id.to_string(), &json!({"type":"lobby.waiting"})).unwrap();
    assert_eq!(proximo_texto(&mut ana.ws).await, r#"{"type":"lobby.waiting"}"#);
}

#[tokio::test]
async fn liberado_a_ana_nao_serve_ao_bruno() {
    let sala = abrir_sala("ana-bruno").await;
    let ana = entrar(&sala, "Ana", 1).await;
    let bruno = entrar(&sala, "Bruno", 2).await;
    // Pouco mais de 1 MB: o corpo sai em vários pedaços e chega igual.
    let bytes = audio(OGG, 1024 * 1024 + 3, 0x5a);
    let id = gravar(&sala.midia(), &bytes, "ogg");
    liberar(&sala, &ana, std::slice::from_ref(&id));

    let da_ana = pedir_som(&sala, ana.origem, &id, Some(&ana.chave)).await;
    assert_eq!(da_ana.status, 200);
    assert_eq!(da_ana.corpo, bytes);
    assert_recusa(&pedir_som(&sala, bruno.origem, &id, Some(&bruno.chave)).await, "chave do Bruno");

    liberar(&sala, &bruno, std::slice::from_ref(&id));
    assert_eq!(pedir_som(&sala, bruno.origem, &id, Some(&bruno.chave)).await.status, 200);
}

#[tokio::test]
async fn tipo_pela_assinatura_com_nosniff() {
    let sala = abrir_sala("tipo").await;
    let ana = entrar(&sala, "Ana", 1).await;
    let casos = [(MP3, "mp3", "audio/mpeg"), (OGG, "ogg", "audio/ogg"), (WAV, "wav", "audio/wav"), (M4A, "m4a", "audio/mp4")];
    let ids: Vec<String> = casos.iter().map(|(bytes, extensao, _)| gravar(&sala.midia(), bytes, extensao)).collect();
    liberar(&sala, &ana, &ids);
    for ((bytes, _, mime), id) in casos.iter().zip(&ids) {
        let resposta = pedir_som(&sala, 1, id, Some(&ana.chave)).await;
        assert_eq!(resposta.status, 200, "{mime}");
        assert_eq!(resposta.cabecalho("content-type"), Some(*mime));
        assert_eq!(resposta.cabecalho("content-length"), Some(bytes.len().to_string().as_str()));
        assert_eq!(resposta.cabecalho("x-content-type-options"), Some("nosniff"));
        assert_eq!(resposta.cabecalho("cache-control"), Some("private, no-store"));
        assert_eq!(resposta.cabecalho("cross-origin-resource-policy"), Some("same-origin"));
        assert_eq!(resposta.cabecalho("vary"), Some("X-Labirinto-Chave"));
        assert_eq!(resposta.corpo, *bytes);
    }
    // O nome não manda no tipo: bytes de mp3 com extensão de ogg não saem.
    let mp3_como_ogg = gravar(&sala.midia(), MP3, "ogg");
    liberar(&sala, &ana, std::slice::from_ref(&mp3_como_ogg));
    assert_recusa(&pedir_som(&sala, 1, &mp3_como_ogg, Some(&ana.chave)).await, "mp3 com nome de ogg");
}

/// Mutações vermelhas: 403 no não liberado, `no-store` faltando num caminho,
/// chave ausente aceita, tipo pela extensão, chave de outro aparelho aceita.
/// O link de ARQUIVO tem teste próprio (no Windows pede modo de desenvolvedor).
#[tokio::test]
async fn oraculo_todas_as_recusas_sao_o_mesmo_404() {
    let sala = abrir_sala("oraculo").await;
    let ana = entrar(&sala, "Ana", 1).await;
    let bruno = entrar(&sala, "Bruno", 2).await;
    let midia = sala.midia();
    let ok = gravar(&midia, MP3, "mp3");
    let nao_liberado = gravar(&midia, OGG, "ogg");
    let inexistente = format!("{}.wav", media::hash_hex(b"nunca gravado"));
    let grande = gravar(&midia, &audio(MP3, usize::try_from(media::MIDIA_AUDIO_MAX_BYTES).unwrap() + 1, 0), "mp3");
    let png_como_mp3 = gravar(&midia, PNG, "mp3");
    let hash_errado = format!("{}.mp3", media::hash_hex(b"outro conteudo"));
    std::fs::write(midia.join(&hash_errado), MP3).unwrap();
    let m4a_de_video = gravar(&midia, b"\x00\x00\x00\x18ftypmp41\x00\x00\x00\x00isommp41", "m4a");
    let liberados = vec![ok.clone(), inexistente.clone(), grande.clone(), png_como_mp3.clone(), hash_errado.clone(), m4a_de_video.clone()];
    liberar(&sala, &ana, &liberados);
    assert_eq!(pedir_som(&sala, 1, &ok, Some(&ana.chave)).await.status, 200, "o caminho feliz tem de abrir");

    let host = sala.addr.to_string();
    let inventada = "0".repeat(64);
    let casos: Vec<(&str, Resposta)> = vec![
        ("sem chave", pedir_som(&sala, 1, &ok, None).await),
        ("chave inventada", pedir_som(&sala, 1, &ok, Some(&inventada)).await),
        ("chave de outro", pedir_som(&sala, 1, &ok, Some(&bruno.chave)).await),
        ("chave certa de outro aparelho", pedir_som(&sala, 3, &ok, Some(&ana.chave)).await),
        ("chave torta", pedir_som(&sala, 1, &ok, Some(&ana.chave.to_uppercase())).await),
        ("não liberado existente", pedir_som(&sala, 1, &nao_liberado, Some(&ana.chave)).await),
        ("liberado inexistente", pedir_som(&sala, 1, &inexistente, Some(&ana.chave)).await),
        ("id torto", pedir_som(&sala, 1, &ok.to_uppercase(), Some(&ana.chave)).await),
        ("traversal", pedir_som(&sala, 1, &format!("..%2F{ok}"), Some(&ana.chave)).await),
        ("mais de 15 MB", pedir_som(&sala, 1, &grande, Some(&ana.chave)).await),
        ("png com nome de mp3", pedir_som(&sala, 1, &png_como_mp3, Some(&ana.chave)).await),
        ("hash que não bate", pedir_som(&sala, 1, &hash_errado, Some(&ana.chave)).await),
        ("m4a de vídeo", pedir_som(&sala, 1, &m4a_de_video, Some(&ana.chave)).await),
        ("POST", pedir_bruto(&sala, 1, &requisicao("POST", &format!("/sons/{ok}"), &host, Some(&ana.chave))).await),
        ("Host de outro site", pedir_bruto(&sala, 1, &requisicao("GET", &format!("/sons/{ok}"), "evil.example", Some(&ana.chave))).await),
    ];
    let (_, primeira) = &casos[0];
    for (caso, resposta) in &casos {
        assert_recusa(resposta, caso);
        assert_eq!(resposta, primeira, "a recusa \"{caso}\" se distingue das outras");
    }
}

/// Link de ARQUIVO apontando para fora da pasta: o mesmo 404 das outras
/// recusas. Criar o link no Windows pede o modo de desenvolvedor; lá o teste
/// é ignorado e roda com `cargo test --test net_sons -- --ignored`.
#[tokio::test]
#[cfg_attr(windows, ignore = "symlink_file pede o modo de desenvolvedor do Windows")]
async fn link_de_arquivo_para_fora_e_o_mesmo_404() {
    let sala = abrir_sala("link").await;
    let ana = entrar(&sala, "Ana", 1).await;
    let fora = sala.aventura.join("fora.mp3");
    let alvo_de_fora = audio(MP3, 64, 1);
    std::fs::write(&fora, &alvo_de_fora).unwrap();
    let link = format!("{}.mp3", media::hash_hex(&alvo_de_fora));
    assert!(
        criar_link_de_arquivo(&fora, &sala.midia().join(&link)),
        "não deu para criar o link de arquivo (no Windows, ligue o modo de desenvolvedor)"
    );
    liberar(&sala, &ana, std::slice::from_ref(&link));
    let recusa = pedir_som(&sala, ana.origem, &link, Some(&ana.chave)).await;
    assert_recusa(&recusa, "link para fora");
    assert_eq!(recusa, pedir_som(&sala, ana.origem, &link, None).await, "o 404 do link se distingue");
}

#[cfg(windows)]
fn criar_link_de_arquivo(alvo: &Path, link: &Path) -> bool {
    std::os::windows::fs::symlink_file(alvo, link).is_ok()
}

#[cfg(unix)]
fn criar_link_de_arquivo(alvo: &Path, link: &Path) -> bool {
    std::os::unix::fs::symlink(alvo, link).is_ok()
}

/// Junção (Windows, não pede privilégio): o caminho real sai da aventura.
#[cfg(windows)]
fn criar_juncao(alvo: &Path, link: &Path) -> bool {
    std::process::Command::new("cmd")
        .args(["/C", "mklink", "/J"])
        .arg(link)
        .arg(alvo)
        .output()
        .is_ok_and(|saida| saida.status.success())
}

#[cfg(windows)]
fn remover_juncao(link: &Path) {
    std::fs::remove_dir(link).unwrap();
}

#[cfg(unix)]
fn criar_juncao(alvo: &Path, link: &Path) -> bool {
    std::os::unix::fs::symlink(alvo, link).is_ok()
}

#[cfg(unix)]
fn remover_juncao(link: &Path) {
    std::fs::remove_file(link).unwrap();
}

#[tokio::test]
async fn symlink_e_juncao_nao_saem() {
    let sala = abrir_sala("juncao").await;
    let ana = entrar(&sala, "Ana", 1).await;
    // A `midia` da aventura vira uma junção para uma pasta fora dela.
    let fora = sala.aventura.with_file_name(format!("labirinto-net-sons-fora-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&fora);
    std::fs::create_dir_all(&fora).unwrap();
    let id = gravar(&fora, WAV, "wav");
    std::fs::remove_dir_all(sala.midia()).unwrap();
    assert!(criar_juncao(&fora, &sala.midia()), "não deu para criar a junção");
    liberar(&sala, &ana, std::slice::from_ref(&id));
    assert_recusa(&pedir_som(&sala, 1, &id, Some(&ana.chave)).await, "midia como junção");

    // A mesma pasta de verdade, com o mesmo arquivo: sai (a recusa era a junção).
    remover_juncao(&sala.midia());
    std::fs::create_dir_all(sala.midia()).unwrap();
    gravar(&sala.midia(), WAV, "wav");
    assert_eq!(pedir_som(&sala, 1, &id, Some(&ana.chave)).await.status, 200);

    // A própria pasta da aventura como junção: recusada, e a sala para de servir.
    let atalho = sala.aventura.with_file_name(format!("labirinto-net-sons-atalho-{}", std::process::id()));
    let _ = std::fs::remove_dir(&atalho);
    assert!(criar_juncao(&sala.aventura, &atalho));
    let recusa = commands::definir_aventura_dos_sons(&sala.room, Some(atalho.to_string_lossy().into_owned())).await;
    assert_eq!(recusa, Err("pasta-invalida".to_owned()));
    liberar(&sala, &ana, std::slice::from_ref(&id));
    assert_recusa(&pedir_som(&sala, 1, &id, Some(&ana.chave)).await, "aventura recusada");
    remover_juncao(&atalho);
    std::fs::remove_dir_all(&fora).unwrap();
}

#[tokio::test]
async fn trocar_aventura_revoga_e_so_serve_a_aberta() {
    let sala = abrir_sala("troca-a").await;
    let ana = entrar(&sala, "Ana", 1).await;
    let id = gravar(&sala.midia(), MP3, "mp3");
    liberar(&sala, &ana, std::slice::from_ref(&id));
    assert_eq!(pedir_som(&sala, 1, &id, Some(&ana.chave)).await.status, 200);

    let outra = criar_aventura("troca-b");
    commands::definir_aventura_dos_sons(&sala.room, Some(outra.to_string_lossy().into_owned())).await.unwrap();
    assert_recusa(&pedir_som(&sala, 1, &id, Some(&ana.chave)).await, "liberação da aventura anterior");
    liberar(&sala, &ana, std::slice::from_ref(&id));
    assert_recusa(&pedir_som(&sala, 1, &id, Some(&ana.chave)).await, "arquivo só na aventura fechada");
    gravar(&outra.join(media::PASTA_DE_MIDIA), MP3, "mp3");
    assert_eq!(pedir_som(&sala, 1, &id, Some(&ana.chave)).await.status, 200);

    // Mesma pasta de novo não revoga; pasta recusada e `null` param de servir.
    commands::definir_aventura_dos_sons(&sala.room, Some(outra.to_string_lossy().into_owned())).await.unwrap();
    assert_eq!(pedir_som(&sala, 1, &id, Some(&ana.chave)).await.status, 200);
    let relativa = commands::definir_aventura_dos_sons(&sala.room, Some("aventura-relativa".to_owned())).await;
    assert_eq!(relativa, Err("pasta-invalida".to_owned()));
    liberar(&sala, &ana, std::slice::from_ref(&id));
    assert_recusa(&pedir_som(&sala, 1, &id, Some(&ana.chave)).await, "pasta recusada");
    commands::definir_aventura_dos_sons(&sala.room, Some(outra.to_string_lossy().into_owned())).await.unwrap();
    liberar(&sala, &ana, std::slice::from_ref(&id));
    assert_eq!(pedir_som(&sala, 1, &id, Some(&ana.chave)).await.status, 200);
    commands::definir_aventura_dos_sons(&sala.room, None).await.unwrap();
    liberar(&sala, &ana, std::slice::from_ref(&id));
    assert_recusa(&pedir_som(&sala, 1, &id, Some(&ana.chave)).await, "sem aventura");
    std::fs::remove_dir_all(&outra).unwrap();
}

/// Mutação vermelha: tirar o `esquecer` do fim da conexão (`handle_socket`).
#[tokio::test]
async fn queda_e_kick_apagam_a_chave() {
    let sala = abrir_sala("queda").await;
    let ana = entrar(&sala, "Ana", 1).await;
    let mut bia = entrar(&sala, "Bia", 2).await;
    let id = gravar(&sala.midia(), OGG, "ogg");
    liberar(&sala, &ana, std::slice::from_ref(&id));
    liberar(&sala, &bia, std::slice::from_ref(&id));
    assert_eq!(pedir_som(&sala, 1, &id, Some(&ana.chave)).await.status, 200);
    assert_eq!(pedir_som(&sala, 2, &id, Some(&bia.chave)).await.status, 200);

    commands::kick(&sala.room, &ana.id.to_string()).unwrap();
    assert_recusa(&pedir_som(&sala, 1, &id, Some(&ana.chave)).await, "chave de quem levou kick");

    bia.ws.close(None).await.unwrap();
    let bia_id = bia.id;
    esperar_peer(&sala, |(cliente, evento, _)| *cliente == bia_id && *evento == PeerEvent::Disconnected).await;
    assert_recusa(&pedir_som(&sala, 2, &id, Some(&bia.chave)).await, "chave de quem caiu");

    // Quem volta ganha chave nova; a velha continua morta.
    let bia_de_novo = entrar(&sala, "Bia", 2).await;
    assert_ne!(bia_de_novo.chave, bia.chave);
    liberar(&sala, &bia_de_novo, std::slice::from_ref(&id));
    assert_eq!(pedir_som(&sala, 2, &id, Some(&bia_de_novo.chave)).await.status, 200);
    assert_recusa(&pedir_som(&sala, 2, &id, Some(&bia.chave)).await, "chave da conexão anterior");
}

/// `liberar` torto não libera nem manda nada; o erro é texto fixo.
#[tokio::test]
async fn liberar_recusa_imagem_e_id_torto() {
    let sala = abrir_sala("liberar").await;
    let mut ana = entrar(&sala, "Ana", 1).await;
    let audio_ok = gravar(&sala.midia(), MP3, "mp3");
    let imagem = gravar(&sala.midia(), PNG, "png");
    let id_ana = ana.id.to_string();
    let msg = json!({"type":"som.tocar"});
    for (ids, erro) in [
        (vec![audio_ok.clone(), imagem.clone()], "midia-invalida"),
        (vec![format!("../{audio_ok}")], "midia-invalida"),
        (vec![audio_ok.to_uppercase()], "midia-invalida"),
        (vec![audio_ok.clone(); sons::LIBERAR_MAX_POR_ENVIO + 1], "limite-de-liberacao"),
    ] {
        assert_eq!(commands::send_to_liberando(&sala.room, &id_ana, &msg, &ids), Err(erro.to_owned()));
    }
    assert_eq!(commands::send_to_liberando(&sala.room, "999", &msg, std::slice::from_ref(&audio_ok)), Err("cliente-invalido".to_owned()));
    assert_recusa(&pedir_som(&sala, 1, &audio_ok, Some(&ana.chave)).await, "liberação recusada");
    // Nenhuma das recusadas saiu: a próxima mensagem é a primeira que Ana vê.
    commands::send_to_liberando(&sala.room, &id_ana, &json!({"type":"lobby.waiting"}), std::slice::from_ref(&audio_ok)).unwrap();
    assert_eq!(proximo_texto(&mut ana.ws).await, r#"{"type":"lobby.waiting"}"#);
    assert_eq!(pedir_som(&sala, 1, &audio_ok, Some(&ana.chave)).await.status, 200);
}

/// Taxa por IP: 30 buscas em 10 s, a 31ª é 429 igual para id válido e torto.
#[tokio::test]
async fn taxa_e_simultaneas_dao_429_igual_para_id_valido_e_invalido() {
    let sala = abrir_sala("taxa").await;
    let ana = entrar(&sala, "Ana", 9).await;
    let bruno = entrar(&sala, "Bruno", 10).await;
    let id = gravar(&sala.midia(), MP3, "mp3");
    liberar(&sala, &ana, std::slice::from_ref(&id));
    liberar(&sala, &bruno, std::slice::from_ref(&id));
    let torto = "x".repeat(10);
    for n in 0..sons::BUSCAS_MAX_POR_IP {
        let alvo = if n % 2 == 0 { id.as_str() } else { torto.as_str() };
        assert_ne!(pedir_som(&sala, ana.origem, alvo, Some(&ana.chave)).await.status, 429, "busca {n}");
    }
    let respostas = [
        pedir_som(&sala, ana.origem, &id, Some(&ana.chave)).await,
        pedir_som(&sala, ana.origem, &torto, Some(&ana.chave)).await,
        pedir_som(&sala, ana.origem, &torto, None).await,
    ];
    // O `Retry-After` conta o tempo até a busca mais velha sair da janela: muda
    // com o relógio, nunca com o id. O resto é byte a byte igual.
    let sem_espera = |resposta: &Resposta| {
        let espera: u64 = resposta.cabecalho("retry-after").unwrap().parse().unwrap();
        assert!((1..=10).contains(&espera), "Retry-After {espera}");
        Resposta { cabecalhos: resposta.cabecalhos.iter().filter(|(n, _)| n != "retry-after").cloned().collect(), ..resposta.clone() }
    };
    assert_eq!(respostas[0].status, 429);
    assert_eq!(sem_espera(&respostas[0]), sem_espera(&respostas[1]));
    assert_eq!(sem_espera(&respostas[0]), sem_espera(&respostas[2]));
    // Outro aparelho segue livre.
    assert_eq!(pedir_som(&sala, bruno.origem, &id, Some(&bruno.chave)).await.status, 200);
}

/// Busca presa: manda o pedido, lê só o cabeçalho e para de ler. O corpo de
/// 15 MB não cabe nos buffers do loopback, então a vaga fica ocupada.
async fn busca_presa(sala: &Sala, origem: u8, id: &str, chave: &str) -> TcpStream {
    let mut tcp = tcp_de(sala, origem).await;
    tcp.write_all(requisicao("GET", &format!("/sons/{id}"), &sala.addr.to_string(), Some(chave)).as_bytes()).await.unwrap();
    let mut lido = Vec::new();
    let mut pedaco = [0u8; 512];
    while !lido.windows(4).any(|w| w == b"\r\n\r\n") {
        let n = tokio::time::timeout(WAIT, tcp.read(&mut pedaco)).await.unwrap().unwrap();
        assert!(n > 0, "a sala fechou a busca presa");
        lido.extend_from_slice(&pedaco[..n]);
    }
    assert!(lido.starts_with(b"HTTP/1.1 200"), "{}", String::from_utf8_lossy(&lido));
    tcp
}

/// Simultâneas: 2 por chave e 6 na sala, com a vaga presa ao CORPO da
/// resposta (não ao handler). Mutação vermelha: devolver a vaga ao retornar.
#[tokio::test]
async fn simultaneas_seguram_a_vaga_ate_o_corpo_sair() {
    let sala = abrir_sala("simultaneas").await;
    let jogadores = [entrar(&sala, "Ana", 20).await, entrar(&sala, "Bruno", 30).await, entrar(&sala, "Carla", 31).await];
    let wav = audio(WAV, usize::try_from(media::MIDIA_AUDIO_MAX_BYTES).unwrap(), 0x11);
    let id = gravar(&sala.midia(), &wav, "wav");
    for jogador in &jogadores {
        liberar(&sala, jogador, std::slice::from_ref(&id));
    }
    let [ana, bruno, carla] = &jogadores;
    let mut presas = vec![busca_presa(&sala, ana.origem, &id, &ana.chave).await, busca_presa(&sala, ana.origem, &id, &ana.chave).await];
    // Terceira com a chave da Ana: 429 igual para id válido e torto.
    let valido = pedir_som(&sala, ana.origem, &id, Some(&ana.chave)).await;
    let torto = pedir_som(&sala, ana.origem, "torto", Some(&ana.chave)).await;
    assert_eq!(valido.status, 429);
    assert_eq!(valido.cabecalho("retry-after"), Some("1"));
    assert_eq!(valido, torto);
    for jogador in [bruno, bruno, carla, carla] {
        presas.push(busca_presa(&sala, jogador.origem, &id, &jogador.chave).await);
    }
    // Seis no ar: até quem não tem chave nenhuma espera.
    assert_eq!(pedir_som(&sala, 40, &id, None).await.status, 429);
    // Soltar as buscas devolve as vagas.
    drop(presas);
    let resposta = esperar_sem_429(&sala, ana.origem, &id, &ana.chave).await;
    assert_eq!(resposta.status, 200);
    assert_eq!(resposta.corpo.len(), wav.len());
}

/// Lê o que a sala ainda manda numa busca parada; a sala tem de FECHAR a
/// conexão antes do fim do arquivo.
async fn conferir_que_a_sala_fechou(presa: &mut TcpStream, tamanho_do_arquivo: usize) {
    let mut resto = Vec::new();
    let lido = tokio::time::timeout(WAIT, presa.read_to_end(&mut resto)).await.expect("a sala não fechou a busca parada");
    assert!(lido.is_err() || resto.len() < tamanho_do_arquivo, "a busca parada recebeu o arquivo inteiro");
}

/// Prazo de escrita (aba congelada, janela zero): sem ler nada, as duas buscas
/// da Ana caem depois do prazo sem progresso e as vagas voltam. Mutação
/// vermelha: `ListenerDaSala` sem o embrulho do prazo (as vagas nunca voltam).
#[tokio::test]
async fn busca_parada_cai_no_prazo_e_devolve_a_vaga() {
    let sala = abrir_sala_com_prazo("prazo", Duration::from_secs(1)).await;
    let ana = entrar(&sala, "Ana", 50).await;
    let wav = audio(WAV, usize::try_from(media::MIDIA_AUDIO_MAX_BYTES).unwrap(), 0x22);
    let id = gravar(&sala.midia(), &wav, "wav");
    liberar(&sala, &ana, std::slice::from_ref(&id));
    let mut presas = [busca_presa(&sala, ana.origem, &id, &ana.chave).await, busca_presa(&sala, ana.origem, &id, &ana.chave).await];
    assert_eq!(pedir_som(&sala, ana.origem, &id, Some(&ana.chave)).await.status, 429, "as duas buscas paradas seguram as vagas");
    let resposta = esperar_sem_429(&sala, ana.origem, &id, &ana.chave).await;
    assert_eq!(resposta.status, 200);
    assert_eq!(resposta.corpo.len(), wav.len());
    for presa in &mut presas {
        conferir_que_a_sala_fechou(presa, wav.len()).await;
    }
}

/// Queda do dono da chave: as buscas dela caem na hora (antes do prazo de
/// escrita de 30 s) e as vagas voltam com a memória. Mutação vermelha:
/// esquecer a chave sem `cortar_da_chave`.
#[tokio::test]
async fn queda_corta_as_buscas_da_chave() {
    let sala = abrir_sala("queda-corta").await;
    let mut ana = entrar(&sala, "Ana", 60).await;
    let wav = audio(WAV, usize::try_from(media::MIDIA_AUDIO_MAX_BYTES).unwrap(), 0x33);
    let id = gravar(&sala.midia(), &wav, "wav");
    liberar(&sala, &ana, std::slice::from_ref(&id));
    let mut presas = [busca_presa(&sala, ana.origem, &id, &ana.chave).await, busca_presa(&sala, ana.origem, &id, &ana.chave).await];
    assert_eq!(pedir_som(&sala, ana.origem, &id, Some(&ana.chave)).await.status, 429);

    ana.ws.close(None).await.unwrap();
    let ana_id = ana.id;
    esperar_peer(&sala, |(cliente, evento, _)| *cliente == ana_id && *evento == PeerEvent::Disconnected).await;
    // As vagas voltaram e a chave morreu: o mesmo pedido agora é o 404, não 429.
    let resposta = esperar_sem_429(&sala, ana.origem, &id, &ana.chave).await;
    assert_recusa(&resposta, "chave de quem caiu, com as buscas dela cortadas");
    for presa in &mut presas {
        conferir_que_a_sala_fechou(presa, wav.len()).await;
    }
}
