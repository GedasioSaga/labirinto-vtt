use std::collections::HashMap;
use std::future::Future;
use std::net::{IpAddr, SocketAddr};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex, MutexGuard};
use std::time::Duration;

use axum::extract::ws::{CloseFrame, Message, WebSocket, WebSocketUpgrade};
use axum::extract::{ConnectInfo, Path, State};
use axum::http::{header, HeaderMap, HeaderValue, StatusCode};
use axum::response::{IntoResponse, Redirect, Response};
use axum::routing::get;
use axum::Router;
use serde::Serialize;
use serde_json::Value;
use tokio::net::TcpListener;
use tokio::sync::{mpsc, watch, OwnedSemaphorePermit, Semaphore};
use tokio::time::Instant;

/// Tamanho máximo de uma mensagem recebida de um jogador.
pub const MAX_MESSAGE_BYTES: usize = 64 * 1024;
/// Orçamento de mensagens por segundo por conexão (token bucket).
pub const MAX_MESSAGES_PER_SECOND: f64 = 30.0;
/// Jogadores simultâneos (conexões que já passaram por um `join` válido).
pub const MAX_PLAYERS: usize = 16;
/// Conexões abertas que ainda não mandaram `join` (teto global).
pub const MAX_PENDING: usize = 32;
/// Conexões sem `join` por IP: um só aparelho não esgota as vagas pendentes.
pub const MAX_PENDING_PER_IP: usize = 4;
/// Porta preferida; se ocupada, tenta as próximas `PORT_ATTEMPTS - 1`.
pub const DEFAULT_PORT: u16 = 7777;
pub const PORT_ATTEMPTS: u16 = 10;
/// Tempo para o jogador mandar o `join` depois do upgrade.
const JOIN_TIMEOUT: Duration = Duration::from_secs(5);
/// Fila de saída por conexão; cheia = cliente lento, `send` falha.
const OUTBOX_CAPACITY: usize = 256;
/// Medido em unidades UTF-16, igual ao `string.length` do TS (protocol.ts).
const MAX_NAME_UTF16_UNITS: usize = 32;
/// Código de fechamento WebSocket 1008 (policy violation).
const CLOSE_POLICY: u16 = 1008;
/// Página usada quando o asset resolver não tem o build (dev com `devUrl`).
pub const DEV_PLAYER_URL: &str = "http://localhost:1420/player.html";

pub type ClientId = u64;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum PeerEvent {
    Connected,
    Disconnected,
}

/// Destino dos eventos do servidor (no app, o webview do mestre).
pub trait NetSink: Send + Sync + 'static {
    fn on_message(&self, client_id: ClientId, msg: Value);
    fn on_peer(&self, client_id: ClientId, event: PeerEvent, name: Option<&str>);
}

pub struct Asset {
    pub bytes: Vec<u8>,
    pub mime_type: String,
}

/// Resolve um caminho relativo do build do front (ex.: `player.html`).
pub type AssetSource = Arc<dyn Fn(&str) -> Option<Asset> + Send + Sync>;

enum Outgoing {
    Text(String),
    Kick,
}

/// Estado de uma sala aberta. Compartilhado entre rotas e comandos.
pub struct Room {
    code: String,
    sink: Arc<dyn NetSink>,
    assets: AssetSource,
    clients: Mutex<HashMap<ClientId, mpsc::Sender<Outgoing>>>,
    next_id: AtomicU64,
    pending: Arc<Semaphore>,
    pending_by_ip: Arc<Mutex<HashMap<IpAddr, usize>>>,
    players: Arc<Semaphore>,
    shutdown_tx: watch::Sender<bool>,
}

/// Vaga de conexão sem `join`: segura a vaga global e a contagem do IP até o
/// `join` válido (ou o fim da conexão).
struct PendingSlot {
    _permit: OwnedSemaphorePermit,
    ip: IpAddr,
    by_ip: Arc<Mutex<HashMap<IpAddr, usize>>>,
}

impl PendingSlot {
    fn acquire(room: &Room, ip: IpAddr) -> Option<Self> {
        let mut by_ip = lock(&room.pending_by_ip);
        let count = by_ip.entry(ip).or_insert(0);
        if *count >= MAX_PENDING_PER_IP {
            return None;
        }
        let permit = room.pending.clone().try_acquire_owned().ok()?;
        *count += 1;
        Some(Self { _permit: permit, ip, by_ip: room.pending_by_ip.clone() })
    }
}

impl Drop for PendingSlot {
    fn drop(&mut self) {
        let mut by_ip = lock(&self.by_ip);
        if let Some(count) = by_ip.get_mut(&self.ip) {
            *count = count.saturating_sub(1);
            if *count == 0 {
                by_ip.remove(&self.ip);
            }
        }
    }
}

/// Poison só acontece se um panic ocorreu com o lock; os mapas continuam
/// consistentes (operações são inserts/removes atômicos), então seguimos.
fn lock<T>(m: &Mutex<T>) -> MutexGuard<'_, T> {
    m.lock().unwrap_or_else(|e| e.into_inner())
}

#[derive(Debug, PartialEq, Eq)]
pub enum SendError {
    UnknownClient,
    Backlogged,
}

impl Room {
    pub fn new(code: String, sink: Arc<dyn NetSink>, assets: AssetSource) -> Arc<Self> {
        let (shutdown_tx, _) = watch::channel(false);
        Arc::new(Self {
            code,
            sink,
            assets,
            clients: Mutex::new(HashMap::new()),
            next_id: AtomicU64::new(1),
            pending: Arc::new(Semaphore::new(MAX_PENDING)),
            pending_by_ip: Arc::new(Mutex::new(HashMap::new())),
            players: Arc::new(Semaphore::new(MAX_PLAYERS)),
            shutdown_tx,
        })
    }

    pub fn code(&self) -> &str {
        &self.code
    }

    pub fn send(&self, client_id: ClientId, msg: &Value) -> Result<(), SendError> {
        let text = msg.to_string();
        let tx = self.client(client_id).ok_or(SendError::UnknownClient)?;
        tx.try_send(Outgoing::Text(text)).map_err(|_| SendError::Backlogged)
    }

    pub fn kick(&self, client_id: ClientId) -> Result<(), SendError> {
        let tx = self.client(client_id).ok_or(SendError::UnknownClient)?;
        // Kick não pode se perder atrás de uma fila cheia: se não couber, o
        // drop do sender (abaixo) também encerra o loop da conexão.
        let _ = tx.try_send(Outgoing::Kick);
        self.lock_clients().remove(&client_id);
        Ok(())
    }

    /// Encerra o accept loop e todas as conexões.
    pub fn shutdown(&self) {
        let _ = self.shutdown_tx.send(true);
    }

    fn client(&self, client_id: ClientId) -> Option<mpsc::Sender<Outgoing>> {
        self.lock_clients().get(&client_id).cloned()
    }

    fn lock_clients(&self) -> MutexGuard<'_, HashMap<ClientId, mpsc::Sender<Outgoing>>> {
        lock(&self.clients)
    }
}

/// Abre um listener por IP, todos na mesma porta (tenta `first_port` até
/// `first_port + attempts - 1`). Se algum IP falhar numa porta, tenta a próxima.
pub async fn bind_all(ips: &[IpAddr], first_port: u16, attempts: u16) -> std::io::Result<Vec<TcpListener>> {
    let Some((&first, rest)) = ips.split_first() else {
        return Err(std::io::Error::other("nenhum IP para abrir"));
    };
    let mut last_err = None;
    for offset in 0..attempts {
        let Some(port) = first_port.checked_add(offset) else {
            break;
        };
        let head = match TcpListener::bind(SocketAddr::new(first, port)).await {
            Ok(listener) => listener,
            Err(e) => {
                last_err = Some(e);
                continue;
            }
        };
        // Porta 0: as demais seguem a porta que o SO escolheu para o primeiro.
        let port = head.local_addr()?.port();
        let mut listeners = vec![head];
        for &ip in rest {
            match TcpListener::bind(SocketAddr::new(ip, port)).await {
                Ok(listener) => listeners.push(listener),
                Err(e) => {
                    last_err = Some(e);
                    break;
                }
            }
        }
        if listeners.len() == ips.len() {
            return Ok(listeners);
        }
    }
    Err(last_err.unwrap_or_else(|| std::io::Error::other("nenhuma porta disponível")))
}

/// Tenta `ip:first_port` até `ip:first_port + attempts - 1`.
pub async fn bind(ip: IpAddr, first_port: u16, attempts: u16) -> std::io::Result<TcpListener> {
    let mut last_err = None;
    for offset in 0..attempts {
        let Some(port) = first_port.checked_add(offset) else {
            break;
        };
        match TcpListener::bind(SocketAddr::new(ip, port)).await {
            Ok(listener) => return Ok(listener),
            Err(e) => last_err = Some(e),
        }
    }
    Err(last_err.unwrap_or_else(|| std::io::Error::other("nenhuma porta disponível")))
}

pub fn router(room: Arc<Room>) -> Router {
    Router::new()
        .route("/ws", get(ws_handler))
        .route("/player", get(player_page))
        .route("/assets/{*path}", get(asset_file))
        .route("/media/{id}", get(media_stub))
        .with_state(room)
}

/// Future do servidor; termina quando `room.shutdown()` é chamado.
pub fn serve(listener: TcpListener, room: Arc<Room>) -> impl Future<Output = std::io::Result<()>> + Send {
    let mut shutdown_rx = room.shutdown_tx.subscribe();
    let app = router(room);
    async move {
        axum::serve(listener, app.into_make_service_with_connect_info::<SocketAddr>())
            .with_graceful_shutdown(async move {
                let _ = shutdown_rx.wait_for(|stopped| *stopped).await;
            })
            .await
    }
}

async fn ws_handler(
    State(room): State<Arc<Room>>,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    ws: WebSocketUpgrade,
) -> Response {
    if !origin_matches_host(&headers) {
        return StatusCode::FORBIDDEN.into_response();
    }
    let Some(slot) = PendingSlot::acquire(&room, peer.ip()) else {
        return StatusCode::SERVICE_UNAVAILABLE.into_response();
    };
    ws.max_message_size(MAX_MESSAGE_BYTES)
        .max_frame_size(MAX_MESSAGE_BYTES)
        .on_upgrade(move |socket| handle_socket(room, socket, slot))
}

/// Anti-CSWSH e anti-DNS-rebinding: `Origin` precisa apontar para o mesmo
/// `Host` e o `Host` precisa ser um IP literal (ou `localhost`), nunca um nome
/// que um site externo possa fazer resolver para a LAN.
pub fn origin_matches_host(headers: &HeaderMap) -> bool {
    let (Some(origin), Some(host)) = (header_str(headers, header::ORIGIN), header_str(headers, header::HOST)) else {
        return false;
    };
    let Some(origin_authority) = origin.strip_prefix("http://").or_else(|| origin.strip_prefix("https://")) else {
        return false;
    };
    origin_authority.eq_ignore_ascii_case(host) && host_is_literal(host)
}

fn header_str(headers: &HeaderMap, name: header::HeaderName) -> Option<&str> {
    headers.get(name).and_then(|v| v.to_str().ok())
}

fn host_is_literal(host: &str) -> bool {
    if let Ok(addr) = host.parse::<SocketAddr>() {
        return !addr.ip().is_unspecified();
    }
    let name = host.rsplit_once(':').map_or(host, |(name, _)| name);
    name.eq_ignore_ascii_case("localhost") || name.parse::<IpAddr>().is_ok()
}

async fn handle_socket(room: Arc<Room>, mut socket: WebSocket, slot: PendingSlot) {
    let mut shutdown_rx = room.shutdown_tx.subscribe();
    let Some((client_id, name, join_msg)) = await_join(&room, &mut socket).await else {
        return;
    };
    // Só um `join` válido ocupa vaga de jogador; a vaga pendente é liberada aqui.
    let Ok(_player) = room.players.clone().try_acquire_owned() else {
        let _: Option<()> = reject(&mut socket, "room_full").await;
        return;
    };
    drop(slot);
    let (tx, mut rx) = mpsc::channel(OUTBOX_CAPACITY);
    room.lock_clients().insert(client_id, tx);
    room.sink.on_peer(client_id, PeerEvent::Connected, Some(&name));
    room.sink.on_message(client_id, join_msg);

    let mut bucket = TokenBucket::new(MAX_MESSAGES_PER_SECOND);
    loop {
        tokio::select! {
            // O `watch::Ref` não é `Send`; o bloco o descarta antes do próximo await.
            () = async { let _ = shutdown_rx.wait_for(|stopped| *stopped).await; } => {
                let _ = socket.send(close_message("room_closed")).await;
                break;
            }
            outgoing = rx.recv() => match outgoing {
                Some(Outgoing::Text(text)) => {
                    if socket.send(Message::Text(text.into())).await.is_err() {
                        break;
                    }
                }
                // O mestre (TS) já mandou `{"type":"kicked"}`; aqui só o close frame.
                Some(Outgoing::Kick) | None => {
                    let _ = socket.send(close_message("kicked")).await;
                    break;
                }
            },
            incoming = socket.recv() => match incoming {
                Some(Ok(Message::Text(text))) => {
                    if !bucket.try_take() {
                        continue; // excesso descartado; o cliente deve limitar a taxa
                    }
                    match parse_object(text.as_str()) {
                        Some(msg) => room.sink.on_message(client_id, msg),
                        None => {
                            let _ = socket.send(Message::Text(error_json("bad_json").into())).await;
                        }
                    }
                }
                Some(Ok(Message::Binary(_))) => {
                    let _ = socket.send(close_message("binary_not_supported")).await;
                    break;
                }
                Some(Ok(Message::Ping(_) | Message::Pong(_))) => {}
                // Close, erro de protocolo (inclui mensagem > 64 KB) ou fim do stream.
                Some(Ok(Message::Close(_))) | Some(Err(_)) | None => break,
            },
        }
    }

    room.lock_clients().remove(&client_id);
    room.sink.on_peer(client_id, PeerEvent::Disconnected, None);
}

/// Espera a primeira mensagem, que precisa ser `{"type":"join","code","name"}`
/// com o código da sala. Qualquer outra coisa recebe `error` e fecha.
async fn await_join(room: &Room, socket: &mut WebSocket) -> Option<(ClientId, String, Value)> {
    let first = tokio::time::timeout(JOIN_TIMEOUT, socket.recv()).await;
    let text = match first {
        Ok(Some(Ok(Message::Text(text)))) => text,
        Ok(Some(Ok(Message::Close(_)) | Err(_)) | None) => return None,
        Ok(Some(Ok(_))) => return reject(socket, "bad_join").await,
        Err(_) => return reject(socket, "join_timeout").await,
    };
    let Some(msg) = parse_object(text.as_str()) else {
        return reject(socket, "bad_join").await;
    };
    let (Some("join"), Some(code), Some(name)) = (
        msg.get("type").and_then(Value::as_str),
        msg.get("code").and_then(Value::as_str),
        msg.get("name").and_then(Value::as_str),
    ) else {
        return reject(socket, "bad_join").await;
    };
    if !code.trim().eq_ignore_ascii_case(&room.code) {
        return reject(socket, "bad_code").await;
    }
    let Some(name) = sanitize_name(name) else {
        return reject(socket, "bad_name").await;
    };
    let client_id = room.next_id.fetch_add(1, Ordering::Relaxed);
    Some((client_id, name, msg))
}

async fn reject<T>(socket: &mut WebSocket, reason: &str) -> Option<T> {
    let _ = socket.send(Message::Text(error_json(reason).into())).await;
    let _ = socket.send(close_message(reason)).await;
    None
}

pub fn sanitize_name(raw: &str) -> Option<String> {
    let name = raw.trim();
    let units = name.encode_utf16().count();
    if units == 0 || units > MAX_NAME_UTF16_UNITS || name.chars().any(char::is_control) {
        return None;
    }
    Some(name.to_owned())
}

fn parse_object(text: &str) -> Option<Value> {
    serde_json::from_str::<Value>(text).ok().filter(Value::is_object)
}

fn error_json(reason: &str) -> String {
    serde_json::json!({ "type": "error", "reason": reason }).to_string()
}

fn close_message(reason: &str) -> Message {
    Message::Close(Some(CloseFrame { code: CLOSE_POLICY, reason: reason.to_owned().into() }))
}

struct TokenBucket {
    rate: f64,
    tokens: f64,
    last: Instant,
}

impl TokenBucket {
    fn new(rate: f64) -> Self {
        Self { rate, tokens: rate, last: Instant::now() }
    }

    fn try_take(&mut self) -> bool {
        let now = Instant::now();
        let elapsed = now.duration_since(self.last).as_secs_f64();
        self.last = now;
        self.tokens = (self.tokens + elapsed * self.rate).min(self.rate);
        if self.tokens >= 1.0 {
            self.tokens -= 1.0;
            true
        } else {
            false
        }
    }
}

async fn player_page(State(room): State<Arc<Room>>) -> Response {
    match (room.assets)("player.html") {
        Some(asset) => asset_response(asset),
        // Em `tauri dev` com `devUrl`, o resolver só acha o build se `client/dist`
        // existir. Sem ele, manda para o Vite — que só é alcançável na própria
        // máquina do mestre (ver HANDOFF: teste no celular exige `vite build`).
        None => Redirect::temporary(DEV_PLAYER_URL).into_response(),
    }
}

async fn asset_file(State(room): State<Arc<Room>>, Path(path): Path<String>) -> Response {
    if !is_safe_asset_path(&path) {
        return StatusCode::NOT_FOUND.into_response();
    }
    match (room.assets)(&format!("assets/{path}")) {
        Some(asset) => asset_response(asset),
        None => StatusCode::NOT_FOUND.into_response(),
    }
}

/// Só nomes de arquivo do build do Vite: sem `..`, sem barra invertida, sem
/// segmento vazio ou oculto.
pub fn is_safe_asset_path(path: &str) -> bool {
    !path.is_empty()
        && !path.contains('\\')
        && path.split('/').all(|seg| {
            !seg.is_empty() && !seg.starts_with('.') && seg.chars().all(|c| c.is_ascii_alphanumeric() || "-_.".contains(c))
        })
}

async fn media_stub(Path(_id): Path<String>) -> StatusCode {
    StatusCode::NOT_FOUND
}

fn asset_response(asset: Asset) -> Response {
    let mime = HeaderValue::from_str(&asset.mime_type).unwrap_or(HeaderValue::from_static("application/octet-stream"));
    (
        [
            (header::CONTENT_TYPE, mime),
            (header::X_CONTENT_TYPE_OPTIONS, HeaderValue::from_static("nosniff")),
            (header::CACHE_CONTROL, HeaderValue::from_static("no-cache")),
        ],
        asset.bytes,
    )
        .into_response()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn headers(origin: Option<&str>, host: &str) -> HeaderMap {
        let mut h = HeaderMap::new();
        h.insert(header::HOST, HeaderValue::from_str(host).unwrap_or(HeaderValue::from_static("x")));
        if let Some(o) = origin {
            h.insert(header::ORIGIN, HeaderValue::from_str(o).unwrap_or(HeaderValue::from_static("x")));
        }
        h
    }

    #[test]
    fn origin_precisa_bater_com_host_ip() {
        assert!(origin_matches_host(&headers(Some("http://192.168.0.5:7777"), "192.168.0.5:7777")));
        assert!(origin_matches_host(&headers(Some("http://localhost:7777"), "localhost:7777")));
        assert!(!origin_matches_host(&headers(Some("http://evil.com"), "192.168.0.5:7777")));
        assert!(!origin_matches_host(&headers(None, "192.168.0.5:7777")));
        // DNS rebinding: Origin == Host, mas Host é um nome.
        assert!(!origin_matches_host(&headers(Some("http://evil.com:7777"), "evil.com:7777")));
    }

    #[test]
    fn caminho_de_asset_rejeita_traversal() {
        assert!(is_safe_asset_path("player-abc123.js"));
        assert!(!is_safe_asset_path("../secret"));
        assert!(!is_safe_asset_path("a/../../b"));
        assert!(!is_safe_asset_path("..%2fb"));
        assert!(!is_safe_asset_path("a\\b"));
        assert!(!is_safe_asset_path(""));
    }

    #[test]
    fn nome_e_sanitizado() {
        assert_eq!(sanitize_name("  Ana "), Some("Ana".to_owned()));
        assert_eq!(sanitize_name("   "), None);
        assert_eq!(sanitize_name("a\u{0007}b"), None);
        assert_eq!(sanitize_name(&"x".repeat(33)), None);
        // Casa com `string.length` do TS: emoji conta 2, acento conta 1.
        assert!(sanitize_name(&"\u{1F600}".repeat(16)).is_some());
        assert_eq!(sanitize_name(&format!("{}x", "\u{1F600}".repeat(16))), None);
        assert!(sanitize_name(&"é".repeat(32)).is_some());
    }
}
