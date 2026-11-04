import { describe, expect, it } from "vitest";
import { aroundSlot, localeFor, pickLanguage, pluralizer } from "../../src/ui/i18n";
import { categoryLabel, strings } from "../../src/ui/strings";
import { reminderDay } from "../../src/util/time";

const HAVE = ["en", "de", "es", "fr", "ja", "pt_BR", "ru", "zh_CN"];

describe("pickLanguage (the way Chrome picks a _locales folder)", () => {
    it("takes the exact language and region when there's a dictionary for it", () => {
        expect(pickLanguage("pt-BR", HAVE)).toBe("pt_BR");
        expect(pickLanguage("zh-CN", HAVE)).toBe("zh_CN");
        expect(pickLanguage("zh_CN", HAVE)).toBe("zh_CN");
    });

    it("falls back to the language alone", () => {
        expect(pickLanguage("de-AT", HAVE)).toBe("de");
        expect(pickLanguage("es-419", HAVE)).toBe("es");
        expect(pickLanguage("en-GB", HAVE)).toBe("en");
        expect(pickLanguage("FR", HAVE)).toBe("fr");
    });

    it("gives English, not a neighbor, where Chrome's store page and menus would be English too", () => {
        expect(pickLanguage("pt-PT", HAVE)).toBe("en");
        expect(pickLanguage("zh-TW", HAVE)).toBe("en");
        expect(pickLanguage("it", HAVE)).toBe("en");
        expect(pickLanguage("", HAVE)).toBe("en");
    });
});

describe("localeFor", () => {
    it("keeps Chrome's own regional formats while it speaks the same language", () => {
        expect(localeFor("en", "en-GB")).toBe("en-GB");
        expect(localeFor("de", "de-AT")).toBe("de-AT");
        expect(localeFor("pt_BR", "pt-BR")).toBe("pt-BR");
    });

    it("uses the dictionary's language when Chrome's has no dictionary (no German dates in English text)", () => {
        expect(localeFor("en", "it-IT")).toBe("en");
        expect(localeFor("zh_CN", "en-US")).toBe("zh-CN");
    });
});

describe("pluralizer", () => {
    it("picks each language's own form", () => {
        const en = pluralizer("en");
        const forms = { one: "one", few: "few", many: "many", other: "other" };
        expect([1, 2, 5].map((c) => en(c, forms))).toEqual(["one", "other", "other"]);
        const ru = pluralizer("ru");
        expect([1, 2, 5, 21, 22, 25, 11].map((c) => ru(c, forms))).toEqual(["one", "few", "many", "one", "few", "many", "many"]);
        const ja = pluralizer("ja");
        expect([1, 2].map((c) => ja(c, forms))).toEqual(["other", "other"]);
    });

    it("falls back to the other form when a language's form isn't written", () => {
        expect(pluralizer("ru")(2, { one: "one", other: "other" })).toBe("other");
    });
});

describe("aroundSlot", () => {
    it("splits a sentence at its {}", () => {
        expect(aroundSlot("Press {} to open")).toEqual(["Press ", " to open"]);
        expect(aroundSlot("{}で開く")).toEqual(["", "で開く"]);
        expect(aroundSlot("No slot")).toEqual(["No slot", ""]);
    });
});

describe("English text", () => {
    it("reads naturally with one or many", () => {
        expect(strings.searchPlaceholder(1)).toBe("Search 1 saved tab");
        expect(strings.searchPlaceholder(3)).toBe("Search 3 saved tabs");
        expect(strings.imported(1, 2)).toBe("Imported 1 tab and 2 categories");
        expect(strings.removeConfirmDetail(1, 0)).toBe("Its tab becomes Uncategorized");
        expect(strings.removeConfirmDetail(3, 3)).toBe("Its 3 archived tabs become Uncategorized");
        expect(strings.waitingAfterDays(1)).toBe("Show as waiting after {} day");
        expect(strings.waitingAfterDays(7)).toBe("Show as waiting after {} days");
    });

    it("shows Uncategorized by its translated name and every other category as named", () => {
        expect(categoryLabel("Uncategorized")).toBe(strings.uncategorized);
        expect(categoryLabel("Work")).toBe("Work");
    });
});

describe("reminderDay", () => {
    const now = new Date(2026, 10, 3, 8, 0).getTime();
    it("names the day a reminder comes", () => {
        expect(reminderDay(now - 1, now)).toBe("due");
        expect(reminderDay(new Date(2026, 10, 3, 9, 0).getTime(), now)).toBe("today");
        expect(reminderDay(new Date(2026, 10, 4, 9, 0).getTime(), now)).toBe("tomorrow");
        expect(reminderDay(new Date(2026, 10, 10, 9, 0).getTime(), now)).toBe("later");
    });
});
