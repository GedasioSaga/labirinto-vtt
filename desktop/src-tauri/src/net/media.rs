//! MÍDIA DA MESA (entrega 4 dos sistemas de RPG): as imagens que o jogador
//! carrega por URL em vez de recebê-las embutidas em cada mensagem — a imagem
//! do item do acervo e o retrato da ficha de personagem.
//!
//! O mestre (TS, `client/src/lib/midia.ts`) grava cada imagem UMA vez em
//! `<appData>/midia/<sha256>.<ext>`: o nome é o hash do conteúdo. A rota
//! `/media/{id}` só serve arquivo dessa pasta, e só com nome nessa forma exata.
//!
//! Por que o hash basta para o jogador só ver o que lhe mostraram: o id tem 256
//! bits e sai do CONTEÚDO, então não dá para adivinhar o de uma imagem que o
//! mestre nunca mandou a ninguém (o item guardado no acervo, o retrato da ficha
//! de outro jogador). Quem tem o id é quem recebeu a referência numa mensagem
//! do host — e quem já recebeu a referência já podia ver a imagem.
//!
//! Defesa em camadas, todas aqui e testadas:
//!  - id estrito (`tipo_do_id`): 64 hex minúsculos + extensão da lista; nada de
//!    barra, ponto a mais, `..` ou caminho — não existe traversal possível;
//!  - o arquivo é lido só se for arquivo comum e couber em `MIDIA_MAX_BYTES`;
//!  - os bytes precisam ser do tipo da extensão (assinatura) e ter o hash do
//!    nome: arquivo posto à mão na pasta com nome bonito não sai.

use std::path::Path;

use sha2::{Digest, Sha256};

/// Nome da pasta dentro do `app_data_dir` (o mesmo `appDataDir()` do TS).
pub const PASTA_DE_MIDIA: &str = "midia";
/// Teto de uma imagem servida. As do app saem reduzidas (640 px WebP, ~50 KB);
/// o teto só barra o arquivo estranho.
pub const MIDIA_MAX_BYTES: u64 = 2 * 1024 * 1024;
/// Hex do SHA-256.
const TAMANHO_DO_HASH: usize = 64;

/// Os formatos que a mesa aceita: os mesmos da foto do token (`tokenPhoto.ts`).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TipoDeMidia {
    Webp,
    Png,
    Jpeg,
    Gif,
}

impl TipoDeMidia {
    pub fn mime(self) -> &'static str {
        match self {
            Self::Webp => "image/webp",
            Self::Png => "image/png",
            Self::Jpeg => "image/jpeg",
            Self::Gif => "image/gif",
        }
    }

    fn pela_extensao(extensao: &str) -> Option<Self> {
        match extensao {
            "webp" => Some(Self::Webp),
            "png" => Some(Self::Png),
            "jpg" => Some(Self::Jpeg),
            "gif" => Some(Self::Gif),
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

/// O tipo de um id válido (`<64 hex minúsculos>.<webp|png|jpg|gif>`); qualquer
/// outra forma é `None`.
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
    if bytes.starts_with(b"\xFF\xD8\xFF") {
        return Some(TipoDeMidia::Jpeg);
    }
    if bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a") {
        return Some(TipoDeMidia::Gif);
    }
    let webp = bytes.get(..4) == Some(b"RIFF".as_slice()) && bytes.get(8..12) == Some(b"WEBP".as_slice());
    webp.then_some(TipoDeMidia::Webp)
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
    if info.len() > MIDIA_MAX_BYTES {
        return Err(ErroDeMidia::GrandeDemais);
    }
    let bytes = tokio::fs::read(&caminho).await.map_err(|_| ErroDeMidia::NaoEncontrada)?;
    // O arquivo pode ter crescido entre o `metadata` e o `read`.
    if u64::try_from(bytes.len()).unwrap_or(u64::MAX) > MIDIA_MAX_BYTES {
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
        assert_eq!(tipo_dos_bytes(b"RIFF\x10\x00\x00\x00WAVE"), None);
        assert_eq!(tipo_dos_bytes(b""), None);
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
