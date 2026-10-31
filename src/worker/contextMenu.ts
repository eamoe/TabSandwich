import { UNCATEGORIZED, getSelectableCategories } from "../domain/CategoryRepository";
import { addTab } from "../domain/TabRepository";
import { upgradeStoredData } from "../storage/upgrade";
import { strings } from "../ui/strings";
import { isSupportedTabUrl } from "../util/url";
import { flashBadge } from "./feedback";

const PARENT_ID = "save";
/** On the toolbar icon's own right-click menu. */
export const LIBRARY_ID = "library";
/** A category's item is this plus the category's name. */
const CATEGORY_ID_PREFIX = "save:";
const CONTEXTS: chrome.contextMenus.ContextType[] = ["link", "page"];
/** A page that doesn't answer in time just gets the fallback title: saving must not hang on it. */
const LINK_TEXT_TIMEOUT_MS = 1000;

let rebuilding: Promise<void> = Promise.resolve();

/** "Save to Tab Sandwich" with one item per category. One rebuild at a time: two at once would create every item twice. */
export function rebuildMenu(): Promise<void> {
    rebuilding = rebuilding.then(buildMenu, buildMenu);
    return rebuilding;
}

async function buildMenu(): Promise<void> {
    const categories = await getSelectableCategories();
    await chrome.contextMenus.removeAll();
    chrome.contextMenus.create({ id: LIBRARY_ID, title: strings.menuOpenLibrary, contexts: ["action"] });
    chrome.contextMenus.create({ id: PARENT_ID, title: strings.menuSave, contexts: CONTEXTS });
    for (const category of categories) {
        chrome.contextMenus.create({ id: CATEGORY_ID_PREFIX + category, parentId: PARENT_ID, title: category, contexts: CONTEXTS });
    }
}

/**
 * Runs inside the page, only at the moment of saving (the menu click grants activeTab for this
 * one tab), so it can use nothing from this module. Chrome says where a link goes but not what
 * it says, and the words on the link are what you'll recognize later.
 */
export function readLinkText(url: string): string {
    for (const link of document.querySelectorAll<HTMLAnchorElement>("a[href]")) {
        if (link.href !== url) continue;
        const text = (link.innerText || link.getAttribute("aria-label") || link.title || link.querySelector("img")?.alt || "").replace(/\s+/g, " ").trim();
        if (text) return text;
    }
    return "";
}

async function linkTextOnPage(url: string, tabId: number | undefined, frameId: number | undefined): Promise<string> {
    if (tabId === undefined || tabId < 0) return "";
    const timedOut = new Promise<[]>((resolve) => setTimeout(() => resolve([]), LINK_TEXT_TIMEOUT_MS));
    try {
        const reading = chrome.scripting.executeScript({ target: { tabId, frameIds: [frameId ?? 0] }, func: readLinkText, args: [url] });
        const [reply] = await Promise.race([reading, timedOut]);
        return typeof reply?.result === "string" ? reply.result : "";
    } catch {
        return ""; // A page Chrome won't let extensions read: the Web Store, a PDF, a frame from another site.
    }
}

async function titleFor(info: chrome.contextMenus.OnClickData, tab: chrome.tabs.Tab | undefined, url: string): Promise<string> {
    const siteName = new URL(url).hostname;
    if (!info.linkUrl) return tab?.title?.trim() || siteName;
    return (await linkTextOnPage(url, tab?.id, info.frameId)) || info.selectionText?.trim() || siteName;
}

/** A category picked in the menu: saves the link right-clicked, or else the page. */
export async function saveFromMenu(info: chrome.contextMenus.OnClickData, tab: chrome.tabs.Tab | undefined): Promise<void> {
    const id = String(info.menuItemId);
    if (!id.startsWith(CATEGORY_ID_PREFIX)) return;
    const url = info.linkUrl ?? tab?.url ?? info.pageUrl;
    if (!isSupportedTabUrl(url)) return flashBadge("failed");
    const category = id.slice(CATEGORY_ID_PREFIX.length);
    try {
        // The worker can be the first to write after an update, before any screen has opened.
        await upgradeStoredData();
        await addTab({ title: await titleFor(info, tab, url), url, category: category === UNCATEGORIZED ? undefined : category });
        await flashBadge("saved");
    } catch {
        await flashBadge("failed");
    }
}
