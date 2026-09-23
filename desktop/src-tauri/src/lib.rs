use tauri::Manager;
use tauri_plugin_fs::FsExt;

pub mod net;

// Este comando concede acesso de FS para um path arbitrário. Não dá pra validar
// genericamente aqui: `path` também chega de diálogo nativo de arquivo/pasta
// (escolha explícita do usuário), onde qualquer path é legítimo por design.
// Quando `path` é derivado de conteúdo de arquivo não confiável (ex.: `map.id`
// de um `map.json` importado), a validação de path traversal fica no lado
// TypeScript, em `assertPathWithinRoot` (client/src/lib/mapFileIO.ts), chamada
// ANTES deste comando ser invocado com esse path.
#[tauri::command]
fn grant_fs_access(app: tauri::AppHandle, path: String) -> Result<(), String> {
    app.fs_scope()
        .allow_directory(&path, true)
        .map_err(|e| e.to_string())?;
    Ok(())
}

// Ponto de entrada: se o runtime do Tauri não sobe, não há o que recuperar,
// então abortar com mensagem é o comportamento correto.
#[allow(clippy::expect_used)]
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(net::commands::NetState::default())
        .invoke_handler(tauri::generate_handler![
            grant_fs_access,
            net::commands::net_start_room,
            net::commands::net_stop_room,
            net::commands::net_send,
            net::commands::net_kick,
            net::commands::net_start_tunnel,
            net::commands::net_stop_tunnel
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");
    app.run(|handle, event| {
        // Nenhum `cloudflared` pode sobreviver ao app.
        if let tauri::RunEvent::Exit = event {
            handle.state::<net::commands::NetState>().kill_tunnel_now();
        }
    });
}
