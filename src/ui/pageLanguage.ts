import { locale } from "./strings";

/**
 * Tells the page which language it's in (for screen readers, hyphenation and fonts) and gives
 * its browser tab its name: the HTML files can only say either in English.
 */
export function applyLanguage(title: string): void {
    document.documentElement.lang = locale;
    document.title = title;
}
