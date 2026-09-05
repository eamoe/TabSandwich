import { getElement } from "../dom/domHelper";

const TOAST_DURATION_MS = 8000;

let hideTimeout: number | undefined;
let pendingUndo: (() => void | Promise<void>) | undefined;

/**
 * Visibility toggles a class (not [hidden]) so the toast can transition in/out, and `inert`
 * goes with it — pointer-events alone (set via the class) blocks clicks but not Tab, and this
 * is exactly the "collapsed but still reachable by keyboard" bug already fixed once for the
 * manual-entry form (see HeroRenderer). role="status"/aria-live sit on the element permanently
 * rather than only while visible, since a live region only reliably announces content changes
 * in something already present in the accessibility tree — toggling [hidden] off at the same
 * moment the text is set is the fragile version of this same problem.
 */
function setVisible(visible: boolean): void {
    const toast = getElement<HTMLElement>("toast");
    toast.classList.toggle("visible", visible);
    toast.inert = !visible;
}

function hide(): void {
    if (hideTimeout) window.clearTimeout(hideTimeout);
    hideTimeout = undefined;
    pendingUndo = undefined;
    setVisible(false);
}

/**
 * Shows a single dismissible toast with an Undo action, auto-hiding after 8s. Only one is ever
 * in flight — a second call (e.g. deleting again before the first one times out) replaces it
 * outright rather than queuing. That's safe here specifically because the action being offered
 * undo for has already committed to storage immediately (see TabRepository.deleteTab): there's
 * nothing left to lose by abandoning an earlier, still-open undo window.
 */
export function showUndoToast(message: string, onUndo: () => void | Promise<void>): void {
    if (hideTimeout) window.clearTimeout(hideTimeout);

    getElement<HTMLElement>("toast-message").textContent = message;
    pendingUndo = onUndo;
    setVisible(true);

    hideTimeout = window.setTimeout(hide, TOAST_DURATION_MS);
}

export function initToast(): void {
    setVisible(false);
    getElement<HTMLButtonElement>("toast-undo").addEventListener("click", () => {
        const undo = pendingUndo;
        hide();
        undo?.();
    });
}
