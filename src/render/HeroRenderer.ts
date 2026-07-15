import { SavedTab } from "../types";
import { getElement } from "../dom/domHelper";
import { getStorageUsage } from "../storage/chromeStorage";
import { addTab, AddTabResult } from "../domain/TabRepository";
import { getSelectableCategories, UNCATEGORIZED } from "../domain/CategoryRepository";
import { normalizeUrl, isSupportedTabUrl } from "../util/url";
import { scrollToAndHighlight } from "./ListRenderer";

type Refresh = () => void | Promise<void>;

const DEFAULT_SAVE_LABEL = "Save Tab";
// Success has no color flash of its own — it's the expected, everyday outcome, so it only
// needs the text change. Duplicate/error are the surprising outcomes worth calling out with color.
const STATUS_COLOR_KINDS = ["save-btn-duplicate", "save-btn-error"];

let statusTimeout: number | undefined;

/**
 * Feedback lands directly on the Save button instead of a message line below it — a
 * below-the-button line reserves no space when empty, so its appearance and disappearance
 * shoved the rest of the popup up and down on every save. A visually-hidden live region still
 * announces the message for screen readers, since a button's text changing while it isn't
 * focused/hovered by assistive tech isn't reliably announced on its own.
 */
function setStatus(message: string, kind: "success" | "duplicate" | "error"): void {
    const saveBtn = getElement<HTMLButtonElement>("save-btn");
    const srStatus = getElement<HTMLElement>("save-status");

    if (statusTimeout) window.clearTimeout(statusTimeout);

    saveBtn.textContent = message;
    saveBtn.classList.remove(...STATUS_COLOR_KINDS);
    if (kind !== "success") saveBtn.classList.add(`save-btn-${kind}`);
    srStatus.textContent = message;

    statusTimeout = window.setTimeout(() => {
        saveBtn.textContent = DEFAULT_SAVE_LABEL;
        saveBtn.classList.remove(...STATUS_COLOR_KINDS);
        srStatus.textContent = "";
    }, 2500);
}

/**
 * Real usage against the real quota (FR-013) — no invented ceiling — reported directly as a
 * percentage of bytes used rather than translated into "~N more tabs at this rate." That
 * tabs-estimate divided remaining bytes by the *average* bytes-per-tab so far, which made it
 * swing in the wrong direction whenever a newly saved tab happened to be smaller than average
 * (more room turned into a bigger "N", even though you'd just used more storage, not less) —
 * confusing for something that reads like a literal, decrement-by-one countdown. A percentage
 * has no such trap: it only ever tracks bytes actually used, in either direction. Below 1% it's
 * shown as "<1%" rather than rounding to a flat, broken-looking "0%".
 */
export async function renderHeroStats(tabs: SavedTab[]): Promise<void> {
    getElement<HTMLElement>("header-stats").textContent = `${tabs.length} saved`;

    const { bytesInUse, quotaBytes } = await getStorageUsage();
    const pct = quotaBytes > 0 ? Math.min((bytesInUse / quotaBytes) * 100, 100) : 0;

    const storageUsageEl = getElement<HTMLElement>("storage-usage");
    if (tabs.length === 0 || bytesInUse === 0) {
        storageUsageEl.textContent = "";
    } else {
        const pctLabel = pct < 1 ? "<1%" : `${Math.round(pct)}%`;
        storageUsageEl.textContent = `${pctLabel} of storage used`;
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
                setStatus("Only web pages can be saved", "error");
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
            setStatus("Enter a valid URL", "error");
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
