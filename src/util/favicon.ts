/**
 * Resolves a page's favicon through Chrome's local favicon cache (the `favicon` permission's
 * `_favicon/` endpoint) instead of loading the image from the page's own site. This never
 * sends a request to that site: Chrome answers from favicons it already has cached (e.g. from
 * browsing history), and returns its own generic fallback icon — not an error — for a page it
 * has nothing cached for.
 */
export function localFaviconUrl(pageUrl: string, size = 32): string {
    const url = new URL(chrome.runtime.getURL("/_favicon/"));
    url.searchParams.set("pageUrl", pageUrl);
    url.searchParams.set("size", size.toString());
    return url.toString();
}
