# Catálogo de gabinetes DI Metallo — línea GM-E

Gabinetes modelados en 3D de forma paramétrica a partir de los planos R2 del
fabricante. Se eligen por medida desde la pestaña **Tablero 3D**.

## Código de catálogo

```
GM  AA  HH  PP  E
    │   │   │
    │   │   └─ Profundidad P = PP × 100 mm   (03–12 → 300–1200 mm)
    │   └───── Altura       H = HH × 100 mm   (15–21 → 1500–2100 mm)
    └───────── Ancho        A = AA × 100 mm   (03–12 → 300–1200 mm)
```

Ejemplo: **GM061805E** = 600 × 1800 × 500 mm.

## Rangos

| Medida | Mínimo | Máximo | Paso | Valores |
| --- | --- | --- | --- | --- |
| Ancho A (mm) | 300 | 1200 | 100 | 10 |
| Altura H (mm) | 1500 | 2100 | 100 | 7 |
| Profundidad P (mm) | 300 | 1200 | 100 | 10 |

Total: 700 combinaciones, todas generadas paramétricamente (no hay 700 archivos).

## Opciones de armado

- **Puerta**: hoja frontal abisagrada.
- **BM — Bastidor de Montaje**: marco perimetral interno (rojo en los planos),
  con puntos de fijación y rieles DIN.
- **CF — Contra Frente**: marco perimetral cercano al frente (naranja en los
  planos).

## Implementación

El generador vive en `src/tablero/gabineteGM.ts` (`buildGabineteGM(opts)`), que
construye el gabinete en Three.js a escala (1 mm = 0,1 unidad). El selector por
medidas está en la barra de la pestaña Tablero 3D (`src/tablero/tablero3d.ts`).

Los planos de origen (vistas frente/lateral/superior, R2) están en `docs/planos-gm-e/`.
