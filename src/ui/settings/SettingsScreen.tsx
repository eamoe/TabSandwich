import { useLayoutEffect, useRef, useState } from "preact/hooks";
import { Icon } from "../Icon";
import { heightWithoutToastSpace, ToastSpace } from "../Toast";
import { strings } from "../strings";
import type { Library } from "../main/useLibrary";
import { GeneralTab } from "./GeneralTab";
import { CategoriesTab } from "./CategoriesTab";
import { BackupTab } from "./BackupTab";
import { AboutTab } from "./AboutTab";
import styles from "./Settings.module.css";

const TABS = [
    { key: "general", label: strings.tabGeneral },
    { key: "categories", label: strings.tabCategories },
    { key: "backup", label: strings.tabBackup },
    { key: "about", label: strings.tabAbout },
] as const;

export type SettingsTabKey = (typeof TABS)[number]["key"];

/**
 * Settings, grouped into four tabs. Opening it moves focus to Back (the main screen moves it
 * back to the settings button on the way out), so keyboard users never sit on a control that
 * just disappeared. The tabs follow the standard pattern: arrow keys move between them.
 */
export function SettingsScreen(props: {
    library: Library;
    reload: () => Promise<void>;
    onBack: () => void;
    /** The tab to open on (General unless a shortcut elsewhere asked for another). */
    initialTab?: SettingsTabKey;
    /** At least this tall (see App: the popup never shrinks while open). */
    minHeight: number;
    /** Reports this screen's height after each tab switch, so the floor can rise to the tallest tab. */
    onHeight: (height: number) => void;
}) {
    const [tab, setTab] = useState<SettingsTabKey>(props.initialTab ?? "general");
    const backButton = useRef<HTMLButtonElement>(null);
    const screen = useRef<HTMLElement>(null);
    const tabButtons = useRef<Record<string, HTMLButtonElement | null>>({});
    useLayoutEffect(() => backButton.current?.focus(), []);
    useLayoutEffect(() => {
        if (screen.current) props.onHeight(heightWithoutToastSpace(screen.current));
    }, [tab]);

    const moveTab = (from: SettingsTabKey, step: number | "first" | "last") => {
        const index = TABS.findIndex((t) => t.key === from);
        const next =
            step === "first" ? TABS[0] : step === "last" ? TABS[TABS.length - 1] : TABS[(index + step + TABS.length) % TABS.length];
        setTab(next.key);
        tabButtons.current[next.key]?.focus();
    };

    return (
        <main ref={screen} class={styles.settings} style={{ minHeight: props.minHeight ? `${props.minHeight}px` : undefined }} aria-label={strings.settingsTitle}>
            <div class={styles.header}>
                <button ref={backButton} type="button" class={styles.back} onClick={props.onBack}>
                    <Icon name="chevronLeft" size={16} />
                    {strings.back}
                </button>
                <h1 class={styles.title}>{strings.settingsTitle}</h1>
            </div>
            <div class={styles.tabs} role="tablist" aria-label={strings.settingsSections}>
                {TABS.map((t) => (
                    <button
                        key={t.key}
                        ref={(el) => {
                            tabButtons.current[t.key] = el;
                        }}
                        id={`settings-tab-${t.key}`}
                        type="button"
                        role="tab"
                        class={styles.tab}
                        aria-selected={tab === t.key}
                        aria-controls="settings-panel"
                        tabIndex={tab === t.key ? 0 : -1}
                        onClick={() => setTab(t.key)}
                        onKeyDown={(e) => {
                            const step = { ArrowRight: 1, ArrowLeft: -1, Home: "first", End: "last" }[e.key] as number | "first" | "last" | undefined;
                            if (step === undefined) return;
                            e.preventDefault();
                            moveTab(t.key, step);
                        }}
                    >
                        {t.label}
                    </button>
                ))}
            </div>
            <div class={styles.body} id="settings-panel" role="tabpanel" aria-labelledby={`settings-tab-${tab}`}>
                {tab === "general" && <GeneralTab library={props.library} reload={props.reload} />}
                {tab === "categories" && <CategoriesTab library={props.library} reload={props.reload} />}
                {tab === "backup" && <BackupTab reload={props.reload} />}
                {tab === "about" && <AboutTab />}
            </div>
            <ToastSpace />
        </main>
    );
}
