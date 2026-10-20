/**
 * Host de plugins. Lee el índice de plugins instalados, carga cada manifiesto
 * y su archivo de partes, trae los símbolos SVG y arma un registro unificado
 * de SymbolDef + PartDef que el resto de la app consume.
 *
 * En el scaffold los plugins se sirven desde `public/plugins/`. En producción
 * (Tauri) el host leería la carpeta de datos de la app vía un comando Rust,
 * validando firma y semver antes de registrar nada.
 */
import type { SymbolDef, PartDef } from "../core/model";
import type { PluginIndex, PluginManifest, PartsFile } from "./types";

export interface LoadedPlugin {
  manifest: PluginManifest;
  parts: PartDef[];
}

export class PluginHost {
  private symbols = new Map<string, SymbolDef>();
  private parts = new Map<string, PartDef>();
  private plugins: LoadedPlugin[] = [];

  /** Carga todos los plugins declarados en /plugins/index.json. */
  async loadAll(base = "/plugins"): Promise<void> {
    const index = (await fetchJson(`${base}/index.json`)) as PluginIndex;
    for (const dir of index.installed) {
      try {
        await this.loadOne(`${base}/${dir}`);
      } catch (err) {
        console.error(`No se pudo cargar el plugin "${dir}":`, err);
      }
    }
  }

  private async loadOne(dir: string): Promise<void> {
    const manifest = (await fetchJson(`${dir}/manifest.json`)) as PluginManifest;
    const partsFile = (await fetchJson(`${dir}/${manifest.parts}`)) as PartsFile;

    // Registrar símbolos: usa el SVG inline si existe, o lo trae del archivo.
    for (const [key, spec] of Object.entries(partsFile.symbols)) {
      const svg = spec.svg ?? (spec.file ? await fetchText(`${dir}/${spec.file}`) : "");
      const id = `${manifest.id}:${key}`;
      this.symbols.set(id, {
        id,
        name: key,
        svg,
        width: spec.width,
        height: spec.height,
        pins: spec.pins,
      });
    }

    // Registrar artículos.
    const parts: PartDef[] = partsFile.parts.map((p) => ({
      id: `${manifest.id}:${p.code}`,
      pluginId: manifest.id,
      manufacturer: manifest.manufacturer,
      code: p.code,
      family: p.family,
      symbolId: `${manifest.id}:${p.symbol}`,
      attributes: p.attributes,
      price: p.price,
    }));
    parts.forEach((p) => this.parts.set(p.id, p));

    this.plugins.push({ manifest, parts });
  }

  getSymbol(id: string): SymbolDef | undefined {
    return this.symbols.get(id);
  }

  getPart(id: string): PartDef | undefined {
    return this.parts.get(id);
  }

  allParts(): PartDef[] {
    return [...this.parts.values()];
  }

  loadedPlugins(): LoadedPlugin[] {
    return this.plugins;
  }
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} al pedir ${url}`);
  return res.json();
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} al pedir ${url}`);
  return res.text();
}
