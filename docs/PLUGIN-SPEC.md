# Especificación de plugins de fabricante (v0)

Un plugin aporta **datos de productos**, no lógica (el SDK de lógica en sandbox
llega en una fase posterior). Es el equivalente a publicar en un "Data Portal".

## Estructura de carpeta

```
mi-fabricante/
  manifest.json        # identidad y versión del catálogo
  parts.json           # símbolos + artículos
  symbols/
    algo.svg           # markup SVG interno (sin etiqueta <svg>)
  geometry/            # (F3) geometría 3D glTF/STEP
  datasheets/          # (opcional) hojas de datos PDF
```

En el scaffold los plugins se sirven desde `public/plugins/` y se declaran en
`public/plugins/index.json`:

```json
{ "installed": ["mi-fabricante"] }
```

## `manifest.json`

```json
{
  "id": "mi-fabricante",
  "name": "Mi Fabricante — Familia X",
  "manufacturer": "Mi Fabricante S.A.",
  "version": "1.0.0",
  "parts": "parts.json"
}
```

El `id` debe ser único: prefija los símbolos y artículos (`mi-fabricante:LC1D09`).

## `parts.json`

Dos bloques: `symbols` (cómo se dibuja) y `parts` (qué se vende).

```json
{
  "symbols": {
    "contactor": {
      "file": "symbols/contactor.svg",
      "width": 40,
      "height": 60,
      "pins": [
        { "id": "1", "name": "1/L1", "x": 8, "y": 0 },
        { "id": "2", "name": "2/T1", "x": 8, "y": 60 }
      ]
    }
  },
  "parts": [
    {
      "code": "LC1D09",
      "family": "Contactor",
      "symbol": "contactor",
      "attributes": { "In": "9 A", "Polos": 3, "Bobina": "24 VDC" },
      "price": 42.0
    }
  ]
}
```

- `pins`: coordenadas **relativas al origen (0,0)** del símbolo. Es lo que el
  motor de netlist usará para conectar cables (F1).
- `attributes`: clave-valor libre (modelo EAV). Cada familia define las suyas.
- `family`: determina el prefijo RDS al colocar (Contactor/Interruptor/Seccionador
  → `-Q`, Motor → `-M`, Borne → `-X`, Fusible/Relé térmico → `-F`,
  Bobina/Contacto → `-K`, Pulsador/Selector/Final de carrera → `-S`,
  Señalización → `-H`, Transformador → `-T`).

### SVG inline

Para bibliotecas grandes, en vez de un archivo por símbolo se puede poner el
markup directamente en `parts.json` con el campo `svg` (en lugar de `file`). Es
lo que usa la biblioteca `iec-base`. El host usa `svg` si está presente, o trae
`file` si no.

## Geometría 3D (.glb)

Cada artículo puede traer su modelo 3D para la vista de tablero, en **glTF
binario (`.glb`)** — el formato que la app muestra en WebGL:

```
mi-fabricante/
  geometry/
    LC1D09.glb
```

Convención de unidades: glTF trabaja en metros; exportá 1 unidad = 1 m y guardá
las cotas reales (ancho en mm, módulos DIN, punto de anclaje al riel, zona de
despeje térmico) como **atributos** en `parts.json`, no dentro de la malla. El
formato fuente del fabricante (STEP, `.stp`) se importará y convertirá a `.glb`
en la fase con kernel geométrico; para interoperar con BIM el tablero se
exportará a IFC. En esta etapa la app ya carga `.glb` desde la pestaña
**Tablero 3D** (botón "Cargar modelo 3D"); ver `public/plugins/acme-electric/geometry/contactor.glb`
como ejemplo.

## Símbolos SVG

Markup interno, **sin** la etiqueta `<svg>` externa, dibujado en el box
`0..width / 0..height`. Usá `currentColor` para que el símbolo respete el tema
claro/oscuro:

```svg
<g stroke="currentColor" fill="none" stroke-width="2">
  <circle cx="20" cy="26" r="15"/>
</g>
<text x="20" y="30" fill="currentColor" stroke="none">M</text>
```

## En producción (Tauri)

Los plugins se instalarán desde archivo o marketplace en la carpeta de datos de
la app. Antes de registrar nada, el host debe: validar el manifiesto, verificar
la **firma** del paquete y comprobar compatibilidad **semver**. Ver `src/plugins/host.ts`.
