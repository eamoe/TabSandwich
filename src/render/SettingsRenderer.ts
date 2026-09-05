import { SavedTab, Settings } from "../types";
import { getElement } from "../dom/domHelper";
import { getTabs, getSettings, setSettings } from "../storage/chromeStorage";
import {
    addCategory,
    removeCategory,
    renameCategory,
    moveCategory,
    reorderCategories,
    MoveDirection,
    getTabCategory,
    getCategoryColorHex,
    setCategoryColor,
    CATEGORY_COLOR_PALETTE,
} from "../domain/CategoryRepository";
import { initBackup } from "./BackupRenderer";

type Refresh = () => void | Promise<void>;

const RENAME_ICON = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
const UP_ICON = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>`;
const DOWN_ICON = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;
const MAX_CATEGORY_NAME_LENGTH = 15;

// Module-level, same pattern as ListRenderer's tab drag: only one category drag can be in
// progress at a time across the whole list.
let dragCat: string | null = null;

/** Drag-and-drop reorder, alongside the up/down buttons — buttons cover the keyboard path (drag has none, same documented gap as the tab list), drag covers the fast mouse path. */
function bindCategoryDragHandlers(li: HTMLLIElement, cat: string, refresh: Refresh): void {
    li.addEventListener("dragstart", (e) => {
        dragCat = cat;
        li.classList.add("dragging");
        if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
    });

    li.addEventListener("dragend", () => {
        dragCat = null;
        li.classList.remove("dragging");
        document.querySelectorAll(".category-list li.drag-over").forEach((el) => el.classList.remove("drag-over"));
    });

    li.addEventListener("dragover", (e) => {
        if (!dragCat || dragCat === cat) return;
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
        li.classList.add("drag-over");
    });

    li.addEventListener("dragleave", () => li.classList.remove("drag-over"));

    li.addEventListener("drop", (e) => {
        e.preventDefault();
        li.classList.remove("drag-over");
        if (!dragCat || dragCat === cat) return;
        reorderCategories(dragCat, cat).then(refresh);
    });
}

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

/** Shows `text` on this category's own status line for a few seconds — never a shared/global message, so it's unambiguous which card it refers to once there's more than one. */
function flashMessage(message: HTMLElement, flashTarget: HTMLElement, flashClass: string, text: string): void {
    message.textContent = text;
    flashTarget.classList.add(flashClass);
    window.setTimeout(() => {
        message.textContent = "";
        flashTarget.classList.remove(flashClass);
    }, 3000);
}

/**
 * Swaps the name span for a text input in place. Enter blurs (committing via the blur
 * handler below, so there's one single commit path); Escape reverts without saving. Blur
 * itself always attempts a commit — renaming to the unchanged value is a no-op in
 * renameCategory, so clicking away after not actually changing anything just quietly closes
 * the editor instead of needing a separate "did anything change" check here.
 */
function startRenaming(
    li: HTMLLIElement,
    name: HTMLElement,
    cat: string,
    tabs: SavedTab[],
    message: HTMLElement,
    refresh: Refresh
): void {
    let cancelled = false;
    // Dragging a row that's mid-rename would fight with selecting/editing its text — same
    // reasoning as the tab list disabling drag on a row in edit mode.
    li.draggable = false;
    const input = document.createElement("input");
    input.type = "text";
    input.className = "cat-rename-input";
    input.maxLength = MAX_CATEGORY_NAME_LENGTH;
    input.value = cat;
    input.setAttribute("aria-label", `Rename ${cat}`);
    name.replaceWith(input);
    input.focus();
    input.select();

    const revert = () => {
        li.draggable = true;
        if (input.isConnected) input.replaceWith(name);
    };

    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            input.blur();
        } else if (e.key === "Escape") {
            e.preventDefault();
            cancelled = true;
            revert();
        }
    });

    input.addEventListener("blur", async () => {
        if (cancelled) return;
        const result = await renameCategory(cat, input.value, tabs);
        if (!result.renamed) {
            flashMessage(message, input, "cat-rename-input--error", result.reason ?? "Couldn't rename this category.");
            revert();
            return;
        }
        await refresh();
    });
}

function createCategoryItem(
    cat: string,
    index: number,
    settings: Settings,
    tabs: SavedTab[],
    refresh: Refresh
): HTMLLIElement {
    const li = document.createElement("li");
    li.className = "category-item";
    li.draggable = true;
    bindCategoryDragHandlers(li, cat, refresh);

    const row = document.createElement("div");
    row.className = "category-item-row";

    // A stacked up/down pair reads as a reorder "handle" at the row's leading edge — and
    // costs far less width than a side-by-side pair, which matters since this row is already
    // carrying the color picker's 9 swatches.
    const moveGroup = document.createElement("div");
    moveGroup.className = "move-cat-group";
    const move = (direction: MoveDirection, label: string, icon: string, disabled: boolean) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "cat-icon-btn move-cat";
        btn.setAttribute("aria-label", label);
        btn.innerHTML = icon;
        btn.disabled = disabled;
        btn.addEventListener("click", async () => {
            await moveCategory(cat, direction);
            await refresh();
        });
        return btn;
    };
    moveGroup.appendChild(move("up", `Move ${cat} up`, UP_ICON, index === 0));
    moveGroup.appendChild(move("down", `Move ${cat} down`, DOWN_ICON, index === settings.categories.length - 1));
    row.appendChild(moveGroup);

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

    // Per-category message, shown as a second line on this specific card. Auto-clears after
    // a few seconds, and every fresh render starts clean, so reopening Settings (which
    // re-renders via refreshCategorySection) never shows a stale message left over from before.
    const message = document.createElement("p");
    message.className = "category-item-message";
    message.setAttribute("role", "status");
    message.setAttribute("aria-live", "polite");

    // Paired with remove at the row's trailing edge — the two per-category actions that
    // aren't "pick a value" (rename, remove) sit together, same as edit+delete pair in the
    // main tab list.
    const renameBtn = document.createElement("button");
    renameBtn.type = "button";
    renameBtn.className = "cat-icon-btn";
    renameBtn.setAttribute("aria-label", `Rename ${cat}`);
    renameBtn.innerHTML = RENAME_ICON;
    renameBtn.addEventListener("click", () => startRenaming(li, name, cat, tabs, message, refresh));
    row.appendChild(renameBtn);

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
            flashMessage(message, removeBtn, "remove-cat--flash-error", result.reason ?? "Couldn't remove this category.");
            return;
        }
        await refresh();
    });
    row.appendChild(removeBtn);

    li.appendChild(row);
    li.appendChild(message);
    return li;
}

function renderCategoryList(settings: Settings, tabs: SavedTab[], refresh: Refresh): void {
    const list = getElement<HTMLUListElement>("category-list");
    list.innerHTML = "";
    settings.categories.forEach((cat, index) => {
        list.appendChild(createCategoryItem(cat, index, settings, tabs, refresh));
    });
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
        // The gear button was otherwise left showing, unchanged, right next to the Settings
        // header it opened — a "go to Settings" control makes no sense once you're already
        // there, and it looked identical to its main-screen state with nothing to tell the
        // two apart. Back is the only way in and out from here.
        gearBtn.hidden = true;
        // Drives the search row's visibility via CSS rather than setting its own [hidden]
        // here — that attribute stays owned solely by whether anything's saved yet (see
        // SearchRenderer), so this can't fight it over the same property. Making the input
        // itself unreachable, not just visually tucked away, matters: a query typed while the
        // list behind it is hidden corrupts row-insert animations (getBoundingClientRect
        // returns zero for anything under display:none) — this closes off that path entirely.
        document.body.classList.add("settings-open");
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
        gearBtn.hidden = false;
        document.body.classList.remove("settings-open");
        gearBtn.focus();
    });
}

export async function initSettings(refresh: Refresh): Promise<void> {
    bindViewToggle(refresh);
    bindAddCategoryForm(refresh);
    bindOutdatedControls(refresh);
    bindShortcutDisplay();
    initBackup(refresh);
    await syncOutdatedControls();
}
