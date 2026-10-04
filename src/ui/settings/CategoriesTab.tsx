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
    setCategoryColor,
} from "../../domain/CategoryRepository";
import { writeErrorMessage } from "../../util/errors";
import { Icon } from "../Icon";
import { showErrorToast } from "../toastStore";
import { strings } from "../strings";
import type { Library } from "../main/useLibrary";
import controls from "../controls.module.css";
import styles from "./Settings.module.css";

const MAX_NAME_LENGTH = 15;
const MESSAGE_MS = 3000;

export function CategoriesTab({ library, reload }: { library: Library; reload: () => Promise<void> }) {
    const { settings, tabs } = library;
    const [newName, setNewName] = useState("");
    const [paletteFor, setPaletteFor] = useState<string | null>(null);
    const [dragName, setDragName] = useState<string | null>(null);
    const [dragOver, setDragOver] = useState<string | null>(null);

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
            <ul class={styles.categories} aria-label={strings.configuredCategories}>
                {settings.categories.map((name, index) => (
                    <CategoryRow
                        key={name}
                        name={name}
                        colorKey={settings.categoryColors[name]}
                        color={getCategoryColorHex(name, settings.categoryColors)}
                        tabCount={tabs.filter((t) => getTabCategory(t) === name).length}
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
                    />
                ))}
            </ul>
        </section>
    );
}

function CategoryRow(props: {
    name: string;
    colorKey: string | undefined;
    color: string;
    tabCount: number;
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
                flash(result.reason ?? strings.couldntRename);
                return;
            }
            await props.reload();
        } catch (err) {
            flash(writeErrorMessage(err));
        }
    };

    const remove = async () => {
        try {
            const result = await removeCategory(name);
            if (!result.removed) {
                flash(result.reason ?? strings.couldntRemove);
                return;
            }
            await props.reload();
        } catch (err) {
            flash(writeErrorMessage(err));
        }
    };

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
            <span class={styles.actions}>
                <button type="button" class={`${controls.iconBtn} ${controls.small}`} aria-label={strings.moveUp(name)} disabled={props.isFirst} onClick={() => void run(() => moveCategory(name, "up"))}>
                    <Icon name="chevronUp" size={14} />
                </button>
                <button type="button" class={`${controls.iconBtn} ${controls.small}`} aria-label={strings.moveDown(name)} disabled={props.isLast} onClick={() => void run(() => moveCategory(name, "down"))}>
                    <Icon name="chevronDown" size={14} />
                </button>
                {/* Muted while in use, but still a real button: clicking it explains why it can't be removed. */}
                <button
                    type="button"
                    class={`${controls.iconBtn} ${controls.small} ${styles.danger} ${props.tabCount > 0 ? styles.muted : ""}`}
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
