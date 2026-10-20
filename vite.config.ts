import { defineConfig } from "vite";

// Vite sirve `public/` en la raíz: los plugins de fabricante quedan en
// /plugins/... y el host los carga por fetch. Puerto fijo para que Tauri
// sepa a dónde apuntar en modo dev.
export default defineConfig({
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    target: "es2022",
    outDir: "dist",
  },
});
