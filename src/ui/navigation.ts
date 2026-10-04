/**
 * Which screen is showing: the main list or Settings. Shared state because, during the v3.0
 * rebuild, the main screen is Preact and Settings is still the vanilla screen in popup.html;
 * both switch through here. Once Settings is rebuilt this can become App state.
 */
export type View = "main" | "settings";

let view: View = "main";
const listeners = new Set<(view: View) => void>();

export function currentView(): View {
    return view;
}

export function showView(next: View): void {
    if (next === view) return;
    view = next;
    for (const listener of listeners) listener(view);
}

export function onViewChange(listener: (view: View) => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}
