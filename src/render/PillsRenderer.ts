import { SavedTab, Settings } from "../types";
import { getElement } from "../dom/domHelper";
import { getTabCategory, UNCATEGORIZED, getCategoryColorHex } from "../domain/CategoryRepository";
import { isOutdated } from "../util/time";
import { isLightColor } from "../util/color";

const ALL = "All";
const OUTDATED = "Outdated";
let currentFilter: string = ALL;

function isTabOutdated(tab: SavedTab, settings: Settings): boolean {
    return isOutdated(tab.savedAt, settings.outdatedEnabled, settings.outdatedDays);
}

export function filterTabs(tabs: SavedTab[], settings: Settings): SavedTab[] {
    if (currentFilter === ALL) return tabs;
    if (currentFilter === OUTDATED) return tabs.filter((t) => isTabOutdated(t, settings));
    return tabs.filter((t) => getTabCategory(t) === currentFilter);
}

/**
 * Categories currently in use, ordered to match Settings' configured category order (S05) —
 * reordering categories in Settings is otherwise invisible anywhere outside the Settings view
 * and the selection dropdowns, so pills follow it too. A category somehow in use but no longer
 * in Settings.categories (stale data) still gets a pill — appended alphabetically — rather than
 * silently vanishing. Uncategorized always sits last, never subject to manual ordering.
 */
function getUniqueCategoriesInUse(tabs: SavedTab[], configuredOrder: string[]): string[] {
    const inUse = new Set(tabs.map(getTabCategory));
    inUse.delete(UNCATEGORIZED);

    const ordered = configuredOrder.filter((c) => inUse.has(c));
    const strays = [...inUse].filter((c) => !configuredOrder.includes(c)).sort();
    const result = [...ordered, ...strays];

    if (tabs.some((t) => getTabCategory(t) === UNCATEGORIZED)) result.push(UNCATEGORIZED);
    return result;
}

export function renderPills(tabs: SavedTab[], settings: Settings, onChange: () => void | Promise<void>): void {
    const container = getElement<HTMLElement>("pills-container");
    container.innerHTML = "";

    const categories = getUniqueCategoriesInUse(tabs, settings.categories);
    const outdatedCount = tabs.filter((t) => isTabOutdated(t, settings)).length;

    // A filter that no longer has anything to show (category gone, or nothing's outdated
    // anymore / flagging got disabled) falls back to All rather than displaying an empty list silently.
    const availableFilters = [ALL, ...categories, ...(outdatedCount > 0 ? [OUTDATED] : [])];
    if (!availableFilters.includes(currentFilter)) {
        currentFilter = ALL;
    }

    // Outdated sits right after All — clicking any other pill is what "turns it off,"
    // same as switching between categories, rather than needing its own separate un-toggle.
    const pillOrder = [ALL, ...(outdatedCount > 0 ? [OUTDATED] : []), ...categories];

    for (const cat of pillOrder) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "pill";
        btn.textContent = cat === OUTDATED ? `Outdated (${outdatedCount})` : cat;
        if (cat === OUTDATED) {
            btn.classList.add("pill-outdated");
        } else if (cat !== ALL && cat !== UNCATEGORIZED) {
            btn.classList.add("pill-colored");
            const hex = getCategoryColorHex(cat, settings.categoryColors);
            const pale = isLightColor(hex);
            btn.style.setProperty("--pill-color", hex);
            btn.style.setProperty("--pill-text", pale ? "#2A2447" : "#fff");
            if (pale) btn.classList.add("pill-colored--pale");
        }
        btn.setAttribute("aria-pressed", String(cat === currentFilter));
        btn.addEventListener("click", async () => {
            currentFilter = cat;
            await onChange();
        });
        container.appendChild(btn);
    }
}
