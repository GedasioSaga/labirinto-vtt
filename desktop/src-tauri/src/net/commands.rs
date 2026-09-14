use std::net::{IpAddr, Ipv4Addr};
use std::sync::Arc;

use qrcode::render::svg;
use qrcode::QrCode;
use rand::Rng;
use serde::Serialize;
use serde_json::Value;
use tauri::{AppHandle, Emitter, Runtime, State};
use tokio::sync::Mutex;

use super::server::{self, Asset, ClientId, NetSink, PeerEvent, Room, SendError};

const CODE_ALPHABET: &[u8] = b"ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LEN: usize = 6;
const QR_MIN_PX: u32 = 200;

/// Sala ativa (no máximo uma). Registrado com `app.manage`.
#[derive(Default)]
pub struct NetState {
    room: Mutex<Option<Arc<Room>>>,
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
    let mut slot = state.room.lock().await;
    if let Some(old) = slot.take() {
        old.shutdown();
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
    *slot = Some(room);

    let urls = player_urls(&private, port);
    let qr_svg = urls.first().map(|url| qr_svg(url)).transpose()?.unwrap_or_default();
    Ok(RoomInfo { code, urls, qr_svg, warning })
}

#[tauri::command]
pub async fn net_stop_room(state: State<'_, NetState>) -> Result<(), String> {
    if let Some(room) = state.room.lock().await.take() {
        room.shutdown();
    }
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
    state.room.lock().await.clone().ok_or_else(|| "nenhuma sala aberta".to_owned())
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
}
