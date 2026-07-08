import { SavedTab } from "../types";
import { getElement } from "../dom/domHelper";
import { getTabs, getStorageUsage } from "../storage/chromeStorage";
import { addTab, AddTabResult } from "../domain/TabRepository";
import { normalizeUrl, isSupportedTabUrl } from "../util/url";
import { renderList, scrollToAndHighlight } from "./ListRenderer";

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

async function refresh(): Promise<void> {
    const tabs = await getTabs();
    renderList(tabs);
    await renderHeroStats(tabs);
}

/** Shared by both save paths: always-visible acknowledgment here in the hero, plus scroll-to-highlight in the list — neither alone is enough (FR-003). */
async function handleSaveResult(result: AddTabResult): Promise<void> {
    await refresh();
    setStatus(result.duplicate ? "Already saved" : "Saved!", result.duplicate ? "duplicate" : "success");
    scrollToAndHighlight(result.tab.id);
}

function bindSaveButton(): void {
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
            await handleSaveResult(result);
        } finally {
            saveBtn.disabled = false;
        }
    });
}

function bindManualEntryForm(): void {
    const details = getElement<HTMLDetailsElement>("manual-entry");
    const form = getElement<HTMLFormElement>("manual-entry-form");
    const urlInput = getElement<HTMLInputElement>("manual-url");
    const titleInput = getElement<HTMLInputElement>("manual-title");
    const categorySelect = getElement<HTMLSelectElement>("manual-category");

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
        await handleSaveResult(result);

        form.reset();
        details.open = false;
    });
}

export function initHero(): void {
    bindSaveButton();
    bindManualEntryForm();
}
