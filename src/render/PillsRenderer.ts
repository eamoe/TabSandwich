import { SavedTab } from "../types";
import { getElement } from "../dom/domHelper";
import { getTabCategory, UNCATEGORIZED } from "../domain/CategoryRepository";

const ALL = "All";
let currentFilter: string = ALL;

export function filterTabs(tabs: SavedTab[]): SavedTab[] {
    if (currentFilter === ALL) return tabs;
    return tabs.filter((t) => getTabCategory(t) === currentFilter);
}

function getUniqueCategoriesInUse(tabs: SavedTab[]): string[] {
    const cats = new Set(tabs.map(getTabCategory));
    cats.delete(UNCATEGORIZED);
    const sorted = [...cats].sort();
    if (tabs.some((t) => getTabCategory(t) === UNCATEGORIZED)) sorted.push(UNCATEGORIZED);
    return sorted;
}

export function renderPills(tabs: SavedTab[], onChange: () => void | Promise<void>): void {
    const container = getElement<HTMLElement>("pills-container");
    container.innerHTML = "";

    // A filter selecting a category no longer present in any tab has nothing left to show — fall back to All.
    const categories = getUniqueCategoriesInUse(tabs);
    if (currentFilter !== ALL && !categories.includes(currentFilter)) {
        currentFilter = ALL;
    }

    for (const cat of [ALL, ...categories]) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "pill";
        btn.textContent = cat;
        btn.setAttribute("aria-pressed", String(cat === currentFilter));
        btn.addEventListener("click", async () => {
            currentFilter = cat;
            await onChange();
        });
        container.appendChild(btn);
    }
}
