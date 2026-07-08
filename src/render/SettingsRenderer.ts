import { SavedTab } from "../types";
import { getElement } from "../dom/domHelper";
import { getTabs } from "../storage/chromeStorage";
import { listCategories, addCategory, removeCategory, getTabCategory } from "../domain/CategoryRepository";

type Refresh = () => void | Promise<void>;

function renderCategoryList(categories: string[], tabs: SavedTab[], refresh: Refresh): void {
    const list = getElement<HTMLUListElement>("category-list");
    const status = getElement<HTMLParagraphElement>("category-status");
    list.innerHTML = "";
    // Reset on every fresh render — a stale "in use" message shouldn't persist once the
    // underlying state has changed via some other action (e.g. reassigning tabs elsewhere).
    status.textContent = "";

    for (const cat of categories) {
        const li = document.createElement("li");
        li.className = "category-item";

        const inUse = tabs.some((t) => getTabCategory(t) === cat);
        const name = document.createElement("span");
        name.textContent = inUse ? `${cat} · in use` : cat;
        li.appendChild(name);

        // Always clickable — a disabled button's title tooltip is unreliable (often suppressed
        // by the browser entirely), so "why can't I remove this" needs to be visible text instead.
        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "remove-cat";
        removeBtn.setAttribute("aria-label", `Remove ${cat}`);
        removeBtn.textContent = "×";
        removeBtn.addEventListener("click", async () => {
            const result = await removeCategory(cat, tabs);
            if (!result.removed) {
                status.textContent = result.reason ?? "Couldn't remove this category.";
                return;
            }
            status.textContent = "";
            await refresh();
        });
        li.appendChild(removeBtn);
        list.appendChild(li);
    }
}

/**
 * Re-reads categories + tabs and re-renders the category list, including "in use" status.
 * Called both on init and from viewController's refreshView — a tab being deleted or
 * recategorized from the main list changes "in use" status here too, even while this
 * view is hidden, so it's never stale when the user actually opens Settings.
 */
export async function refreshCategorySection(refresh: Refresh): Promise<void> {
    const [categories, tabs] = await Promise.all([listCategories(), getTabs()]);
    renderCategoryList(categories, tabs, refresh);
}

function bindAddCategoryForm(refresh: Refresh): void {
    const form = getElement<HTMLFormElement>("add-category-form");
    const input = getElement<HTMLInputElement>("new-category-input");

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const name = input.value.trim();
        if (!name) return;
        await addCategory(name);
        input.value = "";
        await refresh();
    });
}

/**
 * Minimal show/hide toggle, pulled forward from Story 5 because Story 3's category
 * management can't be exercised at all without a way to reach the Settings view.
 * Story 5 adds the keyboard-shortcut display and focus-management polish on top of this.
 */
function bindViewToggle(): void {
    const gearBtn = getElement<HTMLButtonElement>("gear-btn");
    const backBtn = getElement<HTMLButtonElement>("back-btn");
    const settingsView = getElement<HTMLElement>("settings-view");
    const mainView = getElement<HTMLElement>("main-view");
    const pillsRow = getElement<HTMLElement>("pills-container");
    const actionRow = getElement<HTMLElement>("action-row");
    const manualEntry = getElement<HTMLElement>("manual-entry");

    gearBtn.addEventListener("click", () => {
        settingsView.hidden = false;
        mainView.hidden = true;
        pillsRow.hidden = true;
        actionRow.hidden = true;
        manualEntry.hidden = true;
    });

    backBtn.addEventListener("click", () => {
        settingsView.hidden = true;
        mainView.hidden = false;
        pillsRow.hidden = false;
        actionRow.hidden = false;
        manualEntry.hidden = false;
    });
}

export function initSettings(refresh: Refresh): void {
    bindViewToggle();
    bindAddCategoryForm(refresh);
}
