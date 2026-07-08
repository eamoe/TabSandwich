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

/** Rounds to a friendly magnitude rather than a false-precision exact count (e.g. 41,000 not 41,238). */
function roundedEstimate(n: number): string {
    if (n < 100) return Math.max(n, 0).toLocaleString();
    return (Math.round(n / 100) * 100).toLocaleString();
}

/**
 * Real usage against the real quota (FR-013) — no invented ceiling — but expressed in tabs,
 * not bytes or percent, since neither is a unit a regular user can judge ("is 24KB a lot?").
 * chrome.storage.local's quota is ~10MB, so a percentage rounds to a flat, broken-looking
 * "0%" for any realistic tab count. Instead we measure the real average size of a saved tab
 * from actual usage and estimate remaining capacity in the same unit the user already thinks
 * in — still grounded in real data, just translated into something meaningful.
 */
export async function renderHeroStats(tabs: SavedTab[]): Promise<void> {
    getElement<HTMLElement>("header-stats").textContent = `${tabs.length} saved`;

    const { bytesInUse, quotaBytes } = await getStorageUsage();
    const pct = quotaBytes > 0 ? Math.min((bytesInUse / quotaBytes) * 100, 100) : 0;

    const storageUsageEl = getElement<HTMLElement>("storage-usage");
    if (tabs.length === 0 || bytesInUse === 0) {
        storageUsageEl.textContent = "";
    } else {
        const avgBytesPerTab = bytesInUse / tabs.length;
        const remainingTabs = (quotaBytes - bytesInUse) / avgBytesPerTab;
        storageUsageEl.textContent = `room for ~${roundedEstimate(remainingTabs)} more at this rate`;
    }

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

/**
 * A manually-controlled disclosure rather than native <details>/<summary>: native details
 * can't animate its close transition at all (the browser just snaps display on/off). An
 * explicit Cancel button gives a clear third way to close it, alongside toggling the
 * trigger again or successfully submitting.
 */
function bindManualEntryForm(refresh: Refresh): void {
    const toggleBtn = getElement<HTMLButtonElement>("manual-entry-toggle");
    const collapse = getElement<HTMLElement>("manual-entry-collapse");
    const form = getElement<HTMLFormElement>("manual-entry-form");
    const cancelBtn = getElement<HTMLButtonElement>("manual-entry-cancel");
    const urlInput = getElement<HTMLInputElement>("manual-url");
    const titleInput = getElement<HTMLInputElement>("manual-title");
    const categorySelect = getElement<HTMLSelectElement>("manual-category");

    let isOpen = false;

    function setOpen(open: boolean): void {
        isOpen = open;
        toggleBtn.setAttribute("aria-expanded", String(open));
        collapse.inert = !open;
        if (open) {
            populateManualCategorySelect(categorySelect);
            collapse.style.maxHeight = `${collapse.scrollHeight}px`;
        } else {
            collapse.style.maxHeight = "0px";
        }
    }

    toggleBtn.addEventListener("click", () => setOpen(!isOpen));

    cancelBtn.addEventListener("click", () => {
        form.reset();
        setOpen(false);
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
        setOpen(false);
    });
}

export function initHero(refresh: Refresh): void {
    bindSaveButton(refresh);
    bindManualEntryForm(refresh);
}
