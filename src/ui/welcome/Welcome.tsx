import { Fragment } from "preact";
import controls from "../controls.module.css";
import { Icon } from "../Icon";
import { Slotted } from "../Slotted";
import { Logo } from "../Logo";
import { strings } from "../strings";
import { SHORTCUTS_PAGE, useShortcut } from "../useShortcut";
import styles from "./Welcome.module.css";

/** The one page a new user sees after installing, opened once by the background worker (src/worker/install.ts). */
export function Welcome() {
    const shortcut = useShortcut();
    return (
        <main class={styles.page}>
            <article class={styles.card}>
                <header class={styles.hero}>
                    <span class={styles.mark}>
                        <Logo />
                    </span>
                    <h1 class={styles.title}>{strings.welcomeTitle}</h1>
                </header>
                <div class={styles.body}>
                    <p class={styles.lead}>{strings.welcomeLead}</p>
                    <ul class={styles.steps}>
                        <li class={styles.step}>
                            <span class={styles.stepIcon} aria-hidden="true">
                                <Icon name="pin" size={16} />
                            </span>
                            <div>
                                <h2 class={styles.stepTitle}>{strings.welcomePinTitle}</h2>
                                <p class={styles.stepText}>{strings.welcomePinText}</p>
                            </div>
                        </li>
                        <li class={styles.step}>
                            <span class={styles.stepIcon} aria-hidden="true">
                                <Icon name="download" size={16} />
                            </span>
                            <div>
                                <h2 class={styles.stepTitle}>{strings.welcomeSaveTitle}</h2>
                                <p class={styles.stepText}>{strings.welcomeSaveText}</p>
                            </div>
                        </li>
                        <li class={styles.step}>
                            <span class={styles.stepIcon} aria-hidden="true">
                                <Icon name="keyboard" size={16} />
                            </span>
                            <div>
                                <h2 class={styles.stepTitle}>{strings.welcomeShortcutTitle}</h2>
                                {shortcut === null ? null : shortcut ? (
                                    <p class={styles.stepText}>
                                        <Slotted sentence={strings.welcomeShortcutText}>
                                            {shortcut.split("+").map((key, i) => (
                                                <Fragment key={key}>
                                                    {i > 0 && "+"}
                                                    <kbd class={styles.kbd}>{key}</kbd>
                                                </Fragment>
                                            ))}
                                        </Slotted>
                                    </p>
                                ) : (
                                    <p class={styles.stepText}>
                                        <button type="button" class={styles.link} onClick={() => void chrome.tabs.create({ url: SHORTCUTS_PAGE })}>
                                            {strings.setShortcut}
                                        </button>
                                    </p>
                                )}
                                <p class={styles.stepText}>
                                    <Slotted sentence={strings.welcomeSearch}>
                                        <kbd class={styles.kbd}>ts</kbd>
                                    </Slotted>
                                </p>
                            </div>
                        </li>
                    </ul>
                    <footer class={styles.footer}>
                        <p class={styles.promise}>{strings.welcomePromise}</p>
                        <button type="button" class={`${controls.btn} ${controls.primary}`} onClick={() => window.close()}>
                            {strings.welcomeDone}
                        </button>
                    </footer>
                </div>
            </article>
        </main>
    );
}
