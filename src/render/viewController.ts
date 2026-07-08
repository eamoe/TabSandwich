import { getTabs, getSettings } from "../storage/chromeStorage";
import { getSelectableCategories } from "../domain/CategoryRepository";
import { editTab, deleteTab, reorderTabs } from "../domain/TabRepository";
import { renderPills, filterTabs } from "./PillsRenderer";
import { renderList } from "./ListRenderer";
import { renderHeroStats } from "./HeroRenderer";
import { refreshCategorySection } from "./SettingsRenderer";

/**
 * Re-fetches everything and re-renders pills, the (filtered) list, hero stats, and the
 * Settings category section together. This is the one place that knows how the renderers
 * compose, so individual renderer modules don't need to import each other to trigger a
 * refresh — and so "in use" status in Settings never goes stale just because the change
 * that affected it happened somewhere else (e.g. deleting a tab from the main list).
 */
export async function refreshView(): Promise<void> {
    const tabs = await getTabs();
    const categories = await getSelectableCategories();
    const settings = await getSettings();

    renderPills(tabs, settings, refreshView);
    renderList(filterTabs(tabs, settings), categories, settings, {
        onEdit: async (id, updates) => {
            await editTab(id, updates);
            await refreshView();
        },
        onDelete: async (id) => {
            await deleteTab(id);
            await refreshView();
        },
        onReorder: async (draggedId, targetId) => {
            await reorderTabs(draggedId, targetId);
            await refreshView();
        },
    });
    await renderHeroStats(tabs);
    await refreshCategorySection(refreshView);
}
