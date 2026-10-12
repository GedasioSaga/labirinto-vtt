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

use std::path::Path;

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
    let hash_ok = hash.len() == TAMANHO_DO_HASH && hash.bytes().all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b));
    if !hash_ok {
        return None;
    }
    TipoDeMidia::pela_extensao(extensao)
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
