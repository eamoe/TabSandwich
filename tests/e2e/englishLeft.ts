import type { Page } from "@playwright/test";
import { en } from "../../src/ui/locales/en";
import { dictionaries } from "../../src/ui/strings";

/**
 * Any English left on a page that should be in another language: text of en.ts that the language
 * words differently, and a few English words no other language uses. The language check
 * (tests/visual/languages.spec.ts) runs it on every screen, the Store screenshots
 * (tests/store/store-assets.spec.ts) on every picture they take.
 */
export async function englishOn(page: Page, language: string): Promise<string[]> {
    if (language === "en") return [];
    const found: string[] = [];
    const words = await wordsOn(page);
    for (const leak of englishLeaks(language)) if (words.some((w) => leak.test(w))) found.push(`English ${leak.source}`);
    for (const word of words) if (/\b(saved|search|categor(y|ies)|selected|reminder|settings)\b/i.test(word)) found.push(`English "${word}"`);
    return found;
}

/** English texts long enough to be unmistakable, which the language words differently. */
function englishLeaks(language: string): RegExp[] {
    const mine = new Set(texts(dictionaries[language]));
    // The starter names are also the seeded library's own (English) category names: data, not text.
    const seeded = new Set(texts(en.starterCategories));
    return texts(en)
        .filter((text) => text.length >= 6 && !mine.has(text) && !seeded.has(text) && !text.includes("Tab Sandwich") && !text.startsWith("https://"))
        // As a whole word or phrase: "Export" isn't a leak inside "Exportieren".
        .map((text) => new RegExp(`(^|[^\\p{L}])${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^\\p{L}])`, "u"));
}

function texts(value: unknown): string[] {
    if (typeof value === "string") return [value];
    if (!value || typeof value !== "object") return [];
    return Object.values(value).flatMap(texts);
}

/** Everything a person can see or a screen reader can say on the page right now. */
async function wordsOn(page: Page): Promise<string[]> {
    return page.evaluate(() => {
        const out: string[] = [];
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) out.push(walker.currentNode.textContent ?? "");
        for (const el of document.querySelectorAll("[aria-label], [title], [placeholder]"))
            for (const name of ["aria-label", "title", "placeholder"]) out.push(el.getAttribute(name) ?? "");
        for (const option of document.querySelectorAll("option")) out.push(option.textContent ?? "");
        return out.map((t) => t.trim()).filter(Boolean);
    });
}
