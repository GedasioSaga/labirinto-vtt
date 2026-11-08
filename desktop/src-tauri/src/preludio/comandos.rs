//! Os comandos do Prelúdio (o contrato está no topo de `preludio/mod.rs`).

use std::path::PathBuf;

use serde::Serialize;
use tauri::{AppHandle, Emitter as _, Manager as _, State, WebviewWindow};

use super::copia::{self, Progresso, ResumoDaCopia, ResumoDaRestauracao, UltimaCopia};
use super::drive::{CopiaNoDrive, Drive};
use super::{erro_disco, google, ErroPreludio, PreludioEstado};

/// Única janela que fala com o Google.
const ROTULO_MAIN: &str = "main";
/// O andamento da cópia e da restauração.
const EVENTO_DO_ANDAMENTO: &str = "preludio:copia";

fn exigir_main(window: &WebviewWindow) -> Result<(), ErroPreludio> {
    if window.label() == ROTULO_MAIN {
        Ok(())
    } else {
        Err(ErroPreludio::novo(
            "janela",
            "O Prelúdio só fala com o Google na janela principal do app.",
        ))
    }
}

fn dados_do_app(app: &AppHandle) -> Result<PathBuf, ErroPreludio> {
    app.path()
        .app_data_dir()
        .map_err(|_| erro_disco("Não deu para achar a pasta de dados do app."))
}

fn ocupado() -> ErroPreludio {
    ErroPreludio::novo(
        "ocupado",
        "Já tem uma cópia ou restauração em andamento. Espere ela terminar.",
    )
}

/// A conta, como a tela mostra. Nunca leva token.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EstadoDaConta {
    credenciais_na_build: bool,
    email: Option<String>,
}

#[tauri::command]
pub async fn preludio_google_estado(
    window: WebviewWindow,
    estado: State<'_, PreludioEstado>,
) -> Result<EstadoDaConta, ErroPreludio> {
    exigir_main(&window)?;
    Ok(EstadoDaConta {
        credenciais_na_build: google::credenciais_na_build(),
        email: google::conta(&estado.google).await?,
    })
}

/// Abre o navegador no login do Google e espera (até 5 min). Devolve o e-mail.
#[tauri::command]
pub async fn preludio_google_entrar(
    window: WebviewWindow,
    estado: State<'_, PreludioEstado>,
) -> Result<String, ErroPreludio> {
    exigir_main(&window)?;
    let http = estado.http().await?;
    google::entrar(&estado.google, http).await
}

#[tauri::command]
pub fn preludio_google_cancelar(
    window: WebviewWindow,
    estado: State<'_, PreludioEstado>,
) -> Result<(), ErroPreludio> {
    exigir_main(&window)?;
    google::cancelar(&estado.google);
    Ok(())
}

#[tauri::command]
pub async fn preludio_google_sair(
    window: WebviewWindow,
    estado: State<'_, PreludioEstado>,
) -> Result<(), ErroPreludio> {
    exigir_main(&window)?;
    google::sair(&estado.google).await
}

#[tauri::command]
pub async fn preludio_copia_ultima(
    app: AppHandle,
    window: WebviewWindow,
) -> Result<Option<UltimaCopia>, ErroPreludio> {
    exigir_main(&window)?;
    Ok(copia::ler_ultima(&dados_do_app(&app)?).await)
}

#[tauri::command]
pub async fn preludio_copia_fazer(
    app: AppHandle,
    window: WebviewWindow,
    estado: State<'_, PreludioEstado>,
) -> Result<ResumoDaCopia, ErroPreludio> {
    exigir_main(&window)?;
    let _trava = estado.trava_da_copia.try_lock().map_err(|_| ocupado())?;
    let dados = dados_do_app(&app)?;
    let drive = Drive::novo(estado.http().await?, &estado.google);
    let avisar = |andamento: Progresso| {
        let _ = app.emit_to(ROTULO_MAIN, EVENTO_DO_ANDAMENTO, andamento);
    };
    let resultado = copia::fazer(&dados, &drive, &avisar).await;
    avisar(Progresso::fim());
    resultado
}

#[tauri::command]
pub async fn preludio_copia_listar(
    window: WebviewWindow,
    estado: State<'_, PreludioEstado>,
) -> Result<Vec<CopiaNoDrive>, ErroPreludio> {
    exigir_main(&window)?;
    let drive = Drive::novo(estado.http().await?, &estado.google);
    copia::listar(&drive).await
}

#[tauri::command]
pub async fn preludio_copia_restaurar(
    app: AppHandle,
    window: WebviewWindow,
    estado: State<'_, PreludioEstado>,
    copia_id: String,
) -> Result<ResumoDaRestauracao, ErroPreludio> {
    exigir_main(&window)?;
    let _trava = estado.trava_da_copia.try_lock().map_err(|_| ocupado())?;
    let dados = dados_do_app(&app)?;
    let drive = Drive::novo(estado.http().await?, &estado.google);
    let avisar = |andamento: Progresso| {
        let _ = app.emit_to(ROTULO_MAIN, EVENTO_DO_ANDAMENTO, andamento);
    };
    let resultado = copia::restaurar(&dados, &drive, &copia_id, &avisar).await;
    avisar(Progresso::fim());
    resultado
}
