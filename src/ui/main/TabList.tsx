import type { ComponentChildren } from "preact";
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import type { SavedTab, Settings } from "../../types";
import type { MatchRange } from "../../domain/search";
import { getTabCategory, UNCATEGORIZED } from "../../domain/CategoryRepository";
import type { PickerOption } from "../CategoryPicker";
import { strings } from "../strings";
import { isTabOutdated } from "./listModel";
import { TabRow, type EditOutcome } from "./TabRow";
import styles from "./TabList.module.css";

export interface Highlight {
    id: string;
    seq: number;
}

const STAGGER_MS = 28;
const STAGGER_CAP = 12;

export function TabList(props: {
    tabs: SavedTab[];
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
    /** Escape on a row: back to the search box. */
    onEscape: () => void;
}) {
    const listRef = useRef<HTMLUListElement>(null);
    const [dragId, setDragId] = useState<string | null>(null);
    const [dragOverId, setDragOverId] = useState<string | null>(null);
    // The row the keyboard is on (the first one until focus lands somewhere), and a row to move
    // focus to once the list has re-rendered: the neighbor of a deleted row, or a moved row
    // (moving a focused element in the page drops its focus).
    const [currentId, setCurrentId] = useState<string | null>(null);
    const pendingFocus = useRef<string | null>(null);
    const [announcement, setAnnouncement] = useState("");
    const current = props.tabs.some((t) => t.id === currentId) ? currentId : (props.tabs[0]?.id ?? null);

    const focusRow = (id: string) =>
        listRef.current?.querySelector<HTMLElement>(`li[data-tab-id="${CSS.escape(id)}"] [data-row-title]`)?.focus();

    useLayoutEffect(() => {
        const id = pendingFocus.current;
        if (id && props.tabs.some((t) => t.id === id)) {
            pendingFocus.current = null;
            focusRow(id);
        }
    }, [props.tabs]);

    // A live region only speaks when its text changes, so a repeated message gets a different
    // invisible ending.
    const announce = (text: string) => setAnnouncement((prev) => (prev === text ? `${text}\u00a0` : text));

    const onKeyDown = (e: KeyboardEvent) => {
        const target = e.target as HTMLElement;
        // Typing in the edit form is typing, not list navigation.
        if (target.closest("form") || e.ctrlKey || e.metaKey) return;
        const row = target.closest<HTMLElement>("li[data-tab-id]");
        const index = props.tabs.findIndex((t) => t.id === row?.dataset.tabId);
        if (!row || index === -1) return;
        const tab = props.tabs[index];
        const go = (i: number) => focusRow(props.tabs[Math.max(0, Math.min(i, props.tabs.length - 1))].id);

        if ((e.key === "ArrowDown" || e.key === "ArrowUp") && e.altKey) {
            const neighbor = props.tabs[index + (e.key === "ArrowDown" ? 1 : -1)];
            if (!props.canReorder) announce(props.searchActive ? strings.cantMoveSearching : strings.cantMoveSorted);
            else if (neighbor) {
                pendingFocus.current = tab.id;
                props.onReorder(tab.id, neighbor.id);
                announce(strings.movedTo(tab.title, index + (e.key === "ArrowDown" ? 2 : 0), props.tabs.length));
            }
        } else if (e.altKey || e.shiftKey) {
            return;
        } else if (e.key === "ArrowDown") go(index + 1);
        else if (e.key === "ArrowUp") go(index - 1);
        else if (e.key === "Home") go(0);
        else if (e.key === "End") go(props.tabs.length - 1);
        else if (e.key === "e" || e.key === "E") row.querySelector<HTMLElement>('[data-row-action="edit"]')?.click();
        else if (e.key === "Delete" || e.key === "Backspace") {
            // Focus moves on to the next row (or the one before, at the end) once this one is gone.
            pendingFocus.current = (props.tabs[index + 1] ?? props.tabs[index - 1])?.id ?? null;
            row.querySelector<HTMLElement>('[data-row-action="delete"]')?.click();
        } else if (e.key === "Escape") props.onEscape();
        else return;
        e.preventDefault();
    };

    // A just-saved or just-restored tab is scrolled into view wherever it sits in a long list.
    useEffect(() => {
        if (!props.highlight) return;
        listRef.current
            ?.querySelector(`li[data-tab-id="${CSS.escape(props.highlight.id)}"]`)
            ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
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

    return (
        <>
        <ul
            ref={listRef}
            class={styles.list}
            aria-label={strings.savedTabsLabel}
            onKeyDown={onKeyDown}
            onFocusIn={(e) => {
                const id = (e.target as HTMLElement).closest<HTMLElement>("li[data-tab-id]")?.dataset.tabId;
                if (id) setCurrentId(id);
            }}
        >
            {props.tabs.map((tab, index) => {
                const category = getTabCategory(tab);
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
                        dragOver={dragOverId === tab.id}
                        editOptions={props.editOptions}
                        colorOf={props.colorOf}
                        onOpen={() => props.onOpen(tab)}
                        onEdit={(updates) => props.onEdit(tab, updates)}
                        onDelete={() => props.onDelete(tab)}
                        dragHandlers={{
                            onDragStart: (e) => {
                                setDragId(tab.id);
                                if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
                            },
                            onDragEnd: () => {
                                setDragId(null);
                                setDragOverId(null);
                            },
                            onDragOver: (e) => {
                                if (!dragId || dragId === tab.id) return;
                                e.preventDefault();
                                if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
                                setDragOverId(tab.id);
                            },
                            onDragLeave: () => setDragOverId((id) => (id === tab.id ? null : id)),
                            onDrop: (e) => {
                                e.preventDefault();
                                const dragged = dragId;
                                setDragId(null);
                                setDragOverId(null);
                                if (dragged && dragged !== tab.id) props.onReorder(dragged, tab.id);
                            },
                        }}
                    />
                );
            })}
        </ul>
        {liveRegion}
        </>
    );
}
