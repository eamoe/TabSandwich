import type { ComponentChildren } from "preact";
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import type { SavedTab, Settings, TabGroup } from "../../types";
import type { SearchMatch } from "../../domain/search";
import { getTabCategory, UNCATEGORIZED } from "../../domain/CategoryRepository";
import type { PickerOption } from "../CategoryPicker";
import { strings } from "../strings";
import { showNoteToast } from "../toastStore";
import { tabsWithPlaced } from "../../domain/TabRepository";
import { usePointerDrag, type Keyed } from "../usePointerDrag";
import { dropTarget, groupItems, isTabAged, reorderTarget, stoppedAtPinLine, type ListItem, type Move } from "./listModel";
import { GroupRow, type GroupAction } from "./GroupRow";
import { TabRow, type EditOutcome, type TabEdits } from "./TabRow";
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
    /** While searching: each shown tab's match (what to highlight in its title, category and window name). */
    matches: Map<string, SearchMatch> | null;
    /** Each tab's saved window name, for the tabs inside one; named on a row only while searching. */
    windowOf: Map<string, string>;
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
    onEdit: (tab: SavedTab, updates: TabEdits) => Promise<EditOutcome>;
    onDelete: (tab: SavedTab) => Promise<boolean>;
    onTogglePin: (tab: SavedTab) => void;
    /** Showing the archive: rows offer Restore and Delete for good; nothing moves or pins. */
    inArchive: boolean;
    onRestore: (tab: SavedTab) => Promise<boolean>;
    /** A tab moved in your own order, maybe into or out of a saved window. */
    onReorder: (draggedId: string, move: Move) => void | Promise<void>;
    onToggleGroup: (group: TabGroup) => void;
    onGroupAction: (group: TabGroup, tabs: SavedTab[], action: Exclude<GroupAction, "rename">) => void;
    onRenameGroup: (group: TabGroup, name: string) => Promise<void>;
    /** Choosing several tabs: rows select instead of opening, and their own actions step aside. */
    selecting: boolean;
    selected: ReadonlySet<string>;
    /** One tab picked or unpicked; `range`: Shift was held. */
    onToggleSelect: (tab: SavedTab, range: boolean) => void;
    /** A saved window's row: all its tabs picked, or unpicked if they all were. */
    onToggleSelectGroup: (tabs: SavedTab[]) => void;
    /** Escape on a row: back to the search box. */
    onEscape: () => void;
}) {
    const listRef = useRef<HTMLUListElement>(null);
    // While a tab is dragged, the list shows it where letting go would put it (in the order
    // placeTab will write, so it lands exactly there); after the drop, until the list arrives in
    // that order. `base` is the list it was worked out from: should another part of the extension
    // change the library meanwhile, the drag is off.
    const [preview, setPreview] = useState<{ dragged: string; move: Move; base: string; dropped: boolean } | null>(null);
    const base = props.tabs.map((t) => `${t.id}:${t.groupId ?? ""}:${t.pinned ? 1 : 0}`).join(" ");
    const shown = preview !== null && preview.base === base ? preview : null;
    // The row the keyboard is on (the first one until focus lands somewhere), and a row to move
    // focus to once the list has re-rendered: the neighbor of a deleted row, or a moved row
    // (moving a focused element in the page drops its focus).
    const [currentKey, setCurrentKey] = useState<string | null>(null);
    const pendingFocus = useRef<string | null>(null);
    const [announcement, setAnnouncement] = useState("");

    const itemsOf = (tabs: SavedTab[]): ListItem[] => (props.grouped ? groupItems(tabs, props.groups) : tabs.map((tab) => ({ kind: "tab", tab })));
    // The list as it is: what a move or a drop is worked out from.
    const items = itemsOf(props.tabs);
    // The list as shown: while a tab is dragged, with it where it will land.
    const shownItems = shown ? itemsOf(tabsWithPlaced(props.tabs, shown.dragged, shown.move.to, shown.move.side ?? "before", shown.move.group) ?? props.tabs) : items;
    const rows = screenRows(shownItems);
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
            const move = reorderTarget(items, row.tab.id, e.key === "ArrowDown" ? "down" : "up");
            if (!props.canReorder) announce(props.inArchive ? strings.cantMoveArchived : props.searchActive ? strings.cantMoveSearching : strings.cantMoveSorted);
            else if (!move && stoppedAtPinLine(items, row.tab.id, e.key === "ArrowDown" ? "down" : "up")) showNoteToast(strings.pinLine(!!row.tab.pinned));
            else if (move) {
                const id = row.tab.id;
                pendingFocus.current = id;
                // Into or out of a window, the row is rebuilt in its new place: focus it again
                // once the move has landed.
                void Promise.resolve(props.onReorder(id, move)).then(() =>
                    requestAnimationFrame(() => {
                        if (!rowElement(id)?.contains(document.activeElement)) focusRow(id);
                    })
                );
                if (row.parent && move.group === null) announce(strings.steppedOutOf(row.tab.title, row.parent.name));
                else {
                    const { at, of } = placeAmong(row.tab.id);
                    announce(strings.movedTo(row.tab.title, at + (e.key === "ArrowDown" ? 1 : -1), of));
                }
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
        } else if (props.selecting && (e.key === "e" || e.key === "E" || e.key === "p" || e.key === "P" || e.key === "Delete" || e.key === "Backspace")) {
            // While selecting, a row's own edit and delete step aside (the bar acts on the selection).
            return;
        } else if ((e.key === "e" || e.key === "E") && row.tab) li.querySelector<HTMLElement>('[data-row-action="edit"]')?.click();
        else if ((e.key === "p" || e.key === "P") && row.tab && !props.inArchive) props.onTogglePin(row.tab);
        else if (e.key === "Delete" || e.key === "Backspace") {
            // Focus moves on to the next row (or the one before, at the end) once this one is gone;
            // past a window's own tabs when the whole window goes.
            const after = rows.slice(index + 1).find((r) => !row.group || r.parent?.id !== row.group.id);
            pendingFocus.current = (after ?? rows[index - 1])?.key ?? null;
            if (row.tab) li.querySelector<HTMLElement>('[data-row-action="delete"]')?.click();
            else {
                const item = items.find((i) => i.kind === "group" && i.group.id === row.group!.id);
                if (item?.kind === "group") props.onGroupAction(item.group, item.tabs, "archive");
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

    const pinnedTab = (id: string) => items.some((i) => (i.kind === "tab" ? [i.tab] : i.tabs).some((t) => t.id === id && t.pinned));
    const drag = usePointerDrag<Move>({
        list: listRef,
        pickUp: (target) => {
            if (!props.canReorder || props.selecting) return null;
            const li = target.closest<HTMLElement>("li[data-tab-id]");
            // (Not a row being edited: its form is for typing.)
            if (!li?.dataset.tabId || !listRef.current?.contains(li) || li.querySelector("form")) return null;
            return { key: li.dataset.tabId, el: li };
        },
        // Each tab's row, and each saved window's own row (not the tabs it holds), top to bottom.
        targets: (list) =>
            [...list.querySelectorAll<HTMLElement>("li[data-tab-id], li[data-group-id] > :first-child")].map(
                (el): Keyed => (el.dataset.tabId ? { key: el.dataset.tabId, el } : { key: groupKey(el.parentElement!.dataset.groupId!), el })
            ),
        movers: (list) =>
            [...list.querySelectorAll<HTMLElement>("li[data-tab-id], li[data-group-id]")].map((el) => ({ key: el.dataset.tabId ?? groupKey(el.dataset.groupId!), el })),
        // The tested rules of where a tab may go, unchanged: over a saved window's row or a tab's.
        resolve: (dragged, at) =>
            at.key.startsWith("group:") ? dropTarget(items, dragged, { groupId: at.key.slice(6) }, at.side) : dropTarget(items, dragged, { tabId: at.key }, at.side),
        same: (a, b) => a.to === b.to && a.group === b.group && a.side === b.side,
        onPreview: (dragged, move) => setPreview(move && { dragged, move, base, dropped: false }),
        onDrop: (dragged, move, refused) => {
            // Past the pinned line, it lands at the line; the note says why it went no further.
            if (refused) showNoteToast(strings.pinLineDrag(pinnedTab(dragged)));
            if (!move) return setPreview(null);
            setPreview((shown) => shown && { ...shown, dropped: true });
            void props.onReorder(dragged, move);
        },
        elementOf: (key) => rowElement(key) ?? null,
        liftClass: styles.lifted,
    });
    // Once the list arrives in its new order, it's the list's own again (or, should the move have
    // failed, after a moment). Changed from elsewhere in the middle of a drag, the tab goes back.
    useEffect(() => {
        if (!preview || preview.base === base) {
            if (!preview?.dropped) return;
            const forget = setTimeout(() => setPreview(null), 2000);
            return () => clearTimeout(forget);
        }
        if (preview.dropped) setPreview(null);
        else drag.cancel();
    });

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
                outdated={isTabAged(tab, props.settings)}
                match={props.matches?.get(tab.id) ?? null}
                windowName={props.searchActive ? (props.windowOf.get(tab.id) ?? null) : null}
                showCategory={props.showCategory}
                // (Dragged into or out of a saved window, its row is made anew there: without an entrance.)
                entrance={props.searchActive || drag.dragging === tab.id ? "none" : props.entered ? "drop" : "rise"}
                entranceDelayMs={Math.min(index, STAGGER_CAP) * STAGGER_MS}
                flashSeq={props.highlight?.id === tab.id ? props.highlight.seq : null}
                draggable={props.canReorder && !props.selecting}
                current={tab.id === current}
                selecting={props.selecting}
                selected={props.selected.has(tab.id)}
                onToggleSelect={(range) => props.onToggleSelect(tab, range)}
                dragging={drag.dragging === tab.id}
                editOptions={props.editOptions}
                colorOf={props.colorOf}
                onOpen={() => props.onOpen(tab)}
                onEdit={(updates) => props.onEdit(tab, updates)}
                onDelete={() => props.onDelete(tab)}
                onTogglePin={() => props.onTogglePin(tab)}
                inArchive={props.inArchive}
                onRestore={() => props.onRestore(tab)}
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
                onPointerDown={drag.onPointerDown}
                onFocusIn={(e) => {
                    const li = (e.target as HTMLElement).closest<HTMLElement>("li[data-tab-id], li[data-group-id]");
                    const key = li?.dataset.tabId ?? (li?.dataset.groupId ? groupKey(li.dataset.groupId) : undefined);
                    if (key) setCurrentKey(key);
                }}
            >
                {shownItems.map((item) => {
                    if (item.kind === "tab") return tabRow(item.tab);
                    const { group, tabs } = item;
                    const key = groupKey(group.id);
                    return (
                        <GroupRow
                            key={key}
                            group={group}
                            tabs={tabs}
                            current={key === current}
                            receiving={drag.dragging !== null && shown?.move.group === group.id}
                            flashSeq={props.highlight?.id === group.id ? props.highlight.seq : null}
                            entrance={props.searchActive ? "none" : props.entered ? "drop" : "rise"}
                            entranceDelayMs={Math.min(order++, STAGGER_CAP) * STAGGER_MS}
                            selecting={props.selecting}
                            selection={
                                tabs.every((t) => props.selected.has(t.id)) ? "all" : tabs.some((t) => props.selected.has(t.id)) ? "some" : "none"
                            }
                            onToggleSelect={() => props.onToggleSelectGroup(tabs)}
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
