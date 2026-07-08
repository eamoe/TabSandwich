import { SavedTab } from "../types";
import { getElement } from "../dom/domHelper";

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

export function renderList(tabs: SavedTab[]): void {
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

        li.appendChild(createFavicon(tab));

        const titleBtn = document.createElement("button");
        titleBtn.type = "button";
        titleBtn.className = "tab-title";
        titleBtn.textContent = tab.title;
        titleBtn.addEventListener("click", () => {
            chrome.tabs.create({ url: tab.url });
        });
        li.appendChild(titleBtn);

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
