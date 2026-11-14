//! MÍDIA DA MESA (entrega 4 dos sistemas de RPG): os arquivos que o jogador
//! carrega por URL em vez de recebê-los embutidos em cada mensagem — a imagem
//! do item do acervo, o retrato da ficha de personagem e a música importada do
//! minigame de dança (mp3, ogg, wav, m4a).
//!
//! O mestre (TS, `client/src/lib/midia.ts`) grava cada arquivo UMA vez em
//! `<appData>/midia/<sha256>.<ext>`: o nome é o hash do conteúdo. A rota
//! `/media/{id}` só serve arquivo dessa pasta, e só com nome nessa forma exata.
//!
//! Por que o hash basta para o jogador só ver o que lhe mostraram: o id tem 256
//! bits e sai do CONTEÚDO, então não dá para adivinhar o de uma mídia que o
//! mestre nunca mandou a ninguém (o item guardado no acervo, o retrato da ficha
//! de outro jogador). Quem tem o id é quem recebeu a referência numa mensagem
//! do host — e quem já recebeu a referência já podia ver a imagem ou ouvir a
//! música.
//!
//! Defesa em camadas, todas aqui e testadas:
//!  - id estrito (`tipo_do_id`): 64 hex minúsculos + extensão da lista; nada de
//!    barra, ponto a mais, `..` ou caminho — não existe traversal possível;
//!  - o arquivo é lido só se for arquivo comum e couber no teto DO TIPO
//!    (`TipoDeMidia::teto`): imagem em `MIDIA_MAX_BYTES`, áudio em
//!    `MIDIA_AUDIO_MAX_BYTES` — um `.png` de 15 MB continua barrado;
//!  - os bytes precisam ser do tipo da extensão (assinatura) e ter o hash do
//!    nome: arquivo posto à mão na pasta com nome bonito não sai, e imagem com
//!    nome de áudio (ou o contrário) também não.
//!
//! VÍDEO DA CUTSCENE (14/11/2026): mp4/webm até 500 MB, com tipo próprio
//! (`TipoDeVideo`) para nunca cair em `ler_midia`, que lê o arquivo inteiro na
//! memória. Entra por `importar_video` (cópia em pedaços, com o hash calculado
//! no caminho) e sai por `/media/{id}` em fluxo, com `Range` (`server.rs`). A
//! conferência do hash também é em pedaços (`conferir_video`).

use std::io::{Read, Write};
use std::path::{Path, PathBuf};

use sha2::{Digest, Sha256};

/// Nome da pasta dentro do `app_data_dir` (o mesmo `appDataDir()` do TS).
pub const PASTA_DE_MIDIA: &str = "midia";
/// Teto de uma imagem servida. As do app saem reduzidas (640 px WebP, ~50 KB);
/// o teto só barra o arquivo estranho.
pub const MIDIA_MAX_BYTES: u64 = 2 * 1024 * 1024;
/// Teto de um áudio servido (a música importada do minigame). Uma faixa de 3-4
/// minutos em mp3 de 192 kbps tem ~5-6 MB; 15 MB cobre 320 kbps e m4a sem
/// virar porta para o arquivo gigante. Teto próprio para não afrouxar o da
/// imagem.
pub const MIDIA_AUDIO_MAX_BYTES: u64 = 15 * 1024 * 1024;
/// Hex do SHA-256.
const TAMANHO_DO_HASH: usize = 64;

/// Os formatos que a mesa aceita: as imagens da foto do token (`tokenPhoto.ts`)
/// e os áudios da música importada.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TipoDeMidia {
    Webp,
    Png,
    Jpeg,
    Gif,
    Mp3,
    Ogg,
    Wav,
    M4a,
}

impl TipoDeMidia {
    pub fn mime(self) -> &'static str {
        match self {
            Self::Webp => "image/webp",
            Self::Png => "image/png",
            Self::Jpeg => "image/jpeg",
            Self::Gif => "image/gif",
            Self::Mp3 => "audio/mpeg",
            Self::Ogg => "audio/ogg",
            Self::Wav => "audio/wav",
            Self::M4a => "audio/mp4",
        }
    }

    /// Quantos bytes um arquivo deste tipo pode ter para sair pela sala.
    pub fn teto(self) -> u64 {
        if self.eh_audio() {
            MIDIA_AUDIO_MAX_BYTES
        } else {
            MIDIA_MAX_BYTES
        }
    }

    pub fn eh_audio(self) -> bool {
        matches!(self, Self::Mp3 | Self::Ogg | Self::Wav | Self::M4a)
    }

    fn pela_extensao(extensao: &str) -> Option<Self> {
        match extensao {
            "webp" => Some(Self::Webp),
            "png" => Some(Self::Png),
            "jpg" => Some(Self::Jpeg),
            "gif" => Some(Self::Gif),
            "mp3" => Some(Self::Mp3),
            "ogg" => Some(Self::Ogg),
            "wav" => Some(Self::Wav),
            "m4a" => Some(Self::M4a),
            _ => None,
        }
    }
}

/// Teto de um vídeo da mesa (a cutscene): o mestre decidiu "sem comprimir,
/// até 500 MB" (14/11/2026). O TS usa o mesmo número (`VIDEO_MAX_BYTES`).
pub const MIDIA_VIDEO_MAX_BYTES: u64 = 500 * 1024 * 1024;
/// Pedaço da cópia e da conferência do vídeo: a memória fica nisso, nunca no
/// tamanho do arquivo.
const PEDACO_DO_VIDEO: usize = 1024 * 1024;
/// Até onde procurar o `DocType` do WebM no cabeçalho EBML.
const CABECALHO_DO_WEBM: usize = 64;

/// Os vídeos da cutscene. Tipo separado de `TipoDeMidia` de propósito: o teto
/// de 500 MB nunca vale para quem lê o arquivo inteiro na memória.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TipoDeVideo {
    Mp4,
    Webm,
}

impl TipoDeVideo {
    pub fn mime(self) -> &'static str {
        match self {
            Self::Mp4 => "video/mp4",
            Self::Webm => "video/webm",
        }
    }

    pub fn extensao(self) -> &'static str {
        match self {
            Self::Mp4 => "mp4",
            Self::Webm => "webm",
        }
    }

    fn pela_extensao(extensao: &str) -> Option<Self> {
        match extensao {
            "mp4" => Some(Self::Mp4),
            "webm" => Some(Self::Webm),
            _ => None,
        }
    }

    /// O tipo pela assinatura. MP4: a primeira caixa é `ftyp` (a mesma família
    /// do m4a; aqui só se pergunta "é vídeo mp4?", então basta). WebM: o
    /// cabeçalho EBML com o `DocType` "webm" (um `.mkv` qualquer não passa).
    pub fn dos_bytes(bytes: &[u8]) -> Option<Self> {
        if bytes.get(4..8) == Some(b"ftyp".as_slice()) {
            return Some(Self::Mp4);
        }
        let cabeca = bytes.get(..CABECALHO_DO_WEBM.min(bytes.len())).unwrap_or_default();
        if cabeca.starts_with(b"\x1A\x45\xDF\xA3") && cabeca.windows(4).any(|janela| janela == b"webm") {
            return Some(Self::Webm);
        }
        None
    }
}

/// Por que a mídia não saiu. A rota responde 404 para todos: dizer qual
/// ensinaria a quem tenta quais ids existem.
#[derive(Debug, PartialEq, Eq)]
pub enum ErroDeMidia {
    IdInvalido,
    NaoEncontrada,
    GrandeDemais,
    ConteudoNaoConfere,
}

/// O tipo de um id válido (`<64 hex minúsculos>.<webp|png|jpg|gif|mp3|ogg|wav|m4a>`);
/// qualquer outra forma é `None`.
pub fn tipo_do_id(id: &str) -> Option<TipoDeMidia> {
    let (hash, extensao) = id.split_once('.')?;
    if !hash_bem_formado(hash) {
        return None;
    }
    TipoDeMidia::pela_extensao(extensao)
}

/// O tipo de um id de vídeo válido (`<64 hex minúsculos>.<mp4|webm>`); a mesma
/// forma estrita do `tipo_do_id`.
pub fn tipo_do_video(id: &str) -> Option<TipoDeVideo> {
    let (hash, extensao) = id.split_once('.')?;
    if !hash_bem_formado(hash) {
        return None;
    }
    TipoDeVideo::pela_extensao(extensao)
}

fn hash_bem_formado(hash: &str) -> bool {
    hash.len() == TAMANHO_DO_HASH && hash.bytes().all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
}

/// O tipo pela assinatura dos bytes (o começo do arquivo), não pelo nome.
pub fn tipo_dos_bytes(bytes: &[u8]) -> Option<TipoDeMidia> {
    if bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
        return Some(TipoDeMidia::Png);
    }
    // Antes da sincronia do MPEG: `FF D8` também começa com `FF`, mas `D8` não
    // tem os 3 bits altos ligados — a ordem só deixa a regra explícita.
    if bytes.starts_with(b"\xFF\xD8\xFF") {
        return Some(TipoDeMidia::Jpeg);
    }
    if bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a") {
        return Some(TipoDeMidia::Gif);
    }
    let riff = bytes.get(..4) == Some(b"RIFF".as_slice());
    if riff && bytes.get(8..12) == Some(b"WEBP".as_slice()) {
        return Some(TipoDeMidia::Webp);
    }
    if riff && bytes.get(8..12) == Some(b"WAVE".as_slice()) {
        return Some(TipoDeMidia::Wav);
    }
    if bytes.starts_with(b"OggS") {
        return Some(TipoDeMidia::Ogg);
    }
    // MP4 (m4a): a primeira caixa é `ftyp`, com o tamanho dela nos 4 bytes antes.
    if bytes.get(4..8) == Some(b"ftyp".as_slice()) {
        return Some(TipoDeMidia::M4a);
    }
    if eh_inicio_de_mp3(bytes) {
        return Some(TipoDeMidia::Mp3);
    }
    None
}

/// MP3 com etiqueta ID3 na frente, ou que começa direto num quadro MPEG: 11
/// bits de sincronia ligados (`FF` e os 3 bits altos do byte seguinte).
fn eh_inicio_de_mp3(bytes: &[u8]) -> bool {
    const BITS_ALTOS_DA_SINCRONIA: u8 = 0b1110_0000;
    bytes.starts_with(b"ID3") || matches!(bytes, [0xFF, segundo, ..] if segundo & BITS_ALTOS_DA_SINCRONIA == BITS_ALTOS_DA_SINCRONIA)
}

/// O hash em hex minúsculo, como o TS o calcula (`crypto.subtle.digest`).
pub fn hash_hex(bytes: &[u8]) -> String {
    Sha256::digest(bytes).iter().map(|byte| format!("{byte:02x}")).collect()
}

/// Os bytes da mídia `id` na `pasta`, já conferidos (tamanho, tipo e hash).
pub async fn ler_midia(pasta: &Path, id: &str) -> Result<(Vec<u8>, TipoDeMidia), ErroDeMidia> {
    let tipo = tipo_do_id(id).ok_or(ErroDeMidia::IdInvalido)?;
    let caminho = pasta.join(id);
    let info = tokio::fs::metadata(&caminho).await.map_err(|_| ErroDeMidia::NaoEncontrada)?;
    if !info.is_file() {
        return Err(ErroDeMidia::NaoEncontrada);
    }
    // O teto vem da EXTENSÃO, já validada: nome de áudio não abre 15 MB para
    // bytes de imagem, porque a assinatura é conferida logo abaixo.
    let teto = tipo.teto();
    if info.len() > teto {
        return Err(ErroDeMidia::GrandeDemais);
    }
    let bytes = tokio::fs::read(&caminho).await.map_err(|_| ErroDeMidia::NaoEncontrada)?;
    // O arquivo pode ter crescido entre o `metadata` e o `read`.
    if u64::try_from(bytes.len()).unwrap_or(u64::MAX) > teto {
        return Err(ErroDeMidia::GrandeDemais);
    }
    let hash_ok = id.split_once('.').is_some_and(|(hash, _)| hash == hash_hex(&bytes));
    if tipo_dos_bytes(&bytes) != Some(tipo) || !hash_ok {
        return Err(ErroDeMidia::ConteudoNaoConfere);
    }
    Ok((bytes, tipo))
}

/// O que sai de uma leitura em pedaços: quantos bytes, o hash e o começo do
/// arquivo (para a assinatura).
struct Lido {
    tamanho: u64,
    hash: String,
    cabeca: Vec<u8>,
}

/// Lê `leitor` até o fim em pedaços de 1 MiB, calculando o SHA-256 no caminho
/// e passando cada pedaço a `gravar`. Um byte além de `teto` (o arquivo cresceu
/// depois do `metadata`) para a leitura: `Ok(None)`.
fn ler_em_pedacos(
    leitor: impl Read,
    teto: u64,
    mut gravar: impl FnMut(&[u8]) -> std::io::Result<()>,
) -> std::io::Result<Option<Lido>> {
    let mut leitor = leitor.take(teto.saturating_add(1));
    let mut hasher = Sha256::new();
    let mut buffer = vec![0_u8; PEDACO_DO_VIDEO];
    let mut cabeca = Vec::with_capacity(CABECALHO_DO_WEBM);
    let mut tamanho: u64 = 0;
    loop {
        let lidos = match leitor.read(&mut buffer) {
            Ok(0) => break,
            Ok(lidos) => lidos,
            Err(erro) if erro.kind() == std::io::ErrorKind::Interrupted => continue,
            Err(erro) => return Err(erro),
        };
        let pedaco = buffer.get(..lidos).unwrap_or_default();
        tamanho = tamanho.saturating_add(u64::try_from(lidos).unwrap_or(u64::MAX));
        if tamanho > teto {
            return Ok(None);
        }
        let falta_na_cabeca = CABECALHO_DO_WEBM.saturating_sub(cabeca.len());
        cabeca.extend_from_slice(pedaco.get(..falta_na_cabeca.min(lidos)).unwrap_or_default());
        hasher.update(pedaco);
        gravar(pedaco)?;
    }
    let hash = hasher.finalize().iter().map(|byte| format!("{byte:02x}")).collect();
    Ok(Some(Lido { tamanho, hash, cabeca }))
}

/// Um vídeo da pasta de mídia, conferido de ponta a ponta.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct VideoConferido {
    pub caminho: PathBuf,
    pub tamanho: u64,
    pub tipo: TipoDeVideo,
}

/// Confere o vídeo `id` da `pasta` lendo em pedaços: id estrito, arquivo
/// comum, até 500 MB, assinatura do tipo do id e hash do nome. Bloqueante (lê
/// o arquivo todo, ~1 s para 500 MB): chamar em `spawn_blocking`.
pub fn conferir_video(pasta: &Path, id: &str) -> Result<VideoConferido, ErroDeMidia> {
    let tipo = tipo_do_video(id).ok_or(ErroDeMidia::IdInvalido)?;
    let caminho = pasta.join(id);
    let arquivo = std::fs::File::open(&caminho).map_err(|_| ErroDeMidia::NaoEncontrada)?;
    let info = arquivo.metadata().map_err(|_| ErroDeMidia::NaoEncontrada)?;
    if !info.is_file() {
        return Err(ErroDeMidia::NaoEncontrada);
    }
    if info.len() > MIDIA_VIDEO_MAX_BYTES {
        return Err(ErroDeMidia::GrandeDemais);
    }
    let lido = ler_em_pedacos(arquivo, MIDIA_VIDEO_MAX_BYTES, |_| Ok(()))
        .map_err(|_| ErroDeMidia::NaoEncontrada)?
        .ok_or(ErroDeMidia::GrandeDemais)?;
    let hash_ok = id.split_once('.').is_some_and(|(hash, _)| hash == lido.hash);
    if TipoDeVideo::dos_bytes(&lido.cabeca) != Some(tipo) || !hash_ok {
        return Err(ErroDeMidia::ConteudoNaoConfere);
    }
    Ok(VideoConferido { caminho, tamanho: lido.tamanho, tipo })
}

/// Por que o vídeo não entrou na mídia da mesa.
#[derive(Debug, PartialEq, Eq)]
pub enum ErroDeImportacao {
    /// O arquivo escolhido não abre ou não é arquivo comum.
    Origem,
    GrandeDemais,
    /// Não é mp4 nem webm pela assinatura.
    NaoEVideo,
    /// Gravar na pasta de mídia falhou.
    Disco,
}

/// O vídeo que entrou: o id é `<sha256>.<mp4|webm>`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct VideoImportado {
    pub id: String,
    pub tamanho: u64,
    pub tipo: TipoDeVideo,
}

/// Copia o vídeo `origem` (escolhido pelo mestre no diálogo) para
/// `pasta/<sha256>.<ext>` em pedaços, sem carregar o arquivo na memória. O
/// tipo sai da assinatura, nunca do nome do arquivo de origem. Grava num nome
/// temporário e troca, para nunca deixar meio vídeo com o nome certo; se o
/// mesmo vídeo já está lá, só apaga a cópia. Bloqueante: `spawn_blocking`.
pub fn importar_video(origem: &Path, pasta: &Path, sufixo: u64) -> Result<VideoImportado, ErroDeImportacao> {
    let arquivo = std::fs::File::open(origem).map_err(|_| ErroDeImportacao::Origem)?;
    let info = arquivo.metadata().map_err(|_| ErroDeImportacao::Origem)?;
    if !info.is_file() {
        return Err(ErroDeImportacao::Origem);
    }
    if info.len() > MIDIA_VIDEO_MAX_BYTES {
        return Err(ErroDeImportacao::GrandeDemais);
    }
    std::fs::create_dir_all(pasta).map_err(|_| ErroDeImportacao::Disco)?;
    let temporario = pasta.join(format!("importando-{sufixo:016x}.tmp"));
    let resultado = copiar_conferindo(arquivo, &temporario, pasta);
    if resultado.is_err() {
        // Limpeza de melhor esforço: o erro que importa é o da cópia.
        let _ = std::fs::remove_file(&temporario);
    }
    resultado
}

fn copiar_conferindo(arquivo: std::fs::File, temporario: &Path, pasta: &Path) -> Result<VideoImportado, ErroDeImportacao> {
    let mut destino = std::io::BufWriter::new(std::fs::File::create(temporario).map_err(|_| ErroDeImportacao::Disco)?);
    let lido = ler_em_pedacos(arquivo, MIDIA_VIDEO_MAX_BYTES, |pedaco| destino.write_all(pedaco))
        .map_err(|_| ErroDeImportacao::Disco)?
        .ok_or(ErroDeImportacao::GrandeDemais)?;
    destino.flush().map_err(|_| ErroDeImportacao::Disco)?;
    drop(destino);
    let tipo = TipoDeVideo::dos_bytes(&lido.cabeca).ok_or(ErroDeImportacao::NaoEVideo)?;
    let id = format!("{}.{}", lido.hash, tipo.extensao());
    let no_lugar = pasta.join(&id);
    if no_lugar.is_file() {
        // O nome é o hash: o que já está lá é o mesmo vídeo.
        let _ = std::fs::remove_file(temporario);
    } else {
        std::fs::rename(temporario, &no_lugar).map_err(|_| ErroDeImportacao::Disco)?;
    }
    Ok(VideoImportado { id, tamanho: lido.tamanho, tipo })
}

/// O pedaço do arquivo que o cabeçalho `Range` pede (RFC 9110, 14.1.2).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FaixaPedida {
    /// Sem `Range`, ou um que o servidor pode ignorar (outra unidade, várias
    /// faixas, forma torta): `200` com o arquivo inteiro.
    Inteiro,
    /// `206`: de `inicio` até `fim`, os dois inclusos.
    Parte { inicio: u64, fim: u64 },
    /// `416`: a faixa começa no fim do arquivo ou depois.
    ForaDoArquivo,
}

/// Lê o `Range` de um arquivo de `tamanho` bytes. Só `bytes=`, uma faixa só.
pub fn faixa_pedida(cabecalho: Option<&str>, tamanho: u64) -> FaixaPedida {
    let Some(faixa) = cabecalho.and_then(|valor| valor.trim().strip_prefix("bytes=")) else {
        return FaixaPedida::Inteiro;
    };
    if faixa.contains(',') {
        return FaixaPedida::Inteiro;
    }
    let Some((de, ate)) = faixa.split_once('-') else {
        return FaixaPedida::Inteiro;
    };
    let (de, ate) = (de.trim(), ate.trim());
    if de.is_empty() {
        // Sufixo: os últimos `n` bytes.
        let Ok(ultimos) = ate.parse::<u64>() else {
            return FaixaPedida::Inteiro;
        };
        if ultimos == 0 || tamanho == 0 {
            return FaixaPedida::ForaDoArquivo;
        }
        return FaixaPedida::Parte { inicio: tamanho.saturating_sub(ultimos), fim: tamanho.saturating_sub(1) };
    }
    let Ok(inicio) = de.parse::<u64>() else {
        return FaixaPedida::Inteiro;
    };
    let fim = if ate.is_empty() {
        u64::MAX
    } else {
        match ate.parse::<u64>() {
            Ok(fim) => fim,
            Err(_) => return FaixaPedida::Inteiro,
        }
    };
    if fim < inicio {
        return FaixaPedida::Inteiro;
    }
    if inicio >= tamanho {
        return FaixaPedida::ForaDoArquivo;
    }
    FaixaPedida::Parte { inicio, fim: fim.min(tamanho.saturating_sub(1)) }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    const PNG_MINIMO: &[u8] = b"\x89PNG\r\n\x1a\n\x00\x00\x00\x0dIHDR";
    const WEBP_MINIMO: &[u8] = b"RIFF\x10\x00\x00\x00WEBPVP8 ";
    const MP3_ID3: &[u8] = b"ID3\x04\x00\x00\x00\x00\x00\x00";
    /// Quadro MPEG-1 camada III sem etiqueta (`FF FB`, o começo mais comum).
    const MP3_QUADRO: &[u8] = b"\xFF\xFB\x90\x64\x00\x00";
    const OGG_MINIMO: &[u8] = b"OggS\x00\x02\x00\x00\x00\x00";
    const WAV_MINIMO: &[u8] = b"RIFF\x24\x00\x00\x00WAVEfmt ";
    const M4A_MINIMO: &[u8] = b"\x00\x00\x00\x20ftypM4A \x00\x00\x00\x00";

    fn hash_de_exemplo() -> String {
        "a".repeat(TAMANHO_DO_HASH)
    }

    /// Pasta só deste teste: os testes rodam em paralelo.
    fn pasta_de_teste(nome: &str) -> Result<PathBuf, std::io::Error> {
        let pasta = std::env::temp_dir().join(format!("labirinto-midia-{nome}-{}", std::process::id()));
        std::fs::create_dir_all(&pasta)?;
        Ok(pasta)
    }

    fn gravar(pasta: &Path, bytes: &[u8], extensao: &str) -> Result<String, std::io::Error> {
        let id = format!("{}.{extensao}", hash_hex(bytes));
        std::fs::write(pasta.join(&id), bytes)?;
        Ok(id)
    }

    #[test]
    fn id_valido_e_so_hash_minusculo_com_extensao_da_lista() {
        let hash = hash_de_exemplo();
        assert_eq!(tipo_do_id(&format!("{hash}.webp")), Some(TipoDeMidia::Webp));
        assert_eq!(tipo_do_id(&format!("{hash}.png")), Some(TipoDeMidia::Png));
        assert_eq!(tipo_do_id(&format!("{hash}.jpg")), Some(TipoDeMidia::Jpeg));
        assert_eq!(tipo_do_id(&format!("{hash}.gif")), Some(TipoDeMidia::Gif));
        for ruim in [
            format!("{hash}.svg"),
            format!("{hash}.WEBP"),
            format!("{}.webp", hash.to_uppercase()),
            format!("{}.webp", &hash[1..]),
            format!("{hash}a.webp"),
            format!("{hash}.webp.png"),
            hash.clone(),
            format!("../{hash}.webp"),
            format!("..\\{hash}.webp"),
            format!("{}g.webp", &hash[1..]),
            String::new(),
            "..".to_owned(),
            "acervo.json".to_owned(),
        ] {
            assert_eq!(tipo_do_id(&ruim), None, "{ruim:?}");
        }
    }

    #[test]
    fn tipo_vem_da_assinatura() {
        assert_eq!(tipo_dos_bytes(PNG_MINIMO), Some(TipoDeMidia::Png));
        assert_eq!(tipo_dos_bytes(WEBP_MINIMO), Some(TipoDeMidia::Webp));
        assert_eq!(tipo_dos_bytes(b"\xFF\xD8\xFF\xE0"), Some(TipoDeMidia::Jpeg));
        assert_eq!(tipo_dos_bytes(b"GIF89a..."), Some(TipoDeMidia::Gif));
        assert_eq!(tipo_dos_bytes(b"<svg xmlns"), None);
        assert_eq!(tipo_dos_bytes(b"RIFF\x10\x00\x00\x00AVI "), None);
        assert_eq!(tipo_dos_bytes(b""), None);
    }

    #[test]
    fn tipo_do_audio_vem_da_assinatura() {
        assert_eq!(tipo_dos_bytes(MP3_ID3), Some(TipoDeMidia::Mp3));
        assert_eq!(tipo_dos_bytes(MP3_QUADRO), Some(TipoDeMidia::Mp3));
        // Os 3 bits altos do 2º byte, e só eles, contam: `FF E0` já é quadro.
        assert_eq!(tipo_dos_bytes(b"\xFF\xE0"), Some(TipoDeMidia::Mp3));
        assert_eq!(tipo_dos_bytes(OGG_MINIMO), Some(TipoDeMidia::Ogg));
        assert_eq!(tipo_dos_bytes(WAV_MINIMO), Some(TipoDeMidia::Wav));
        assert_eq!(tipo_dos_bytes(M4A_MINIMO), Some(TipoDeMidia::M4a));
        // Quase: sincronia com um bit faltando, `FF` sozinho, RIFF curto demais,
        // `ftyp` fora do lugar, `ID` sem o 3.
        for ruim in [
            b"\xFF\xC0\x00\x00".as_slice(),
            b"\xFF",
            b"RIFF\x10\x00\x00\x00WAV",
            b"ftyp\x00\x00\x00\x20M4A ",
            b"ID",
            b"Ogg",
        ] {
            assert_eq!(tipo_dos_bytes(ruim), None, "{ruim:?}");
        }
        // O JPEG começa com `FF` mas não vira MP3: `D8` não tem os 3 bits altos.
        assert_eq!(tipo_dos_bytes(b"\xFF\xD8\xFF\xE0"), Some(TipoDeMidia::Jpeg));
    }

    #[test]
    fn id_com_extensao_de_audio_e_o_teto_de_cada_tipo() {
        let hash = hash_de_exemplo();
        for (extensao, tipo, mime) in [
            ("mp3", TipoDeMidia::Mp3, "audio/mpeg"),
            ("ogg", TipoDeMidia::Ogg, "audio/ogg"),
            ("wav", TipoDeMidia::Wav, "audio/wav"),
            ("m4a", TipoDeMidia::M4a, "audio/mp4"),
        ] {
            assert_eq!(tipo_do_id(&format!("{hash}.{extensao}")), Some(tipo));
            assert_eq!(tipo.mime(), mime);
            assert!(tipo.eh_audio());
            assert_eq!(tipo.teto(), MIDIA_AUDIO_MAX_BYTES);
        }
        for ruim in [format!("{hash}.MP3"), format!("{hash}.mp4"), format!("{hash}.aac"), format!("{hash}.mp3.png")] {
            assert_eq!(tipo_do_id(&ruim), None, "{ruim:?}");
        }
        for imagem in [TipoDeMidia::Webp, TipoDeMidia::Png, TipoDeMidia::Jpeg, TipoDeMidia::Gif] {
            assert!(!imagem.eh_audio());
            assert_eq!(imagem.teto(), MIDIA_MAX_BYTES);
        }
    }

    #[tokio::test]
    async fn le_o_audio_conferido() -> Result<(), std::io::Error> {
        let pasta = pasta_de_teste("audio-ok")?;
        for (bytes, extensao, tipo) in [
            (MP3_ID3, "mp3", TipoDeMidia::Mp3),
            (MP3_QUADRO, "mp3", TipoDeMidia::Mp3),
            (OGG_MINIMO, "ogg", TipoDeMidia::Ogg),
            (WAV_MINIMO, "wav", TipoDeMidia::Wav),
            (M4A_MINIMO, "m4a", TipoDeMidia::M4a),
        ] {
            let id = gravar(&pasta, bytes, extensao)?;
            assert_eq!(ler_midia(&pasta, &id).await, Ok((bytes.to_vec(), tipo)), "{extensao}");
        }
        std::fs::remove_dir_all(&pasta)
    }

    #[tokio::test]
    async fn imagem_com_nome_de_audio_e_audio_com_nome_de_imagem_nao_saem() -> Result<(), std::io::Error> {
        let pasta = pasta_de_teste("audio-troca")?;
        let png_como_mp3 = gravar(&pasta, PNG_MINIMO, "mp3")?;
        assert_eq!(ler_midia(&pasta, &png_como_mp3).await, Err(ErroDeMidia::ConteudoNaoConfere));
        let webp_como_wav = gravar(&pasta, WEBP_MINIMO, "wav")?;
        assert_eq!(ler_midia(&pasta, &webp_como_wav).await, Err(ErroDeMidia::ConteudoNaoConfere));
        let mp3_como_png = gravar(&pasta, MP3_ID3, "png")?;
        assert_eq!(ler_midia(&pasta, &mp3_como_png).await, Err(ErroDeMidia::ConteudoNaoConfere));
        // Um áudio com o nome de outro áudio também não.
        let ogg_como_mp3 = gravar(&pasta, OGG_MINIMO, "mp3")?;
        assert_eq!(ler_midia(&pasta, &ogg_como_mp3).await, Err(ErroDeMidia::ConteudoNaoConfere));
        std::fs::remove_dir_all(&pasta)
    }

    #[tokio::test]
    async fn audio_ate_15_mb_sai_e_um_byte_a_mais_nao() -> Result<(), std::io::Error> {
        let pasta = pasta_de_teste("audio-teto")?;
        let teto = usize::try_from(MIDIA_AUDIO_MAX_BYTES).unwrap_or(usize::MAX);
        let mut no_teto = MP3_ID3.to_vec();
        no_teto.resize(teto, 0);
        let id = gravar(&pasta, &no_teto, "mp3")?;
        assert_eq!(ler_midia(&pasta, &id).await.map(|(bytes, tipo)| (bytes.len(), tipo)), Ok((teto, TipoDeMidia::Mp3)));
        let mut acima = no_teto;
        acima.push(0);
        let id = gravar(&pasta, &acima, "mp3")?;
        assert_eq!(ler_midia(&pasta, &id).await, Err(ErroDeMidia::GrandeDemais));
        std::fs::remove_dir_all(&pasta)
    }

    #[tokio::test]
    async fn imagem_nao_herda_o_teto_do_audio() -> Result<(), std::io::Error> {
        let pasta = pasta_de_teste("imagem-teto")?;
        // 3 MB: cabe no teto do áudio, passa do da imagem.
        let mut png = PNG_MINIMO.to_vec();
        png.resize(3 * 1024 * 1024, 0);
        let id = gravar(&pasta, &png, "png")?;
        assert_eq!(ler_midia(&pasta, &id).await, Err(ErroDeMidia::GrandeDemais));
        std::fs::remove_dir_all(&pasta)
    }

    #[test]
    fn hash_hex_e_o_sha256_conhecido() {
        assert_eq!(hash_hex(b"abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    }

    #[tokio::test]
    async fn le_a_midia_conferida() -> Result<(), std::io::Error> {
        let pasta = pasta_de_teste("ok")?;
        let id = gravar(&pasta, PNG_MINIMO, "png")?;
        assert_eq!(ler_midia(&pasta, &id).await, Ok((PNG_MINIMO.to_vec(), TipoDeMidia::Png)));
        std::fs::remove_dir_all(&pasta)
    }

    #[tokio::test]
    async fn arquivo_que_falta_e_id_torto_nao_saem() -> Result<(), std::io::Error> {
        let pasta = pasta_de_teste("falta")?;
        let ausente = format!("{}.webp", hash_de_exemplo());
        assert_eq!(ler_midia(&pasta, &ausente).await, Err(ErroDeMidia::NaoEncontrada));
        assert_eq!(ler_midia(&pasta, "../Cargo.toml").await, Err(ErroDeMidia::IdInvalido));
        assert_eq!(ler_midia(&pasta, "..").await, Err(ErroDeMidia::IdInvalido));
        std::fs::remove_dir_all(&pasta)
    }

    #[tokio::test]
    async fn traversal_nao_alcanca_arquivo_fora_da_pasta() -> Result<(), std::io::Error> {
        let raiz = pasta_de_teste("traversal")?;
        let pasta = raiz.join(PASTA_DE_MIDIA);
        std::fs::create_dir_all(&pasta)?;
        // O segredo mora AO LADO da pasta de mídia, com nome de mídia válida.
        let id = gravar(&raiz, PNG_MINIMO, "png")?;
        assert_eq!(ler_midia(&pasta, &id).await, Err(ErroDeMidia::NaoEncontrada));
        assert_eq!(ler_midia(&pasta, &format!("../{id}")).await, Err(ErroDeMidia::IdInvalido));
        assert_eq!(ler_midia(&pasta, &format!("..%2F{id}")).await, Err(ErroDeMidia::IdInvalido));
        std::fs::remove_dir_all(&raiz)
    }

    #[tokio::test]
    async fn conteudo_que_nao_bate_com_o_nome_nao_sai() -> Result<(), std::io::Error> {
        let pasta = pasta_de_teste("confere")?;
        // Bytes de PNG com extensão de WebP: o tipo não confere.
        let id_png = format!("{}.webp", hash_hex(PNG_MINIMO));
        std::fs::write(pasta.join(&id_png), PNG_MINIMO)?;
        assert_eq!(ler_midia(&pasta, &id_png).await, Err(ErroDeMidia::ConteudoNaoConfere));
        // Nome de hash bem formado, mas de outro conteúdo.
        let outro = format!("{}.png", hash_hex(b"outra coisa"));
        std::fs::write(pasta.join(&outro), PNG_MINIMO)?;
        assert_eq!(ler_midia(&pasta, &outro).await, Err(ErroDeMidia::ConteudoNaoConfere));
        std::fs::remove_dir_all(&pasta)
    }

    #[tokio::test]
    async fn pasta_com_nome_de_midia_e_arquivo_grande_nao_saem() -> Result<(), std::io::Error> {
        let pasta = pasta_de_teste("grande")?;
        let como_pasta = format!("{}.png", hash_de_exemplo());
        std::fs::create_dir_all(pasta.join(&como_pasta))?;
        assert_eq!(ler_midia(&pasta, &como_pasta).await, Err(ErroDeMidia::NaoEncontrada));
        let mut grande = PNG_MINIMO.to_vec();
        grande.resize(usize::try_from(MIDIA_MAX_BYTES).unwrap_or(usize::MAX) + 1, 0);
        let id = gravar(&pasta, &grande, "png")?;
        assert_eq!(ler_midia(&pasta, &id).await, Err(ErroDeMidia::GrandeDemais));
        std::fs::remove_dir_all(&pasta)
    }
}
