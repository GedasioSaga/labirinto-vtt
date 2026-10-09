use tauri::Manager;
use tauri_plugin_fs::FsExt;

pub mod net;
pub mod visao_jogador;

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
        // Atualização pelo GitHub: o updater só aceita pacote assinado pela
        // chave cuja metade pública está em tauri.conf.json; o process dá o
        // `relaunch` depois de instalar. Quem decide QUANDO é a tela inicial.
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(net::commands::NetState::default())
        .invoke_handler(tauri::generate_handler![
            grant_fs_access,
            net::commands::net_start_room,
            net::commands::net_stop_room,
            net::commands::net_room_open,
            net::commands::net_send,
            net::commands::net_kick,
            net::commands::net_start_tunnel,
            net::commands::net_stop_tunnel,
            net::commands::animacoes_atualizar,
            net::commands::animacoes_ler_indice,
            net::commands::animacoes_ler_arquivo,
            visao_jogador::abrir_visao_jogador,
            visao_jogador::mostrar_visao_jogador,
            visao_jogador::fechar_visao_jogador
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");
    app.run(|handle, event| match event {
        // Nenhum `cloudflared` pode sobreviver ao app.
        tauri::RunEvent::Exit => {
            handle.state::<net::commands::NetState>().kill_tunnel_now();
        }
        tauri::RunEvent::WindowEvent { label, event, .. } => {
            visao_jogador::ao_evento_de_janela(handle, &label, &event);
        }
        _ => {}
    });
}
