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

use std::collections::{HashMap, VecDeque};
use std::fmt;
use std::io::{self, Read};
use std::net::IpAddr;
use std::path::{Path, PathBuf};
use std::pin::Pin;
use std::sync::{Arc, Mutex};
use std::task::{Context, Poll};
use std::time::{Duration, Instant};

use axum::body::Bytes;
use rand::TryRngCore;
use sha2::{Digest, Sha256};

use super::conexao::Corte;
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
/// é o hash do conteúdo; passando disso, sai a liberação mais velha (nunca
/// recusa o `net_send`).
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
/// Prazo total do corpo de um som: 15 MB em 120 s pede ~1 Mbit/s; o som
/// típico (até 3 MB) passa com 200 kbit/s.
pub const PRAZO_TOTAL_DO_CORPO: Duration = Duration::from_secs(120);
/// Pedaço de leitura: o corpo sai em pedaços que vão sendo soltos ao enviar.
const PEDACO_DA_LEITURA: usize = 256 * 1024;
/// Marcas (`major_brand` do `ftyp`) aceitas como m4a: as mesmas do TS (`lib/midia.ts`).
const MARCAS_DE_M4A: [&[u8; 4]; 4] = [b"M4A ", b"M4B ", b"mp42", b"isom"];
/// Caixa `ftyp` mínima: tamanho, tipo, marca e versão (4 bytes cada).
const CAIXA_FTYP_MIN: u32 = 16;
/// Cada marca compatível depois do mínimo ocupa 4 bytes.
const MARCA_BYTES: u32 = 4;

pub type Chave = [u8; TAMANHO_DA_CHAVE];
/// SHA-256 da chave: o que os limites guardam no lugar do segredo.
type ResumoDaChave = [u8; 32];

fn resumo_da_chave(chave: &Chave) -> ResumoDaChave {
    Sha256::digest(chave).into()
}

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
    /// O aparelho (`limit_key`) de onde a conexão veio; `None` = veio pelo
    /// túnel, onde a Cloudflare pode alternar IPv4 e IPv6.
    aparelho: Option<IpAddr>,
    /// Da liberação mais velha para a mais nova: o teto tira as da frente.
    liberadas: VecDeque<String>,
}

impl Conexao {
    fn liberado(&self, id: &str) -> bool {
        self.liberadas.iter().any(|liberado| liberado == id)
    }
}

/// Chaves, liberações e a pasta da aventura de UMA sala (`Room.sons`).
#[derive(Debug, Default)]
pub struct SonsDaSala {
    /// `<pasta canônica da aventura>/midia`; `None` = a rota só dá 404.
    raiz: Option<PathBuf>,
    /// Vez do último `net_sons_aventura`: só a conferência da vez mais nova muda
    /// a raiz (uma pasta de rede lenta não passa por cima da escolha seguinte).
    vez: u64,
    conexoes: HashMap<ClientId, Conexao>,
}

impl SonsDaSala {
    /// A conexão que acabou de entrar, com a chave que foi no primeiro frame.
    pub fn registrar(&mut self, cliente: ClientId, chave: Option<Chave>, aparelho: Option<IpAddr>) {
        self.conexoes.insert(cliente, Conexao { chave, aparelho, liberadas: VecDeque::new() });
    }

    /// Queda ou kick: a chave deixa de valer e as liberações somem. Devolve a
    /// chave que morreu, para cortar as buscas dela (`LimiteDasBuscas`).
    pub fn esquecer(&mut self, cliente: ClientId) -> Option<Chave> {
        self.conexoes.remove(&cliente).and_then(|conexao| conexao.chave)
    }

    /// Libera `ids` (já conferidos por `conferir_ids_para_liberar`) para
    /// `cliente`. O que já estava liberado vira o mais novo. Devolve só os que
    /// eram novos: `desfazer` se o envio falhar, `confirmar` se saiu.
    pub fn liberar(&mut self, cliente: ClientId, ids: &[String]) -> Result<Vec<String>, ErroDosSons> {
        let conexao = self.conexoes.get_mut(&cliente).ok_or(ErroDosSons::ClienteInvalido)?;
        let mut novos: Vec<String> = Vec::new();
        for id in ids {
            match conexao.liberadas.iter().position(|liberado| liberado == id) {
                Some(posicao) => {
                    if let Some(antigo) = conexao.liberadas.remove(posicao) {
                        conexao.liberadas.push_back(antigo);
                    }
                }
                None => {
                    conexao.liberadas.push_back(id.clone());
                    novos.push(id.clone());
                }
            }
        }
        Ok(novos)
    }

    /// O envio saiu: acima do teto, saem as liberações mais velhas. Fica para
    /// depois do envio para um envio que falha não apagar nada que já valia.
    pub fn confirmar(&mut self, cliente: ClientId) {
        if let Some(conexao) = self.conexoes.get_mut(&cliente) {
            while conexao.liberadas.len() > LIBERADAS_MAX_POR_CONEXAO {
                conexao.liberadas.pop_front();
            }
        }
    }

    /// Tira só o que `liberar` acabou de pôr: o que já estava liberado fica.
    pub fn desfazer(&mut self, cliente: ClientId, novos: &[String]) {
        if let Some(conexao) = self.conexoes.get_mut(&cliente) {
            conexao.liberadas.retain(|liberado| !novos.contains(liberado));
        }
    }

    pub fn esta_liberado(&self, cliente: ClientId, id: &str) -> bool {
        self.conexoes.get(&cliente).is_some_and(|conexao| conexao.liberado(id))
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

    /// Um `net_sons_aventura` começou: a vez dele, pega ANTES da conferência.
    pub fn nova_vez(&mut self) -> u64 {
        // u64 não chega a dar a volta; se desse, só uma vez velha casaria.
        self.vez = self.vez.wrapping_add(1);
        self.vez
    }

    /// `definir_raiz` só se `vez` ainda é a mais nova; devolve se aplicou.
    pub fn definir_raiz_na_vez(&mut self, vez: u64, raiz: Option<PathBuf>) -> bool {
        if vez != self.vez {
            return false;
        }
        self.definir_raiz(raiz);
        true
    }

    pub fn raiz(&self) -> Option<&Path> {
        self.raiz.as_deref()
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

    /// A pasta de onde ler `id` para quem mostrou `chave` do `aparelho`
    /// (`limit_key` do pedido); `None` = 404. Fora do túnel, a chave só vale no
    /// aparelho que abriu a conexão.
    pub fn autorizar(&self, chave: &Chave, id: &str, aparelho: IpAddr) -> Option<PathBuf> {
        let cliente = self.cliente_da_chave(chave)?;
        let conexao = self.conexoes.get(&cliente)?;
        if conexao.aparelho.is_some_and(|dono| dono != aparelho) || !conexao.liberado(id) {
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

/// Regra pura do caminho. `raiz` é a guardada (`<aventura canônica>/midia`),
/// `raiz_real` o `canonicalize` dela agora e `real` o do arquivo.
/// - O arquivo real tem de ser exatamente `<raiz_real>/<id>`: link no arquivo
///   leva o caminho real para outro lugar e não passa.
/// - A `raiz_real` tem de continuar na MESMA aventura: uma junção posta no
///   lugar da pasta da aventura depois do `net_sons_aventura` não passa.
///
/// Comparar com `raiz_real`, e não com `raiz`, aceita a `midia` gravada no
/// disco com outra caixa (`Midia`): o Windows a abre, então a rota também.
/// Junção na própria `midia` quem barra é a leitura (`symlink_metadata`); por
/// cima, a `raiz_real` tem de se chamar `midia` (sem diferenciar caixa): uma
/// junção trocada entre a olhada e o `canonicalize` não leva a pasta irmã.
pub fn caminho_real_confere(raiz: &Path, raiz_real: &Path, id: &str, real: &Path) -> bool {
    let chama_midia = raiz_real
        .file_name()
        .and_then(|nome| nome.to_str())
        .is_some_and(|nome| nome.eq_ignore_ascii_case(PASTA_DE_MIDIA));
    chama_midia && raiz_real.parent().is_some() && raiz_real.parent() == raiz.parent() && real == raiz_real.join(id)
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
    // A `midia` tem de ser pasta de verdade: `is_dir` do `symlink_metadata` é
    // falso para link e junção (não segue).
    let info_da_raiz = std::fs::symlink_metadata(raiz).map_err(|_| RecusaDoAudio::NaoEncontrado)?;
    if !info_da_raiz.is_dir() {
        return Err(RecusaDoAudio::ForaDaPasta);
    }
    let raiz_real = std::fs::canonicalize(raiz).map_err(|_| RecusaDoAudio::NaoEncontrado)?;
    let caminho = raiz.join(id);
    // `symlink_metadata` não segue: o próprio arquivo não pode ser link.
    let info = std::fs::symlink_metadata(&caminho).map_err(|_| RecusaDoAudio::NaoEncontrado)?;
    if !info.is_file() {
        return Err(RecusaDoAudio::NaoEncontrado);
    }
    let real = std::fs::canonicalize(&caminho).map_err(|_| RecusaDoAudio::NaoEncontrado)?;
    if !caminho_real_confere(raiz, &raiz_real, id, &real) {
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
    /// Buscas em andamento (no máximo `BUSCAS_MAX_NA_SALA`), pela vaga.
    em_voo: HashMap<u64, BuscaEmVoo>,
    proxima_vaga: u64,
}

#[derive(Debug)]
struct BuscaEmVoo {
    /// SHA-256 da chave COMO VEIO no cabeçalho (`None` = sem chave ou torta):
    /// decidido antes de olhar se a chave vale; o segredo não fica guardado.
    chave: Option<ResumoDaChave>,
    /// A conexão HTTP que leva o corpo: `cortar_da_chave` a derruba.
    corte: Arc<Corte>,
}

impl LimiteDasBuscas {
    /// Conta uma busca e devolve a vaga. `Err(espera)` = 429 com `Retry-After`.
    pub fn entrar(&mut self, ip: IpAddr, chave: Option<&Chave>, agora: Instant, corte: Arc<Corte>) -> Result<u64, Duration> {
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
        let resumo = chave.map(resumo_da_chave);
        let da_chave = self.em_voo.values().filter(|busca| busca.chave == resumo).count();
        if da_chave >= BUSCAS_MAX_POR_CHAVE || self.em_voo.len() >= BUSCAS_MAX_NA_SALA {
            return Err(ESPERA_DAS_SIMULTANEAS);
        }
        vezes.push_back(agora);
        let vaga = self.proxima_vaga;
        // u64 não chega a dar a volta; se desse, as vagas em voo (no máximo 6)
        // já teriam saído muito antes.
        self.proxima_vaga = self.proxima_vaga.wrapping_add(1);
        self.em_voo.insert(vaga, BuscaEmVoo { chave: resumo, corte });
        Ok(vaga)
    }

    /// A busca terminou (corpo enviado, cliente saiu, conexão cortada).
    pub fn sair(&mut self, vaga: u64) {
        self.em_voo.remove(&vaga);
    }

    /// Queda ou kick do dono de `chave`: derruba as conexões que levam corpo
    /// para ela. A vaga volta quando o corpo cai, junto com a memória dele (só
    /// zerar a conta deixaria os 15 MB presos e a sala sem teto de memória).
    pub fn cortar_da_chave(&self, chave: &Chave) -> usize {
        let resumo = Some(resumo_da_chave(chave));
        let mut cortadas = 0;
        for busca in self.em_voo.values().filter(|busca| busca.chave == resumo) {
            busca.corte.cortar();
            cortadas += 1;
        }
        cortadas
    }

    pub fn em_voo_na_sala(&self) -> usize {
        self.em_voo.len()
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
    vaga: u64,
    corte: Arc<Corte>,
}

impl VagaDeBusca {
    /// `corte` é o da conexão HTTP que pediu (`ConexaoHttp`).
    pub fn pedir(
        limite: &Arc<Mutex<LimiteDasBuscas>>,
        ip: IpAddr,
        chave: Option<&Chave>,
        agora: Instant,
        corte: Arc<Corte>,
    ) -> Result<Self, Duration> {
        let vaga = lock(limite).entrar(ip, chave, agora, corte.clone())?;
        Ok(Self { limite: limite.clone(), vaga, corte })
    }
}

impl Drop for VagaDeBusca {
    fn drop(&mut self) {
        lock(&self.limite).sair(self.vaga);
    }
}

/// O corpo da resposta 200: os pedaços já conferidos, soltos um a um enquanto
/// saem, e a vaga presa até o último. Passado `PRAZO_TOTAL_DO_CORPO`, o fluxo dá
/// erro (a conexão cai) e o socket da conexão também recusa a escrita seguinte:
/// o prazo vale até quando o hyper, com o buffer cheio, não pede pedaço novo.
/// Soltar o corpo NÃO tira o prazo do socket: o hyper ainda guarda até ~400 KB
/// para escrever. Quem tira é o socket, quando escoa (`Corte::escoou`).
pub struct CorpoDoSom {
    pedacos: VecDeque<Bytes>,
    vence_em: Instant,
    /// Só existe para ser solta junto com o corpo (devolve a vaga).
    _vaga: VagaDeBusca,
}

impl CorpoDoSom {
    pub fn novo(pedacos: VecDeque<Bytes>, vaga: VagaDeBusca, prazo: Duration) -> Self {
        let agora = Instant::now();
        // Prazo que não cabe no relógio vence já: o lado seguro.
        let vence_em = agora.checked_add(prazo).unwrap_or(agora);
        vaga.corte.definir_prazo(Some(vence_em));
        Self { pedacos, vence_em, _vaga: vaga }
    }
}

impl futures_core::Stream for CorpoDoSom {
    type Item = Result<Bytes, io::Error>;

    fn poll_next(self: Pin<&mut Self>, _cx: &mut Context<'_>) -> Poll<Option<Self::Item>> {
        let corpo = self.get_mut();
        if Instant::now() >= corpo.vence_em {
            corpo.pedacos.clear();
            return Poll::Ready(Some(Err(io::Error::new(io::ErrorKind::TimedOut, "prazo total do som"))));
        }
        Poll::Ready(corpo.pedacos.pop_front().map(Ok))
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

    fn corte() -> Arc<Corte> {
        Arc::new(Corte::default())
    }

    const APARELHO: IpAddr = IpAddr::V4(std::net::Ipv4Addr::new(192, 168, 0, 10));

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
            sons.registrar(cliente, Some(chave(byte)), None);
        }
        sons.registrar(4, None, None);
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
        sons.registrar(1, Some(chave(1)), None);
        assert_eq!(sons.liberar(1, &[a.clone(), a.clone()]), Ok(vec![a.clone()]));
        // `a` já estava: só `b` é novo, e desfazer não tira o `a`.
        let novos = sons.liberar(1, &[a.clone(), b.clone()]);
        assert_eq!(novos, Ok(vec![b.clone()]));
        sons.desfazer(1, std::slice::from_ref(&b));
        assert!(sons.esta_liberado(1, &a));
        assert!(!sons.esta_liberado(1, &b));
        assert!(!sons.esta_liberado(2, &a));
        assert_eq!(sons.esquecer(1), Some(chave(1)), "esquecer devolve a chave que morreu");
        assert!(!sons.esta_liberado(1, &a));
        assert_eq!(sons.cliente_da_chave(&chave(1)), None);
        assert_eq!(sons.esquecer(1), None);
    }

    /// No teto, sai a liberação mais velha e o envio nunca é recusado; a que
    /// foi liberada de novo vira a mais nova. Mutação vermelha: voltar a recusar.
    #[test]
    fn teto_de_liberadas_tira_a_mais_velha() {
        let mut sons = SonsDaSala::default();
        sons.registrar(1, Some(chave(1)), None);
        let ids: Vec<String> = (0..LIBERADAS_MAX_POR_CONEXAO).map(|n| id_de_audio(&n.to_be_bytes(), "wav")).collect();
        for lote in ids.chunks(LIBERAR_MAX_POR_ENVIO) {
            assert!(sons.liberar(1, lote).is_ok());
            sons.confirmar(1);
        }
        // A primeira volta a tocar: vira a mais nova e não sai no despejo.
        assert_eq!(sons.liberar(1, &ids[..1]), Ok(Vec::new()));
        sons.confirmar(1);
        let mais_dois = [id_de_audio(b"mais um", "wav"), id_de_audio(b"mais dois", "wav")];
        assert_eq!(sons.liberar(1, &mais_dois), Ok(mais_dois.to_vec()));
        sons.confirmar(1);
        assert!(mais_dois.iter().all(|id| sons.esta_liberado(1, id)));
        assert!(sons.esta_liberado(1, &ids[0]), "a liberada de novo saiu");
        assert!(!sons.esta_liberado(1, &ids[1]) && !sons.esta_liberado(1, &ids[2]), "as mais velhas ficaram");
        assert!(sons.esta_liberado(1, &ids[3]));
        assert_eq!(sons.conexoes.get(&1).map(|conexao| conexao.liberadas.len()), Some(LIBERADAS_MAX_POR_CONEXAO));
    }

    /// Envio que falha no teto não despeja nada: `desfazer` antes de `confirmar`.
    #[test]
    fn envio_que_falha_no_teto_nao_despeja_nada() {
        let mut sons = SonsDaSala::default();
        sons.registrar(1, Some(chave(1)), None);
        let ids: Vec<String> = (0..LIBERADAS_MAX_POR_CONEXAO).map(|n| id_de_audio(&n.to_be_bytes(), "ogg")).collect();
        for lote in ids.chunks(LIBERAR_MAX_POR_ENVIO) {
            assert!(sons.liberar(1, lote).is_ok());
            sons.confirmar(1);
        }
        let novo = id_de_audio(b"novo", "ogg");
        let novos = sons.liberar(1, std::slice::from_ref(&novo));
        assert_eq!(novos, Ok(vec![novo.clone()]));
        sons.desfazer(1, std::slice::from_ref(&novo));
        assert!(ids.iter().all(|id| sons.esta_liberado(1, id)));
        assert!(!sons.esta_liberado(1, &novo));
    }

    #[test]
    fn trocar_a_raiz_zera_as_liberacoes_e_a_mesma_nao() {
        let a = id_de_audio(b"a", "mp3");
        let mut sons = SonsDaSala::default();
        sons.registrar(1, Some(chave(1)), None);
        sons.definir_raiz(Some(PathBuf::from("/aventura-1/midia")));
        assert!(sons.liberar(1, std::slice::from_ref(&a)).is_ok());
        sons.definir_raiz(Some(PathBuf::from("/aventura-1/midia")));
        assert_eq!(sons.autorizar(&chave(1), &a, APARELHO), Some(PathBuf::from("/aventura-1/midia")));
        sons.definir_raiz(Some(PathBuf::from("/aventura-2/midia")));
        assert_eq!(sons.autorizar(&chave(1), &a, APARELHO), None);
        assert!(sons.liberar(1, std::slice::from_ref(&a)).is_ok());
        sons.definir_raiz(None);
        assert_eq!(sons.autorizar(&chave(1), &a, APARELHO), None);
    }

    /// A vez velha (pasta de rede lenta) não passa por cima da escolha nova,
    /// nem de um `None`. Mutação vermelha: aplicar sem olhar a vez.
    #[test]
    fn vez_velha_nao_muda_a_raiz() {
        let mut sons = SonsDaSala::default();
        let lenta = sons.nova_vez();
        let rapida = sons.nova_vez();
        assert!(sons.definir_raiz_na_vez(rapida, Some(PathBuf::from("/nova/midia"))));
        assert!(!sons.definir_raiz_na_vez(lenta, Some(PathBuf::from("/velha/midia"))));
        assert_eq!(sons.raiz(), Some(Path::new("/nova/midia")));
        let outra_lenta = sons.nova_vez();
        let nenhuma = sons.nova_vez();
        assert!(sons.definir_raiz_na_vez(nenhuma, None));
        assert!(!sons.definir_raiz_na_vez(outra_lenta, Some(PathBuf::from("/velha/midia"))));
        assert_eq!(sons.raiz(), None);
    }

    /// Fora do túnel, a chave só vale no aparelho (`limit_key`) que abriu a
    /// conexão; pelo túnel não há amarra. Mutação vermelha: não olhar o aparelho.
    #[test]
    fn chave_so_vale_no_aparelho_que_abriu_fora_do_tunel() {
        let a = id_de_audio(b"a", "mp3");
        let outro = IpAddr::V4(std::net::Ipv4Addr::new(192, 168, 0, 11));
        let mut sons = SonsDaSala::default();
        sons.definir_raiz(Some(PathBuf::from("/aventura/midia")));
        sons.registrar(1, Some(chave(1)), Some(APARELHO));
        sons.registrar(2, Some(chave(2)), None);
        for cliente in [1, 2] {
            assert!(sons.liberar(cliente, std::slice::from_ref(&a)).is_ok());
        }
        assert_eq!(sons.autorizar(&chave(1), &a, APARELHO), Some(PathBuf::from("/aventura/midia")));
        assert_eq!(sons.autorizar(&chave(1), &a, outro), None);
        assert_eq!(sons.autorizar(&chave(2), &a, APARELHO), Some(PathBuf::from("/aventura/midia")));
        assert_eq!(sons.autorizar(&chave(2), &a, outro), Some(PathBuf::from("/aventura/midia")));
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
        assert!(caminho_real_confere(raiz, raiz, &id, &raiz.join(&id)));
        for real in [
            PathBuf::from("/outra/midia").join(&id),
            raiz.join("sub").join(&id),
            PathBuf::from("/aventura").join(&id),
            raiz.join(id_de_audio(b"b", "mp3")),
        ] {
            assert!(!caminho_real_confere(raiz, raiz, &id, &real), "{real:?}");
        }
        // A `midia` com outra caixa no disco: vale a grafia do disco.
        let do_disco = Path::new("/aventura/Midia");
        assert!(caminho_real_confere(raiz, do_disco, &id, &do_disco.join(&id)));
        assert!(!caminho_real_confere(raiz, do_disco, &id, &raiz.join(&id)));
        // A raiz real fora da aventura (junção no lugar da pasta da aventura).
        let fora = Path::new("/outra/midia");
        assert!(!caminho_real_confere(raiz, fora, &id, &fora.join(&id)));
        assert!(!caminho_real_confere(Path::new("/"), Path::new("/"), &id, &Path::new("/").join(&id)));
        // Junção na `midia` levando à pasta IRMÃ (mesmo pai) não passa; a
        // `MIDIA` em outra caixa, sim (auditoria, achado 4). Mutação
        // vermelha: sem conferir o nome da raiz real.
        let irma = Path::new("/aventura/outra");
        assert!(!caminho_real_confere(raiz, irma, &id, &irma.join(&id)));
        let caixa_alta = Path::new("/aventura/MIDIA");
        assert!(caminho_real_confere(raiz, caixa_alta, &id, &caixa_alta.join(&id)));
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

    /// Junção do Windows (`mklink /J`, sem privilégio).
    #[cfg(windows)]
    fn juncao(link: &Path, alvo: &Path) -> Result<(), std::io::Error> {
        let saida = std::process::Command::new("cmd").args(["/C", "mklink", "/J"]).arg(link).arg(alvo).output()?;
        if saida.status.success() {
            Ok(())
        } else {
            Err(std::io::Error::other("mklink /J falhou"))
        }
    }

    /// Aventura com a pasta `Midia` (outra caixa) e um áudio dentro.
    #[cfg(windows)]
    fn aventura_com_midia_maiuscula(nome: &str) -> Result<(PathBuf, PathBuf, String), std::io::Error> {
        let pasta = std::env::temp_dir().join(format!("labirinto-sons-{nome}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&pasta);
        std::fs::create_dir_all(pasta.join("Midia"))?;
        std::fs::write(pasta.join(ARQUIVO_DA_AVENTURA), b"{}")?;
        let ogg = b"OggS\x00\x02\x00\x00\x00\x00".to_vec();
        let id = id_de_audio(&ogg, "ogg");
        std::fs::write(pasta.join("Midia").join(&id), &ogg)?;
        let raiz = raiz_da_aventura(&pasta).map_err(|e| std::io::Error::other(e.texto()))?;
        Ok((pasta, raiz, id))
    }

    /// `Midia` no disco e `midia` na raiz guardada: o Windows abre, a rota
    /// também. Mutação vermelha: comparar com `raiz.join(id)`.
    #[cfg(windows)]
    #[test]
    fn midia_com_outra_caixa_serve_no_windows() -> Result<(), std::io::Error> {
        let (pasta, raiz, id) = aventura_com_midia_maiuscula("caixa")?;
        assert!(raiz.ends_with(PASTA_DE_MIDIA));
        let lido = ler_audio_conferido(&raiz, &id).map(|audio| audio.tipo);
        assert_eq!(lido, Ok(TipoDeMidia::Ogg));
        std::fs::remove_dir_all(&pasta)
    }

    /// A `midia` vira junção para outra pasta DENTRO da aventura: a pasta e o
    /// arquivo reais casam, só o `is_dir` da raiz barra. Mutação vermelha:
    /// tirar o `symlink_metadata(raiz)`.
    #[cfg(windows)]
    #[test]
    fn juncao_na_midia_nao_sai_nem_para_dentro_da_aventura() -> Result<(), std::io::Error> {
        let (pasta, raiz, id) = aventura_com_midia_maiuscula("juncao-midia")?;
        let segredos = pasta.join("segredos");
        std::fs::rename(pasta.join("Midia"), &segredos)?;
        juncao(&pasta.join(PASTA_DE_MIDIA), &segredos)?;
        let lido = ler_audio_conferido(&raiz, &id).err();
        std::fs::remove_dir(pasta.join(PASTA_DE_MIDIA))?;
        std::fs::remove_dir_all(&pasta)?;
        assert_eq!(lido, Some(RecusaDoAudio::ForaDaPasta));
        Ok(())
    }

    /// A pasta da aventura trocada por uma junção DEPOIS do `net_sons_aventura`:
    /// a `midia` do outro lado é pasta de verdade, mas está em outra aventura.
    /// Mutação vermelha: tirar a conferência do `parent`.
    #[cfg(windows)]
    #[test]
    fn aventura_trocada_por_juncao_depois_de_aberta_nao_sai() -> Result<(), std::io::Error> {
        let (pasta, raiz, id) = aventura_com_midia_maiuscula("troca-juncao")?;
        let (outra, _, _) = aventura_com_midia_maiuscula("troca-juncao-alvo")?;
        let guardada = pasta.with_file_name(format!("labirinto-sons-troca-juncao-velha-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&guardada);
        std::fs::rename(&pasta, &guardada)?;
        juncao(&pasta, &outra)?;
        let lido = ler_audio_conferido(&raiz, &id).err();
        std::fs::remove_dir(&pasta)?;
        std::fs::remove_dir_all(&guardada)?;
        std::fs::remove_dir_all(&outra)?;
        assert_eq!(lido, Some(RecusaDoAudio::ForaDaPasta));
        Ok(())
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
            let vaga = limite.entrar(ip, None, vez, corte());
            assert!(vaga.is_ok(), "busca {n}");
            limite.sair(vaga.unwrap_or_default());
        }
        let t3 = agora_mais(t0, 3_000);
        assert_eq!(limite.entrar(ip, None, t3, corte()), Err(Duration::from_secs(7)));
        let vaga = limite.entrar(outro, None, t3, corte());
        assert!(vaga.is_ok());
        limite.sair(vaga.unwrap_or_default());
        // A primeira sai da janela em 10 s: abre UMA vaga.
        let t10 = agora_mais(t0, 10_000);
        let vaga = limite.entrar(ip, None, t10, corte());
        assert!(vaga.is_ok());
        limite.sair(vaga.unwrap_or_default());
        assert!(limite.entrar(ip, None, t10, corte()).is_err());
    }

    #[test]
    fn simultaneas_duas_por_chave_e_seis_na_sala() {
        let t0 = Instant::now();
        let mut limite = LimiteDasBuscas::default();
        let ip = |n: u8| IpAddr::from([10, 0, 1, n]);
        let primeira = limite.entrar(ip(1), Some(&chave(1)), t0, corte());
        assert!(primeira.is_ok());
        assert!(limite.entrar(ip(1), Some(&chave(1)), t0, corte()).is_ok());
        assert_eq!(limite.entrar(ip(1), Some(&chave(1)), t0, corte()), Err(ESPERA_DAS_SIMULTANEAS));
        for n in 2..=5 {
            assert!(limite.entrar(ip(n), Some(&chave(n)), t0, corte()).is_ok());
        }
        assert_eq!(limite.em_voo_na_sala(), BUSCAS_MAX_NA_SALA);
        assert_eq!(limite.entrar(ip(9), Some(&chave(9)), t0, corte()), Err(ESPERA_DAS_SIMULTANEAS));
        limite.sair(primeira.unwrap_or_default());
        assert!(limite.entrar(ip(9), Some(&chave(9)), t0, corte()).is_ok());
        assert_eq!(limite.entrar(ip(1), Some(&chave(1)), t0, corte()), Err(ESPERA_DAS_SIMULTANEAS), "a sala está cheia de novo");
    }

    /// Os limites guardam o SHA-256 da chave, nunca o segredo. Mutação
    /// vermelha: guardar a chave como veio.
    #[test]
    fn limite_guarda_o_resumo_e_nao_a_chave() {
        let mut limite = LimiteDasBuscas::default();
        assert!(limite.entrar(IpAddr::from([10, 0, 3, 1]), Some(&chave(1)), Instant::now(), corte()).is_ok());
        assert!(limite.entrar(IpAddr::from([10, 0, 3, 1]), None, Instant::now(), corte()).is_ok());
        let guardadas: Vec<Option<ResumoDaChave>> = limite.em_voo.values().map(|busca| busca.chave).collect();
        assert!(guardadas.contains(&Some(resumo_da_chave(&chave(1)))));
        assert!(guardadas.contains(&None));
        assert!(!guardadas.contains(&Some(chave(1))), "a chave ficou guardada como veio");
    }

    /// Queda ou kick: as conexões que levam corpo para a chave caem; as de
    /// outras chaves, não. A vaga só volta quando o corpo cai (memória junto).
    #[test]
    fn cortar_da_chave_derruba_so_as_buscas_dela() {
        let limite = Arc::new(Mutex::new(LimiteDasBuscas::default()));
        let ip = IpAddr::from([10, 0, 4, 1]);
        let (da_ana, outra_da_ana, do_bruno) = (corte(), corte(), corte());
        let vagas = [
            VagaDeBusca::pedir(&limite, ip, Some(&chave(1)), Instant::now(), da_ana.clone()),
            VagaDeBusca::pedir(&limite, ip, Some(&chave(1)), Instant::now(), outra_da_ana.clone()),
            VagaDeBusca::pedir(&limite, ip, Some(&chave(2)), Instant::now(), do_bruno.clone()),
        ];
        assert!(vagas.iter().all(Result::is_ok));
        assert_eq!(lock(&limite).cortar_da_chave(&chave(1)), 2);
        assert!(da_ana.cortada() && outra_da_ana.cortada());
        assert!(!do_bruno.cortada());
        assert_eq!(lock(&limite).em_voo_na_sala(), 3, "a vaga volta no drop do corpo, não no corte");
        drop(vagas);
        assert_eq!(lock(&limite).em_voo_na_sala(), 0);
    }

    #[test]
    fn tabela_de_ips_tem_teto_e_se_limpa_com_o_tempo() {
        let t0 = Instant::now();
        let mut limite = LimiteDasBuscas::default();
        for n in 0..IPS_RASTREADOS_MAX {
            let ip = IpAddr::from(u32::try_from(n).unwrap_or(0).to_be_bytes());
            let vaga = limite.entrar(ip, None, t0, corte());
            assert!(vaga.is_ok());
            limite.sair(vaga.unwrap_or_default());
        }
        let novo = IpAddr::from([203, 0, 113, 1]);
        assert_eq!(limite.entrar(novo, None, t0, corte()), Err(JANELA_DAS_BUSCAS));
        assert_eq!(limite.ips_rastreados(), IPS_RASTREADOS_MAX);
        let depois = agora_mais(t0, 10_000);
        assert!(limite.entrar(novo, None, depois, corte()).is_ok());
        assert_eq!(limite.ips_rastreados(), 1);
    }

    fn vaga_de_teste(limite: &Arc<Mutex<LimiteDasBuscas>>, corte: Arc<Corte>) -> VagaDeBusca {
        let vaga = VagaDeBusca::pedir(limite, IpAddr::from([10, 0, 2, 1]), Some(&chave(1)), Instant::now(), corte);
        let Ok(vaga) = vaga else {
            panic!("a primeira busca tem vaga");
        };
        vaga
    }

    #[test]
    fn vaga_volta_quando_o_corpo_e_solto() {
        let limite = Arc::new(Mutex::new(LimiteDasBuscas::default()));
        let corpo = CorpoDoSom::novo(VecDeque::from([Bytes::from_static(b"a")]), vaga_de_teste(&limite, corte()), PRAZO_TOTAL_DO_CORPO);
        assert_eq!(lock(&limite).em_voo_na_sala(), 1);
        drop(corpo);
        assert_eq!(lock(&limite).em_voo_na_sala(), 0);
    }

    fn proximo(corpo: &mut CorpoDoSom) -> Option<Result<Bytes, io::ErrorKind>> {
        let mut cx = Context::from_waker(std::task::Waker::noop());
        match futures_core::Stream::poll_next(Pin::new(corpo), &mut cx) {
            Poll::Ready(item) => item.map(|pedaco| pedaco.map_err(|erro| erro.kind())),
            Poll::Pending => panic!("o corpo do som nunca fica pendente"),
        }
    }

    /// Prazo total: o fluxo dá erro, solta os pedaços, e o socket da conexão
    /// fica sabendo (vale até quando o hyper não pede pedaço). Mutações
    /// vermelhas: não olhar o prazo no fluxo; não marcar o prazo no corte.
    #[test]
    fn corpo_vencido_da_erro_e_marca_o_socket() {
        let limite = Arc::new(Mutex::new(LimiteDasBuscas::default()));
        let pedacos = || VecDeque::from([Bytes::from_static(b"um"), Bytes::from_static(b"dois")]);

        let folgado = corte();
        let mut corpo = CorpoDoSom::novo(pedacos(), vaga_de_teste(&limite, folgado.clone()), PRAZO_TOTAL_DO_CORPO);
        assert!(folgado.erro().is_none());
        assert_eq!(proximo(&mut corpo), Some(Ok(Bytes::from_static(b"um"))));
        drop(corpo);

        let vencido = corte();
        let mut corpo = CorpoDoSom::novo(pedacos(), vaga_de_teste(&limite, vencido.clone()), Duration::ZERO);
        assert_eq!(vencido.erro().map(|erro| erro.kind()), Some(io::ErrorKind::TimedOut));
        assert_eq!(proximo(&mut corpo), Some(Err(io::ErrorKind::TimedOut)));
        assert!(corpo.pedacos.is_empty(), "os pedaços ficaram presos");
        drop(corpo);
        assert_eq!(lock(&limite).em_voo_na_sala(), 0);
        // Solto o corpo, o prazo FICA no socket até ele escoar (auditoria,
        // achado 1). Mutação vermelha: o `drop` do corpo tirar o prazo.
        assert_eq!(vencido.erro().map(|erro| erro.kind()), Some(io::ErrorKind::TimedOut), "o corpo solto tirou o prazo do socket");
    }
}
