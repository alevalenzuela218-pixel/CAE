// Shell de escritorio (Tauri 2). El núcleo Rust arranca mínimo: sólo expone
// los comandos de persistencia que el frontend llama vía `invoke`. A medida
// que crezca el proyecto, aquí viven el motor de geometría, el netlist y los
// cálculos pesados.
//
// En F0 estos comandos son esqueletos. La primera tarea de F1 es conectar
// `save_project` / `load_project` a un diálogo nativo (plugin tauri-dialog +
// tauri-fs) y definir la carpeta de datos donde se instalan los plugins.

#[tauri::command]
fn save_project(name: String, contents: String) -> Result<(), String> {
    // TODO(F1): diálogo nativo "Guardar como" y ruta elegida por el usuario.
    std::fs::write(format!("{name}.tcae"), contents).map_err(|e| e.to_string())
}

#[tauri::command]
fn load_project() -> Result<Option<String>, String> {
    // TODO(F1): diálogo nativo de apertura; por ahora no devuelve nada.
    Ok(None)
}

#[tauri::command]
fn list_plugins() -> Vec<String> {
    // TODO(F1): enumerar la carpeta de datos de la app y validar firmas.
    Vec::new()
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            save_project,
            load_project,
            list_plugins
        ])
        .run(tauri::generate_context!())
        .expect("error al iniciar la aplicación Tauri");
}
