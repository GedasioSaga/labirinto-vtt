//! Protocolo `minigame://` (no Windows, `http://minigame.localhost/`): o
//! mesmo jogo que a sala serve em `/minigames/{jogo}/{nome}`, mas para as
//! janelas do próprio app, que não têm sala. A Visão de jogador do mestre é
//! uma página do Tauri (origem `tauri.localhost`): a URL relativa
//! `/minigames/fogo/index.html` caía no resolver do Tauri, que responde
//! caminho desconhecido com o `index.html` do editor (200), e o jogo nunca
//! dizia `pronto`.
//!
//! As regras são as da rota da sala (`server::minigame_arquivo`): só o que o
//! índice assinado do pacote instalado lista, com o sha256 conferido, e toda
//! recusa é o mesmo 404. A diferença: o corpo sai descompactado, porque a
//! resposta de protocolo próprio não passa pelo `Content-Encoding` do
//! navegador em toda plataforma.

use std::io::Read;

use tauri::http::{header, Method, Request, Response, StatusCode};
use tauri::{Manager, Runtime, UriSchemeContext, UriSchemeResponder};

use super::minigames;

/// O nome do esquema (`register_asynchronous_uri_scheme_protocol`).
pub const ESQUEMA: &str = "minigame";

/// Teto do arquivo descompactado: o motor do Fogo tem ~38 MB.
const TETO_DESCOMPACTADO: u64 = 256 * 1024 * 1024;

/// `/fogo/index.html` -> `("fogo", "index.html")`; qualquer outra forma é `None`.
pub fn jogo_e_nome(caminho: &str) -> Option<(&str, &str)> {
    let (jogo, nome) = caminho.strip_prefix('/')?.split_once('/')?;
    (!jogo.is_empty() && minigames::nome_servido_valido(nome)).then_some((jogo, nome))
}

fn nao_encontrado() -> Response<Vec<u8>> {
    let mut resposta = Response::new(Vec::new());
    *resposta.status_mut() = StatusCode::NOT_FOUND;
    resposta
}

fn descompactar(gz: &[u8]) -> Option<Vec<u8>> {
    let mut corpo = Vec::new();
    flate2::read::GzDecoder::new(gz)
        .take(TETO_DESCOMPACTADO)
        .read_to_end(&mut corpo)
        .ok()?;
    Some(corpo)
}

async fn responder_arquivo(
    dados_do_app: Option<std::path::PathBuf>,
    caminho: String,
    so_cabecalho: bool,
) -> Response<Vec<u8>> {
    let Some((jogo, nome)) = jogo_e_nome(&caminho) else {
        return nao_encontrado();
    };
    let Some(pacote) = dados_do_app.and_then(|dados| minigames::Pacote::oficial(&dados, jogo)) else {
        return nao_encontrado();
    };
    let Ok(verificado) = pacote.ler_indice().await else {
        return nao_encontrado();
    };
    let (Some(arquivo), Some(tipo)) = (verificado.indice.arquivo(nome), minigames::tipo_do_arquivo(nome)) else {
        return nao_encontrado();
    };
    let Ok(gz) = pacote.ler_arquivo_de(arquivo).await else {
        return nao_encontrado();
    };
    let corpo = match tauri::async_runtime::spawn_blocking(move || descompactar(&gz)).await {
        Ok(Some(corpo)) => corpo,
        _ => return nao_encontrado(),
    };
    let tamanho = corpo.len();
    let corpo = if so_cabecalho { Vec::new() } else { corpo };
    Response::builder()
        .header(header::CONTENT_TYPE, tipo)
        .header(header::CONTENT_LENGTH, tamanho)
        .header(header::X_CONTENT_TYPE_OPTIONS, "nosniff")
        .header(header::CACHE_CONTROL, "no-cache")
        // A página do app (origem `tauri.localhost`) confere a entrada com um
        // `HEAD` antes do iframe; o jogo não tem segredo (é o mesmo da sala).
        .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
        .body(corpo)
        .unwrap_or_else(|_| nao_encontrado())
}

/// O manipulador do esquema: lê o pacote fora da thread da janela.
pub fn atender<R: Runtime>(ctx: UriSchemeContext<'_, R>, pedido: Request<Vec<u8>>, responder: UriSchemeResponder) {
    let metodo = pedido.method().clone();
    if metodo != Method::GET && metodo != Method::HEAD {
        responder.respond(nao_encontrado());
        return;
    }
    let dados_do_app = ctx.app_handle().path().app_data_dir().ok();
    let caminho = pedido.uri().path().to_owned();
    tauri::async_runtime::spawn(async move {
        responder.respond(responder_arquivo(dados_do_app, caminho, metodo == Method::HEAD).await);
    });
}

#[cfg(test)]
mod testes {
    use super::*;

    #[test]
    fn so_jogo_barra_nome_do_pacote() {
        assert_eq!(jogo_e_nome("/fogo/index.html"), Some(("fogo", "index.html")));
        assert_eq!(jogo_e_nome("/fogo/index.audio.worklet.js"), Some(("fogo", "index.audio.worklet.js")));
        for torto in ["/fogo/../x.html", "/fogo/a/index.html", "fogo/index.html", "//index.html", "/fogo/index.exe", "/fogo/"] {
            assert_eq!(jogo_e_nome(torto), None, "{torto}");
        }
    }

    #[test]
    fn descompacta_o_gzip_do_pacote() {
        use std::io::Write;
        let mut gz = flate2::write::GzEncoder::new(Vec::new(), flate2::Compression::fast());
        gz.write_all(b"<!doctype html>jogo").ok();
        let gz = gz.finish().unwrap_or_default();
        assert_eq!(descompactar(&gz).as_deref(), Some(&b"<!doctype html>jogo"[..]));
        assert_eq!(descompactar(b"nao e gzip"), None);
    }
}
