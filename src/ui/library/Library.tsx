import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "preact/hooks";
import type { SavedTab } from "../../types";
import { UNCATEGORIZED, getCategoryColorHex, getTabCategory } from "../../domain/CategoryRepository";
import {
    archiveTabs,
    deleteTabs,
    editTab,
    recordOpen,
    restoreCategories,
    restoreTabs,
    setCategoryOf,
    setPinned,
    unarchiveTabs,
    type AddTabResult,
} from "../../domain/TabRepository";
import { searchTabs, type SearchMatch } from "../../domain/search";
import { setCleanupTipHiddenUntil } from "../../storage/chromeStorage";
import { daysSince } from "../../util/time";
import { writeErrorMessage } from "../errors";
import { Icon } from "../Icon";
import { Logo } from "../Logo";
import { ManualForm } from "../main/ManualForm";
import { SelectionBar } from "../main/SelectionBar";
import { EditForm, ReminderMark, highlighted, type EditOutcome, type TabEdits } from "../main/TabRow";
import { ALL, ARCHIVED, CLEANUP_TIP_MIN, OUTDATED, isArchived, isTabAged, siteName, staleKeptTabs, windowNames } from "../main/listModel";
import { useLibrary } from "../main/useLibrary";
import { SettingsScreen } from "../settings/SettingsScreen";
import { SiteIcon } from "../SiteIcon";
import { strings } from "../strings";
import { applyTheme } from "../theme";
import { Toast } from "../Toast";
import { showErrorToast, showUndoToast } from "../toastStore";
import { DEFAULT_LIBRARY_SORT, WINDOW_PREFIX, filterLibrary, nextSort, rowsInView, sidebarCounts, sortLibrary, windowFilter, type LibraryColumn, type LibrarySort } from "./libraryModel";
import controls from "../controls.module.css";
import styles from "./Library.module.css";

/** Every row the same height, so the table only draws what's in view however long the list is. */
const ROW_HEIGHT = 48;
const FLASH_MS = 900;
const COLUMNS: Array<{ key: LibraryColumn; label: string; hint?: string }> = [
    { key: "title", label: strings.columnTitle },
    { key: "category", label: strings.columnCategory },
    { key: "site", label: strings.columnSite },
    { key: "saved", label: strings.columnSaved },
    { key: "opened", label: strings.columnOpened, hint: strings.columnOpenedHint },
];

const whenText = (at: number | undefined) => (at === undefined ? strings.notOpenedYet : strings.daysAgo(daysSince(at)));

/** What the page shows. Each has an address of its own, so the browser's Back and a reload both do what you'd expect. */
type Page = { kind: "list" } | { kind: "settings" } | { kind: "add" } | { kind: "edit"; id: string };

function pageAt(address: string): Page {
    if (address === "#settings") return { kind: "settings" };
    if (address === "#add") return { kind: "add" };
    if (address.startsWith("#edit/")) return { kind: "edit", id: decodeURIComponent(address.slice(6)) };
    return { kind: "list" };
}

/** Your whole library on a page of its own: everything in a sidebar, a wide sortable table, bulk editing and cleanup; Settings is a section of it; adding and editing open in a panel beside the list. */
export function Library() {
    const { library, reload } = useLibrary();
    // (The address bar sends a search it found nothing for here, as ?q=; a notification about several reminders, ?show=waiting.)
    const address = new URLSearchParams(location.search);
    const [filter, setFilter] = useState(address.get("show") === "waiting" ? OUTDATED : ALL);
    const [query, setQuery] = useState(address.get("q") ?? "");
    const [sort, setSort] = useState<LibrarySort>(DEFAULT_LIBRARY_SORT);
    const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
    const [page, setPage] = useState(pageAt(location.hash));
    const inSettings = page.kind === "settings";
    const cameFromList = useRef(false);
    const scrolledTo = useRef<number | null>(null);
    const opener = useRef<HTMLElement | null>(null);
    const lastPicked = useRef<string | null>(null);
    const [flashed, setFlashed] = useState<string | null>(null);
    const flashing = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const search = useRef<HTMLInputElement>(null);
    const table = useRef<HTMLDivElement>(null);
    const [view, setView] = useState({ top: 0, height: 800 });

    useEffect(() => {
        if (library) document.body.dataset.ready = "true";
        if (library) applyTheme(library.settings.theme);
    }, [library]);

    useLayoutEffect(() => {
        const box = table.current;
        if (!box) return;
        const measure = () => setView({ top: box.scrollTop, height: box.clientHeight });
        const resizes = new ResizeObserver(measure);
        resizes.observe(box);
        return () => resizes.disconnect();
    }, [library !== null]);

    useEffect(() => {
        const onAddress = () => setPage(pageAt(location.hash));
        window.addEventListener("hashchange", onAddress);
        return () => window.removeEventListener("hashchange", onAddress);
    }, []);
    // The list is hidden, not removed, while Settings shows, so your filter and search wait for
    // you; a hidden box forgets where it was scrolled, so that's kept here.
    useLayoutEffect(() => {
        if (page.kind !== "list" || !cameFromList.current) return;
        cameFromList.current = false;
        if (scrolledTo.current !== null) table.current?.scrollTo({ top: scrolledTo.current });
        opener.current?.focus();
    }, [page.kind]);

    // A new filter, search or sort starts at the top, with nothing picked.
    useEffect(() => {
        table.current?.scrollTo({ top: 0 });
        setPicked(new Set());
        lastPicked.current = null;
    }, [filter, query, sort]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            if (e.key !== "/" || target.closest("input, textarea, select")) return;
            e.preventDefault();
            search.current?.focus();
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, []);

    // A panel closes with Escape, wherever the focus is, and with a click anywhere outside it.
    // (What opens or swaps a panel is marked, or it would close the panel and then reopen it.)
    const panelOpen = page.kind === "add" || page.kind === "edit";
    const closePanel = useRef<(refocus: boolean) => void>(() => undefined);
    useEffect(() => {
        if (!panelOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") closePanel.current(true);
        };
        const onPointer = (e: PointerEvent) => {
            if (!(e.target as HTMLElement).closest("aside, [data-panel-opener]")) closePanel.current(false);
        };
        document.addEventListener("keydown", onKey);
        document.addEventListener("pointerdown", onPointer);
        return () => {
            document.removeEventListener("keydown", onKey);
            document.removeEventListener("pointerdown", onPointer);
        };
    }, [panelOpen]);

    const windowOf = useMemo(() => (library ? windowNames(library.tabs, library.groups) : new Map<string, string>()), [library]);
    const counts = useMemo(() => (library ? sidebarCounts(library.tabs, library.settings) : new Map<string, number>()), [library]);
    const shown = useMemo(() => {
        if (!library) return { rows: [] as SavedTab[], matches: new Map<string, SearchMatch>() };
        const filtered = filterLibrary(library.tabs, library.settings, filter);
        const q = query.trim();
        const found = q ? searchTabs(filtered, q, (t) => ({ category: getTabCategory(t), window: windowOf.get(t.id) ?? "" })) : null;
        return {
            rows: sortLibrary(found ? found.map((m) => m.tab) : filtered, sort),
            matches: new Map((found ?? []).map((m) => [m.tab.id, m])),
        };
    }, [library, filter, query, sort, windowOf]);

    if (!library) return <Toast compact />;

    const { rows, matches } = shown;
    const { settings } = library;
    const configured = settings.categories;
    const editOptions = [...configured, UNCATEGORIZED].map((c) => ({ value: c, label: c }));
    const saveOptions = [UNCATEGORIZED, ...configured].map((c) => ({ value: c, label: c }));
    const colorOf = (category: string) => getCategoryColorHex(category, settings.categoryColors);
    const inArchive = filter === ARCHIVED;
    const live = counts.get(ALL) ?? 0;
    const pickedIds = rows.filter((t) => picked.has(t.id)).map((t) => t.id);
    const allPicked = rows.length > 0 && pickedIds.length === rows.length;
    const stale = filter === ALL && !query.trim() && pickedIds.length === 0 && Date.now() >= library.cleanupTipHiddenUntil
        ? staleKeptTabs(library.tabs, settings, Date.now(), library.openTrackingSince)
        : [];
    const { start, end } = rowsInView(rows.length, ROW_HEIGHT, view.top, view.height);

    const saving = async (write: () => Promise<void>) => {
        try {
            await write();
        } catch (err) {
            showErrorToast(writeErrorMessage(err));
        }
        await reload();
    };
    /** A write, then the toast that takes it back. */
    const undoable = (write: () => Promise<{ message: string; undo: () => Promise<unknown> } | null>) =>
        saving(async () => {
            const result = await write();
            if (result) showUndoToast(result.message, () => saving(async () => void (await result.undo())));
        });

    const archive = (ids: string[]) =>
        undoable(async () => {
            const archived = await archiveTabs(ids);
            return archived.length ? { message: strings.archivedTabs(archived.length), undo: () => unarchiveTabs(archived) } : null;
        });
    const restore = (ids: string[]) =>
        undoable(async () => {
            const restored = await unarchiveTabs(ids);
            return restored.length ? { message: strings.restoredTabs(restored.length), undo: () => archiveTabs(restored) } : null;
        });
    const remove = (ids: string[]) =>
        undoable(async () => {
            const removed = await deleteTabs(ids);
            return { message: strings.deletedTabs(removed.length), undo: () => restoreTabs(removed) };
        });
    const move = (ids: string[], category: string) =>
        undoable(async () => {
            const previous = await setCategoryOf(ids, category === UNCATEGORIZED ? undefined : category);
            return { message: strings.movedTabs(previous.length, category), undo: () => restoreCategories(previous) };
        });
    // The answer has to show where you're looking: the button stays lit, and the row flashes.
    const togglePin = async (tab: SavedTab) => {
        await saving(() => setPinned(tab.id, !tab.pinned).then(() => undefined));
        clearTimeout(flashing.current);
        setFlashed(tab.id);
        flashing.current = setTimeout(() => setFlashed(null), FLASH_MS);
    };
    const openTab = async (tab: SavedTab) => {
        await recordOpen([tab.id]).catch(() => undefined);
        void chrome.tabs.create({ url: tab.url });
        await reload();
    };
    const saveEdit = async (tab: SavedTab, updates: TabEdits): Promise<EditOutcome> => {
        try {
            const { duplicateOf } = await editTab(tab.id, updates);
            if (duplicateOf) return { status: "duplicate", existingTitle: duplicateOf.title };
            return { status: "saved" };
        } catch (err) {
            showErrorToast(writeErrorMessage(err));
            return { status: "failed" };
        } finally {
            await reload();
        }
    };
    const togglePick = (tab: SavedTab, range: boolean) => {
        const order = rows.map((t) => t.id);
        const from = lastPicked.current ? order.indexOf(lastPicked.current) : -1;
        const to = order.indexOf(tab.id);
        const next = new Set(picked);
        const on = !picked.has(tab.id);
        for (const id of range && from !== -1 ? order.slice(Math.min(from, to), Math.max(from, to) + 1) : [tab.id]) {
            if (on) next.add(id);
            else next.delete(id);
        }
        lastPicked.current = tab.id;
        setPicked(next);
    };
    const stopPicking = () => setPicked(new Set());
    const onPicked = (action: (ids: string[]) => Promise<void>) => () => {
        const ids = pickedIds;
        stopPicking();
        void action(ids);
    };

    const navButton = (key: string, label: string, dot?: string) => (
        <button
            key={key}
            type="button"
            class={filter === key && !inSettings ? `${styles.nav} ${styles.navOn}` : styles.nav}
            aria-pressed={filter === key && !inSettings}
            onClick={() => {
                setFilter(key);
                if (inSettings) backToList();
            }}
        >
            {dot && <span class={styles.dot} style={{ background: dot }} aria-hidden="true" />}
            <span class={styles.navLabel}>{label}</span>
            <span class={styles.count}>{counts.get(key) ?? 0}</span>
        </button>
    );
    const goTo = (address: string) => {
        // From one panel to the next, Back should still lead to the list.
        if (page.kind !== "list") return location.replace(address);
        // Only Settings hides the list; beside a panel it can be scrolled, and stays where it's left.
        scrolledTo.current = address === "#settings" ? (table.current?.scrollTop ?? 0) : null;
        cameFromList.current = true;
        opener.current = document.activeElement as HTMLElement | null;
        location.hash = address;
    };
    const backToList = () => {
        if (cameFromList.current) history.back();
        else {
            // Opened straight at this address: there's no list to go back to in the history.
            history.replaceState(null, "", location.pathname);
            setPage({ kind: "list" });
        }
    };
    closePanel.current = (refocus) => {
        // A click outside has put the pointer, and the focus, where it's wanted.
        if (!refocus) opener.current = null;
        backToList();
    };
    const windows = library.groups.filter((g) => counts.has(windowFilter(g.id)));
    const heading = filter === ALL
        ? strings.libraryAll
        : filter === OUTDATED
          ? strings.outdated
          : filter === ARCHIVED
            ? strings.archived
            : filter.startsWith(WINDOW_PREFIX)
              ? (library.groups.find((g) => windowFilter(g.id) === filter)?.name ?? "")
              : filter;
    const editing = page.kind === "edit" ? library.tabs.find((t) => t.id === page.id) : undefined;

    return (
        <div class={styles.page}>
            <header class={styles.top}>
                <div class={styles.brand}>
                    <span class={styles.mark} aria-hidden="true">
                        <Logo />
                    </span>
                    <h1 class={styles.name}>{strings.appName}</h1>
                </div>
                <div class={styles.search} role="search">
                    <Icon name="search" size={15} />
                    <label for="library-search" class="visually-hidden">
                        {strings.searchLabel}
                    </label>
                    <input
                        ref={search}
                        id="library-search"
                        type="text"
                        autoComplete="off"
                        placeholder={strings.searchPlaceholder(live)}
                        value={query}
                        onInput={(e) => {
                            setQuery(e.currentTarget.value);
                            if (inSettings) backToList();
                        }}
                        onKeyDown={(e) => {
                            if (e.key === "Escape") setQuery("");
                        }}
                    />
                    {query && (
                        <button type="button" class={styles.clear} aria-label={strings.clearSearch} onClick={() => setQuery("")}>
                            <Icon name="close" size={14} />
                        </button>
                    )}
                </div>
                <div class={styles.topButtons}>
                    <button
                        type="button"
                        class={styles.topBtn}
                        aria-label={strings.addLinkManually}
                        title={strings.addLinkManually}
                        data-panel-opener
                        onClick={() => (page.kind === "add" ? backToList() : goTo("#add"))}
                    >
                        <Icon name="plus" size={18} />
                    </button>
                    <button type="button" class={styles.topBtn} aria-label={strings.openSettings} title={strings.settingsTooltip} aria-pressed={inSettings} data-panel-opener onClick={() => (inSettings ? backToList() : goTo("#settings"))}>
                        <Icon name="settings" size={17} />
                    </button>
                </div>
            </header>

            <div class={styles.body}>
                <nav class={styles.side} aria-label={strings.libraryFilters}>
                    {navButton(ALL, strings.libraryAll)}
                    {navButton(OUTDATED, strings.outdated)}
                    {navButton(ARCHIVED, strings.archived)}
                    <h2 class={styles.sideTitle}>{strings.tabCategories}</h2>
                    {[...configured, UNCATEGORIZED].map((c) => navButton(c, c, colorOf(c)))}
                    {windows.length > 0 && <h2 class={styles.sideTitle}>{strings.libraryWindows}</h2>}
                    {windows.map((g) => navButton(windowFilter(g.id), g.name))}
                </nav>

                <main class={styles.main} aria-label={inSettings ? strings.settingsTitle : undefined}>
                    {inSettings && (
                        <>
                            <div class={styles.bar}>
                                <button type="button" class={`${controls.btn} ${styles.back}`} onClick={backToList}>
                                    <Icon name="chevronLeft" size={16} />
                                    {strings.back}
                                </button>
                                <div class={styles.headingRow}>
                                    <h2 class={styles.heading}>{strings.settingsTitle}</h2>
                                </div>
                            </div>
                            <div class={styles.settingsArea}>
                                <SettingsScreen library={library} reload={reload} minHeight={0} onHeight={() => undefined} />
                            </div>
                        </>
                    )}
                    <div class={styles.listArea} hidden={inSettings}>
                    {pickedIds.length > 0 ? (
                        <div class={styles.bar}>
                            <SelectionBar
                                count={pickedIds.length}
                                inArchive={inArchive}
                                moveOptions={editOptions}
                                onSelectAll={() => setPicked(new Set(rows.map((t) => t.id)))}
                                onMove={(category) => onPicked((ids) => move(ids, category))()}
                                onArchive={onPicked(archive)}
                                onRestore={onPicked(restore)}
                                onDelete={onPicked(remove)}
                                onStop={stopPicking}
                            />
                        </div>
                    ) : (
                        <div class={styles.bar}>
                            <div class={styles.headingRow}>
                                <h2 class={styles.heading}>{heading}</h2>
                                <span class={styles.total} role="status">
                                    {strings.tabCount(rows.length)}
                                </span>
                            </div>
                        </div>
                    )}

                    {stale.length >= CLEANUP_TIP_MIN && (
                        <div class={styles.tip} role="note" aria-label={strings.cleanupTip(stale.length)}>
                            <span class={styles.tipText}>{strings.cleanupTip(stale.length)}</span>
                            <button type="button" class={controls.btn} onClick={() => void archive(stale.map((t) => t.id))}>
                                {strings.cleanupArchive}
                            </button>
                            <button
                                type="button"
                                class={styles.later}
                                onClick={() => void saving(() => setCleanupTipHiddenUntil(Date.now() + 30 * 24 * 60 * 60 * 1000))}
                            >
                                {strings.cleanupNotNow}
                            </button>
                        </div>
                    )}

                    <div ref={table} class={styles.scroll} onScroll={(e) => setView({ top: e.currentTarget.scrollTop, height: e.currentTarget.clientHeight })}>
                        <table class={styles.table} aria-label={strings.savedTabsLabel} aria-rowcount={rows.length + 1}>
                            <colgroup>
                                <col class={styles.colCheck} />
                                <col />
                                <col class={styles.colCategory} />
                                <col class={styles.colSite} />
                                <col class={styles.colDate} />
                                <col class={styles.colDate} />
                                <col class={styles.colActions} />
                            </colgroup>
                            <thead>
                                <tr aria-rowindex={1}>
                                    <th scope="col" class={styles.checkCell}>
                                        <input
                                            type="checkbox"
                                            class={styles.check}
                                            aria-label={strings.selectAllShown}
                                            checked={allPicked}
                                            onChange={() => setPicked(allPicked ? new Set() : new Set(rows.map((t) => t.id)))}
                                        />
                                    </th>
                                    {COLUMNS.map((c) => {
                                        const on = sort.column === c.key;
                                        return (
                                            <th key={c.key} scope="col" aria-sort={on ? (sort.ascending ? "ascending" : "descending") : "none"}>
                                                <button type="button" class={on ? `${styles.sortBtn} ${styles.sortOn}` : styles.sortBtn} title={c.hint} onClick={() => setSort(nextSort(sort, c.key))}>
                                                    {c.label}
                                                    {on && <span aria-hidden="true">{sort.ascending ? "↑" : "↓"}</span>}
                                                </button>
                                            </th>
                                        );
                                    })}
                                    <th scope="col">
                                        <span class="visually-hidden">{strings.columnActions}</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {start > 0 && <tr aria-hidden="true" style={{ height: `${start * ROW_HEIGHT}px` }} />}
                                {rows.slice(start, end).map((tab, i) => {
                                    const category = getTabCategory(tab);
                                    const match = matches.get(tab.id);
                                    const windowName = windowOf.get(tab.id);
                                    const isPicked = picked.has(tab.id);
                                    return (
                                        <tr key={tab.id} class={[styles.row, isPicked || editing?.id === tab.id ? styles.picked : "", flashed === tab.id ? styles.flash : ""].join(" ")} aria-rowindex={start + i + 2} data-tab-id={tab.id}>
                                            <td class={styles.checkCell}>
                                                <input
                                                    type="checkbox"
                                                    class={styles.check}
                                                    aria-label={strings.selectTab(tab.title)}
                                                    checked={isPicked}
                                                    onClick={(e) => togglePick(tab, e.shiftKey)}
                                                />
                                            </td>
                                            <td>
                                                <div class={styles.titleCell}>
                                                    <SiteIcon url={tab.url} />
                                                    <div class={styles.titleText}>
                                                        <button type="button" class={styles.title} title={tab.title} onClick={() => void openTab(tab)}>
                                                            {highlighted(tab.title, match?.titleRanges ?? [])}
                                                        </button>
                                                        {(windowName || tab.note || (tab.remindAt !== undefined && !isArchived(tab))) && (
                                                            <span class={styles.under} title={tab.note}>
                                                                {tab.remindAt !== undefined && !isArchived(tab) && (
                                                                    <>
                                                                        <ReminderMark at={tab.remindAt} class={styles.reminder} dueClass={styles.reminderDue} />
                                                                        {(windowName || tab.note) && " · "}
                                                                    </>
                                                                )}
                                                                {windowName && <span class={styles.window}>{windowName}</span>}
                                                                {windowName && tab.note && " · "}
                                                                {tab.note && <span class={styles.note}>{tab.note}</span>}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <span class={styles.category}>
                                                    <span class={styles.dot} style={{ background: colorOf(category) }} aria-hidden="true" />
                                                    <span class={styles.cut} title={category}>{category}</span>
                                                </span>
                                            </td>
                                            <td class={styles.quiet}>
                                                <span class={styles.cut}>{siteName(tab.url)}</span>
                                            </td>
                                            <td class={styles.quiet}>
                                                {isTabAged(tab, settings) ? <span class={styles.waiting}>{whenText(tab.savedAt)}</span> : whenText(tab.savedAt)}
                                            </td>
                                            <td class={styles.quiet} title={tab.openCount ? strings.openedTimes(tab.openCount) : undefined}>
                                                {whenText(tab.lastOpenedAt)}
                                            </td>
                                            <td>
                                                <div class={styles.actions}>
                                                    {isArchived(tab) ? (
                                                        <>
                                                            <button type="button" class={styles.action} aria-label={strings.restoreTab(tab.title)} title={strings.restoreTooltip} onClick={() => void restore([tab.id])}>
                                                                <Icon name="restore" size={15} />
                                                            </button>
                                                            <button type="button" class={styles.action} aria-label={strings.deleteForeverTab(tab.title)} title={strings.deleteForeverTooltip} onClick={() => void remove([tab.id])}>
                                                                <Icon name="trash" size={15} />
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <button type="button" class={styles.action} aria-label={strings.editTab(tab.title)} title={strings.editTooltip} data-panel-opener onClick={() => goTo(`#edit/${encodeURIComponent(tab.id)}`)}>
                                                                <Icon name="edit" size={15} />
                                                            </button>
                                                            <button type="button" class={styles.action} aria-label={strings.archiveTab(tab.title)} title={strings.archiveTooltip} onClick={() => void archive([tab.id])}>
                                                                <Icon name="archive" size={15} />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                class={tab.pinned ? `${styles.action} ${styles.actionOn}` : styles.action}
                                                                aria-label={tab.pinned ? strings.unpinTab(tab.title) : strings.pinTab(tab.title)}
                                                                aria-pressed={!!tab.pinned}
                                                                title={tab.pinned ? strings.unpinTooltip : strings.pinTooltip}
                                                                onClick={() => void togglePin(tab)}
                                                            >
                                                                <Icon name="pin" size={15} />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {end < rows.length && <tr aria-hidden="true" style={{ height: `${(rows.length - end) * ROW_HEIGHT}px` }} />}
                            </tbody>
                        </table>
                        {rows.length === 0 && <p class={styles.empty}>{query.trim() ? strings.noMatchesTitle(query.trim()) : strings.libraryEmpty}</p>}
                    </div>
                    </div>
                </main>

                {(page.kind === "add" || editing) && (
                    // Floats over the table: the list stays where it is, in view beside the form.
                    <aside
                        class={styles.sheet}
                        aria-label={editing ? strings.editTab(editing.title) : strings.addLinkManually}
                    >
                        {editing ? (
                            <section>
                                <h2>{strings.editPageTitle}</h2>
                                <EditForm
                                    key={editing.id}
                                    tab={editing}
                                    category={getTabCategory(editing)}
                                    editOptions={editOptions}
                                    colorOf={colorOf}
                                    onEdit={(updates) => saveEdit(editing, updates)}
                                    onDone={backToList}
                                />
                                <dl class={styles.facts}>
                                    <dd>{strings.savedAgo(daysSince(editing.savedAt))}</dd>
                                    <dd>{editing.openCount ? strings.openedTimes(editing.openCount) : strings.notOpenedFromHere}</dd>
                                </dl>
                            </section>
                        ) : (
                            <ManualForm
                                tabs={library.tabs}
                                categoryOptions={saveOptions}
                                colorOf={colorOf}
                                onAdded={(_result: AddTabResult) => {
                                    backToList();
                                    setFilter(ALL);
                                    setQuery("");
                                    void reload();
                                }}
                                onDuplicate={backToList}
                                onRestore={(id) => {
                                    backToList();
                                    void restore([id]);
                                }}
                                onClose={backToList}
                            />
                        )}
                    </aside>
                )}
            </div>

            <Toast compact />
        </div>
    );
}
