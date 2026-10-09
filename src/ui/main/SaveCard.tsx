import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import type { SavedTab, TabGroup } from "../../types";
import { addTab, MAX_NOTE_LENGTH, refreshTab, type AddTabResult } from "../../domain/TabRepository";
import { getTabCategory, UNCATEGORIZED } from "../../domain/CategoryRepository";
import { isSupportedTabUrl, urlsMatch } from "../../util/url";
import { daysSince } from "../../util/time";
import { writeErrorMessage } from "../errors";
import { CategoryPicker, type PickerOption } from "../CategoryPicker";
import { Icon } from "../Icon";
import { SiteIcon } from "../SiteIcon";
import { showErrorToast } from "../toastStore";
import { strings } from "../strings";
import { siteName } from "./listModel";
import { SaveWindow } from "./SaveWindow";
import { useActiveTab } from "./useActiveTab";
import controls from "../controls.module.css";
import styles from "./Hero.module.css";

type Status = "idle" | "saved" | "duplicate" | "updated";
const STATUS_MS = 2500;

/**
 * The page you're on, a category to save it into, and Save. The page gets its own full-width
 * row so its title is never squeezed by the controls. Feedback lands on the button itself and,
 * for screen readers, in a live region (a button's text changing isn't reliably announced).
 *
 * A page that's already saved says so straight away — when, and in which category (the picker
 * starts on it) — and offers Show (find it in the list) and Update (bring the saved copy up to
 * date with the page) instead of a Save that could only answer "Already saved".
 *
 * Its last line saves every tab in the window at once (SaveWindow).
 */
export function SaveCard(props: {
    tabs: SavedTab[];
    categoryOptions: PickerOption[];
    colorOf: (category: string) => string;
    onSaved: (result: AddTabResult) => void;
    onShow: (id: string) => void;
    /** The page's saved copy is archived: Restore brings it back to the list. */
    onRestore: (id: string) => void;
    onUpdated: (previous: SavedTab) => void;
    onWindowSaved: (added: SavedTab[], group: TabGroup | null) => void;
}) {
    const tab = useActiveTab();
    // What you picked, and for which saved copy (none: a page not saved yet).
    const [picked, setPicked] = useState<{ forId: string | undefined; value: string } | null>(null);
    const [status, setStatus] = useState<Status>("idle");
    const [busy, setBusy] = useState(false);
    // A note to save with the page: closed until "Add a note" opens it (null), then what's typed.
    const [note, setNote] = useState<string | null>(null);
    const noteInput = useRef<HTMLInputElement>(null);
    useLayoutEffect(() => {
        if (note === "") noteInput.current?.focus();
    }, [note === null]);
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    useEffect(() => () => clearTimeout(timer.current), []);

    const supported = isSupportedTabUrl(tab?.url);
    const savedCopy = supported ? props.tabs.find((t) => urlsMatch(t.url, tab!.url!)) : undefined;
    // The picker follows the page: the saved copy's category on a saved page, Uncategorized on a
    // new one, until you pick something for that page. Worked out as the card renders (not in a
    // later effect), so it never shows the wrong category for a moment, or overwrites a pick.
    const category =
        picked && picked.forId === savedCopy?.id ? picked.value : savedCopy ? getTabCategory(savedCopy) : UNCATEGORIZED;
    const setCategory = (value: string) => setPicked({ forId: savedCopy?.id, value });

    // A category removed in Settings while it was picked here falls back to Uncategorized.
    const chosen = props.categoryOptions.some((o) => o.value === category) ? category : UNCATEGORIZED;
    // "Saved!" gets its moment on the Save button before the card settles into its saved look.
    const showSaved = savedCopy !== undefined && status !== "saved" && status !== "duplicate";

    const flash = (next: Status) => {
        clearTimeout(timer.current);
        setStatus(next);
        timer.current = setTimeout(() => setStatus("idle"), STATUS_MS);
    };

    /** The active tab right now: Save and Update always act on what is active at click time. */
    const activePage = async () => {
        const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!active || !isSupportedTabUrl(active.url)) {
            showErrorToast(strings.onlyWebPages);
            return null;
        }
        return { title: active.title?.trim() || active.url!, url: active.url! };
    };

    const save = async () => {
        setBusy(true);
        try {
            const page = await activePage();
            if (!page) return;
            const result = await addTab({ ...page, category: chosen === UNCATEGORIZED ? undefined : chosen, note: note ?? undefined });
            flash(result.duplicate ? "duplicate" : "saved");
            if (!result.duplicate) setNote(null);
            props.onSaved(result);
        } catch (err) {
            showErrorToast(writeErrorMessage(err));
        } finally {
            setBusy(false);
        }
    };

    const update = async () => {
        if (!savedCopy) return;
        setBusy(true);
        try {
            const page = await activePage();
            if (!page) return;
            const previous = await refreshTab(savedCopy.id, { ...page, category: chosen === UNCATEGORIZED ? undefined : chosen });
            if (!previous) return;
            flash("updated");
            props.onUpdated(previous);
        } catch (err) {
            showErrorToast(writeErrorMessage(err));
        } finally {
            setBusy(false);
        }
    };

    const label =
        status === "saved" ? strings.saved : status === "duplicate" ? strings.alreadySaved : status === "updated" ? strings.updatedButton : strings.save;
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
                    {showSaved ? (
                        <p class={styles.pageSite}>
                            <span class={styles.savedNote}>
                                <Icon name={savedCopy.archivedAt ? "archive" : "check"} size={12} />
                                {savedCopy.archivedAt ? strings.inYourArchive : strings.savedAgo(daysSince(savedCopy.savedAt))}
                            </span>
                            {" · "}
                            {siteName(tab!.url!)}
                        </p>
                    ) : (
                        <p class={styles.pageSite}>
                            {tab === undefined ? "" : supported ? siteName(tab!.url!) : strings.onlyWebPages}
                            {supported && note === null && (
                                <>
                                    {" · "}
                                    <button type="button" class={styles.addNote} onClick={() => setNote("")}>
                                        {strings.addNote}
                                    </button>
                                </>
                            )}
                        </p>
                    )}
                </div>
                {tab !== undefined && !supported && saveButton}
            </div>
            {supported && !showSaved && note !== null && (
                <div class={styles.noteRow}>
                    <label for="save-note" class="visually-hidden">
                        {strings.noteLabel}
                    </label>
                    <input
                        ref={noteInput}
                        id="save-note"
                        class={controls.field}
                        type="text"
                        maxLength={MAX_NOTE_LENGTH}
                        placeholder={strings.notePlaceholder}
                        value={note}
                        onInput={(e) => setNote(e.currentTarget.value)}
                        onKeyDown={(e) => {
                            // Enter saves, as the Save button does; Escape puts the note away.
                            if (e.key === "Enter") {
                                e.preventDefault();
                                void save();
                            } else if (e.key === "Escape") {
                                e.preventDefault();
                                e.stopPropagation();
                                setNote(null);
                            }
                        }}
                    />
                </div>
            )}
            {(tab === undefined || supported) && (
                <div class={styles.actionRow}>
                    <CategoryPicker
                        id="save-category"
                        label={showSaved ? strings.categoryOfSaved : strings.saveToCategory}
                        value={chosen}
                        options={props.categoryOptions}
                        color={props.colorOf(chosen)}
                        onChange={setCategory}
                    />
                    {showSaved ? (
                        <>
                            {savedCopy.archivedAt ? (
                                <button type="button" class={controls.btn} title={strings.restoreSavedTooltip} onClick={() => props.onRestore(savedCopy.id)}>
                                    {strings.restore}
                                </button>
                            ) : (
                                <button type="button" class={controls.btn} title={strings.showTooltip} onClick={() => props.onShow(savedCopy.id)}>
                                    {strings.show}
                                </button>
                            )}
                            <button
                                type="button"
                                class={`${styles.save} ${styles.update} ${status === "updated" ? styles.saved : ""}`}
                                title={strings.updateTooltip}
                                disabled={busy}
                                onClick={update}
                            >
                                {status === "updated" && <Icon name="check" size={14} />}
                                {status === "updated" ? strings.updatedButton : strings.update}
                            </button>
                        </>
                    ) : (
                        saveButton
                    )}
                </div>
            )}
            {tab !== undefined && (
                // On a page that's already saved, the picker shows that one page's category, which
                // says nothing about the rest of the window: those go to Uncategorized.
                <SaveWindow tabs={props.tabs} category={showSaved || chosen === UNCATEGORIZED ? undefined : chosen} onSaved={props.onWindowSaved} />
            )}
            <p class="visually-hidden" role="status" aria-live="polite">
                {status === "idle" ? "" : label}
            </p>
        </section>
    );
}
