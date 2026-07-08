import { SavedTab } from "../types";
import { getElement } from "../dom/domHelper";
import { getTabCategory } from "../domain/CategoryRepository";
import { normalizeUrl } from "../util/url";

export interface ListCallbacks {
    onCategoryChange: (tabId: string, category: string) => void | Promise<void>;
    onEdit: (tabId: string, updates: { title: string; url: string; category: string }) => void | Promise<void>;
    onDelete: (tabId: string) => void | Promise<void>;
}

const EDIT_ICON = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
const DELETE_ICON = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`;

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

function renderDisplayRow(li: HTMLLIElement, tab: SavedTab, categories: string[], callbacks: ListCallbacks): void {
    li.innerHTML = "";
    li.classList.remove("editing");
    li.appendChild(createFavicon(tab));

    const titleBtn = document.createElement("button");
    titleBtn.type = "button";
    titleBtn.className = "tab-title";
    titleBtn.textContent = tab.title;
    titleBtn.addEventListener("click", () => chrome.tabs.create({ url: tab.url }));
    li.appendChild(titleBtn);

    const catSelect = createCategorySelect(tab, categories, `Category for ${tab.title}`);
    catSelect.addEventListener("change", () => callbacks.onCategoryChange(tab.id, catSelect.value));
    li.appendChild(catSelect);

    const actions = document.createElement("div");
    actions.className = "row-actions";

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "icon-btn";
    editBtn.setAttribute("aria-label", `Edit ${tab.title}`);
    editBtn.innerHTML = EDIT_ICON;
    editBtn.addEventListener("click", () => renderEditRow(li, tab, categories, callbacks));
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

function renderEditRow(li: HTMLLIElement, tab: SavedTab, categories: string[], callbacks: ListCallbacks): void {
    li.innerHTML = "";
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
        callbacks.onEdit(tab.id, { title, url: normalized, category: catSelect.value });
    });
    actionsRow.appendChild(saveBtn);

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "edit-cancel";
    cancelBtn.textContent = "Cancel";
    cancelBtn.addEventListener("click", () => renderDisplayRow(li, tab, categories, callbacks));
    actionsRow.appendChild(cancelBtn);

    li.appendChild(actionsRow);
    titleInput.focus();
    titleInput.select();
}

export function renderList(tabs: SavedTab[], categories: string[], callbacks: ListCallbacks): void {
    const list = getElement<HTMLUListElement>("tab-list");
    list.innerHTML = "";

    if (tabs.length === 0) {
        const li = document.createElement("li");
        li.className = "empty";
        li.textContent = "No saved tabs yet.";
        list.appendChild(li);
        return;
    }

    for (const tab of tabs) {
        const li = document.createElement("li");
        li.dataset.tabId = tab.id;
        renderDisplayRow(li, tab, categories, callbacks);
        list.appendChild(li);
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
