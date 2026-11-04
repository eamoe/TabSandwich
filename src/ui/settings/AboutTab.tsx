import { feedbackUrl } from "../../util/feedback";
import { uiLanguage } from "../i18n";
import { Slotted } from "../Slotted";
import { strings } from "../strings";
import styles from "./Settings.module.css";

const PRIVACY_URL = "https://github.com/eamoe/TabSandwich/blob/main/PRIVACY.md";
const SOURCE_URL = "https://github.com/eamoe/TabSandwich";

/** The app's own icon in full color: the shipped Store icon, so the two can never drift apart. */
function AppIcon() {
    return <img class={styles.appIcon} src="/images/icon-128.png" alt="" aria-hidden="true" />;
}

export function AboutTab() {
    const version = chrome.runtime.getManifest().version;
    return (
        <section class={styles.group} aria-label={strings.tabAbout}>
            <div class={styles.aboutTop}>
                <AppIcon />
                <div>
                    <p class={styles.label}>{strings.appName}</p>
                    <p class={styles.hint}>{strings.version(version)}</p>
                </div>
            </div>
            <p class={styles.hint}>{strings.localPromise}</p>
            {/* With no translators of its own, the app asks the people who read it in their language. */}
            <p class={styles.hint}>
                <Slotted sentence={strings.feedbackAsk}>
                    <a class={styles.link} href={feedbackUrl(uiLanguage(), version)} title={strings.feedbackTooltip} target="_blank" rel="noreferrer">
                        {strings.feedbackLink}
                    </a>
                </Slotted>
            </p>
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
