import type { JSX } from "preact";
import styles from "./Icon.module.css";

/**
 * The icon set of the v3.0 look, drawn as strokes in the current text color so every icon
 * follows its button's color (and theme) automatically. Always decorative: the control that
 * holds an icon carries the accessible name, so the svg is hidden from screen readers.
 */
const PATHS: Record<IconName, JSX.Element> = {
    search: (
        <>
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </>
    ),
    sort: (
        <>
            <line x1="7" y1="5" x2="7" y2="19" />
            <polyline points="3.5 8.5 7 5 10.5 8.5" />
            <line x1="17" y1="5" x2="17" y2="19" />
            <polyline points="13.5 15.5 17 19 20.5 15.5" />
        </>
    ),
    download: (
        <>
            <line x1="12" y1="4" x2="12" y2="15" />
            <polyline points="7 10.5 12 15.5 17 10.5" />
            <line x1="5" y1="20" x2="19" y2="20" />
        </>
    ),
    keyboard: (
        <>
            <rect x="2.5" y="6" width="19" height="12" rx="2.5" />
            <line x1="6.5" y1="10" x2="7.5" y2="10" />
            <line x1="11.5" y1="10" x2="12.5" y2="10" />
            <line x1="16.5" y1="10" x2="17.5" y2="10" />
            <line x1="8" y1="14.5" x2="16" y2="14.5" />
        </>
    ),
    tag: (
        <>
            <path d="M3.5 12.3V4.5a1 1 0 0 1 1-1h7.8l8.2 8.2a1.4 1.4 0 0 1 0 2l-6.8 6.8a1.4 1.4 0 0 1-2 0z" />
            <circle cx="8.5" cy="8.5" r="1.3" />
        </>
    ),
    sparkle: (
        <>
            <path d="M12 3.5l1.9 5.1a2 2 0 0 0 1.2 1.2l5.1 1.9-5.1 1.9a2 2 0 0 0-1.2 1.2L12 20l-1.9-5.2a2 2 0 0 0-1.2-1.2L3.8 11.7l5.1-1.9a2 2 0 0 0 1.2-1.2z" />
        </>
    ),
    plus: (
        <>
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
        </>
    ),
    close: (
        <>
            <line x1="6" y1="6" x2="18" y2="18" />
            <line x1="18" y1="6" x2="6" y2="18" />
        </>
    ),
    settings: (
        <>
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </>
    ),
    edit: (
        <>
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
        </>
    ),
    trash: (
        <>
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </>
    ),
    grip: (
        <>
            <circle cx="9" cy="6" r="1" />
            <circle cx="15" cy="6" r="1" />
            <circle cx="9" cy="12" r="1" />
            <circle cx="15" cy="12" r="1" />
            <circle cx="9" cy="18" r="1" />
            <circle cx="15" cy="18" r="1" />
        </>
    ),
    // Two browser windows, one behind the other: a whole window of tabs.
    tabs: (
        <>
            <rect x="3" y="7" width="14" height="13" rx="2" />
            <path d="M7 4h11a3 3 0 0 1 3 3v9" />
            <line x1="3" y1="11" x2="17" y2="11" />
        </>
    ),
    moon: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />,
    archive: (
        <>
            <rect x="3" y="4" width="18" height="4" rx="1" />
            <path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" />
            <line x1="10" y1="12.5" x2="14" y2="12.5" />
        </>
    ),
    restore: (
        <>
            <rect x="3" y="4" width="18" height="4" rx="1" />
            <path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" />
            <polyline points="9.5 14.5 12 12 14.5 14.5" />
            <line x1="12" y1="12" x2="12" y2="17.5" />
        </>
    ),
    pin: (
        <>
            <line x1="12" y1="17" x2="12" y2="22" />
            <path d="M5 17h14v-1.8a2 2 0 0 0-1.1-1.8l-1.8-.9A2 2 0 0 1 15 10.8V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.8a2 2 0 0 1-1.1 1.8l-1.8.9A2 2 0 0 0 5 15.2z" />
        </>
    ),
    check: <polyline points="5 12 10 17 19 7" />,
    chevronDown: <polyline points="6 9 12 15 18 9" />,
    chevronUp: <polyline points="18 15 12 9 6 15" />,
    chevronLeft: <polyline points="15 18 9 12 15 6" />,
    chevronRight: <polyline points="9 18 15 12 9 6" />,
    // A ticked box: choosing several at once.
    select: (
        <>
            <rect x="4" y="4" width="16" height="16" rx="4" />
            <polyline points="8.5 12 11 14.5 15.5 9.5" />
        </>
    ),
    more: (
        <>
            <circle cx="5" cy="12" r="1.2" />
            <circle cx="12" cy="12" r="1.2" />
            <circle cx="19" cy="12" r="1.2" />
        </>
    ),
    external: (
        <>
            <path d="M14 4h6v6" />
            <line x1="20" y1="4" x2="11" y2="13" />
            <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
        </>
    ),
    unlink: (
        <>
            <rect x="3" y="4" width="8" height="7" rx="2" />
            <rect x="13" y="13" width="8" height="7" rx="2" />
            <path d="M15 4h4a2 2 0 0 1 2 2v3" />
            <path d="M9 20H5a2 2 0 0 1-2-2v-3" />
        </>
    ),
    warning: (
        <>
            <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
        </>
    ),
};

export type IconName =
    | "search"
    | "sort"
    | "download"
    | "keyboard"
    | "tag"
    | "sparkle"
    | "plus"
    | "close"
    | "settings"
    | "edit"
    | "trash"
    | "grip"
    | "tabs"
    | "moon"
    | "pin"
    | "archive"
    | "restore"
    | "check"
    | "chevronDown"
    | "chevronUp"
    | "chevronLeft"
    | "chevronRight"
    | "select"
    | "more"
    | "external"
    | "unlink"
    | "warning";

export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
    return (
        <svg class={styles.icon} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            {PATHS[name]}
        </svg>
    );
}
