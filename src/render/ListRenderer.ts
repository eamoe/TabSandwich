import { SavedTab, Settings } from "../types";
import { getElement } from "../dom/domHelper";
import { getTabCategory, getCategoryColorHex, UNCATEGORIZED } from "../domain/CategoryRepository";
import { normalizeUrl } from "../util/url";
import { daysSince, isOutdated } from "../util/time";
import { tintHex } from "../util/color";

export interface ListCallbacks {
    onEdit: (tabId: string, updates: { title: string; url: string; category: string }) => void | Promise<void>;
    onDelete: (tabId: string) => void | Promise<void>;
    onReorder: (draggedId: string, targetId: string) => void | Promise<void>;
}

const EDIT_ICON = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
const DELETE_ICON = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`;

// Module-level: only one drag can be in progress at a time across the whole list.
let dragId: string | null = null;

function placeholderIconHtml(): string {
    return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#b7aede" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`;
}

function createFavicon(tab: SavedTab): HTMLElement {
    const wrapper = document.createElement("span");
    wrapper.className = "favicon";
    if (tab.faviconUrl) {
        const img = document.createElement("img");
        img.src = tab.faviconUrl;
        img.width = 16;
        img.height = 16;
        img.alt = "";
        img.addEventListener("error", () => {
            img.remove();
            wrapper.innerHTML = placeholderIconHtml();
        });
        wrapper.appendChild(img);
    } else {
        wrapper.innerHTML = placeholderIconHtml();
    }
    return wrapper;
}

function createCategorySelect(tab: SavedTab, categories: string[], ariaLabel: string): HTMLSelectElement {
    const select = document.createElement("select");
    select.className = "cat-select";
    select.setAttribute("aria-label", ariaLabel);
    for (const cat of categories) {
        const opt = document.createElement("option");
        opt.value = cat;
        opt.textContent = cat;
        opt.selected = cat === getTabCategory(tab);
        select.appendChild(opt);
    }
    return select;
}

/**
 * Tints the whole row with a pastel version of its category color — rows "stacked like a
 * sandwich," each layer colored by category, rather than a small separate indicator.
 * Color can't be the only way to know a tab's category (screen reader / colorblind users
 * would lose that entirely), so a screen-reader-only label backs it up. No hover tooltip
 * here — the row's one tooltip slot is reserved for the (possibly truncated) title instead,
 * and the category is already visible via the matching pill up top.
 */
function applyCategoryTint(li: HTMLLIElement, tab: SavedTab, settings: Settings): void {
    const category = getTabCategory(tab);
    // Uncategorized stays plain white — it represents "no color applied," not a gray category.
    if (category !== UNCATEGORIZED) {
        const tint = tintHex(getCategoryColorHex(category, settings.categoryColors), 0.85);
        li.style.setProperty("--row-tint", tint);
    }

    const srLabel = document.createElement("span");
    srLabel.className = "visually-hidden";
    srLabel.textContent = `Category: ${category}`;
    li.appendChild(srLabel);
}

/** Drag-to-reorder has no keyboard equivalent in this version (FR-019 exemption) — display rows only. */
function bindDragHandlers(li: HTMLLIElement, tab: SavedTab, callbacks: ListCallbacks): void {
    li.draggable = true;

    li.addEventListener("dragstart", (e) => {
        dragId = tab.id;
        li.classList.add("dragging");
        if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
    });

    li.addEventListener("dragend", () => {
        dragId = null;
        li.classList.remove("dragging");
        document.querySelectorAll(".tab-list li.drag-over").forEach((el) => el.classList.remove("drag-over"));
    });

    li.addEventListener("dragover", (e) => {
        if (!dragId || dragId === tab.id) return;
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
        li.classList.add("drag-over");
    });

    li.addEventListener("dragleave", () => li.classList.remove("drag-over"));

    li.addEventListener("drop", (e) => {
        e.preventDefault();
        li.classList.remove("drag-over");
        if (!dragId || dragId === tab.id) return;
        callbacks.onReorder(dragId, tab.id);
    });
}

/**
 * Swapping a row's content between the single-line display layout and the taller stacked
 * edit layout happens via an instant innerHTML replacement — the row's height otherwise jumps
 * to its new size in one frame. "height: auto" can't be transitioned directly, so this clamps
 * the row to its pre-swap height, runs the swap, then animates to the new natural height
 * before releasing back to auto (so later content changes aren't left clipped).
 */
function animateRowHeightChange(li: HTMLLIElement, mutate: () => void): void {
    const startHeight = li.getBoundingClientRect().height;

    mutate();

    const endHeight = li.scrollHeight;
    if (startHeight === endHeight) return;

    li.style.height = `${startHeight}px`;
    li.style.overflow = "hidden";
    li.style.transition = "height 0.18s ease";
    li.getBoundingClientRect(); // force layout to commit the clamped start height before animating

    requestAnimationFrame(() => {
        li.style.height = `${endHeight}px`;
    });

    li.addEventListener(
        "transitionend",
        () => {
            li.style.height = "";
            li.style.overflow = "";
            li.style.transition = "";
        },
        { once: true }
    );
}

type CollapsibleValues = { height: string; paddingTop: string; paddingBottom: string; borderBottomWidth: string; opacity: string };

/** Reads the row's current rendered box as explicit values, so it can be locked in place with
 *  inline styles before animating away from (or back to) them — "height: auto" can't transition. */
function currentCollapsibleValues(li: HTMLLIElement): CollapsibleValues {
    const cs = getComputedStyle(li);
    return {
        height: `${li.getBoundingClientRect().height}px`,
        paddingTop: cs.paddingTop,
        paddingBottom: cs.paddingBottom,
        borderBottomWidth: cs.borderBottomWidth,
        opacity: cs.opacity,
    };
}

function setCollapsibleValues(li: HTMLLIElement, values: CollapsibleValues): void {
    li.style.height = values.height;
    li.style.paddingTop = values.paddingTop;
    li.style.paddingBottom = values.paddingBottom;
    li.style.borderBottomWidth = values.borderBottomWidth;
    li.style.opacity = values.opacity;
}

const ZERO_COLLAPSIBLE_VALUES: CollapsibleValues = { height: "0px", paddingTop: "0px", paddingBottom: "0px", borderBottomWidth: "0px", opacity: "0" };

/**
 * Filtering (pill clicks) and deletion otherwise remove a row straight out of the DOM in one
 * frame — this shrinks it to nothing first (height, padding, and border together, or it'd
 * just get stuck at its padding/border floor) so the rows below slide up instead of jumping.
 */
function collapseAndRemove(li: HTMLLIElement): void {
    // Marked so a tab that reappears (e.g. a filter pill double-clicked) while this row is
    // still animating out gets a fresh row instead of one that's about to remove itself.
    li.classList.add("row-removing");
    setCollapsibleValues(li, currentCollapsibleValues(li));
    li.style.overflow = "hidden";
    li.style.transition = "height 0.16s ease, padding 0.16s ease, border-width 0.16s ease, opacity 0.12s ease";
    li.getBoundingClientRect(); // force layout to commit the current size before animating

    requestAnimationFrame(() => setCollapsibleValues(li, ZERO_COLLAPSIBLE_VALUES));

    li.addEventListener("transitionend", () => li.remove(), { once: true });
}

/** Mirror of collapseAndRemove for a row that just became visible (a tab entering the current
 *  filter, or a freshly saved tab) — grows in from nothing instead of just appearing. */
function animateRowInsert(li: HTMLLIElement): void {
    const end = currentCollapsibleValues(li);
    setCollapsibleValues(li, ZERO_COLLAPSIBLE_VALUES);
    li.style.overflow = "hidden";
    li.getBoundingClientRect(); // force layout to commit the collapsed starting point before animating

    li.style.transition = "height 0.16s ease, padding 0.16s ease, border-width 0.16s ease, opacity 0.18s ease";
    requestAnimationFrame(() => setCollapsibleValues(li, end));

    li.addEventListener(
        "transitionend",
        () => {
            li.style.height = "";
            li.style.paddingTop = "";
            li.style.paddingBottom = "";
            li.style.borderBottomWidth = "";
            li.style.opacity = "";
            li.style.overflow = "";
            li.style.transition = "";
        },
        { once: true }
    );
}

/**
 * One line per row. Category used to be a full-width text select competing with the title
 * for space, which is what forced a two-line layout; tinting the whole row instead frees
 * that space back up while still identifying each tab's category at a glance.
 */
function renderDisplayRow(
    li: HTMLLIElement,
    tab: SavedTab,
    categories: string[],
    settings: Settings,
    callbacks: ListCallbacks
): void {
    li.innerHTML = "";
    li.classList.remove("editing");
    bindDragHandlers(li, tab, callbacks);
    applyCategoryTint(li, tab, settings);

    li.appendChild(createFavicon(tab));

    const titleBtn = document.createElement("button");
    titleBtn.type = "button";
    titleBtn.className = "tab-title";
    titleBtn.textContent = tab.title;
    titleBtn.title = tab.title;
    titleBtn.addEventListener("click", () => chrome.tabs.create({ url: tab.url }));
    li.appendChild(titleBtn);

    if (isOutdated(tab.savedAt, settings.outdatedEnabled, settings.outdatedDays)) {
        const days = daysSince(tab.savedAt);
        const badge = document.createElement("span");
        badge.className = "age-badge";
        badge.textContent = `${days}d`;
        badge.title = `Saved ${days} day${days === 1 ? "" : "s"} ago`;
        li.appendChild(badge);
    }

    const actions = document.createElement("div");
    actions.className = "row-actions";

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "icon-btn";
    editBtn.setAttribute("aria-label", `Edit ${tab.title}`);
    editBtn.innerHTML = EDIT_ICON;
    editBtn.addEventListener("click", () =>
        animateRowHeightChange(li, () => renderEditRow(li, tab, categories, settings, callbacks))
    );
    actions.appendChild(editBtn);

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "icon-btn delete";
    deleteBtn.setAttribute("aria-label", `Delete ${tab.title}`);
    deleteBtn.innerHTML = DELETE_ICON;
    deleteBtn.addEventListener("click", () => callbacks.onDelete(tab.id));
    actions.appendChild(deleteBtn);

    li.appendChild(actions);
}

function renderEditRow(
    li: HTMLLIElement,
    tab: SavedTab,
    categories: string[],
    settings: Settings,
    callbacks: ListCallbacks
): void {
    li.innerHTML = "";
    li.draggable = false;
    li.classList.add("editing");

    const titleInput = document.createElement("input");
    titleInput.className = "edit-input";
    titleInput.value = tab.title;
    titleInput.setAttribute("aria-label", "Title");
    li.appendChild(titleInput);

    const urlInput = document.createElement("input");
    urlInput.className = "edit-input";
    urlInput.value = tab.url;
    urlInput.setAttribute("aria-label", "URL");
    li.appendChild(urlInput);

    const catSelect = createCategorySelect(tab, categories, "Category");
    catSelect.className = "edit-input";
    li.appendChild(catSelect);

    const actionsRow = document.createElement("div");
    actionsRow.className = "edit-actions";

    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "edit-save";
    saveBtn.textContent = "Save";
    saveBtn.addEventListener("click", () => {
        const normalized = normalizeUrl(urlInput.value);
        if (!normalized) {
            urlInput.classList.add("input-error");
            urlInput.focus();
            return;
        }
        const title = titleInput.value.trim() || normalized;
        const category = catSelect.value;

        // Exits edit mode immediately with the same smooth collapse Cancel uses, using the
        // edited values directly, rather than waiting on the round trip through storage and
        // a full refresh — which also lands (eventually, invisibly) with identical content.
        const updatedTab: SavedTab = { ...tab, title, url: normalized, category };
        animateRowHeightChange(li, () => renderDisplayRow(li, updatedTab, categories, settings, callbacks));
        callbacks.onEdit(tab.id, { title, url: normalized, category });
    });
    actionsRow.appendChild(saveBtn);

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "edit-cancel";
    cancelBtn.textContent = "Cancel";
    cancelBtn.addEventListener("click", () =>
        animateRowHeightChange(li, () => renderDisplayRow(li, tab, categories, settings, callbacks))
    );
    actionsRow.appendChild(cancelBtn);

    li.appendChild(actionsRow);
    titleInput.focus();
    titleInput.select();
}

/**
 * Reconciles against whatever rows are already in the DOM instead of wiping and rebuilding
 * the whole list on every call (which this used to do, unconditionally) — a full rebuild is
 * what made switching category pills, and finishing an edit, look like an instant swap rather
 * than a transition, since every row was a brand-new element with no time to animate anything.
 * Rows dropped by a filter/deletion collapse away; rows newly shown grow in; everything else
 * is repositioned in place and left alone — except a row mid-edit, which is skipped so an
 * unrelated refresh elsewhere (e.g. deleting a different tab) can't clobber an open edit.
 */
export function renderList(tabs: SavedTab[], categories: string[], settings: Settings, callbacks: ListCallbacks): void {
    const list = getElement<HTMLUListElement>("tab-list");
    list.querySelector("li.empty")?.remove();

    if (tabs.length === 0) {
        for (const li of Array.from(list.children) as HTMLLIElement[]) collapseAndRemove(li);
        const li = document.createElement("li");
        li.className = "empty";
        li.textContent = "No saved tabs yet.";
        list.appendChild(li);
        return;
    }

    const existingById = new Map<string, HTMLLIElement>();
    for (const child of Array.from(list.children) as HTMLLIElement[]) {
        if (child.dataset.tabId && !child.classList.contains("row-removing")) existingById.set(child.dataset.tabId, child);
    }

    const nextIds = new Set(tabs.map((t) => t.id));
    for (const [id, li] of existingById) {
        if (!nextIds.has(id)) collapseAndRemove(li);
    }

    let previousSibling: HTMLLIElement | null = null;
    for (const tab of tabs) {
        const existing = existingById.get(tab.id);
        const li = existing ?? document.createElement("li");
        const isNew = !existing;
        if (isNew) li.dataset.tabId = tab.id;

        const insertAfter: ChildNode | null = previousSibling ? previousSibling.nextSibling : list.firstChild;
        if (insertAfter !== li) list.insertBefore(li, insertAfter);

        if (isNew) {
            renderDisplayRow(li, tab, categories, settings, callbacks);
            animateRowInsert(li);
        } else if (!li.classList.contains("editing")) {
            renderDisplayRow(li, tab, categories, settings, callbacks);
        }
        previousSibling = li;
    }
}

/** Brings a saved tab into view and flashes it — used regardless of where it sits in a scrolled list (FR-003). */
export function scrollToAndHighlight(tabId: string): void {
    const li = document.querySelector<HTMLLIElement>(`li[data-tab-id="${tabId}"]`);
    if (!li) return;
    li.scrollIntoView({ block: "nearest", behavior: "smooth" });
    li.classList.add("new");
    setTimeout(() => li.classList.remove("new"), 2000);
}
