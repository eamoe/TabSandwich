import { useEffect, useRef, useState } from "preact/hooks";
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
    showCategory: boolean;
    entered: boolean;
    highlight: Highlight | null;
    emptyText: string;
    editOptions: PickerOption[];
    colorOf: (category: string) => string;
    onOpen: (tab: SavedTab) => void;
    onEdit: (tab: SavedTab, updates: { title: string; url: string; category: string }) => Promise<EditOutcome>;
    onDelete: (tab: SavedTab) => void;
    onReorder: (draggedId: string, targetId: string) => void;
}) {
    const listRef = useRef<HTMLUListElement>(null);
    const [dragId, setDragId] = useState<string | null>(null);
    const [dragOverId, setDragOverId] = useState<string | null>(null);

    // A just-saved or just-restored tab is scrolled into view wherever it sits in a long list.
    useEffect(() => {
        if (!props.highlight) return;
        listRef.current
            ?.querySelector(`li[data-tab-id="${CSS.escape(props.highlight.id)}"]`)
            ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, [props.highlight]);

    if (props.tabs.length === 0) {
        return (
            <ul class={styles.list} aria-label={strings.savedTabsLabel}>
                <li class={styles.empty}>{props.emptyText}</li>
            </ul>
        );
    }

    return (
        <ul ref={listRef} class={styles.list} aria-label={strings.savedTabsLabel}>
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
                        // Search results are in match order, not your order: dragging one would
                        // reorder the real list to match a ranking that disappears with the query.
                        draggable={!props.searchActive}
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
    );
}
