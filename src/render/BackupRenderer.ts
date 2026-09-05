import { getTabs, getSettings, setTabs, setSettings } from "../storage/chromeStorage";
import { withStorageLock } from "../storage/writeQueue";
import { getElement } from "../dom/domHelper";
import { showUndoToast, showErrorToast } from "./ToastRenderer";
import { writeErrorMessage } from "../util/errors";
import { buildBackupFile, backupFileName, parseBackupFile, mergeImport, replaceImport, ParsedImport } from "../domain/backup";

type Refresh = () => void | Promise<void>;

const STATUS_CLEAR_MS = 4000;
let statusTimeout: number | undefined;

function plural(n: number, noun: string): string {
    return `${n} ${noun}${n === 1 ? "" : "s"}`;
}

function pluralCategory(n: number): string {
    return `${n} categor${n === 1 ? "y" : "ies"}`;
}

function setStatus(message: string, isError = false): void {
    const status = getElement<HTMLElement>("backup-status");
    window.clearTimeout(statusTimeout);
    status.textContent = message;
    status.classList.toggle("backup-status--error", isError);
    if (message) {
        statusTimeout = window.setTimeout(() => {
            status.textContent = "";
            status.classList.remove("backup-status--error");
        }, STATUS_CLEAR_MS);
    }
}

/** No `downloads` permission needed or requested — a plain anchor download does this entirely client-side. */
async function exportBackup(): Promise<void> {
    const [tabs, settings] = await Promise.all([getTabs(), getSettings()]);
    const file = buildBackupFile(tabs, settings);
    const blob = new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = backupFileName();
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setStatus(`Exported ${plural(tabs.length, "tab")}.`);
}

/**
 * Swaps the Export/Import buttons for an inline Merge/Replace/Cancel choice rather than a
 * blocking window.confirm() — this app has no other native dialogs, and both destructive
 * paths here are undoable via the same toast S02 already introduced, which a blocking
 * confirm() can't offer.
 */
function showImportConfirm(parsed: ParsedImport, refresh: Refresh): void {
    const actions = getElement<HTMLElement>("backup-actions");
    const confirm = getElement<HTMLElement>("backup-confirm");
    const message = getElement<HTMLElement>("backup-confirm-message");
    const mergeBtn = getElement<HTMLButtonElement>("backup-merge-btn");
    const replaceBtn = getElement<HTMLButtonElement>("backup-replace-btn");
    const cancelBtn = getElement<HTMLButtonElement>("backup-cancel-btn");

    message.textContent = `This file contains ${plural(parsed.tabs.length, "tab")}. Merge adds anything new; Replace overwrites everything currently saved.`;
    actions.hidden = true;
    confirm.hidden = false;

    const close = () => {
        confirm.hidden = true;
        actions.hidden = false;
    };

    // Reassigned (not addEventListener'd) each time a file is confirmed, so re-importing
    // within the same popup session never stacks a second handler onto these buttons.
    mergeBtn.onclick = async () => {
        close();
        try {
            // The read (what's currently saved), the merge decision built from it, and the
            // write all need to happen as one uninterrupted unit — otherwise a tab add/delete
            // landing in between would read stale, and this write would silently erase it.
            const outcome = await withStorageLock(async () => {
                const [prevTabs, prevSettings] = await Promise.all([getTabs(), getSettings()]);
                const result = mergeImport(prevTabs, prevSettings, parsed);
                // Checked on both counts, not just addedCount: a merge can restore a category
                // with zero new tabs to show for it (every tab that used it locally is already
                // gone), and skipping the write here would silently drop that category.
                if (result.addedCount === 0 && result.addedCategoryCount === 0) return null;
                await setTabs(result.tabs);
                await setSettings(result.settings);
                return { result, prevTabs, prevSettings };
            });
            if (!outcome) {
                setStatus("Nothing new — everything in this file is already saved.");
                return;
            }
            await refresh();

            const { result, prevTabs, prevSettings } = outcome;
            const parts: string[] = [];
            if (result.addedCount > 0) parts.push(plural(result.addedCount, "tab"));
            if (result.addedCategoryCount > 0) parts.push(pluralCategory(result.addedCategoryCount));
            showUndoToast(`Imported ${parts.join(" and ")}`, async () => {
                try {
                    await withStorageLock(async () => {
                        await setTabs(prevTabs);
                        await setSettings(prevSettings);
                    });
                } catch (err) {
                    showErrorToast(writeErrorMessage(err));
                }
                await refresh();
            });
        } catch (err) {
            setStatus(writeErrorMessage(err), true);
            await refresh();
        }
    };

    replaceBtn.onclick = async () => {
        close();
        try {
            const { result, prevTabs, prevSettings } = await withStorageLock(async () => {
                const [prevTabs, prevSettings] = await Promise.all([getTabs(), getSettings()]);
                const result = replaceImport(parsed);
                await setTabs(result.tabs);
                await setSettings(result.settings);
                return { result, prevTabs, prevSettings };
            });
            await refresh();
            showUndoToast("Replaced all tabs and settings", async () => {
                try {
                    await withStorageLock(async () => {
                        await setTabs(prevTabs);
                        await setSettings(prevSettings);
                    });
                } catch (err) {
                    showErrorToast(writeErrorMessage(err));
                }
                await refresh();
            });
        } catch (err) {
            setStatus(writeErrorMessage(err), true);
            await refresh();
        }
    };

    cancelBtn.onclick = () => close();
}

function bindImport(refresh: Refresh): void {
    const importBtn = getElement<HTMLButtonElement>("import-btn");
    const fileInput = getElement<HTMLInputElement>("import-file-input");

    importBtn.addEventListener("click", () => fileInput.click());

    fileInput.addEventListener("change", async () => {
        const file = fileInput.files?.[0];
        fileInput.value = ""; // allow re-selecting the same file again later
        if (!file) return;

        const text = await file.text();
        const parsed = parseBackupFile(text);
        if (!parsed) {
            setStatus("That file doesn't look like a Tab Sandwich backup.", true);
            return;
        }
        showImportConfirm(parsed, refresh);
    });
}

export function initBackup(refresh: Refresh): void {
    getElement<HTMLButtonElement>("export-btn").addEventListener("click", () => {
        exportBackup();
    });
    bindImport(refresh);
}
