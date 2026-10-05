import { describe, expect, it } from "vitest";
import { ALL, OUTDATED, applyFilter, categoriesInUse, effectiveFilter, filterOptions, siteName, sortTabs } from "../../src/ui/main/listModel";
import { DEFAULT_SETTINGS } from "../../src/storage/chromeStorage";
import { makeTab } from "./helpers";

const DAY = 24 * 60 * 60 * 1000;
const settings = { ...DEFAULT_SETTINGS, categories: ["Work", "Reading"] };

describe("filters on the main list", () => {
    const now = Date.now();
    const tabs = [
        makeTab({ category: "Reading", savedAt: now }),
        makeTab({ category: "Work", savedAt: now - 30 * DAY }),
        makeTab({ savedAt: now }),
        makeTab({ category: "Hobby", savedAt: now }),
    ];

    it("lists All, then Outdated, then categories in Settings order, strays, and Uncategorized last", () => {
        expect(filterOptions(tabs, settings)).toEqual([
            { key: ALL, count: 4 },
            { key: OUTDATED, count: 1 },
            { key: "Work", count: 1 },
            { key: "Reading", count: 1 },
            { key: "Hobby", count: 1 },
            { key: "Uncategorized", count: 1 },
        ]);
    });

    it("offers no Outdated filter while outdated flagging is off", () => {
        expect(filterOptions(tabs, { ...settings, outdatedEnabled: false }).map((o) => o.key)).not.toContain(OUTDATED);
    });

    it("leaves out categories nothing uses", () => {
        expect(categoriesInUse([makeTab({ category: "Work" })], ["Reading", "Work"])).toEqual(["Work"]);
    });

    it("falls back to All when the chosen filter has nothing left to show", () => {
        const options = filterOptions([makeTab({ category: "Work", savedAt: Date.now() })], settings);
        expect(effectiveFilter("Reading", options)).toBe(ALL);
        expect(effectiveFilter("Work", options)).toBe("Work");
    });

    it("shows only the chosen category, or only outdated tabs", () => {
        expect(applyFilter(tabs, settings, "Work")).toEqual([tabs[1]]);
        expect(applyFilter(tabs, settings, OUTDATED)).toEqual([tabs[1]]);
        expect(applyFilter(tabs, settings, "Uncategorized")).toEqual([tabs[2]]);
        expect(applyFilter(tabs, settings, ALL)).toEqual(tabs);
    });
});

describe("siteName", () => {
    it("drops the scheme, path and a leading www.", () => {
        expect(siteName("https://www.github.com/eamoe/TabSandwich")).toBe("github.com");
        expect(siteName("https://docs.google.com/doc")).toBe("docs.google.com");
    });
});

describe("sorting the main list", () => {
    const day = (n: number) => Date.UTC(2026, 0, n);
    // Your own order: the order they're stored in.
    const tabs = [
        makeTab({ title: "banana bread", url: "https://www.recipes.example/banana", savedAt: day(3) }),
        makeTab({ title: "Apple pie", url: "https://zeta.example/apple", savedAt: day(1) }),
        makeTab({ title: "Chapter 10", url: "https://books.example/10", savedAt: day(5) }),
        makeTab({ title: "Chapter 9", url: "https://books.example/9", savedAt: day(5) }),
    ];
    const titles = (list: typeof tabs) => list.map((t) => t.title);

    it("leaves your own order exactly as stored", () => {
        expect(sortTabs(tabs, "custom")).toBe(tabs);
    });

    it("sorts by when they were saved, keeping your order between tabs saved at the same moment", () => {
        expect(titles(sortTabs(tabs, "newest"))).toEqual(["Chapter 10", "Chapter 9", "banana bread", "Apple pie"]);
        expect(titles(sortTabs(tabs, "oldest"))).toEqual(["Apple pie", "banana bread", "Chapter 10", "Chapter 9"]);
    });

    it("sorts titles the way people read them: ignoring case, with numbers in number order", () => {
        expect(titles(sortTabs(tabs, "title"))).toEqual(["Apple pie", "banana bread", "Chapter 9", "Chapter 10"]);
    });

    it("sorts by site name as shown under the title (no www.), then by title", () => {
        expect(titles(sortTabs(tabs, "site"))).toEqual(["Chapter 9", "Chapter 10", "banana bread", "Apple pie"]);
    });

    it("never changes the list it was given, so switching back to your own order restores it", () => {
        const before = titles(tabs);
        sortTabs(tabs, "title");
        sortTabs(tabs, "newest");
        expect(titles(tabs)).toEqual(before);
    });
});
