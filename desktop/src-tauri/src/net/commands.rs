use std::net::{IpAddr, Ipv4Addr};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex as StdMutex};
use std::time::Duration;

use qrcode::render::svg;
use qrcode::QrCode;
use rand::Rng;
use serde::Serialize;
use serde_json::Value;
use tauri::{AppHandle, Emitter, Manager, Runtime, State};
use tokio::sync::Mutex;

use super::server::{self, lock, Asset, ClientId, NetSink, PeerEvent, Room, SendError};
use super::tunnel::{self, CloseReason, SharedChild, TunnelEvent, TUNNEL_EVENT};

const CODE_ALPHABET: &[u8] = b"ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LEN: usize = 6;
const QR_MIN_PX: u32 = 200;
const HTTP_CONNECT_TIMEOUT: Duration = Duration::from_secs(15);
const HTTP_READ_TIMEOUT: Duration = Duration::from_secs(30);

/// Sala ativa (no máximo uma) e o túnel público dela. Registrado com `app.manage`.
#[derive(Default)]
pub struct NetState {
    room: Mutex<Option<OpenRoom>>,
    /// Lock síncrono: nunca é segurado através de `await`, e o `RunEvent::Exit`
    /// precisa dele fora do runtime async.
    tunnel: StdMutex<Option<ActiveTunnel>>,
    /// Serializa `net_start_tunnel`; não bloqueia `net_stop_tunnel`.
    tunnel_start: Mutex<()>,
    /// Muda a cada encerramento: um start em andamento que vê outro valor desiste.
    tunnel_generation: AtomicU64,
}

struct OpenRoom {
    room: Arc<Room>,
    port: u16,
}

struct ActiveTunnel {
    child: SharedChild,
    room: Arc<Room>,
    /// `None` enquanto o link ainda não respondeu.
    info: Option<TunnelInfo>,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TunnelInfo {
    url: String,
    qr_svg: String,
}

/// Resultado de `NetState::prepare_start`, já com os locks resolvidos.
enum StartPlan<'a> {
    /// Esta sala já tem link pronto: devolve o mesmo.
    Ready(TunnelInfo),
    /// Subir um túnel novo. `_starting` mantém os starts serializados.
    Launch { _starting: tokio::sync::MutexGuard<'a, ()>, room: Arc<Room>, port: u16, generation: u64 },
}

impl NetState {
    /// Mata o `cloudflared` sem esperar e tira o nome do túnel da sala. Seguro
    /// para chamar em `RunEvent::Exit`. Devolve se havia túnel. Conta como
    /// encerramento: um start em andamento desiste.
    pub fn kill_tunnel_now(&self) -> bool {
        self.remove_tunnel(true)
    }

    /// Como `kill_tunnel_now`, mas sem mudar a geração: limpa sobra sem engolir
    /// um stop que o start atual ainda precisa enxergar.
    fn discard_leftover_tunnel(&self) -> bool {
        self.remove_tunnel(false)
    }

    fn remove_tunnel(&self, bump_generation: bool) -> bool {
        let removed = {
            let mut slot = lock(&self.tunnel);
            if bump_generation {
                self.tunnel_generation.fetch_add(1, Ordering::SeqCst);
            }
            slot.take()
        };
        let Some(active) = removed else {
            return false;
        };
        tunnel::kill_now(&active.child);
        active.room.clear_tunnel_host();
        true
    }

    fn generation(&self) -> u64 {
        self.tunnel_generation.load(Ordering::SeqCst)
    }

    fn ready_tunnel(&self, room: &Arc<Room>) -> Option<TunnelInfo> {
        lock(&self.tunnel).as_ref().filter(|t| Arc::ptr_eq(&t.room, room)).and_then(|t| t.info.clone())
    }

    /// Geração vista na entrada do comando, antes de qualquer espera.
    fn start_ticket(&self) -> u64 {
        self.generation()
    }

    /// Entra na fila de starts e decide o que fazer. `generation` é o
    /// `start_ticket` tirado na entrada do comando: se um stop (ou nova sala)
    /// chegou durante a espera pelos locks, o start desiste sem subir nada.
    async fn prepare_start(&self, generation: u64) -> Result<StartPlan<'_>, StartError> {
        let starting = self.tunnel_start.lock().await;
        let open = {
            let slot = self.room.lock().await;
            slot.as_ref().map(|open| (open.room.clone(), open.port))
        };
        if self.generation() != generation {
            return Err(StartError::Cancelled);
        }
        let (room, port) = open.ok_or_else(|| StartError::Failed("abra a sala antes".to_owned()))?;
        if let Some(info) = self.ready_tunnel(&room) {
            return Ok(StartPlan::Ready(info));
        }
        // Sobra de túnel de outra sala ou de um start que falhou: some antes, sem
        // mexer na geração. Um stop que chegue daqui em diante muda a geração e é
        // visto por `start_tunnel`.
        self.discard_leftover_tunnel();
        Ok(StartPlan::Launch { _starting: starting, room, port, generation })
    }

    /// Chamado pelo vigia quando o processo sai sozinho. Tira o túnel do estado
    /// só se ainda for aquele processo; devolve se tirou.
    fn take_exited_tunnel(&self, watched: &SharedChild) -> bool {
        let removed = {
            let mut slot = lock(&self.tunnel);
            if slot.as_ref().is_some_and(|t| Arc::ptr_eq(&t.child, watched)) {
                slot.take()
            } else {
                None
            }
        };
        let Some(active) = removed else {
            return false;
        };
        active.room.clear_tunnel_host();
        true
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RoomInfo {
    code: String,
    urls: Vec<String>,
    qr_svg: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    warning: Option<String>,
}

/// Payload de `net:message`. `clientId` vai como string decimal: o contrato com
/// o TS é string (u64 não cabe com segurança num `number` do JS).
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MessagePayload {
    client_id: String,
    msg: Value,
}

impl MessagePayload {
    pub fn new(client_id: ClientId, msg: Value) -> Self {
        Self { client_id: client_id.to_string(), msg }
    }
}

/// Payload de `net:peer`; `clientId` também como string decimal.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PeerPayload {
    client_id: String,
    event: PeerEvent,
    #[serde(skip_serializing_if = "Option::is_none")]
    name: Option<String>,
}

impl PeerPayload {
    pub fn new(client_id: ClientId, event: PeerEvent, name: Option<&str>) -> Self {
        Self { client_id: client_id.to_string(), event, name: name.map(str::to_owned) }
    }
}

struct TauriSink<R: Runtime>(AppHandle<R>);

impl<R: Runtime> NetSink for TauriSink<R> {
    fn on_message(&self, client_id: ClientId, msg: Value) {
        let _ = self.0.emit("net:message", MessagePayload::new(client_id, msg));
    }

    fn on_peer(&self, client_id: ClientId, event: PeerEvent, name: Option<&str>) {
        let _ = self.0.emit("net:peer", PeerPayload::new(client_id, event, name));
    }
}

/// Converte o `clientId` string do TS para o id interno. Só aceita a forma
/// decimal canônica (sem sinal, espaço ou zero à esquerda).
pub fn parse_client_id(raw: &str) -> Result<ClientId, String> {
    raw.parse::<ClientId>()
        .ok()
        .filter(|id| id.to_string() == raw)
        .ok_or_else(|| format!("clientId inválido: {raw:?} (esperado inteiro decimal)"))
}

/// Núcleo de `net_send`, sem `State` do Tauri (testável).
pub fn send_to(room: &Room, client_id: &str, msg: &Value) -> Result<(), String> {
    if !msg.is_object() {
        return Err("msg precisa ser um objeto JSON".into());
    }
    let id = parse_client_id(client_id)?;
    room.send(id, msg).map_err(send_error)
}

/// Núcleo de `net_kick`, sem `State` do Tauri (testável).
pub fn kick(room: &Room, client_id: &str) -> Result<(), String> {
    let id = parse_client_id(client_id)?;
    room.kick(id).map_err(send_error)
}

#[tauri::command]
pub async fn net_start_room<R: Runtime>(app: AppHandle<R>, state: State<'_, NetState>) -> Result<RoomInfo, String> {
    close_tunnel_quietly(&app, &state);
    let mut slot = state.room.lock().await;
    if let Some(old) = slot.take() {
        old.room.shutdown();
    }

    // Nunca 0.0.0.0: só as interfaces de LAN privada + loopback do mestre.
    let private = private_ipv4s();
    let warning = private
        .is_empty()
        .then(|| "nenhum IP de rede local encontrado; a sala só está acessível nesta máquina (127.0.0.1)".to_owned());
    let mut bind_ips: Vec<IpAddr> = private.iter().copied().map(IpAddr::V4).collect();
    bind_ips.push(IpAddr::V4(Ipv4Addr::LOCALHOST));
    let listeners = server::bind_all(&bind_ips, server::DEFAULT_PORT, server::PORT_ATTEMPTS)
        .await
        .map_err(|e| format!("não foi possível abrir a porta {}: {e}", server::DEFAULT_PORT))?;
    let port = listeners
        .first()
        .ok_or("nenhum listener aberto")?
        .local_addr()
        .map_err(|e| e.to_string())?
        .port();

    let resolver_app = app.clone();
    let assets: server::AssetSource = Arc::new(move |path: &str| {
        resolver_app
            .asset_resolver()
            .get(path.to_owned())
            .map(|a| Asset { bytes: a.bytes, mime_type: a.mime_type })
    });
    let code = generate_code();
    let room = Room::new(code.clone(), Arc::new(TauriSink(app.clone())), assets);
    for listener in listeners {
        tauri::async_runtime::spawn(server::serve(listener, room.clone()));
    }
    *slot = Some(OpenRoom { room, port });

    let urls = player_urls(&private, port);
    let qr_svg = urls.first().map(|url| qr_svg(url)).transpose()?.unwrap_or_default();
    Ok(RoomInfo { code, urls, qr_svg, warning })
}

#[tauri::command]
pub async fn net_stop_room<R: Runtime>(app: AppHandle<R>, state: State<'_, NetState>) -> Result<(), String> {
    close_tunnel_quietly(&app, &state);
    if let Some(open) = state.room.lock().await.take() {
        open.room.shutdown();
    }
    Ok(())
}

/// Encerra o túnel (se houver ou se um start estiver em andamento) e avisa o
/// front com `closed/stopped`; sem túnel nenhum, não emite nada.
fn close_tunnel_quietly<R: Runtime>(app: &AppHandle<R>, state: &NetState) {
    let starting = state.tunnel_start.try_lock().is_err();
    if state.kill_tunnel_now() || starting {
        emit_tunnel(app, TunnelEvent::Closed { reason: CloseReason::Stopped });
    }
}

fn emit_tunnel<R: Runtime>(app: &AppHandle<R>, event: TunnelEvent) {
    let _ = app.emit(TUNNEL_EVENT, event);
}

#[derive(Debug)]
enum StartError {
    Cancelled,
    Failed(String),
}

/// Torna a sala aberta pública via Quick Tunnel. Se já há túnel pronto para
/// esta sala, devolve o mesmo link.
#[tauri::command]
pub async fn net_start_tunnel<R: Runtime>(app: AppHandle<R>, state: State<'_, NetState>) -> Result<TunnelInfo, String> {
    // Antes de qualquer `await`: um stop que chegue enquanto este start espera
    // na fila precisa ser visto.
    let ticket = state.start_ticket();
    let (_starting, room, port, generation) = match state.prepare_start(ticket).await {
        Ok(StartPlan::Ready(info)) => return Ok(info),
        Ok(StartPlan::Launch { _starting: guard, room, port, generation }) => (guard, room, port, generation),
        Err(StartError::Cancelled) => return Err(tunnel::CANCELLED.to_owned()),
        Err(StartError::Failed(message)) => return Err(message),
    };
    match start_tunnel(&app, &state, room, port, generation).await {
        Ok(info) => Ok(info),
        Err(StartError::Failed(message)) if state.generation() == generation => {
            // O túnel é deste start (a fila está com ele): limpar sem mexer na
            // geração, para não cancelar o próximo start já enfileirado.
            state.discard_leftover_tunnel();
            emit_tunnel(&app, TunnelEvent::Error { message: message.clone() });
            Err(message)
        }
        // Stop (ou nova sala) chegou no meio: quem encerrou já avisou o front.
        Err(StartError::Failed(_) | StartError::Cancelled) => Err(tunnel::CANCELLED.to_owned()),
    }
}

async fn start_tunnel<R: Runtime>(
    app: &AppHandle<R>,
    state: &NetState,
    room: Arc<Room>,
    port: u16,
    generation: u64,
) -> Result<TunnelInfo, StartError> {
    let client = reqwest::Client::builder()
        .connect_timeout(HTTP_CONNECT_TIMEOUT)
        .read_timeout(HTTP_READ_TIMEOUT)
        .build()
        .map_err(|e| StartError::Failed(format!("não foi possível preparar o cliente HTTP: {e}")))?;
    let cancelled = || state.generation() != generation;

    let exe = tunnel::ensure_cloudflared(
        app,
        &client,
        |progress| emit_tunnel(app, TunnelEvent::Downloading { progress }),
        cancelled,
    )
    .await
    .map_err(StartError::Failed)?;
    if cancelled() {
        return Err(StartError::Cancelled);
    }

    emit_tunnel(app, TunnelEvent::Connecting);
    let spawned = tunnel::spawn_tunnel(&exe, port, cancelled).await.map_err(StartError::Failed)?;
    let host = tunnel::tunnel_host(&spawned.url)
        .map(str::to_owned)
        .ok_or_else(|| StartError::Failed(format!("endereço do túnel inválido: {}", spawned.url)))?;
    {
        let mut slot = lock(&state.tunnel);
        if cancelled() {
            tunnel::kill_now(&spawned.child);
            return Err(StartError::Cancelled);
        }
        room.set_tunnel_host(host.clone());
        *slot = Some(ActiveTunnel { child: spawned.child.clone(), room: room.clone(), info: None });
    }
    watch_tunnel(app.clone(), spawned.child.clone());

    let child = spawned.child.clone();
    tunnel::wait_ready(&client, &host, || lock(&child).is_some(), cancelled).await.map_err(StartError::Failed)?;

    let info = TunnelInfo {
        qr_svg: qr_svg(&format!("{}/player", spawned.url)).map_err(StartError::Failed)?,
        url: format!("{}/player", spawned.url),
    };
    {
        let mut slot = lock(&state.tunnel);
        if cancelled() {
            return Err(StartError::Cancelled);
        }
        match slot.as_mut().filter(|t| Arc::ptr_eq(&t.child, &spawned.child)) {
            Some(active) => active.info = Some(info.clone()),
            None => {
                return Err(StartError::Failed(
                    "o cloudflared encerrou antes de o link público ficar pronto".to_owned(),
                ))
            }
        }
    }
    emit_tunnel(app, TunnelEvent::Ready { url: info.url.clone(), qr_svg: info.qr_svg.clone() });
    Ok(info)
}

/// Quando o `cloudflared` cai sozinho: tira o túnel do estado e avisa `exited`.
fn watch_tunnel<R: Runtime>(app: AppHandle<R>, child: SharedChild) {
    let watched = child.clone();
    tunnel::spawn_watcher(child, move || {
        if app.state::<NetState>().take_exited_tunnel(&watched) {
            emit_tunnel(&app, TunnelEvent::Closed { reason: CloseReason::Exited });
        }
    });
}

/// Encerra o link público. Idempotente: sem túnel, só confirma `closed`.
#[tauri::command]
pub async fn net_stop_tunnel<R: Runtime>(app: AppHandle<R>, state: State<'_, NetState>) -> Result<(), String> {
    state.kill_tunnel_now();
    emit_tunnel(&app, TunnelEvent::Closed { reason: CloseReason::Stopped });
    Ok(())
}

#[tauri::command]
pub async fn net_send(state: State<'_, NetState>, client_id: String, msg: Value) -> Result<(), String> {
    let room = active_room(&state).await?;
    send_to(&room, &client_id, &msg)
}

#[tauri::command]
pub async fn net_kick(state: State<'_, NetState>, client_id: String) -> Result<(), String> {
    let room = active_room(&state).await?;
    kick(&room, &client_id)
}

async fn active_room(state: &NetState) -> Result<Arc<Room>, String> {
    state.room.lock().await.as_ref().map(|open| open.room.clone()).ok_or_else(|| "nenhuma sala aberta".to_owned())
}

fn send_error(e: SendError) -> String {
    match e {
        SendError::UnknownClient => "cliente desconhecido".into(),
        SendError::Backlogged => "fila do cliente cheia".into(),
    }
}

pub fn generate_code() -> String {
    let mut rng = rand::rng();
    (0..CODE_LEN)
        .map(|_| char::from(CODE_ALPHABET[rng.random_range(0..CODE_ALPHABET.len())]))
        .collect()
}

/// URLs da página do jogador; sem IP privado, cai no loopback.
fn player_urls(private: &[Ipv4Addr], port: u16) -> Vec<String> {
    if private.is_empty() {
        return vec![format!("http://{}:{port}/player", Ipv4Addr::LOCALHOST)];
    }
    private.iter().map(|ip| format!("http://{ip}:{port}/player")).collect()
}

/// IPv4 privados (RFC 1918) das interfaces da máquina, ordenados e sem repetição.
fn private_ipv4s() -> Vec<Ipv4Addr> {
    let mut ips: Vec<Ipv4Addr> = local_ip_address::list_afinet_netifas()
        .unwrap_or_default()
        .into_iter()
        .filter_map(|(_, ip)| match ip {
            IpAddr::V4(v4) if v4.is_private() => Some(v4),
            _ => None,
        })
        .collect();
    ips.sort();
    ips.dedup();
    ips
}

fn qr_svg(url: &str) -> Result<String, String> {
    let code = QrCode::new(url.as_bytes()).map_err(|e| e.to_string())?;
    Ok(code.render::<svg::Color<'_>>().min_dimensions(QR_MIN_PX, QR_MIN_PX).build())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn codigo_tem_6_chars_do_alfabeto() {
        for _ in 0..200 {
            let code = generate_code();
            assert_eq!(code.len(), CODE_LEN);
            assert!(code.bytes().all(|b| CODE_ALPHABET.contains(&b)));
        }
    }

    #[test]
    fn client_id_so_aceita_decimal_canonico() {
        assert_eq!(parse_client_id("42"), Ok(42));
        assert_eq!(parse_client_id("18446744073709551615"), Ok(u64::MAX));
        for bad in ["", " 42", "+42", "042", "-1", "4.2", "abc", "18446744073709551616"] {
            let res = parse_client_id(bad);
            assert!(res.as_ref().is_err_and(|e| e.contains("clientId inválido")), "{bad}: {res:?}");
        }
    }

    #[test]
    fn urls_caem_no_loopback_sem_ip_privado() {
        assert_eq!(player_urls(&[], 7777), vec!["http://127.0.0.1:7777/player".to_owned()]);
        let lan = [Ipv4Addr::new(192, 168, 0, 5)];
        assert_eq!(player_urls(&lan, 7778), vec!["http://192.168.0.5:7778/player".to_owned()]);
    }

    #[test]
    fn qr_gera_svg() {
        let svg = qr_svg("http://192.168.0.5:7777/player");
        assert!(svg.is_ok_and(|s| s.contains("<svg")));
    }

    use std::sync::atomic::AtomicUsize;

    const TUNNEL: &str = "calm-river-42.trycloudflare.com";

    struct NullSink;

    impl NetSink for NullSink {
        fn on_message(&self, _client_id: ClientId, _msg: Value) {}
        fn on_peer(&self, _client_id: ClientId, _event: PeerEvent, _name: Option<&str>) {}
    }

    fn test_room() -> Arc<Room> {
        let assets: server::AssetSource = Arc::new(|_: &str| None);
        Room::new("ABC234".to_owned(), Arc::new(NullSink), assets)
    }

    async fn state_with_room() -> (Arc<NetState>, Arc<Room>) {
        let state = Arc::new(NetState::default());
        let room = test_room();
        *state.room.lock().await = Some(OpenRoom { room: room.clone(), port: 7777 });
        (state, room)
    }

    /// Túnel falso: `ping` no lugar do `cloudflared` e a sala com nome público.
    #[cfg(windows)]
    fn fake_tunnel(state: &NetState, room: &Arc<Room>, count: &str) -> Result<(SharedChild, u32), String> {
        let (child, pid) = tunnel::tests::spawn_ping(count, std::process::Stdio::null())?;
        let shared: SharedChild = Arc::new(StdMutex::new(Some(child)));
        room.set_tunnel_host(TUNNEL.to_owned());
        *lock(&state.tunnel) = Some(ActiveTunnel { child: shared.clone(), room: room.clone(), info: None });
        Ok((shared, pid))
    }

    /// `prepare_start` em outra task; `Ok(true)` = o plano era subir túnel.
    fn spawn_prepare(state: Arc<NetState>, ticket: u64) -> tokio::task::JoinHandle<Result<bool, StartError>> {
        tokio::spawn(async move {
            let launched = state.prepare_start(ticket).await.map(|plan| matches!(plan, StartPlan::Launch { .. }));
            launched
        })
    }

    #[tokio::test]
    async fn stop_enquanto_start_espera_a_fila_cancela_o_start() -> Result<(), String> {
        let (state, _room) = state_with_room().await;
        let other_start = state.tunnel_start.lock().await;
        let ticket = state.start_ticket();
        let queued = spawn_prepare(state.clone(), ticket);
        tokio::task::yield_now().await;
        state.kill_tunnel_now();
        drop(other_start);
        let outcome = queued.await.map_err(|e| e.to_string())?;
        assert!(matches!(outcome, Err(StartError::Cancelled)), "stop perdido na fila do start: {outcome:?}");
        Ok(())
    }

    #[tokio::test]
    async fn stop_enquanto_start_espera_a_sala_cancela_o_start() -> Result<(), String> {
        let (state, _room) = state_with_room().await;
        let room_busy = state.room.lock().await;
        let ticket = state.start_ticket();
        let queued = spawn_prepare(state.clone(), ticket);
        tokio::task::yield_now().await;
        state.kill_tunnel_now();
        drop(room_busy);
        let outcome = queued.await.map_err(|e| e.to_string())?;
        assert!(matches!(outcome, Err(StartError::Cancelled)), "stop perdido no lock da sala: {outcome:?}");
        Ok(())
    }

    #[cfg(windows)]
    #[tokio::test]
    async fn sobra_de_tunel_some_sem_cancelar_o_proprio_start() -> Result<(), String> {
        let (state, room) = state_with_room().await;
        let old_room = test_room();
        let (leftover, pid) = fake_tunnel(&state, &old_room, "30")?;
        let ticket = state.start_ticket();
        let generation = match state.prepare_start(ticket).await {
            Ok(StartPlan::Launch { room: planned, generation, .. }) => {
                assert!(Arc::ptr_eq(&planned, &room));
                generation
            }
            other => return Err(format!("esperava Launch, veio erro {:?}", other.err())),
        };
        assert_eq!(generation, ticket, "limpar a sobra mudou a geração do próprio start");
        assert_eq!(state.generation(), ticket);
        assert_eq!(old_room.tunnel_host(), None);
        assert!(lock(&state.tunnel).is_none());
        assert!(lock(&leftover).is_none());
        tunnel::tests::wait_process_gone(pid).await
    }

    #[cfg(windows)]
    #[tokio::test]
    async fn kill_tunnel_now_tira_o_host_soma_geracao_e_mata_o_filho() -> Result<(), String> {
        let (state, room) = state_with_room().await;
        let (child, pid) = fake_tunnel(&state, &room, "30")?;
        let exits = Arc::new(AtomicUsize::new(0));
        let counter = exits.clone();
        tunnel::spawn_watcher(child, move || {
            counter.fetch_add(1, Ordering::SeqCst);
        });
        let before = state.generation();
        assert!(state.kill_tunnel_now());
        assert_eq!(room.tunnel_host(), None, "sala continua aceitando o nome público");
        assert_eq!(state.generation(), before + 1);
        assert!(lock(&state.tunnel).is_none());
        tunnel::tests::wait_process_gone(pid).await?;
        // Sem túnel: devolve false, mas ainda conta como encerramento.
        assert!(!state.kill_tunnel_now());
        assert_eq!(state.generation(), before + 2);
        // Processo recolhido pelo stop: o vigia termina sem avisar saída.
        tokio::time::sleep(Duration::from_millis(1500)).await;
        assert_eq!(exits.load(Ordering::SeqCst), 0);
        Ok(())
    }

    #[cfg(windows)]
    #[tokio::test]
    async fn vigia_tira_o_tunel_quando_o_processo_sai_sozinho() -> Result<(), String> {
        let (state, room) = state_with_room().await;
        let (child, _pid) = fake_tunnel(&state, &room, "1")?;
        let exits = Arc::new(AtomicUsize::new(0));
        let removed = Arc::new(AtomicUsize::new(0));
        let (watch_state, watched, exit_count, removed_count) =
            (state.clone(), child.clone(), exits.clone(), removed.clone());
        tunnel::spawn_watcher(child.clone(), move || {
            exit_count.fetch_add(1, Ordering::SeqCst);
            if watch_state.take_exited_tunnel(&watched) {
                removed_count.fetch_add(1, Ordering::SeqCst);
            }
        });
        let deadline = std::time::Instant::now() + Duration::from_secs(10);
        while exits.load(Ordering::SeqCst) == 0 {
            if std::time::Instant::now() > deadline {
                return Err("vigia não percebeu a saída do processo".to_owned());
            }
            tokio::time::sleep(Duration::from_millis(50)).await;
        }
        tokio::time::sleep(Duration::from_millis(1500)).await;
        assert_eq!(exits.load(Ordering::SeqCst), 1);
        assert_eq!(removed.load(Ordering::SeqCst), 1);
        assert!(lock(&state.tunnel).is_none());
        assert_eq!(room.tunnel_host(), None);

        // Aviso atrasado do processo antigo não derruba o túnel novo.
        let (_fresh, pid) = fake_tunnel(&state, &room, "30")?;
        assert!(!state.take_exited_tunnel(&child));
        assert_eq!(room.tunnel_host().as_deref(), Some(TUNNEL));
        assert!(state.kill_tunnel_now());
        tunnel::tests::wait_process_gone(pid).await
    }
}
