/**
 * Paleta de artículos. Se puebla desde el host de plugins y, al hacer clic en
 * un artículo, pone al editor en modo "colocar".
 */
import type { PluginHost } from "../plugins/host";
import type { SchematicEditor } from "./editor";
import type { PartDef } from "../core/model";

export function buildPalette(
  container: HTMLElement,
  host: PluginHost,
  editor: SchematicEditor,
): void {
  container.innerHTML = "";

  // agrupar por fabricante -> familia
  const byMfr = new Map<string, PartDef[]>();
  for (const part of host.allParts()) {
    const list = byMfr.get(part.manufacturer) ?? [];
    list.push(part);
    byMfr.set(part.manufacturer, list);
  }

  if (byMfr.size === 0) {
    container.innerHTML = `<p class="muted">No hay plugins cargados.</p>`;
    return;
  }

  for (const [mfr, parts] of byMfr) {
    const group = document.createElement("div");
    group.className = "palette-group";
    group.innerHTML = `<h4>${mfr}</h4>`;

    for (const part of parts) {
      const item = document.createElement("button");
      item.className = "palette-item";
      item.title = Object.entries(part.attributes)
        .map(([k, v]) => `${k}: ${v}`)
        .join("\n");

      const sym = host.getSymbol(part.symbolId);
      const preview = sym
        ? `<svg viewBox="-4 -4 ${sym.width + 8} ${sym.height + 8}" class="thumb">${sym.svg}</svg>`
        : "";

      item.innerHTML = `
        ${preview}
        <span class="palette-code">${part.code}</span>
        <span class="palette-family">${part.family}</span>
      `;
      item.addEventListener("click", () => editor.startPlacement(part.id));
      group.appendChild(item);
    }
    container.appendChild(group);
  }
}
