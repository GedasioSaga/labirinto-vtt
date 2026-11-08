//! O HTTP do Prelúdio: o mesmo reqwest 0.13 com native-tls do resto do app. Ele sai sem
//! as features `json`, `query` e `form`; o JSON vai pelo `serde_json`, a URL pelo
//! `Url::parse_with_params` e o formulário por [`formulario`].

use std::time::Duration;

use super::ErroPreludio;

pub const KIB: usize = 1024;
/// Resposta de login, de e-mail, de pasta criada ou de arquivo enviado.
pub const RESPOSTA_PEQUENA_MAX: usize = 64 * KIB;
/// Uma página da lista do Drive (1.000 arquivos com hash e propriedades).
pub const PAGINA_MAX: usize = 4 * 1024 * KIB;
/// Pedido curto: login, e-mail, lista, pasta.
pub const TEMPO_CURTO: Duration = Duration::from_secs(30);
const TEMPO_PARA_CONECTAR: Duration = Duration::from_secs(15);
/// Sem receber nada por este tempo no meio de uma resposta, a conexão caiu.
const TEMPO_SEM_RESPOSTA: Duration = Duration::from_secs(60);
/// Envio e download: 60 s mais 1 s a cada 64 KiB (internet de 64 KiB/s ainda termina).
const BYTES_POR_SEGUNDO_MIN: u64 = 64 * 1024;
const TEMPO_BASE_DE_TRANSFERENCIA: u64 = 60;

/// Só HTTPS e sem seguir redirecionamento: um redirect seguido às cegas levaria o
/// `Authorization` (o access token) para outro endereço.
pub fn cliente() -> Result<reqwest::Client, ErroPreludio> {
    reqwest::Client::builder()
        .https_only(true)
        .redirect(reqwest::redirect::Policy::none())
        .connect_timeout(TEMPO_PARA_CONECTAR)
        .read_timeout(TEMPO_SEM_RESPOSTA)
        .user_agent(concat!("labirinto-vtt/", env!("CARGO_PKG_VERSION")))
        .build()
        .map_err(|_| ErroPreludio::novo("rede", "Não deu para preparar a conexão com o Google."))
}

/// Tempo de um envio ou download de `bytes`.
pub fn tempo_para(bytes: usize) -> Duration {
    let bytes = u64::try_from(bytes).unwrap_or(u64::MAX);
    Duration::from_secs(TEMPO_BASE_DE_TRANSFERENCIA.saturating_add(bytes / BYTES_POR_SEGUNDO_MIN))
}

/// Sem o texto do erro do reqwest: ele traz a URL do pedido, e nada do pedido precisa
/// sair daqui.
pub fn erro_de_rede(erro: &reqwest::Error) -> ErroPreludio {
    let mensagem = if erro.is_timeout() {
        "O Google demorou demais para responder. Tente de novo."
    } else if erro.is_connect() {
        "Sem conexão com o Google. Confira a internet."
    } else {
        "A conexão com o Google caiu no meio. Tente de novo."
    };
    ErroPreludio::novo("rede", mensagem)
}

/// Lê o corpo em pedaços e para no teto, sem confiar no Content-Length.
pub async fn ler_limitado(resposta: &mut reqwest::Response, teto: usize) -> Result<Vec<u8>, ErroPreludio> {
    let grande = || {
        ErroPreludio::novo(
            "google",
            format!("A resposta do Google veio grande demais (mais de {} KiB).", teto / KIB),
        )
    };
    if resposta
        .content_length()
        .is_some_and(|n| n > u64::try_from(teto).unwrap_or(u64::MAX))
    {
        return Err(grande());
    }
    let mut corpo = Vec::new();
    while let Some(pedaco) = resposta.chunk().await.map_err(|e| erro_de_rede(&e))? {
        if corpo.len().saturating_add(pedaco.len()) > teto {
            return Err(grande());
        }
        corpo.extend_from_slice(&pedaco);
    }
    Ok(corpo)
}

/// Uma URL com parâmetros, codificados pelo `url` (o mesmo que o reqwest usa).
pub fn url_com(base: &str, parametros: &[(&str, &str)]) -> Result<reqwest::Url, ErroPreludio> {
    reqwest::Url::parse_with_params(base, parametros)
        .map_err(|_| ErroPreludio::novo("google", "Não deu para montar o endereço do Google."))
}

/// Corpo `application/x-www-form-urlencoded`, pela mesma codificação do `url`.
pub fn formulario(campos: &[(&str, &str)]) -> Result<String, ErroPreludio> {
    let mut url = reqwest::Url::parse("https://formulario.invalid/")
        .map_err(|_| ErroPreludio::novo("google", "Não deu para montar o pedido ao Google."))?;
    url.query_pairs_mut().extend_pairs(campos);
    Ok(url.query().unwrap_or_default().to_owned())
}
