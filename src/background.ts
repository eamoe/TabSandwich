import { handleInstalled } from "./worker/install";

// Registered right here, at the top of the file: Chrome only wakes the worker for listeners
// added in its first moment, not later.
chrome.runtime.onInstalled.addListener((details) => void handleInstalled(details.reason));
