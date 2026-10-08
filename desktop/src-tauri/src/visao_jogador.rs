//! Janela "Visão de jogador": o mestre abre uma segunda janela que mostra o
//! mapa como um jogador veria. A janela nova não recebe capability nenhuma (a
//! conversa com a `main` é por BroadcastChannel), então toda a superfície Rust
//! dela fica aqui: três comandos, todos restritos a quem chama da `main`.

use std::time::Duration;

use tauri::{
    AppHandle, Emitter, Manager, Runtime, WebviewUrl, WebviewWindow, WebviewWindowBuilder,
    WindowEvent,
};

/// Rótulo fixo: só existe uma visão de jogador por vez.
pub const ROTULO: &str = "visao-jogador";
/// Única janela autorizada a abrir, mostrar e fechar a visão.
const ROTULO_MAIN: &str = "main";
/// Avisa a `main` que a visão sumiu (X do sistema ou fechamento pelo Rust),
/// para o painel resetar e a ponte de teste parar.
pub const EVENTO_FECHADA: &str = "visao-jogador:fechada";

const PAGINA: &str = "visao-jogador.html";
const TITULO: &str = "Visão de jogador · Labirinto";
const LARGURA: f64 = 1100.0;
const ALTURA: f64 = 750.0;
const LARGURA_MIN: f64 = 420.0;
const ALTURA_MIN: f64 = 320.0;
const SESSAO_MIN: usize = 8;
const SESSAO_MAX: usize = 64;

// O manager do Tauri só solta o rótulo no evento Destroyed, que chega pelo
// event loop depois de `destroy()` voltar. Criar a janela nova antes disso
// falha com "label already exists", então esperamos o rótulo sumir.
const ESPERA_PASSO: Duration = Duration::from_millis(25);
const ESPERA_MAX_PASSOS: u32 = 80;

/// A sessão vira literal JS no `initialization_script` e entra em todas as
/// mensagens do canal: aceitar só `[A-Za-z0-9-]{8,64}` fecha a porta para
/// aspas, barra invertida e qualquer coisa que quebre o script.
pub fn sessao_valida(sessao: &str) -> bool {
    (SESSAO_MIN..=SESSAO_MAX).contains(&sessao.len())
        && sessao
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-')
}

/// Monta o script com `serde_json` mesmo com a sessão já validada: o literal
/// sai escapado por construção, nunca por cuidado com `format!`.
fn script_de_sessao(sessao: &str) -> Result<String, String> {
    let literal = serde_json::to_string(sessao).map_err(|e| e.to_string())?;
    Ok(format!("window.__LB_VISAO__ = {literal};"))
}

/// Os comandos do app valem para toda janela no Tauri v2; sem esta guarda a
/// própria visão poderia se recriar ou fechar por fora do controlador.
fn exigir_main<R: Runtime>(window: &WebviewWindow<R>) -> Result<(), String> {
    if window.label() == ROTULO_MAIN {
        Ok(())
    } else {
        Err("comando permitido só na janela principal".into())
    }
}

/// `destroy()` em vez de `close()`: não passa pelo CloseRequested, então nada
/// na página consegue segurar a janela aberta.
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
    Err("a visão de jogador anterior não fechou a tempo".into())
}

// `async` de propósito: criar janela em comando síncrono trava no Windows
// (o comando síncrono roda no thread principal, o mesmo que cria a janela).
#[tauri::command]
pub async fn abrir_visao_jogador<R: Runtime>(
    window: WebviewWindow<R>,
    sessao: String,
) -> Result<(), String> {
    exigir_main(&window)?;
    if !sessao_valida(&sessao) {
        return Err("sessão inválida".into());
    }
    let script = script_de_sessao(&sessao)?;
    let app = window.app_handle();
    if destruir_se_existir(app)? {
        esperar_rotulo_livre(app).await?;
    }
    WebviewWindowBuilder::new(app, ROTULO, WebviewUrl::App(PAGINA.into()))
        .title(TITULO)
        .inner_size(LARGURA, ALTURA)
        .min_inner_size(LARGURA_MIN, ALTURA_MIN)
        .center()
        .resizable(true)
        .decorations(true)
        // Igual ao `dragDropEnabled: false` da `main`: arrastar arquivo para a
        // visão não deve virar evento nativo de drop.
        .disable_drag_drop_handler()
        .initialization_script(script)
        .build()
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// `Ok(false)` quando não há visão aberta: o front decide se abre uma nova.
#[tauri::command]
pub async fn mostrar_visao_jogador<R: Runtime>(window: WebviewWindow<R>) -> Result<bool, String> {
    exigir_main(&window)?;
    let Some(janela) = window.app_handle().get_webview_window(ROTULO) else {
        return Ok(false);
    };
    janela.unminimize().map_err(|e| e.to_string())?;
    janela.show().map_err(|e| e.to_string())?;
    janela.set_focus().map_err(|e| e.to_string())?;
    Ok(true)
}

/// Idempotente: o controlador do front chama em todo `fechar()`, exista a
/// janela ou não.
#[tauri::command]
pub async fn fechar_visao_jogador<R: Runtime>(window: WebviewWindow<R>) -> Result<(), String> {
    exigir_main(&window)?;
    destruir_se_existir(window.app_handle())?;
    Ok(())
}

/// Chamado do `app.run` para cada `RunEvent::WindowEvent`.
/// - Visão destruída (X do sistema inclusive): avisa a `main`.
/// - `main` destruída: derruba a visão, senão o processo não sai porque ainda
///   há janela aberta.
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sessao_aceita_uuid_e_limites() {
        assert!(sessao_valida("3f2b9c1e-7a4d-4e8b-9c2f-1a2b3c4d5e6f"));
        assert!(sessao_valida("abcdEFGH"));
        assert!(sessao_valida(&"a".repeat(SESSAO_MAX)));
    }

    #[test]
    fn sessao_recusa_tamanho_fora_da_faixa() {
        assert!(!sessao_valida(""));
        assert!(!sessao_valida("abc1234"));
        assert!(!sessao_valida(&"a".repeat(SESSAO_MAX + 1)));
    }

    #[test]
    fn sessao_recusa_caracteres_que_quebram_o_script() {
        assert!(!sessao_valida("abcd\"efgh"));
        assert!(!sessao_valida("abcd'efgh"));
        assert!(!sessao_valida("abcd\\efgh"));
        assert!(!sessao_valida("abcd efgh"));
        assert!(!sessao_valida("abcd\nefgh"));
        assert!(!sessao_valida("abcd;efgh"));
    }

    #[test]
    fn sessao_recusa_unicode() {
        // 8 caracteres, mas fora do ASCII: o tamanho não pode salvar isso.
        assert!(!sessao_valida("sessãoxx"));
        assert!(!sessao_valida("ａｂｃｄｅｆｇｈ"));
    }

    #[test]
    fn script_vira_literal_js_escapado() {
        assert_eq!(
            script_de_sessao("abc-1234").as_deref(),
            Ok("window.__LB_VISAO__ = \"abc-1234\";")
        );
        // Mesmo que a validação falhasse, a aspa sai escapada.
        assert_eq!(
            script_de_sessao("a\"b").as_deref(),
            Ok("window.__LB_VISAO__ = \"a\\\"b\";")
        );
    }
}
