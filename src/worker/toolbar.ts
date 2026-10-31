import { getSettings } from "../storage/chromeStorage";

const POPUP_PAGE = "popup/popup.html";

/**
 * What the toolbar icon opens: the popup, or the side panel. An icon with a popup always opens
 * it, so choosing the panel means taking the popup away. Chrome forgets that when it restarts.
 */
export async function applyToolbarChoice(): Promise<void> {
    const panel = (await getSettings()).toolbarOpens === "panel";
    await Promise.all([chrome.action.setPopup({ popup: panel ? "" : POPUP_PAGE }), chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: panel })]);
}
