import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "preact/hooks";
import type { SavedTab, SortOrder, TabGroup } from "../../types";
import {
    editTab,
    deleteTab,
    deleteTabs,
    putBackTab,
    moveTab,
    placeTab,
    undoMoveTab,
    restoreCategories,
    restoreTab,
    restoreTabs,
    reorderTabs,
    setCategoryOf,
    setPinned,
    archiveTabs,
    unarchiveTabs,
    type AddTabResult,
} from "../../domain/TabRepository";
import { getCategoryColorHex, getTabCategory, UNCATEGORIZED } from "../../domain/CategoryRepository";
import { renameGroup, restoreGroup, setGroupCollapsed, ungroup, type RemovedGroup } from "../../domain/GroupRepository";
import { searchTabs, type SearchMatch } from "../../domain/search";
import { setSort } from "../../domain/SettingsRepository";
import { getGroups, getTabs, setLastSeenVersion } from "../../storage/chromeStorage";
import { writeErrorMessage } from "../errors";
import { applyTheme } from "../theme";
import { hasPendingUndo, showErrorToast, showUndoToast, undoFromToast } from "../toastStore";
import { Icon } from "../Icon";
import { Toast } from "../Toast";
import { strings } from "../strings";
import { Header } from "./Header";
import { SaveCard } from "./SaveCard";
import { ManualForm } from "./ManualForm";
import { FilterPills, StorageWarning } from "./FilterPills";
import { SortMenu } from "./SortMenu";
import { SelectButton, SelectionBar } from "./SelectionBar";
import { AllArchived, EmptyLibrary, NoMatches, WhatsNew } from "./EmptyStates";
import { TabList, type Highlight } from "./TabList";
import type { GroupAction } from "./GroupRow";
import { leaveDurationMs, type EditOutcome } from "./TabRow";
import { ALL, ARCHIVED, OUTDATED, applyFilter, isArchived, effectiveFilter, filterOptions, groupItems, pinnedFirst, sortTabs, windowNames, type Move } from "./listModel";
import { useLibrary } from "./useLibrary";
import { SettingsScreen, type SettingsTabKey } from "../settings/SettingsScreen";
import heroStyles from "./Hero.module.css";
import listStyles from "./TabList.module.css";
import styles from "./App.module.css";

const STORAGE_WARNING_PCT = 80;
/** Rows rise in when the popup opens; after this, a row that appears (saved, restored) drops in instead. */
const ENTRANCE_MS = 900;

export function App(props: { whatsNew?: string | null }) {
    const { library, reload } = useLibrary();
    const [view, setView] = useState<"main" | "settings">("main");
    const [settingsTab, setSettingsTab] = useState<SettingsTabKey>("general");
    const [whatsNew, setWhatsNew] = useState(props.whatsNew ?? null);
    const [filter, setFilter] = useState(ALL);
    const [query, setQuery] = useState("");
    const [manualOpen, setManualOpen] = useState(false);
    /** New saves so far; the header logo hops on each. */
    const [hops, setHops] = useState(0);
    // Choosing several tabs: on or off, what's picked, and the last one picked (where a
    // Shift-click range starts).
    const [selecting, setSelecting] = useState(false);
    const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
    const rangeStart = useRef<string | null>(null);
    // Read by the page-wide key handler, which must see a change the moment it renders (a quick
    // Escape right after starting to select), not once the handler is next replaced.
    const selectingNow = useRef(false);
    selectingNow.current = selecting;
    const [highlight, setHighlight] = useState<Highlight | null>(null);
    const [entered, setEntered] = useState(false);
    // The sort just picked, shown straight away while it's being saved; cleared once the
    // library reloads with what's actually stored (so a failed save puts the old sort back).
    const [pendingSort, setPendingSort] = useState<SortOrder | null>(null);
    const settingsButton = useRef<HTMLButtonElement>(null);
    const mainScreen = useRef<HTMLDivElement>(null);
    // The tallest either screen has been while the popup is open. Both screens are at least this
    // tall, so switching screens or Settings tabs can grow the popup window but never shrink it
    // back and forth.
    const [floorHeight, setFloorHeight] = useState(0);
    const raiseFloor = useCallback((height: number) => setFloorHeight((h) => Math.max(h, height)), []);
    const highlightSeq = useRef(0);

    // Settings opens at least as tall as the main screen was, so the popup window doesn't
    // shrink on the way in and grow again on the way back.
    const openSettings = (tab: SettingsTabKey = "general") => {
        raiseFloor(mainScreen.current?.offsetHeight ?? 0);
        setSettingsTab(tab);
        setView("settings");
    };
    const closeSettings = () => {
        setView("main");
        // Back from Settings returns focus to the control that opened it, once it's visible again.
        setTimeout(() => settingsButton.current?.focus());
    };

    // Every load re-applies the stored theme, so the popup always matches what's saved: after
    // importing a backup (or undoing that), and after a theme change that failed to save.
    useEffect(() => {
        if (library) applyTheme(library.settings.theme);
    }, [library]);

    // First load done: start the entrance clock, and tell the robot tests every control is live.
    const loaded = library !== null;
    useEffect(() => {
        if (!loaded) return;
        document.body.dataset.ready = "true";
        const timer = setTimeout(() => setEntered(true), ENTRANCE_MS);
        return () => clearTimeout(timer);
    }, [loaded]);

    // Said to screen readers after a pin or unpin (the row's move and flash show it on screen).
    const [pinNote, setPinNote] = useState("");
    const flash = useCallback((id: string) => setHighlight({ id, seq: ++highlightSeq.current }), []);

    const stopSelecting = useCallback(() => {
        setSelecting(false);
        setPicked(new Set());
        rangeStart.current = null;
    }, []);

    // The filter row and the selection bar swap places, taking the button just pressed with them:
    // focus moves to its counterpart in the row that replaced it (unless it's somewhere else now).
    const firstSelectRender = useRef(true);
    useLayoutEffect(() => {
        if (firstSelectRender.current) {
            firstSelectRender.current = false;
            return;
        }
        if (document.activeElement && document.activeElement !== document.body) return;
        mainScreen.current?.querySelector<HTMLElement>(`button[aria-pressed][aria-label="${selecting ? strings.stopSelecting : strings.selectTabs}"]`)?.focus();
    }, [selecting]);

    // Picks are about the tabs on screen: a new filter or search starts over.
    useEffect(() => {
        setPicked(new Set());
        rangeStart.current = null;
    }, [filter, query]);

    // Keys that work anywhere on the main screen (but never while typing in a field):
    // "/" jumps to search, Ctrl+Z / ⌘Z undoes whatever the toast offers to undo.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            if (view !== "main" || target.closest("input, textarea, select, [contenteditable]")) return;
            if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey) {
                const search = document.getElementById("search-input");
                if (!search) return;
                e.preventDefault();
                search.focus();
            } else if (e.key === "Escape" && selectingNow.current) {
                // Escape leaves selecting first (and doesn't close the popup on the way).
                e.preventDefault();
                stopSelecting();
            } else if (e.key.toLowerCase() === "z" && (e.ctrlKey || e.metaKey) && !e.shiftKey && hasPendingUndo()) {
                e.preventDefault();
                undoFromToast();
            }
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [view, stopSelecting]);

    const focusSearch = () => document.getElementById("search-input")?.focus();
    const focusFirstRow = () => document.querySelector<HTMLElement>("#main-view li[data-tab-id] [data-row-title]")?.focus();

    const colorOf = useCallback(
        (category: string) => getCategoryColorHex(category, library?.settings.categoryColors ?? {}),
        [library]
    );

    const options = useMemo(() => (library ? filterOptions(library.tabs, library.settings) : []), [library]);
    const activeFilter = effectiveFilter(filter, options);
    const sort = pendingSort ?? library?.settings.sort ?? "custom";

    // The tabs in the list; archived ones show only on the Archived filter.
    const active = useMemo(() => (library ? library.tabs.filter((t) => !isArchived(t)) : []), [library]);
    // Search results list every tab as its own row, so each one in a saved window names it.
    const windowOf = useMemo(() => (library ? windowNames(active, library.groups) : new Map<string, string>()), [library, active]);

    const visible = useMemo(() => {
        if (!library) return { tabs: [] as SavedTab[], matches: null };
        const filtered = sortTabs(applyFilter(library.tabs, library.settings, activeFilter), sort);
        const q = query.trim();
        // Pinned tabs first in every sort; a saved window (shown only on All) keeps its pinned ones at its own top.
        if (!q && activeFilter === ARCHIVED) return { tabs: filtered, matches: null };
        if (!q) return { tabs: pinnedFirst(filtered, activeFilter === ALL ? new Set(windowOf.keys()) : undefined), matches: null };
        const matches = searchTabs(filtered, q, (tab) => ({ category: getTabCategory(tab), window: windowOf.get(tab.id) }));
        return { tabs: matches.map((m) => m.tab), matches: new Map<string, SearchMatch>(matches.map((m) => [m.tab.id, m])) };
    }, [library, activeFilter, sort, query, windowOf]);

    // The toast sits outside the main screen so it still shows while Settings is open.
    if (!library) return <Toast />;

    const configured = library.settings.categories;
    const saveOptions = [UNCATEGORIZED, ...configured].map((c) => ({ value: c, label: c }));
    const editOptions = [...configured, UNCATEGORIZED].map((c) => ({ value: c, label: c }));
    // Anything saved at all, archive included: the filter row (and the Archived pill) shows.
    const hasTabs = library.tabs.length > 0;
    const searching = query.trim().length > 0;
    const inArchive = activeFilter === ARCHIVED;
    const archivedCount = library.tabs.length - active.length;
    // Nothing found here, but the archive has a match: the empty list offers to search there.
    const archiveHasMatch =
        searching && !inArchive && visible.tabs.length === 0 && searchTabs(library.tabs.filter(isArchived), query.trim()).length > 0;

    const afterSave = async (result: AddTabResult) => {
        if (!result.duplicate) setHops((n) => n + 1);
        setManualOpen(false);
        await reload();
        setFilter(ALL);
        setQuery("");
        flash(result.tab.id);
    };

    // A whole window saved: it's at the top of the list (as one saved window), so show all of it.
    const afterWindowSave = async (added: SavedTab[], group: TabGroup | null) => {
        setHops((n) => n + 1);
        await reload();
        setFilter(ALL);
        setQuery("");
        if (group) flash(group.id);
        else if (added[0]) flash(added[0].id);
    };

    /**
     * A tab inside a closed saved window can't be seen or flashed: open the window first. Only
     * matters where windows show as windows (All, no search); elsewhere every tab is its own row.
     */
    const openWindowHolding = async (id: string, grouped: boolean) => {
        if (!grouped) return;
        // Read fresh: this runs right after a save or Undo, before the screen has caught up.
        const [tabs, groups] = await Promise.all([getTabs(), getGroups()]);
        const item = groupItems(tabs.filter((t) => !isArchived(t)), groups).find((i) => i.kind === "group" && i.tabs.some((t) => t.id === id));
        if (item?.kind === "group" && item.group.collapsed) {
            await setGroupCollapsed(item.group.id, false).catch(() => undefined);
            await reload();
        }
    };

    // Brings a saved tab into view and flashes it, widening the list only if it's filtered out
    // (to the archive, for an archived one).
    const reveal = async (id: string) => {
        const widen = !visible.tabs.some((t) => t.id === id);
        if (widen) {
            setFilter(library.tabs.some((t) => t.id === id && isArchived(t)) ? ARCHIVED : ALL);
            setQuery("");
        }
        await openWindowHolding(id, widen || (activeFilter === ALL && !searching));
        flash(id);
    };

    // From the save card or the + form: an archived page back in the list, shown where it landed.
    const restoreSaved = async (id: string) => {
        setManualOpen(false);
        try {
            const restored = await unarchiveTabs([id]);
            await reload();
            if (restored.length === 0) return;
            setFilter(ALL);
            setQuery("");
            await openWindowHolding(id, true);
            flash(id);
            showUndoToast(strings.restoredToast, async () => {
                try {
                    await archiveTabs(restored);
                } catch (err) {
                    showErrorToast(writeErrorMessage(err));
                }
                await reload();
            });
        } catch (err) {
            showErrorToast(writeErrorMessage(err));
        }
    };

    const afterUpdate = async (previous: SavedTab) => {
        await reload();
        reveal(previous.id);
        showUndoToast(strings.updatedToast, async () => {
            try {
                await putBackTab(previous);
            } catch (err) {
                showErrorToast(writeErrorMessage(err));
            }
            await reload();
            flash(previous.id);
        });
    };

    const onEdit = async (tab: SavedTab, updates: { title: string; url: string; category: string }): Promise<EditOutcome> => {
        let outcome: EditOutcome;
        try {
            const { duplicateOf } = await editTab(tab.id, updates);
            // Refused, nothing written: the row stays open, so there's nothing to reload.
            if (duplicateOf) return { status: "duplicate", existingTitle: duplicateOf.title };
            outcome = { status: "saved" };
        } catch (err) {
            showErrorToast(writeErrorMessage(err));
            outcome = { status: "failed" };
        }
        await reload();
        return outcome;
    };

    const onDelete = async (tab: SavedTab): Promise<boolean> => {
        let removed: Awaited<ReturnType<typeof deleteTab>> = null;
        try {
            removed = await deleteTab(tab.id);
        } catch (err) {
            showErrorToast(writeErrorMessage(err));
        }
        // Already saved; only the refresh waits, so the row can finish sliding away first.
        await new Promise((resolve) => setTimeout(resolve, leaveDurationMs()));
        await reload();
        if (!removed) return false;
        const { tab: deleted, index } = removed;
        showUndoToast(strings.deleted, async () => {
            try {
                await restoreTab(deleted, index);
            } catch (err) {
                showErrorToast(writeErrorMessage(err));
            }
            await reload();
            await openWindowHolding(deleted.id, activeFilter === ALL && !searching);
            flash(deleted.id);
        });
        return true;
    };

    // Archiving (a row's own button, or Delete): out of the list, back where it was with Undo.
    const onArchive = async (tab: SavedTab): Promise<boolean> => {
        let archived: string[] = [];
        try {
            archived = await archiveTabs([tab.id]);
        } catch (err) {
            showErrorToast(writeErrorMessage(err));
        }
        await new Promise((resolve) => setTimeout(resolve, leaveDurationMs()));
        await reload();
        if (archived.length === 0) return false;
        showUndoToast(strings.archivedToast, async () => {
            try {
                await unarchiveTabs(archived);
            } catch (err) {
                showErrorToast(writeErrorMessage(err));
            }
            await reload();
            await openWindowHolding(tab.id, activeFilter === ALL && !searching);
            flash(tab.id);
        });
        return true;
    };

    // Restoring, in the archive: back in the list, where it was (in its saved window too).
    const onRestore = async (tab: SavedTab): Promise<boolean> => {
        let restored: string[] = [];
        try {
            restored = await unarchiveTabs([tab.id]);
        } catch (err) {
            showErrorToast(writeErrorMessage(err));
        }
        await new Promise((resolve) => setTimeout(resolve, leaveDurationMs()));
        await reload();
        if (restored.length === 0) return false;
        showUndoToast(strings.restoredToast, async () => {
            try {
                await archiveTabs(restored);
            } catch (err) {
                showErrorToast(writeErrorMessage(err));
            }
            await reload();
        });
        return true;
    };

    // Pinning moves the row (to the top, or back down among the rest): it flashes where it lands.
    const onTogglePin = async (tab: SavedTab) => {
        const pinning = !tab.pinned;
        try {
            await setPinned(tab.id, pinning);
        } catch (err) {
            showErrorToast(writeErrorMessage(err));
        }
        await reload();
        flash(tab.id);
        setPinNote(pinning ? strings.pinnedNote(tab.title) : strings.unpinnedNote(tab.title));
    };

    const onToggleGroup = async (group: TabGroup) => {
        try {
            await setGroupCollapsed(group.id, !group.collapsed);
        } catch (err) {
            showErrorToast(writeErrorMessage(err));
        }
        await reload();
    };

    const onRenameGroup = async (group: TabGroup, name: string) => {
        try {
            await renameGroup(group.id, name);
        } catch (err) {
            showErrorToast(writeErrorMessage(err));
        }
        await reload();
    };

    /**
     * Archives tabs (a saved window's, the picked ones, or every waiting one) in one step, with one
     * Undo that restores them all where they were; `flashId` is what flashes after Undo.
     */
    const archiveMany = async (ids: string[], message: (count: number) => string, flashId?: string) => {
        const archived = await archiveTabs(ids);
        await reload();
        if (archived.length === 0) return;
        showUndoToast(message(archived.length), async () => {
            try {
                await unarchiveTabs(archived);
            } catch (err) {
                showErrorToast(writeErrorMessage(err));
            }
            await reload();
            if (flashId) flash(flashId);
        });
    };

    /** Undo for breaking a saved window apart: everything back, the window flashing. */
    const offerGroupUndo = (message: string, snapshot: RemovedGroup) =>
        showUndoToast(message, async () => {
            try {
                await restoreGroup(snapshot);
            } catch (err) {
                showErrorToast(writeErrorMessage(err));
            }
            await reload();
            flash(snapshot.group.id);
        });

    const onGroupAction = async (group: TabGroup, tabs: SavedTab[], action: Exclude<GroupAction, "rename">) => {
        const urls = tabs.map((t) => t.url);
        try {
            if (action === "open") {
                // Opening a window usually closes the popup, so there's nothing to wait for here.
                void chrome.windows.create({ url: urls, focused: true });
            } else if (action === "openAndRemove") {
                // Archived first: the new window may close the popup before anything after it runs.
                await archiveMany(tabs.map((t) => t.id), strings.groupOpened, group.id);
                void chrome.windows.create({ url: urls, focused: true });
            } else if (action === "ungroup") {
                const snapshot = await ungroup(group.id);
                await reload();
                if (snapshot) offerGroupUndo(strings.groupBrokenApart, snapshot);
            } else {
                await archiveMany(tabs.map((t) => t.id), strings.groupArchived, group.id);
            }
        } catch (err) {
            showErrorToast(writeErrorMessage(err));
            await reload();
        }
    };

    const onReorder = async (draggedId: string, move: Move) => {
        const dragged = library.tabs.find((t) => t.id === draggedId);
        const groupOf = (id: string | null | undefined) => library.groups.find((g) => g.id === id);
        const fromGroup = groupOf(dragged?.groupId);
        const toGroup = groupOf(move.group);
        try {
            if (fromGroup?.id === toGroup?.id) {
                // Within your own order (or within one window): a plain move, as always.
                if (move.side) await placeTab(draggedId, move.to, move.side, move.group);
                else if (move.to !== draggedId) await reorderTabs(draggedId, move.to);
            } else {
                // Into or out of a saved window: said so, with Undo.
                const previous = move.side ? await placeTab(draggedId, move.to, move.side, move.group) : await moveTab(draggedId, move.to, move.group);
                if (previous) {
                    showUndoToast(toGroup ? strings.movedInto(toGroup.name) : strings.movedOutOf(fromGroup!.name), async () => {
                        try {
                            await undoMoveTab(previous);
                        } catch (err) {
                            showErrorToast(writeErrorMessage(err));
                        }
                        await reload();
                        flash(draggedId);
                    });
                }
            }
        } catch (err) {
            showErrorToast(writeErrorMessage(err));
        }
        await reload();
    };

    const onSort = async (next: SortOrder) => {
        setPendingSort(next);
        try {
            await setSort(next);
        } catch (err) {
            showErrorToast(writeErrorMessage(err));
        }
        await reload();
        setPendingSort(null);
    };

    // Dismissed for good: the version is recorded, so the note doesn't come back next time.
    const dismissWhatsNew = () => {
        setWhatsNew(null);
        // The dismiss button just disappeared; keep keyboard focus somewhere useful.
        document.getElementById("search-input")?.focus();
        setLastSeenVersion(chrome.runtime.getManifest().version).catch((err) => showErrorToast(writeErrorMessage(err)));
    };

    const openTab = (tab: SavedTab) => void chrome.tabs.create({ url: tab.url });

    // Only tabs still saved count as picked (one may have been deleted meanwhile).
    const pickedIds = library.tabs.filter((t) => picked.has(t.id)).map((t) => t.id);

    const togglePick = (tab: SavedTab, range: boolean) => {
        const order = visible.tabs.map((t) => t.id);
        const from = rangeStart.current ? order.indexOf(rangeStart.current) : -1;
        const to = order.indexOf(tab.id);
        const next = new Set(picked);
        if (range && from !== -1 && to !== -1) {
            // Shift-click: everything between the last pick and this one takes this one's new state.
            const on = !picked.has(tab.id);
            for (const id of order.slice(Math.min(from, to), Math.max(from, to) + 1)) {
                if (on) next.add(id);
                else next.delete(id);
            }
        } else if (next.has(tab.id)) next.delete(tab.id);
        else next.add(tab.id);
        rangeStart.current = tab.id;
        setPicked(next);
    };

    const togglePickWindow = (tabs: SavedTab[]) => {
        const next = new Set(picked);
        const all = tabs.every((t) => next.has(t.id));
        for (const t of tabs) {
            if (all) next.delete(t.id);
            else next.add(t.id);
        }
        setPicked(next);
    };

    const moveSelected = async (category: string) => {
        const ids = pickedIds;
        stopSelecting();
        try {
            const previous = await setCategoryOf(ids, category === UNCATEGORIZED ? undefined : category);
            await reload();
            showUndoToast(strings.movedTabs(previous.length, category), async () => {
                try {
                    await restoreCategories(previous);
                } catch (err) {
                    showErrorToast(writeErrorMessage(err));
                }
                await reload();
            });
        } catch (err) {
            showErrorToast(writeErrorMessage(err));
            await reload();
        }
    };

    const archiveSelected = async () => {
        const ids = pickedIds;
        stopSelecting();
        try {
            await archiveMany(ids, strings.archivedTabs);
        } catch (err) {
            showErrorToast(writeErrorMessage(err));
            await reload();
        }
    };

    // In the archive: back to the list, where each was; Undo archives them again.
    const restoreSelected = async () => {
        const ids = pickedIds;
        stopSelecting();
        try {
            const restored = await unarchiveTabs(ids);
            await reload();
            if (restored.length === 0) return;
            showUndoToast(strings.restoredTabs(restored.length), async () => {
                try {
                    await archiveTabs(restored);
                } catch (err) {
                    showErrorToast(writeErrorMessage(err));
                }
                await reload();
            });
        } catch (err) {
            showErrorToast(writeErrorMessage(err));
            await reload();
        }
    };

    // On the Waiting filter: every waiting tab to the archive at once (they stay restorable).
    const archiveWaiting = async () => {
        try {
            await archiveMany(visible.tabs.map((t) => t.id), strings.archivedTabs);
        } catch (err) {
            showErrorToast(writeErrorMessage(err));
            await reload();
        }
    };

    // In the archive only: deleted for good, with Undo.
    const deleteSelected = async () => {
        const ids = pickedIds;
        stopSelecting();
        try {
            const removed = await deleteTabs(ids);
            await reload();
            showUndoToast(strings.deletedTabs(removed.length), async () => {
                try {
                    await restoreTabs(removed);
                } catch (err) {
                    showErrorToast(writeErrorMessage(err));
                }
                await reload();
            });
        } catch (err) {
            showErrorToast(writeErrorMessage(err));
            await reload();
        }
    };

    return (
        <>
        {/* Hidden, not removed, while Settings is open: coming back keeps your search, filter
            and scroll position, and focus can return to the settings button that opened it. */}
        <div
            ref={mainScreen}
            class={styles.app}
            style={{ minHeight: floorHeight ? `${floorHeight}px` : undefined }}
            hidden={view === "settings"}
        >
            <header class={heroStyles.hero}>
                <h1 class="visually-hidden">{strings.appName}</h1>
                <Header
                    showSearch={hasTabs}
                    query={query}
                    tabCount={inArchive ? archivedCount : active.length}
                    inArchive={inArchive}
                    onQuery={setQuery}
                    onSubmitSearch={() => visible.tabs[0] && openTab(visible.tabs[0])}
                    onArrowDown={focusFirstRow}
                    manualOpen={manualOpen}
                    onToggleManual={() => setManualOpen((open) => !open)}
                    onOpenSettings={() => openSettings()}
                    settingsButtonRef={settingsButton}
                    hops={hops}
                />
                {manualOpen ? (
                    <ManualForm
                        categoryOptions={saveOptions}
                        colorOf={colorOf}
                        onAdded={afterSave}
                        onDuplicate={flash}
                        onRestore={(id) => void restoreSaved(id)}
                        onClose={() => setManualOpen(false)}
                    />
                ) : (
                    <SaveCard
                        tabs={library.tabs}
                        categoryOptions={saveOptions}
                        colorOf={colorOf}
                        onSaved={afterSave}
                        onShow={reveal}
                        onRestore={(id) => void restoreSaved(id)}
                        onUpdated={afterUpdate}
                        onWindowSaved={afterWindowSave}
                    />
                )}
            </header>
            {hasTabs && selecting && (
                <SelectionBar
                    count={pickedIds.length}
                    inArchive={inArchive}
                    moveOptions={saveOptions}
                    onSelectAll={() => setPicked(new Set(visible.tabs.map((t) => t.id)))}
                    onMove={moveSelected}
                    onArchive={archiveSelected}
                    onRestore={restoreSelected}
                    onDelete={deleteSelected}
                    onStop={stopSelecting}
                />
            )}
            {hasTabs && !selecting && (
                <nav class={styles.filterBar} aria-label={strings.filterBarLabel}>
                    <FilterPills options={options} active={activeFilter} colorOf={colorOf} onSelect={setFilter} />
                    <SortMenu value={sort} onChange={onSort} />
                    <SelectButton active={false} onToggle={() => setSelecting(true)} />
                </nav>
            )}
            <main id="main-view" class={listStyles.wrap}>
                {whatsNew && <WhatsNew release={whatsNew} onDismiss={dismissWhatsNew} />}
                {library.storagePct >= STORAGE_WARNING_PCT && (
                    <StorageWarning pct={library.storagePct} onSeeStorage={() => openSettings()} />
                )}
                <p class="visually-hidden" role="status" aria-live="polite">
                    {searching ? strings.matches(visible.tabs.length) : pinNote}
                </p>
                {activeFilter === OUTDATED && !searching && !selecting && visible.tabs.length > 0 && (
                    <div class={styles.archiveAll}>
                        <button type="button" class={styles.archiveAllButton} onClick={() => void archiveWaiting()}>
                            <Icon name="archive" size={14} />
                            {strings.archiveAllWaiting(visible.tabs.length)}
                        </button>
                        <span class={styles.archiveAllHint}>{strings.archiveAllWaitingHint}</span>
                    </div>
                )}
                <TabList
                    tabs={visible.tabs}
                    groups={library.groups}
                    // A closed window could hide a match: filtered or searched, every tab is its own row.
                    grouped={activeFilter === ALL && !searching}
                    settings={library.settings}
                    matches={visible.matches}
                    windowOf={windowOf}
                    searchActive={searching}
                    // Your own order is the only one dragging can change: search results are in
                    // match order and the other sorts are views, so a drag there would mean nothing.
                    canReorder={!searching && sort === "custom" && !selecting && !inArchive}
                    // Under a category filter every row shares that category, so rows leave it out.
                    showCategory={activeFilter === ALL || activeFilter === OUTDATED || inArchive}
                    entered={entered}
                    highlight={highlight}
                    empty={
                        !hasTabs ? (
                            <EmptyLibrary onEditCategories={() => openSettings("categories")} />
                        ) : active.length === 0 && activeFilter === ALL && !searching ? (
                            <AllArchived onShowArchive={() => setFilter(ARCHIVED)} />
                        ) : (
                            <NoMatches
                                query={query.trim()}
                                filterLabel={activeFilter === ALL ? null : activeFilter === OUTDATED ? strings.outdated : inArchive ? strings.archived : activeFilter}
                                onSearchAll={() => setFilter(ALL)}
                                onSearchArchive={archiveHasMatch ? () => setFilter(ARCHIVED) : undefined}
                            />
                        )
                    }
                    editOptions={editOptions}
                    colorOf={colorOf}
                    onOpen={openTab}
                    onEdit={onEdit}
                    onDelete={inArchive ? onDelete : onArchive}
                    onTogglePin={(tab) => void onTogglePin(tab)}
                    inArchive={inArchive}
                    onRestore={onRestore}
                    onReorder={onReorder}
                    onToggleGroup={onToggleGroup}
                    onGroupAction={onGroupAction}
                    onRenameGroup={onRenameGroup}
                    selecting={selecting}
                    selected={picked}
                    onToggleSelect={togglePick}
                    onToggleSelectGroup={togglePickWindow}
                    onEscape={selecting ? stopSelecting : focusSearch}
                />
            </main>

        </div>
        {view === "settings" && (
            <SettingsScreen
                library={library}
                reload={reload}
                onBack={closeSettings}
                initialTab={settingsTab}
                minHeight={floorHeight}
                onHeight={raiseFloor}
            />
        )}
        <Toast />
        </>
    );
}
