//! SONS AO VIVO, fatia F5a (contrato em `docs/planos/sons-f5-plano-tecnico-2026-10-23.md`,
//! seção 2): o servidor da sala entrega `/sons/{id}` só à conexão a quem o
//! host liberou aquele áudio, e só da pasta da aventura aberta.
//!
//! - Cada conexão recebe uma CHAVE de 32 bytes sorteados (`midia.chave`, o
//!   primeiro frame do socket). O jogador a manda no cabeçalho
//!   `X-Labirinto-Chave`; a chave nunca passa pelo IPC do mestre.
//! - O host libera os áudios no mesmo `net_send` da mensagem que os entrega
//!   (`liberar`): o liberado é, por construção, o que saiu para aquela conexão.
//!   Queda, kick, troca de aventura e fim da sala revogam.
//! - A leitura confere o caminho real (sem link nem junção no caminho), o teto
//!   de 15 MB, o tipo pela ASSINATURA dos bytes e o SHA-256 igual ao id.
//!
//! Toda recusa da rota é o mesmo 404; a decisão de qual recusa foi fica aqui
//! dentro, nunca na resposta.

use std::collections::{HashMap, HashSet, VecDeque};
use std::convert::Infallible;
use std::fmt;
use std::io::Read;
use std::net::IpAddr;
use std::path::{Path, PathBuf};
use std::pin::Pin;
use std::sync::{Arc, Mutex};
use std::task::{Context, Poll};
use std::time::{Duration, Instant};

use axum::body::Bytes;
use rand::TryRngCore;
use sha2::{Digest, Sha256};

use super::media::{tipo_do_id, tipo_dos_bytes, TipoDeMidia, PASTA_DE_MIDIA};
use super::server::{lock, ClientId};

/// Cabeçalho em que o jogador prova a conexão (`carregadorDeSons.ts`).
pub const CABECALHO_DA_CHAVE: &str = "x-labirinto-chave";
/// `type` do primeiro frame de cada conexão.
pub const TIPO_DO_FRAME_DA_CHAVE: &str = "midia.chave";
/// O arquivo que faz de uma pasta uma aventura (`lib/adventure.ts`).
pub const ARQUIVO_DA_AVENTURA: &str = "adventure.json";
/// Ids por `net_send`: o mesmo teto da pré-carga do protocolo (`SOM_PRECARGA_MAX`).
pub const LIBERAR_MAX_POR_ENVIO: usize = 32;
/// Áudios liberados por conexão. A biblioteca tem no máximo 200 efeitos e o id
/// é o hash do conteúdo, então o uso legítimo não chega aqui.
pub const LIBERADAS_MAX_POR_CONEXAO: usize = 256;
/// Buscas em andamento com a mesma chave (uma pré-carga e um toque).
pub const BUSCAS_MAX_POR_CHAVE: usize = 2;
/// Buscas em andamento na sala inteira: 6 x 15 MB é o pico de memória aceito.
pub const BUSCAS_MAX_NA_SALA: usize = 6;
/// Buscas por IP dentro de `JANELA_DAS_BUSCAS`.
pub const BUSCAS_MAX_POR_IP: usize = 30;
pub const JANELA_DAS_BUSCAS: Duration = Duration::from_secs(10);
/// IPs com busca na janela que a sala acompanha. Cheia, a busca de um IP novo
/// é recusada (429): a tabela não cresce sem teto sob ataque.
pub const IPS_RASTREADOS_MAX: usize = 4096;
/// `Retry-After` quando o que falta é vaga de busca simultânea.
pub const ESPERA_DAS_SIMULTANEAS: Duration = Duration::from_secs(1);
/// Bytes da chave (256 bits).
pub const TAMANHO_DA_CHAVE: usize = 32;
/// Pedaço de leitura: o corpo sai em pedaços que vão sendo soltos ao enviar.
const PEDACO_DA_LEITURA: usize = 256 * 1024;
/// Marcas (`major_brand` do `ftyp`) aceitas como m4a: as mesmas do TS (`lib/midia.ts`).
const MARCAS_DE_M4A: [&[u8; 4]; 4] = [b"M4A ", b"M4B ", b"mp42", b"isom"];
/// Caixa `ftyp` mínima: tamanho, tipo, marca e versão (4 bytes cada).
const CAIXA_FTYP_MIN: u32 = 16;
/// Cada marca compatível depois do mínimo ocupa 4 bytes.
const MARCA_BYTES: u32 = 4;

pub type Chave = [u8; TAMANHO_DA_CHAVE];

/// Erros dos comandos, em texto fixo (o TS só mostra que falhou).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ErroDosSons {
    SemSala,
    ClienteInvalido,
    MidiaInvalida,
    LimiteDeLiberacao,
    PastaInvalida,
}

impl ErroDosSons {
    pub fn texto(self) -> &'static str {
        match self {
            Self::SemSala => "sem-sala",
            Self::ClienteInvalido => "cliente-invalido",
            Self::MidiaInvalida => "midia-invalida",
            Self::LimiteDeLiberacao => "limite-de-liberacao",
            Self::PastaInvalida => "pasta-invalida",
        }
    }
}

impl fmt::Display for ErroDosSons {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.texto())
    }
}

// --- Chave da conexão ---------------------------------------------------------

/// 32 bytes do gerador do sistema. `None` só se o SO não entregar aleatoriedade:
/// a conexão segue sem chave e os sons não saem para ela.
pub fn nova_chave() -> Option<Chave> {
    let mut chave = [0u8; TAMANHO_DA_CHAVE];
    rand::rngs::OsRng.try_fill_bytes(&mut chave).ok()?;
    Some(chave)
}

pub fn chave_em_hex(chave: &Chave) -> String {
    chave.iter().map(|byte| format!("{byte:02x}")).collect()
}

/// O primeiro frame da conexão: `{"type":"midia.chave","chave":"<64 hex>"}`.
pub fn frame_da_chave(chave: &Chave) -> String {
    serde_json::json!({ "type": TIPO_DO_FRAME_DA_CHAVE, "chave": chave_em_hex(chave) }).to_string()
}

/// O valor do cabeçalho: exatamente 64 hex minúsculos (como o frame manda).
/// Qualquer outra forma é `None`. Decodificar não depende de segredo nenhum.
pub fn chave_do_cabecalho(valor: &[u8]) -> Option<Chave> {
    if valor.len() != TAMANHO_DA_CHAVE * 2 {
        return None;
    }
    let mut chave = [0u8; TAMANHO_DA_CHAVE];
    for (byte, par) in chave.iter_mut().zip(valor.chunks_exact(2)) {
        let [alto, baixo] = par else {
            return None;
        };
        *byte = (valor_do_hex(*alto)? << 4) | valor_do_hex(*baixo)?;
    }
    Some(chave)
}

fn valor_do_hex(c: u8) -> Option<u8> {
    match c {
        b'0'..=b'9' => Some(c - b'0'),
        b'a'..=b'f' => Some(c - b'a' + 10),
        _ => None,
    }
}

/// Compara sem sair no primeiro byte diferente: o tempo não diz quantos bytes
/// do começo a tentativa acertou. `visitar` recebe cada posição lida (no
/// servidor, nada): o teste prova que são sempre as 32.
fn chaves_iguais_contando(a: &Chave, b: &Chave, visitar: &mut dyn FnMut(usize)) -> bool {
    let mut diferenca = 0u8;
    for (posicao, (x, y)) in a.iter().zip(b.iter()).enumerate() {
        visitar(posicao);
        diferenca |= std::hint::black_box(x ^ y);
    }
    std::hint::black_box(diferenca) == 0
}

// --- Estado da sala -------------------------------------------------------------

#[derive(Debug, Default)]
struct Conexao {
    chave: Option<Chave>,
    liberadas: HashSet<String>,
}

/// Chaves, liberações e a pasta da aventura de UMA sala (`Room.sons`).
#[derive(Debug, Default)]
pub struct SonsDaSala {
    /// `<pasta canônica da aventura>/midia`; `None` = a rota só dá 404.
    raiz: Option<PathBuf>,
    conexoes: HashMap<ClientId, Conexao>,
}

impl SonsDaSala {
    /// A conexão que acabou de entrar, com a chave que foi no primeiro frame.
    pub fn registrar(&mut self, cliente: ClientId, chave: Option<Chave>) {
        self.conexoes.insert(cliente, Conexao { chave, liberadas: HashSet::new() });
    }

    /// Queda ou kick: a chave deixa de valer e as liberações somem.
    pub fn esquecer(&mut self, cliente: ClientId) {
        self.conexoes.remove(&cliente);
    }

    /// Libera `ids` (já conferidos por `conferir_ids_para_liberar`) para
    /// `cliente`. Devolve só os que eram novos, para `desfazer` se o envio falhar.
    pub fn liberar(&mut self, cliente: ClientId, ids: &[String]) -> Result<Vec<String>, ErroDosSons> {
        let conexao = self.conexoes.get_mut(&cliente).ok_or(ErroDosSons::ClienteInvalido)?;
        let mut novos: Vec<String> = Vec::new();
        for id in ids {
            if !conexao.liberadas.contains(id) && !novos.contains(id) {
                novos.push(id.clone());
            }
        }
        // Vaga que sobra: zero quando já está no teto (clamp, nunca negativo).
        let vagas = LIBERADAS_MAX_POR_CONEXAO.saturating_sub(conexao.liberadas.len());
        if novos.len() > vagas {
            return Err(ErroDosSons::LimiteDeLiberacao);
        }
        conexao.liberadas.extend(novos.iter().cloned());
        Ok(novos)
    }

    /// Tira só o que `liberar` acabou de pôr: o que já estava liberado fica.
    pub fn desfazer(&mut self, cliente: ClientId, novos: &[String]) {
        if let Some(conexao) = self.conexoes.get_mut(&cliente) {
            for id in novos {
                conexao.liberadas.remove(id);
            }
        }
    }

    pub fn esta_liberado(&self, cliente: ClientId, id: &str) -> bool {
        self.conexoes.get(&cliente).is_some_and(|conexao| conexao.liberadas.contains(id))
    }

    /// Outra aventura (ou nenhuma): toda liberação de antes deixa de valer.
    pub fn definir_raiz(&mut self, raiz: Option<PathBuf>) {
        if self.raiz != raiz {
            for conexao in self.conexoes.values_mut() {
                conexao.liberadas.clear();
            }
            self.raiz = raiz;
        }
    }

    /// A conexão dona da chave. Passa por TODAS as chaves, sem parar na que bate.
    pub fn cliente_da_chave(&self, chave: &Chave) -> Option<ClientId> {
        self.cliente_da_chave_contando(chave, &mut |_| ())
    }

    fn cliente_da_chave_contando(&self, chave: &Chave, visitar: &mut dyn FnMut(usize)) -> Option<ClientId> {
        let mut achado = None;
        for (cliente, conexao) in &self.conexoes {
            if let Some(guardada) = &conexao.chave {
                if chaves_iguais_contando(guardada, chave, visitar) {
                    achado = Some(*cliente);
                }
            }
        }
        achado
    }

    /// A pasta de onde ler `id` para quem mostrou `chave`; `None` = 404.
    pub fn autorizar(&self, chave: &Chave, id: &str) -> Option<PathBuf> {
        let cliente = self.cliente_da_chave(chave)?;
        if !self.esta_liberado(cliente, id) {
            return None;
        }
        self.raiz.clone()
    }
}

pub fn eh_id_de_audio(id: &str) -> bool {
    tipo_do_id(id).is_some_and(TipoDeMidia::eh_audio)
}

/// `liberar` do `net_send`: até `LIBERAR_MAX_POR_ENVIO` ids, todos de áudio.
pub fn conferir_ids_para_liberar(ids: &[String]) -> Result<(), ErroDosSons> {
    if ids.len() > LIBERAR_MAX_POR_ENVIO {
        return Err(ErroDosSons::LimiteDeLiberacao);
    }
    if ids.iter().all(|id| eh_id_de_audio(id)) {
        Ok(())
    } else {
        Err(ErroDosSons::MidiaInvalida)
    }
}

// --- Pasta da aventura -------------------------------------------------------------

/// `net_sons_aventura`: a pasta tem de ser absoluta, uma pasta de verdade (não
/// link nem junção) e ter o `adventure.json`. Devolve `<pasta canônica>/midia`.
/// A `midia` não precisa existir ainda (aventura sem som): quem confere o
/// caminho é a leitura, arquivo por arquivo.
pub fn raiz_da_aventura(pasta: &Path) -> Result<PathBuf, ErroDosSons> {
    if !pasta.is_absolute() {
        return Err(ErroDosSons::PastaInvalida);
    }
    let info = std::fs::symlink_metadata(pasta).map_err(|_| ErroDosSons::PastaInvalida)?;
    // `is_dir` do `symlink_metadata` é falso para link e junção (não segue).
    if !info.is_dir() {
        return Err(ErroDosSons::PastaInvalida);
    }
    let marca = std::fs::symlink_metadata(pasta.join(ARQUIVO_DA_AVENTURA)).map_err(|_| ErroDosSons::PastaInvalida)?;
    if !marca.is_file() {
        return Err(ErroDosSons::PastaInvalida);
    }
    let canonica = std::fs::canonicalize(pasta).map_err(|_| ErroDosSons::PastaInvalida)?;
    Ok(canonica.join(PASTA_DE_MIDIA))
}

// --- Leitura do áudio --------------------------------------------------------------

/// Por que o áudio não saiu. A rota responde o mesmo 404 para todos.
#[derive(Debug, PartialEq, Eq)]
pub enum RecusaDoAudio {
    IdInvalido,
    NaoEncontrado,
    ForaDaPasta,
    GrandeDemais,
    Leitura,
    ConteudoNaoConfere,
}

/// O áudio pronto para sair: o tipo veio da assinatura e o hash bateu.
#[derive(Debug)]
pub struct AudioConferido {
    pub tipo: TipoDeMidia,
    pub tamanho: u64,
    pub pedacos: VecDeque<Bytes>,
}

/// Regra pura do caminho: o caminho REAL do arquivo tem de ser exatamente
/// `<raiz>/<id>`. Link ou junção em qualquer ponto (no arquivo ou na `midia`)
/// leva o caminho real para outro lugar e não passa.
pub fn caminho_real_confere(raiz: &Path, id: &str, real: &Path) -> bool {
    real == raiz.join(id)
}

/// m4a de áudio: a caixa `ftyp` bem formada e com marca de áudio (vídeo MP4,
/// HEIC e AVIF também começam com `ftyp`).
pub fn m4a_de_audio(inicio: &[u8], total: u64) -> bool {
    let Some(tamanho) = inicio.get(0..4).and_then(|b| <[u8; 4]>::try_from(b).ok()).map(u32::from_be_bytes) else {
        return false;
    };
    let marca_ok = inicio.get(8..12).is_some_and(|marca| MARCAS_DE_M4A.iter().any(|aceita| marca == aceita.as_slice()));
    let tamanho_ok =
        tamanho.checked_sub(CAIXA_FTYP_MIN).is_some_and(|resto| resto % MARCA_BYTES == 0) && u64::from(tamanho) <= total;
    inicio.get(4..8) == Some(b"ftyp".as_slice()) && marca_ok && tamanho_ok
}

/// O tipo pela ASSINATURA dos bytes, e só se for o mesmo do id.
pub fn tipo_conferido(inicio: &[u8], total: u64, do_id: TipoDeMidia) -> Option<TipoDeMidia> {
    let tipo = tipo_dos_bytes(inicio).filter(|tipo| *tipo == do_id && tipo.eh_audio())?;
    if tipo == TipoDeMidia::M4a && !m4a_de_audio(inicio, total) {
        return None;
    }
    Some(tipo)
}

/// Lê `<raiz>/<id>` conferido. Bloqueante: roda em `spawn_blocking`.
pub fn ler_audio_conferido(raiz: &Path, id: &str) -> Result<AudioConferido, RecusaDoAudio> {
    let do_id = tipo_do_id(id).filter(|tipo| tipo.eh_audio()).ok_or(RecusaDoAudio::IdInvalido)?;
    let caminho = raiz.join(id);
    // `symlink_metadata` não segue: o próprio arquivo não pode ser link.
    let info = std::fs::symlink_metadata(&caminho).map_err(|_| RecusaDoAudio::NaoEncontrado)?;
    if !info.is_file() {
        return Err(RecusaDoAudio::NaoEncontrado);
    }
    let real = std::fs::canonicalize(&caminho).map_err(|_| RecusaDoAudio::NaoEncontrado)?;
    if !caminho_real_confere(raiz, id, &real) {
        return Err(RecusaDoAudio::ForaDaPasta);
    }
    let teto = do_id.teto();
    if info.len() > teto {
        return Err(RecusaDoAudio::GrandeDemais);
    }
    let arquivo = std::fs::File::open(&real).map_err(|_| RecusaDoAudio::Leitura)?;
    let (pedacos, tamanho, hash) = ler_em_pedacos(arquivo, teto)?;
    let inicio: &[u8] = match pedacos.front() {
        Some(pedaco) => pedaco.as_ref(),
        None => &[],
    };
    let hash_ok = id.split_once('.').is_some_and(|(nome, _)| nome == hash);
    let tipo = tipo_conferido(inicio, tamanho, do_id).filter(|_| hash_ok).ok_or(RecusaDoAudio::ConteudoNaoConfere)?;
    Ok(AudioConferido { tipo, tamanho, pedacos })
}

/// Lê até `teto` bytes em pedaços, calculando o SHA-256 junto. Um byte além do
/// teto (o arquivo cresceu depois do `metadata`) é recusa.
fn ler_em_pedacos(arquivo: std::fs::File, teto: u64) -> Result<(VecDeque<Bytes>, u64, String), RecusaDoAudio> {
    // `teto` é um dos tetos de `media.rs` (até 15 MB): o `+ 1` não estoura.
    let mut leitor = arquivo.take(teto.saturating_add(1));
    let mut hasher = Sha256::new();
    let mut pedacos = VecDeque::new();
    let mut total: u64 = 0;
    loop {
        let mut pedaco = vec![0u8; PEDACO_DA_LEITURA];
        let lidos = encher(&mut leitor, &mut pedaco)?;
        if lidos == 0 {
            break;
        }
        pedaco.truncate(lidos);
        total = total.checked_add(u64::try_from(lidos).map_err(|_| RecusaDoAudio::GrandeDemais)?).ok_or(RecusaDoAudio::GrandeDemais)?;
        if total > teto {
            return Err(RecusaDoAudio::GrandeDemais);
        }
        hasher.update(&pedaco);
        pedacos.push_back(Bytes::from(pedaco));
        if lidos < PEDACO_DA_LEITURA {
            break;
        }
    }
    let hash: String = hasher.finalize().iter().map(|byte| format!("{byte:02x}")).collect();
    Ok((pedacos, total, hash))
}

/// Enche `buf` até o fim do arquivo; devolve quantos bytes entraram.
fn encher(leitor: &mut impl Read, buf: &mut [u8]) -> Result<usize, RecusaDoAudio> {
    let mut cheio = 0;
    while let Some(resto) = buf.get_mut(cheio..).filter(|resto| !resto.is_empty()) {
        match leitor.read(resto) {
            Ok(0) => break,
            Ok(lidos) => cheio += lidos,
            Err(erro) if erro.kind() == std::io::ErrorKind::Interrupted => {}
            Err(_) => return Err(RecusaDoAudio::Leitura),
        }
    }
    Ok(cheio)
}

// --- Limites de busca -----------------------------------------------------------

/// Taxa por IP (janela deslizante) e buscas simultâneas por chave e na sala.
/// O tempo entra por parâmetro para o teste não depender de relógio.
#[derive(Debug, Default)]
pub struct LimiteDasBuscas {
    por_ip: HashMap<IpAddr, VecDeque<Instant>>,
    /// Pela chave COMO VEIO no cabeçalho (`None` = sem chave ou torta): decidido
    /// antes de olhar se a chave vale e qual é o id.
    em_voo_por_chave: HashMap<Option<Chave>, usize>,
    em_voo_na_sala: usize,
}

impl LimiteDasBuscas {
    /// Conta uma busca. `Err(espera)` = 429 com `Retry-After`.
    pub fn entrar(&mut self, ip: IpAddr, chave: Option<Chave>, agora: Instant) -> Result<(), Duration> {
        if !self.por_ip.contains_key(&ip) && self.por_ip.len() >= IPS_RASTREADOS_MAX {
            self.por_ip.retain(|_, vezes| {
                esquecer_vencidas(vezes, agora);
                !vezes.is_empty()
            });
            if self.por_ip.len() >= IPS_RASTREADOS_MAX {
                return Err(JANELA_DAS_BUSCAS);
            }
        }
        let vezes = self.por_ip.entry(ip).or_default();
        esquecer_vencidas(vezes, agora);
        if vezes.len() >= BUSCAS_MAX_POR_IP {
            let espera = vezes
                .front()
                .map_or(JANELA_DAS_BUSCAS, |primeira| JANELA_DAS_BUSCAS.saturating_sub(agora.saturating_duration_since(*primeira)));
            return Err(espera);
        }
        let da_chave = self.em_voo_por_chave.get(&chave).copied().unwrap_or(0);
        if da_chave >= BUSCAS_MAX_POR_CHAVE || self.em_voo_na_sala >= BUSCAS_MAX_NA_SALA {
            return Err(ESPERA_DAS_SIMULTANEAS);
        }
        vezes.push_back(agora);
        // Os dois contadores ficam abaixo dos tetos (2 e 6), conferidos acima.
        self.em_voo_por_chave.insert(chave, da_chave + 1);
        self.em_voo_na_sala += 1;
        Ok(())
    }

    /// A busca terminou (corpo enviado, cliente saiu ou recusa).
    pub fn sair(&mut self, chave: Option<Chave>) {
        if let Some(contagem) = self.em_voo_por_chave.get_mut(&chave) {
            *contagem = contagem.saturating_sub(1);
            if *contagem == 0 {
                self.em_voo_por_chave.remove(&chave);
            }
        }
        self.em_voo_na_sala = self.em_voo_na_sala.saturating_sub(1);
    }

    pub fn em_voo_na_sala(&self) -> usize {
        self.em_voo_na_sala
    }

    pub fn ips_rastreados(&self) -> usize {
        self.por_ip.len()
    }
}

fn esquecer_vencidas(vezes: &mut VecDeque<Instant>, agora: Instant) {
    while vezes.front().is_some_and(|vez| agora.saturating_duration_since(*vez) >= JANELA_DAS_BUSCAS) {
        vezes.pop_front();
    }
}

/// Vaga de uma busca: devolvida no `drop`, que acontece quando o CORPO termina
/// de sair (ou o cliente desiste), não quando o handler retorna.
pub struct VagaDeBusca {
    limite: Arc<Mutex<LimiteDasBuscas>>,
    chave: Option<Chave>,
}

impl VagaDeBusca {
    pub fn pedir(limite: &Arc<Mutex<LimiteDasBuscas>>, ip: IpAddr, chave: Option<Chave>, agora: Instant) -> Result<Self, Duration> {
        lock(limite).entrar(ip, chave, agora)?;
        Ok(Self { limite: limite.clone(), chave })
    }
}

impl Drop for VagaDeBusca {
    fn drop(&mut self) {
        lock(&self.limite).sair(self.chave);
    }
}

/// O corpo da resposta 200: os pedaços já conferidos, soltos um a um enquanto
/// saem, e a vaga presa até o último.
pub struct CorpoDoSom {
    pedacos: VecDeque<Bytes>,
    _vaga: VagaDeBusca,
}

impl CorpoDoSom {
    pub fn novo(pedacos: VecDeque<Bytes>, vaga: VagaDeBusca) -> Self {
        Self { pedacos, _vaga: vaga }
    }
}

impl futures_core::Stream for CorpoDoSom {
    type Item = Result<Bytes, Infallible>;

    fn poll_next(self: Pin<&mut Self>, _cx: &mut Context<'_>) -> Poll<Option<Self::Item>> {
        Poll::Ready(self.get_mut().pedacos.pop_front().map(Ok))
    }

    fn size_hint(&self) -> (usize, Option<usize>) {
        (self.pedacos.len(), Some(self.pedacos.len()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::net::media::hash_hex;

    fn chave(byte: u8) -> Chave {
        [byte; TAMANHO_DA_CHAVE]
    }

    fn id_de_audio(bytes: &[u8], extensao: &str) -> String {
        format!("{}.{extensao}", hash_hex(bytes))
    }

    #[test]
    fn chave_nova_tem_32_bytes_e_nao_se_repete() {
        let (Some(a), Some(b)) = (nova_chave(), nova_chave()) else {
            panic!("o SO não entregou aleatoriedade");
        };
        assert_ne!(a, b);
        let hex = chave_em_hex(&a);
        assert_eq!(hex.len(), 64);
        assert_eq!(chave_do_cabecalho(hex.as_bytes()), Some(a));
        let frame: serde_json::Value = serde_json::from_str(&frame_da_chave(&a)).unwrap_or_default();
        assert_eq!(frame, serde_json::json!({ "type": "midia.chave", "chave": hex }));
    }

    #[test]
    fn cabecalho_so_aceita_64_hex_minusculos() {
        let hex = chave_em_hex(&chave(0xab));
        assert_eq!(chave_do_cabecalho(hex.as_bytes()), Some(chave(0xab)));
        for ruim in [
            hex.to_uppercase(),
            hex[1..].to_owned(),
            format!("{hex}0"),
            format!("{}g", &hex[1..]),
            format!(" {}", &hex[1..]),
            String::new(),
        ] {
            assert_eq!(chave_do_cabecalho(ruim.as_bytes()), None, "{ruim:?}");
        }
    }

    /// Mutação vermelha: `a == b` (sai no primeiro byte diferente, ou nem
    /// passa pelo laço) muda a contagem.
    #[test]
    fn comparacao_le_sempre_os_32_bytes() {
        let base = chave(7);
        let mut no_comeco = base;
        no_comeco[0] = 8;
        let mut no_fim = base;
        no_fim[TAMANHO_DA_CHAVE - 1] = 8;
        for (outra, iguais) in [(base, true), (no_comeco, false), (no_fim, false)] {
            let mut lidas = Vec::new();
            assert_eq!(chaves_iguais_contando(&base, &outra, &mut |posicao| lidas.push(posicao)), iguais);
            assert_eq!(lidas, (0..TAMANHO_DA_CHAVE).collect::<Vec<_>>());
        }
    }

    #[test]
    fn busca_da_chave_passa_por_todas_as_conexoes() {
        let mut sons = SonsDaSala::default();
        for (cliente, byte) in [(1, 1), (2, 2), (3, 3)] {
            sons.registrar(cliente, Some(chave(byte)));
        }
        sons.registrar(4, None);
        for (procurada, esperado) in [(chave(2), Some(2)), (chave(9), None)] {
            let mut lidas = 0usize;
            assert_eq!(sons.cliente_da_chave_contando(&procurada, &mut |_| lidas += 1), esperado);
            assert_eq!(lidas, 3 * TAMANHO_DA_CHAVE, "parou antes de ler todas as chaves");
        }
    }

    #[test]
    fn liberar_desfazer_e_esquecer() {
        let a = id_de_audio(b"a", "mp3");
        let b = id_de_audio(b"b", "ogg");
        let mut sons = SonsDaSala::default();
        assert_eq!(sons.liberar(1, std::slice::from_ref(&a)), Err(ErroDosSons::ClienteInvalido));
        sons.registrar(1, Some(chave(1)));
        assert_eq!(sons.liberar(1, &[a.clone(), a.clone()]), Ok(vec![a.clone()]));
        // `a` já estava: só `b` é novo, e desfazer não tira o `a`.
        let novos = sons.liberar(1, &[a.clone(), b.clone()]);
        assert_eq!(novos, Ok(vec![b.clone()]));
        sons.desfazer(1, std::slice::from_ref(&b));
        assert!(sons.esta_liberado(1, &a));
        assert!(!sons.esta_liberado(1, &b));
        assert!(!sons.esta_liberado(2, &a));
        sons.esquecer(1);
        assert!(!sons.esta_liberado(1, &a));
        assert_eq!(sons.cliente_da_chave(&chave(1)), None);
    }

    /// Mutação vermelha "limite sem teto": tirar a conta de vagas.
    #[test]
    fn liberadas_por_conexao_tem_teto() {
        let mut sons = SonsDaSala::default();
        sons.registrar(1, Some(chave(1)));
        let ids: Vec<String> = (0..LIBERADAS_MAX_POR_CONEXAO).map(|n| id_de_audio(&n.to_be_bytes(), "wav")).collect();
        for lote in ids.chunks(LIBERAR_MAX_POR_ENVIO) {
            assert!(sons.liberar(1, lote).is_ok());
        }
        let mais_um = id_de_audio(b"mais um", "wav");
        assert_eq!(sons.liberar(1, std::slice::from_ref(&mais_um)), Err(ErroDosSons::LimiteDeLiberacao));
        assert!(!sons.esta_liberado(1, &mais_um));
        // O que já está liberado de novo não ocupa vaga.
        assert!(sons.liberar(1, &ids[..2]).is_ok());
    }

    #[test]
    fn trocar_a_raiz_zera_as_liberacoes_e_a_mesma_nao() {
        let a = id_de_audio(b"a", "mp3");
        let mut sons = SonsDaSala::default();
        sons.registrar(1, Some(chave(1)));
        sons.definir_raiz(Some(PathBuf::from("/aventura-1/midia")));
        assert!(sons.liberar(1, std::slice::from_ref(&a)).is_ok());
        sons.definir_raiz(Some(PathBuf::from("/aventura-1/midia")));
        assert_eq!(sons.autorizar(&chave(1), &a), Some(PathBuf::from("/aventura-1/midia")));
        sons.definir_raiz(Some(PathBuf::from("/aventura-2/midia")));
        assert_eq!(sons.autorizar(&chave(1), &a), None);
        assert!(sons.liberar(1, std::slice::from_ref(&a)).is_ok());
        sons.definir_raiz(None);
        assert_eq!(sons.autorizar(&chave(1), &a), None);
    }

    #[test]
    fn liberar_so_aceita_ate_32_ids_de_audio() {
        let audio = id_de_audio(b"a", "m4a");
        assert_eq!(conferir_ids_para_liberar(&[]), Ok(()));
        assert_eq!(conferir_ids_para_liberar(std::slice::from_ref(&audio)), Ok(()));
        for ruim in [id_de_audio(b"a", "png"), "../x.mp3".to_owned(), audio.to_uppercase(), format!("{audio}.mp3")] {
            assert_eq!(conferir_ids_para_liberar(&[audio.clone(), ruim.clone()]), Err(ErroDosSons::MidiaInvalida), "{ruim}");
        }
        let demais = vec![audio; LIBERAR_MAX_POR_ENVIO + 1];
        assert_eq!(conferir_ids_para_liberar(&demais), Err(ErroDosSons::LimiteDeLiberacao));
    }

    #[test]
    fn caminho_real_tem_de_ser_exatamente_raiz_mais_id() {
        let raiz = Path::new("/aventura/midia");
        let id = id_de_audio(b"a", "mp3");
        assert!(caminho_real_confere(raiz, &id, &raiz.join(&id)));
        for real in [
            PathBuf::from("/outra/midia").join(&id),
            raiz.join("sub").join(&id),
            PathBuf::from("/aventura").join(&id),
            raiz.join(id_de_audio(b"b", "mp3")),
        ] {
            assert!(!caminho_real_confere(raiz, &id, &real), "{real:?}");
        }
    }

    #[test]
    fn m4a_exige_ftyp_bem_formado_com_marca_de_audio() {
        let caixa = |tamanho: u32, marca: &[u8; 4]| {
            let mut bytes = tamanho.to_be_bytes().to_vec();
            bytes.extend_from_slice(b"ftyp");
            bytes.extend_from_slice(marca);
            bytes.resize(64, 0);
            bytes
        };
        for marca in [b"M4A ", b"M4B ", b"mp42", b"isom"] {
            let bytes = caixa(32, marca);
            assert_eq!(tipo_conferido(&bytes, 64, TipoDeMidia::M4a), Some(TipoDeMidia::M4a), "{marca:?}");
        }
        // Vídeo, HEIC e AVIF começam com `ftyp`; a caixa torta também não passa.
        for (tamanho, marca, total) in [
            (32, b"mp41", 64),
            (32, b"avc1", 64),
            (32, b"heic", 64),
            (32, b"avif", 64),
            (32, b"qt  ", 64),
            (8, b"M4A ", 64),
            (30, b"M4A ", 64),
            (128, b"M4A ", 64),
        ] {
            assert_eq!(tipo_conferido(&caixa(tamanho, marca), total, TipoDeMidia::M4a), None, "{tamanho} {marca:?}");
        }
        // Só os 12 bytes do começo bastam; a caixa não pode passar do arquivo.
        assert_eq!(tipo_conferido(b"\x00\x00\x00\x20ftypM4A ", 32, TipoDeMidia::M4a), Some(TipoDeMidia::M4a));
        assert_eq!(tipo_conferido(b"\x00\x00\x00\x20ftypM4A ", 31, TipoDeMidia::M4a), None);
        assert_eq!(tipo_conferido(b"\x00\x00\x00\x20ftypM4A", 32, TipoDeMidia::M4a), None);
    }

    #[test]
    fn tipo_vem_da_assinatura_e_tem_de_ser_o_do_id() {
        let mp3: &[u8] = b"ID3\x04\x00\x00\x00\x00\x00\x00";
        let ogg: &[u8] = b"OggS\x00\x02\x00\x00\x00\x00";
        assert_eq!(tipo_conferido(mp3, 10, TipoDeMidia::Mp3), Some(TipoDeMidia::Mp3));
        assert_eq!(tipo_conferido(mp3, 10, TipoDeMidia::Ogg), None);
        assert_eq!(tipo_conferido(ogg, 10, TipoDeMidia::Mp3), None);
        assert_eq!(tipo_conferido(b"\x89PNG\r\n\x1a\n", 8, TipoDeMidia::Png), None, "imagem nunca sai por /sons");
        assert_eq!(tipo_conferido(b"", 0, TipoDeMidia::Mp3), None);
    }

    fn pasta_de_teste(nome: &str) -> Result<PathBuf, std::io::Error> {
        let pasta = std::env::temp_dir().join(format!("labirinto-sons-{nome}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&pasta);
        std::fs::create_dir_all(pasta.join(PASTA_DE_MIDIA))?;
        std::fs::write(pasta.join(ARQUIVO_DA_AVENTURA), b"{}")?;
        Ok(pasta)
    }

    #[test]
    fn le_o_audio_em_pedacos_com_hash_e_teto() -> Result<(), std::io::Error> {
        let pasta = pasta_de_teste("leitura")?;
        let raiz = raiz_da_aventura(&pasta).map_err(|e| std::io::Error::other(e.texto()))?;
        // 3 pedaços e meio: o corpo sai em pedaços e junta igual.
        let mut grande = b"ID3\x04\x00\x00\x00\x00\x00\x00".to_vec();
        grande.resize(PEDACO_DA_LEITURA * 3 + 17, 0x55);
        let id = id_de_audio(&grande, "mp3");
        std::fs::write(raiz.join(&id), &grande)?;
        let audio = ler_audio_conferido(&raiz, &id).map_err(|e| std::io::Error::other(format!("{e:?}")))?;
        assert_eq!((audio.tipo, audio.tamanho, audio.pedacos.len()), (TipoDeMidia::Mp3, u64::try_from(grande.len()).unwrap_or(0), 4));
        assert_eq!(audio.pedacos.iter().flat_map(|p| p.iter().copied()).collect::<Vec<u8>>(), grande);

        // Hash de outro conteúdo, png com nome de mp3, id de imagem, o que falta, pasta com nome de id.
        let outro = format!("{}.mp3", hash_hex(b"outra coisa"));
        std::fs::write(raiz.join(&outro), &grande)?;
        assert_eq!(ler_audio_conferido(&raiz, &outro).err(), Some(RecusaDoAudio::ConteudoNaoConfere));
        let png: &[u8] = b"\x89PNG\r\n\x1a\n\x00\x00\x00\x0dIHDR";
        let png_como_mp3 = id_de_audio(png, "mp3");
        std::fs::write(raiz.join(&png_como_mp3), png)?;
        assert_eq!(ler_audio_conferido(&raiz, &png_como_mp3).err(), Some(RecusaDoAudio::ConteudoNaoConfere));
        let png_id = id_de_audio(png, "png");
        std::fs::write(raiz.join(&png_id), png)?;
        assert_eq!(ler_audio_conferido(&raiz, &png_id).err(), Some(RecusaDoAudio::IdInvalido));
        assert_eq!(ler_audio_conferido(&raiz, &id_de_audio(b"nada", "ogg")).err(), Some(RecusaDoAudio::NaoEncontrado));
        let como_pasta = id_de_audio(b"pasta", "wav");
        std::fs::create_dir_all(raiz.join(&como_pasta))?;
        assert_eq!(ler_audio_conferido(&raiz, &como_pasta).err(), Some(RecusaDoAudio::NaoEncontrado));
        assert_eq!(ler_audio_conferido(&raiz, "../adventure.json").err(), Some(RecusaDoAudio::IdInvalido));
        std::fs::remove_dir_all(&pasta)
    }

    #[test]
    fn audio_ate_15_mb_sai_e_um_byte_a_mais_nao() -> Result<(), std::io::Error> {
        let pasta = pasta_de_teste("teto")?;
        let raiz = raiz_da_aventura(&pasta).map_err(|e| std::io::Error::other(e.texto()))?;
        let teto = usize::try_from(TipoDeMidia::Wav.teto()).unwrap_or(usize::MAX);
        let mut wav = b"RIFF\x24\x00\x00\x00WAVEfmt ".to_vec();
        wav.resize(teto, 0);
        let id = id_de_audio(&wav, "wav");
        std::fs::write(raiz.join(&id), &wav)?;
        assert!(ler_audio_conferido(&raiz, &id).is_ok_and(|audio| audio.tamanho == TipoDeMidia::Wav.teto()));
        wav.push(0);
        let acima = id_de_audio(&wav, "wav");
        std::fs::write(raiz.join(&acima), &wav)?;
        assert_eq!(ler_audio_conferido(&raiz, &acima).err(), Some(RecusaDoAudio::GrandeDemais));
        std::fs::remove_dir_all(&pasta)
    }

    #[test]
    fn pasta_da_aventura_tem_de_ser_pasta_absoluta_com_adventure_json() -> Result<(), std::io::Error> {
        let pasta = pasta_de_teste("aventura")?;
        let canonica = std::fs::canonicalize(&pasta)?;
        assert_eq!(raiz_da_aventura(&pasta), Ok(canonica.join(PASTA_DE_MIDIA)));
        assert_eq!(raiz_da_aventura(Path::new("aventura-relativa")), Err(ErroDosSons::PastaInvalida));
        assert_eq!(raiz_da_aventura(&pasta.join(ARQUIVO_DA_AVENTURA)), Err(ErroDosSons::PastaInvalida));
        assert_eq!(raiz_da_aventura(&pasta.join("nao-existe")), Err(ErroDosSons::PastaInvalida));
        let sem_marca = pasta.join(PASTA_DE_MIDIA);
        assert_eq!(raiz_da_aventura(&sem_marca), Err(ErroDosSons::PastaInvalida));
        std::fs::remove_dir_all(&pasta)
    }

    fn agora_mais(base: Instant, ms: u64) -> Instant {
        base + Duration::from_millis(ms)
    }

    #[test]
    fn taxa_por_ip_para_na_trigesima_primeira_e_volta_depois_da_janela() {
        let ip = IpAddr::from([10, 0, 0, 1]);
        let outro = IpAddr::from([10, 0, 0, 2]);
        let t0 = Instant::now();
        let mut limite = LimiteDasBuscas::default();
        for n in 0..BUSCAS_MAX_POR_IP {
            let vez = agora_mais(t0, u64::try_from(n).unwrap_or(0) * 100);
            assert_eq!(limite.entrar(ip, None, vez), Ok(()), "busca {n}");
            limite.sair(None);
        }
        let t3 = agora_mais(t0, 3_000);
        assert_eq!(limite.entrar(ip, None, t3), Err(Duration::from_secs(7)));
        assert_eq!(limite.entrar(outro, None, t3), Ok(()));
        limite.sair(None);
        // A primeira sai da janela em 10 s: abre UMA vaga.
        let t10 = agora_mais(t0, 10_000);
        assert_eq!(limite.entrar(ip, None, t10), Ok(()));
        limite.sair(None);
        assert!(limite.entrar(ip, None, t10).is_err());
    }

    #[test]
    fn simultaneas_duas_por_chave_e_seis_na_sala() {
        let t0 = Instant::now();
        let mut limite = LimiteDasBuscas::default();
        let ip = |n: u8| IpAddr::from([10, 0, 1, n]);
        assert_eq!(limite.entrar(ip(1), Some(chave(1)), t0), Ok(()));
        assert_eq!(limite.entrar(ip(1), Some(chave(1)), t0), Ok(()));
        assert_eq!(limite.entrar(ip(1), Some(chave(1)), t0), Err(ESPERA_DAS_SIMULTANEAS));
        for n in 2..=5 {
            assert_eq!(limite.entrar(ip(n), Some(chave(n)), t0), Ok(()));
        }
        assert_eq!(limite.em_voo_na_sala(), BUSCAS_MAX_NA_SALA);
        assert_eq!(limite.entrar(ip(9), Some(chave(9)), t0), Err(ESPERA_DAS_SIMULTANEAS));
        limite.sair(Some(chave(1)));
        assert_eq!(limite.entrar(ip(9), Some(chave(9)), t0), Ok(()));
        assert_eq!(limite.entrar(ip(1), Some(chave(1)), t0), Err(ESPERA_DAS_SIMULTANEAS), "a sala está cheia de novo");
    }

    #[test]
    fn tabela_de_ips_tem_teto_e_se_limpa_com_o_tempo() {
        let t0 = Instant::now();
        let mut limite = LimiteDasBuscas::default();
        for n in 0..IPS_RASTREADOS_MAX {
            let ip = IpAddr::from(u32::try_from(n).unwrap_or(0).to_be_bytes());
            assert_eq!(limite.entrar(ip, None, t0), Ok(()));
            limite.sair(None);
        }
        let novo = IpAddr::from([203, 0, 113, 1]);
        assert_eq!(limite.entrar(novo, None, t0), Err(JANELA_DAS_BUSCAS));
        assert_eq!(limite.ips_rastreados(), IPS_RASTREADOS_MAX);
        let depois = agora_mais(t0, 10_000);
        assert_eq!(limite.entrar(novo, None, depois), Ok(()));
        assert_eq!(limite.ips_rastreados(), 1);
    }

    #[test]
    fn vaga_volta_quando_o_corpo_e_solto() {
        let limite = Arc::new(Mutex::new(LimiteDasBuscas::default()));
        let ip = IpAddr::from([10, 0, 2, 1]);
        let vaga = VagaDeBusca::pedir(&limite, ip, Some(chave(1)), Instant::now());
        let Ok(vaga) = vaga else {
            panic!("a primeira busca tem vaga");
        };
        let corpo = CorpoDoSom::novo(VecDeque::from([Bytes::from_static(b"a")]), vaga);
        assert_eq!(lock(&limite).em_voo_na_sala(), 1);
        drop(corpo);
        assert_eq!(lock(&limite).em_voo_na_sala(), 0);
    }
}
