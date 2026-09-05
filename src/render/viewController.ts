import { getTabs, getSettings } from "../storage/chromeStorage";
import { getSelectableCategories } from "../domain/CategoryRepository";
import { editTab, deleteTab, restoreTab, reorderTabs } from "../domain/TabRepository";
import { searchTabs, MatchRange } from "../domain/search";
import { renderPills, filterTabs } from "./PillsRenderer";
import { renderList, scrollToAndHighlight } from "./ListRenderer";
import { renderHeroStats } from "./HeroRenderer";
import { refreshCategorySection } from "./SettingsRenderer";
import { getSearchQuery, setSearchRowVisible, announceResultCount, clearResultAnnouncement } from "./SearchRenderer";
import { showUndoToast } from "./ToastRenderer";

// Typing re-triggers a full refreshView() on every keystroke (see SearchRenderer), and each
// call does several independent storage reads before it renders anything — fast enough that
// two calls rarely overlap, but not so fast it's guaranteed. Without this, a keystroke whose
// refresh happens to resolve after a later one's would win the race and paint stale results
// over fresh ones. Bumped up front and checked right before rendering: only the most recently
// started call is allowed to touch the DOM.
let refreshToken = 0;

/**
 * Re-fetches everything and re-renders pills, the (filtered + searched) list, hero stats, and
 * the Settings category section together. This is the one place that knows how the renderers
 * compose, so individual renderer modules don't need to import each other to trigger a
 * refresh — and so "in use" status in Settings never goes stale just because the change
 * that affected it happened somewhere else (e.g. deleting a tab from the main list).
 */
export async function refreshView(): Promise<void> {
    const token = ++refreshToken;
    const tabs = await getTabs();
    const categories = await getSelectableCategories();
    const settings = await getSettings();
    if (token !== refreshToken) return; // a newer refresh started while these reads were in flight

    setSearchRowVisible(tabs.length > 0);

    // Category/outdated pills are always computed from the full, unsearched set — narrowing
    // them to search results would make pills disappear mid-query for reasons unrelated to
    // what the user typed.
    renderPills(tabs, settings, refreshView);

    const categoryFiltered = filterTabs(tabs, settings);
    const query = getSearchQuery().trim();

    let listTabs = categoryFiltered;
    let highlightRanges: Map<string, MatchRange[]> | undefined;
    let emptyMessage: string | undefined;

    if (query) {
        const matches = searchTabs(categoryFiltered, query);
        listTabs = matches.map((m) => m.tab);
        highlightRanges = new Map(matches.map((m) => [m.tab.id, m.titleRanges]));
        emptyMessage = "No matching tabs.";
        announceResultCount(matches.length);
    } else {
        clearResultAnnouncement();
    }

    renderList(
        listTabs,
        categories,
        settings,
        {
            onEdit: async (id, updates) => {
                await editTab(id, updates);
                await refreshView();
            },
            onDelete: async (id) => {
                const result = await deleteTab(id);
                await refreshView();
                if (!result) return; // already gone (e.g. a second click before the row's own refresh landed)
                showUndoToast("Deleted", async () => {
                    await restoreTab(result.tab, result.index);
                    await refreshView();
                    scrollToAndHighlight(result.tab.id);
                });
            },
            onReorder: async (draggedId, targetId) => {
                await reorderTabs(draggedId, targetId);
                await refreshView();
            },
        },
        { highlightRanges, searchActive: Boolean(query), emptyMessage }
    );
    await renderHeroStats(tabs);
    await refreshCategorySection(refreshView);
}
