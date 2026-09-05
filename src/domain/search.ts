import { SavedTab } from "../types";

/** Half-open range into a searched string: `start` inclusive, `end` exclusive. */
export interface MatchRange {
    start: number;
    end: number;
}

export interface SearchMatch {
    tab: SavedTab;
    score: number;
    /** Ascending, non-overlapping ranges into `tab.title`. Empty when only the URL matched. */
    titleRanges: MatchRange[];
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

interface TabFields {
    title: string;
    host: string;
    path: string;
}

function fieldsFor(tab: SavedTab): TabFields {
    try {
        const url = new URL(tab.url);
        return { title: tab.title, host: url.hostname, path: url.pathname + url.search };
    } catch {
        // An unparsable URL is still searchable as raw text rather than being silently excluded.
        return { title: tab.title, host: "", path: tab.url };
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
}

function scoreTerm(fields: TabFields, term: string): TermResult | null {
    const title = matchTerm(fields.title, term);
    const host = matchTerm(fields.host, term);
    const path = matchTerm(fields.path, term);
    if (!title && !host && !path) return null;

    const score = Math.max(
        title ? title.score * WEIGHT_TITLE : 0,
        host ? host.score * WEIGHT_HOST : 0,
        path ? path.score * WEIGHT_PATH : 0
    );

    // Highlight whenever the title matched at all, even if the URL is what scored highest —
    // the title is the only one of the three the row actually displays.
    return { score, titleRanges: title?.ranges ?? [] };
}

/**
 * Filters and ranks. Whitespace splits the query into terms that must *all* match somewhere
 * ("python article"), rather than being matched as one literal string containing a space.
 *
 * An empty query returns every tab, unranked, so the caller's existing order survives.
 */
export function searchTabs(tabs: SavedTab[], rawQuery: string): SearchMatch[] {
    const terms = rawQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) {
        return tabs.map((tab) => ({ tab, score: 0, titleRanges: [] }));
    }

    const matches: SearchMatch[] = [];
    for (const tab of tabs) {
        const fields = fieldsFor(tab);
        let total = 0;
        let ranges: MatchRange[] = [];
        let matchedEveryTerm = true;

        for (const term of terms) {
            const result = scoreTerm(fields, term);
            if (!result) {
                matchedEveryTerm = false;
                break;
            }
            total += result.score;
            ranges = ranges.concat(result.titleRanges);
        }

        if (matchedEveryTerm && total > 0) {
            matches.push({ tab, score: total, titleRanges: mergeRanges(ranges) });
        }
    }

    // Array#sort is stable, so equally-scored tabs keep the order they were passed in —
    // which is the user's manual arrangement.
    return matches.sort((a, b) => b.score - a.score);
}
