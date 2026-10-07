import { describe, expect, it } from "vitest";
import { ALL, OUTDATED, applyFilter, categoriesInUse, effectiveFilter, filterOptions, siteName, sortTabs, groupItems, newGroupName, reorderTarget, dropTarget, type ListItem } from "../../src/ui/main/listModel";
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

describe("saved windows in the list", () => {
    const g = { id: "g", name: "Research", createdAt: 0, collapsed: false };
    const [a, m1, m2, m3, z] = [
        makeTab({ id: "a" }),
        makeTab({ id: "m1", groupId: "g" }),
        makeTab({ id: "m2", groupId: "g" }),
        makeTab({ id: "m3", groupId: "g" }),
        makeTab({ id: "z" }),
    ];
    const items = groupItems([a, m1, m2, m3, z], [g]);
    const shape = (list: ListItem[]) => list.map((i) => (i.kind === "tab" ? i.tab.id : `[${i.tabs.map((t) => t.id).join(",")}]`));

    it("puts a window where its first tab falls, holding its tabs in the same order", () => {
        expect(shape(items)).toEqual(["a", "[m1,m2,m3]", "z"]);
        // Sorted differently, the window moves with its first tab, and its tabs follow the sort.
        expect(shape(groupItems([m3, a, m1, z, m2], [g]))).toEqual(["[m3,m1,m2]", "a", "z"]);
    });

    it("shows a window down to one tab, or a tab naming a window that's gone, as a plain tab", () => {
        expect(shape(groupItems([a, m1], [g]))).toEqual(["a", "m1"]);
        expect(shape(groupItems([m1, m2], []))).toEqual(["m1", "m2"]);
    });

    it("names a saved window at random, sandwich-style, never reusing a name in use", () => {
        const first = () => 0;
        expect(newGroupName([], first)).toBe("Toasted Rye");
        expect(newGroupName([], () => 0.999)).toBe("Seeded Mustard");
        expect(newGroupName([], Math.random)).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/);
        // Taken: it tries again; with every pairing it draws taken, it adds a number.
        let n = 0;
        expect(newGroupName(["Toasted Rye"], () => (n++ < 2 ? 0 : 0.05))).toBe("Crispy Bagel");
        expect(newGroupName(["Toasted Rye", "Toasted Rye 2"], first)).toBe("Toasted Rye 3");
    });

    it("Alt+arrows: a window's tab moves within it and steps out past its edge; a loose tab skips a whole window", () => {
        expect(reorderTarget(items, "m1", "down")).toEqual({ to: "m2", group: "g" });
        // Out of the window, staying where it is.
        expect(reorderTarget(items, "m1", "up")).toEqual({ to: "m1", group: null });
        expect(reorderTarget(items, "m3", "down")).toEqual({ to: "m3", group: null });
        expect(reorderTarget(items, "a", "down")).toEqual({ to: "m3", group: null });
        expect(reorderTarget(items, "z", "up")).toEqual({ to: "m1", group: null });
        expect(reorderTarget(items, "a", "up")).toBeNull();
        expect(reorderTarget(items, "nope", "down")).toBeNull();
    });

    it("drag and drop: a tab joins the window of the tab it's dropped on, or leaves its own", () => {
        expect(dropTarget(items, "a", { tabId: "z" })).toEqual({ to: "z", group: null });
        expect(dropTarget(items, "m1", { tabId: "m3" })).toEqual({ to: "m3", group: "g" });
        // Into the window, and out of it.
        expect(dropTarget(items, "a", { tabId: "m2" })).toEqual({ to: "m2", group: "g" });
        expect(dropTarget(items, "m1", { tabId: "z" })).toEqual({ to: "z", group: null });
        expect(dropTarget(items, "a", { tabId: "a" })).toBeNull();
        // On the window's own row: just past it, outside, on the side the tab came from
        // (before it, for one of its own tabs).
        expect(dropTarget(items, "a", { groupId: "g" })).toEqual({ to: "m3", group: null });
        expect(dropTarget(items, "z", { groupId: "g" })).toEqual({ to: "m1", group: null });
        expect(dropTarget(items, "m2", { groupId: "g" })).toEqual({ to: "m1", group: null });
    });
});
