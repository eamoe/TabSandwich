/**
 * The one toast at the bottom of the popup: "Deleted" with Undo, or an error with no action.
 * A tiny store rather than component state so both the Preact screens and the Settings screen
 * (still vanilla until it is rebuilt) can show it. Only one toast is ever shown: a new one
 * replaces the old. That's safe because whatever the old one offered to undo was already saved.
 */

export interface ToastState {
    message: string;
    kind: "undo" | "error";
    /** Bumped on every show, so the toast re-announces and restarts its timer even for the same message. */
    seq: number;
}

const UNDO_DURATION_MS = 8000;
const ERROR_DURATION_MS = 6000;

let current: ToastState | null = null;
let pendingUndo: (() => void | Promise<void>) | undefined;
let hideTimer: ReturnType<typeof setTimeout> | undefined;
let seq = 0;
const listeners = new Set<(state: ToastState | null) => void>();

function publish(next: ToastState | null): void {
    current = next;
    for (const listener of listeners) listener(current);
}

function show(message: string, kind: ToastState["kind"], durationMs: number): void {
    if (hideTimer) clearTimeout(hideTimer);
    publish({ message, kind, seq: ++seq });
    hideTimer = setTimeout(hideToast, durationMs);
}

export function showUndoToast(message: string, onUndo: () => void | Promise<void>): void {
    pendingUndo = onUndo;
    show(message, "undo", UNDO_DURATION_MS);
}

export function showErrorToast(message: string): void {
    pendingUndo = undefined;
    show(message, "error", ERROR_DURATION_MS);
}

export function hideToast(): void {
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = undefined;
    pendingUndo = undefined;
    publish(null);
}

/** Runs the pending undo (if any) and closes the toast first, so a second click can't undo twice. */
export function undoFromToast(): void {
    const undo = pendingUndo;
    hideToast();
    void undo?.();
}

export function subscribeToast(listener: (state: ToastState | null) => void): () => void {
    listeners.add(listener);
    listener(current);
    return () => listeners.delete(listener);
}
