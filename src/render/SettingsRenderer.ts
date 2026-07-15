import { SavedTab, Settings } from "../types";
import { getElement } from "../dom/domHelper";
import { getTabs, getSettings, setSettings } from "../storage/chromeStorage";
import {
    addCategory,
    removeCategory,
    getTabCategory,
    getCategoryColorHex,
    setCategoryColor,
    CATEGORY_COLOR_PALETTE,
} from "../domain/CategoryRepository";

type Refresh = () => void | Promise<void>;

function createColorPicker(categoryName: string, categoryColors: Record<string, string>, refresh: Refresh): HTMLElement {
    const currentHex = getCategoryColorHex(categoryName, categoryColors);
    const picker = document.createElement("div");
    picker.className = "color-picker";
    picker.setAttribute("role", "group");
    picker.setAttribute("aria-label", `Color for ${categoryName}`);

    for (const [key, hex] of Object.entries(CATEGORY_COLOR_PALETTE)) {
        const swatch = document.createElement("button");
        swatch.type = "button";
        swatch.className = "color-swatch" + (hex === currentHex ? " selected" : "");
        swatch.style.backgroundColor = hex;
        swatch.setAttribute("aria-label", `${key}`);
        swatch.setAttribute("aria-pressed", String(hex === currentHex));
        swatch.addEventListener("click", async () => {
            await setCategoryColor(categoryName, key);
            await refresh();
        });
        picker.appendChild(swatch);
    }
    return picker;
}

function renderCategoryList(settings: Settings, tabs: SavedTab[], refresh: Refresh): void {
    const list = getElement<HTMLUListElement>("category-list");
    list.innerHTML = "";

    for (const cat of settings.categories) {
        const li = document.createElement("li");
        li.className = "category-item";

        const row = document.createElement("div");
        row.className = "category-item-row";

        const dot = document.createElement("span");
        dot.className = "cat-dot";
        dot.style.backgroundColor = getCategoryColorHex(cat, settings.categoryColors);
        dot.setAttribute("aria-hidden", "true");
        row.appendChild(dot);

        const inUse = tabs.some((t) => getTabCategory(t) === cat);
        const name = document.createElement("span");
        name.className = "category-name";
        name.textContent = cat;
        row.appendChild(name);

        row.appendChild(createColorPicker(cat, settings.categoryColors, refresh));

        // Per-category message, shown as a second line on this specific card — a single
        // shared status line was ambiguous about which category it referred to once there
        // was more than one. Auto-clears after a few seconds, and every fresh render starts
        // clean, so reopening Settings (which re-renders via refreshCategorySection) never
        // shows a stale message left over from before.
        const message = document.createElement("p");
        message.className = "category-item-message";
        message.setAttribute("role", "status");
        message.setAttribute("aria-live", "polite");

        // Visually muted when in use (not the real "why can't I remove this" signal — that's
        // unreliable via a disabled button's title tooltip, which browsers often suppress).
        // Stays a real, clickable button so clicking it still reveals the reason via the message.
        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "remove-cat" + (inUse ? " remove-cat--muted" : "");
        removeBtn.setAttribute("aria-label", `Remove ${cat}`);
        removeBtn.textContent = "×";
        removeBtn.addEventListener("click", async () => {
            const result = await removeCategory(cat, tabs);
            if (!result.removed) {
                message.textContent = result.reason ?? "Couldn't remove this category.";
                removeBtn.classList.add("remove-cat--flash-error");
                window.setTimeout(() => {
                    message.textContent = "";
                    removeBtn.classList.remove("remove-cat--flash-error");
                }, 3000);
                return;
            }
            await refresh();
        });
        row.appendChild(removeBtn);

        li.appendChild(row);
        li.appendChild(message);
        list.appendChild(li);
    }
}

/**
 * Re-reads categories + tabs and re-renders the category list, including "in use" status
 * and each category's color. Called both on init and from viewController's refreshView — a
 * tab being deleted or recategorized from the main list changes "in use" status here too,
 * even while this view is hidden, so it's never stale when the user actually opens Settings.
 */
export async function refreshCategorySection(refresh: Refresh): Promise<void> {
    const [settings, tabs] = await Promise.all([getSettings(), getTabs()]);
    renderCategoryList(settings, tabs, refresh);
}

function bindAddCategoryForm(refresh: Refresh): void {
    const form = getElement<HTMLFormElement>("add-category-form");
    const input = getElement<HTMLInputElement>("new-category-input");
    const counter = getElement<HTMLElement>("new-category-counter");
    const maxLength = input.maxLength;

    const updateCounter = () => {
        counter.textContent = `${input.value.length}/${maxLength}`;
    };

    input.addEventListener("input", updateCounter);

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const name = input.value.trim();
        if (!name) return;
        await addCategory(name);
        input.value = "";
        updateCounter();
        await refresh();
    });
}

/** Reflects persisted settings into the controls once on load — nothing else changes these two fields. */
async function syncOutdatedControls(): Promise<void> {
    const settings = await getSettings();
    const toggle = getElement<HTMLInputElement>("outdated-toggle");
    const daysInput = getElement<HTMLInputElement>("outdated-days");
    toggle.checked = settings.outdatedEnabled;
    daysInput.value = String(settings.outdatedDays);
    daysInput.disabled = !settings.outdatedEnabled;
}

function bindOutdatedControls(refresh: Refresh): void {
    const toggle = getElement<HTMLInputElement>("outdated-toggle");
    const daysInput = getElement<HTMLInputElement>("outdated-days");

    toggle.addEventListener("change", async () => {
        const settings = await getSettings();
        settings.outdatedEnabled = toggle.checked;
        await setSettings(settings);
        daysInput.disabled = !toggle.checked;
        await refresh();
    });

    daysInput.addEventListener("change", async () => {
        const days = Math.max(1, Math.min(365, parseInt(daysInput.value, 10) || 7));
        daysInput.value = String(days);
        const settings = await getSettings();
        settings.outdatedDays = days;
        await setSettings(settings);
        await refresh();
    });
}

function bindShortcutDisplay(): void {
    const shortcutDisplay = getElement<HTMLElement>("shortcut-display");
    const customizeBtn = getElement<HTMLButtonElement>("shortcut-customize-btn");

    chrome.commands.getAll((commands) => {
        const cmd = commands.find((c) => c.name === "_execute_action");
        shortcutDisplay.textContent = cmd?.shortcut || "Not set";
    });

    customizeBtn.addEventListener("click", () => {
        chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
    });
}

/**
 * Show/hide toggle (the show/hide mechanics were pulled forward into Story 3, since that
 * story's category management couldn't be exercised at all without a way to reach Settings).
 * Story 5 adds the focus management here: hiding an element doesn't reliably move focus
 * away from a now-hidden descendant across browsers, so focus is moved explicitly on both
 * sides of the transition — into Settings on open, back to the trigger on close — rather
 * than leaving keyboard/screen-reader users stranded on whichever control they last used.
 */
function bindViewToggle(refresh: Refresh): void {
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
        backBtn.focus();
        // Re-render fresh on every open — belt-and-suspenders alongside the message's own
        // timeout, so a stale per-category message never survives a trip back to the main view.
        refreshCategorySection(refresh);
    });

    backBtn.addEventListener("click", () => {
        settingsView.hidden = true;
        mainView.hidden = false;
        pillsRow.hidden = false;
        actionRow.hidden = false;
        manualEntry.hidden = false;
        gearBtn.focus();
    });
}

export async function initSettings(refresh: Refresh): Promise<void> {
    bindViewToggle(refresh);
    bindAddCategoryForm(refresh);
    bindOutdatedControls(refresh);
    bindShortcutDisplay();
    await syncOutdatedControls();
}
