import type { ComponentChildren } from "preact";
import { useLayoutEffect, useRef, useState } from "preact/hooks";
import type { SavedTab, TabGroup } from "../../types";
import { Icon, type IconName } from "../Icon";
import { SiteIcon } from "../SiteIcon";
import { useMenuPlacement } from "../useMenuPlacement";
import { strings } from "../strings";
import controls from "../controls.module.css";
import styles from "./TabList.module.css";

export type GroupAction = "open" | "openAndRemove" | "rename" | "ungroup" | "delete";

const ACTIONS: { action: GroupAction; label: string; icon: IconName; danger?: boolean }[] = [
    { action: "open", label: strings.openGroup, icon: "external" },
    { action: "openAndRemove", label: strings.openGroupAndRemove, icon: "external" },
    { action: "rename", label: strings.renameGroup, icon: "edit" },
    { action: "ungroup", label: strings.ungroup, icon: "unlink" },
    { action: "delete", label: strings.deleteGroup, icon: "trash", danger: true },
];

/** How many of a window's sites its row shows before "+N". */
const ICONS_SHOWN = 4;

/**
 * A saved window: one row, drawn as a small stack, that opens and closes to show its tabs
 * (remembered between opens). The row itself toggles; the ⋯ button beside it opens the
 * window's actions in a menu that floats over the list.
 */
export function GroupRow(props: {
    group: TabGroup;
    tabs: SavedTab[];
    /** The keyboard is on this row: only its buttons are in the Tab order (see TabList). */
    current: boolean;
    flashSeq: number | null;
    /** A loose tab is being dragged over this row: dropping puts it just past the window. */
    dragOver: boolean;
    dragHandlers: { onDragOver: (e: DragEvent) => void; onDragLeave: () => void; onDrop: (e: DragEvent) => void };
    entrance: "rise" | "drop" | "none";
    entranceDelayMs: number;
    /** Choosing several tabs: the row selects all its tabs; a chevron beside it opens and closes it. */
    selecting: boolean;
    /** How many of its tabs are selected. */
    selection: "none" | "some" | "all";
    onToggleSelect: () => void;
    onToggle: () => void;
    onAction: (action: GroupAction) => void;
    onRename: (name: string) => Promise<void>;
    /** The window's tabs, shown while it's open. */
    children: ComponentChildren;
}) {
    const { group } = props;
    const [menuOpen, setMenuOpen] = useState(false);
    const [renaming, setRenaming] = useState(false);
    const menuButton = useRef<HTMLButtonElement>(null);
    const menu = useRef<HTMLDivElement>(null);
    const head = useRef<HTMLDivElement>(null);
    useMenuPlacement(menuOpen, head, menu, 6, () => setMenuOpen(false));
    const tabIndex = props.current ? 0 : -1;
    const expanded = !group.collapsed;

    useLayoutEffect(() => {
        if (!menuOpen) return;
        // Without scrolling: the menu floats over the list, and a scroll would close it.
        menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus({ preventScroll: true });
        const outside = (e: PointerEvent) => {
            const target = e.target as Node;
            if (!menu.current?.contains(target) && !menuButton.current?.contains(target)) setMenuOpen(false);
        };
        document.addEventListener("pointerdown", outside);
        return () => document.removeEventListener("pointerdown", outside);
    }, [menuOpen]);

    const onMenuKey = (e: KeyboardEvent) => {
        const items = [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
        const index = items.indexOf(document.activeElement as HTMLElement);
        const go = (i: number) => items[(i + items.length) % items.length]?.focus({ preventScroll: true });
        if (e.key === "ArrowDown") go(index + 1);
        else if (e.key === "ArrowUp") go(index - 1);
        else if (e.key === "Home") go(0);
        else if (e.key === "End") go(items.length - 1);
        else if (e.key === "Escape") {
            setMenuOpen(false);
            menuButton.current?.focus();
        } else if (e.key === "Tab") return setMenuOpen(false);
        else return;
        e.preventDefault();
        e.stopPropagation();
    };

    const choose = (action: GroupAction) => {
        setMenuOpen(false);
        if (action === "rename") setRenaming(true);
        else props.onAction(action);
    };

    // Decided once, when the row first appears: re-renders never replay the entrance.
    const [entrance] = useState(props.entrance);
    const entranceClass = entrance === "rise" ? styles.rise : entrance === "drop" ? styles.drop : "";
    const shown = props.tabs.slice(0, ICONS_SHOWN);

    return (
        <li class={styles.group} data-group-id={group.id}>
            <div
                ref={head}
                class={`${styles.groupHead} ${entranceClass} ${expanded ? styles.groupOpen : ""} ${props.dragOver ? styles.dragOver : ""} ${menuOpen ? styles.menuOpen : ""}`}
                style={{ animationDelay: entrance === "rise" ? `${props.entranceDelayMs}ms` : undefined }}
                onDragOver={props.dragHandlers.onDragOver}
                onDragLeave={props.dragHandlers.onDragLeave}
                onDrop={props.dragHandlers.onDrop}
            >
                {renaming ? (
                    <RenameForm
                        name={group.name}
                        onDone={async (name) => {
                            if (name !== null) await props.onRename(name);
                            setRenaming(false);
                        }}
                    />
                ) : (
                    <>
                        <button
                            type="button"
                            class={styles.groupToggle}
                            role={props.selecting ? "checkbox" : undefined}
                            aria-checked={props.selecting ? (props.selection === "some" ? "mixed" : props.selection === "all") : undefined}
                            aria-expanded={props.selecting ? undefined : expanded}
                            tabIndex={tabIndex}
                            data-row-title
                            data-group-name={group.name}
                            onClick={props.selecting ? props.onToggleSelect : props.onToggle}
                        >
                            <span class={styles.lead}>
                                {props.selecting ? (
                                    <span class={`${styles.check} ${props.selection === "some" ? styles.checkSome : props.selection === "all" ? styles.checkAll : ""}`}>
                                        {props.selection === "all" && <Icon name="check" size={13} />}
                                        {props.selection === "some" && <span class={styles.dash} />}
                                    </span>
                                ) : (
                                    <Icon name="chevronRight" size={16} />
                                )}
                            </span>
                            <span class={styles.text}>
                                <span class={styles.groupName}>{group.name}</span>
                                <span class={styles.meta}>
                                    <span class={styles.groupIcons} aria-hidden="true">
                                        {shown.map((t) => (
                                            <SiteIcon key={t.id} url={t.url} mini />
                                        ))}
                                    </span>
                                    {props.tabs.length > ICONS_SHOWN && <span aria-hidden="true">{strings.groupMore(props.tabs.length - ICONS_SHOWN)}</span>}
                                    <span class={styles.separator} aria-hidden="true">
                                        ·
                                    </span>
                                    <span>{strings.groupTabCount(props.tabs.length)}</span>
                                    <span class={styles.separator} aria-hidden="true">
                                        ·
                                    </span>
                                    <span>{strings.groupSavedOn(new Date(group.createdAt))}</span>
                                </span>
                            </span>
                        </button>
                        {props.selecting ? (
                            <button
                                type="button"
                                class={`${controls.iconBtn} ${controls.small} ${styles.groupMenuBtn} ${styles.chevronBtn}`}
                                aria-label={strings.toggleWindow}
                                title={strings.toggleWindow}
                                aria-expanded={expanded}
                                tabIndex={tabIndex}
                                onClick={props.onToggle}
                            >
                                <Icon name="chevronRight" size={16} />
                            </button>
                        ) : (
                            <button
                                ref={menuButton}
                                type="button"
                                class={`${controls.iconBtn} ${controls.small} ${styles.groupMenuBtn}`}
                                aria-label={strings.groupActions(group.name)}
                                title={strings.groupActionsTooltip}
                                aria-haspopup="menu"
                                aria-expanded={menuOpen}
                                tabIndex={tabIndex}
                                data-row-action="menu"
                                onClick={() => setMenuOpen((open) => !open)}
                            >
                                <Icon name="more" size={16} />
                            </button>
                        )}
                    </>
                )}
                {menuOpen && (
                    <div ref={menu} class={styles.groupMenu} role="menu" aria-label={strings.groupActions(group.name)} onKeyDown={onMenuKey}>
                        {ACTIONS.map(({ action, label, icon, danger }) => (
                            <button
                                key={action}
                                type="button"
                                role="menuitem"
                                tabIndex={-1}
                                class={`${styles.menuItem} ${danger ? styles.menuDanger : ""}`}
                                onClick={() => choose(action)}
                            >
                                <Icon name={icon} size={14} />
                                {label}
                            </button>
                        ))}
                    </div>
                )}
                {props.flashSeq !== null && <span key={props.flashSeq} class={styles.flash} />}
            </div>
            {expanded && (
                <ul class={styles.members} aria-label={group.name}>
                    {props.children}
                </ul>
            )}
        </li>
    );
}

/** Rename in place: Enter saves, Escape (or leaving the field) cancels. */
function RenameForm(props: { name: string; onDone: (name: string | null) => void }) {
    const [name, setName] = useState(props.name);
    const input = useRef<HTMLInputElement>(null);
    useLayoutEffect(() => {
        input.current?.focus();
        input.current?.select();
    }, []);
    return (
        <form
            class={styles.renameForm}
            onSubmit={(e) => {
                e.preventDefault();
                props.onDone(name.trim() ? name : null);
            }}
        >
            <label for="group-rename" class="visually-hidden">
                {strings.groupNameLabel}
            </label>
            <input
                ref={input}
                id="group-rename"
                class={controls.field}
                type="text"
                value={name}
                onInput={(e) => setName(e.currentTarget.value)}
                onBlur={() => props.onDone(null)}
                onKeyDown={(e) => {
                    if (e.key !== "Escape") return;
                    e.preventDefault();
                    e.stopPropagation();
                    props.onDone(null);
                }}
            />
        </form>
    );
}
