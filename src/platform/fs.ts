/**
 * Guardar / cargar el proyecto.
 *
 * - En el navegador (y en `npm run dev`): descarga/subida de archivo .tcae.
 * - En Tauri: la app expone los comandos Rust `save_project` / `load_project`
 *   (ver src-tauri/src/main.rs). Conectarlos con un diálogo nativo es la
 *   primera tarea de F1; el branch está marcado abajo.
 */
import type { Project } from "../core/model";
import { serialize, deserialize } from "../core/project";

const EXT = "tcae";

interface TauriGlobal {
  core: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown> };
}
function tauri(): TauriGlobal | null {
  return (window as unknown as { __TAURI__?: TauriGlobal }).__TAURI__ ?? null;
}

export async function saveProject(project: Project): Promise<void> {
  const contents = serialize(project);
  const t = tauri();
  if (t) {
    // TODO(F1): abrir diálogo nativo y pasar la ruta elegida.
    await t.core.invoke("save_project", { name: project.name, contents });
    return;
  }
  // Camino navegador: descarga.
  const blob = new Blob([contents], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slug(project.name)}.${EXT}`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function loadProject(): Promise<Project | null> {
  const t = tauri();
  if (t) {
    // TODO(F1): diálogo nativo de apertura.
    const contents = (await t.core.invoke("load_project")) as string | null;
    return contents ? deserialize(contents) : null;
  }
  // Camino navegador: input de archivo.
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = `.${EXT},application/json`;
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      resolve(deserialize(await file.text()));
    };
    input.click();
  });
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "proyecto";
}
