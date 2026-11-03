import "./ui/tokens.css";
import "./ui/base.css";
import { h, render } from "preact";
import { getSettings } from "./storage/chromeStorage";
import { applyLanguage } from "./ui/pageLanguage";
import { strings } from "./ui/strings";
import { applyTheme } from "./ui/theme";
import { Welcome } from "./ui/welcome/Welcome";

applyLanguage(strings.welcomeTitle);

document.addEventListener("DOMContentLoaded", async () => {
    applyTheme((await getSettings()).theme);
    render(h(Welcome, {}), document.getElementById("app")!);
});
