#![allow(clippy::unwrap_used, clippy::expect_used)]
//! Jornada vermelha do "A sala não respondeu".
//!
//! Em `tauri dev` sem `client/dist` compilado junto, `/player` respondia
//! `307 -> http://localhost:1420/player.html`. A página do jogador passava a
//! viver na origem do Vite, o `socketUrl()` dela virava `ws://localhost:1420/ws`
//! e o Vite aceita o TCP sem nunca responder ao upgrade: socket pendurado, sem
//! `open` e sem `close`, e a tela acusava a sala depois de 8 segundos.
//!
//! O contrato agora é: a página do jogador sai SEMPRE da origem da sala. Este
//! teste tranca as duas metades — a página e os módulos que ela pede.

use std::net::{IpAddr, Ipv4Addr, SocketAddr};
use std::sync::Arc;

use tokio::sync::Mutex;

use axum::routing::get;
use axum::Router;
use labirinto_lib::net::server::{self, AssetSource, ClientId, NetSink, PeerEvent, Room};
use serde_json::Value;

const CODE: &str = "ABC234";
const PAGINA: &str = "<html>pagina do jogador servida pelo vite</html>";
const MODULO: &str = "export const main = 1";
const SEGREDO: &str = "SEGREDO DO MESTRE";

struct MudoSink;

impl NetSink for MudoSink {
    fn on_message(&self, _client_id: ClientId, _msg: Value) {}
    fn on_peer(&self, _client_id: ClientId, _event: PeerEvent, _name: Option<&str>) {}
}

/// Vite de mentira. Serve a página e um módulo de `/src` — e responde 200 a
/// QUALQUER outro caminho, com um segredo no corpo.
///
/// O catch-all é o controle positivo do teste de ataque: sem ele, um 404 não
/// provaria nada (o Vite de mentira devolveria 404 de qualquer jeito, e o teste
/// passaria com o portão escancarado). Com ele, 404 só pode ter vindo da sala.
async fn vite_falso() -> SocketAddr {
    let app = Router::new()
        .route("/player.html", get(|| async { ([(axum::http::header::CONTENT_TYPE, "text/html")], PAGINA) }))
        .route("/src/player/main.tsx", get(|| async { ([(axum::http::header::CONTENT_TYPE, "text/javascript")], MODULO) }))
        .fallback(|| async { ([(axum::http::header::CONTENT_TYPE, "text/plain")], SEGREDO) });
    let listener = server::bind(IpAddr::V4(Ipv4Addr::LOCALHOST), 0, 1).await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(listener, app).await });
    addr
}

/// Sala SEM front embutido, que é o caso de `tauri dev`.
async fn sala_sem_build() -> SocketAddr {
    let assets: AssetSource = Arc::new(|_path: &str| None);
    let room = Room::new(CODE.to_owned(), Arc::new(MudoSink), assets);
    let listener = server::bind(IpAddr::V4(Ipv4Addr::LOCALHOST), 0, 1).await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(server::serve(listener, room));
    addr
}

/// Guarda para o cliente não seguir redirecionamento: o teste precisa VER o 307
/// se ele voltar.
fn cliente() -> reqwest::Client {
    reqwest::Client::builder().no_proxy().redirect(reqwest::redirect::Policy::none()).build().unwrap()
}

/// `LAB_DEV_URL` é do processo inteiro e cada caso aponta para um Vite
/// diferente: os casos entram um de cada vez. Mutex do tokio porque a trava
/// atravessa `await`.
static ENV: Mutex<()> = Mutex::const_new(());

#[tokio::test]
async fn player_sai_da_origem_da_sala_e_nao_redireciona_para_o_vite() {
    let _trava = ENV.lock().await;
    let vite = vite_falso().await;
    std::env::set_var(server::DEV_URL_ENV, format!("http://{vite}"));
    let sala = sala_sem_build().await;

    let resposta = cliente().get(format!("http://{sala}/player")).send().await.unwrap();

    assert_eq!(resposta.status().as_u16(), 200, "a página do jogador precisa vir com 200, nunca com redirecionamento para o Vite");
    assert!(resposta.headers().get(reqwest::header::LOCATION).is_none(), "nenhum Location: o jogador não pode sair da origem da sala");
    assert_eq!(resposta.text().await.unwrap(), PAGINA);
}

#[tokio::test]
async fn modulos_que_a_pagina_pede_tambem_saem_da_origem_da_sala() {
    let _trava = ENV.lock().await;
    let vite = vite_falso().await;
    std::env::set_var(server::DEV_URL_ENV, format!("http://{vite}"));
    let sala = sala_sem_build().await;

    let resposta = cliente().get(format!("http://{sala}/src/player/main.tsx")).send().await.unwrap();

    assert_eq!(resposta.status().as_u16(), 200, "sem os módulos do Vite a página abre em branco");
    assert_eq!(resposta.text().await.unwrap(), MODULO);
}

#[tokio::test]
async fn proxy_nao_entrega_arquivo_arbitrario_do_disco_do_mestre() {
    let _trava = ENV.lock().await;
    let vite = vite_falso().await;
    std::env::set_var(server::DEV_URL_ENV, format!("http://{vite}"));
    let sala = sala_sem_build().await;
    let cliente = cliente();

    // O Vite de dev serve o disco em `/@fs/<caminho absoluto>`; a sala vive na
    // LAN. Sem a lista de prefixos, qualquer pessoa da rede leria o repositório
    // do mestre por aqui.
    let ataques = [
        "/@fs/C:/Windows/win.ini",
        "/src/../../../segredo.txt",
        "/.env",
        "/package.json",
        // A query satisfazia a regra enquanto o CAMINHO pedia outra coisa.
        "/@fs/C:/dev/labirinto/HANDOFF.md?x=/node_modules/",
        // `..` percent-encodado: o `Uri` não decodifica, o `url` do reqwest
        // normaliza depois — passava inteiro e saía do prefixo permitido.
        "/src/%2e%2e/porta.js",
        "/src/%2e%2e/%2e%2e/package.json",
        "/src/%2E%2E/@fs/C:/Windows/win.ini",
    ];
    for caminho in ataques {
        let resposta = cliente.get(format!("http://{sala}{caminho}")).send().await.unwrap();
        let status = resposta.status().as_u16();
        let corpo = resposta.text().await.unwrap();
        assert_eq!(status, 404, "o proxy de dev aceitou buscar {caminho} no Vite; ele respondeu: {corpo}");
        assert!(!corpo.contains(SEGREDO), "o corpo de {caminho} veio do Vite");
    }

    // Método de escrita não passa nem em caminho permitido.
    let escrita = cliente.post(format!("http://{sala}/src/player/main.tsx")).send().await.unwrap();
    assert_eq!(escrita.status().as_u16(), 405);

    // `Host` que não é IP literal: mesma defesa contra DNS rebinding que `/ws`
    // já tinha. Um site que o mestre visite não lê o projeto dele por aqui.
    let por_nome = cliente
        .get(format!("http://{sala}/src/player/main.tsx"))
        .header(reqwest::header::HOST, "mesa-do-mestre.example.com")
        .send()
        .await
        .unwrap();
    assert_eq!(por_nome.status().as_u16(), 404, "o proxy de dev respondeu a um Host que não é a própria sala");
}

#[tokio::test]
async fn vite_fora_do_ar_explica_em_vez_de_pendurar() {
    let _trava = ENV.lock().await;
    // Porta fechada de propósito: ninguém escuta nela.
    std::env::set_var(server::DEV_URL_ENV, "http://127.0.0.1:1");
    let sala = sala_sem_build().await;

    let resposta = cliente().get(format!("http://{sala}/player")).send().await.unwrap();

    assert_eq!(resposta.status().as_u16(), 502);
    assert!(resposta.text().await.unwrap().contains("npm run"), "a resposta precisa dizer o que fazer");
}
