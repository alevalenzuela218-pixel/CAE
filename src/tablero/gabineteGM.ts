/**
 * Generador paramétrico del gabinete DI Metallo línea GM-E.
 *
 * A partir de las cotas del catálogo (planos R2 del fabricante) construye el
 * gabinete 3D ya armado: cuerpo de chapa, puerta, Bastidor de Montaje (BM) y
 * Contra Frente (CF), seleccionables por medida.
 *
 * Código de catálogo: GM + A + H + P + E  (cada medida en 2 dígitos = mm/100)
 *   A = ancho        300–1200 mm
 *   H = altura       1500–2100 mm
 *   P = profundidad  300–1200 mm
 * Ej.: GM061805E = 600 × 1800 × 500 mm.
 */
import * as THREE from "three";

/** 1 mm = 0.1 unidades de escena. */
const S = 0.1;

export interface GabOpts {
  A: number; // ancho mm
  H: number; // alto mm
  P: number; // profundidad mm
  door: boolean;
  bm: boolean; // bastidor de montaje
  cf: boolean; // contra frente
}

/** Rangos admitidos por el catálogo GM-E (mm). */
export const GM_RANGES = {
  A: range(300, 1200, 100),
  H: range(1500, 2100, 100),
  P: range(300, 1200, 100),
};

function range(a: number, b: number, step: number): number[] {
  const out: number[] = [];
  for (let v = a; v <= b; v += step) out.push(v);
  return out;
}

const pad2 = (mm: number) => String(Math.round(mm / 100)).padStart(2, "0");

/** Código de catálogo DI Metallo para las medidas dadas. */
export function gmCode(o: Pick<GabOpts, "A" | "H" | "P">): string {
  return `GM${pad2(o.A)}${pad2(o.H)}${pad2(o.P)}E`;
}

// --------------------------------------------------------------- materiales
const matBody = () => new THREE.MeshStandardMaterial({ color: 0xd2d7dd, roughness: 0.55, metalness: 0.45 });
const matDoor = () => new THREE.MeshStandardMaterial({ color: 0xc3c9d1, roughness: 0.4, metalness: 0.55 });
const matBM = () => new THREE.MeshStandardMaterial({ color: 0xcc2b2b, roughness: 0.5, metalness: 0.3 });
const matCF = () => new THREE.MeshStandardMaterial({ color: 0xe8820c, roughness: 0.5, metalness: 0.3 });
const matRail = () => new THREE.MeshStandardMaterial({ color: 0xb9c0c8, roughness: 0.35, metalness: 0.6 });
const matHandle = () => new THREE.MeshStandardMaterial({ color: 0x2b2f35, roughness: 0.4, metalness: 0.6 });

function panel(w: number, h: number, d: number, mat: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Marco perimetral (4 barras) en el plano XY, a una profundidad z. */
function frame(w: number, h: number, bar: number, z: number, mat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const top = panel(w, bar, bar, mat); top.position.set(0, h / 2 - bar / 2, z);
  const bot = panel(w, bar, bar, mat); bot.position.set(0, -h / 2 + bar / 2, z);
  const lef = panel(bar, h - bar * 2, bar, mat); lef.position.set(-w / 2 + bar / 2, 0, z);
  const rig = panel(bar, h - bar * 2, bar, mat); rig.position.set(w / 2 - bar / 2, 0, z);
  g.add(top, bot, lef, rig);
  return g;
}

/**
 * Construye el gabinete GM-E centrado en el origen. El frente mira hacia +Z.
 * Devuelve un THREE.Group listo para agregar a la escena.
 */
export function buildGabineteGM(o: GabOpts): THREE.Group {
  const g = new THREE.Group();
  g.name = "gabinete-gm";

  const w = o.A * S, h = o.H * S, d = o.P * S;
  const t = 2 * S; // espesor de chapa 2 mm

  // --- cuerpo de chapa (fondo + techo + base + laterales)
  const back = panel(w, h, t, matBody()); back.position.z = -d / 2; g.add(back);
  const top = panel(w, t, d, matBody()); top.position.y = h / 2; g.add(top);
  const bot = panel(w, t, d, matBody()); bot.position.y = -h / 2; g.add(bot);
  const left = panel(t, h, d, matBody()); left.position.x = -w / 2; g.add(left);
  const right = panel(t, h, d, matBody()); right.position.x = w / 2; g.add(right);

  // --- Bastidor de Montaje (BM): marco rojo retranqueado, con riel DIN
  if (o.bm) {
    const margin = Math.min(40 * S, w * 0.12);
    const bmZ = -d / 2 + d * 0.28;
    const bar = Math.max(18 * S, 25 * S);
    g.add(frame(w - margin * 2, h - margin * 2, bar, bmZ, matBM()));
    // un par de rieles DIN horizontales sobre el bastidor (aspecto "armado")
    const railW = w - margin * 2 - bar * 2;
    for (const fy of [h * 0.22, -h * 0.08]) {
      const rail = panel(railW, 7 * S, 15 * S, matRail());
      rail.position.set(0, fy, bmZ + 8 * S);
      g.add(rail);
    }
  }

  // --- Contra Frente (CF): marco naranja cerca del frente
  if (o.cf) {
    const margin = Math.min(30 * S, w * 0.1);
    const cfZ = d / 2 - d * 0.12;
    const bar = Math.max(16 * S, 22 * S);
    g.add(frame(w - margin * 2, h - margin * 2, bar, cfZ, matCF()));
  }

  // --- Puerta (abisagrada a la izquierda, mostrada entreabierta ~105°)
  if (o.door) {
    const doorPivot = new THREE.Group();
    doorPivot.position.set(-w / 2, 0, d / 2); // bisagra en la arista frontal izquierda
    const door = panel(w, h, t, matDoor());
    door.position.set(w / 2, 0, 0); // desplazada para girar desde la bisagra
    // manija cerca del borde libre
    const handle = panel(4 * S, 90 * S, 12 * S, matHandle());
    handle.position.set(w - 30 * S, 0, 8 * S);
    doorPivot.add(door, handle);
    doorPivot.rotation.y = THREE.MathUtils.degToRad(105);
    g.add(doorPivot);
  }

  return g;
}

/** Radio aproximado de la escena para encuadrar la cámara. */
export function gmRadius(o: GabOpts): number {
  return Math.hypot(o.A * S, o.H * S, o.P * S) / 2;
}
