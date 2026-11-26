//! Janela dos SONS: o mestre destaca a página Sons do livro numa segunda janela
//! (cabe no outro monitor) enquanto o mapa fica na `main`. O mesmo molde da
//! mesa da batalha (`janela_batalha.rs`):
//! - a `main` é a fonte da verdade e a ÚNICA que toca: o motor, a ponte da
//!   sala, a biblioteca de sons e o disco moram nela;
//! - a janela dos sons só MOSTRA o espelho que a `main` manda e devolve os
//!   pedidos, por um BroadcastChannel com nome secreto (a sessão abaixo), numa
//!   lista fechada que a `main` confere antes de aplicar
//!   (`client/src/sonsJanela/protocolo.ts`).
//!
//! A capability da janela (`capabilities/sons.json`) só dá ouvir evento:
//! nada de `fs`, `dialog`, `shell`, emitir evento nem comando do app.

use std::time::Duration;

use tauri::{
    AppHandle, Emitter, Manager, Runtime, WebviewUrl, WebviewWindow, WebviewWindowBuilder,
    WindowEvent,
};

use crate::visao_jogador::sessao_valida;

/// Rótulo fixo: uma janela dos sons por vez. A capability casa por ele.
pub const ROTULO: &str = "sons";
/// Única janela autorizada a abrir e fechar a janela dos sons.
const ROTULO_MAIN: &str = "main";
/// Avisa a `main` que a janela dos sons sumiu (X do sistema ou Rust).
pub const EVENTO_FECHADA: &str = "sons-janela:fechada";

const PAGINA: &str = "sons.html";
const TITULO: &str = "Sons · Labirinto";
// A página Sons foi desenhada para a coluna de 262 px do livro: a janela nasce
// estreita e alta, como a coluna, e alarga se o mestre quiser.
const LARGURA: f64 = 420.0;
const ALTURA: f64 = 760.0;
const LARGURA_MIN: f64 = 300.0;
const ALTURA_MIN: f64 = 420.0;

// O manager do Tauri só solta o rótulo no Destroyed (pelo event loop): a janela
// nova espera o rótulo da velha sumir, como na batalha.
const ESPERA_PASSO: Duration = Duration::from_millis(25);
const ESPERA_MAX_PASSOS: u32 = 80;

/// A sessão vira o nome do canal e entra em toda mensagem: só `[A-Za-z0-9-]{8,64}`
/// (a mesma regra da visão), e o literal JS sai escapado pelo `serde_json`.
fn script_de_sessao(sessao: &str) -> Result<String, String> {
    let literal = serde_json::to_string(sessao).map_err(|e| e.to_string())?;
    Ok(format!("window.__LB_SONS__ = {literal};"))
}

/// Os comandos do app valem para toda janela no Tauri v2: sem esta guarda, a
/// própria janela dos sons abriria e fecharia a si mesma por fora.
fn exigir_main<R: Runtime>(window: &WebviewWindow<R>) -> Result<(), String> {
    if window.label() == ROTULO_MAIN {
        Ok(())
    } else {
        Err("comando permitido só na janela principal".into())
    }
}

/// `destroy()` em vez de `close()`: a janela não guarda nada (os sons moram na `main`).
fn destruir_se_existir<R: Runtime>(app: &AppHandle<R>) -> Result<bool, String> {
    match app.get_webview_window(ROTULO) {
        Some(janela) => {
            janela.destroy().map_err(|e| e.to_string())?;
            Ok(true)
        }
        None => Ok(false),
    }
}

async fn esperar_rotulo_livre<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    for _ in 0..ESPERA_MAX_PASSOS {
        if app.get_webview_window(ROTULO).is_none() {
            return Ok(());
        }
        tokio::time::sleep(ESPERA_PASSO).await;
    }
    Err("a janela dos sons anterior não fechou a tempo".into())
}

fn trazer_para_frente<R: Runtime>(janela: &WebviewWindow<R>) -> Result<(), String> {
    janela.unminimize().map_err(|e| e.to_string())?;
    janela.show().map_err(|e| e.to_string())?;
    janela.set_focus().map_err(|e| e.to_string())
}

/// Abre a janela, ou traz para a frente a que já existe. Devolve `true` quando
/// criou uma janela nova (a `main` manda o espelho no `ola` dela).
///
/// `async` de propósito: criar janela em comando síncrono trava no Windows.
#[tauri::command]
pub async fn abrir_janela_sons<R: Runtime>(
    window: WebviewWindow<R>,
    sessao: String,
) -> Result<bool, String> {
    exigir_main(&window)?;
    if !sessao_valida(&sessao) {
        return Err("sessão inválida".into());
    }
    let app = window.app_handle();
    if let Some(janela) = app.get_webview_window(ROTULO) {
        trazer_para_frente(&janela)?;
        return Ok(false);
    }
    // Pode estar morrendo (Destroyed ainda na fila): espera o rótulo soltar.
    esperar_rotulo_livre(app).await?;
    let script = script_de_sessao(&sessao)?;
    WebviewWindowBuilder::new(app, ROTULO, WebviewUrl::App(PAGINA.into()))
        .title(TITULO)
        .inner_size(LARGURA, ALTURA)
        .min_inner_size(LARGURA_MIN, ALTURA_MIN)
        .center()
        .resizable(true)
        .decorations(true)
        .initialization_script(script)
        .build()
        .map_err(|e| e.to_string())?;
    Ok(true)
}

/// Idempotente: fechar o que já fechou não é erro.
#[tauri::command]
pub async fn fechar_janela_sons<R: Runtime>(window: WebviewWindow<R>) -> Result<(), String> {
    exigir_main(&window)?;
    destruir_se_existir(window.app_handle())?;
    Ok(())
}

/// Chamado do `app.run` para cada `RunEvent::WindowEvent`.
/// - Janela dos sons destruída (X do sistema inclusive): avisa a `main`, que
///   volta a página Sons para o livro.
/// - `main` destruída: derruba a janela dos sons, que sem o app não toca nada
///   (e o processo não sairia com uma janela ainda aberta).
pub fn ao_evento_de_janela<R: Runtime>(app: &AppHandle<R>, rotulo: &str, evento: &WindowEvent) {
    if !matches!(evento, WindowEvent::Destroyed) {
        return;
    }
    if rotulo == ROTULO {
        // Sem `main` (app saindo) o emit não tem destino; não há o que fazer.
        let _ = app.emit_to(ROTULO_MAIN, EVENTO_FECHADA, ());
    } else if rotulo == ROTULO_MAIN {
        let _ = destruir_se_existir(app);
    }
}
