import type { ThemeChoice } from "../types";

/**
 * Applies the stored theme choice to the page. "system" removes the attribute and leaves it to
 * tokens.css's prefers-color-scheme rule, which also keeps an open popup in step with the OS
 * flipping theme — no listener needed. Only an explicit Light or Dark choice is stamped on.
 */
export function applyTheme(choice: ThemeChoice, root: HTMLElement = document.documentElement): void {
    if (choice === "light" || choice === "dark") {
        root.dataset.theme = choice;
    } else {
        delete root.dataset.theme;
    }
}
