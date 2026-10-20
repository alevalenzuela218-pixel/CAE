/**
 * Ensambla la aplicación: layout, barra de herramientas, paleta, inspector,
 * pestañas (Esquema / Tablero 3D) y barra de estado. Conecta los eventos del
 * bus con la UI.
 */
import { EventBus, Events } from "../core/bus";
import { PluginHost } from "../plugins/host";
import { SchematicEditor } from "../editor/editor";
import type { Tool } from "../editor/editor";
import { buildPalette } from "../editor/palette";
import { createProject } from "../core/project";
import { saveProject, loadProject } from "../platform/fs";
import { Tablero3D } from "../tablero/tablero3d";
import type { Project, DeviceInstance } from "../core/model";

export async function mountApp(root: HTMLElement): Promise<void> {
  root.innerHTML = LAYOUT;

  const bus = new EventBus();
  const host = new PluginHost();
  const canvas = root.querySelector<HTMLElement>("#canvas")!;
  const editor = new SchematicEditor(canvas, host, bus);

  let currentProject: Project = createProject();
  let tablero: Tablero3D | null = null;

  // ---- eventos de la UI (registrar ANTES de cargar el proyecto)
  bus.on<Project>(Events.ProjectChanged, (p) => {
    currentProject = p;
    setMeta(root, p.name, p.devices.length, p.wires.length);
  });
  bus.on<Tool>(Events.ToolChanged, (tool) => {
    root.querySelectorAll(".tool").forEach((b) => b.classList.remove("active"));
    root.querySelector(`#tool-${tool}`)?.classList.add("active");
  });
  bus.on<DeviceInstance | null>(Events.SelectionChanged, (dev) => {
    renderInspector(root, host, dev);
  });
  bus.on<string>(Events.StatusMessage, (msg) => setStatus(root, msg));

  // ---- cargar plugins y poblar la paleta
  setStatus(root, "Cargando plugins…");
  await host.loadAll();
  bus.emit(Events.PluginsLoaded, host.loadedPlugins());
  buildPalette(root.querySelector("#palette")!, host, editor);
  const names = host.loadedPlugins().map((p) => p.manifest.name).join(", ");
  setStatus(root, names ? `Plugins: ${names}` : "Sin plugins");

  // ---- proyecto inicial de demostración
  editor.setProject(createProject("Demo arranque de motor"));

  // ---- barra de herramientas
  root.querySelector("#tool-select")!.addEventListener("click", () => editor.setTool("select"));
  root.querySelector("#tool-wire")!.addEventListener("click", () => editor.setTool("wire"));
  root.querySelector("#act-new")!.addEventListener("click", () => {
    editor.setProject(createProject("Proyecto sin título"));
  });
  root.querySelector("#act-save")!.addEventListener("click", async () => {
    await saveProject(currentProject);
    setStatus(root, "Proyecto guardado");
  });
  root.querySelector("#act-open")!.addEventListener("click", async () => {
    const p = await loadProject();
    if (p) {
      editor.setProject(p);
      setStatus(root, `Abierto: ${p.name}`);
    }
  });

  // ---- pestañas Esquema / Tablero 3D
  const paneSchema = root.querySelector<HTMLElement>("#pane-schema")!;
  const pane3d = root.querySelector<HTMLElement>("#pane-3d")!;
  const tabSchema = root.querySelector<HTMLElement>("#tab-schema")!;
  const tab3d = root.querySelector<HTMLElement>("#tab-3d")!;

  function showSchema(): void {
    tabSchema.classList.add("active");
    tab3d.classList.remove("active");
    paneSchema.classList.add("active");
    pane3d.classList.remove("active");
    tablero?.stop();
  }
  function show3d(): void {
    tab3d.classList.add("active");
    tabSchema.classList.remove("active");
    pane3d.classList.add("active");
    paneSchema.classList.remove("active");
    if (!tablero) tablero = new Tablero3D(pane3d, bus); // init diferida
    tablero.start();
  }
  tabSchema.addEventListener("click", showSchema);
  tab3d.addEventListener("click", show3d);

  // atajos de teclado (solo en la pestaña de esquema)
  window.addEventListener("keydown", (e) => {
    if (e.target instanceof HTMLInputElement) return;
    if (!paneSchema.classList.contains("active")) return;
    if (e.key === "v" || e.key === "V") editor.setTool("select");
    if (e.key === "w" || e.key === "W") editor.setTool("wire");
  });

  root.querySelector("#tool-select")?.classList.add("active");
}

function setStatus(root: HTMLElement, msg: string): void {
  root.querySelector("#status-msg")!.textContent = msg;
}

function setMeta(root: HTMLElement, name: string, devices: number, wires: number): void {
  root.querySelector("#meta")!.textContent =
    `${name} · ${devices} dispositivos · ${wires} conexiones`;
}

function renderInspector(
  root: HTMLElement,
  host: PluginHost,
  dev: DeviceInstance | null,
): void {
  const el = root.querySelector("#inspector")!;
  if (!dev) {
    el.innerHTML = `<p class="muted">Nada seleccionado.</p>`;
    return;
  }
  const part = host.getPart(dev.partId);
  const rows = part
    ? Object.entries(part.attributes)
        .map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`)
        .join("")
    : "";
  el.innerHTML = `
    <h4>${dev.rds}</h4>
    <p class="muted">${part?.manufacturer ?? ""} ${part?.code ?? ""}</p>
    <table class="attrs">${rows}</table>
    ${part?.price != null ? `<p class="price">Precio ref.: $${part.price}</p>` : ""}
  `;
}

const LAYOUT = `
  <div class="app">
    <header class="toolbar">
      <div class="brand">TEGSA <span>CAE</span></div>
      <div class="group">
        <button id="act-new" class="btn">Nuevo</button>
        <button id="act-open" class="btn">Abrir</button>
        <button id="act-save" class="btn">Guardar</button>
      </div>
      <div class="group">
        <button id="tool-select" class="btn tool" title="Seleccionar / mover (V)">Seleccionar</button>
        <button id="tool-wire" class="btn tool" title="Cablear (W)">Cable</button>
      </div>
      <div id="meta" class="meta"></div>
    </header>
    <div class="body">
      <aside class="sidebar left">
        <h3>Artículos</h3>
        <div id="palette"></div>
      </aside>
      <main class="stage">
        <div class="tabs">
          <button id="tab-schema" class="tab-btn active">Esquema</button>
          <button id="tab-3d" class="tab-btn">Tablero 3D</button>
        </div>
        <div class="panes">
          <div id="pane-schema" class="pane active"><div id="canvas" class="canvas"></div></div>
          <div id="pane-3d" class="pane"></div>
        </div>
      </main>
      <aside class="sidebar right">
        <h3>Inspector</h3>
        <div id="inspector"><p class="muted">Nada seleccionado.</p></div>
      </aside>
    </div>
    <footer class="statusbar">
      <span id="status-msg">Listo</span>
    </footer>
  </div>
`;
