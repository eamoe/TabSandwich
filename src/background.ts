import { onCategoriesChanged } from "./storage/chromeStorage";
import { rebuildMenu, saveFromMenu } from "./worker/contextMenu";
import { handleInstalled } from "./worker/install";

// Registered right here, at the top of the file: Chrome only wakes the worker for listeners
// added in its first moment, not later.
chrome.runtime.onInstalled.addListener((details) => void handleInstalled(details.reason));
chrome.runtime.onStartup.addListener(() => void rebuildMenu());
chrome.contextMenus.onClicked.addListener((info, tab) => void saveFromMenu(info, tab));
onCategoriesChanged(() => void rebuildMenu());
