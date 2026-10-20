/**
 * Editor de esquemas sobre SVG.
 *
 * Alcance del scaffold (F0):
 *  - Grilla y lienzo de hoja.
 *  - Colocar un símbolo elegido desde la paleta (clic en el lienzo).
 *  - Herramienta de cable: clics para vértices, doble clic / Enter para cerrar.
 *  - Seleccionar y arrastrar dispositivos; Supr para borrar.
 *
 * Se re-renderiza entero en cada cambio: simple y suficiente para hojas
 * normales. En F1 se pasa a render incremental + undo/redo sobre el bus.
 */
import type { Project, DeviceInstance, Wire, Point } from "../core/model";
import { uuid, nextRds, addDevice, addWire, removeDevice } from "../core/project";
import type { PluginHost } from "../plugins/host";
import { EventBus, Events } from "../core/bus";

const SVG_NS = "http://www.w3.org/2000/svg";
const GRID = 20;
const WIDTH = 1600;
const HEIGHT = 1000;

export type Tool = "select" | "wire";

// Prefijo RDS (IEC 81346) por familia, para autonumerar al colocar.
const RDS_PREFIX: Record<string, string> = {
  Contactor: "Q",
  Interruptor: "Q",
  Seccionador: "Q",
  Motor: "M",
  Borne: "X",
  Fusible: "F",
  "Relé térmico": "F",
  Bobina: "K",
  Contacto: "K",
  Pulsador: "S",
  Selector: "S",
  "Final de carrera": "S",
  "Señalización": "H",
  Transformador: "T",
  "Puesta a tierra": "PE",
};

export class SchematicEditor {
  private svg: SVGSVGElement;
  private project!: Project;
  private tool: Tool = "select";
  private placementPartId: string | null = null;
  private selectedId: string | null = null;

  // estado de arrastre
  private drag: { id: string; dx: number; dy: number } | null = null;
  // estado de cableado en curso
  private wirePts: Point[] = [];
  private cursor: Point = { x: 0, y: 0 };

  constructor(
    private container: HTMLElement,
    private host: PluginHost,
    private bus: EventBus,
  ) {
    this.svg = document.createElementNS(SVG_NS, "svg");
    this.svg.setAttribute("viewBox", `0 0 ${WIDTH} ${HEIGHT}`);
    this.svg.setAttribute("class", "schematic");
    this.container.appendChild(this.svg);
    this.bindEvents();
  }

  setProject(project: Project): void {
    this.project = project;
    this.selectedId = null;
    this.wirePts = [];
    this.render();
    this.bus.emit(Events.ProjectChanged, this.project);
  }

  setTool(tool: Tool): void {
    this.tool = tool;
    this.placementPartId = null;
    this.wirePts = [];
    this.bus.emit(Events.ToolChanged, tool);
    this.render();
  }

  /** Arma el modo "colocar": el próximo clic coloca este artículo. */
  startPlacement(partId: string): void {
    this.tool = "select";
    this.placementPartId = partId;
    const part = this.host.getPart(partId);
    this.status(`Colocando ${part?.code ?? partId} — clic en la hoja`);
  }

  // ---------------------------------------------------------------- eventos

  private bindEvents(): void {
    this.svg.addEventListener("mousedown", (e) => this.onMouseDown(e));
    this.svg.addEventListener("mousemove", (e) => this.onMouseMove(e));
    this.svg.addEventListener("dblclick", () => this.finishWire());
    window.addEventListener("mouseup", () => this.onMouseUp());
    window.addEventListener("keydown", (e) => this.onKeyDown(e));
  }

  private onMouseDown(e: MouseEvent): void {
    const p = this.snap(this.toSvg(e));

    // modo colocar: insertar dispositivo
    if (this.placementPartId) {
      this.placeDevice(this.placementPartId, p);
      this.placementPartId = null;
      return;
    }

    // modo cable: agregar vértice
    if (this.tool === "wire") {
      this.wirePts.push(p);
      this.render();
      return;
    }

    // modo seleccionar: ¿clic sobre un dispositivo?
    const target = (e.target as Element).closest("[data-device]");
    if (target) {
      const id = target.getAttribute("data-device")!;
      const dev = this.project.devices.find((d) => d.id === id)!;
      this.selectedId = id;
      this.drag = { id, dx: p.x - dev.x, dy: p.y - dev.y };
      this.bus.emit(Events.SelectionChanged, dev);
    } else {
      this.selectedId = null;
      this.bus.emit(Events.SelectionChanged, null);
    }
    this.render();
  }

  private onMouseMove(e: MouseEvent): void {
    this.cursor = this.toSvg(e);
    if (this.drag) {
      const p = this.snap(this.cursor);
      const dev = this.project.devices.find((d) => d.id === this.drag!.id)!;
      dev.x = p.x - this.drag.dx;
      dev.y = p.y - this.drag.dy;
      this.render();
    } else if (this.tool === "wire" && this.wirePts.length) {
      this.render(); // refresca la línea de preview hasta el cursor
    }
  }

  private onMouseUp(): void {
    if (this.drag) {
      this.drag = null;
      this.bus.emit(Events.ProjectChanged, this.project);
    }
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (e.key === "Escape") {
      this.wirePts = [];
      this.placementPartId = null;
      this.render();
    } else if (e.key === "Enter") {
      this.finishWire();
    } else if ((e.key === "Delete" || e.key === "Backspace") && this.selectedId) {
      removeDevice(this.project, this.selectedId);
      this.selectedId = null;
      this.render();
      this.bus.emit(Events.ProjectChanged, this.project);
    }
  }

  // --------------------------------------------------------------- acciones

  private placeDevice(partId: string, at: Point): void {
    const part = this.host.getPart(partId);
    if (!part) return;
    const prefix = RDS_PREFIX[part.family] ?? "A";
    const dev: DeviceInstance = {
      id: uuid(),
      rds: nextRds(this.project, prefix),
      partId: part.id,
      symbolId: part.symbolId,
      sheetId: this.project.sheets[0].id,
      x: at.x,
      y: at.y,
      rotation: 0,
    };
    addDevice(this.project, dev);
    this.selectedId = dev.id;
    this.render();
    this.bus.emit(Events.ProjectChanged, this.project);
    this.status(`Colocado ${dev.rds} (${part.code})`);
  }

  private finishWire(): void {
    if (this.wirePts.length >= 2) {
      const wire: Wire = {
        id: uuid(),
        sheetId: this.project.sheets[0].id,
        points: [...this.wirePts],
      };
      addWire(this.project, wire);
      this.bus.emit(Events.ProjectChanged, this.project);
    }
    this.wirePts = [];
    this.render();
  }

  // ------------------------------------------------------------- utilidades

  private toSvg(e: MouseEvent): Point {
    const pt = this.svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = this.svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const r = pt.matrixTransform(ctm.inverse());
    return { x: r.x, y: r.y };
  }

  private snap(p: Point): Point {
    return { x: Math.round(p.x / GRID) * GRID, y: Math.round(p.y / GRID) * GRID };
  }

  private status(msg: string): void {
    this.bus.emit(Events.StatusMessage, msg);
  }

  // ---------------------------------------------------------------- render

  private render(): void {
    if (!this.project) return;
    while (this.svg.firstChild) this.svg.removeChild(this.svg.firstChild);

    this.svg.appendChild(this.buildGrid());

    // cables confirmados
    for (const w of this.project.wires) {
      this.svg.appendChild(this.buildWire(w.points, false));
    }
    // cable en curso + preview al cursor
    if (this.wirePts.length) {
      const pts = [...this.wirePts, this.snap(this.cursor)];
      this.svg.appendChild(this.buildWire(pts, true));
    }

    // dispositivos
    for (const d of this.project.devices) {
      const g = this.buildDevice(d);
      if (g) this.svg.appendChild(g);
    }
  }

  private buildGrid(): SVGGElement {
    const g = document.createElementNS(SVG_NS, "g");
    g.setAttribute("class", "grid");
    for (let x = 0; x <= WIDTH; x += GRID) {
      const line = document.createElementNS(SVG_NS, "line");
      line.setAttribute("x1", `${x}`);
      line.setAttribute("y1", "0");
      line.setAttribute("x2", `${x}`);
      line.setAttribute("y2", `${HEIGHT}`);
      g.appendChild(line);
    }
    for (let y = 0; y <= HEIGHT; y += GRID) {
      const line = document.createElementNS(SVG_NS, "line");
      line.setAttribute("x1", "0");
      line.setAttribute("y1", `${y}`);
      line.setAttribute("x2", `${WIDTH}`);
      line.setAttribute("y2", `${y}`);
      g.appendChild(line);
    }
    return g;
  }

  private buildWire(points: Point[], preview: boolean): SVGPolylineElement {
    const pl = document.createElementNS(SVG_NS, "polyline");
    pl.setAttribute("points", points.map((p) => `${p.x},${p.y}`).join(" "));
    pl.setAttribute("class", preview ? "wire preview" : "wire");
    return pl;
  }

  private buildDevice(d: DeviceInstance): SVGGElement | null {
    const sym = this.host.getSymbol(d.symbolId);
    if (!sym) return null;

    const g = document.createElementNS(SVG_NS, "g");
    g.setAttribute("data-device", d.id);
    g.setAttribute("class", "device" + (d.id === this.selectedId ? " selected" : ""));
    g.setAttribute("transform", `translate(${d.x},${d.y}) rotate(${d.rotation})`);

    // cuerpo del símbolo (markup provisto por el plugin)
    const body = document.createElementNS(SVG_NS, "g");
    body.setAttribute("class", "symbol-body");
    body.innerHTML = sym.svg;
    g.appendChild(body);

    // pines
    for (const pin of sym.pins) {
      const c = document.createElementNS(SVG_NS, "circle");
      c.setAttribute("cx", `${pin.x}`);
      c.setAttribute("cy", `${pin.y}`);
      c.setAttribute("r", "2.5");
      c.setAttribute("class", "pin");
      g.appendChild(c);
    }

    // etiqueta RDS
    const label = document.createElementNS(SVG_NS, "text");
    label.setAttribute("x", `${sym.width + 6}`);
    label.setAttribute("y", "10");
    label.setAttribute("class", "rds");
    label.textContent = d.rds;
    g.appendChild(label);

    // marco de selección
    if (d.id === this.selectedId) {
      const box = document.createElementNS(SVG_NS, "rect");
      box.setAttribute("x", "-4");
      box.setAttribute("y", "-4");
      box.setAttribute("width", `${sym.width + 8}`);
      box.setAttribute("height", `${sym.height + 8}`);
      box.setAttribute("class", "sel-box");
      g.appendChild(box);
    }
    return g;
  }
}
