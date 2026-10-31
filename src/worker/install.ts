import { setLastSeenVersion } from "../storage/chromeStorage";
import { upgradeStoredData } from "../storage/upgrade";
import { rebuildMenu } from "./contextMenu";
import { applyToolbarChoice } from "./toolbar";

export const WELCOME_PAGE = "welcome/welcome.html";

/**
 * Chrome installed or updated the extension. Stored data is brought up to date here, so nothing
 * has to wait for the popup to open first. On a fresh install "What's new" is settled before
 * anything else is written: the popup takes empty storage to mean a fresh install, and from the
 * moment storage isn't empty this is what tells it no note is due. The right-click menu is built
 * from the categories, and the welcome page opens, once, on a fresh install only.
 */
export async function handleInstalled(reason: string): Promise<void> {
    const fresh = reason === "install";
    if (fresh) await setLastSeenVersion(chrome.runtime.getManifest().version).catch(() => undefined);
    await upgradeStoredData();
    await Promise.all([rebuildMenu(), applyToolbarChoice()]);
    if (fresh) await chrome.tabs.create({ url: chrome.runtime.getURL(WELCOME_PAGE) });
}
