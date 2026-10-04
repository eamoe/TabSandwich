import { describe, expect, it } from "vitest";
import { ALL, OUTDATED, applyFilter, categoriesInUse, effectiveFilter, filterOptions, siteName } from "../../src/ui/main/listModel";
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
