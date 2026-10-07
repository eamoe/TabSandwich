import { useEffect, useRef, useState } from "preact/hooks";
import { getGroups, getSettings, getTabs } from "../../storage/chromeStorage";
import { backupFileName, buildBackupFile, parseBackupFile, type ParsedImport } from "../../domain/backup";
import { importMerge, importReplace, restoreSnapshot, type Snapshot } from "../../domain/BackupRepository";
import { writeErrorMessage } from "../errors";
import { showErrorToast, showUndoToast } from "../toastStore";
import { strings } from "../strings";
import controls from "../controls.module.css";
import styles from "./Settings.module.css";

const STATUS_MS = 4000;

/** A plain link download: no `downloads` permission needed, nothing leaves the device. */
async function downloadBackup(): Promise<number> {
    const [tabs, settings, groups] = await Promise.all([getTabs(), getSettings(), getGroups()]);
    const blob = new Blob([JSON.stringify(buildBackupFile(tabs, settings, groups), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = backupFileName();
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return tabs.length;
}

/**
 * Export, and import with an inline Merge / Replace all / Cancel choice instead of a blocking
 * dialog — both imports can be undone from the toast, which a native confirm() couldn't offer.
 */
export function BackupTab({ reload }: { reload: () => Promise<void> }) {
    const [pending, setPending] = useState<ParsedImport | null>(null);
    const [status, setStatus] = useState<{ text: string; error: boolean } | null>(null);
    const fileInput = useRef<HTMLInputElement>(null);
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    useEffect(() => () => clearTimeout(timer.current), []);

    const say = (text: string, error = false) => {
        clearTimeout(timer.current);
        setStatus({ text, error });
        timer.current = setTimeout(() => setStatus(null), STATUS_MS);
    };

    const offerUndo = (message: string, before: Snapshot) =>
        showUndoToast(message, async () => {
            try {
                await restoreSnapshot(before);
            } catch (err) {
                showErrorToast(writeErrorMessage(err));
            }
            await reload();
        });

    const merge = async (parsed: ParsedImport) => {
        setPending(null);
        try {
            const outcome = await importMerge(parsed);
            if (!outcome) {
                say(strings.nothingNew);
                return;
            }
            await reload();
            offerUndo(strings.imported(outcome.result.addedCount, outcome.result.addedCategoryCount), outcome.before);
        } catch (err) {
            say(writeErrorMessage(err), true);
            await reload();
        }
    };

    const replace = async (parsed: ParsedImport) => {
        setPending(null);
        try {
            const outcome = await importReplace(parsed);
            await reload();
            offerUndo(strings.replacedAll, outcome.before);
        } catch (err) {
            say(writeErrorMessage(err), true);
            await reload();
        }
    };

    const onFile = async (input: HTMLInputElement) => {
        const file = input.files?.[0];
        input.value = ""; // so choosing the same file again still works
        if (!file) return;
        const parsed = parseBackupFile(await file.text());
        if (!parsed) {
            say(strings.notABackup, true);
            return;
        }
        setStatus(null);
        setPending(parsed);
    };

    return (
        <section class={styles.group} aria-labelledby="backup-title">
            <h2 id="backup-title" class={styles.groupTitle}>
                {strings.backupTitle}
            </h2>
            <p class={styles.hint}>{strings.backupHint}</p>
            {pending ? (
                <div class={styles.confirm}>
                    <p>{strings.fileContains(pending.tabs.length)}</p>
                    <div class={styles.buttons}>
                        <button type="button" class={`${controls.btn} ${controls.primary}`} onClick={() => void merge(pending)}>
                            {strings.merge}
                        </button>
                        <button type="button" class={`${controls.btn} ${styles.dangerButton}`} onClick={() => void replace(pending)}>
                            {strings.replaceAll}
                        </button>
                        <button type="button" class={controls.btn} onClick={() => setPending(null)}>
                            {strings.cancel}
                        </button>
                    </div>
                </div>
            ) : (
                <div class={styles.buttons}>
                    <button type="button" class={controls.btn} onClick={() => void downloadBackup().then((n) => say(strings.exported(n)))}>
                        {strings.exportBackup}
                    </button>
                    <button type="button" class={controls.btn} onClick={() => fileInput.current?.click()}>
                        {strings.importBackup}
                    </button>
                </div>
            )}
            <label for="import-file-input" class="visually-hidden">
                {strings.chooseBackupFile}
            </label>
            <input
                ref={fileInput}
                id="import-file-input"
                type="file"
                accept="application/json"
                class="visually-hidden"
                onChange={(e) => void onFile(e.currentTarget)}
            />
            <p class={status?.error ? `${styles.status} ${styles.statusError}` : styles.status} role="status" aria-live="polite">
                {status?.text ?? ""}
            </p>
        </section>
    );
}
