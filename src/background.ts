import { onSettingChanged } from "./storage/chromeStorage";
import { openLibrary } from "./util/openLibrary";
import { LIBRARY_ID, rebuildMenu, saveFromMenu } from "./worker/contextMenu";
import { handleInstalled } from "./worker/install";
import { applyToolbarChoice } from "./worker/toolbar";

// Registered right here, at the top of the file: Chrome only wakes the worker for listeners
// added in its first moment, not later.
chrome.runtime.onInstalled.addListener((details) => void handleInstalled(details.reason));
chrome.runtime.onStartup.addListener(() => {
    void rebuildMenu();
    void applyToolbarChoice();
});
chrome.contextMenus.onClicked.addListener((info, tab) => void (info.menuItemId === LIBRARY_ID ? openLibrary() : saveFromMenu(info, tab)));
onSettingChanged((settings) => settings.categories, () => void rebuildMenu());
onSettingChanged((settings) => settings.toolbarOpens, () => void applyToolbarChoice());
