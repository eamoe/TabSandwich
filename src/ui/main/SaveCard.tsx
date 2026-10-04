import { useEffect, useRef, useState } from "preact/hooks";
import { addTab, type AddTabResult } from "../../domain/TabRepository";
import { UNCATEGORIZED } from "../../domain/CategoryRepository";
import { isSupportedTabUrl } from "../../util/url";
import { writeErrorMessage } from "../errors";
import { CategoryPicker, type PickerOption } from "../CategoryPicker";
import { Icon } from "../Icon";
import { SiteIcon } from "../SiteIcon";
import { showErrorToast } from "../toastStore";
import { strings } from "../strings";
import { siteName } from "./listModel";
import { useActiveTab } from "./useActiveTab";
import styles from "./Hero.module.css";

type Status = "idle" | "saved" | "duplicate";
const STATUS_MS = 2500;

/**
 * The page you're on, a category to save it into, and Save. The page gets its own full-width
 * row so its title is never squeezed by the controls. Feedback lands on the button itself and,
 * for screen readers, in a live region (a button's text changing isn't reliably announced).
 */
export function SaveCard(props: {
    categoryOptions: PickerOption[];
    colorOf: (category: string) => string;
    onSaved: (result: AddTabResult) => void;
}) {
    const tab = useActiveTab();
    const [category, setCategory] = useState(UNCATEGORIZED);
    const [status, setStatus] = useState<Status>("idle");
    const [busy, setBusy] = useState(false);
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    useEffect(() => () => clearTimeout(timer.current), []);

    // A category removed in Settings while it was picked here falls back to Uncategorized.
    const chosen = props.categoryOptions.some((o) => o.value === category) ? category : UNCATEGORIZED;
    const supported = isSupportedTabUrl(tab?.url);

    const flash = (next: Status) => {
        clearTimeout(timer.current);
        setStatus(next);
        timer.current = setTimeout(() => setStatus("idle"), STATUS_MS);
    };

    const save = async () => {
        setBusy(true);
        try {
            // Re-read at click time: Save always saves what is active right now.
            const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!active || !isSupportedTabUrl(active.url)) {
                showErrorToast(strings.onlyWebPages);
                return;
            }
            const result = await addTab({
                title: active.title?.trim() || active.url,
                url: active.url,
                category: chosen === UNCATEGORIZED ? undefined : chosen,
            });
            flash(result.duplicate ? "duplicate" : "saved");
            props.onSaved(result);
        } catch (err) {
            showErrorToast(writeErrorMessage(err));
        } finally {
            setBusy(false);
        }
    };

    const label = status === "saved" ? strings.saved : status === "duplicate" ? strings.alreadySaved : strings.save;
    const saveButton = (
        <button
            id="save-btn"
            type="button"
            class={`${styles.save} ${status === "saved" ? styles.saved : ""} ${status === "duplicate" ? styles.duplicate : ""}`}
            aria-label={status === "idle" ? strings.saveTab : undefined}
            disabled={!supported || busy}
            onClick={save}
        >
            {status === "saved" && <Icon name="check" size={14} />}
            {label}
        </button>
    );

    return (
        <section class={styles.card} aria-label={strings.currentTab}>
            <div class={styles.pageRow}>
                {tab?.url && <SiteIcon url={tab.url} large />}
                <div class={styles.pageText}>
                    <p class={styles.pageTitle}>{tab ? tab.title || tab.url : ""}</p>
                    <p class={styles.pageSite}>{tab === undefined ? "" : supported ? siteName(tab!.url!) : strings.onlyWebPages}</p>
                </div>
                {tab !== undefined && !supported && saveButton}
            </div>
            {(tab === undefined || supported) && (
                <div class={styles.actionRow}>
                    <CategoryPicker
                        id="save-category"
                        label={strings.saveToCategory}
                        value={chosen}
                        options={props.categoryOptions}
                        color={props.colorOf(chosen)}
                        onChange={setCategory}
                    />
                    {saveButton}
                </div>
            )}
            <p class="visually-hidden" role="status" aria-live="polite">
                {status === "idle" ? "" : label}
            </p>
        </section>
    );
}
