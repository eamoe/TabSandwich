import type { SavedTab, TabGroup } from "../types";
import { getTabCategory } from "../domain/CategoryRepository";
import { recordOpen } from "../domain/TabRepository";
import { searchTabs, type MatchRange, type SearchMatch } from "../domain/search";
import { getGroups, getTabs } from "../storage/chromeStorage";
import { upgradeStoredData } from "../storage/upgrade";
import { isArchived, siteName, windowNames } from "../ui/main/listModel";
import { categoryLabel } from "../ui/strings";
import { openLibrary } from "../util/openLibrary";

/** About as many as the address bar has room for. */
const MAX_SUGGESTIONS = 6;

/** Suggestions are XML, and a page's title is untrusted text. */
function escaped(text: string): string {
    const replacements: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" };
    // (Control characters aren't allowed in XML at all.)
    // eslint-disable-next-line no-control-regex
    return text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").replace(/[&<>"']/g, (c) => replacements[c]);
}

function withMatches(title: string, ranges: MatchRange[]): string {
    let cursor = 0;
    let out = "";
    for (const range of ranges) {
        if (range.start > cursor) out += escaped(title.slice(cursor, range.start));
        out += `<match>${escaped(title.slice(range.start, range.end))}</match>`;
        cursor = range.end;
    }
    return out + escaped(title.slice(cursor));
}

/** Every saved tab that isn't archived, best match first, found the way the app's own search finds them. */
function find(tabs: SavedTab[], groups: TabGroup[], text: string): SearchMatch[] {
    const live = tabs.filter((t) => !isArchived(t));
    const windowOf = windowNames(live, groups);
    return searchTabs(live, text, (t) => ({ category: categoryLabel(getTabCategory(t)), window: windowOf.get(t.id) ?? "" }));
}

/** What the address bar lists for what's been typed after "ts". Picking one hands back its address. */
export function suggestionsFor(tabs: SavedTab[], groups: TabGroup[], text: string): chrome.omnibox.SuggestResult[] {
    if (!text.trim()) return [];
    return find(tabs, groups, text)
        .slice(0, MAX_SUGGESTIONS)
        .map(({ tab, titleRanges }) => ({ content: tab.url, description: `${withMatches(tab.title, titleRanges)} <dim>· ${escaped(siteName(tab.url))}</dim>` }));
}

let latest = 0;

export async function suggestSaved(text: string, suggest: (results: chrome.omnibox.SuggestResult[]) => void): Promise<void> {
    const turn = ++latest;
    const [tabs, groups] = await Promise.all([getTabs(), getGroups()]);
    // Typing goes faster than storage answers: only the newest text's results are worth showing.
    if (turn === latest) suggest(suggestionsFor(tabs, groups, text));
}

function openAddress(url: string, disposition: chrome.omnibox.OnInputEnteredDisposition): Promise<unknown> {
    if (disposition === "currentTab") return chrome.tabs.update({ url });
    return chrome.tabs.create({ url, active: disposition === "newForegroundTab" });
}

/**
 * Enter in the address bar: a suggestion hands back its address; words on their own go to the
 * best match, counted like any other open. Nothing found: the library, showing that search.
 */
export async function openFromAddressBar(text: string, disposition: chrome.omnibox.OnInputEnteredDisposition): Promise<void> {
    await upgradeStoredData();
    const [tabs, groups] = await Promise.all([getTabs(), getGroups()]);
    const tab = tabs.find((t) => t.url === text) ?? find(tabs, groups, text)[0]?.tab;
    if (!tab) return openLibrary({ q: text.trim() });
    await recordOpen([tab.id]).catch(() => undefined);
    await openAddress(tab.url, disposition);
}
