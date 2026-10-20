/**
 * Módulo Tablero 3D.
 *
 * Muestra el gabinete seleccionado del catálogo DI Metallo GM-E, generado en
 * 3D a partir de sus cotas (ancho/alto/profundidad) y opciones (puerta, BM, CF),
 * sobre WebGL con Three.js. Permite además CARGAR modelos glTF (.glb/.gltf) de
 * fabricante para montarlos dentro del gabinete.
 *
 * En F3 el contenido del gabinete se arma automáticamente desde el esquema,
 * sumando colisiones y cálculo térmico.
 */
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { EventBus, Events } from "../core/bus";
import { buildGabineteGM, gmCode, gmRadius, GM_RANGES, type GabOpts } from "./gabineteGM";

export class Tablero3D {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private canvas: HTMLCanvasElement;
  private host: HTMLElement;
  private cabinet: THREE.Group | null = null;
  private loaded: THREE.Object3D[] = [];
  private raf = 0;
  private running = false;
  private ro?: ResizeObserver;

  private opts: GabOpts = { A: 600, H: 1800, P: 500, door: false, bm: true, cf: false };

  constructor(container: HTMLElement, private bus: EventBus) {
    this.host = container;
    this.host.innerHTML = this.toolbar();

    this.canvas = this.host.querySelector("canvas")!;
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(this.dark() ? 0x0f141b : 0xeef1f4);

    this.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 4000);
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;

    this.buildLights();
    this.bindUI();
    this.rebuild();

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.host);
  }

  // ------------------------------------------------------------- escena

  private buildLights(): void {
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const key = new THREE.DirectionalLight(0xffffff, 1.0);
    key.position.set(120, 200, 180);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 10;
    key.shadow.camera.far = 900;
    key.shadow.camera.left = -180;
    key.shadow.camera.right = 180;
    key.shadow.camera.top = 180;
    key.shadow.camera.bottom = -180;
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xdfe8ff, 0.35);
    fill.position.set(-140, 60, 80);
    this.scene.add(fill);
  }

  /** Reconstruye el gabinete según la selección actual y reencuadra la cámara. */
  private rebuild(): void {
    if (this.cabinet) {
      this.scene.remove(this.cabinet);
      this.cabinet = null;
    }
    this.cabinet = buildGabineteGM(this.opts);
    this.scene.add(this.cabinet);
    this.fitCamera();

    const code = gmCode(this.opts);
    const el = this.host.querySelector("#gm-code");
    if (el) el.textContent = `${code}  ·  ${this.opts.A} × ${this.opts.H} × ${this.opts.P} mm`;
    this.status(`Gabinete ${code} (${this.opts.A}×${this.opts.H}×${this.opts.P} mm)`);
  }

  private fitCamera(): void {
    const r = gmRadius(this.opts);
    const dist = r * 3.1;
    this.camera.position.set(dist * 0.55, dist * 0.35, dist * 0.9);
    this.controls.target.set(0, 0, 0);
    this.controls.minDistance = r * 1.2;
    this.controls.maxDistance = r * 8;
    this.controls.update();
  }

  // ----------------------------------------------------------- UI / eventos

  private bindUI(): void {
    const selA = this.host.querySelector<HTMLSelectElement>("#gm-a")!;
    const selH = this.host.querySelector<HTMLSelectElement>("#gm-h")!;
    const selP = this.host.querySelector<HTMLSelectElement>("#gm-p")!;
    selA.addEventListener("change", () => { this.opts.A = +selA.value; this.rebuild(); });
    selH.addEventListener("change", () => { this.opts.H = +selH.value; this.rebuild(); });
    selP.addEventListener("change", () => { this.opts.P = +selP.value; this.rebuild(); });

    const bind = (id: string, key: "door" | "bm" | "cf") => {
      const cb = this.host.querySelector<HTMLInputElement>(id)!;
      cb.addEventListener("change", () => { this.opts[key] = cb.checked; this.rebuild(); });
    };
    bind("#gm-door", "door");
    bind("#gm-bm", "bm");
    bind("#gm-cf", "cf");

    const input = this.host.querySelector<HTMLInputElement>("#glb-input")!;
    this.host.querySelector("#glb-btn")!.addEventListener("click", () => input.click());
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (file) await this.loadGLB(file);
      input.value = "";
    });
    this.host.querySelector("#glb-clear")!.addEventListener("click", () => this.clearLoaded());
  }

  /** Carga un modelo glTF binario y lo monta dentro del gabinete. */
  async loadGLB(file: File): Promise<void> {
    this.status(`Cargando ${file.name}…`);
    try {
      const buf = await file.arrayBuffer();
      const loader = new GLTFLoader();
      const gltf = await loader.parseAsync(buf, "");
      const obj = gltf.scene;

      const box = new THREE.Box3().setFromObject(obj);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const target = gmRadius(this.opts) * 0.6;
      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      const scale = target / maxDim;
      obj.position.sub(center.multiplyScalar(scale));
      obj.scale.setScalar(scale);
      obj.traverse((n) => {
        if ((n as THREE.Mesh).isMesh) { n.castShadow = true; n.receiveShadow = true; }
      });

      this.scene.add(obj);
      this.loaded.push(obj);
      this.status(`Cargado ${file.name} (${this.loaded.length} modelo(s) importado(s))`);
    } catch (err) {
      console.error(err);
      this.status(`No se pudo cargar ${file.name}: ¿es un .glb/.gltf válido?`);
    }
  }

  private clearLoaded(): void {
    for (const o of this.loaded) this.scene.remove(o);
    this.loaded = [];
    this.status("Modelos importados quitados");
  }

  // ---------------------------------------------------------------- ciclo

  start(): void {
    if (this.running) return;
    this.running = true;
    this.resize();
    const loop = () => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };
    loop();
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  private resize(): void {
    const w = this.canvas.clientWidth || this.host.clientWidth;
    const h = this.canvas.clientHeight || this.host.clientHeight;
    if (w === 0 || h === 0) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private dark(): boolean {
    return matchMedia("(prefers-color-scheme: dark)").matches;
  }

  private status(msg: string): void {
    this.bus.emit(Events.StatusMessage, msg);
  }

  // ---------------------------------------------------------------- markup

  private options(vals: number[], sel: number): string {
    return vals.map((v) => `<option value="${v}"${v === sel ? " selected" : ""}>${v}</option>`).join("");
  }

  private toolbar(): string {
    return `
      <div class="t3d-wrap">
        <div class="t3d-bar">
          <span class="t3d-brand">DI&nbsp;Metallo GM-E</span>
          <label class="t3d-field">Ancho
            <select id="gm-a">${this.options(GM_RANGES.A, this.opts.A)}</select>
          </label>
          <label class="t3d-field">Alto
            <select id="gm-h">${this.options(GM_RANGES.H, this.opts.H)}</select>
          </label>
          <label class="t3d-field">Prof.
            <select id="gm-p">${this.options(GM_RANGES.P, this.opts.P)}</select>
          </label>
          <label class="t3d-check"><input type="checkbox" id="gm-door"> Puerta</label>
          <label class="t3d-check"><input type="checkbox" id="gm-bm" checked> BM</label>
          <label class="t3d-check"><input type="checkbox" id="gm-cf"> CF</label>
          <span id="gm-code" class="t3d-code"></span>
        </div>
        <div class="t3d-bar t3d-bar2">
          <button id="glb-btn" class="btn">Cargar modelo 3D (.glb)</button>
          <button id="glb-clear" class="btn">Quitar importados</button>
          <span class="t3d-hint">Arrastrá para girar · rueda para zoom · botón derecho para desplazar</span>
          <input id="glb-input" type="file" accept=".glb,.gltf,model/gltf-binary" hidden />
        </div>
        <canvas class="t3d-canvas"></canvas>
      </div>
    `;
  }
}
