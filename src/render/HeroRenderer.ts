import { SavedTab } from "../types";
import { getElement } from "../dom/domHelper";
import { getStorageUsage } from "../storage/chromeStorage";
import { addTab, AddTabResult } from "../domain/TabRepository";
import { getSelectableCategories, UNCATEGORIZED } from "../domain/CategoryRepository";
import { normalizeUrl, isSupportedTabUrl } from "../util/url";
import { scrollToAndHighlight } from "./ListRenderer";

type Refresh = () => void | Promise<void>;

let statusTimeout: number | undefined;

function setStatus(message: string, kind: "success" | "duplicate" | "error"): void {
    const statusEl = getElement<HTMLParagraphElement>("save-status");
    statusEl.textContent = message;
    statusEl.className = `save-status save-status-${kind}`;
    if (statusTimeout) window.clearTimeout(statusTimeout);
    statusTimeout = window.setTimeout(() => {
        statusEl.textContent = "";
        statusEl.className = "save-status";
    }, 2500);
}

/** Real usage against the real quota (FR-013) — no invented ceiling. */
export async function renderHeroStats(tabs: SavedTab[]): Promise<void> {
    getElement<HTMLElement>("header-stats").textContent = `${tabs.length} saved`;

    const { bytesInUse, quotaBytes } = await getStorageUsage();
    const pct = quotaBytes > 0 ? Math.min((bytesInUse / quotaBytes) * 100, 100) : 0;

    getElement<HTMLElement>("storage-usage").textContent = `${Math.round(pct)}% of storage used`;
    getElement<HTMLElement>("progress-fill").style.width = `${pct}%`;
    getElement<HTMLElement>("progress-bar").setAttribute("aria-valuenow", String(Math.round(pct)));
}

/** Shared by both save paths: always-visible acknowledgment here in the hero, plus scroll-to-highlight in the list — neither alone is enough (FR-003). */
async function handleSaveResult(result: AddTabResult, refresh: Refresh): Promise<void> {
    await refresh();
    setStatus(result.duplicate ? "Already saved" : "Saved!", result.duplicate ? "duplicate" : "success");
    scrollToAndHighlight(result.tab.id);
}

function bindSaveButton(refresh: Refresh): void {
    const saveBtn = getElement<HTMLButtonElement>("save-btn");
    saveBtn.addEventListener("click", async () => {
        saveBtn.disabled = true;
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab || !isSupportedTabUrl(tab.url)) {
                setStatus("This page can't be saved.", "error");
                return;
            }
            const title = tab.title?.trim() || tab.url;
            const result = await addTab({ title, url: tab.url, faviconUrl: tab.favIconUrl });
            await handleSaveResult(result, refresh);
        } finally {
            saveBtn.disabled = false;
        }
    });
}

/** Keeps the manual-entry category dropdown in sync with Settings each time it's opened. */
async function populateManualCategorySelect(select: HTMLSelectElement): Promise<void> {
    const current = select.value;
    const categories = (await getSelectableCategories()).filter((c) => c !== UNCATEGORIZED);

    select.innerHTML = "";
    const uncategorizedOpt = document.createElement("option");
    uncategorizedOpt.value = "";
    uncategorizedOpt.textContent = UNCATEGORIZED;
    select.appendChild(uncategorizedOpt);

    for (const cat of categories) {
        const opt = document.createElement("option");
        opt.value = cat;
        opt.textContent = cat;
        select.appendChild(opt);
    }
    select.value = categories.includes(current) ? current : "";
}

function bindManualEntryForm(refresh: Refresh): void {
    const details = getElement<HTMLDetailsElement>("manual-entry");
    const form = getElement<HTMLFormElement>("manual-entry-form");
    const urlInput = getElement<HTMLInputElement>("manual-url");
    const titleInput = getElement<HTMLInputElement>("manual-title");
    const categorySelect = getElement<HTMLSelectElement>("manual-category");

    details.addEventListener("toggle", () => {
        if (details.open) populateManualCategorySelect(categorySelect);
    });

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const normalized = normalizeUrl(urlInput.value);
        if (!normalized) {
            setStatus("Enter a valid URL.", "error");
            return;
        }

        const title = titleInput.value.trim() || new URL(normalized).hostname;
        const category = categorySelect.value || undefined;
        const result = await addTab({ title, url: normalized, category });
        await handleSaveResult(result, refresh);

        form.reset();
        details.open = false;
    });
}

export function initHero(refresh: Refresh): void {
    bindSaveButton(refresh);
    bindManualEntryForm(refresh);
}
