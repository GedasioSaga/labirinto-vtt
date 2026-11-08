//! LOGIN DO GOOGLE: OAuth 2.0 com PKCE (RFC 7636) no navegador do sistema (RFC 8252).
//!
//! Vem do `auth.rs` do Grimório (o mestre autorizou reaproveitar em 08/11/2026), sem a
//! crate `oauth2` nem o `tauri-plugin-oauth`: os dois trariam o reqwest 0.12 com rustls
//! para o lado do 0.13 com native-tls que o Labirinto já usa. Aqui o mesmo fluxo sai no
//! cliente HTTP do app, e a porta de retorno é aberta pelo próprio tokio.
//!
//! - O navegador é o do sistema: o Google recusa login dentro de WebView
//!   (`disallowed_useragent`), e o WebView2 é exatamente o que o Tauri usa.
//! - O retorno chega numa porta local sorteada (`http://127.0.0.1:<porta>`). Qualquer
//!   programa do PC pode bater nela; o `state` sorteado amarra a resposta ao pedido, e o
//!   PKCE impede que um código roubado vire token em outro lugar.
//! - O refresh token mora no Cofre do Windows (alvo `labirinto-vtt.preludio.google`);
//!   o access token, só na memória deste processo. Nenhum tipo que os carrega tem `Debug`.
//! - "Sair" só esquece neste PC. Não revoga no Google de propósito: o cliente OAuth é o
//!   mesmo do Grimório, e revogar a concessão derrubaria o login de lá também.

use std::net::Ipv4Addr;
use std::time::{Duration, Instant};

use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine as _;
use rand::RngCore as _;
use reqwest::header::{HeaderValue, CONTENT_TYPE};
use serde::{Deserialize, Serialize};
use sha2::{Digest as _, Sha256};
use tokio::io::{AsyncReadExt as _, AsyncWriteExt as _};
use tokio::net::{TcpListener, TcpStream};

use super::rede::{self, RESPOSTA_PEQUENA_MAX, TEMPO_CURTO};
use super::ErroPreludio;

const URL_DE_AUTORIZACAO: &str = "https://accounts.google.com/o/oauth2/v2/auth";
const URL_DO_TOKEN: &str = "https://oauth2.googleapis.com/token";
const URL_DO_EMAIL: &str = "https://www.googleapis.com/oauth2/v3/userinfo";
/// Só `drive.file`: o app enxerga apenas os arquivos que ele mesmo criou. Os escopos
/// largos do Drive são "restritos" e pediriam auditoria paga para distribuir o app.
const ESCOPOS: &str = "https://www.googleapis.com/auth/drive.file openid email";
const TIPO_FORMULARIO: &str = "application/x-www-form-urlencoded";

/// Credenciais do cliente OAuth do Google, lidas NA COMPILAÇÃO. Nunca no git: a build do
/// mestre lê as variáveis de ambiente (docs/planos/preludio-2026-11-08.md, seção
/// "Cópia no Google Drive"). O rustc refaz a build quando elas mudam.
const CLIENT_ID: Option<&str> = option_env!("LABIRINTO_GOOGLE_CLIENT_ID");
const CLIENT_SECRET: Option<&str> = option_env!("LABIRINTO_GOOGLE_CLIENT_SECRET");

/// Quanto o app espera o mestre terminar no navegador antes de fechar a porta local.
const LIMITE_DO_LOGIN: Duration = Duration::from_secs(300);
/// Uma conexão na porta local que não manda o pedido neste tempo é largada.
const TEMPO_DA_CONEXAO: Duration = Duration::from_secs(10);
const PEDIDO_LOCAL_MAX: usize = 8 * 1024;
/// O access token é renovado um pouco antes de vencer (relógio torto, rede lenta).
const MARGEM_DO_TOKEN: Duration = Duration::from_secs(60);
const VALIDADE_PADRAO_S: u64 = 3_600;
const VALIDADE_MAX_S: u64 = 86_400;
/// Bytes sorteados do verificador PKCE (43 letras em base64url) e do `state`.
const BYTES_DO_VERIFICADOR: usize = 32;
const BYTES_DO_STATE: usize = 24;
const EMAIL_MAX: usize = 320;

/// A resposta que o Google recusa com este código é a de uma conta que não vale mais
/// (acesso removido, senha trocada, ou a concessão venceu).
const CONCESSAO_INVALIDA: &str = "invalid_grant";

const PAGINA_PRONTA: &str = "<!doctype html><html lang=\"pt-BR\"><head><meta charset=\"utf-8\"><title>Labirinto</title></head><body style=\"font-family:system-ui,sans-serif;text-align:center;padding-top:4rem\"><p>Pode voltar para o Labirinto. Esta aba já pode ser fechada.</p></body></html>";
const PAGINA_RECUSADA: &str = "<!doctype html><html lang=\"pt-BR\"><head><meta charset=\"utf-8\"><title>Labirinto</title></head><body style=\"font-family:system-ui,sans-serif;text-align:center;padding-top:4rem\"><p>O login não foi autorizado. Pode fechar esta aba e tentar de novo no Labirinto.</p></body></html>";
const PAGINA_VAZIA: &str = "<!doctype html><title>Labirinto</title>";

// ---------------------------------------------------------------------------
// Estado
// ---------------------------------------------------------------------------

/// Access token vivo só na memória. Sem `Debug` de propósito.
struct TokenEmMemoria {
    valor: String,
    expira_em: Instant,
}

impl TokenEmMemoria {
    fn novo(valor: String, validade_s: Option<u64>) -> Self {
        let validade = Duration::from_secs(validade_s.unwrap_or(VALIDADE_PADRAO_S).min(VALIDADE_MAX_S));
        Self {
            valor,
            expira_em: Instant::now() + validade.saturating_sub(MARGEM_DO_TOKEN),
        }
    }
}

/// Ordem das travas, quando duas se encontram: `token` antes de `trava_cofre`.
#[derive(Default)]
pub struct EstadoGoogle {
    token: tokio::sync::Mutex<Option<TokenEmMemoria>>,
    /// A crate do Windows avisa que operações na mesma credencial em threads diferentes
    /// não saem em ordem garantida: uma por vez.
    trava_cofre: tokio::sync::Mutex<()>,
    /// Um login por vez (uma porta local, uma aba no navegador).
    login: tokio::sync::Mutex<()>,
    cancelar: tokio::sync::Notify,
}

// ---------------------------------------------------------------------------
// Cliente OAuth (da compilação)
// ---------------------------------------------------------------------------

struct Cliente {
    id: &'static str,
    segredo: &'static str,
}

fn cliente() -> Result<Cliente, ErroPreludio> {
    let limpo = |valor: Option<&'static str>| valor.map(str::trim).filter(|texto| !texto.is_empty());
    match (limpo(CLIENT_ID), limpo(CLIENT_SECRET)) {
        (Some(id), Some(segredo)) => Ok(Cliente { id, segredo }),
        _ => Err(ErroPreludio::novo(
            "sem_credenciais_na_build",
            "Esta versão do Labirinto foi compilada sem o cliente do Google \
             (LABIRINTO_GOOGLE_CLIENT_ID e LABIRINTO_GOOGLE_CLIENT_SECRET), então o login com o \
             Google não funciona nela. Não é nada que você fez: é a build que saiu sem ele.",
        )),
    }
}

/// A build tem o cliente do Google (sem ele, o botão "Entrar" explica por que não entra).
pub fn credenciais_na_build() -> bool {
    cliente().is_ok()
}

fn erro_login(mensagem: impl Into<String>) -> ErroPreludio {
    ErroPreludio::novo("login", mensagem)
}

fn sem_conta() -> ErroPreludio {
    ErroPreludio::novo("sem_conta", "Entre com o Google para fazer a cópia no Drive.")
}

fn conta_vencida() -> ErroPreludio {
    ErroPreludio::novo(
        "sem_conta",
        "A conexão com o Google venceu ou foi removida na sua Conta Google. Entre com o Google de novo.",
    )
}

/// Só letras, números e `_.-`, até 60: o código de erro do Google vira texto de aviso.
fn curto(texto: &str) -> String {
    texto
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || matches!(c, '_' | '.' | '-'))
        .take(60)
        .collect()
}

// ---------------------------------------------------------------------------
// O Cofre do Windows (refresh token + e-mail, num JSON só)
// ---------------------------------------------------------------------------

/// O que o cofre guarda. Sem `Debug` de propósito: nada imprime isto.
#[derive(Serialize, Deserialize)]
struct ContaGuardada {
    refresh: String,
    email: String,
}

#[cfg(windows)]
mod cofre {
    use std::collections::HashMap;

    use keyring_core::api::CredentialStoreApi as _;
    use keyring_core::{Entry, Error};

    use super::ErroPreludio;

    /// Nome da credencial no Gerenciador de Credenciais do Windows.
    const ALVO: &str = "labirinto-vtt.preludio.google";
    const SERVICO: &str = "preludio-google";
    const USUARIO: &str = "labirinto-vtt";

    fn erro(erro: &Error) -> ErroPreludio {
        // O Display da keyring-core descreve a falha do Windows; nunca inclui o segredo.
        ErroPreludio::novo("cofre", format!("Não deu para usar o Cofre do Windows ({erro})."))
    }

    fn entrada() -> Result<Entry, ErroPreludio> {
        let store = windows_native_keyring_store::Store::new().map_err(|e| erro(&e))?;
        // `Local` = só neste computador (o padrão da crate viaja com o perfil de domínio).
        let modificadores = HashMap::from([("target", ALVO), ("persistence", "Local")]);
        store.build(SERVICO, USUARIO, Some(&modificadores)).map_err(|e| erro(&e))
    }

    pub fn ler() -> Result<Option<String>, ErroPreludio> {
        match entrada()?.get_password() {
            Ok(texto) => Ok(Some(texto)),
            Err(Error::NoEntry) => Ok(None),
            Err(e) => Err(erro(&e)),
        }
    }

    pub fn gravar(texto: &str) -> Result<(), ErroPreludio> {
        entrada()?.set_password(texto).map_err(|e| erro(&e))
    }

    pub fn apagar() -> Result<(), ErroPreludio> {
        match entrada()?.delete_credential() {
            Ok(()) | Err(Error::NoEntry) => Ok(()),
            Err(e) => Err(erro(&e)),
        }
    }
}

#[cfg(not(windows))]
mod cofre {
    use super::ErroPreludio;

    const INDISPONIVEL: &str = "O login com o Google só funciona no Windows por enquanto.";

    pub fn ler() -> Result<Option<String>, ErroPreludio> {
        Err(ErroPreludio::novo("cofre", INDISPONIVEL))
    }

    pub fn gravar(_texto: &str) -> Result<(), ErroPreludio> {
        Err(ErroPreludio::novo("cofre", INDISPONIVEL))
    }

    pub fn apagar() -> Result<(), ErroPreludio> {
        Err(ErroPreludio::novo("cofre", INDISPONIVEL))
    }
}

/// O Credential Manager é chamada bloqueante do Windows: sai do worker async.
async fn no_cofre<T, F>(fazer: F) -> Result<T, ErroPreludio>
where
    T: Send + 'static,
    F: FnOnce() -> Result<T, ErroPreludio> + Send + 'static,
{
    tauri::async_runtime::spawn_blocking(fazer)
        .await
        .map_err(|_| ErroPreludio::novo("cofre", "O acesso ao Cofre do Windows foi interrompido."))?
}

async fn ler_conta(estado: &EstadoGoogle) -> Result<Option<ContaGuardada>, ErroPreludio> {
    let _trava = estado.trava_cofre.lock().await;
    let Some(texto) = no_cofre(cofre::ler).await? else {
        return Ok(None);
    };
    serde_json::from_str(&texto).map(Some).map_err(|_| {
        ErroPreludio::novo(
            "cofre",
            "A conta do Google guardada no Cofre do Windows está danificada. Saia e entre com o Google de novo.",
        )
    })
}

async fn gravar_conta(estado: &EstadoGoogle, conta: &ContaGuardada) -> Result<(), ErroPreludio> {
    let texto = serde_json::to_string(conta)
        .map_err(|_| ErroPreludio::novo("cofre", "Não deu para preparar a conta para o Cofre do Windows."))?;
    let _trava = estado.trava_cofre.lock().await;
    no_cofre(move || cofre::gravar(&texto)).await
}

async fn apagar_conta(estado: &EstadoGoogle) -> Result<(), ErroPreludio> {
    let _trava = estado.trava_cofre.lock().await;
    no_cofre(cofre::apagar).await
}

// ---------------------------------------------------------------------------
// Token
// ---------------------------------------------------------------------------

/// Sem `Debug` de propósito: carrega os tokens.
#[derive(Deserialize)]
struct RespostaDoToken {
    access_token: String,
    expires_in: Option<u64>,
    refresh_token: Option<String>,
}

#[derive(Deserialize)]
struct RecusaDoToken {
    error: Option<String>,
}

/// Um POST no endpoint de token. A recusa vira mensagem só com o CÓDIGO do erro do
/// Google, nunca com o corpo da resposta.
async fn pedir_token(http: &reqwest::Client, campos: &[(&str, &str)]) -> Result<RespostaDoToken, ErroPreludio> {
    let mut resposta = http
        .post(URL_DO_TOKEN)
        .header(CONTENT_TYPE, HeaderValue::from_static(TIPO_FORMULARIO))
        .body(rede::formulario(campos)?)
        .timeout(TEMPO_CURTO)
        .send()
        .await
        .map_err(|e| rede::erro_de_rede(&e))?;
    let status = resposta.status().as_u16();
    let corpo = rede::ler_limitado(&mut resposta, RESPOSTA_PEQUENA_MAX).await?;
    if (200..300).contains(&status) {
        return serde_json::from_slice(&corpo)
            .map_err(|_| ErroPreludio::novo("google", "O Google respondeu o login num formato inesperado."));
    }
    let codigo = serde_json::from_slice::<RecusaDoToken>(&corpo)
        .ok()
        .and_then(|recusa| recusa.error)
        .map(|codigo| curto(&codigo))
        .unwrap_or_default();
    if codigo == CONCESSAO_INVALIDA {
        return Err(conta_vencida());
    }
    let motivo = if codigo.is_empty() { format!("HTTP {status}") } else { codigo };
    Err(erro_login(format!("O Google recusou o login ({motivo}).")))
}

/// Um access token válido: o da memória, ou um novo pelo refresh token do cofre.
pub async fn access_token(estado: &EstadoGoogle, http: &reqwest::Client) -> Result<String, ErroPreludio> {
    // Segura a trava do token durante a renovação: duas cópias ao mesmo tempo renovam uma vez só.
    let mut guarda = estado.token.lock().await;
    if let Some(token) = guarda.as_ref().filter(|token| Instant::now() < token.expira_em) {
        return Ok(token.valor.clone());
    }
    let conta = ler_conta(estado).await?.ok_or_else(sem_conta)?;
    let cliente = cliente()?;
    let campos = [
        ("grant_type", "refresh_token"),
        ("refresh_token", conta.refresh.as_str()),
        ("client_id", cliente.id),
        ("client_secret", cliente.segredo),
    ];
    let resposta = match pedir_token(http, &campos).await {
        Ok(resposta) => resposta,
        Err(erro) => {
            if erro.codigo == "sem_conta" {
                // A concessão morreu: a conta guardada não serve para mais nada.
                let _ = apagar_conta(estado).await;
            }
            return Err(erro);
        }
    };
    // O Google pode trocar o refresh token; o velho deixa de valer.
    if let Some(novo) = resposta.refresh_token.filter(|novo| *novo != conta.refresh) {
        gravar_conta(estado, &ContaGuardada { refresh: novo, email: conta.email }).await?;
    }
    let valor = resposta.access_token.clone();
    *guarda = Some(TokenEmMemoria::novo(resposta.access_token, resposta.expires_in));
    Ok(valor)
}

/// O Drive recusou o token (401): o próximo pedido renova.
pub async fn esquecer_token(estado: &EstadoGoogle) {
    *estado.token.lock().await = None;
}

/// O e-mail da conta guardada, ou `None` sem login.
pub async fn conta(estado: &EstadoGoogle) -> Result<Option<String>, ErroPreludio> {
    Ok(ler_conta(estado).await?.map(|conta| conta.email))
}

/// Esquece a conta neste PC (o cofre e a memória). Ver o topo: não revoga no Google.
pub async fn sair(estado: &EstadoGoogle) -> Result<(), ErroPreludio> {
    esquecer_token(estado).await;
    apagar_conta(estado).await
}

/// Desiste do login que espera o navegador (o botão "Cancelar").
pub fn cancelar(estado: &EstadoGoogle) {
    estado.cancelar.notify_waiters();
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

fn sorteado(bytes: usize) -> String {
    let mut sorteio = vec![0_u8; bytes];
    rand::rng().fill_bytes(&mut sorteio);
    URL_SAFE_NO_PAD.encode(sorteio)
}

fn endereco_do_login(client_id: &str, retorno: &str, desafio: &str, state: &str) -> Result<reqwest::Url, ErroPreludio> {
    rede::url_com(
        URL_DE_AUTORIZACAO,
        &[
            ("client_id", client_id),
            ("redirect_uri", retorno),
            ("response_type", "code"),
            ("scope", ESCOPOS),
            ("code_challenge", desafio),
            ("code_challenge_method", "S256"),
            ("state", state),
            // `offline` + `consent` juntos garantem o refresh token, mesmo para quem já autorizou.
            ("access_type", "offline"),
            ("prompt", "consent"),
        ],
    )
}

/// Faz o login inteiro e devolve o e-mail. O refresh token vai direto para o cofre.
pub async fn entrar(estado: &EstadoGoogle, http: &reqwest::Client) -> Result<String, ErroPreludio> {
    let cliente = cliente()?;
    let _login = estado.login.try_lock().map_err(|_| {
        ErroPreludio::novo(
            "ocupado",
            "O login do Google já está aberto no navegador. Termine lá, ou cancele aqui.",
        )
    })?;
    // Criado antes de qualquer espera: um "Cancelar" a partir daqui sempre chega.
    let cancelado = estado.cancelar.notified();

    let verificador = sorteado(BYTES_DO_VERIFICADOR);
    let desafio = URL_SAFE_NO_PAD.encode(Sha256::digest(verificador.as_bytes()));
    let state = sorteado(BYTES_DO_STATE);
    let ouvinte = TcpListener::bind((Ipv4Addr::LOCALHOST, 0))
        .await
        .map_err(|_| erro_login("Não deu para abrir a porta local que recebe a resposta do Google."))?;
    let porta = ouvinte
        .local_addr()
        .map_err(|_| erro_login("Não deu para abrir a porta local que recebe a resposta do Google."))?
        .port();
    let retorno = format!("http://127.0.0.1:{porta}");
    let endereco = endereco_do_login(cliente.id, &retorno, &desafio, &state)?;
    abrir_no_navegador(endereco.as_str())?;

    let code = tokio::select! {
        resultado = esperar_o_retorno(&ouvinte, &state) => resultado?,
        () = cancelado => return Err(ErroPreludio::novo("cancelado", "Login cancelado.")),
        () = tokio::time::sleep(LIMITE_DO_LOGIN) => {
            return Err(erro_login("O login demorou mais de 5 minutos e foi cancelado. Tente entrar de novo."));
        }
    };
    drop(ouvinte);

    let campos = [
        ("grant_type", "authorization_code"),
        ("code", code.as_str()),
        ("redirect_uri", retorno.as_str()),
        ("client_id", cliente.id),
        ("client_secret", cliente.segredo),
        ("code_verifier", verificador.as_str()),
    ];
    let tokens = pedir_token(http, &campos).await?;
    let refresh = tokens.refresh_token.ok_or_else(|| {
        erro_login(
            "O Google não mandou a autorização duradoura. Remova o acesso do app na sua Conta Google e entre de novo.",
        )
    })?;
    // O e-mail antes de gravar: se esta chamada falhar, nada fica órfão no cofre.
    let email = buscar_email(http, &tokens.access_token).await?;
    gravar_conta(estado, &ContaGuardada { refresh, email: email.clone() }).await?;
    *estado.token.lock().await = Some(TokenEmMemoria::novo(tokens.access_token, tokens.expires_in));
    Ok(email)
}

/// `url.dll,FileProtocolHandler` entrega o endereço ao navegador padrão sem passar por um
/// shell: nada no endereço vira comando. O caminho é o do Windows, nunca o do PATH.
#[cfg(windows)]
fn abrir_no_navegador(endereco: &str) -> Result<(), ErroPreludio> {
    let sistema = std::env::var_os("SystemRoot").map_or_else(
        || std::path::PathBuf::from("C:\\Windows"),
        std::path::PathBuf::from,
    );
    // Sem esperar o rundll32 terminar: se o Windows perguntar qual navegador usar, o
    // login segue esperando o retorno (e o "Cancelar") em vez de travar aqui.
    tokio::process::Command::new(sistema.join("System32").join("rundll32.exe"))
        .arg("url.dll,FileProtocolHandler")
        .arg(endereco)
        .spawn()
        .map(drop)
        .map_err(|_| erro_login("Não deu para abrir o navegador para o login do Google."))
}

#[cfg(not(windows))]
fn abrir_no_navegador(_endereco: &str) -> Result<(), ErroPreludio> {
    Err(erro_login("O login com o Google só funciona no Windows por enquanto."))
}

/// O que um pedido na porta local quer dizer.
#[derive(Debug, PartialEq, Eq)]
enum Retorno {
    /// Não é a resposta deste login (outro programa, favicon, `state` errado): ignorar.
    Outro,
    Autorizado(String),
    Recusado(String),
}

/// Lê o alvo de um `GET` (`/?code=...&state=...`) contra o `state` deste login.
fn ler_retorno(alvo: &str, state_esperado: &str) -> Retorno {
    if !alvo.starts_with('/') {
        return Retorno::Outro;
    }
    let Ok(url) = reqwest::Url::parse(&format!("http://127.0.0.1{alvo}")) else {
        return Retorno::Outro;
    };
    let (mut code, mut state, mut erro) = (None, None, None);
    for (chave, valor) in url.query_pairs() {
        match chave.as_ref() {
            "code" => code = Some(valor.into_owned()),
            "state" => state = Some(valor.into_owned()),
            "error" => erro = Some(valor.into_owned()),
            _ => {}
        }
    }
    if url.path() != "/" || state.as_deref() != Some(state_esperado) {
        return Retorno::Outro;
    }
    match (code, erro) {
        (_, Some(erro)) => Retorno::Recusado(curto(&erro)),
        (Some(code), None) if !code.is_empty() => Retorno::Autorizado(code),
        _ => Retorno::Recusado("sem o código".to_owned()),
    }
}

/// Atende a porta local até chegar a resposta deste login.
async fn esperar_o_retorno(ouvinte: &TcpListener, state: &str) -> Result<String, ErroPreludio> {
    loop {
        let (mut conexao, _) = ouvinte
            .accept()
            .await
            .map_err(|_| erro_login("A porta local do login parou de responder. Tente entrar de novo."))?;
        let Ok(Some(alvo)) = tokio::time::timeout(TEMPO_DA_CONEXAO, ler_alvo(&mut conexao)).await else {
            continue;
        };
        match ler_retorno(&alvo, state) {
            Retorno::Outro => responder(&mut conexao, "404 Not Found", PAGINA_VAZIA).await,
            Retorno::Autorizado(code) => {
                responder(&mut conexao, "200 OK", PAGINA_PRONTA).await;
                return Ok(code);
            }
            Retorno::Recusado(motivo) => {
                responder(&mut conexao, "200 OK", PAGINA_RECUSADA).await;
                return Err(erro_login(format!("O Google não autorizou ({motivo}).")));
            }
        }
    }
}

/// O alvo de um `GET`, lido até o fim do cabeçalho (no máximo 8 KiB).
async fn ler_alvo(conexao: &mut TcpStream) -> Option<String> {
    let mut lido: Vec<u8> = Vec::with_capacity(1024);
    let mut pedaco = [0_u8; 1024];
    while !lido.windows(4).any(|janela| janela == b"\r\n\r\n") {
        let n = conexao.read(&mut pedaco).await.ok()?;
        if n == 0 || lido.len() + n > PEDIDO_LOCAL_MAX {
            return None;
        }
        lido.extend_from_slice(pedaco.get(..n)?);
    }
    let texto = std::str::from_utf8(&lido).ok()?;
    let mut partes = texto.lines().next()?.split(' ');
    if partes.next()? != "GET" {
        return None;
    }
    partes.next().map(str::to_owned)
}

/// Responde e fecha. Falha aqui não muda nada: a resposta do login já foi lida.
async fn responder(conexao: &mut TcpStream, status: &str, corpo: &str) {
    let cabecalho = format!(
        "HTTP/1.1 {status}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\n\
         Cache-Control: no-store\r\nReferrer-Policy: no-referrer\r\nX-Content-Type-Options: nosniff\r\n\
         Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'\r\nConnection: close\r\n\r\n",
        corpo.len()
    );
    let _ = conexao.write_all(cabecalho.as_bytes()).await;
    let _ = conexao.write_all(corpo.as_bytes()).await;
    let _ = conexao.shutdown().await;
}

#[derive(Deserialize)]
struct Identidade {
    email: Option<String>,
}

async fn buscar_email(http: &reqwest::Client, access_token: &str) -> Result<String, ErroPreludio> {
    let mut resposta = http
        .get(URL_DO_EMAIL)
        .bearer_auth(access_token)
        .timeout(TEMPO_CURTO)
        .send()
        .await
        .map_err(|e| rede::erro_de_rede(&e))?;
    let status = resposta.status().as_u16();
    let corpo = rede::ler_limitado(&mut resposta, RESPOSTA_PEQUENA_MAX).await?;
    if !(200..300).contains(&status) {
        return Err(erro_login(format!("O Google não informou o e-mail da conta (HTTP {status}).")));
    }
    serde_json::from_slice::<Identidade>(&corpo)
        .ok()
        .and_then(|identidade| identidade.email)
        .filter(|email| !email.is_empty() && email.len() <= EMAIL_MAX)
        .ok_or_else(|| erro_login("O Google não informou o e-mail da conta."))
}

#[cfg(test)]
mod testes {
    use super::*;

    #[test]
    fn a_porta_local_so_aceita_a_resposta_com_o_state_deste_login() {
        // Qualquer programa do PC pode bater na porta: sem conferir o `state`, um código
        // plantado por outro processo seria trocado por um token da conta do mestre.
        assert_eq!(ler_retorno("/?code=inventado&state=outro", "certo"), Retorno::Outro);
        assert_eq!(ler_retorno("/?code=inventado", "certo"), Retorno::Outro);
        assert_eq!(ler_retorno("/favicon.ico", "certo"), Retorno::Outro);
        assert_eq!(ler_retorno("http://outro/?code=x&state=certo", "certo"), Retorno::Outro);
        assert_eq!(
            ler_retorno("/?code=inventado&state=certo", "certo"),
            Retorno::Autorizado("inventado".to_owned())
        );
    }

    #[test]
    fn a_recusa_do_google_vira_aviso_sem_texto_estranho() {
        assert_eq!(
            ler_retorno("/?error=access_denied%3Cscript%3E&state=certo", "certo"),
            Retorno::Recusado("access_deniedscript".to_owned())
        );
    }
}
