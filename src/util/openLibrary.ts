export const LIBRARY_PAGE = "library/library.html";

/** Goes to the library's tab if it's open (from any window), or opens it. */
export async function openLibrary(): Promise<void> {
    const url = chrome.runtime.getURL(LIBRARY_PAGE);
    const [open] = await chrome.runtime.getContexts({ contextTypes: [chrome.runtime.ContextType.TAB], documentUrls: [url] });
    if (open && open.tabId >= 0) {
        await chrome.tabs.update(open.tabId, { active: true });
        await chrome.windows.update(open.windowId, { focused: true });
    } else {
        await chrome.tabs.create({ url });
    }
}
