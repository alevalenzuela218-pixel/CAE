/**
 * Módulo Tablero 3D.
 *
 * Renderiza la vista 3D del tablero (envolvente, riel DIN, canaletas y
 * componentes) sobre WebGL con Three.js, y permite CARGAR modelos 3D de
 * fabricante en formato glTF (.glb / .gltf) para montarlos en la escena.
 *
 * Alcance de esta etapa: la escena de referencia + carga de .glb. En F3 esto
 * se arma automáticamente a partir de los dispositivos del esquema, tomando la
 * geometría que cada plugin de fabricante aporta (glTF ahora, STEP convertido
 * más adelante) y sumando colisiones y cálculo térmico.
 */
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { EventBus, Events } from "../core/bus";

export class Tablero3D {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private canvas: HTMLCanvasElement;
  private host: HTMLElement;
  private loaded: THREE.Object3D[] = [];
  private raf = 0;
  private running = false;
  private ro?: ResizeObserver;

  constructor(container: HTMLElement, private bus: EventBus) {
    this.host = container;
    this.host.innerHTML = TOOLBAR;

    this.canvas = this.host.querySelector("canvas")!;
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(this.dark() ? 0x0f141b : 0xeef1f4);

    this.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 2000);
    this.camera.position.set(42, 26, 150);

    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.target.set(0, 1, 4);
    this.controls.enableDamping = true;
    this.controls.minDistance = 50;
    this.controls.maxDistance = 360;

    this.buildLights();
    this.buildPanel();
    this.bindUI();

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.host);
  }

  // ------------------------------------------------------------- escena base

  private buildLights(): void {
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const key = new THREE.DirectionalLight(0xffffff, 1.05);
    key.position.set(60, 90, 80);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 10;
    key.shadow.camera.far = 400;
    key.shadow.camera.left = -80;
    key.shadow.camera.right = 80;
    key.shadow.camera.top = 80;
    key.shadow.camera.bottom = -80;
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xdfe8ff, 0.35);
    fill.position.set(-70, 30, 40);
    this.scene.add(fill);
  }

  private box(
    x: number, y: number, z: number,
    w: number, h: number, d: number,
    color: number, opts: { rough?: number; metal?: number } = {},
  ): THREE.Mesh {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({
        color, roughness: opts.rough ?? 0.6, metalness: opts.metal ?? 0.1,
      }),
    );
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    this.scene.add(m);
    return m;
  }

  private buildPanel(): void {
    const PW = 60, PH = 80;
    this.box(0, 0, 0, PW, PH, 1.2, 0xd8dde3, { rough: 0.85, metal: 0.05 });
    const wall = 0x343a42, depth = 15, t = 1.6;
    this.box(-PW / 2 - t / 2, 0, -depth / 2 + 0.5, t, PH + t * 2, depth, wall, { rough: 0.5, metal: 0.3 });
    this.box(PW / 2 + t / 2, 0, -depth / 2 + 0.5, t, PH + t * 2, depth, wall, { rough: 0.5, metal: 0.3 });
    this.box(0, PH / 2 + t / 2, -depth / 2 + 0.5, PW + t * 2, t, depth, wall, { rough: 0.5, metal: 0.3 });
    this.box(0, -PH / 2 - t / 2, -depth / 2 + 0.5, PW + t * 2, t, depth, wall, { rough: 0.5, metal: 0.3 });

    const railZ = 2.2, railH = 3.5, rows = [24, -6];
    for (const ry of rows) this.box(0, ry, railZ, 52, railH, 1.6, 0xb9c0c8, { rough: 0.35, metal: 0.6 });

    const ductC = 0xe9ebee, ductZ = 3.0;
    this.box(-27, 2, ductZ, 4.5, 74, 4.5, ductC, { rough: 0.8 });
    this.box(27, 2, ductZ, 4.5, 74, 4.5, ductC, { rough: 0.8 });
    this.box(0, 39, ductZ, 50, 4.5, 4.5, ductC, { rough: 0.8 });
    this.box(0, 9, ductZ, 50, 4.5, 4.5, ductC, { rough: 0.8 });

    const railFront = railZ + 0.8;
    const mount = (x: number, rowY: number, w: number, h: number, d: number, color: number, o: object) =>
      this.box(x, rowY + railH / 2 + h / 2 - 0.3, railFront + d / 2, w, h, d, color, o);
    mount(-19, 24, 9, 12, 8, 0x272b31, { rough: 0.5 });
    mount(-7, 24, 6.5, 10, 7, 0x3a3f47, { rough: 0.5 });
    mount(2.5, 24, 6.5, 10, 7, 0x3a3f47, { rough: 0.5 });
    mount(16, 24, 15, 10, 5.5, 0x2d6cdf, { rough: 0.4 });
    mount(-19, -6, 5.5, 9, 6.5, 0x272b31, { rough: 0.5 });
    mount(-11, -6, 5.5, 9, 6.5, 0x3a3f47, { rough: 0.5 });
    mount(-3, -6, 5.5, 9, 6.5, 0x3a3f47, { rough: 0.5 });
    for (let i = 0; i < 12; i++) mount(6 + i * 1.6, -6, 1.3, 7, 4.5, 0xcfd4da, { rough: 0.7 });
  }

  // ----------------------------------------------------------- carga de .glb

  private bindUI(): void {
    const input = this.host.querySelector<HTMLInputElement>("#glb-input")!;
    this.host.querySelector("#glb-btn")!.addEventListener("click", () => input.click());
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (file) await this.loadGLB(file);
      input.value = "";
    });
    this.host.querySelector("#glb-clear")!.addEventListener("click", () => this.clearLoaded());
  }

  /** Carga un modelo glTF binario y lo centra/escala dentro de la escena. */
  async loadGLB(file: File): Promise<void> {
    this.status(`Cargando ${file.name}…`);
    try {
      const buf = await file.arrayBuffer();
      const loader = new GLTFLoader();
      const gltf = await loader.parseAsync(buf, "");
      const obj = gltf.scene;

      // normalizar: centrar en origen y escalar a un tamaño visible (~30 u)
      const box = new THREE.Box3().setFromObject(obj);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      const scale = 30 / maxDim;
      obj.position.sub(center.multiplyScalar(scale));
      obj.scale.setScalar(scale);
      obj.position.z += 20; // delante del tablero
      obj.traverse((n) => {
        if ((n as THREE.Mesh).isMesh) {
          n.castShadow = true;
          n.receiveShadow = true;
        }
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
}

const TOOLBAR = `
  <div class="t3d-wrap">
    <div class="t3d-bar">
      <button id="glb-btn" class="btn">Cargar modelo 3D (.glb)</button>
      <button id="glb-clear" class="btn">Quitar importados</button>
      <span class="t3d-hint">Arrastrá para girar · rueda para zoom · botón derecho para desplazar</span>
      <input id="glb-input" type="file" accept=".glb,.gltf,model/gltf-binary" hidden />
    </div>
    <canvas class="t3d-canvas"></canvas>
  </div>
`;
