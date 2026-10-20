/**
 * Contrato de un plugin de fabricante (modelo "Data Portal").
 * Un plugin NO aporta lógica en esta fase: aporta datos de sus productos.
 * (El SDK de lógica en sandbox llega en una fase posterior.)
 */

export interface PluginManifest {
  id: string; // "acme-electric"
  name: string; // nombre visible del catálogo
  manufacturer: string;
  version: string; // semver
  parts: string; // archivo de partes, relativo a la carpeta del plugin
}

/** Descripción de un símbolo dentro del archivo de partes. */
export interface SymbolSpec {
  file?: string; // "symbols/contactor.svg" (si el SVG está en archivo)
  svg?: string; // SVG inline (alternativa a `file`, útil para bibliotecas grandes)
  width: number;
  height: number;
  pins: { id: string; name: string; x: number; y: number }[];
}

/** Un artículo tal como lo declara el fabricante. */
export interface PartSpec {
  code: string; // "LC1D09"
  family: string; // "Contactor"
  symbol: string; // clave dentro de `symbols`
  attributes: Record<string, string | number>;
  price?: number;
}

export interface PartsFile {
  symbols: Record<string, SymbolSpec>;
  parts: PartSpec[];
}

/** Índice de plugins instalados (en el scaffold se sirve desde public/). */
export interface PluginIndex {
  installed: string[]; // carpetas de plugin bajo /plugins/
}
