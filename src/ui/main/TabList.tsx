import type { ComponentChildren } from "preact";
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import type { SavedTab, Settings, TabGroup } from "../../types";
import type { SearchMatch } from "../../domain/search";
import { getTabCategory, UNCATEGORIZED } from "../../domain/CategoryRepository";
import type { PickerOption } from "../CategoryPicker";
import { strings } from "../strings";
import { showNoteToast } from "../toastStore";
import { dropTarget, edgeScrollSpeed, groupItems, isTabAged, reorderTarget, stoppedAtPinLine, type DropSide, type ListItem, type Move } from "./listModel";
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
    const [dragId, setDragId] = useState<string | null>(null);
    // The row a dragged tab is over, and which half: where the insertion line shows.
    const [dropAt, setDropAt] = useState<{ key: string; side: DropSide } | null>(null);
    // Where letting go now would put the tab: the place the line shows, kept while the pointer
    // crosses the gap between two rows (which is no row's), so a drop on the line itself lands.
    const landing = useRef<{ key: string; side: DropSide; move: Move } | null>(null);
    // Over a place the pinned line keeps the dragged tab from: let go there, and the note says why it went back.
    const overPinLine = useRef(false);
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

    // Where each row stood just before a drop, until the list shows the new order: then each row
    // that moved slides from there to its new place instead of jumping. (Forgotten after a while,
    // should the move have been refused or failed.)
    const slideFrom = useRef<{ at: number; order: string; tops: Map<string, number>; dropped: string } | null>(null);
    useLayoutEffect(() => {
        const from = slideFrom.current;
        const list = listRef.current;
        if (!from || !list) return;
        if (performance.now() - from.at > SLIDE_WAIT_MS) {
            slideFrom.current = null;
            return;
        }
        const now = placedRows(list);
        if (now.order === from.order) return;
        slideFrom.current = null;
        slideRows(list, from.tops, now.tops, from.dropped);
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

    /** The line shows (or goes), and letting go would land there. */
    const land = (at: { key: string; side: DropSide; move: Move } | null) => {
        landing.current = at;
        setDropAt((shown) => (shown?.key === at?.key && shown?.side === at?.side ? shown : at && { key: at.key, side: at.side }));
    };
    // While a tab is dragged: off the list (onto the header, the filters, out of the window) there's
    // no line and no drop; near the list's top or bottom edge, or past it, the list scrolls, so a
    // tab can go anywhere in it, not only among the rows in view.
    useEffect(() => {
        if (!dragId) return;
        const scroller = scrollParent(listRef.current);
        let pointerY: number | null = null;
        const track = (e: DragEvent) => {
            pointerY = e.clientY;
            if (listRef.current?.contains(e.target as Node)) return;
            land(null);
            // (Off the list, letting go is no attempt at the pinned line, so it says nothing about it.)
            overPinLine.current = false;
        };
        let frame = requestAnimationFrame(function scroll() {
            if (scroller && pointerY !== null) {
                // Its edges as seen: a list running past the window's bottom scrolls from there.
                const box = scroller.getBoundingClientRect();
                scroller.scrollTop += edgeScrollSpeed(pointerY, Math.max(box.top, 0), Math.min(box.bottom, window.innerHeight));
            }
            frame = requestAnimationFrame(scroll);
        });
        // (Entering counts too: over a text field Chrome sends no dragover at all.)
        document.addEventListener("dragenter", track);
        document.addEventListener("dragover", track);
        return () => {
            cancelAnimationFrame(frame);
            document.removeEventListener("dragenter", track);
            document.removeEventListener("dragover", track);
        };
    }, [dragId]);

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
        land(null);
        overPinLine.current = false;
    };
    const pinnedTab = (id: string) => items.some((i) => (i.kind === "tab" ? [i.tab] : i.tabs).some((t) => t.id === id && t.pinned));
    /** The half of the row under the pointer: the tab lands above the row, or below it. */
    const sideOf = (e: DragEvent): DropSide => {
        const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
        return e.clientY < box.top + box.height / 2 ? "before" : "after";
    };
    /** Drag handlers for a row, given where a drop on it (on which half) would put the dragged tab. */
    const dragHandlersFor = (key: string, dragOwnId: string | null, targetFor: (dragged: string, side: DropSide) => Move | null) => ({
        onDragStart: (e: DragEvent) => {
            if (!dragOwnId) return;
            setDragId(dragOwnId);
            if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
        },
        onDragEnd: () => {
            if (dragId && overPinLine.current) showNoteToast(strings.pinLineDrag(pinnedTab(dragId)));
            endDrag();
        },
        onDragOver: (e: DragEvent) => {
            // (Nothing to do for anything that isn't a tab being dragged.)
            if (!dragId) return;
            const side = sideOf(e);
            // Over its own row there's no place to go; over a place past the pinned line, none either,
            // and letting go there says why. Either way the line goes, and so does the drop.
            const move = key === dragId ? null : targetFor(dragId, side);
            overPinLine.current = key !== dragId && !move;
            land(move && { key, side, move });
            if (!move) return;
            e.preventDefault();
            if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
        },
    });
    // The list's own: a drop in the gap between rows lands where the line shows, as one on a row does.
    const listDragOver = (e: DragEvent) => {
        if (!dragId || !landing.current) return;
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
    };
    const listDrop = (e: DragEvent) => {
        e.preventDefault();
        const dragged = dragId;
        const to = landing.current?.move;
        endDrag();
        if (!dragged || !to) return;
        if (listRef.current && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) slideFrom.current = { at: performance.now(), ...placedRows(listRef.current), dropped: `tab:${dragged}` };
        props.onReorder(dragged, to);
    };

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
                entrance={props.searchActive ? "none" : props.entered ? "drop" : "rise"}
                entranceDelayMs={Math.min(index, STAGGER_CAP) * STAGGER_MS}
                flashSeq={props.highlight?.id === tab.id ? props.highlight.seq : null}
                draggable={props.canReorder && !props.selecting}
                current={tab.id === current}
                selecting={props.selecting}
                selected={props.selected.has(tab.id)}
                onToggleSelect={(range) => props.onToggleSelect(tab, range)}
                dragging={dragId === tab.id}
                dropSide={dropAt?.key === tab.id ? dropAt.side : null}
                editOptions={props.editOptions}
                colorOf={props.colorOf}
                onOpen={() => props.onOpen(tab)}
                onEdit={(updates) => props.onEdit(tab, updates)}
                onDelete={() => props.onDelete(tab)}
                onTogglePin={() => props.onTogglePin(tab)}
                inArchive={props.inArchive}
                onRestore={() => props.onRestore(tab)}
                dragHandlers={dragHandlersFor(tab.id, tab.id, (dragged, side) => dropTarget(items, dragged, { tabId: tab.id }, side))}
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
                onDragOver={listDragOver}
                onDrop={listDrop}
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
                    const drag = dragHandlersFor(key, null, (dragged, side) => dropTarget(items, dragged, { groupId: group.id }, side));
                    return (
                        <GroupRow
                            key={key}
                            group={group}
                            tabs={tabs}
                            current={key === current}
                            dropSide={dropAt?.key === key ? dropAt.side : null}
                            dragHandlers={drag}
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

/** The element that scrolls the list: in the popup and the side panel, the main area around it. */
function scrollParent(el: HTMLElement | null): HTMLElement | null {
    for (let at = el?.parentElement ?? null; at; at = at.parentElement) {
        if (/auto|scroll/.test(getComputedStyle(at).overflowY)) return at;
    }
    return null;
}

/** How long a dropped tab's rows take to slide into place, and how long a drop waits for its new order. */
const SLIDE_MS = 220;
const SLIDE_WAIT_MS = 2000;
/** A row this far above or below the list's visible part still slides: it's about to come into sight. */
const SLIDE_MARGIN = 80;

/** Every row on screen (tabs and saved windows), top to bottom: their order, and where each stands. */
function placedRows(list: HTMLElement): { order: string; tops: Map<string, number> } {
    const tops = new Map<string, number>();
    for (const li of list.querySelectorAll<HTMLElement>("li[data-tab-id], li[data-group-id]")) tops.set(rowKeyOf(li), li.getBoundingClientRect().top);
    return { order: [...tops.keys()].join(" "), tops };
}
const rowKeyOf = (li: HTMLElement) => (li.dataset.tabId ? `tab:${li.dataset.tabId}` : `group:${li.dataset.groupId}`);

/**
 * Each row that moved starts where it stood and slides to where it is now; the dropped one
 * (`dropped`) over the rows it passes, not under them. A tab inside a saved window moves with its
 * window, so only its own move within it is its to show. Rows out of sight before and after
 * don't slide: in a library of hundreds, a long move would start hundreds of slides nobody sees.
 */
function slideRows(list: HTMLElement, before: Map<string, number>, after: Map<string, number>, dropped: string) {
    const moved = (key: string) => (before.get(key) ?? after.get(key)!) - after.get(key)!;
    const view = scrollParent(list)?.getBoundingClientRect();
    const top = Math.max(view?.top ?? 0, 0) - SLIDE_MARGIN;
    const bottom = Math.min(view?.bottom ?? window.innerHeight, window.innerHeight) + SLIDE_MARGIN;
    const inSight = (y: number) => y >= top && y <= bottom;
    for (const li of list.querySelectorAll<HTMLElement>("li[data-tab-id], li[data-group-id]")) {
        const key = rowKeyOf(li);
        if (!before.has(key) || !(inSight(before.get(key)!) || inSight(after.get(key)!))) continue;
        const savedWindow = li.parentElement?.closest<HTMLElement>("li[data-group-id]");
        const by = moved(key) - (savedWindow ? moved(rowKeyOf(savedWindow)) : 0);
        if (Math.abs(by) < 1) continue;
        const slide = li.animate([{ transform: `translateY(${by}px)` }, { transform: "none" }], { duration: SLIDE_MS, easing: "cubic-bezier(0.2, 0, 0, 1)" });
        if (key === dropped) {
            li.style.zIndex = "2";
            void slide.finished.catch(() => undefined).then(() => li.style.removeProperty("z-index"));
        }
    }
}
