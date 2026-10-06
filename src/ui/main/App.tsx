import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { SavedTab, SortOrder } from "../../types";
import { editTab, deleteTab, putBackTab, restoreTab, reorderTabs, type AddTabResult } from "../../domain/TabRepository";
import { getCategoryColorHex, UNCATEGORIZED } from "../../domain/CategoryRepository";
import { searchTabs } from "../../domain/search";
import { setSort } from "../../domain/SettingsRepository";
import { setLastSeenVersion } from "../../storage/chromeStorage";
import { writeErrorMessage } from "../errors";
import { applyTheme } from "../theme";
import { hasPendingUndo, showErrorToast, showUndoToast, undoFromToast } from "../toastStore";
import { Toast } from "../Toast";
import { strings } from "../strings";
import { Header } from "./Header";
import { SaveCard } from "./SaveCard";
import { ManualForm } from "./ManualForm";
import { FilterPills, StorageWarning } from "./FilterPills";
import { SortMenu } from "./SortMenu";
import { EmptyLibrary, NoMatches, WhatsNew } from "./EmptyStates";
import { TabList, type Highlight } from "./TabList";
import { leaveDurationMs, type EditOutcome } from "./TabRow";
import { ALL, OUTDATED, applyFilter, effectiveFilter, filterOptions, sortTabs } from "./listModel";
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

    const flash = useCallback((id: string) => setHighlight({ id, seq: ++highlightSeq.current }), []);

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
            } else if (e.key.toLowerCase() === "z" && (e.ctrlKey || e.metaKey) && !e.shiftKey && hasPendingUndo()) {
                e.preventDefault();
                undoFromToast();
            }
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [view]);

    const focusSearch = () => document.getElementById("search-input")?.focus();
    const focusFirstRow = () => document.querySelector<HTMLElement>("#main-view li[data-tab-id] [data-row-title]")?.focus();

    const colorOf = useCallback(
        (category: string) => getCategoryColorHex(category, library?.settings.categoryColors ?? {}),
        [library]
    );

    const options = useMemo(() => (library ? filterOptions(library.tabs, library.settings) : []), [library]);
    const activeFilter = effectiveFilter(filter, options);
    const sort = pendingSort ?? library?.settings.sort ?? "custom";

    const visible = useMemo(() => {
        if (!library) return { tabs: [] as SavedTab[], ranges: null };
        const filtered = sortTabs(applyFilter(library.tabs, library.settings, activeFilter), sort);
        const q = query.trim();
        if (!q) return { tabs: filtered, ranges: null };
        const matches = searchTabs(filtered, q);
        return { tabs: matches.map((m) => m.tab), ranges: new Map(matches.map((m) => [m.tab.id, m.titleRanges])) };
    }, [library, activeFilter, sort, query]);

    // The toast sits outside the main screen so it still shows while Settings is open.
    if (!library) return <Toast />;

    const configured = library.settings.categories;
    const saveOptions = [UNCATEGORIZED, ...configured].map((c) => ({ value: c, label: c }));
    const editOptions = [...configured, UNCATEGORIZED].map((c) => ({ value: c, label: c }));
    const hasTabs = library.tabs.length > 0;
    const searching = query.trim().length > 0;

    const afterSave = async (result: AddTabResult) => {
        if (!result.duplicate) setHops((n) => n + 1);
        setManualOpen(false);
        await reload();
        setFilter(ALL);
        setQuery("");
        flash(result.tab.id);
    };

    // A whole window saved: the new tabs are at the top of the list, so show all of it.
    const afterWindowSave = async (added: SavedTab[]) => {
        setHops((n) => n + 1);
        await reload();
        setFilter(ALL);
        setQuery("");
        if (added[0]) flash(added[0].id);
    };

    // Brings a saved tab into view and flashes it, widening the list only if it's filtered out.
    const reveal = (id: string) => {
        if (!visible.tabs.some((t) => t.id === id)) {
            setFilter(ALL);
            setQuery("");
        }
        flash(id);
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
            flash(deleted.id);
        });
        return true;
    };

    const onReorder = async (draggedId: string, targetId: string) => {
        try {
            await reorderTabs(draggedId, targetId);
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
                    tabCount={library.tabs.length}
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
                        onClose={() => setManualOpen(false)}
                    />
                ) : (
                    <SaveCard
                        tabs={library.tabs}
                        categoryOptions={saveOptions}
                        colorOf={colorOf}
                        onSaved={afterSave}
                        onShow={reveal}
                        onUpdated={afterUpdate}
                        onWindowSaved={afterWindowSave}
                    />
                )}
            </header>
            {hasTabs && (
                <nav class={styles.filterBar} aria-label={strings.filterBarLabel}>
                    <FilterPills options={options} active={activeFilter} colorOf={colorOf} onSelect={setFilter} />
                    <SortMenu value={sort} onChange={onSort} />
                </nav>
            )}
            <main id="main-view" class={listStyles.wrap}>
                {whatsNew && <WhatsNew release={whatsNew} onDismiss={dismissWhatsNew} />}
                {library.storagePct >= STORAGE_WARNING_PCT && (
                    <StorageWarning pct={library.storagePct} onSeeStorage={() => openSettings()} />
                )}
                <p class="visually-hidden" role="status" aria-live="polite">
                    {searching ? strings.matches(visible.tabs.length) : ""}
                </p>
                <TabList
                    tabs={visible.tabs}
                    settings={library.settings}
                    titleRanges={visible.ranges}
                    searchActive={searching}
                    // Your own order is the only one dragging can change: search results are in
                    // match order and the other sorts are views, so a drag there would mean nothing.
                    canReorder={!searching && sort === "custom"}
                    // Under a category filter every row shares that category, so rows leave it out.
                    showCategory={activeFilter === ALL || activeFilter === OUTDATED}
                    entered={entered}
                    highlight={highlight}
                    empty={
                        !hasTabs ? (
                            <EmptyLibrary onEditCategories={() => openSettings("categories")} />
                        ) : (
                            <NoMatches
                                query={query.trim()}
                                filterLabel={activeFilter === ALL ? null : activeFilter === OUTDATED ? strings.outdated : activeFilter}
                                onSearchAll={() => setFilter(ALL)}
                            />
                        )
                    }
                    editOptions={editOptions}
                    colorOf={colorOf}
                    onOpen={openTab}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onReorder={onReorder}
                    onEscape={focusSearch}
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
