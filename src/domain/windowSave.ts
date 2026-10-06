import type { SavedTab } from "../types";
import { isSupportedTabUrl, urlsMatch } from "../util/url";

/** What a window save needs from each open tab (a chrome.tabs.Tab fits). */
export interface OpenTab {
    id?: number;
    title?: string;
    url?: string;
    active?: boolean;
}

export interface WindowSavePlan {
    /** New pages, in the window's order, each once. */
    toSave: { title: string; url: string }[];
    /** Open tabs whose page is already saved, or open twice in this window. */
    alreadySaved: number;
    /** Browser pages (settings, new tab, extensions) and anything else that isn't a web page. */
    browserPages: number;
}

/**
 * "Save all tabs in this window", worked out before anything is written: which open tabs are
 * new pages, and how many are skipped and why, so the popup can say exactly what happened.
 * Pure: the same rules as saving a single tab (only web pages; one copy per page).
 */
export function planWindowSave(open: OpenTab[], saved: SavedTab[]): WindowSavePlan {
    const toSave: WindowSavePlan["toSave"] = [];
    let alreadySaved = 0;
    let browserPages = 0;
    for (const tab of open) {
        const url = tab.url;
        if (!isSupportedTabUrl(url)) {
            browserPages++;
        } else if (saved.some((s) => urlsMatch(s.url, url)) || toSave.some((s) => urlsMatch(s.url, url))) {
            alreadySaved++;
        } else {
            toSave.push({ title: tab.title?.trim() || url, url });
        }
    }
    return { toSave, alreadySaved, browserPages };
}

/**
 * The tabs "Close them" closes after a window save: every open web page that's now in the
 * library (the ones just saved, and ones that were saved already), except the tab you're on —
 * closing that one would take the popup with it. Browser pages and anything not saved stay open.
 */
export function closableTabIds(open: OpenTab[], saved: SavedTab[]): number[] {
    return open
        .filter((tab) => !tab.active && tab.id !== undefined && isSupportedTabUrl(tab.url) && saved.some((s) => urlsMatch(s.url, tab.url!)))
        .map((tab) => tab.id!);
}
