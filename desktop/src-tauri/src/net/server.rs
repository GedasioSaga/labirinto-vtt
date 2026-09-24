use std::collections::HashMap;
use std::future::Future;
use std::net::{IpAddr, Ipv6Addr, SocketAddr};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex, MutexGuard, OnceLock};
use std::time::{Duration, Instant as StdInstant};

use axum::extract::ws::{CloseFrame, Message, WebSocket, WebSocketUpgrade};
use axum::extract::{ConnectInfo, Path, State};
use axum::http::{header, HeaderMap, HeaderValue, StatusCode};
use axum::http::{Method, Uri};
use axum::response::{IntoResponse, Response};
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
/// Raiz do Vite em `tauri dev` (o mesmo `devUrl` de `tauri.conf.json`).
pub const DEV_ORIGIN: &str = "http://localhost:1420";
/// Variável que troca a raiz do Vite: a porta muda por árvore de trabalho
/// (`client/porta.js`) e o teste precisa apontar para um Vite de mentira.
pub const DEV_URL_ENV: &str = "LAB_DEV_URL";
/// Página do jogador dentro do Vite.
pub const DEV_PLAYER_PATH: &str = "/player.html";
/// Resposta quando o Vite não está no ar e o build também não foi embutido.
const DEV_OFFLINE: &str = "A página do jogador não está disponível: rode o app com `npm run tauri:dev` (Vite no ar) ou gere o build com `npm run build`.";
/// Joins com código errado, por IP efetivo, antes de bloquear.
pub const MAX_BAD_CODES: u32 = 5;
/// Duração do bloqueio e janela em que as falhas se acumulam.
pub const BAD_CODE_BLOCK: Duration = Duration::from_secs(60);
/// Cabeçalho em que a Cloudflare manda o IP real do visitante.
const CF_CONNECTING_IP: &str = "cf-connecting-ip";

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
    /// Nome público do Quick Tunnel ativo (ex.: `abc-def.trycloudflare.com`).
    tunnel_host: Mutex<Option<String>>,
    bad_codes: Mutex<BadCodeLimiter>,
}

/// Conta joins com código errado por IP. `MAX_BAD_CODES` falhas dentro de
/// `BAD_CODE_BLOCK` bloqueiam o IP por `BAD_CODE_BLOCK`. O tempo entra por
/// parâmetro para os testes não dependerem de relógio.
#[derive(Debug, Default)]
pub struct BadCodeLimiter {
    entries: HashMap<IpAddr, BadCodeEntry>,
}

#[derive(Debug)]
struct BadCodeEntry {
    failures: u32,
    last_failure: StdInstant,
    blocked_until: Option<StdInstant>,
}

impl BadCodeEntry {
    fn expired(&self, now: StdInstant) -> bool {
        let block_over = self.blocked_until.is_none_or(|until| until <= now);
        block_over && now.saturating_duration_since(self.last_failure) >= BAD_CODE_BLOCK
    }
}

impl BadCodeLimiter {
    pub fn is_blocked(&self, ip: IpAddr, now: StdInstant) -> bool {
        self.entries.get(&ip).and_then(|e| e.blocked_until).is_some_and(|until| until > now)
    }

    pub fn record_failure(&mut self, ip: IpAddr, now: StdInstant) {
        // Limpa quem já não conta nem está bloqueado: o mapa só guarda IPs que
        // erraram no último minuto.
        self.entries.retain(|_, e| !e.expired(now));
        let entry =
            self.entries.entry(ip).or_insert(BadCodeEntry { failures: 0, last_failure: now, blocked_until: None });
        if entry.blocked_until.is_some_and(|until| until <= now) {
            entry.blocked_until = None;
            entry.failures = 0;
        }
        entry.failures = entry.failures.saturating_add(1); // contador que para no teto
        entry.last_failure = now;
        if entry.failures >= MAX_BAD_CODES {
            entry.blocked_until = Some(now + BAD_CODE_BLOCK);
            entry.failures = 0;
        }
    }

    pub fn tracked_ips(&self) -> usize {
        self.entries.len()
    }
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
pub(crate) fn lock<T>(m: &Mutex<T>) -> MutexGuard<'_, T> {
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
            tunnel_host: Mutex::new(None),
            bad_codes: Mutex::new(BadCodeLimiter::default()),
        })
    }

    pub fn code(&self) -> &str {
        &self.code
    }

    /// Passa a aceitar conexões vindas do túnel com este nome público.
    pub fn set_tunnel_host(&self, host: String) {
        *lock(&self.tunnel_host) = Some(host);
    }

    pub fn clear_tunnel_host(&self) {
        *lock(&self.tunnel_host) = None;
    }

    pub fn tunnel_host(&self) -> Option<String> {
        lock(&self.tunnel_host).clone()
    }

    fn is_blocked(&self, ip: IpAddr) -> bool {
        lock(&self.bad_codes).is_blocked(ip, StdInstant::now())
    }

    fn record_bad_code(&self, ip: IpAddr) {
        lock(&self.bad_codes).record_failure(ip, StdInstant::now());
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
        .fallback(dev_fallback)
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
    let tunnel_host = room.tunnel_host();
    if !origin_allowed(&headers, peer, tunnel_host.as_deref()) {
        return StatusCode::FORBIDDEN.into_response();
    }
    let ip = limit_key(effective_client_ip(peer, &headers, tunnel_host.as_deref()));
    if room.is_blocked(ip) {
        return StatusCode::TOO_MANY_REQUESTS.into_response();
    }
    let Some(slot) = PendingSlot::acquire(&room, ip) else {
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

/// Regra do LAN (`origin_matches_host`) ou, com túnel ativo, conexão que o
/// `cloudflared` repassa pelo loopback com `Host` e `Origin` do nome público.
/// O nome é aleatório e só existe enquanto o túnel vive; um site de terceiros
/// não o controla, então a proteção contra DNS rebinding continua valendo.
pub fn origin_allowed(headers: &HeaderMap, peer: SocketAddr, tunnel_host: Option<&str>) -> bool {
    if origin_matches_host(headers) {
        return true;
    }
    let (Some(tunnel), Some(origin)) = (tunnel_host, header_str(headers, header::ORIGIN)) else {
        return false;
    };
    let origin_ok = origin.strip_prefix("https://").is_some_and(|authority| authority.eq_ignore_ascii_case(tunnel));
    peer.ip().is_loopback() && host_is_tunnel(headers, tunnel) && origin_ok
}

/// IP usado para limites por aparelho. Só confia em `Cf-Connecting-Ip` quando a
/// conexão veio do `cloudflared` (loopback) com o `Host` do túnel; de qualquer
/// outro lugar o cabeçalho é forjável e é ignorado.
pub fn effective_client_ip(peer: SocketAddr, headers: &HeaderMap, tunnel_host: Option<&str>) -> IpAddr {
    let via_tunnel = peer.ip().is_loopback() && tunnel_host.is_some_and(|tunnel| host_is_tunnel(headers, tunnel));
    if !via_tunnel {
        return peer.ip();
    }
    headers
        .get(CF_CONNECTING_IP)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.trim().parse::<IpAddr>().ok())
        .unwrap_or_else(|| peer.ip())
}

/// Chave dos limites por aparelho (código errado e pendentes). IPv4 como veio;
/// IPv6 pelo prefixo /64, porque um provedor entrega o /64 inteiro a um cliente
/// e trocar de endereço dentro dele é de graça. IPv4-mapeado vira o IPv4.
pub fn limit_key(ip: IpAddr) -> IpAddr {
    match ip {
        IpAddr::V4(_) => ip,
        IpAddr::V6(v6) => match v6.to_ipv4_mapped() {
            Some(v4) => IpAddr::V4(v4),
            None => {
                let [a, b, c, d, ..] = v6.segments();
                IpAddr::V6(Ipv6Addr::new(a, b, c, d, 0, 0, 0, 0))
            }
        },
    }
}

fn host_is_tunnel(headers: &HeaderMap, tunnel: &str) -> bool {
    header_str(headers, header::HOST).is_some_and(|host| host_without_port(host).eq_ignore_ascii_case(tunnel))
}

/// `nome:443` vira `nome`; sem sufixo numérico, devolve como veio.
fn host_without_port(host: &str) -> &str {
    match host.rsplit_once(':') {
        Some((name, port)) if !port.is_empty() && port.bytes().all(|b| b.is_ascii_digit()) => name,
        _ => host,
    }
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
    let Some((client_id, name, join_msg)) = await_join(&room, &mut socket, slot.ip).await else {
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
async fn await_join(room: &Room, socket: &mut WebSocket, ip: IpAddr) -> Option<(ClientId, String, Value)> {
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
        // Conta antes de responder: quando o cliente vê o erro, o bloqueio já vale.
        room.record_bad_code(ip);
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
        // existia na hora de compilar. Sem ele, a página vem do Vite — mas
        // SERVIDA por esta sala, nunca por redirecionamento.
        //
        // Redirecionar para `localhost:1420` mudava a origem da página: o
        // `location.host` do jogador virava o do Vite, o `socketUrl()` apontava
        // para `ws://localhost:1420/ws`, e o Vite aceita o TCP e nunca responde
        // ao upgrade. O socket ficava pendurado para sempre — sem `open`, sem
        // `close` — e a tela do jogador acusava "A sala X não respondeu" depois
        // de 8 segundos, culpando a sala por um erro que era de endereço.
        // Também quebrava o celular, que não resolve `localhost` do mestre.
        None => dev_proxy(DEV_PLAYER_PATH).await,
    }
}

/// Raiz do Vite a usar agora: `LAB_DEV_URL` quando existe, senão `DEV_ORIGIN`.
/// Lido a cada chamada, não guardado: o teste troca a raiz entre casos, e o
/// custo de uma leitura de ambiente some ao lado de uma ida ao Vite.
///
/// Só loopback. O conteúdo buscado aqui é servido NA ORIGEM DA SALA, a mesma de
/// `/ws`: uma raiz apontada para fora da máquina daria a um terceiro um script
/// rodando com a origem da sala.
fn dev_origin() -> String {
    std::env::var(DEV_URL_ENV).ok().filter(|raiz| dev_origin_loopback(raiz)).unwrap_or_else(|| DEV_ORIGIN.to_owned())
}

fn dev_origin_loopback(raiz: &str) -> bool {
    let Some(autoridade) = raiz.strip_prefix("http://") else {
        return false;
    };
    let host = host_without_port(autoridade).trim_start_matches('[').trim_end_matches(']');
    host.eq_ignore_ascii_case("localhost") || host.parse::<IpAddr>().is_ok_and(|ip| ip.is_loopback())
}

/// Cliente reaproveitado do proxy de desenvolvimento. `no_proxy`: o Vite é
/// loopback e um proxy de sistema configurado na máquina não pode entrar no
/// meio.
fn dev_client() -> Option<&'static reqwest::Client> {
    static CLIENT: OnceLock<Option<reqwest::Client>> = OnceLock::new();
    CLIENT
        .get_or_init(|| {
            reqwest::Client::builder()
                .no_proxy()
                // Prazo obrigatório: `reqwest` não põe nenhum sozinho, e outro
                // processo na porta do Vite que aceite o TCP sem responder
                // deixaria `/player` pendurado — o MESMO modo de falha que esta
                // mudança existe para matar.
                .connect_timeout(Duration::from_secs(2))
                .timeout(Duration::from_secs(10))
                .build()
                .ok()
        })
        .as_ref()
}

/// Busca `path` no Vite e devolve como se a sala tivesse servido — mesma
/// origem, então `/ws` existe e o teste de `Origin` passa. Só em build de
/// desenvolvimento; em release o front está embutido e caminho desconhecido é
/// 404 como antes.
async fn dev_proxy(path: &str) -> Response {
    if !cfg!(debug_assertions) {
        return StatusCode::NOT_FOUND.into_response();
    }
    let Some(client) = dev_client() else {
        return (StatusCode::BAD_GATEWAY, DEV_OFFLINE).into_response();
    };
    let Ok(upstream) = client.get(format!("{}{path}", dev_origin())).send().await else {
        return (StatusCode::BAD_GATEWAY, DEV_OFFLINE).into_response();
    };
    let status = StatusCode::from_u16(upstream.status().as_u16()).unwrap_or(StatusCode::BAD_GATEWAY);
    let mime = upstream
        .headers()
        .get(header::CONTENT_TYPE.as_str())
        .and_then(|value| value.to_str().ok())
        .and_then(|value| HeaderValue::from_str(value).ok())
        .unwrap_or(HeaderValue::from_static("application/octet-stream"));
    let Ok(bytes) = upstream.bytes().await else {
        return (StatusCode::BAD_GATEWAY, DEV_OFFLINE).into_response();
    };
    (
        status,
        [
            (header::CONTENT_TYPE, mime),
            // Mesmo `nosniff` de `asset_response`: o tipo vem do Vite, e o
            // navegador não pode adivinhar outro em cima dele.
            (header::X_CONTENT_TYPE_OPTIONS, HeaderValue::from_static("nosniff")),
            (header::CACHE_CONTROL, HeaderValue::from_static("no-cache")),
        ],
        bytes,
    )
        .into_response()
}

/// O que o proxy de dev aceita buscar. O Vite serve o projeto INTEIRO na porta
/// dele, e a porta dele é loopback; este proxy é a LAN. Sem esta lista, abrir
/// a sala em `tauri dev` daria a qualquer pessoa da rede leitura do repositório
/// do mestre por `/@fs/<caminho absoluto>`. A lista é só o que a página do
/// jogador pede de verdade.
const DEV_PREFIXOS: [&str; 7] = ["/player.html", "/src/", "/node_modules/", "/@vite/", "/@react-refresh", "/@id/", "/favicon."];

/// `/@fs/<caminho absoluto>` é a porta do Vite para o disco inteiro, e o
/// próprio cliente dele precisa de uma: `@vite/client` importa
/// `/@fs/<projeto>/node_modules/vite/dist/client/env.mjs`. Só essa passa —
/// dependência instalada, código público, dentro do projeto.
///
/// Pelo túnel a régua é mais curta: só o `env.mjs` que o `@vite/client` pede
/// de verdade. Pela LAN (já confiada, é a rede do mestre) qualquer dependência
/// instalada passa, porque é lá que o resto do bundler pede módulo por módulo.
fn dev_fs_permitido(path: &str, pelo_tunel: bool) -> bool {
    if !path.starts_with("/@fs/") {
        return false;
    }
    if pelo_tunel {
        path.ends_with("/node_modules/vite/dist/client/env.mjs")
    } else {
        path.contains("/node_modules/")
    }
}

/// Decide pelo CAMINHO, nunca pela linha inteira da requisição.
///
/// Duas armadilhas, as duas medidas contra o Vite real numa revisão de
/// segurança desta mudança, as duas respondendo 200 com arquivo do repositório
/// antes deste conserto:
///
/// 1. `?` — julgar `path_and_query` deixava a QUERY satisfazer a regra:
///    `/@fs/<projeto>/HANDOFF.md?x=/node_modules/` contém `/node_modules/` sem
///    que o arquivo pedido tenha nada a ver com isso.
/// 2. `%` — `Uri` não decodifica nada, então `..` escrito como `%2e%2e`
///    atravessava intacto: `/src/%2e%2e/porta.js` saía do que a página precisa.
///    Nenhum caminho que a página do jogador pede traz `%`, então o sinal de
///    porcentagem é recusado inteiro em vez de decodificado — regra que não tem
///    como errar a decodificação.
fn dev_path_permitido(path: &str, pelo_tunel: bool) -> bool {
    if path.contains("..") || path.contains('\\') || path.contains('%') {
        return false;
    }
    dev_fs_permitido(path, pelo_tunel) || DEV_PREFIXOS.iter().any(|prefixo| path.starts_with(prefixo))
}

/// `/player` já atravessa o túnel (`player_page`, sem checar `Host`): a página
/// do Vite chega, mas antes desta função TODO módulo que ela pede
/// (`/src/player/main.tsx`, `/@vite/client`, ...) levava 404 aqui — o splash
/// "Abrindo a mesa" nunca saía da tela porque o módulo que o remove nunca
/// rodava. A regra agora é "Host literal (LAN/localhost) OU o túnel ativo",
/// não "Host literal E NÃO o túnel": o túnel também precisa da lista de
/// caminhos, só que mais curta (`dev_fs_permitido` acima).
fn dev_fallback_permitido(headers: &HeaderMap, tunnel_host: Option<&str>, path: &str) -> bool {
    let host_literal = header_str(headers, header::HOST).is_some_and(host_is_literal);
    let pelo_tunel = tunnel_host.is_some_and(|tunnel| host_is_tunnel(headers, tunnel));
    if !host_literal && !pelo_tunel {
        return false;
    }
    dev_path_permitido(path, pelo_tunel)
}

/// Caminho que nenhuma rota atendeu. Em dev, a página do jogador vinda do Vite
/// pede `/src/...`, `/@vite/client` e `/@react-refresh`: tudo isso passa por
/// aqui. Em release, 404.
async fn dev_fallback(State(room): State<Arc<Room>>, method: Method, headers: HeaderMap, uri: Uri) -> Response {
    // Só leitura: o Vite de dev não tem nada que a sala precise escrever.
    if method != Method::GET && method != Method::HEAD {
        return StatusCode::METHOD_NOT_ALLOWED.into_response();
    }
    // O túnel público aponta para ESTA porta (`net/tunnel.rs`). Sem este freio,
    // "Tornar pública" em `tauri dev` levaria o projeto do mestre para a
    // internet junto com a sala. Fora do túnel, exigir `Host` literal é a mesma
    // defesa contra DNS rebinding que `/ws` já tem.
    if !dev_fallback_permitido(&headers, room.tunnel_host().as_deref(), uri.path()) {
        return StatusCode::NOT_FOUND.into_response();
    }
    // A query segue para o Vite (`?v=`, `?t=` são o cache dele), mas NÃO decide
    // nada: quem decide é o caminho, conferido acima.
    let alvo = uri.path_and_query().map_or_else(|| uri.path().to_owned(), |pq| pq.as_str().to_owned());
    dev_proxy(&alvo).await
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

    const TUNNEL: &str = "calm-river-42.trycloudflare.com";

    fn loopback() -> SocketAddr {
        SocketAddr::from(([127, 0, 0, 1], 50_000))
    }

    fn lan_peer() -> SocketAddr {
        SocketAddr::from(([192, 168, 0, 9], 50_000))
    }

    fn with_cf_ip(mut h: HeaderMap, ip: &str) -> HeaderMap {
        h.insert(CF_CONNECTING_IP, HeaderValue::from_str(ip).unwrap_or(HeaderValue::from_static("x")));
        h
    }

    /// O que a `player.html` do Vite pede ao abrir (medido no Vite real: o
    /// `@vite/client` importa o `env.mjs` por `/@fs/`).
    const MODULOS_DA_PAGINA: [&str; 6] = [
        "/src/player/main.tsx",
        "/@vite/client",
        "/@react-refresh",
        "/node_modules/.vite-1420/deps/react.js",
        "/@fs/C:/dev/labirinto/node_modules/vite/dist/client/env.mjs",
        "/favicon.svg",
    ];

    /// Jornada vermelha do "link público fica carregando para sempre": em
    /// `tauri dev` o `/player` atravessava o túnel, mas cada módulo que a página
    /// pede levava 404 e o splash "Abrindo a mesa" nunca saía da tela.
    #[test]
    fn link_publico_em_dev_recebe_os_modulos_da_pagina() {
        let tunel = headers(None, TUNNEL);
        for caminho in MODULOS_DA_PAGINA {
            assert!(dev_fallback_permitido(&tunel, Some(TUNNEL), caminho), "pelo túnel, {caminho} levou 404 e a página do jogador não monta");
        }
        let com_porta = headers(None, "Calm-River-42.trycloudflare.com:443");
        assert!(dev_fallback_permitido(&com_porta, Some(TUNNEL), "/src/player/main.tsx"));
    }

    #[test]
    fn link_publico_em_dev_nao_abre_o_disco_do_mestre() {
        let tunel = headers(None, TUNNEL);
        let ataques = [
            "/@fs/C:/Windows/win.ini",
            "/@fs/C:/dev/labirinto/HANDOFF.md",
            // Pela LAN passa (dependência instalada); pela internet, só o
            // arquivo que o cliente do Vite importa.
            "/@fs/C:/dev/labirinto/node_modules/pixi.js/package.json",
            "/@fs/C:/dev/labirinto/node_modules/vite/dist/client/client.mjs",
            "/@fs/C:/dev/labirinto/node_modules/vite/dist/client/env.mjs/../../../../../HANDOFF.md",
            "/@fs/C:/dev/labirinto/node_modules/vite/dist/client/env.mjs%2f..",
            "/package.json",
            "/.env",
            "/",
            "/src/../package.json",
            "/src/%2e%2e/package.json",
        ];
        for caminho in ataques {
            assert!(!dev_fallback_permitido(&tunel, Some(TUNNEL), caminho), "pelo túnel, o proxy de dev aceitou {caminho}");
        }
        // Nome que não é o túnel ativo: DNS rebinding, continua 404.
        let outro = headers(None, "evil-1.trycloudflare.com");
        assert!(!dev_fallback_permitido(&outro, Some(TUNNEL), "/src/player/main.tsx"));
        assert!(!dev_fallback_permitido(&tunel, None, "/src/player/main.tsx"));
    }

    #[test]
    fn lan_em_dev_segue_com_a_lista_de_antes() {
        for tunel in [None, Some(TUNNEL)] {
            let lan = headers(None, "192.168.0.5:7777");
            for caminho in MODULOS_DA_PAGINA {
                assert!(dev_fallback_permitido(&lan, tunel, caminho), "pela LAN, {caminho} passou a levar 404");
            }
            assert!(dev_fallback_permitido(&lan, tunel, "/@fs/C:/dev/labirinto/node_modules/pixi.js/package.json"));
            assert!(!dev_fallback_permitido(&lan, tunel, "/@fs/C:/Windows/win.ini"));
            assert!(!dev_fallback_permitido(&lan, tunel, "/package.json"));
        }
    }

    #[test]
    fn origin_do_tunel_exige_loopback_e_nome_ativo() {
        let tunnel = headers(Some("https://calm-river-42.trycloudflare.com"), TUNNEL);
        assert!(origin_allowed(&tunnel, loopback(), Some(TUNNEL)));
        // Host com porta e maiúsculas continuam sendo o mesmo nome.
        let upper = headers(Some("https://CALM-river-42.trycloudflare.com"), "Calm-River-42.trycloudflare.com:443");
        assert!(origin_allowed(&upper, loopback(), Some(TUNNEL)));
        // Peer fora do loopback: alguém na LAN forjando o Host.
        assert!(!origin_allowed(&tunnel, lan_peer(), Some(TUNNEL)));
        // Sem túnel ativo.
        assert!(!origin_allowed(&tunnel, loopback(), None));
        // Outro nome, mesmo que também seja do trycloudflare.
        let other = headers(Some("https://evil-1.trycloudflare.com"), "evil-1.trycloudflare.com");
        assert!(!origin_allowed(&other, loopback(), Some(TUNNEL)));
        // Host certo, Origin de outro site ou sem https.
        assert!(!origin_allowed(&headers(Some("https://evil.com"), TUNNEL), loopback(), Some(TUNNEL)));
        assert!(!origin_allowed(&headers(Some("http://calm-river-42.trycloudflare.com"), TUNNEL), loopback(), Some(TUNNEL)));
        assert!(!origin_allowed(&headers(None, TUNNEL), loopback(), Some(TUNNEL)));
        // LAN continua como antes, com ou sem túnel.
        let lan = headers(Some("http://192.168.0.5:7777"), "192.168.0.5:7777");
        assert!(origin_allowed(&lan, lan_peer(), Some(TUNNEL)));
        assert!(origin_allowed(&lan, lan_peer(), None));
    }

    #[test]
    fn ip_efetivo_so_confia_no_cloudflare_via_tunel() {
        let real: IpAddr = "203.0.113.7".parse().unwrap_or(IpAddr::from([0, 0, 0, 0]));
        let tunnel = with_cf_ip(headers(Some("https://calm-river-42.trycloudflare.com"), TUNNEL), "203.0.113.7");
        assert_eq!(effective_client_ip(loopback(), &tunnel, Some(TUNNEL)), real);
        // Peer da LAN mandando o cabeçalho: ignorado.
        assert_eq!(effective_client_ip(lan_peer(), &tunnel, Some(TUNNEL)), lan_peer().ip());
        // Loopback com Host diferente do túnel: ignorado.
        let lan_host = with_cf_ip(headers(Some("http://127.0.0.1:7777"), "127.0.0.1:7777"), "203.0.113.7");
        assert_eq!(effective_client_ip(loopback(), &lan_host, Some(TUNNEL)), loopback().ip());
        // Sem túnel ativo: ignorado.
        assert_eq!(effective_client_ip(loopback(), &tunnel, None), loopback().ip());
        // Valor inválido ou ausente: cai no IP do socket.
        let junk = with_cf_ip(headers(None, TUNNEL), "not-an-ip");
        assert_eq!(effective_client_ip(loopback(), &junk, Some(TUNNEL)), loopback().ip());
        assert_eq!(effective_client_ip(loopback(), &headers(None, TUNNEL), Some(TUNNEL)), loopback().ip());
    }

    fn ip(raw: &str) -> IpAddr {
        raw.parse().unwrap_or(IpAddr::from([0, 0, 0, 0]))
    }

    #[test]
    fn chave_de_limite_agrupa_ipv6_por_64() {
        // IPv4 fica como está.
        assert_eq!(limit_key(ip("203.0.113.7")), ip("203.0.113.7"));
        assert_ne!(limit_key(ip("203.0.113.7")), limit_key(ip("203.0.113.8")));
        // IPv6: mesmo /64 vira a mesma chave, com os 4 segmentos baixos zerados.
        assert_eq!(limit_key(ip("2001:db8:1:2:aaaa:bbbb:cccc:dddd")), ip("2001:db8:1:2::"));
        assert_eq!(limit_key(ip("2001:db8:1:2::1")), limit_key(ip("2001:db8:1:2:ffff:ffff:ffff:ffff")));
        // /64 vizinho é outra chave.
        assert_ne!(limit_key(ip("2001:db8:1:2::1")), limit_key(ip("2001:db8:1:3::1")));
        // IPv4-mapeado vira o IPv4 (não o /64 ::ffff:0:0, que juntaria todo mundo).
        assert_eq!(limit_key(ip("::ffff:203.0.113.9")), ip("203.0.113.9"));
        assert_ne!(limit_key(ip("::ffff:203.0.113.9")), limit_key(ip("::ffff:203.0.113.10")));
        // Bordas: não especificado e loopback continuam distinguíveis.
        assert_eq!(limit_key(ip("::")), ip("::"));
        assert_eq!(limit_key(ip("::1")), ip("::"));
        assert_eq!(limit_key(ip("127.0.0.1")), ip("127.0.0.1"));
    }

    #[test]
    fn limitador_bloqueia_na_quinta_falha_e_expira() {
        let ip = IpAddr::from([10, 0, 0, 1]);
        let other = IpAddr::from([10, 0, 0, 2]);
        let t0 = StdInstant::now();
        let mut limiter = BadCodeLimiter::default();
        for i in 0..(MAX_BAD_CODES - 1) {
            limiter.record_failure(ip, t0 + Duration::from_secs(u64::from(i)));
            assert!(!limiter.is_blocked(ip, t0 + Duration::from_secs(u64::from(i))));
        }
        let t5 = t0 + Duration::from_secs(10);
        limiter.record_failure(ip, t5);
        assert!(limiter.is_blocked(ip, t5));
        assert!(!limiter.is_blocked(other, t5));
        assert!(limiter.is_blocked(ip, t5 + BAD_CODE_BLOCK - Duration::from_millis(1)));
        assert!(!limiter.is_blocked(ip, t5 + BAD_CODE_BLOCK));

        // Falhas espaçadas além da janela não acumulam.
        let mut spaced = BadCodeLimiter::default();
        for i in 0..(MAX_BAD_CODES * 2) {
            let at = t0 + (BAD_CODE_BLOCK + Duration::from_secs(1)) * i;
            spaced.record_failure(ip, at);
            assert!(!spaced.is_blocked(ip, at));
        }

        // Entradas vencidas são removidas na próxima falha registrada.
        let later = t5 + BAD_CODE_BLOCK * 3;
        limiter.record_failure(other, later);
        assert_eq!(limiter.tracked_ips(), 1);
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
