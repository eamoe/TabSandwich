import { strings } from "../strings";
import styles from "./Settings.module.css";

const PRIVACY_URL = "https://github.com/eamoe/TabSandwich/blob/main/PRIVACY.md";
const SOURCE_URL = "https://github.com/eamoe/TabSandwich";

/** The app's own icon in full color: the same three bars as the Store icon. */
function AppIcon() {
    return (
        <span class={styles.appIcon} aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24">
                <rect x="2" y="3.5" width="20" height="4.5" rx="1" fill="#6C63C5" />
                <rect x="2" y="9.75" width="20" height="4.5" rx="1" fill="#2DBEA6" />
                <rect x="2" y="16" width="20" height="4.5" rx="1" fill="#6C63C5" />
            </svg>
        </span>
    );
}

export function AboutTab() {
    return (
        <section class={styles.group} aria-label={strings.tabAbout}>
            <div class={styles.aboutTop}>
                <AppIcon />
                <div>
                    <p class={styles.label}>{strings.appName}</p>
                    <p class={styles.hint}>{strings.version(chrome.runtime.getManifest().version)}</p>
                </div>
            </div>
            <p class={styles.hint}>{strings.localPromise}</p>
            <p class={styles.hint}>
                <a class={styles.link} href={PRIVACY_URL} target="_blank" rel="noreferrer">
                    {strings.privacyPolicy}
                </a>
                {" · "}
                <a class={styles.link} href={SOURCE_URL} target="_blank" rel="noreferrer">
                    {strings.sourceCode}
                </a>
            </p>
        </section>
    );
}
