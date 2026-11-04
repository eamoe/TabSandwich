import "./ui/tokens.css";
import "./ui/base.css";
import "./ui/library/library.css";
import { h, render } from "preact";
import { getSettings } from "./storage/chromeStorage";
import { upgradeStoredData } from "./storage/upgrade";
import { Library } from "./ui/library/Library";
import { strings } from "./ui/strings";
import { applyLanguage } from "./ui/pageLanguage";
import { applyTheme } from "./ui/theme";
import { showErrorToast } from "./ui/toastStore";

applyLanguage(strings.libraryPageTitle);

document.addEventListener("DOMContentLoaded", async () => {
    if ((await upgradeStoredData()).status === "failed") showErrorToast(strings.upgradeFailed);
    applyTheme((await getSettings()).theme);
    render(h(Library, {}), document.getElementById("app")!);
});
