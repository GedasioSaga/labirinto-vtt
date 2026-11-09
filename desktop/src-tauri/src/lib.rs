use tauri::Manager;
use tauri_plugin_fs::FsExt;

pub mod ia;
pub mod net;
pub mod nuvem;
pub mod preludio;
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
        // O jogo dos minigames para as janelas do app (a Visão de jogador não tem sala).
        .register_asynchronous_uri_scheme_protocol(
            net::protocolo_minigame::ESQUEMA,
            net::protocolo_minigame::atender,
        )
        .manage(net::commands::NetState::default())
        .manage(ia::IaEstado::default())
        .manage(nuvem::NuvemEstado::default())
        .manage(preludio::PreludioEstado::default())
        .invoke_handler(tauri::generate_handler![
            grant_fs_access,
            net::commands::net_start_room,
            net::commands::net_stop_room,
            net::commands::net_room_open,
            net::commands::net_send,
            net::commands::net_kick,
            net::commands::net_sons_aventura,
            net::commands::net_start_tunnel,
            net::commands::net_stop_tunnel,
            net::commands::animacoes_atualizar,
            net::commands::animacoes_ler_indice,
            net::commands::animacoes_ler_arquivo,
            net::commands::minigames_atualizar,
            net::commands::minigames_ler_indice,
            visao_jogador::abrir_visao_jogador,
            visao_jogador::mostrar_visao_jogador,
            visao_jogador::fechar_visao_jogador,
            // Assistente do mestre (M4): só a janela main; a chave nunca volta.
            ia::ia_chaves_estado,
            ia::ia_chaves_guardar,
            ia::ia_chaves_apagar,
            ia::ia_gerar,
            // Lobby (R1): só a janela main; a credencial nunca volta.
            nuvem::nuvem_credencial_estado,
            nuvem::nuvem_credencial_guardar,
            nuvem::nuvem_credencial_apagar,
            nuvem::nuvem_pedir,
            nuvem::nuvem_enviar_midia,
            nuvem::nuvem_baixar_midia,
            // Prelúdio, cópia no Google Drive: só a janela main; os tokens nunca voltam.
            preludio::comandos::preludio_google_estado,
            preludio::comandos::preludio_google_entrar,
            preludio::comandos::preludio_google_cancelar,
            preludio::comandos::preludio_google_sair,
            preludio::comandos::preludio_copia_ultima,
            preludio::comandos::preludio_copia_fazer,
            preludio::comandos::preludio_copia_listar,
            preludio::comandos::preludio_copia_restaurar,
            preludio::comandos::preludio_espaco_livre
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
