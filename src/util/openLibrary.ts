export const LIBRARY_PAGE = "library/library.html";

/**
 * Goes to the library's tab if it's open (from any window, on any of its pages), or opens it;
 * with `search`, showing what that finds.
 */
export async function openLibrary(search?: string): Promise<void> {
    const page = chrome.runtime.getURL(LIBRARY_PAGE);
    const url = search ? `${page}?q=${encodeURIComponent(search)}` : page;
    const contexts = await chrome.runtime.getContexts({ contextTypes: [chrome.runtime.ContextType.TAB] });
    const open = contexts.find((c) => c.documentUrl?.startsWith(page) && c.tabId >= 0);
    if (open) {
        await chrome.tabs.update(open.tabId, search ? { active: true, url } : { active: true });
        await chrome.windows.update(open.windowId, { focused: true });
    } else {
        await chrome.tabs.create({ url });
    }
}
