#![allow(clippy::unwrap_used, clippy::expect_used)]

use std::net::{IpAddr, Ipv4Addr, SocketAddr};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use futures_util::{SinkExt, StreamExt};
use labirinto_lib::net::commands;
use labirinto_lib::net::server::{self, Asset, AssetSource, ClientId, NetSink, PeerEvent, Room};
use serde_json::{json, Value};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpSocket, TcpStream};
use tokio_tungstenite::tungstenite::client::IntoClientRequest;
use tokio_tungstenite::tungstenite::http::HeaderValue;
use tokio_tungstenite::tungstenite::Message;
use tokio_tungstenite::{MaybeTlsStream, WebSocketStream};

const CODE: &str = "ABC234";
const WAIT: Duration = Duration::from_secs(5);

#[derive(Default)]
struct RecordingSink {
    messages: Mutex<Vec<(ClientId, Value)>>,
    peers: Mutex<Vec<(ClientId, PeerEvent, Option<String>)>>,
}

impl NetSink for RecordingSink {
    fn on_message(&self, client_id: ClientId, msg: Value) {
        self.messages.lock().unwrap().push((client_id, msg));
    }
    fn on_peer(&self, client_id: ClientId, event: PeerEvent, name: Option<&str>) {
        self.peers.lock().unwrap().push((client_id, event, name.map(str::to_owned)));
    }
}

async fn start_server() -> (SocketAddr, Arc<Room>, Arc<RecordingSink>) {
    let sink = Arc::new(RecordingSink::default());
    let assets: AssetSource = Arc::new(|path: &str| {
        (path == "player.html").then(|| Asset { bytes: b"<html>player</html>".to_vec(), mime_type: "text/html".into() })
    });
    let room = Room::new(CODE.to_owned(), sink.clone(), assets);
    // Porta 0: o SO escolhe, evita colisão com um app real na 7777.
    let listener = server::bind(IpAddr::V4(Ipv4Addr::LOCALHOST), 0, 1).await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(server::serve(listener, room.clone()));
    (addr, room, sink)
}

type Ws = WebSocketStream<MaybeTlsStream<TcpStream>>;

async fn connect(addr: SocketAddr, origin: &str) -> Result<Ws, tokio_tungstenite::tungstenite::Error> {
    let mut req = format!("ws://{addr}/ws").into_client_request().unwrap();
    req.headers_mut().insert("Origin", HeaderValue::from_str(origin).unwrap());
    tokio_tungstenite::connect_async(req).await.map(|(ws, _)| ws)
}

async fn next_text(ws: &mut Ws) -> Option<String> {
    loop {
        match tokio::time::timeout(WAIT, ws.next()).await.expect("timeout esperando mensagem") {
            Some(Ok(Message::Text(t))) => return Some(t.to_string()),
            Some(Ok(Message::Ping(_) | Message::Pong(_))) => continue,
            _ => return None,
        }
    }
}

/// Espera o servidor encerrar a conexão (Close, erro ou fim do stream).
async fn assert_closed(ws: &mut Ws) {
    loop {
        match tokio::time::timeout(WAIT, ws.next()).await.expect("servidor não fechou a conexão") {
            Some(Ok(Message::Text(t))) => panic!("mensagem inesperada: {t}"),
            Some(Ok(Message::Ping(_) | Message::Pong(_))) => continue,
            _ => return,
        }
    }
}

#[tokio::test]
async fn upgrade_com_origin_divergente_retorna_403() {
    let (addr, _room, _sink) = start_server().await;

    let err = connect(addr, "http://evil.example").await.expect_err("upgrade deveria falhar");
    match err {
        tokio_tungstenite::tungstenite::Error::Http(resp) => assert_eq!(resp.status(), 403),
        other => panic!("esperava 403, veio {other:?}"),
    }

    // Sem Origin também é recusado (checagem crua, sem cliente WS).
    let mut tcp = TcpStream::connect(addr).await.unwrap();
    let raw = format!(
        "GET /ws HTTP/1.1\r\nHost: {addr}\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\
         Sec-WebSocket-Version: 13\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n\r\n"
    );
    tcp.write_all(raw.as_bytes()).await.unwrap();
    let mut buf = [0u8; 64];
    let n = tokio::time::timeout(WAIT, tcp.read(&mut buf)).await.unwrap().unwrap();
    assert!(String::from_utf8_lossy(&buf[..n]).starts_with("HTTP/1.1 403"));
}

#[tokio::test]
async fn join_com_codigo_errado_recebe_erro_e_fecha() {
    let (addr, _room, sink) = start_server().await;
    let mut ws = connect(addr, &format!("http://{addr}")).await.unwrap();

    ws.send(Message::text(json!({"type":"join","code":"ZZZZZZ","name":"Ana"}).to_string())).await.unwrap();

    let reply: Value = serde_json::from_str(&next_text(&mut ws).await.unwrap()).unwrap();
    assert_eq!(reply, json!({"type":"error","reason":"bad_code"}));
    assert_closed(&mut ws).await;
    assert!(sink.peers.lock().unwrap().is_empty());
}

#[tokio::test]
async fn join_valido_notifica_mestre_e_encaminha_mensagens() {
    let (addr, room, sink) = start_server().await;
    let mut ws = connect(addr, &format!("http://{addr}")).await.unwrap();

    ws.send(Message::text(json!({"type":"join","code":"abc234","name":" Ana "}).to_string())).await.unwrap();
    ws.send(Message::text(json!({"type":"ping"}).to_string())).await.unwrap();

    let deadline = tokio::time::Instant::now() + WAIT;
    while sink.messages.lock().unwrap().len() < 2 {
        assert!(tokio::time::Instant::now() < deadline, "mensagens não chegaram ao sink");
        tokio::time::sleep(Duration::from_millis(20)).await;
    }
    let (client_id, event, name) = sink.peers.lock().unwrap()[0].clone();
    assert_eq!((event, name.as_deref()), (PeerEvent::Connected, Some("Ana")));
    assert_eq!(sink.messages.lock().unwrap()[1].1, json!({"type":"ping"}));

    // Contrato com o TS: clientId chega e volta como string decimal.
    let id = client_id.to_string();
    commands::send_to(&room, &id, &json!({"type":"lobby.waiting"})).unwrap();
    assert_eq!(next_text(&mut ws).await.unwrap(), r#"{"type":"lobby.waiting"}"#);

    let err = commands::send_to(&room, "x1", &json!({"type":"lobby.waiting"})).unwrap_err();
    assert!(err.contains("clientId inválido"), "{err}");
    assert!(commands::kick(&room, &format!("0{id}")).unwrap_err().contains("clientId inválido"));
    assert_eq!(commands::kick(&room, "999999").unwrap_err(), "cliente desconhecido");

    // Kick: só close frame, sem `error` (o TS já mandou `kicked`).
    commands::kick(&room, &id).unwrap();
    assert_closed(&mut ws).await;
}

#[test]
fn payloads_de_evento_levam_client_id_string() {
    let msg = serde_json::to_value(commands::MessagePayload::new(7, json!({"type":"ping"}))).unwrap();
    assert_eq!(msg, json!({"clientId":"7","msg":{"type":"ping"}}));

    let big = serde_json::to_value(commands::PeerPayload::new(u64::MAX, PeerEvent::Connected, Some("Ana"))).unwrap();
    assert_eq!(big, json!({"clientId":"18446744073709551615","event":"connected","name":"Ana"}));

    let gone = serde_json::to_value(commands::PeerPayload::new(3, PeerEvent::Disconnected, None)).unwrap();
    assert_eq!(gone, json!({"clientId":"3","event":"disconnected"}));
}

/// Conecta a partir de um IP de loopback específico (127.0.0.x) para simular
/// aparelhos diferentes na mesma máquina.
async fn connect_from(src: Ipv4Addr, addr: SocketAddr) -> Result<Ws, tokio_tungstenite::tungstenite::Error> {
    let socket = TcpSocket::new_v4().unwrap();
    socket.bind(SocketAddr::new(IpAddr::V4(src), 0)).unwrap();
    let stream = socket.connect(addr).await.unwrap();
    let mut req = format!("ws://{addr}/ws").into_client_request().unwrap();
    req.headers_mut().insert("Origin", HeaderValue::from_str(&format!("http://{addr}")).unwrap());
    tokio_tungstenite::client_async(req, MaybeTlsStream::Plain(stream)).await.map(|(ws, _)| ws)
}

#[tokio::test]
async fn conexoes_mudas_de_um_ip_nao_bloqueiam_join_de_outro() {
    let (addr, _room, sink) = start_server().await;
    let flooder = Ipv4Addr::LOCALHOST;

    // Muito acima do antigo teto de 16: só MAX_PENDING_PER_IP sobem, o resto é 503.
    let mut mute = Vec::new();
    let mut refused = 0;
    for _ in 0..(server::MAX_PLAYERS + 4) {
        match connect_from(flooder, addr).await {
            Ok(ws) => mute.push(ws),
            Err(tokio_tungstenite::tungstenite::Error::Http(resp)) => {
                assert_eq!(resp.status(), 503);
                refused += 1;
            }
            Err(other) => panic!("erro inesperado: {other:?}"),
        }
    }
    assert_eq!(mute.len(), server::MAX_PENDING_PER_IP);
    assert_eq!(refused, server::MAX_PLAYERS + 4 - server::MAX_PENDING_PER_IP);

    let mut ws = connect_from(Ipv4Addr::new(127, 0, 0, 2), addr).await.expect("join de outro IP foi barrado");
    ws.send(Message::text(json!({"type":"join","code":CODE,"name":"Bia"}).to_string())).await.unwrap();
    let deadline = tokio::time::Instant::now() + WAIT;
    while sink.peers.lock().unwrap().is_empty() {
        assert!(tokio::time::Instant::now() < deadline, "join válido não chegou ao mestre");
        tokio::time::sleep(Duration::from_millis(20)).await;
    }
    assert_eq!(sink.peers.lock().unwrap()[0].2.as_deref(), Some("Bia"));

    // Após o join, a vaga pendente do mesmo IP é devolvida: o flooder que
    // desistir libera espaço (aqui fechamos um mudo e um novo sobe).
    drop(mute.pop());
    let deadline = tokio::time::Instant::now() + WAIT;
    loop {
        match connect_from(flooder, addr).await {
            Ok(_) => break,
            Err(_) if tokio::time::Instant::now() < deadline => tokio::time::sleep(Duration::from_millis(50)).await,
            Err(e) => panic!("vaga pendente não foi liberada: {e:?}"),
        }
    }
}

#[tokio::test]
async fn mensagem_acima_de_64kb_e_rejeitada() {
    let (addr, _room, sink) = start_server().await;
    let mut ws = connect(addr, &format!("http://{addr}")).await.unwrap();
    ws.send(Message::text(json!({"type":"join","code":CODE,"name":"Ana"}).to_string())).await.unwrap();

    let big = json!({"type":"chat","text":"x".repeat(server::MAX_MESSAGE_BYTES + 1)}).to_string();
    // O servidor pode derrubar a conexão ainda durante o envio.
    let _ = ws.send(Message::text(big)).await;
    assert_closed(&mut ws).await;

    tokio::time::sleep(Duration::from_millis(100)).await;
    let messages = sink.messages.lock().unwrap();
    assert!(messages.iter().all(|(_, m)| m["type"] != "chat"), "mensagem grande vazou para o mestre");
    assert!(sink.peers.lock().unwrap().iter().any(|(_, e, _)| *e == PeerEvent::Disconnected));
}

#[tokio::test]
async fn player_serve_asset_e_media_e_stub() {
    let (addr, _room, _sink) = start_server().await;
    assert!(http_get(addr, "/player").await.starts_with("HTTP/1.1 200"));
    assert!(http_get(addr, "/assets/nao-existe.js").await.starts_with("HTTP/1.1 404"));
    assert!(http_get(addr, "/media/abc").await.starts_with("HTTP/1.1 404"));
}

async fn http_get(addr: SocketAddr, path: &str) -> String {
    let mut tcp = TcpStream::connect(addr).await.unwrap();
    let raw = format!("GET {path} HTTP/1.1\r\nHost: {addr}\r\nConnection: close\r\n\r\n");
    tcp.write_all(raw.as_bytes()).await.unwrap();
    let mut out = Vec::new();
    tokio::time::timeout(WAIT, tcp.read_to_end(&mut out)).await.unwrap().unwrap();
    String::from_utf8_lossy(&out).into_owned()
}
