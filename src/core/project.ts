/**
 * Operaciones sobre el documento de proyecto: crear, serializar, mutar.
 */
import type { Project, DeviceInstance, Wire } from "./model";

export function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "id-" + Math.random().toString(36).slice(2, 10);
}

export function createProject(name = "Proyecto sin título"): Project {
  return {
    format: "tegsa-cae/1",
    name,
    revision: "A",
    sheets: [{ id: uuid(), name: "01 - Potencia" }],
    devices: [],
    wires: [],
  };
}

export function serialize(project: Project): string {
  return JSON.stringify(project, null, 2);
}

export function deserialize(json: string): Project {
  const data = JSON.parse(json) as Project;
  if (data.format !== "tegsa-cae/1") {
    throw new Error(`Formato de proyecto no soportado: ${data.format}`);
  }
  return data;
}

/**
 * Siguiente RDS libre para una familia. Usa el prefijo IEC típico
 * (Q = maniobra/protección, M = motor, X = bornes, etc.).
 */
export function nextRds(project: Project, prefix: string): string {
  const used = project.devices
    .map((d) => d.rds)
    .filter((r) => r.startsWith(`-${prefix}`))
    .map((r) => parseInt(r.slice(prefix.length + 1), 10))
    .filter((n) => !Number.isNaN(n));
  const next = used.length ? Math.max(...used) + 1 : 1;
  return `-${prefix}${next}`;
}

export function addDevice(project: Project, device: DeviceInstance): void {
  project.devices.push(device);
}

export function addWire(project: Project, wire: Wire): void {
  project.wires.push(wire);
}

export function removeDevice(project: Project, id: string): void {
  project.devices = project.devices.filter((d) => d.id !== id);
}
