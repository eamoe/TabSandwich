import type { Ref } from "preact";
import { useLayoutEffect, useRef } from "preact/hooks";
import { Icon } from "../Icon";
import { Logo } from "../Logo";
import { strings } from "../strings";
import styles from "./Hero.module.css";

export function Header(props: {
    showSearch: boolean;
    query: string;
    tabCount: number;
    onQuery: (query: string) => void;
    onSubmitSearch: () => void;
    /** ↓ in the search box: into the list. */
    onArrowDown: () => void;
    manualOpen: boolean;
    onToggleManual: () => void;
    onOpenSettings: () => void;
    settingsButtonRef: Ref<HTMLButtonElement>;
    /** Counts new saves; each one makes the logo hop once (none before the first). */
    hops: number;
}) {
    const input = useRef<HTMLInputElement>(null);

    // Focus lands in search when the popup opens, so typing finds a tab straight away.
    useLayoutEffect(() => {
        if (props.showSearch) input.current?.focus();
    }, [props.showSearch]);

    const clear = () => {
        props.onQuery("");
        input.current?.focus();
    };

    return (
        <div class={styles.header}>
            {/* A new key per save remounts the mark, which restarts its animation. */}
            <span key={props.hops} class={props.hops ? `${styles.mark} ${styles.hop}` : styles.mark} aria-hidden="true" data-hops={props.hops}>
                <Logo />
            </span>
            {props.showSearch ? (
                <div class={styles.search} role="search">
                    <Icon name="search" size={14} />
                    <label for="search-input" class="visually-hidden">
                        {strings.searchLabel}
                    </label>
                    <input
                        ref={input}
                        id="search-input"
                        class={styles.searchInput}
                        type="text"
                        autoComplete="off"
                        placeholder={strings.searchPlaceholder(props.tabCount)}
                        value={props.query}
                        onInput={(e) => props.onQuery(e.currentTarget.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Escape") {
                                // With nothing to clear, Escape belongs to the browser: that's how the popup closes.
                                if (!props.query) return;
                                e.preventDefault();
                                clear();
                            } else if (e.key === "Enter") {
                                e.preventDefault();
                                props.onSubmitSearch();
                            } else if (e.key === "ArrowDown") {
                                e.preventDefault();
                                props.onArrowDown();
                            }
                        }}
                    />
                    {props.query && (
                        <button type="button" class={styles.clear} aria-label={strings.clearSearch} onClick={clear}>
                            <Icon name="close" size={14} />
                        </button>
                    )}
                </div>
            ) : (
                <span class={styles.spacer} />
            )}
            <button
                type="button"
                class={styles.heroBtn}
                aria-label={strings.addLinkManually}
                title={strings.addLinkManually}
                aria-expanded={props.manualOpen}
                onClick={props.onToggleManual}
            >
                <Icon name="plus" size={18} />
            </button>
            <button
                ref={props.settingsButtonRef}
                type="button"
                class={styles.heroBtn}
                aria-label={strings.openSettings}
                title={strings.settingsTooltip}
                onClick={props.onOpenSettings}
            >
                <Icon name="settings" size={17} />
            </button>
        </div>
    );
}
