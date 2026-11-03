export const LIBRARY_PAGE = "library/library.html";

/**
 * Goes to the library's tab if it's open (from any window, on any of its pages), or opens it;
 * with `view`, showing what a search finds (`q`), or what's waiting (`show`).
 */
export async function openLibrary(view?: { q: string } | { show: "waiting" }): Promise<void> {
    const page = chrome.runtime.getURL(LIBRARY_PAGE);
    const query = view && ("q" in view ? `q=${encodeURIComponent(view.q)}` : `show=${view.show}`);
    const url = query ? `${page}?${query}` : page;
    const contexts = await chrome.runtime.getContexts({ contextTypes: [chrome.runtime.ContextType.TAB] });
    const open = contexts.find((c) => c.documentUrl?.startsWith(page) && c.tabId >= 0);
    if (open) {
        await chrome.tabs.update(open.tabId, query ? { active: true, url } : { active: true });
        await chrome.windows.update(open.windowId, { focused: true });
    } else {
        await chrome.tabs.create({ url });
    }
}
