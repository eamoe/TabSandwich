import { useLayoutEffect, useRef, useState } from "preact/hooks";
import type { SavedTab } from "../../types";
import type { MatchRange } from "../../domain/search";
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
    titleRanges: MatchRange[];
    showCategory: boolean;
    /** How the row arrives: rising in with the rest on open, dropping in later, or not animated (while searching). */
    entrance: "rise" | "drop" | "none";
    entranceDelayMs: number;
    flashSeq: number | null;
    draggable: boolean;
    dragging: boolean;
    dragOver: boolean;
    editOptions: PickerOption[];
    colorOf: (category: string) => string;
    onOpen: () => void;
    onEdit: (updates: { title: string; url: string; category: string }) => Promise<EditOutcome>;
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

/** Wraps the parts of a title that matched the search in <mark>, as real nodes: a page title is untrusted text, never markup. */
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
        props.dragOver ? styles.dragOver : "",
        leaving ? styles.leaving : "",
    ].join(" ");

    return (
        <li class={classes} style={rowStyle} data-tab-id={tab.id} draggable={props.draggable} {...(props.draggable ? props.dragHandlers : {})}>
            <span class={styles.lead} aria-hidden="true">
                <SiteIcon url={tab.url} />
                <span class={styles.grip}>
                    <Icon name="grip" size={14} />
                </span>
            </span>
            <div class={styles.text}>
                <button type="button" class={styles.title} title={tab.title} onClick={props.onOpen}>
                    {highlighted(tab.title, props.titleRanges)}
                </button>
                <span class={styles.meta}>
                    {props.showCategory ? (
                        <>
                            <span class={styles.category}>
                                <span class={controls.dot} style={{ background: props.color }} />
                                {props.category}
                            </span>
                            <span class={styles.separator} aria-hidden="true">
                                ·
                            </span>
                        </>
                    ) : (
                        <span class="visually-hidden">{strings.categoryForScreenReaders(props.category)}</span>
                    )}
                    <span class={styles.site}>{siteName(tab.url)}</span>
                </span>
            </div>
            {props.outdated && (
                <span class={styles.age} title={strings.savedDaysAgo(days)}>
                    <Icon name="moon" size={10} />
                    {strings.ageBadge(days)}
                </span>
            )}
            <span class={styles.actions}>
                <button type="button" class={`${controls.iconBtn} ${controls.small}`} aria-label={strings.editTab(tab.title)} title={strings.editTooltip} onClick={() => setEditing(true)}>
                    <Icon name="edit" size={14} />
                </button>
                <button
                    type="button"
                    class={`${controls.iconBtn} ${controls.small} ${styles.delete}`}
                    aria-label={strings.deleteTab(tab.title)}
                    title={strings.deleteTooltip}
                    onClick={() => void startDelete()}
                >
                    <Icon name="trash" size={14} />
                </button>
            </span>
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
        <form class={styles.editForm} onSubmit={save} noValidate>
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
