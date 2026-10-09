import { Fragment } from "preact";
import { Icon } from "../Icon";
import { strings } from "../strings";
import { SHORTCUTS_PAGE, useShortcut } from "../useShortcut";
import styles from "./EmptyStates.module.css";

/**
 * The list with nothing saved: the first thing a new user sees under the save card. Three tips,
 * each pointing at the real thing (the save card above, the shortcut, the categories), so a
 * new user can save, categorize and find a tab without having to discover Settings first.
 */
export function EmptyLibrary(props: { onEditCategories: () => void }) {
    const shortcut = useShortcut();
    return (
        <div class={styles.empty}>
            <img class={styles.icon} src="/images/icon-128.png" alt="" aria-hidden="true" />
            <h2 class={styles.title}>{strings.emptyTitle}</h2>
            <p class={styles.lead}>{strings.emptyLead}</p>
            <ul class={styles.tips} aria-label={strings.emptyTipsLabel}>
                <li class={styles.tip}>
                    <span class={styles.tipIcon} aria-hidden="true">
                        <Icon name="download" size={14} />
                    </span>
                    <span>{strings.tipSave}</span>
                </li>
                <li class={styles.tip}>
                    <span class={styles.tipIcon} aria-hidden="true">
                        <Icon name="keyboard" size={14} />
                    </span>
                    {shortcut === null ? null : shortcut ? (
                        <span>
                            {strings.tipShortcut}{" "}
                            {shortcut.split("+").map((key, i) => (
                                <Fragment key={key}>
                                    {i > 0 && "+"}
                                    <kbd class={styles.kbd}>{key}</kbd>
                                </Fragment>
                            ))}
                        </span>
                    ) : (
                        <span>
                            {strings.tipShortcutUnset}{" "}
                            <button type="button" class={styles.link} onClick={() => void chrome.tabs.create({ url: SHORTCUTS_PAGE })}>
                                {strings.setShortcut}
                            </button>
                        </span>
                    )}
                </li>
                <li class={styles.tip}>
                    <span class={styles.tipIcon} aria-hidden="true">
                        <Icon name="tag" size={14} />
                    </span>
                    <span>
                        {strings.tipCategories}{" "}
                        <button type="button" class={styles.link} onClick={props.onEditCategories}>
                            {strings.editCategories}
                        </button>
                    </span>
                </li>
            </ul>
        </div>
    );
}

/**
 * A search that found nothing: says what was searched for and how to widen it. When a filter
 * narrowed the search, one click searches everything instead. (Clearing the search is the ×
 * in the search box, right above.)
 */
/** All is empty because every saved tab is archived: not a first run, so no welcome, just the way back. */
export function AllArchived(props: { onShowArchive: () => void }) {
    return (
        <div class={`${styles.empty} ${styles.compact}`}>
            <span class={styles.searchIcon} aria-hidden="true">
                <Icon name="archive" size={18} />
            </span>
            <h2 class={styles.title}>{strings.allArchivedTitle}</h2>
            <p class={styles.lead}>{strings.allArchivedBody}</p>
            <button type="button" class={styles.action} onClick={props.onShowArchive}>
                {strings.showArchive}
            </button>
        </div>
    );
}

/**
 * A search that found nothing. Inside a filter it offers to search everything; when the archive
 * (left out of every view but its own) has a match, it offers to search there.
 */
export function NoMatches(props: { query: string; filterLabel: string | null; onSearchAll: () => void; onSearchArchive?: () => void }) {
    return (
        <div class={`${styles.empty} ${styles.compact}`}>
            <span class={styles.searchIcon} aria-hidden="true">
                <Icon name="search" size={18} />
            </span>
            <h2 class={styles.title}>{strings.noMatchesTitle(props.query)}</h2>
            {props.filterLabel ? (
                <>
                    <p class={styles.lead}>{strings.noMatchesInFilter(props.filterLabel)}</p>
                    <button type="button" class={styles.action} onClick={props.onSearchAll}>
                        {strings.searchAllTabs}
                    </button>
                </>
            ) : (
                <p class={styles.lead}>{strings.noMatchesHint}</p>
            )}
            {props.onSearchArchive && (
                <button type="button" class={styles.action} onClick={props.onSearchArchive}>
                    {strings.searchArchive}
                </button>
            )}
        </div>
    );
}

/** The note after an update: what's new in this release, dismissed for good with one click. */
export function WhatsNew(props: { release: string; onDismiss: () => void }) {
    const items = strings.whatsNewNotes[props.release] ?? [];
    return (
        <section class={styles.whatsNew} aria-labelledby="whats-new-title">
            <div class={styles.whatsNewHead}>
                <span class={styles.sparkle} aria-hidden="true">
                    <Icon name="sparkle" size={14} />
                </span>
                <h2 id="whats-new-title" class={styles.whatsNewTitle}>
                    {strings.whatsNewTitle(props.release)}
                </h2>
                <button type="button" class={styles.dismiss} aria-label={strings.dismissWhatsNew} title={strings.dismissWhatsNew} onClick={props.onDismiss}>
                    <Icon name="close" size={14} />
                </button>
            </div>
            <ul class={styles.whatsNewList}>
                {items.map((item) => (
                    <li key={item}>{item}</li>
                ))}
            </ul>
        </section>
    );
}
