import type { SavedTab } from "../types";

/**
 * The category to start a new save in, learned from where you've put pages like it — worked out
 * on your device from your own library, nothing stored for it and nothing sent anywhere.
 *
 * "Like it" means the same site, and of those, the ones whose address shares the most of the
 * new page's path: a GitHub repo's issues page goes where you put that repo, not wherever your
 * last github.com page went. Among those, the category of the two most recent saves when they
 * agree (so correcting a site twice teaches it), otherwise the most common one (ties: the most
 * recent). Tabs saved without a category, and categories that no longer exist, don't count.
 * No history for the site: no suggestion. Pure.
 */
export function suggestCategory(url: string, tabs: SavedTab[], categories: string[]): string | undefined {
    const page = parts(url);
    if (!page) return undefined;
    const known = new Set(categories);
    let depth = -1;
    let pool: SavedTab[] = [];
    for (const tab of tabs) {
        if (!tab.category || !known.has(tab.category)) continue;
        const other = parts(tab.url);
        if (!other || other.host !== page.host) continue;
        const shared = sharedSegments(page.path, other.path);
        if (shared > depth) {
            depth = shared;
            pool = [tab];
        } else if (shared === depth) {
            pool.push(tab);
        }
    }
    if (pool.length === 0) return undefined;

    const newest = [...pool].sort((a, b) => b.savedAt - a.savedAt);
    if (newest.length >= 2 && newest[0].category === newest[1].category) return newest[0].category;
    const counts = new Map<string, number>();
    for (const tab of newest) counts.set(tab.category!, (counts.get(tab.category!) ?? 0) + 1);
    // The newest tab's category comes first in `counts`, so it wins a tie.
    let best: string | undefined;
    for (const [category, count] of counts) if (best === undefined || count > counts.get(best)!) best = category;
    return best;
}

function parts(url: string): { host: string; path: string[] } | null {
    try {
        const parsed = new URL(url);
        return {
            host: parsed.hostname.replace(/^www\./, "").toLowerCase(),
            path: parsed.pathname.split("/").filter(Boolean).map((s) => s.toLowerCase()),
        };
    } catch {
        return null;
    }
}

function sharedSegments(a: string[], b: string[]): number {
    let i = 0;
    while (i < a.length && i < b.length && a[i] === b[i]) i++;
    return i;
}
