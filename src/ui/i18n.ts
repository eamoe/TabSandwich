/**
 * Which language the screens speak, and the rules that come with it. Pure apart from asking
 * Chrome for its language, so the worker uses it too.
 *
 * The language is Chrome's own, never a setting of ours: the store page, the right-click menu
 * and the shortcut's name follow Chrome whatever the app does, so the screens follow it as well.
 */

/** Chrome's language, as "de", "pt-BR"…; English where there's no Chrome to ask (logic tests). */
export function uiLanguage(): string {
    return globalThis.chrome?.i18n?.getUILanguage?.() ?? "en";
}

/**
 * The dictionary for a Chrome language, the way Chrome picks a manifest's _locales folder:
 * the exact one (pt-BR → pt_BR), else the language alone (de-AT → de), else English. So
 * Portugal's Portuguese and traditional Chinese get English everywhere, never Brazil's or
 * simplified Chinese on some screens and English on the store page.
 */
export function pickLanguage(ui: string, available: readonly string[]): string {
    const [base = "", region] = ui.replace("_", "-").split("-");
    const exact = region ? `${base.toLowerCase()}_${region.toUpperCase()}` : base.toLowerCase();
    if (available.includes(exact)) return exact;
    if (available.includes(base.toLowerCase())) return base.toLowerCase();
    return "en";
}

/**
 * The tag dates, numbers and sorting use for a dictionary: Chrome's own when it's the same
 * language (an en-GB Chrome writes "4 Nov", an en-US one "Nov 4"), else the dictionary's.
 */
export function localeFor(language: string, ui: string = uiLanguage()): string {
    const tag = language.replace("_", "-");
    return ui.split("-")[0]?.toLowerCase() === tag.split("-")[0] ? ui : tag;
}

/** A count's sentence, one per form the language has: English one/other, Russian one/few/many/other… */
export type PluralForms = { other: string } & Partial<Record<Intl.LDMLPluralRule, string>>;

export function pluralizer(locale: string): (count: number, forms: PluralForms) => string {
    const rules = new Intl.PluralRules(locale);
    return (count, forms) => forms[rules.select(count)] ?? forms.other;
}

/** Chooses one of a list at random (a saved window's name is made of such choices). */
export type Picker = <T>(items: readonly T[]) => T;

/**
 * A sentence with something other than words in it, such as a key cap or a field: "{}" marks
 * the spot, so each language puts it where its own word order wants. Splits into before and after.
 */
export function aroundSlot(sentence: string): [before: string, after: string] {
    const at = sentence.indexOf("{}");
    return at < 0 ? [sentence, ""] : [sentence.slice(0, at), sentence.slice(at + 2)];
}
