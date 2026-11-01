import { onSettingChanged } from "./storage/chromeStorage";
import { strings } from "./ui/strings";
import { openLibrary } from "./util/openLibrary";
import { LIBRARY_ID, rebuildMenu, saveFromMenu } from "./worker/contextMenu";
import { handleInstalled } from "./worker/install";
import { openFromAddressBar, suggestSaved } from "./worker/omnibox";
import { applyToolbarChoice } from "./worker/toolbar";

// Registered right here, at the top of the file: Chrome only wakes the worker for listeners
// added in its first moment, not later.
chrome.runtime.onInstalled.addListener((details) => void handleInstalled(details.reason));
chrome.runtime.onStartup.addListener(() => {
    void rebuildMenu();
    void applyToolbarChoice();
});
chrome.contextMenus.onClicked.addListener((info, tab) => void (info.menuItemId === LIBRARY_ID ? openLibrary() : saveFromMenu(info, tab)));
chrome.omnibox.setDefaultSuggestion({ description: strings.omniboxHint });
chrome.omnibox.onInputChanged.addListener((text, suggest) => void suggestSaved(text, suggest));
chrome.omnibox.onInputEntered.addListener((text, disposition) => void openFromAddressBar(text, disposition));
onSettingChanged((settings) => settings.categories, () => void rebuildMenu());
onSettingChanged((settings) => settings.toolbarOpens, () => void applyToolbarChoice());
