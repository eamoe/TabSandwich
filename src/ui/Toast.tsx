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
