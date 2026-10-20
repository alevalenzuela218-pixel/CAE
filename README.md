# TEGSA CAE — Plataforma de diseño de automatismos

Scaffold (**fase F0**) de una plataforma CAE tipo EPLAN para diseñar
automatismos industriales: esquemas eléctricos + layout de tablero, con un
ecosistema de **plugins de fabricante** (modelo Data Portal) e interoperabilidad
BIM prevista.

App de **escritorio** con shell **Tauri (Rust)** y frontend **web (TypeScript +
Vite)**. El frontend corre también en el navegador, así que podés probar todo el
editor sin instalar Rust.

> El plan de ingeniería completo (visión, aportes de las 6 disciplinas,
> arquitectura, modelo de datos, sistema de plugins, normas y roadmap) está en
> el documento que acompaña a este repo.

## Qué funciona

- Editor de esquemas sobre SVG: grilla con snap, colocar símbolos, cablear,
  seleccionar y arrastrar, borrar (Supr).
- **Biblioteca IEC 60617** (plugin `iec-base`): 17 símbolos de potencia y mando
  (interruptor/seccionador 3P, fusible, contactor, relé térmico, motor,
  transformador, contactos NA/NC, bobina, pulsadores, final de carrera,
  selector, lámpara, borne, tierra).
- **Pestaña Tablero 3D**: vista del gabinete en WebGL (riel DIN, canaletas,
  componentes) con órbita/zoom, y **carga de modelos 3D `.glb`** de fabricante.
- Paleta de artículos poblada **desde plugins**; inspector con los atributos del
  artículo seleccionado.
- Numeración RDS automática al colocar (IEC 81346: `-Q1`, `-K1`, `-S1`, `-F1`…).
- Guardar/abrir proyecto (`.tcae`) — en navegador por descarga/subida.
- Dos plugins de ejemplo: `IEC 60617` (símbolos) y `ACME Electric` (productos
  con geometría 3D de ejemplo).

## Correr en el navegador (lo más rápido)

```bash
npm install
npm run dev
```

Abrí http://localhost:5173. No necesitás Rust para esto.

### Probar el flujo

1. Clic en un artículo de la paleta (izquierda) → clic en la hoja para colocarlo.
2. Tecla **W** (o botón "Cable") → clics para los vértices, doble clic o **Enter** para cerrar.
3. Tecla **V** para volver a seleccionar/mover. **Supr** borra lo seleccionado.
4. "Guardar" descarga el `.tcae`; "Abrir" lo vuelve a cargar.

## Correr / compilar como app de escritorio (Tauri)

Requisitos: [Node.js](https://nodejs.org), [Rust](https://rustup.rs) y los
[prerrequisitos de Tauri](https://tauri.app/start/prerequisites/) para tu SO.
En **Windows** eso incluye los *Microsoft C++ Build Tools* (carga de trabajo
"Desktop development with C++") y el runtime *WebView2* (ya viene en Win 10/11).

Probar en modo desarrollo (ventana nativa con recarga):

```bash
npm install
npm run tauri dev
```

Generar el ejecutable / instalador:

```bash
npm install
npm run tauri build
```

La primera compilación tarda varios minutos (compila Rust). Resultado en Windows:

- Ejecutable: `src-tauri\target\release\tegsa-cae.exe`
- Instalador: `src-tauri\target\release\bundle\nsis\TEGSA CAE_0.1.0_x64-setup.exe`

El icono y el empaquetado ya están configurados (`src-tauri/tauri.conf.json`,
`src-tauri/icons/`). Para regenerar el icono desde otra imagen:
`npm run tauri icon ruta/a/imagen.png`.

## Estructura

```
src/
  core/      modelo de datos, bus de eventos, utilidades de proyecto
  editor/    editor SVG de esquemas + paleta
  plugins/   contrato y host de plugins de fabricante
  platform/  guardar/cargar (navegador hoy, comandos Tauri listos)
  ui/        layout, barra de herramientas, inspector
  styles/    design system (tokens, tema claro/oscuro)
src-tauri/   shell de escritorio (Rust): comandos save/load/list_plugins
public/
  plugins/   plugins instalados (servidos por Vite); ver docs/PLUGIN-SPEC.md
docs/        especificación de plugins
```

## Próximos pasos (F1)

- Conectar `save_project` / `load_project` a diálogos nativos de Tauri.
- Motor de netlist: conectar cables a pines reales y numerar potenciales.
- Biblioteca de símbolos IEC propia para arranques de motor típicos.
- Definir el esquema JSON del archivo de proyecto con validación.

Ver `docs/PLUGIN-SPEC.md` para crear un plugin de fabricante.
