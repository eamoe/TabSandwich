import type { ThemeChoice, ToolbarChoice } from "../../types";
import { setTheme, setToolbarOpens } from "../../domain/SettingsRepository";
import { LIBRARY_PAGE, openLibrary } from "../../util/openLibrary";
import { writeErrorMessage } from "../errors";
import { applyTheme } from "../theme";
import { showErrorToast } from "../toastStore";
import { strings } from "../strings";
import type { Library } from "../main/useLibrary";
import { SHORTCUTS_PAGE, useShortcut } from "../useShortcut";
import controls from "../controls.module.css";
import styles from "./Settings.module.css";

const STORAGE_WARNING_PCT = 80;

const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform);
/** The list's keys, named the way this computer's keyboard labels them. */
const LIST_KEYS: Array<{ keys: string[]; what: string }> = [
    { keys: ["/"], what: strings.keyHelp.search },
    { keys: ["↑", "↓"], what: strings.keyHelp.move },
    { keys: ["Enter"], what: strings.keyHelp.open },
    { keys: ["→", "←"], what: strings.keyHelp.window },
    { keys: ["E"], what: strings.keyHelp.edit },
    { keys: ["P"], what: strings.keyHelp.pin },
    { keys: [IS_MAC ? "⌫" : "Delete"], what: strings.keyHelp.delete },
    { keys: [IS_MAC ? "⌘" : "Ctrl", "Z"], what: strings.keyHelp.undo },
    { keys: [IS_MAC ? "⌥" : "Alt", "↑", "↓"], what: strings.keyHelp.reorder },
    { keys: ["Space"], what: strings.keyHelp.select },
    { keys: ["Esc"], what: strings.keyHelp.back },
];
const THEMES: Array<{ value: ThemeChoice; label: string }> = [
    { value: "light", label: strings.themeLight },
    { value: "dark", label: strings.themeDark },
    { value: "system", label: strings.themeSystem },
];

const TOOLBAR_CHOICES: Array<{ value: ToolbarChoice; label: string }> = [
    { value: "popup", label: strings.toolbarPopup },
    { value: "panel", label: strings.toolbarPanel },
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
    const shortcut = useShortcut();

    const chooseTheme = (theme: ThemeChoice) => {
        applyTheme(theme); // straight away; the write follows
        void attempt(() => setTheme(theme), reload);
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

            <section class={styles.group} aria-labelledby="toolbar-title">
                <h2 id="toolbar-title" class={styles.groupTitle}>
                    {strings.toolbarIcon}
                </h2>
                <div class={styles.segmented} role="group" aria-label={strings.toolbarGroup}>
                    {TOOLBAR_CHOICES.map((c) => (
                        <button
                            key={c.value}
                            type="button"
                            class={styles.tab}
                            aria-pressed={settings.toolbarOpens === c.value}
                            onClick={() => void attempt(() => setToolbarOpens(c.value), reload)}
                        >
                            {c.label}
                        </button>
                    ))}
                </div>
                <p class={styles.hint}>{strings.toolbarHint}</p>
            </section>

            <section class={styles.group} aria-label={strings.library} hidden={location.pathname === `/${LIBRARY_PAGE}`}>
                <div class={styles.row}>
                    <div>
                        <p class={styles.label}>{strings.library}</p>
                        <p class={styles.hint}>{strings.libraryHint}</p>
                    </div>
                    <button type="button" class={controls.btn} onClick={() => void openLibrary()}>
                        {strings.openLibrary}
                    </button>
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
                        <button type="button" class={controls.btn} onClick={() => void chrome.tabs.create({ url: SHORTCUTS_PAGE })}>
                            {strings.customize}
                        </button>
                    </div>
                </div>
                <dl class={styles.keys} aria-label={strings.keyboardKeys}>
                    {LIST_KEYS.map(({ keys, what }) => (
                        <div key={what} class={styles.keyRow}>
                            <dt class={styles.keyCombo}>
                                {keys.map((key) => (
                                    <kbd key={key} class={styles.kbdSmall}>
                                        {key}
                                    </kbd>
                                ))}
                            </dt>
                            <dd class={styles.keyWhat}>{what}</dd>
                        </div>
                    ))}
                </dl>
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
