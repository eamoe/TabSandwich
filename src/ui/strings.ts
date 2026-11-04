import { UNCATEGORIZED } from "../domain/uncategorized";
import { localeFor, pickLanguage, uiLanguage } from "./i18n";
import { de } from "./locales/de";
import { en, type Strings } from "./locales/en";
import { es } from "./locales/es";
import { fr } from "./locales/fr";
import { ja } from "./locales/ja";
import { pt_BR } from "./locales/pt_BR";
import { ru } from "./locales/ru";
import { zh_CN } from "./locales/zh_CN";

/** Every language Tab Sandwich speaks, by its _locales folder name. English is the source. */
export const dictionaries: Record<string, Strings> = { en, de, es, fr, ja, pt_BR, ru, zh_CN };

/** The language the screens speak: Chrome's, when there's a dictionary for it (see pickLanguage). */
export const language = pickLanguage(uiLanguage(), Object.keys(dictionaries));

/** For dates, numbers and alphabetical order in that language. */
export const locale = localeFor(language);

/** Every piece of text the extension shows, in Chrome's language (see locales/en.ts). */
export const strings: Strings = dictionaries[language] ?? en;

/**
 * A category's name as shown. Only "Uncategorized" is ours to translate: it's stored in English
 * whatever the language, and every other name is the one you gave it.
 */
export function categoryLabel(name: string): string {
    return name === UNCATEGORIZED ? strings.uncategorized : name;
}
