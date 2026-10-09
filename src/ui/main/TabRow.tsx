import { useLayoutEffect, useRef, useState } from "preact/hooks";
import type { SavedTab } from "../../types";
import type { MatchRange, SearchMatch } from "../../domain/search";
import { normalizeUrl } from "../../util/url";
import { daysSince } from "../../util/time";
import { CategoryPicker, type PickerOption } from "../CategoryPicker";
import { Icon } from "../Icon";
import { SiteIcon } from "../SiteIcon";
import { strings } from "../strings";
import { siteName } from "./listModel";
import controls from "../controls.module.css";
import styles from "./TabList.module.css";

/** How an edit's save went: the edit row needs this before it can decide whether to close. */
export type EditOutcome = { status: "saved" } | { status: "failed" } | { status: "duplicate"; existingTitle: string };

export interface RowProps {
    tab: SavedTab;
    category: string;
    color: string;
    tinted: boolean;
    outdated: boolean;
    /** While searching: what matched, highlighted in the title, the category and the window name. */
    match: SearchMatch | null;
    showCategory: boolean;
    /** The saved window this tab is in, named on the row while searching (results show every tab on its own). */
    windowName: string | null;
    /** How the row arrives: rising in with the rest on open, dropping in later, or not animated (while searching). */
    entrance: "rise" | "drop" | "none";
    entranceDelayMs: number;
    flashSeq: number | null;
    draggable: boolean;
    /**
     * The row the keyboard is on. Only its buttons are in the Tab order, so Tab moves past the
     * list in one step and the arrow keys move between rows (see TabList).
     */
    current: boolean;
    dragging: boolean;
    /** A tab is being dragged over this row: the line shows where it would land, above or below. */
    dropSide: "before" | "after" | null;
    /**
     * Choosing several tabs: the row becomes a checkbox (clicking it, or Space, selects it
     * rather than opening the tab), and its own edit and delete step aside.
     */
    selecting: boolean;
    selected: boolean;
    /** `range`: Shift was held, selecting everything from the last row picked. */
    onToggleSelect: (range: boolean) => void;
    editOptions: PickerOption[];
    colorOf: (category: string) => string;
    onOpen: () => void;
    onEdit: (updates: { title: string; url: string; category: string }) => Promise<EditOutcome>;
    onTogglePin: () => void;
    /** Resolves false when the delete couldn't be saved, so the row comes back. */
    onDelete: () => Promise<boolean>;
    dragHandlers: {
        onDragStart: (e: DragEvent) => void;
        onDragEnd: () => void;
        onDragOver: (e: DragEvent) => void;
        onDragLeave: () => void;
        onDrop: (e: DragEvent) => void;
    };
}

/** How long a deleted row takes to slide away; none at all with the system's reduce-motion setting. */
export function leaveDurationMs(): number {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 240;
}

/** Wraps the parts of a title (or name) that matched the search in <mark>, as real nodes: a page title is untrusted text, never markup. */
function highlighted(title: string, ranges: MatchRange[]) {
    if (ranges.length === 0) return title;
    const parts = [];
    let cursor = 0;
    for (const r of ranges) {
        if (r.start > cursor) parts.push(title.slice(cursor, r.start));
        parts.push(<mark key={r.start}>{title.slice(r.start, r.end)}</mark>);
        cursor = r.end;
    }
    if (cursor < title.length) parts.push(title.slice(cursor));
    return parts;
}

export function TabRow(props: RowProps) {
    const [editing, setEditing] = useState(false);
    const [leaving, setLeaving] = useState(false);
    const titleButton = useRef<HTMLButtonElement>(null);
    // Leaving the edit form (saved or cancelled) puts focus back on the row, not on the page.
    const wasEditing = useRef(false);
    useLayoutEffect(() => {
        if (wasEditing.current && !editing) titleButton.current?.focus();
        wasEditing.current = editing;
    }, [editing]);
    const tabIndex = props.current ? 0 : -1;
    // Decided once, when the row first appears: re-renders never replay the entrance.
    const [entrance] = useState(props.entrance);
    const { tab } = props;

    // The delete is written straight away (closing the popup a moment later must not undo it);
    // the row just slides away while the list waits to refresh (see App's onDelete).
    const startDelete = async () => {
        setLeaving(true);
        if (!(await props.onDelete())) setLeaving(false);
    };

    const rowStyle = {
        "--rc": props.color,
        background: props.tinted ? `color-mix(in srgb, ${props.color} var(--row-mix), var(--surface))` : "var(--surface)",
        animationDelay: entrance === "rise" ? `${props.entranceDelayMs}ms` : undefined,
    };

    if (editing) {
        return (
            <li class={`${styles.row} ${styles.editing}`} style={rowStyle} data-tab-id={tab.id}>
                <EditForm {...props} onDone={() => setEditing(false)} />
            </li>
        );
    }

    const days = daysSince(tab.savedAt);
    const classes = [
        styles.row,
        entrance === "rise" ? styles.rise : entrance === "drop" ? styles.drop : "",
        props.draggable ? styles.draggable : "",
        props.dragging ? styles.dragging : "",
        props.dropSide === "before" ? styles.dropBefore : props.dropSide === "after" ? styles.dropAfter : "",
        leaving ? styles.leaving : "",
        props.selecting ? styles.selecting : "",
        props.selected ? styles.selected : "",
    ].join(" ");

    return (
        <li class={classes} style={rowStyle} data-tab-id={tab.id} draggable={props.draggable} {...(props.draggable ? props.dragHandlers : {})}>
            <span class={styles.lead} aria-hidden="true">
                {props.selecting ? (
                    <span class={styles.check}>{props.selected && <Icon name="check" size={13} />}</span>
                ) : (
                    <>
                        <SiteIcon url={tab.url} />
                        <span class={styles.grip}>
                            <Icon name="grip" size={14} />
                        </span>
                    </>
                )}
            </span>
            <div class={styles.text}>
                <button
                    ref={titleButton}
                    type="button"
                    class={styles.title}
                    title={tab.title}
                    tabIndex={tabIndex}
                    data-row-title
                    role={props.selecting ? "checkbox" : undefined}
                    aria-checked={props.selecting ? props.selected : undefined}
                    onClick={(e) => (props.selecting ? props.onToggleSelect(e.shiftKey) : props.onOpen())}
                >
                    {highlighted(tab.title, props.match?.titleRanges ?? [])}
                </button>
                <span class={styles.meta}>
                    {props.showCategory ? (
                        <>
                            <span class={styles.category}>
                                <span class={controls.dot} style={{ background: props.color }} />
                                {highlighted(props.category, props.match?.categoryRanges ?? [])}
                            </span>
                            <span class={styles.separator} aria-hidden="true">
                                ·
                            </span>
                        </>
                    ) : (
                        <span class="visually-hidden">{strings.categoryForScreenReaders(props.category)}</span>
                    )}
                    {props.windowName !== null && (
                        <>
                            <span class={styles.window}>
                                <Icon name="tabs" size={11} />
                                <span class="visually-hidden">{`${strings.inSavedWindow} `}</span>
                                <span class={styles.windowName}>{highlighted(props.windowName, props.match?.windowRanges ?? [])}</span>
                            </span>
                            <span class={styles.separator} aria-hidden="true">
                                ·
                            </span>
                        </>
                    )}
                    <span class={styles.site}>{siteName(tab.url)}</span>
                    {tab.pinned && <span class="visually-hidden">{strings.pinnedForScreenReaders}</span>}
                </span>
            </div>
            {props.outdated && (
                <span class={styles.age} title={strings.savedDaysAgo(days)}>
                    <Icon name="moon" size={10} />
                    {strings.ageBadge(days)}
                </span>
            )}
            {/* A pinned tab never ages, so its pin stands where the age badge would; the actions cover it on hover. */}
            {tab.pinned && (
                <span class={styles.pinMark} aria-hidden="true">
                    <Icon name="pin" size={13} />
                </span>
            )}
            {!props.selecting && (
                <span class={styles.actions}>
                    <button
                        type="button"
                        class={`${controls.iconBtn} ${controls.small} ${tab.pinned ? styles.pinned : ""}`}
                        aria-label={tab.pinned ? strings.unpinTab(tab.title) : strings.pinTab(tab.title)}
                        aria-pressed={!!tab.pinned}
                        title={tab.pinned ? strings.unpinTooltip : strings.pinTooltip}
                        tabIndex={tabIndex}
                        data-row-action="pin"
                        onClick={props.onTogglePin}
                    >
                        <Icon name="pin" size={14} />
                    </button>
                    <button
                        type="button"
                        class={`${controls.iconBtn} ${controls.small}`}
                        aria-label={strings.editTab(tab.title)}
                        title={strings.editTooltip}
                        tabIndex={tabIndex}
                        data-row-action="edit"
                        onClick={() => setEditing(true)}
                    >
                        <Icon name="edit" size={14} />
                    </button>
                    <button
                        type="button"
                        class={`${controls.iconBtn} ${controls.small} ${styles.delete}`}
                        aria-label={strings.deleteTab(tab.title)}
                        title={strings.deleteTooltip}
                        tabIndex={tabIndex}
                        data-row-action="delete"
                        onClick={() => void startDelete()}
                    >
                        <Icon name="trash" size={14} />
                    </button>
                </span>
            )}
            {props.flashSeq !== null && <span key={props.flashSeq} class={styles.flash} />}
        </li>
    );
}

function EditForm(props: RowProps & { onDone: () => void }) {
    const { tab } = props;
    const [title, setTitle] = useState(tab.title);
    const [url, setUrl] = useState(tab.url);
    const [category, setCategory] = useState(props.category);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const titleInput = useRef<HTMLInputElement>(null);
    const urlInput = useRef<HTMLInputElement>(null);

    // A layout effect, so focus moves in the same moment the form appears: a later move could
    // land after the user (or a test) has already clicked into another field and started typing.
    useLayoutEffect(() => {
        titleInput.current?.focus();
        titleInput.current?.select();
    }, []);

    const save = async (e: Event) => {
        e.preventDefault();
        const normalized = normalizeUrl(url);
        if (!normalized) {
            setError(strings.enterValidUrlSentence);
            urlInput.current?.focus();
            return;
        }
        // Waits for the write before closing: the save can be refused (the new URL is already
        // saved as another tab), and closing first would throw away what was typed.
        setBusy(true);
        const outcome = await props.onEdit({ title: title.trim() || normalized, url: normalized, category });
        setBusy(false);
        if (outcome.status === "duplicate") {
            setError(strings.alreadySavedAs(outcome.existingTitle));
            urlInput.current?.focus();
            return;
        }
        props.onDone();
    };

    const idPrefix = `edit-${tab.id}`;
    return (
        <form
            class={styles.editForm}
            onSubmit={save}
            noValidate
            onKeyDown={(e) => {
                // Escape cancels the edit, like the Cancel button (and stays inside the form).
                if (e.key !== "Escape") return;
                e.preventDefault();
                e.stopPropagation();
                props.onDone();
            }}
        >
            <label for={`${idPrefix}-title`} class="visually-hidden">
                {strings.titleLabel}
            </label>
            <input
                ref={titleInput}
                id={`${idPrefix}-title`}
                class={controls.field}
                type="text"
                placeholder={strings.titlePlaceholder}
                value={title}
                onInput={(e) => setTitle(e.currentTarget.value)}
            />
            <label for={`${idPrefix}-url`} class="visually-hidden">
                {strings.urlLabel}
            </label>
            <input
                ref={urlInput}
                id={`${idPrefix}-url`}
                class={`${controls.field} ${error ? controls.fieldError : ""}`}
                type="text"
                placeholder={strings.editUrlPlaceholder}
                value={url}
                onInput={(e) => {
                    setUrl(e.currentTarget.value);
                    setError("");
                }}
            />
            <p class={controls.error} role="alert">
                {error}
            </p>
            <div class={styles.editActions}>
                <CategoryPicker
                    id={`${idPrefix}-category`}
                    label={strings.categoryLabel}
                    value={category}
                    options={props.editOptions}
                    color={props.colorOf(category)}
                    onChange={setCategory}
                    onSurface
                />
                <button type="button" class={controls.btn} onClick={props.onDone}>
                    {strings.cancel}
                </button>
                <button type="submit" class={`${controls.btn} ${controls.primary}`} disabled={busy}>
                    {strings.save}
                </button>
            </div>
        </form>
    );
}
