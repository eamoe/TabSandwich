import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import {
    addCategory,
    CATEGORY_COLOR_PALETTE,
    getCategoryColorHex,
    getTabCategory,
    moveCategory,
    removeCategory,
    renameCategory,
    reorderCategories,
    restoreCategory,
    setCategoryColor,
    UNCATEGORIZED,
} from "../../domain/CategoryRepository";
import { clampOutdatedDays, MAX_OUTDATED_DAYS, MIN_OUTDATED_DAYS, setCategoryWaiting, setOutdatedDays } from "../../domain/SettingsRepository";
import { removeRefusalMessage, renameRefusalMessage, writeErrorMessage } from "../errors";
import { Icon } from "../Icon";
import { showErrorToast, showUndoToast } from "../toastStore";
import { strings } from "../strings";
import type { Library } from "../main/useLibrary";
import controls from "../controls.module.css";
import styles from "./Settings.module.css";

const MAX_NAME_LENGTH = 15;
const MESSAGE_MS = 3000;

export function CategoriesTab({ library, reload }: { library: Library; reload: () => Promise<void> }) {
    const { settings } = library;
    // Counted as the list shows them: archived tabs aren't in it (removing a category they use says so).
    const tabs = library.tabs.filter((t) => !t.archivedAt);
    const archived = library.tabs.filter((t) => t.archivedAt);
    const listRef = useRef<HTMLUListElement>(null);
    // After a removal, focus goes to the row that took its place (or the one above, or the Add field).
    const focusRowAt = useRef<number | null>(null);
    useEffect(() => {
        const index = focusRowAt.current;
        if (index === null) return;
        focusRowAt.current = null;
        const names = listRef.current?.querySelectorAll<HTMLElement>("[data-category-name]") ?? [];
        (names[Math.min(index, names.length - 1)] ?? document.getElementById("new-category-input"))?.focus();
    }, [library]);
    const [newName, setNewName] = useState("");
    const [paletteFor, setPaletteFor] = useState<string | null>(null);
    const [dragName, setDragName] = useState<string | null>(null);
    const [dragOver, setDragOver] = useState<string | null>(null);
    const [days, setDays] = useState(String(settings.outdatedDays));
    // Every load resets the field to what's stored, so a change that failed to save doesn't linger.
    useEffect(() => setDays(String(library.settings.outdatedDays)), [library]);

    const commitDays = async () => {
        const clamped = clampOutdatedDays(days);
        setDays(String(clamped));
        if (clamped === settings.outdatedDays) return;
        try {
            await setOutdatedDays(clamped);
        } catch (err) {
            showErrorToast(writeErrorMessage(err));
        }
        await reload();
    };

    const waitingProps = (name: string) => ({
        waiting: settings.waitingCategories.includes(name),
        days: settings.outdatedDays,
        onToggleWaiting: async (waiting: boolean) => {
            try {
                await setCategoryWaiting(name, waiting);
            } catch (err) {
                showErrorToast(writeErrorMessage(err));
            }
            await reload();
        },
    });

    const add = async (e: Event) => {
        e.preventDefault();
        if (!newName.trim()) return;
        try {
            await addCategory(newName);
            setNewName(""); // kept on failure: nothing was saved, so there's nothing to clear
        } catch (err) {
            showErrorToast(writeErrorMessage(err));
        }
        await reload();
    };

    return (
        <section class={styles.group} aria-label={strings.tabCategories}>
            <form class={styles.addCategory} onSubmit={add}>
                <div class={styles.nameField}>
                    <label for="new-category-input" class="visually-hidden">
                        {strings.newCategory}
                    </label>
                    <input
                        id="new-category-input"
                        class={controls.field}
                        type="text"
                        placeholder={strings.newCategory}
                        maxLength={MAX_NAME_LENGTH}
                        value={newName}
                        onInput={(e) => setNewName(e.currentTarget.value)}
                    />
                    <span class={styles.counter} aria-hidden="true">
                        {newName.length}/{MAX_NAME_LENGTH}
                    </span>
                </div>
                <button type="submit" class={`${controls.btn} ${controls.primary}`}>
                    {strings.add}
                </button>
            </form>
            {/* The days setting, and the legend for every row's moon: on top, so a long list can't hide it. */}
            <div class={styles.waitingDays}>
                <Icon name="moon" size={14} />
                <label for="outdated-days">{strings.waitingAfter}</label>
                <input
                    id="outdated-days"
                    class={controls.field}
                    type="number"
                    min={MIN_OUTDATED_DAYS}
                    max={MAX_OUTDATED_DAYS}
                    aria-describedby="outdated-days-hint"
                    value={days}
                    onInput={(e) => setDays(e.currentTarget.value)}
                    onChange={() => void commitDays()}
                />
                <span>{strings.days}</span>
            </div>
            <p id="outdated-days-hint" class={styles.waitingHint}>
                {strings.waitingAfterHint}
            </p>
            <ul ref={listRef} class={styles.categories} aria-label={strings.configuredCategories}>
                {settings.categories.map((name, index) => (
                    <CategoryRow
                        key={name}
                        name={name}
                        colorKey={settings.categoryColors[name]}
                        color={getCategoryColorHex(name, settings.categoryColors)}
                        tabCount={tabs.filter((t) => getTabCategory(t) === name).length}
                        archivedCount={archived.filter((t) => getTabCategory(t) === name).length}
                        onRemoved={() => (focusRowAt.current = index)}
                        isFirst={index === 0}
                        isLast={index === settings.categories.length - 1}
                        paletteOpen={paletteFor === name}
                        onTogglePalette={(open) => setPaletteFor(open ? name : null)}
                        dragging={dragName === name}
                        dragOver={dragOver === name}
                        drag={{
                            onDragStart: (e) => {
                                setDragName(name);
                                if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
                            },
                            onDragEnd: () => {
                                setDragName(null);
                                setDragOver(null);
                            },
                            onDragOver: (e) => {
                                if (!dragName || dragName === name) return;
                                e.preventDefault();
                                setDragOver(name);
                            },
                            onDragLeave: () => setDragOver((n) => (n === name ? null : n)),
                            onDrop: (e) => {
                                e.preventDefault();
                                const dragged = dragName;
                                setDragName(null);
                                setDragOver(null);
                                if (dragged && dragged !== name) {
                                    void reorderCategories(dragged, name)
                                        .catch((err) => showErrorToast(writeErrorMessage(err)))
                                        .finally(reload);
                                }
                            },
                        }}
                        reload={reload}
                        {...waitingProps(name)}
                    />
                ))}
                <UncategorizedRow tabCount={tabs.filter((t) => getTabCategory(t) === UNCATEGORIZED).length} color={getCategoryColorHex(UNCATEGORIZED, settings.categoryColors)} {...waitingProps(UNCATEGORIZED)} />
            </ul>
        </section>
    );
}

interface WaitingProps {
    waiting: boolean;
    days: number;
    onToggleWaiting: (waiting: boolean) => Promise<void>;
}

/** The moon on a category's row: lit, its tabs age and show as Waiting; dim, they're kept. */
function WaitingToggle({ name, waiting, days, onToggleWaiting }: WaitingProps & { name: string }) {
    return (
        <button
            type="button"
            class={`${controls.iconBtn} ${controls.small} ${styles.moon}`}
            aria-label={strings.waitingToggle(name)}
            aria-pressed={waiting}
            title={waiting ? strings.waitingOnTitle(days) : strings.waitingOffTitle}
            onClick={() => void onToggleWaiting(!waiting)}
        >
            <Icon name="moon" size={14} />
        </button>
    );
}

/**
 * Uncategorized's own row, last: it can't be renamed, moved, recolored or removed, so all it
 * offers is the moon, whether tabs saved without a category show as waiting.
 */
function UncategorizedRow(props: WaitingProps & { tabCount: number; color: string }) {
    return (
        <li class={`${styles.category} ${styles.fixed}`}>
            <span class={styles.grip} aria-hidden="true" />
            <span class={styles.colorDot} style={{ background: props.color }} aria-hidden="true" />
            <span class={styles.fixedName}>{UNCATEGORIZED}</span>
            <span class={styles.count}>{strings.tabCount(props.tabCount)}</span>
            <WaitingToggle name={UNCATEGORIZED} {...props} />
            <span class={styles.actions} aria-hidden="true" />
        </li>
    );
}

function CategoryRow(props: WaitingProps & {
    name: string;
    colorKey: string | undefined;
    color: string;
    tabCount: number;
    /** Its tabs in the archive: not in the count, but removing it releases them too. */
    archivedCount: number;
    onRemoved: () => void;
    isFirst: boolean;
    isLast: boolean;
    paletteOpen: boolean;
    onTogglePalette: (open: boolean) => void;
    dragging: boolean;
    dragOver: boolean;
    drag: {
        onDragStart: (e: DragEvent) => void;
        onDragEnd: () => void;
        onDragOver: (e: DragEvent) => void;
        onDragLeave: () => void;
        onDrop: (e: DragEvent) => void;
    };
    reload: () => Promise<void>;
}) {
    const { name } = props;
    const [renaming, setRenaming] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const removeButton = useRef<HTMLButtonElement>(null);
    const confirmButton = useRef<HTMLButtonElement>(null);
    const [draft, setDraft] = useState(name);
    const [message, setMessage] = useState("");
    const messageTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const rowRef = useRef<HTMLLIElement>(null);
    const dotRef = useRef<HTMLButtonElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const cancelled = useRef(false);
    useEffect(() => () => clearTimeout(messageTimer.current), []);

    // The message belongs to this one category, so it's unambiguous which card it means.
    const flash = (text: string) => {
        clearTimeout(messageTimer.current);
        setMessage(text);
        messageTimer.current = setTimeout(() => setMessage(""), MESSAGE_MS);
    };

    const run = async (action: () => Promise<unknown>) => {
        try {
            await action();
        } catch (err) {
            flash(writeErrorMessage(err));
        }
        await props.reload();
    };

    useLayoutEffect(() => {
        if (renaming) {
            inputRef.current?.focus();
            inputRef.current?.select();
        }
    }, [renaming]);

    // The open palette closes on a click elsewhere or Escape (which returns focus to the dot).
    // Attached in the same moment the palette appears, so an immediate Escape is never missed.
    useLayoutEffect(() => {
        if (!props.paletteOpen) return;
        const onPointer = (e: PointerEvent) => {
            if (!rowRef.current?.contains(e.target as Node)) props.onTogglePalette(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== "Escape") return;
            e.preventDefault();
            props.onTogglePalette(false);
            dotRef.current?.focus();
        };
        document.addEventListener("pointerdown", onPointer);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("pointerdown", onPointer);
            document.removeEventListener("keydown", onKey);
        };
    }, [props.paletteOpen]);

    // Enter and clicking away both commit (one path, via blur); Escape puts the name back.
    const commitRename = async () => {
        setRenaming(false);
        if (cancelled.current) {
            cancelled.current = false;
            return;
        }
        try {
            const result = await renameCategory(name, draft);
            if (!result.renamed) {
                flash(result.reason ? renameRefusalMessage(result.reason) : strings.couldntSave);
                return;
            }
            await props.reload();
        } catch (err) {
            flash(writeErrorMessage(err));
        }
    };

    useLayoutEffect(() => {
        if (confirming) confirmButton.current?.focus();
    }, [confirming]);

    const cancelRemove = () => {
        setConfirming(false);
        setTimeout(() => removeButton.current?.focus());
    };

    // Unused: removed at once. In use (archive included): asked in the row first. Either way, Undo.
    const remove = async () => {
        if (!confirming && props.tabCount + props.archivedCount > 0) {
            setConfirming(true);
            return;
        }
        setConfirming(false);
        try {
            const result = await removeCategory(name);
            if (!result.removed || !result.removedCategory) {
                flash(result.reason ? removeRefusalMessage(result.reason) : strings.couldntSave);
                return;
            }
            const removed = result.removedCategory;
            showUndoToast(strings.removedCategoryToast(name), async () => {
                try {
                    await restoreCategory(removed);
                } catch (err) {
                    showErrorToast(writeErrorMessage(err));
                }
                await props.reload();
            });
            props.onRemoved();
            await props.reload();
        } catch (err) {
            flash(writeErrorMessage(err));
        }
    };

    if (confirming) {
        const count = props.tabCount + props.archivedCount;
        return (
            <li class={`${styles.category} ${styles.confirming}`}>
                <div class={styles.confirmText} id={`remove-${name}-detail`}>
                    <strong>{strings.removeConfirmTitle(name)}</strong>
                    <span title={strings.removeConfirmDetail(count, props.archivedCount)}>{strings.removeConfirmDetail(count, props.archivedCount)}</span>
                </div>
                <div
                    class={styles.confirmButtons}
                    role="group"
                    aria-labelledby={`remove-${name}-detail`}
                    onKeyDown={(e) => {
                        if (e.key !== "Escape") return;
                        e.preventDefault();
                        e.stopPropagation();
                        cancelRemove();
                    }}
                >
                    <button ref={confirmButton} type="button" class={`${controls.btn} ${styles.confirmBtn} ${styles.removeBtn}`} onClick={() => void remove()}>
                        {strings.removeConfirm}
                    </button>
                    <button type="button" class={`${controls.iconBtn} ${controls.small}`} aria-label={strings.cancel} title={strings.cancel} onClick={cancelRemove}>
                        <Icon name="close" size={14} />
                    </button>
                </div>
            </li>
        );
    }

    const classes = [styles.category, props.dragging ? styles.dragging : "", props.dragOver ? styles.dragOver : ""].join(" ");
    return (
        <li ref={rowRef} class={classes} draggable={!renaming} {...(renaming ? {} : props.drag)}>
            <span class={styles.grip} aria-hidden="true">
                <Icon name="grip" size={14} />
            </span>
            <button
                ref={dotRef}
                type="button"
                class={styles.colorDot}
                style={{ background: props.color }}
                aria-label={strings.colorFor(name)}
                aria-expanded={props.paletteOpen}
                onClick={() => props.onTogglePalette(!props.paletteOpen)}
            />
            {renaming ? (
                <input
                    ref={inputRef}
                    class={`${controls.field} ${styles.renameInput}`}
                    type="text"
                    maxLength={MAX_NAME_LENGTH}
                    aria-label={strings.renameCategory(name)}
                    value={draft}
                    onInput={(e) => setDraft(e.currentTarget.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            e.preventDefault();
                            e.currentTarget.blur();
                        } else if (e.key === "Escape") {
                            e.preventDefault();
                            cancelled.current = true;
                            e.currentTarget.blur();
                        }
                    }}
                    onBlur={() => void commitRename()}
                />
            ) : (
                <button
                    type="button"
                    class={styles.name}
                    data-category-name
                    aria-label={strings.renameCategory(name)}
                    onClick={() => {
                        setDraft(name);
                        setRenaming(true);
                    }}
                >
                    {name}
                </button>
            )}
            <span class={styles.count}>{strings.tabCount(props.tabCount)}</span>
            <WaitingToggle name={name} waiting={props.waiting} days={props.days} onToggleWaiting={props.onToggleWaiting} />
            <span class={styles.actions}>
                <button type="button" class={`${controls.iconBtn} ${controls.small}`} aria-label={strings.moveUp(name)} disabled={props.isFirst} onClick={() => void run(() => moveCategory(name, "up"))}>
                    <Icon name="chevronUp" size={14} />
                </button>
                <button type="button" class={`${controls.iconBtn} ${controls.small}`} aria-label={strings.moveDown(name)} disabled={props.isLast} onClick={() => void run(() => moveCategory(name, "down"))}>
                    <Icon name="chevronDown" size={14} />
                </button>
                <button
                    ref={removeButton}
                    type="button"
                    class={`${controls.iconBtn} ${controls.small} ${styles.danger}`}
                    aria-label={strings.removeCategory(name)}
                    onClick={() => void remove()}
                >
                    <Icon name="trash" size={14} />
                </button>
            </span>
            {props.paletteOpen && (
                <div class={styles.palette} role="group" aria-label={strings.colorFor(name)}>
                    {Object.entries(CATEGORY_COLOR_PALETTE).map(([key, hex]) => (
                        <button
                            key={key}
                            type="button"
                            class={styles.swatch}
                            style={{ background: hex }}
                            aria-label={strings.colorNames[key] ?? key}
                            aria-pressed={hex === props.color}
                            onClick={() => {
                                props.onTogglePalette(false);
                                void run(() => setCategoryColor(name, key));
                            }}
                        />
                    ))}
                </div>
            )}
            {/* Floats under the row, or above the last one so it never hangs off the end of the list. */}
            <p class={props.isLast && !props.isFirst ? `${styles.message} ${styles.messageAbove}` : styles.message} role="status" aria-live="polite">
                {message}
            </p>
        </li>
    );
}
