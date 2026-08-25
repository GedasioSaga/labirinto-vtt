use tauri_plugin_fs::FsExt;

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![grant_fs_access])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
