function looksLikeDomain(hostname: string): boolean {
    if (hostname === "localhost") return true;
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) return true; // IPv4
    return hostname.includes(".");
}

/**
 * Returns a normalized, absolute URL string, or null if the input isn't a usable URL.
 * The browser's URL parser alone is too permissive for this — "weuirytuiwerytweury" parses
 * fine as a single-label hostname once we prepend "https://". When we're the one inferring
 * the scheme (the user didn't type one), we additionally require the result to look like a
 * real domain. If the user typed an explicit scheme themselves, we trust their intent.
 */
export function normalizeUrl(raw: string): string | null {
    const trimmed = raw.trim();
    if (!trimmed) return null;

    const hasExplicitScheme = /^https?:\/\//i.test(trimmed);
    const withProtocol = hasExplicitScheme ? trimmed : `https://${trimmed}`;

    let parsed: URL;
    try {
        parsed = new URL(withProtocol);
    } catch {
        return null;
    }

    if (!hasExplicitScheme && !looksLikeDomain(parsed.hostname)) {
        return null;
    }

    return parsed.toString();
}

/** Internal browser pages (chrome://, about:, etc.) can't be meaningfully saved — only http(s) pages are supported. */
export function isSupportedTabUrl(url: string | undefined): url is string {
    if (!url) return false;
    return /^https?:\/\//i.test(url);
}

/**
 * Compares two URLs the way a user would judge "the same page" — scheme/host/path (ignoring
 * a trailing slash) AND query string. The query string matters: on many real sites (YouTube's
 * /watch?v=..., search results, etc.) the path is identical across completely different pages
 * and the actual content lives entirely in the query — comparing path alone treated every
 * YouTube video as a duplicate of every other one. The URL fragment (#...) is still ignored,
 * since it more often marks a spot within the same page than a genuinely different resource.
 */
export function urlsMatch(a: string, b: string): boolean {
    try {
        const ua = new URL(a);
        const ub = new URL(b);
        return (
            ua.protocol === ub.protocol &&
            ua.host === ub.host &&
            ua.pathname.replace(/\/$/, "") === ub.pathname.replace(/\/$/, "") &&
            ua.search === ub.search
        );
    } catch {
        return a === b;
    }
}
