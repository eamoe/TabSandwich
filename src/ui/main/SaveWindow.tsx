import { useState } from "preact/hooks";
import type { SavedTab } from "../../types";
import { addTabs } from "../../domain/TabRepository";
import { closableTabIds, planWindowSave } from "../../domain/windowSave";
import { writeErrorMessage } from "../errors";
import { Icon } from "../Icon";
import { showErrorToast } from "../toastStore";
import { strings } from "../strings";
import { ALL_TABS_PERMISSION, useWindowTabs } from "./useWindowTabs";
import styles from "./Hero.module.css";

type Phase =
    | { kind: "idle" }
    | { kind: "busy" }
    | { kind: "denied" }
    | { kind: "saved"; count: number; alreadySaved: number; browserPages: number }
    | { kind: "closed"; count: number };

/**
 * "Save all tabs in this window": the last line of the save card. Reading every open tab needs
 * Chrome's optional "tabs" permission, asked for the first time you use it (and only then);
 * saying no saves nothing and leaves everything else as it was. Afterwards the line says
 * exactly what was saved and skipped, and offers to close the saved tabs — it never closes
 * anything by itself.
 */
export function SaveWindow(props: { tabs: SavedTab[]; category: string | undefined; onSaved: (added: SavedTab[]) => void }) {
    const windowTabs = useWindowTabs();
    const [phase, setPhase] = useState<Phase>({ kind: "idle" });

    const save = () => {
        // Chrome only shows its permission prompt for a click, so it's asked for here, before
        // anything else is awaited.
        const allowed = windowTabs?.canSeeAll ? Promise.resolve(true) : chrome.permissions.request(ALL_TABS_PERMISSION);
        setPhase({ kind: "busy" });
        void (async () => {
            try {
                if (!(await allowed)) return setPhase({ kind: "denied" });
                // Read again now that every tab can be seen, so the save matches the window right now.
                const open = await chrome.tabs.query({ currentWindow: true });
                const plan = planWindowSave(open, props.tabs);
                const result = await addTabs(plan.toSave, props.category);
                setPhase({ kind: "saved", count: result.added.length, alreadySaved: plan.alreadySaved + result.duplicates, browserPages: plan.browserPages });
                if (result.added.length > 0) props.onSaved(result.added);
            } catch (err) {
                setPhase({ kind: "idle" });
                showErrorToast(writeErrorMessage(err));
            }
        })();
    };

    const close = async (ids: number[]) => {
        try {
            await chrome.tabs.remove(ids);
            setPhase({ kind: "closed", count: ids.length });
        } catch (err) {
            showErrorToast(writeErrorMessage(err));
        }
    };

    if (!windowTabs) return null;

    if (phase.kind === "saved" || phase.kind === "closed") {
        const closable = phase.kind === "saved" ? closableTabIds(windowTabs.tabs, props.tabs) : [];
        const skipped = phase.kind === "saved" ? phase.alreadySaved + phase.browserPages : 0;
        // Why each was skipped: on hover, and read out with the count.
        const why = phase.kind === "saved" ? strings.windowSkipped(phase.alreadySaved, phase.browserPages) : "";
        return (
            <div class={styles.windowRow}>
                <p class={styles.windowNote} role="status">
                    <span class={styles.savedNote}>
                        <Icon name="check" size={12} />
                        {phase.kind === "saved" ? strings.windowSaved(phase.count) : strings.closedTabs(phase.count)}
                    </span>
                    {skipped > 0 && (
                        <span class={styles.skipped} title={why}>
                            {" · "}
                            {strings.windowSkippedCount(skipped)}
                            <span class="visually-hidden">{` (${why})`}</span>
                        </span>
                    )}
                </p>
                {closable.length > 0 && (
                    <button type="button" class={styles.inlineLink} title={strings.closeTabsTooltip} onClick={() => close(closable)}>
                        {strings.closeTabs(closable.length)}
                    </button>
                )}
            </div>
        );
    }

    // With the permission, the line counts exactly what's new; without it, every tab in the window.
    const plan = windowTabs.canSeeAll ? planWindowSave(windowTabs.tabs, props.tabs) : null;
    const count = plan ? plan.toSave.length : windowTabs.tabs.length;
    if (plan ? count === 0 : count < 2) return null;

    return (
        <div class={styles.windowRow}>
            {phase.kind === "denied" && (
                <p class={styles.windowNote} role="alert">
                    {strings.windowDenied}
                </p>
            )}
            <button type="button" class={styles.windowLink} title={strings.saveWindowTooltip} disabled={phase.kind === "busy"} onClick={save}>
                <Icon name="tabs" size={14} />
                {phase.kind === "busy" ? strings.savingWindow : phase.kind === "denied" ? strings.tryAgain : plan ? strings.saveWindowNew(count) : strings.saveWindowAll(count)}
            </button>
        </div>
    );
}
