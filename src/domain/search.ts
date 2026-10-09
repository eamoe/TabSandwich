import { SavedTab } from "../types";

/** Half-open range into a searched string: `start` inclusive, `end` exclusive. */
export interface MatchRange {
    start: number;
    end: number;
}

/**
 * The names a tab is listed under, besides its own title and address: its category and, when it
 * belongs to one, its saved window's name. Passed in by the caller (they live in Settings and the
 * saved windows, not on the tab), so this module stays free of storage.
 */
export interface TabLabels {
    category: string;
    window?: string;
}

export interface SearchMatch {
    tab: SavedTab;
    score: number;
    /** Ascending, non-overlapping ranges into `tab.title`. Empty when only the URL matched. */
    titleRanges: MatchRange[];
    /** Ranges into the category's name, when a term matched it. */
    categoryRanges: MatchRange[];
    /** Ranges into the saved window's name, when a term matched it. */
    windowRanges: MatchRange[];
}

/**
 * Subsequence scoring, deliberately hand-written rather than pulled from a library: the corpus
 * is a few hundred short strings, and a generic fuzzy matcher would neither be faster here nor
 * know that a hit on a hostname is worth more than a hit deep in a query string.
 *
 * Kept free of DOM and `chrome.*` references on purpose — the omnibox handler will need to run
 * exactly this scoring from a service worker, where neither exists.
 */
const SCORE_PER_CHAR = 4;
/** A run of adjacent characters is the strongest signal that this is the word being typed. */
const BONUS_CONSECUTIVE = 8;
const BONUS_BOUNDARY = 6;
const BONUS_FIRST_CHAR = 10;
/** Gaps cost, but a long gap shouldn't be able to drive an otherwise-good match negative. */
const MAX_GAP_PENALTY = 8;

/** A title hit is what the user can actually see in the row, so it outranks the URL fields. */
const WEIGHT_TITLE = 1;
const WEIGHT_HOST = 0.9;
const WEIGHT_PATH = 0.55;
/** A category or saved-window name: what you'd type to find a project's tabs, as strong as the site. */
const WEIGHT_LABEL = 0.9;

const BOUNDARY_CHARS = new Set([" ", "-", "_", ".", "/", ":", "?", "&", "=", "+", ",", "|", "(", ")", "[", "]", "#", "@"]);

/** True at a word start: index 0, just after a separator, or at a camelCase hump. */
function isBoundary(text: string, index: number): boolean {
    if (index === 0) return true;
    const previous = text[index - 1];
    if (BOUNDARY_CHARS.has(previous)) return true;
    return previous === previous.toLowerCase() && text[index] !== text[index].toLowerCase();
}

interface FieldMatch {
    score: number;
    ranges: MatchRange[];
}

/** Greedy left-to-right subsequence scan starting at `from`. Null if the term doesn't fit. */
function scanFrom(haystack: string, lower: string, term: string, from: number): FieldMatch | null {
    const ranges: MatchRange[] = [];
    let score = 0;
    let previousEnd = -1;
    let cursor = from;

    for (const char of term) {
        const found = lower.indexOf(char, cursor);
        if (found === -1) return null;

        score += SCORE_PER_CHAR;
        if (found === previousEnd) {
            score += BONUS_CONSECUTIVE;
            ranges[ranges.length - 1].end = found + 1;
        } else {
            const gap = found - (previousEnd === -1 ? from : previousEnd);
            score -= Math.min(gap, MAX_GAP_PENALTY);
            ranges.push({ start: found, end: found + 1 });
        }
        if (isBoundary(haystack, found)) score += BONUS_BOUNDARY;
        if (found === 0) score += BONUS_FIRST_CHAR;

        previousEnd = found + 1;
        cursor = found + 1;
    }

    return { score, ranges };
}

/**
 * Plain greedy always takes the first occurrence of each character, which scores "ab" against
 * "a-quick-brown" off the leading "a" and misses the far better run in "…-ab". Retrying the
 * scan from every word boundary that could start the term fixes that for a handful of extra
 * passes over strings this short.
 */
function matchTerm(haystack: string, term: string): FieldMatch | null {
    if (!haystack || !term) return null;
    const lower = haystack.toLowerCase();

    let best: FieldMatch | null = null;
    for (let i = 0; i < lower.length; i++) {
        if (lower[i] !== term[0]) continue;
        if (i !== 0 && !isBoundary(haystack, i)) continue;
        const candidate = scanFrom(haystack, lower, term, i);
        if (candidate && (!best || candidate.score > best.score)) best = candidate;
    }

    // No boundary start worked (or none existed) — fall back to the plain greedy scan.
    return best ?? scanFrom(haystack, lower, term, 0);
}

/**
 * A category or saved-window name matches only where a term starts one of its words ("proj" →
 * "ProjX", "rye" → "Toasted Rye"), never by scattered letters: a hit there brings in every tab
 * under that name, so "rd" must not pull in all of "Reading".
 */
function matchLabel(label: string | undefined, term: string): FieldMatch | null {
    if (!label || !term) return null;
    const lower = label.toLowerCase();
    let best: FieldMatch | null = null;
    for (let i = lower.indexOf(term); i !== -1; i = lower.indexOf(term, i + 1)) {
        if (!isBoundary(label, i)) continue;
        const candidate = scanFrom(label, lower, term, i);
        if (candidate && (!best || candidate.score > best.score)) best = candidate;
    }
    return best;
}

interface TabFields {
    title: string;
    host: string;
    path: string;
    category?: string;
    window?: string;
}

function fieldsFor(tab: SavedTab, labels?: TabLabels): TabFields {
    const named = { category: labels?.category, window: labels?.window };
    try {
        const url = new URL(tab.url);
        return { title: tab.title, host: url.hostname, path: url.pathname + url.search, ...named };
    } catch {
        // An unparsable URL is still searchable as raw text rather than being silently excluded.
        return { title: tab.title, host: "", path: tab.url, ...named };
    }
}

function mergeRanges(ranges: MatchRange[]): MatchRange[] {
    if (ranges.length < 2) return ranges;
    const sorted = [...ranges].sort((a, b) => a.start - b.start);
    const merged: MatchRange[] = [sorted[0]];
    for (const range of sorted.slice(1)) {
        const last = merged[merged.length - 1];
        if (range.start <= last.end) last.end = Math.max(last.end, range.end);
        else merged.push({ ...range });
    }
    return merged;
}

interface TermResult {
    score: number;
    titleRanges: MatchRange[];
    categoryRanges: MatchRange[];
    windowRanges: MatchRange[];
}

function scoreTerm(fields: TabFields, term: string): TermResult | null {
    const title = matchTerm(fields.title, term);
    const host = matchTerm(fields.host, term);
    const path = matchTerm(fields.path, term);
    const category = matchLabel(fields.category, term);
    const window = matchLabel(fields.window, term);
    if (!title && !host && !path && !category && !window) return null;

    const score = Math.max(
        title ? title.score * WEIGHT_TITLE : 0,
        host ? host.score * WEIGHT_HOST : 0,
        path ? path.score * WEIGHT_PATH : 0,
        category ? category.score * WEIGHT_LABEL : 0,
        window ? window.score * WEIGHT_LABEL : 0
    );

    // Highlight wherever a term matched something the row shows (title, category, window name),
    // even if the URL is what scored highest, so you can see why a tab is in the results.
    return {
        score,
        titleRanges: title?.ranges ?? [],
        categoryRanges: category?.ranges ?? [],
        windowRanges: window?.ranges ?? [],
    };
}

/**
 * Filters and ranks. Whitespace splits the query into terms that must *all* match somewhere
 * ("python article"; "projx repo" = in the ProjX category, with "repo" in its title or address),
 * rather than being matched as one literal string containing a space. `labelsOf` names each tab's
 * category and saved window; without it only titles and addresses are searched.
 *
 * An empty query returns every tab, unranked, so the caller's existing order survives.
 */
export function searchTabs(tabs: SavedTab[], rawQuery: string, labelsOf?: (tab: SavedTab) => TabLabels): SearchMatch[] {
    const terms = rawQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) {
        return tabs.map((tab) => ({ tab, score: 0, titleRanges: [], categoryRanges: [], windowRanges: [] }));
    }

    const matches: SearchMatch[] = [];
    for (const tab of tabs) {
        const fields = fieldsFor(tab, labelsOf?.(tab));
        let total = 0;
        let titleRanges: MatchRange[] = [];
        let categoryRanges: MatchRange[] = [];
        let windowRanges: MatchRange[] = [];
        let matchedEveryTerm = true;

        for (const term of terms) {
            const result = scoreTerm(fields, term);
            if (!result) {
                matchedEveryTerm = false;
                break;
            }
            total += result.score;
            titleRanges = titleRanges.concat(result.titleRanges);
            categoryRanges = categoryRanges.concat(result.categoryRanges);
            windowRanges = windowRanges.concat(result.windowRanges);
        }

        if (matchedEveryTerm && total > 0) {
            matches.push({
                tab,
                score: total,
                titleRanges: mergeRanges(titleRanges),
                categoryRanges: mergeRanges(categoryRanges),
                windowRanges: mergeRanges(windowRanges),
            });
        }
    }

    // Array#sort is stable, so equally-scored tabs keep the order they were passed in —
    // which is the user's manual arrangement.
    return matches.sort((a, b) => b.score - a.score);
}
