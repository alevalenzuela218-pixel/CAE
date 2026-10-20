/**
 * Modelo de datos del proyecto.
 *
 * Separa tres planos que comparten el mismo componente:
 *  - SymbolDef  -> plano lógico / esquema (cómo se dibuja)
 *  - PartDef    -> datos del fabricante (qué es, provisto por un plugin)
 *  - DeviceInstance -> una colocación concreta en una hoja
 *
 * Un mismo contactor es un símbolo en la hoja, un artículo en el catálogo
 * y (en F3) una caja en el 3D, unidos por el id del dispositivo y su RDS.
 */

export interface Point {
  x: number;
  y: number;
}

/** Punto de conexión de un símbolo, relativo a su origen (0,0). */
export interface Pin {
  id: string;
  name: string;
  x: number;
  y: number;
}

/** Definición gráfica de un símbolo (viene de un plugin). */
export interface SymbolDef {
  id: string; // "acme-electric:contactor"
  name: string;
  svg: string; // markup SVG interno, dibujado en un box 0..width/height
  width: number;
  height: number;
  pins: Pin[];
}

/** Artículo del catálogo de un fabricante (viene de un plugin). */
export interface PartDef {
  id: string; // "acme-electric:LC1D09"
  pluginId: string;
  manufacturer: string;
  code: string;
  family: string;
  symbolId: string;
  attributes: Record<string, string | number>;
  price?: number;
}

/** Dispositivo lógico colocado en una hoja. */
export interface DeviceInstance {
  id: string; // uuid interno estable
  rds: string; // designación IEC 81346, p. ej. "-Q1"
  partId: string;
  symbolId: string;
  sheetId: string;
  x: number;
  y: number;
  rotation: number;
}

/** Conexión (potencial/cable) entre puntos de una hoja. */
export interface Wire {
  id: string;
  sheetId: string;
  points: Point[];
}

export interface Sheet {
  id: string;
  name: string;
}

/** Documento raíz. Esto es lo que se serializa al archivo del proyecto. */
export interface Project {
  format: "tegsa-cae/1";
  name: string;
  revision: string;
  sheets: Sheet[];
  devices: DeviceInstance[];
  wires: Wire[];
}
