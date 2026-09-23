//! Sala pública via Cloudflare Quick Tunnel.
//!
//! Baixa um `cloudflared` de versão e hash fixos, sobe
//! `cloudflared tunnel --url http://127.0.0.1:PORT`, lê o endereço público do
//! stderr e espera o link responder. A costura com o estado do app fica em
//! `commands`; aqui só as peças (funções puras testáveis + processo).

use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use serde::Serialize;
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Manager, Runtime};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, ChildStderr, Command};
use tokio::sync::oneshot;
use tokio::time::Instant;

use super::server::lock;

pub const CLOUDFLARED_VERSION: &str = "2026.9.1";
pub const CLOUDFLARED_URL: &str =
    "https://github.com/cloudflare/cloudflared/releases/download/2026.9.1/cloudflared-windows-amd64.exe";
pub const CLOUDFLARED_SIZE: u64 = 54_976_432;
pub const CLOUDFLARED_SHA256: &str = "2837888cc0f5d58f15b6dc478376de90b4d3ba5241c7947455d1e0a0df429712";
/// Nome do evento Tauri com o estado do túnel.
pub const TUNNEL_EVENT: &str = "net:tunnel";

const HOST_SUFFIX: &str = ".trycloudflare.com";
/// Rótulo usado pela API do quick tunnel (aparece em mensagens de erro).
const API_LABEL: &str = "api";
const URL_TIMEOUT: Duration = Duration::from_secs(30);
const READY_TIMEOUT: Duration = Duration::from_secs(30);
const READY_INTERVAL: Duration = Duration::from_secs(1);
const READY_REQUEST_TIMEOUT: Duration = Duration::from_secs(5);
const WATCH_INTERVAL: Duration = Duration::from_millis(500);
/// Com que frequência as esperas longas conferem se o link foi encerrado.
const CANCEL_POLL: Duration = Duration::from_millis(100);
pub const CANCELLED: &str = "o link público foi encerrado";
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

/// Payload de `net:tunnel`.
#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(tag = "state", rename_all = "camelCase")]
pub enum TunnelEvent {
    Downloading {
        progress: f64,
    },
    Connecting,
    Ready {
        url: String,
        #[serde(rename = "qrSvg")]
        qr_svg: String,
    },
    Closed {
        reason: CloseReason,
    },
    Error {
        message: String,
    },
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum CloseReason {
    Stopped,
    Exited,
}

/// Processo do `cloudflared` compartilhado entre comandos e vigia. `None`
/// significa que alguém já o encerrou ou recolheu.
pub type SharedChild = Arc<Mutex<Option<Child>>>;

/// Acha `https://<rótulo>.trycloudflare.com` numa linha do stderr. O rótulo é
/// `[a-z0-9-]+` e o nome precisa terminar exatamente no sufixo (nada de
/// `x.trycloudflare.com.evil.io`). Devolve em minúsculas.
pub fn parse_quick_tunnel_url(line: &str) -> Option<String> {
    const SCHEME: &str = "https://";
    // `to_ascii_lowercase` preserva os índices de byte, então os cortes abaixo
    // continuam em fronteira de char.
    let lower = line.to_ascii_lowercase();
    let mut rest = lower.as_str();
    while let Some(pos) = rest.find(SCHEME) {
        let after = rest.get(pos + SCHEME.len()..)?;
        let label_len = after.bytes().take_while(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || *b == b'-').count();
        let (label, tail) = after.split_at(label_len);
        if let Some(end) = tail.strip_prefix(HOST_SUFFIX) {
            let boundary_ok =
                end.bytes().next().is_none_or(|b| !(b.is_ascii_alphanumeric() || b == b'.' || b == b'-' || b == b'/'));
            if !label.is_empty() && label != API_LABEL && boundary_ok {
                return Some(format!("{SCHEME}{label}{HOST_SUFFIX}"));
            }
        }
        rest = after;
    }
    None
}

/// Nome do host de uma URL devolvida por `parse_quick_tunnel_url`.
pub fn tunnel_host(url: &str) -> Option<&str> {
    url.strip_prefix("https://").filter(|h| !h.is_empty())
}

pub fn sha256_hex(bytes: &[u8]) -> String {
    to_hex(&Sha256::digest(bytes))
}

pub fn file_sha256(path: &Path) -> std::io::Result<String> {
    let mut file = std::fs::File::open(path)?;
    let mut hasher = Sha256::new();
    std::io::copy(&mut file, &mut hasher)?;
    Ok(to_hex(&hasher.finalize()))
}

/// Compara um hash calculado com o esperado (hex, sem diferenciar caixa).
pub fn check_sha256(actual_hex: &str, expected_hex: &str) -> Result<(), String> {
    if actual_hex.eq_ignore_ascii_case(expected_hex) {
        Ok(())
    } else {
        Err(format!(
            "o cloudflared baixado não confere com o SHA-256 esperado (esperado {expected_hex}, veio {actual_hex}); o arquivo foi descartado"
        ))
    }
}

pub fn verify_sha256(bytes: &[u8], expected_hex: &str) -> Result<(), String> {
    check_sha256(&sha256_hex(bytes), expected_hex)
}

fn to_hex(digest: &[u8]) -> String {
    use std::fmt::Write;
    digest.iter().fold(String::with_capacity(digest.len() * 2), |mut out, b| {
        let _ = write!(out, "{b:02x}");
        out
    })
}

/// Fração 0..=1 a partir de um percentual inteiro.
fn percent_fraction(percent: u64) -> f64 {
    f64::from(u32::try_from(percent.min(100)).unwrap_or(100)) / 100.0
}

/// Garante o `cloudflared` verificado em `app_local_data_dir()/bin`. Se já existe
/// com o hash certo, reaproveita; senão baixa para `.part`, confere tamanho e
/// SHA-256 e só então renomeia.
pub async fn ensure_cloudflared<R: Runtime>(
    app: &AppHandle<R>,
    client: &reqwest::Client,
    mut emit_progress: impl FnMut(f64) + Send,
    is_cancelled: impl Fn() -> bool + Send + Sync,
) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_local_data_dir()
        .map_err(|e| format!("pasta de dados do app indisponível: {e}"))?
        .join("bin");
    let exe = dir.join(format!("cloudflared-{CLOUDFLARED_VERSION}.exe"));
    if is_valid_binary(&exe).await {
        return Ok(exe);
    }
    tokio::fs::create_dir_all(&dir).await.map_err(|e| format!("não foi possível criar {}: {e}", dir.display()))?;
    let part = exe.with_extension("exe.part");
    if let Err(e) = download_to(client, &part, &mut emit_progress, &is_cancelled).await {
        let _ = tokio::fs::remove_file(&part).await;
        return Err(e);
    }
    // Binário antigo com hash errado: o rename no Windows não sobrescreve.
    let _ = tokio::fs::remove_file(&exe).await;
    if let Err(e) = tokio::fs::rename(&part, &exe).await {
        let _ = tokio::fs::remove_file(&part).await;
        return Err(format!("não foi possível instalar o cloudflared: {e}"));
    }
    Ok(exe)
}

async fn is_valid_binary(exe: &Path) -> bool {
    let Ok(meta) = tokio::fs::metadata(exe).await else {
        return false;
    };
    if meta.len() != CLOUDFLARED_SIZE {
        return false;
    }
    let path = exe.to_owned();
    match tauri::async_runtime::spawn_blocking(move || file_sha256(&path)).await {
        Ok(Ok(hex)) => check_sha256(&hex, CLOUDFLARED_SHA256).is_ok(),
        _ => false,
    }
}

async fn download_to(
    client: &reqwest::Client,
    part: &Path,
    emit_progress: &mut (impl FnMut(f64) + Send),
    is_cancelled: &(impl Fn() -> bool + Sync),
) -> Result<(), String> {
    let mut resp =
        client.get(CLOUDFLARED_URL).send().await.map_err(|e| format!("falha ao baixar o cloudflared: {e}"))?;
    if !resp.status().is_success() {
        return Err(format!("falha ao baixar o cloudflared: HTTP {}", resp.status()));
    }
    if let Some(len) = resp.content_length().filter(|len| *len != CLOUDFLARED_SIZE) {
        return Err(format!("tamanho inesperado do cloudflared: {len} bytes (esperado {CLOUDFLARED_SIZE})"));
    }
    let mut file = tokio::fs::File::create(part).await.map_err(|e| format!("não foi possível gravar o download: {e}"))?;
    let mut hasher = Sha256::new();
    let mut received: u64 = 0;
    let mut last_percent: u64 = 0;
    emit_progress(0.0);
    while let Some(chunk) = resp.chunk().await.map_err(|e| format!("download do cloudflared interrompido: {e}"))? {
        if is_cancelled() {
            return Err(CANCELLED.to_owned());
        }
        let len = u64::try_from(chunk.len()).map_err(|_| "bloco de download grande demais".to_owned())?;
        received = received
            .checked_add(len)
            .filter(|total| *total <= CLOUDFLARED_SIZE)
            .ok_or_else(|| format!("o download passou de {CLOUDFLARED_SIZE} bytes; arquivo descartado"))?;
        hasher.update(&chunk);
        file.write_all(&chunk).await.map_err(|e| format!("não foi possível gravar o download: {e}"))?;
        // `received <= CLOUDFLARED_SIZE` (~5,5e7), então `* 100` cabe folgado em u64.
        let percent = received * 100 / CLOUDFLARED_SIZE;
        if percent > last_percent {
            last_percent = percent;
            emit_progress(percent_fraction(percent));
        }
    }
    file.flush().await.map_err(|e| format!("não foi possível gravar o download: {e}"))?;
    file.sync_all().await.map_err(|e| format!("não foi possível gravar o download: {e}"))?;
    drop(file);
    if received != CLOUDFLARED_SIZE {
        return Err(format!("download incompleto do cloudflared: {received} de {CLOUDFLARED_SIZE} bytes"));
    }
    check_sha256(&to_hex(&hasher.finalize()), CLOUDFLARED_SHA256)
}

/// Túnel recém-criado: processo vivo e URL pública.
pub struct SpawnedTunnel {
    pub child: SharedChild,
    pub url: String,
}

/// Sobe `cloudflared tunnel` apontando para a porta local e espera a URL no
/// stderr (até 30 s). O stderr continua sendo drenado depois, senão o pipe
/// enche e o processo trava. `is_cancelled` interrompe a espera e mata o processo.
pub async fn spawn_tunnel(
    exe: &Path,
    port: u16,
    is_cancelled: impl Fn() -> bool + Send + Sync,
) -> Result<SpawnedTunnel, String> {
    let mut cmd = Command::new(exe);
    cmd.args(["tunnel", "--no-autoupdate", "--url", &format!("http://127.0.0.1:{port}")])
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .kill_on_drop(true);
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);
    let child = cmd.spawn().map_err(|e| format!("não foi possível iniciar o cloudflared: {e}"))?;
    await_tunnel_url(child, URL_TIMEOUT, is_cancelled).await
}

/// Espera a URL no stderr de um processo já iniciado.
async fn await_tunnel_url(
    mut child: Child,
    timeout: Duration,
    is_cancelled: impl Fn() -> bool + Send + Sync,
) -> Result<SpawnedTunnel, String> {
    let Some(stderr) = child.stderr.take() else {
        let _ = child.start_kill();
        return Err("stderr do cloudflared indisponível".to_owned());
    };
    let (url_tx, url_rx) = oneshot::channel();
    tauri::async_runtime::spawn(drain_stderr(stderr, url_tx));
    let waited = tokio::select! {
        waited = tokio::time::timeout(timeout, url_rx) => waited,
        () = until_cancelled(&is_cancelled) => {
            let _ = child.start_kill();
            return Err(CANCELLED.to_owned());
        }
    };
    match waited {
        Ok(Ok(url)) => Ok(SpawnedTunnel { child: Arc::new(Mutex::new(Some(child))), url }),
        Ok(Err(_)) => {
            let _ = child.start_kill();
            Err("o cloudflared encerrou antes de criar o link público".to_owned())
        }
        Err(_) => {
            let _ = child.start_kill();
            Err("o cloudflared não criou o link público em 30 s".to_owned())
        }
    }
}

/// Termina quando `is_cancelled` ficar verdadeiro (checado a cada `CANCEL_POLL`).
async fn until_cancelled(is_cancelled: &impl Fn() -> bool) {
    while !is_cancelled() {
        tokio::time::sleep(CANCEL_POLL).await;
    }
}

/// Lê o stderr até o fim; a primeira URL válida vai pelo canal.
async fn drain_stderr(stderr: ChildStderr, url_tx: oneshot::Sender<String>) {
    let mut reader = BufReader::new(stderr);
    let mut url_tx = Some(url_tx);
    let mut line = Vec::new();
    loop {
        line.clear();
        match reader.read_until(b'\n', &mut line).await {
            Ok(0) | Err(_) => break,
            Ok(_) => {}
        }
        if url_tx.is_none() {
            continue;
        }
        if let Some(url) = parse_quick_tunnel_url(&String::from_utf8_lossy(&line)) {
            if let Some(sender) = url_tx.take() {
                let _ = sender.send(url);
            }
        }
    }
}

/// Espera `https://host/player` responder 2xx (a cada 1 s, até 30 s).
/// `is_alive` interrompe a espera se o processo cair; `is_cancelled`, se o link
/// foi encerrado.
pub async fn wait_ready(
    client: &reqwest::Client,
    host: &str,
    is_alive: impl Fn() -> bool,
    is_cancelled: impl Fn() -> bool,
) -> Result<(), String> {
    wait_ready_at(client, &format!("https://{host}/player"), is_alive, is_cancelled).await
}

async fn wait_ready_at(
    client: &reqwest::Client,
    target: &str,
    is_alive: impl Fn() -> bool,
    is_cancelled: impl Fn() -> bool,
) -> Result<(), String> {
    let deadline = Instant::now() + READY_TIMEOUT;
    loop {
        if is_cancelled() {
            return Err(CANCELLED.to_owned());
        }
        if !is_alive() {
            return Err("o cloudflared encerrou antes de o link público ficar pronto".to_owned());
        }
        let attempt = tokio::select! {
            attempt = client.get(target).timeout(READY_REQUEST_TIMEOUT).send() => attempt,
            () = until_cancelled(&is_cancelled) => return Err(CANCELLED.to_owned()),
        };
        if attempt.is_ok_and(|resp| resp.status().is_success()) {
            return Ok(());
        }
        if Instant::now() + READY_INTERVAL > deadline {
            return Err("o link público não respondeu em 30 s".to_owned());
        }
        tokio::select! {
            () = tokio::time::sleep(READY_INTERVAL) => {}
            () = until_cancelled(&is_cancelled) => return Err(CANCELLED.to_owned()),
        }
    }
}

/// Vigia: se o processo terminar sozinho, recolhe e chama `on_exit`. Se alguém
/// recolher o processo antes (stop), termina em silêncio.
pub fn spawn_watcher(child: SharedChild, on_exit: impl FnOnce() + Send + 'static) {
    tauri::async_runtime::spawn(async move {
        loop {
            tokio::time::sleep(WATCH_INTERVAL).await;
            let exited = {
                let mut slot = lock(&child);
                match slot.as_mut().map(Child::try_wait) {
                    None => return,
                    Some(Ok(None)) => false,
                    Some(Ok(Some(_)) | Err(_)) => {
                        slot.take();
                        true
                    }
                }
            };
            if exited {
                break;
            }
        }
        on_exit();
    });
}

/// Encerra sem esperar (seguro em `RunEvent::Exit`).
pub fn kill_now(child: &SharedChild) {
    if let Some(mut process) = lock(child).take() {
        let _ = process.start_kill();
    }
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;

    #[test]
    fn url_sai_da_linha_real_do_stderr() {
        let banner = "2026-09-14T12:00:01Z INF |  https://calm-river-42-abc.trycloudflare.com                                            |";
        assert_eq!(parse_quick_tunnel_url(banner).as_deref(), Some("https://calm-river-42-abc.trycloudflare.com"));
        let caixa = "2026-09-14T12:00:01Z INF +--------------------------------------------------------------------------------------------+";
        assert_eq!(parse_quick_tunnel_url(caixa), None);
        let aviso = "2026-09-14T12:00:01Z INF |  Your quick Tunnel has been created! Visit it at (it may take some time to be reachable):  |";
        assert_eq!(parse_quick_tunnel_url(aviso), None);
        assert_eq!(parse_quick_tunnel_url(""), None);
    }

    #[test]
    fn url_rejeita_dominio_falso_e_api() {
        assert_eq!(parse_quick_tunnel_url("|  https://x.trycloudflare.com.evil.io  |"), None);
        assert_eq!(parse_quick_tunnel_url("https://x.trycloudflare.community"), None);
        assert_eq!(parse_quick_tunnel_url("https://a.b.trycloudflare.com"), None);
        assert_eq!(parse_quick_tunnel_url("https://.trycloudflare.com"), None);
        assert_eq!(parse_quick_tunnel_url("https://x_y.trycloudflare.com"), None);
        assert_eq!(
            parse_quick_tunnel_url(r#"ERR failed to request quick Tunnel: Post "https://api.trycloudflare.com/tunnel""#),
            None
        );
        // Um falso antes, o verdadeiro depois na mesma linha.
        assert_eq!(
            parse_quick_tunnel_url("https://x.trycloudflare.com.evil.io https://ok-1.trycloudflare.com").as_deref(),
            Some("https://ok-1.trycloudflare.com")
        );
    }

    #[test]
    fn url_em_maiusculas_vira_minusculas() {
        assert_eq!(
            parse_quick_tunnel_url("|  HTTPS://Calm-River-42.TryCloudflare.com  |").as_deref(),
            Some("https://calm-river-42.trycloudflare.com")
        );
        // Caractere não ASCII perto não quebra os cortes.
        assert_eq!(parse_quick_tunnel_url("é https://ok.trycloudflare.com ç").as_deref(), Some("https://ok.trycloudflare.com"));
        assert_eq!(tunnel_host("https://ok.trycloudflare.com"), Some("ok.trycloudflare.com"));
        assert_eq!(tunnel_host("https://"), None);
    }

    #[test]
    fn sha256_confere_e_rejeita() {
        // SHA-256 de "abc" (FIPS 180-2).
        const ABC: &str = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
        assert!(verify_sha256(b"abc", ABC).is_ok());
        assert!(verify_sha256(b"abc", &ABC.to_ascii_uppercase()).is_ok());
        let err = verify_sha256(b"abd", ABC);
        assert!(err.as_ref().is_err_and(|e| e.contains("SHA-256")), "{err:?}");
        assert!(verify_sha256(b"", ABC).is_err());
        assert!(verify_sha256(b"abc", "").is_err());

        let path = std::env::temp_dir().join(format!("labirinto-sha-{}.bin", std::process::id()));
        assert!(std::fs::write(&path, b"abc").is_ok());
        let hex = file_sha256(&path);
        let _ = std::fs::remove_file(&path);
        assert_eq!(hex.ok().as_deref(), Some(ABC));
        assert!(file_sha256(&path).is_err());
    }

    #[test]
    fn progresso_fica_entre_0_e_1() {
        assert!((percent_fraction(0) - 0.0).abs() < f64::EPSILON);
        assert!((percent_fraction(43) - 0.43).abs() < 1e-9);
        assert!((percent_fraction(100) - 1.0).abs() < f64::EPSILON);
        assert!((percent_fraction(u64::MAX) - 1.0).abs() < f64::EPSILON);
    }

    /// Processo inofensivo que fica vivo ~30 s (`ping` sai sozinho; o teste o mata antes).
    #[cfg(windows)]
    pub(crate) fn spawn_ping(count: &str, stderr: Stdio) -> Result<(Child, u32), String> {
        let child = Command::new("ping")
            .args(["-n", count, "127.0.0.1"])
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(stderr)
            .kill_on_drop(true)
            .spawn()
            .map_err(|e| format!("ping não subiu: {e}"))?;
        let pid = child.id().ok_or("ping sem pid")?;
        Ok((child, pid))
    }

    /// `tasklist` em CSV: o pid aparece entre aspas só se o processo existe.
    #[cfg(windows)]
    pub(crate) async fn wait_process_gone(pid: u32) -> Result<(), String> {
        let deadline = Instant::now() + Duration::from_secs(5);
        loop {
            let out = std::process::Command::new("tasklist")
                .args(["/FI", &format!("PID eq {pid}"), "/NH", "/FO", "CSV"])
                .output()
                .map_err(|e| format!("tasklist falhou: {e}"))?;
            if !String::from_utf8_lossy(&out.stdout).contains(&format!("\"{pid}\"")) {
                return Ok(());
            }
            if Instant::now() > deadline {
                return Err(format!("processo {pid} continua vivo"));
            }
            tokio::time::sleep(Duration::from_millis(100)).await;
        }
    }

    #[cfg(windows)]
    #[tokio::test]
    async fn stop_durante_a_espera_da_url_mata_o_processo() -> Result<(), String> {
        use std::sync::atomic::{AtomicBool, Ordering};
        // Processo vivo, com stderr aberto e sem nunca imprimir URL.
        let (child, pid) = spawn_ping("30", Stdio::piped())?;
        let stopped = Arc::new(AtomicBool::new(false));
        let flag = stopped.clone();
        tokio::spawn(async move {
            tokio::time::sleep(Duration::from_millis(300)).await;
            flag.store(true, Ordering::SeqCst);
        });
        let started = Instant::now();
        let waited =
            tokio::time::timeout(Duration::from_secs(5), await_tunnel_url(child, URL_TIMEOUT, || stopped.load(Ordering::SeqCst)))
                .await;
        let outcome = waited.map_err(|_| format!("stop ignorado: ainda esperando a URL após {:?}", started.elapsed()))?;
        assert_eq!(outcome.err().as_deref(), Some(CANCELLED));
        wait_process_gone(pid).await
    }

    #[tokio::test]
    async fn stop_durante_wait_ready_desiste_sem_esperar_a_requisicao() -> Result<(), String> {
        use std::sync::atomic::{AtomicBool, Ordering};
        // Servidor que aceita e nunca responde: cada tentativa prende até 5 s.
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.map_err(|e| e.to_string())?;
        let addr = listener.local_addr().map_err(|e| e.to_string())?;
        tokio::spawn(async move {
            let mut held = Vec::new();
            while let Ok((sock, _)) = listener.accept().await {
                held.push(sock);
            }
        });
        let client = reqwest::Client::builder().build().map_err(|e| e.to_string())?;
        let stopped = Arc::new(AtomicBool::new(false));
        let flag = stopped.clone();
        tokio::spawn(async move {
            tokio::time::sleep(Duration::from_millis(300)).await;
            flag.store(true, Ordering::SeqCst);
        });
        let target = format!("http://{addr}/player");
        let waited = tokio::time::timeout(
            Duration::from_secs(3),
            wait_ready_at(&client, &target, || true, || stopped.load(Ordering::SeqCst)),
        )
        .await;
        let outcome = waited.map_err(|_| "stop ignorado: wait_ready continuou esperando".to_owned())?;
        assert_eq!(outcome.err().as_deref(), Some(CANCELLED));
        Ok(())
    }

    #[cfg(windows)]
    #[tokio::test]
    async fn vigia_dispara_uma_vez_quando_o_processo_sai() -> Result<(), String> {
        use std::sync::atomic::{AtomicUsize, Ordering};
        let (child, _pid) = spawn_ping("1", Stdio::null())?;
        let shared: SharedChild = Arc::new(Mutex::new(Some(child)));
        let calls = Arc::new(AtomicUsize::new(0));
        let counter = calls.clone();
        spawn_watcher(shared.clone(), move || {
            counter.fetch_add(1, Ordering::SeqCst);
        });
        let deadline = Instant::now() + Duration::from_secs(10);
        while calls.load(Ordering::SeqCst) == 0 {
            if Instant::now() > deadline {
                return Err("vigia não percebeu a saída".to_owned());
            }
            tokio::time::sleep(Duration::from_millis(50)).await;
        }
        tokio::time::sleep(WATCH_INTERVAL * 3).await;
        assert_eq!(calls.load(Ordering::SeqCst), 1);
        assert!(lock(&shared).is_none(), "vigia não recolheu o processo");
        Ok(())
    }

    #[test]
    fn payload_do_evento() {
        let ready = TunnelEvent::Ready { url: "https://a.trycloudflare.com".into(), qr_svg: "<svg/>".into() };
        assert_eq!(
            serde_json::to_value(ready).ok(),
            Some(serde_json::json!({"state":"ready","url":"https://a.trycloudflare.com","qrSvg":"<svg/>"}))
        );
        assert_eq!(
            serde_json::to_value(TunnelEvent::Downloading { progress: 0.5 }).ok(),
            Some(serde_json::json!({"state":"downloading","progress":0.5}))
        );
        assert_eq!(serde_json::to_value(TunnelEvent::Connecting).ok(), Some(serde_json::json!({"state":"connecting"})));
        assert_eq!(
            serde_json::to_value(TunnelEvent::Closed { reason: CloseReason::Exited }).ok(),
            Some(serde_json::json!({"state":"closed","reason":"exited"}))
        );
        assert_eq!(
            serde_json::to_value(TunnelEvent::Error { message: "x".into() }).ok(),
            Some(serde_json::json!({"state":"error","message":"x"}))
        );
    }
}
