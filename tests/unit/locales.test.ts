import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { en } from "../../src/ui/locales/en";
import { dictionaries } from "../../src/ui/strings";

const LOCALES_DIR = new URL("../../_locales/", import.meta.url);
const messagesOf = (folder: string): Record<string, { message: string }> =>
    JSON.parse(readFileSync(new URL(`${folder}/messages.json`, LOCALES_DIR), "utf8"));
const folders = readdirSync(LOCALES_DIR).filter((f) => !f.startsWith("."));

/** Every key path of a dictionary, with what's there: a function's argument count, or a text. */
function shape(value: unknown, path = ""): Map<string, unknown> {
    const out = new Map<string, unknown>();
    if (typeof value === "function") out.set(path, `function/${value.length}`);
    else if (Array.isArray(value)) out.set(path, "list");
    else if (value && typeof value === "object") for (const [k, v] of Object.entries(value)) for (const e of shape(v, `${path}.${k}`)) out.set(...e);
    else out.set(path, typeof value);
    return out;
}

/** The texts of a dictionary that aren't produced by a function, by key path. */
function texts(value: unknown, path = ""): Array<[string, string]> {
    if (typeof value === "string") return [[path, value]];
    if (!value || typeof value !== "object" || typeof value === "function") return [];
    return Object.entries(value).flatMap(([k, v]) => texts(v, `${path}.${k}`));
}

const NEWEST_NOTE = Object.keys(en.whatsNewNotes).sort((a, b) => b.localeCompare(a, "en", { numeric: true }))[0]!;

describe.each(Object.entries(dictionaries))("the %s dictionary", (language, dictionary) => {
    it("has every key English has, and nothing else, each of the same kind", () => {
        const { whatsNewNotes: _a, ...mine } = dictionary;
        const { whatsNewNotes: _b, ...english } = en;
        expect(Object.fromEntries(shape(mine))).toEqual(Object.fromEntries(shape(english)));
    });

    it(`has the newest "What's new" note (${NEWEST_NOTE}), with as many lines as English`, () => {
        expect(dictionary.whatsNewNotes[NEWEST_NOTE]).toHaveLength(en.whatsNewNotes[NEWEST_NOTE]!.length);
    });

    it("keeps each sentence's {} slot and the address bar's markup", () => {
        const english = new Map(texts(en));
        for (const [path, text] of texts(dictionary)) {
            const source = english.get(path) ?? "";
            expect(text.split("{}").length, path).toBe(source.split("{}").length);
            if (source.includes("%s")) expect(text, path).toContain("<match>%s</match>");
        }
        // Every plural form: Russian's 1, 2, 5 and 21 are each a different one.
        for (const days of [0, 1, 2, 5, 21]) expect(dictionary.waitingAfterDays(days).split("{}"), `${days} days`).toHaveLength(2);
    });

    it("names saved windows in hundreds of ways, each short enough for a row", () => {
        let seed = 7;
        const random = () => ((seed = (seed * 48271) % 2147483647) / 2147483647);
        const pick = <T,>(items: readonly T[]) => items[Math.floor(random() * items.length)]!;
        const names = new Set(Array.from({ length: 3000 }, () => dictionary.groupName(pick)));
        expect(names.size).toBeGreaterThan(300);
        for (const name of names) {
            expect(name.trim(), name).toBe(name);
            expect(name.length, name).toBeLessThanOrEqual(30);
            expect(name).not.toMatch(/undefined|\s\s/);
        }
    });

    it("starts a fresh install with four distinct categories, each a name any category could have", () => {
        const names = Object.values(dictionary.starterCategories);
        expect(new Set(names.map((n) => n.toLocaleLowerCase())).size).toBe(4);
        for (const name of names) {
            expect(name.trim(), name).toBe(name);
            expect(name.length, name).toBeGreaterThan(0);
            expect(name.length, name).toBeLessThanOrEqual(15);
            expect(name.toLocaleLowerCase()).not.toBe(dictionary.uncategorized.toLocaleLowerCase());
            expect(name.toLocaleLowerCase()).not.toBe("uncategorized");
        }
    });

    it("never translates the app's name", () => {
        expect(dictionary.appName).toBe("Tab Sandwich");
    });

    it("has the manifest's words in _locales, the folder Chrome picks for the same language", () => {
        expect(folders).toContain(language);
        expect(Object.keys(messagesOf(language)).sort()).toEqual(Object.keys(messagesOf("en")).sort());
    });
});

describe("_locales", () => {
    it("has a folder for exactly the languages the screens speak", () => {
        expect(folders.sort()).toEqual(Object.keys(dictionaries).sort());
    });

    it.each(folders)("%s: the Store's summary fits its 132 characters", (folder) => {
        expect(messagesOf(folder).appDescription!.message.length).toBeLessThanOrEqual(132);
    });
});
