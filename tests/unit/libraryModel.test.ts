import { describe, expect, it } from "vitest";
import { ALL, ARCHIVED, OUTDATED } from "../../src/ui/main/listModel";
import { DEFAULT_LIBRARY_SORT, filterLibrary, nextSort, rowsInView, sidebarCounts, sortLibrary, windowFilter } from "../../src/ui/library/libraryModel";
import { DEFAULT_SETTINGS } from "../../src/storage/chromeStorage";
import { makeTab } from "./helpers";

const day = (n: number) => Date.UTC(2026, 9, n);
const titles = (tabs: { title: string }[]) => tabs.map((t) => t.title);

describe("sorting the library", () => {
    const tabs = [
        makeTab({ title: "banana", url: "https://z.example.com/", category: "Work", savedAt: day(2), lastOpenedAt: day(9) }),
        makeTab({ title: "Apple", url: "https://y.example.com/", category: "Reading", savedAt: day(3) }),
        makeTab({ title: "cherry", url: "https://www.a.example.com/", savedAt: day(1), lastOpenedAt: day(8) }),
    ];

    it("starts on newest saved, and sorts each column both ways", () => {
        expect(titles(sortLibrary(tabs, DEFAULT_LIBRARY_SORT))).toEqual(["Apple", "banana", "cherry"]);
        expect(titles(sortLibrary(tabs, { column: "saved", ascending: true }))).toEqual(["cherry", "banana", "Apple"]);
        expect(titles(sortLibrary(tabs, { column: "title", ascending: true }))).toEqual(["Apple", "banana", "cherry"]);
        expect(titles(sortLibrary(tabs, { column: "title", ascending: false }))).toEqual(["cherry", "banana", "Apple"]);
        expect(titles(sortLibrary(tabs, { column: "category", ascending: true }))).toEqual(["Apple", "cherry", "banana"]);
        expect(titles(sortLibrary(tabs, { column: "site", ascending: true }))).toEqual(["cherry", "Apple", "banana"]);
    });

    it("counts a tab never opened as the longest ago", () => {
        expect(titles(sortLibrary(tabs, { column: "opened", ascending: false }))).toEqual(["banana", "cherry", "Apple"]);
    });

    it("breaks ties by title, leaving what it's given alone", () => {
        const same = [makeTab({ title: "b", savedAt: day(1) }), makeTab({ title: "a", savedAt: day(1) })];
        expect(titles(sortLibrary(same, { column: "saved", ascending: false }))).toEqual(["a", "b"]);
        expect(titles(same)).toEqual(["b", "a"]);
    });

    it("turns a column around on the second click; text starts A to Z, dates newest", () => {
        expect(nextSort({ column: "title", ascending: true }, "title")).toEqual({ column: "title", ascending: false });
        expect(nextSort(DEFAULT_LIBRARY_SORT, "site")).toEqual({ column: "site", ascending: true });
        expect(nextSort(DEFAULT_LIBRARY_SORT, "opened")).toEqual({ column: "opened", ascending: false });
    });
});

describe("filtering and counting", () => {
    const settings = { ...DEFAULT_SETTINGS, categories: ["Work", "Reading"], waitingCategories: ["Reading"], outdatedDays: 7 };
    const tabs = [
        makeTab({ title: "old read", category: "Reading", savedAt: Date.now() - 30 * 86_400_000 }),
        makeTab({ title: "in window", category: "Work", groupId: "w", savedAt: Date.now() }),
        makeTab({ title: "archived in window", category: "Work", groupId: "w", archivedAt: 1, savedAt: Date.now() }),
        makeTab({ title: "loose", savedAt: Date.now() }),
    ];

    it("adds saved windows to the usual filters, without what's archived", () => {
        expect(titles(filterLibrary(tabs, settings, windowFilter("w")))).toEqual(["in window"]);
        expect(titles(filterLibrary(tabs, settings, ARCHIVED))).toEqual(["archived in window"]);
        expect(titles(filterLibrary(tabs, settings, OUTDATED))).toEqual(["old read"]);
    });

    it("counts what each filter shows, the archive apart", () => {
        const counts = sidebarCounts(tabs, settings);
        expect(counts.get(ALL)).toBe(3);
        expect(counts.get(ARCHIVED)).toBe(1);
        expect(counts.get(OUTDATED)).toBe(1);
        expect(counts.get("Work")).toBe(1);
        expect(counts.get("Uncategorized")).toBe(1);
        expect(counts.get(windowFilter("w"))).toBe(1);
    });
});

describe("rows in view", () => {
    it("draws only what's on screen plus a few either side", () => {
        expect(rowsInView(1000, 48, 0, 480, 8)).toEqual({ start: 0, end: 18 });
        expect(rowsInView(1000, 48, 4800, 480, 8)).toEqual({ start: 92, end: 118 });
        expect(rowsInView(1000, 48, 47_520, 480, 8)).toEqual({ start: 982, end: 1000 });
    });

    it("copes with a list shorter than the window, and a scroll position left over from a longer one", () => {
        expect(rowsInView(3, 48, 0, 480)).toEqual({ start: 0, end: 3 });
        expect(rowsInView(3, 48, 9000, 480)).toEqual({ start: 3, end: 3 });
        expect(rowsInView(0, 48, 0, 480)).toEqual({ start: 0, end: 0 });
    });
});
