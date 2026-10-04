import { useEffect, useState } from "preact/hooks";
import type { ThemeChoice } from "../../types";
import { clampOutdatedDays, MAX_OUTDATED_DAYS, MIN_OUTDATED_DAYS, setOutdatedDays, setOutdatedEnabled, setTheme } from "../../domain/SettingsRepository";
import { writeErrorMessage } from "../errors";
import { applyTheme } from "../theme";
import { showErrorToast } from "../toastStore";
import { strings } from "../strings";
import type { Library } from "../main/useLibrary";
import controls from "../controls.module.css";
import styles from "./Settings.module.css";

const STORAGE_WARNING_PCT = 80;
const THEMES: Array<{ value: ThemeChoice; label: string }> = [
    { value: "light", label: strings.themeLight },
    { value: "dark", label: strings.themeDark },
    { value: "system", label: strings.themeSystem },
];

/** Runs a settings write; on failure says why and reloads, which puts every control back to what's actually stored. */
async function attempt(write: () => Promise<void>, reload: () => Promise<void>): Promise<void> {
    try {
        await write();
    } catch (err) {
        showErrorToast(writeErrorMessage(err));
    }
    await reload();
}

export function GeneralTab({ library, reload }: { library: Library; reload: () => Promise<void> }) {
    const { settings } = library;
    const [days, setDays] = useState(String(settings.outdatedDays));
    const [shortcut, setShortcut] = useState<string | null>(null);
    // Every load resets the field to what's stored, so a change that failed to save doesn't linger.
    useEffect(() => setDays(String(library.settings.outdatedDays)), [library]);
    useEffect(() => {
        chrome.commands.getAll((commands) => {
            setShortcut(commands.find((c) => c.name === "_execute_action")?.shortcut || "");
        });
    }, []);

    const chooseTheme = (theme: ThemeChoice) => {
        applyTheme(theme); // straight away; the write follows
        void attempt(() => setTheme(theme), reload);
    };

    const commitDays = () => {
        const clamped = clampOutdatedDays(days);
        setDays(String(clamped));
        if (clamped !== settings.outdatedDays) void attempt(() => setOutdatedDays(clamped), reload);
    };

    const nearlyFull = library.storagePct >= STORAGE_WARNING_PCT;
    return (
        <>
            <section class={styles.group} aria-labelledby="appearance-title">
                <h2 id="appearance-title" class={styles.groupTitle}>
                    {strings.appearance}
                </h2>
                <div class={styles.segmented} role="group" aria-label={strings.themeGroup}>
                    {THEMES.map((t) => (
                        <button key={t.value} type="button" class={styles.tab} aria-pressed={settings.theme === t.value} onClick={() => chooseTheme(t.value)}>
                            {t.label}
                        </button>
                    ))}
                </div>
                <p class={styles.hint}>{strings.themeHint}</p>
            </section>

            <section class={styles.group} aria-label={strings.outdatedTabs}>
                <div class={styles.row}>
                    <div>
                        <label for="outdated-toggle" class={styles.label}>
                            {strings.outdatedTabs}
                        </label>
                        <p class={styles.hint}>{strings.outdatedHint}</p>
                    </div>
                    <label class={styles.switch}>
                        <input
                            id="outdated-toggle"
                            type="checkbox"
                            role="switch"
                            class="visually-hidden"
                            checked={settings.outdatedEnabled}
                            onChange={(e) => void attempt(() => setOutdatedEnabled(e.currentTarget.checked), reload)}
                        />
                        <span class={styles.track}>
                            <span class={styles.thumb} />
                        </span>
                    </label>
                </div>
                <div class={settings.outdatedEnabled ? styles.days : `${styles.days} ${styles.off}`}>
                    <label for="outdated-days">{strings.markOutdatedAfter}</label>
                    <input
                        id="outdated-days"
                        class={controls.field}
                        type="number"
                        min={MIN_OUTDATED_DAYS}
                        max={MAX_OUTDATED_DAYS}
                        value={days}
                        disabled={!settings.outdatedEnabled}
                        onInput={(e) => setDays(e.currentTarget.value)}
                        onChange={commitDays}
                    />
                    <span>{strings.days}</span>
                </div>
            </section>

            <section class={styles.group} aria-label={strings.keyboardShortcut}>
                <div class={styles.row}>
                    <span class={styles.label} id="shortcut-label">
                        {strings.keyboardShortcut}
                    </span>
                    <div class={styles.shortcut} aria-labelledby="shortcut-label">
                        {shortcut === null ? null : shortcut ? (
                            shortcut.split("+").map((key) => (
                                <kbd key={key} class={styles.kbd}>
                                    {key}
                                </kbd>
                            ))
                        ) : (
                            <span class={styles.hint}>{strings.shortcutNotSet}</span>
                        )}
                        <button type="button" class={controls.btn} onClick={() => void chrome.tabs.create({ url: "chrome://extensions/shortcuts" })}>
                            {strings.customize}
                        </button>
                    </div>
                </div>
            </section>

            <section class={styles.group} aria-labelledby="storage-title">
                <h2 id="storage-title" class={styles.groupTitle}>
                    {strings.storage}
                </h2>
                <div
                    class={styles.meter}
                    role="progressbar"
                    aria-label={strings.storageUsed}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(library.storagePct)}
                >
                    <span class={nearlyFull ? `${styles.fill} ${styles.hot}` : styles.fill} style={{ width: `${library.storagePct}%` }} />
                </div>
                <p class={styles.hint}>
                    {strings.storageSummary(library.tabs.length, library.storagePct)}
                    {nearlyFull ? `. ${strings.storageAdvice}` : ""}
                </p>
            </section>
        </>
    );
}
