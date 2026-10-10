import { useEffect, useState } from "preact/hooks";
import { subscribeToast, undoFromToast, type ToastState } from "./toastStore";
import { strings } from "./strings";
import styles from "./Toast.module.css";

/**
 * Always in the page, so its live region is already known to screen readers when a message
 * arrives; hidden by sliding off-screen and made `inert` so a hidden Undo can't be tabbed to.
 */
export function Toast() {
    const [state, setState] = useState<ToastState | null>(null);
    const [lastMessage, setLastMessage] = useState<ToastState | null>(null);
    useEffect(() => subscribeToast(setState), []);
    // Keeps the text while the toast slides away, instead of it emptying mid-animation.
    useEffect(() => {
        if (state) setLastMessage(state);
    }, [state]);

    const shown = state ?? lastMessage;
    return (
        <div class={state ? `${styles.toast} ${styles.visible}` : styles.toast} role="status" aria-live="polite" inert={!state}>
            <span class={styles.message}>{shown?.message ?? ""}</span>
            {shown?.kind === "undo" && (
                <button type="button" class={styles.undo} onClick={undoFromToast}>
                    {strings.undo}
                </button>
            )}
        </div>
    );
}

/** How long the toast takes to slide away (Toast.module.css), so its space outlasts it. */
const SLIDE_MS = 200;

/**
 * Room for the toast at the end of a screen, there only while a toast shows: the toast floats
 * over the bottom of the popup, so without it the last row sits under the toast until it goes.
 * The screen grows by this much (or, when it's already as tall as a popup can be, its list gets
 * this much shorter), so nothing on it moves and nothing is covered.
 */
export function ToastSpace() {
    const [shown, setShown] = useState(false);
    useEffect(() => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        const unsubscribe = subscribeToast((state) => {
            clearTimeout(timer);
            if (state) setShown(true);
            else timer = setTimeout(() => setShown(false), SLIDE_MS);
        });
        return () => {
            clearTimeout(timer);
            unsubscribe();
        };
    }, []);
    return shown ? <div class={styles.space} data-toast-space aria-hidden="true" /> : null;
}

/** A screen's height without the toast's room, so the popup's size floor never keeps that room. */
export function heightWithoutToastSpace(screen: HTMLElement | null): number {
    if (!screen) return 0;
    const space = screen.querySelector<HTMLElement>("[data-toast-space]");
    return screen.offsetHeight - (space?.offsetHeight ?? 0);
}
