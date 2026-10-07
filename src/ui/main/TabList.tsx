import type { ComponentChildren } from "preact";
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import type { SavedTab, Settings, TabGroup } from "../../types";
import type { MatchRange } from "../../domain/search";
import { getTabCategory, UNCATEGORIZED } from "../../domain/CategoryRepository";
import type { PickerOption } from "../CategoryPicker";
import { strings } from "../strings";
import { dropTarget, groupItems, isTabOutdated, reorderTarget, type ListItem } from "./listModel";
import { GroupRow, type GroupAction } from "./GroupRow";
import { TabRow, type EditOutcome } from "./TabRow";
import styles from "./TabList.module.css";

export interface Highlight {
    /** A tab's id, or a saved window's. */
    id: string;
    seq: number;
}

const STAGGER_MS = 28;
const STAGGER_CAP = 12;

/** A row the keyboard can be on: a tab (loose, or in an open window) or a saved window's own row. */
interface ScreenRow {
    key: string;
    tab?: SavedTab;
    group?: TabGroup;
    /** For a tab inside a window: that window. */
    parent?: TabGroup;
}

const groupKey = (id: string) => `group:${id}`;

function screenRows(items: ListItem[]): ScreenRow[] {
    return items.flatMap((item): ScreenRow[] =>
        item.kind === "tab"
            ? [{ key: item.tab.id, tab: item.tab }]
            : [
                  { key: groupKey(item.group.id), group: item.group },
                  ...(item.group.collapsed ? [] : item.tabs.map((tab) => ({ key: tab.id, tab, parent: item.group }))),
              ]
    );
}

export function TabList(props: {
    tabs: SavedTab[];
    groups: TabGroup[];
    /** Show saved windows as windows (All, no search); otherwise every match is a plain row. */
    grouped: boolean;
    settings: Settings;
    titleRanges: Map<string, MatchRange[]> | null;
    searchActive: boolean;
    canReorder: boolean;
    showCategory: boolean;
    entered: boolean;
    highlight: Highlight | null;
    /** What the list shows when it has no rows: the first-run tips, or why a search found nothing. */
    empty: ComponentChildren;
    editOptions: PickerOption[];
    colorOf: (category: string) => string;
    onOpen: (tab: SavedTab) => void;
    onEdit: (tab: SavedTab, updates: { title: string; url: string; category: string }) => Promise<EditOutcome>;
    onDelete: (tab: SavedTab) => Promise<boolean>;
    onReorder: (draggedId: string, targetId: string) => void;
    onToggleGroup: (group: TabGroup) => void;
    onGroupAction: (group: TabGroup, tabs: SavedTab[], action: Exclude<GroupAction, "rename">) => void;
    onRenameGroup: (group: TabGroup, name: string) => Promise<void>;
    /** Escape on a row: back to the search box. */
    onEscape: () => void;
}) {
    const listRef = useRef<HTMLUListElement>(null);
    const [dragId, setDragId] = useState<string | null>(null);
    const [dragOverKey, setDragOverKey] = useState<string | null>(null);
    // The row the keyboard is on (the first one until focus lands somewhere), and a row to move
    // focus to once the list has re-rendered: the neighbor of a deleted row, or a moved row
    // (moving a focused element in the page drops its focus).
    const [currentKey, setCurrentKey] = useState<string | null>(null);
    const pendingFocus = useRef<string | null>(null);
    const [announcement, setAnnouncement] = useState("");

    const items: ListItem[] = props.grouped ? groupItems(props.tabs, props.groups) : props.tabs.map((tab) => ({ kind: "tab", tab }));
    const rows = screenRows(items);
    const current = rows.some((r) => r.key === currentKey) ? currentKey : (rows[0]?.key ?? null);

    const rowElement = (key: string) =>
        key.startsWith("group:")
            ? listRef.current?.querySelector<HTMLElement>(`li[data-group-id="${CSS.escape(key.slice(6))}"]`)
            : listRef.current?.querySelector<HTMLElement>(`li[data-tab-id="${CSS.escape(key)}"]`);
    // A window's own row holds its tabs too, so look only at its head for the button to focus.
    const focusRow = (key: string) =>
        rowElement(key)?.querySelector<HTMLElement>(key.startsWith("group:") ? ":scope > :first-child [data-row-title]" : "[data-row-title]")?.focus();

    useLayoutEffect(() => {
        const key = pendingFocus.current;
        if (key && rows.some((r) => r.key === key)) {
            pendingFocus.current = null;
            focusRow(key);
        }
    });

    // A live region only speaks when its text changes, so a repeated message gets a different
    // invisible ending.
    const announce = (text: string) => setAnnouncement((prev) => (prev === text ? `${text}\u00a0` : text));

    /** Position (1-based) and count among the rows a move happens in: a window's tabs, or the loose rows. */
    const placeAmong = (tabId: string) => {
        const group = items.find((i) => i.kind === "group" && i.tabs.some((t) => t.id === tabId));
        if (group && group.kind === "group") return { at: group.tabs.findIndex((t) => t.id === tabId) + 1, of: group.tabs.length };
        return { at: items.findIndex((i) => i.kind === "tab" && i.tab.id === tabId) + 1, of: items.length };
    };

    const onKeyDown = (e: KeyboardEvent) => {
        const target = e.target as HTMLElement;
        // Typing in a form (edit, rename) is typing, and the window menu has its own keys.
        if (target.closest("form, [role='menu']") || e.ctrlKey || e.metaKey) return;
        const li = target.closest<HTMLElement>("li[data-tab-id], li[data-group-id]");
        const key = li?.dataset.tabId ?? (li?.dataset.groupId ? groupKey(li.dataset.groupId) : undefined);
        const index = rows.findIndex((r) => r.key === key);
        if (!li || index === -1) return;
        const row = rows[index];
        const go = (i: number) => focusRow(rows[Math.max(0, Math.min(i, rows.length - 1))].key);

        if ((e.key === "ArrowDown" || e.key === "ArrowUp") && e.altKey) {
            if (!row.tab) return;
            const neighbor = reorderTarget(items, row.tab.id, e.key === "ArrowDown" ? "down" : "up");
            if (!props.canReorder) announce(props.searchActive ? strings.cantMoveSearching : strings.cantMoveSorted);
            else if (neighbor) {
                pendingFocus.current = row.tab.id;
                props.onReorder(row.tab.id, neighbor);
                const { at, of } = placeAmong(row.tab.id);
                announce(strings.movedTo(row.tab.title, at + (e.key === "ArrowDown" ? 1 : -1), of));
            }
        } else if (e.altKey || e.shiftKey) {
            return;
        } else if (e.key === "ArrowDown") go(index + 1);
        else if (e.key === "ArrowUp") go(index - 1);
        else if (e.key === "Home") go(0);
        else if (e.key === "End") go(rows.length - 1);
        else if (e.key === "ArrowRight" && row.group) {
            if (row.group.collapsed) props.onToggleGroup(row.group);
            else go(index + 1);
        } else if (e.key === "ArrowLeft" && (row.group || row.parent)) {
            if (row.parent) focusRow(groupKey(row.parent.id));
            else if (!row.group!.collapsed) props.onToggleGroup(row.group!);
        } else if ((e.key === "e" || e.key === "E") && row.tab) li.querySelector<HTMLElement>('[data-row-action="edit"]')?.click();
        else if (e.key === "Delete" || e.key === "Backspace") {
            // Focus moves on to the next row (or the one before, at the end) once this one is gone;
            // past a window's own tabs when the whole window goes.
            const after = rows.slice(index + 1).find((r) => !row.group || r.parent?.id !== row.group.id);
            pendingFocus.current = (after ?? rows[index - 1])?.key ?? null;
            if (row.tab) li.querySelector<HTMLElement>('[data-row-action="delete"]')?.click();
            else {
                const item = items.find((i) => i.kind === "group" && i.group.id === row.group!.id);
                if (item?.kind === "group") props.onGroupAction(item.group, item.tabs, "delete");
            }
        } else if (e.key === "Escape") props.onEscape();
        else return;
        e.preventDefault();
    };

    // A just-saved or just-restored tab (or window) is scrolled into view wherever it sits in a long list.
    useEffect(() => {
        if (!props.highlight) return;
        (rowElement(props.highlight.id) ?? rowElement(groupKey(props.highlight.id)))?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, [props.highlight]);

    const liveRegion = (
        <p class="visually-hidden" role="status" aria-live="polite">
            {announcement}
        </p>
    );

    if (props.tabs.length === 0) {
        return (
            <>
                <ul class={styles.list} aria-label={strings.savedTabsLabel}>
                    <li class={styles.empty}>{props.empty}</li>
                </ul>
                {liveRegion}
            </>
        );
    }

    const endDrag = () => {
        setDragId(null);
        setDragOverKey(null);
    };
    /** Drag handlers for a row, given where a drop on it would put the dragged tab. */
    const dragHandlersFor = (key: string, dragOwnId: string | null, targetFor: (dragged: string) => string | null) => ({
        onDragStart: (e: DragEvent) => {
            if (!dragOwnId) return;
            setDragId(dragOwnId);
            if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
        },
        onDragEnd: endDrag,
        onDragOver: (e: DragEvent) => {
            if (!dragId || !targetFor(dragId)) return;
            e.preventDefault();
            if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
            setDragOverKey(key);
        },
        onDragLeave: () => setDragOverKey((k) => (k === key ? null : k)),
        onDrop: (e: DragEvent) => {
            e.preventDefault();
            const dragged = dragId;
            endDrag();
            const to = dragged ? targetFor(dragged) : null;
            if (dragged && to) props.onReorder(dragged, to);
        },
    });

    let order = 0;
    const tabRow = (tab: SavedTab) => {
        const category = getTabCategory(tab);
        const index = order++;
        return (
            <TabRow
                key={tab.id}
                tab={tab}
                category={category}
                color={props.colorOf(category)}
                tinted={category !== UNCATEGORIZED}
                outdated={isTabOutdated(tab, props.settings)}
                titleRanges={props.titleRanges?.get(tab.id) ?? []}
                showCategory={props.showCategory}
                entrance={props.searchActive ? "none" : props.entered ? "drop" : "rise"}
                entranceDelayMs={Math.min(index, STAGGER_CAP) * STAGGER_MS}
                flashSeq={props.highlight?.id === tab.id ? props.highlight.seq : null}
                draggable={props.canReorder}
                current={tab.id === current}
                dragging={dragId === tab.id}
                dragOver={dragOverKey === tab.id}
                editOptions={props.editOptions}
                colorOf={props.colorOf}
                onOpen={() => props.onOpen(tab)}
                onEdit={(updates) => props.onEdit(tab, updates)}
                onDelete={() => props.onDelete(tab)}
                dragHandlers={dragHandlersFor(tab.id, tab.id, (dragged) => dropTarget(items, dragged, { tabId: tab.id }))}
            />
        );
    };

    return (
        <>
            <ul
                ref={listRef}
                class={styles.list}
                aria-label={strings.savedTabsLabel}
                onKeyDown={onKeyDown}
                onFocusIn={(e) => {
                    const li = (e.target as HTMLElement).closest<HTMLElement>("li[data-tab-id], li[data-group-id]");
                    const key = li?.dataset.tabId ?? (li?.dataset.groupId ? groupKey(li.dataset.groupId) : undefined);
                    if (key) setCurrentKey(key);
                }}
            >
                {items.map((item) => {
                    if (item.kind === "tab") return tabRow(item.tab);
                    const { group, tabs } = item;
                    const key = groupKey(group.id);
                    const drag = dragHandlersFor(key, null, (dragged) => dropTarget(items, dragged, { groupId: group.id }));
                    return (
                        <GroupRow
                            key={key}
                            group={group}
                            tabs={tabs}
                            current={key === current}
                            dragOver={dragOverKey === key}
                            dragHandlers={drag}
                            flashSeq={props.highlight?.id === group.id ? props.highlight.seq : null}
                            entrance={props.searchActive ? "none" : props.entered ? "drop" : "rise"}
                            entranceDelayMs={Math.min(order++, STAGGER_CAP) * STAGGER_MS}
                            onToggle={() => props.onToggleGroup(group)}
                            onAction={(action) => {
                                if (action !== "rename") props.onGroupAction(group, tabs, action);
                            }}
                            onRename={(name) => props.onRenameGroup(group, name)}
                        >
                            {tabs.map(tabRow)}
                        </GroupRow>
                    );
                })}
            </ul>
            {liveRegion}
        </>
    );
}
