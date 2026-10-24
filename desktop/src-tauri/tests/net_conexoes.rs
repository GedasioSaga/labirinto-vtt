#![allow(clippy::unwrap_used, clippy::expect_used)]
//! Conexões da sala (SONS F5d, auditoria da F5a): o prazo do cabeçalho
//! derruba a conexão muda e a keep-alive ociosa, nunca o WebSocket; o teto de
//! conexões fecha a excedente no aceite.

use std::net::{IpAddr, Ipv4Addr, SocketAddr};
use std::sync::Arc;
use std::time::{Duration, Instant};

use futures_util::{SinkExt, StreamExt};
use labirinto_lib::net::conexao::{self, LimitesDaSala};
use labirinto_lib::net::server::{self, AssetSource, ClientId, NetSink, PeerEvent, Room};
use serde_json::{json, Value};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use tokio_tungstenite::tungstenite::client::IntoClientRequest;
use tokio_tungstenite::tungstenite::http::HeaderValue;
use tokio_tungstenite::tungstenite::Message;

const CODE: &str = "ABC234";
const PRAZO_DO_CABECALHO: Duration = Duration::from_millis(400);
const WAIT: Duration = Duration::from_secs(10);

struct Mudo;

impl NetSink for Mudo {
    fn on_message(&self, _client_id: ClientId, _msg: Value) {}
    fn on_peer(&self, _client_id: ClientId, _event: PeerEvent, _name: Option<&str>) {}
}

async fn abrir_sala(limites: LimitesDaSala) -> (SocketAddr, Arc<Room>) {
    let assets: AssetSource = Arc::new(|_: &str| None);
    let room = Room::new(CODE.to_owned(), Arc::new(Mudo), assets);
    let listener = server::bind(IpAddr::V4(Ipv4Addr::LOCALHOST), 0, 1).await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(server::serve_com_limites(listener, room.clone(), limites));
    (addr, room)
}

fn com_prazo_curto() -> LimitesDaSala {
    LimitesDaSala { cabecalho: PRAZO_DO_CABECALHO, ..LimitesDaSala::default() }
}

/// Espera a sala fechar a conexão (fim ou erro na leitura); devolve o tempo.
async fn tempo_ate_fechar(tcp: &mut TcpStream) -> Duration {
    let inicio = Instant::now();
    let mut resto = Vec::new();
    let _ = tokio::time::timeout(WAIT, tcp.read_to_end(&mut resto)).await.expect("a sala não fechou a conexão");
    inicio.elapsed()
}

/// `true` se a conexão continua aberta (a leitura não terminou em `espera`).
async fn segue_aberta(tcp: &mut TcpStream, espera: Duration) -> bool {
    let mut buf = [0u8; 16];
    tokio::time::timeout(espera, tcp.read(&mut buf)).await.is_err()
}

/// Lê UMA resposta HTTP/1.1 com `content-length`; devolve a linha de status.
async fn ler_resposta(tcp: &mut TcpStream) -> String {
    let mut lido = Vec::new();
    let mut pedaco = [0u8; 1024];
    let fim = loop {
        if let Some(fim) = lido.windows(4).position(|w| w == b"\r\n\r\n") {
            break fim + 4;
        }
        let n = tokio::time::timeout(WAIT, tcp.read(&mut pedaco)).await.unwrap().unwrap();
        assert!(n > 0, "a sala fechou antes da resposta");
        lido.extend_from_slice(&pedaco[..n]);
    };
    let cabeca = String::from_utf8(lido[..fim].to_vec()).unwrap().to_ascii_lowercase();
    let tamanho: usize = cabeca
        .lines()
        .find_map(|linha| linha.strip_prefix("content-length:"))
        .map(|valor| valor.trim().parse().unwrap())
        .unwrap_or(0);
    let mut corpo = lido[fim..].to_vec();
    while corpo.len() < tamanho {
        let n = tokio::time::timeout(WAIT, tcp.read(&mut pedaco)).await.unwrap().unwrap();
        assert!(n > 0, "a sala fechou no meio do corpo");
        corpo.extend_from_slice(&pedaco[..n]);
    }
    cabeca.lines().next().unwrap().to_owned()
}

/// Slowloris: o pedido começa e nunca termina. Cai no prazo do cabeçalho.
/// Mutação vermelha: leitura do socket sem o prazo.
#[tokio::test]
async fn pedido_que_nao_termina_cai_no_prazo_do_cabecalho() {
    let (addr, _room) = abrir_sala(com_prazo_curto()).await;
    let mut tcp = TcpStream::connect(addr).await.unwrap();
    tcp.write_all(b"GET /player HTTP/1.1\r\nHost: 127.0.0.1\r\n").await.unwrap();
    let tempo = tempo_ate_fechar(&mut tcp).await;
    assert!(tempo < Duration::from_secs(5), "o prazo do cabeçalho só valeu em {tempo:?}");
}

/// Keep-alive: duas respostas seguidas na mesma conexão; ociosa depois
/// delas, cai no prazo do próximo cabeçalho. Mutação vermelha: o socket
/// escoado sem armar a espera do próximo cabeçalho.
#[tokio::test]
async fn keep_alive_ocioso_cai_no_prazo_do_cabecalho() {
    let (addr, _room) = abrir_sala(com_prazo_curto()).await;
    let mut tcp = TcpStream::connect(addr).await.unwrap();
    let pedido = format!("GET /media/nada HTTP/1.1\r\nHost: {addr}\r\n\r\n");
    for _ in 0..2 {
        tcp.write_all(pedido.as_bytes()).await.unwrap();
        assert!(ler_resposta(&mut tcp).await.starts_with("http/1.1 404"));
    }
    let tempo = tempo_ate_fechar(&mut tcp).await;
    assert!(tempo >= PRAZO_DO_CABECALHO / 2, "caiu antes do prazo: {tempo:?}");
    assert!(tempo < Duration::from_secs(5), "a keep-alive ociosa só caiu em {tempo:?}");
}

/// O WebSocket de quem só está ouvindo NÃO cai no prazo do cabeçalho: o 101
/// não volta a esperar cabeçalho. Mutação vermelha: vigiar também o 101.
#[tokio::test]
async fn websocket_nao_cai_no_prazo_do_cabecalho() {
    let (addr, _room) = abrir_sala(com_prazo_curto()).await;
    let mut req = format!("ws://{addr}/ws").into_client_request().unwrap();
    req.headers_mut().insert("Origin", HeaderValue::from_str(&format!("http://{addr}")).unwrap());
    let (mut ws, _) = tokio_tungstenite::connect_async(req).await.unwrap();
    ws.send(Message::text(json!({"type":"join","code":CODE,"name":"Ana"}).to_string())).await.unwrap();
    let primeiro = tokio::time::timeout(WAIT, ws.next()).await.unwrap();
    assert!(matches!(primeiro, Some(Ok(Message::Text(_)))), "{primeiro:?}");

    tokio::time::sleep(PRAZO_DO_CABECALHO * 4).await;
    ws.send(Message::Ping(b"vivo".to_vec().into())).await.unwrap();
    let pong = tokio::time::timeout(WAIT, async {
        loop {
            match ws.next().await {
                Some(Ok(Message::Pong(dados))) => return Some(dados),
                Some(Ok(_)) => continue,
                _ => return None,
            }
        }
    })
    .await
    .unwrap();
    assert_eq!(pong.as_deref(), Some(b"vivo".as_slice()), "o WebSocket caiu depois do prazo do cabeçalho");
}

/// Teto de `CONEXOES_MAX` (128): a 129ª é fechada no aceite, as outras seguem
/// abertas. Mutação vermelha: `accept` sem o semáforo.
#[tokio::test]
async fn a_conexao_129_e_fechada_no_aceite() {
    let (addr, _room) = abrir_sala(LimitesDaSala::default()).await;
    let mut abertas = Vec::with_capacity(conexao::CONEXOES_MAX);
    for _ in 0..conexao::CONEXOES_MAX {
        abertas.push(TcpStream::connect(addr).await.unwrap());
    }
    let mut excedente = TcpStream::connect(addr).await.unwrap();
    let tempo = tempo_ate_fechar(&mut excedente).await;
    assert!(tempo < Duration::from_secs(5), "a 129ª só caiu em {tempo:?}");
    for (indice, aberta) in abertas.iter_mut().enumerate().step_by(31) {
        assert!(segue_aberta(aberta, Duration::from_millis(200)).await, "a conexão {indice} caiu");
    }
    // Uma das 128 sai: a vaga volta e uma nova é atendida.
    drop(abertas.pop());
    let prazo = Instant::now() + WAIT;
    loop {
        let mut nova = TcpStream::connect(addr).await.unwrap();
        nova.write_all(format!("GET /media/nada HTTP/1.1\r\nHost: {addr}\r\nConnection: close\r\n\r\n").as_bytes()).await.unwrap();
        let mut resposta = Vec::new();
        let _ = tokio::time::timeout(WAIT, nova.read_to_end(&mut resposta)).await.unwrap();
        if resposta.starts_with(b"HTTP/1.1 404") {
            break;
        }
        assert!(Instant::now() < prazo, "a vaga solta não voltou");
        tokio::time::sleep(Duration::from_millis(50)).await;
    }
}
