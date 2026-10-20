/**
 * Bus de eventos mínimo. El editor y la UI se comunican por aquí en vez de
 * conocerse entre sí. En F1 esto crece a un patrón command con undo/redo.
 */
type Handler<T> = (payload: T) => void;

export class EventBus {
  private handlers = new Map<string, Set<Handler<unknown>>>();

  on<T>(event: string, handler: Handler<T>): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler as Handler<unknown>);
    return () => set!.delete(handler as Handler<unknown>);
  }

  emit<T>(event: string, payload: T): void {
    this.handlers.get(event)?.forEach((h) => h(payload));
  }
}

/** Eventos conocidos de la app (tipado laxo a propósito en el scaffold). */
export const Events = {
  ProjectChanged: "project:changed",
  SelectionChanged: "selection:changed",
  ToolChanged: "tool:changed",
  PluginsLoaded: "plugins:loaded",
  StatusMessage: "status:message",
} as const;
