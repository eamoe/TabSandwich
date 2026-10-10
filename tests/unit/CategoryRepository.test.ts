import { describe, expect, it } from "vitest";
import {
    UNCATEGORIZED,
    addCategory,
    getCategoryColorHex,
    getSelectableCategories,
    moveCategory,
    removeCategory,
    renameCategory,
    reorderCategories,
    restoreCategory,
    setCategoryColor,
} from "../../src/domain/CategoryRepository";
import { makeTab, seed, storedSettings, storedTabs } from "./helpers";

const base = { categories: ["Work", "Personal", "Reading"], categoryColors: { Work: "purple", Personal: "coral", Reading: "teal" } };

describe("addCategory", () => {
    it("adds to the front with the next palette color", async () => {
        seed([], base);
        await addCategory("  Travel  ");
        expect(storedSettings().categories).toEqual(["Travel", "Work", "Personal", "Reading"]);
        expect(storedSettings().categoryColors.Travel).toBe("pink");
    });

    it("caps names at 15 characters and ignores empty, duplicate and reserved names", async () => {
        seed([], base);
        await addCategory("A very long category name");
        await addCategory("   ");
        await addCategory("Work");
        await addCategory(UNCATEGORIZED);
        expect(storedSettings().categories).toEqual(["A very long cat", "Work", "Personal", "Reading"]);
    });
});

describe("renameCategory", () => {
    it("renames everywhere: the list, its color, and every tab using it", async () => {
        const [w, p] = [makeTab({ category: "Work" }), makeTab({ category: "Personal" })];
        seed([w, p], base);
        expect(await renameCategory("Work", "Job")).toEqual({ renamed: true });
        expect(storedSettings().categories).toEqual(["Job", "Personal", "Reading"]);
        expect(storedSettings().categoryColors).toEqual({ Job: "purple", Personal: "coral", Reading: "teal" });
        expect(storedTabs().map((t) => t.category)).toEqual(["Job", "Personal"]);
    });

    it.each([
        ["", "empty"],
        ["Personal", "taken"],
        [UNCATEGORIZED, "taken"],
    ])("refuses %j", async (newName, reason) => {
        seed([], base);
        expect(await renameCategory("Work", newName)).toEqual({ renamed: false, reason });
        expect(storedSettings().categories).toEqual(base.categories);
    });

    it("reports a category that no longer exists", async () => {
        seed([], base);
        expect(await renameCategory("Gone", "New")).toEqual({ renamed: false, reason: "gone" });
    });
});

describe("which categories age follows renames and removals", () => {
    it("a renamed category keeps aging; a removed one is forgotten, so a new one by that name starts kept", async () => {
        seed([], { ...base, waitingCategories: ["Reading", "Uncategorized"] });
        await renameCategory("Reading", "Articles");
        expect(storedSettings().waitingCategories).toEqual(["Articles", "Uncategorized"]);
        await removeCategory("Articles");
        expect(storedSettings().waitingCategories).toEqual(["Uncategorized"]);
        await addCategory("Articles");
        expect(storedSettings().waitingCategories).toEqual(["Uncategorized"]);
    });
});

describe("removeCategory", () => {
    it("removes an unused category and its color", async () => {
        seed([makeTab({ category: "Work" })], base);
        const result = await removeCategory("Reading");
        expect(result.removed).toBe(true);
        expect(result.removedCategory).toEqual({ name: "Reading", index: 2, colorKey: "teal", waiting: true, tabIds: [] }); // Reading ages by default
        expect(storedSettings().categories).toEqual(["Work", "Personal"]);
        expect(storedSettings().categoryColors).not.toHaveProperty("Reading");
        expect(storedTabs()[0].category).toBe("Work");
    });

    it("releases the tabs that use it, archived ones too: they're stored with no category", async () => {
        const [a, b, c] = [makeTab({ category: "Personal" }), makeTab({ category: "Personal", archivedAt: 1 }), makeTab({ category: "Work" })];
        seed([a, b, c], base);
        const result = await removeCategory("Personal");
        expect(result.removedCategory?.tabIds).toEqual([a.id, b.id]);
        expect(storedSettings().categories).toEqual(["Work", "Reading"]);
        expect(storedTabs()[0]).not.toHaveProperty("category");
        expect(storedTabs()[1]).not.toHaveProperty("category");
        expect(storedTabs()[1].archivedAt).toBe(1);
        expect(storedTabs()[2].category).toBe("Work");
    });

    it("never removes Uncategorized", async () => {
        seed([], base);
        expect(await removeCategory(UNCATEGORIZED)).toEqual({ removed: false, reason: "reserved" });
    });
});

describe("restoreCategory (Undo of a removal)", () => {
    it("puts the category back in its place, with its color, its Waiting setting and its tabs", async () => {
        const [a, b] = [makeTab({ category: "Personal" }), makeTab({ category: "Personal", archivedAt: 1 })];
        seed([a, b], { ...base, waitingCategories: ["Personal", "Uncategorized"] });
        const before = { tabs: storedTabs(), settings: storedSettings() };
        const { removedCategory } = await removeCategory("Personal");
        await restoreCategory(removedCategory!);
        expect(storedTabs()).toEqual(before.tabs);
        expect(storedSettings().categories).toEqual(before.settings.categories);
        expect(storedSettings().categoryColors).toEqual(before.settings.categoryColors);
        expect(storedSettings().waitingCategories).toEqual(expect.arrayContaining(["Personal", "Uncategorized"]));
    });

    it("leaves a tab moved elsewhere in the meantime where it is", async () => {
        const [a, b] = [makeTab({ category: "Personal" }), makeTab({ category: "Personal" })];
        seed([a, b], base);
        const { removedCategory } = await removeCategory("Personal");
        seed([{ ...storedTabs()[0], category: "Work" }, storedTabs()[1]], storedSettings());
        await restoreCategory(removedCategory!);
        expect(storedTabs().map((t) => t.category)).toEqual(["Work", "Personal"]);
    });

    it("doesn't add a second category when one by that name was added since", async () => {
        const a = makeTab({ category: "Personal" });
        seed([a], base);
        const { removedCategory } = await removeCategory("Personal");
        await addCategory("Personal");
        const colorNow = storedSettings().categoryColors.Personal;
        await restoreCategory(removedCategory!);
        expect(storedSettings().categories.filter((c) => c === "Personal")).toHaveLength(1);
        expect(storedSettings().categoryColors.Personal).toBe(colorNow);
        expect(storedTabs()[0].category).toBe("Personal");
    });
});

describe("ordering and colors", () => {
    it("moves a category up or down, staying put at either end", async () => {
        seed([], base);
        await moveCategory("Personal", "up");
        expect(storedSettings().categories).toEqual(["Personal", "Work", "Reading"]);
        await moveCategory("Personal", "up");
        expect(storedSettings().categories).toEqual(["Personal", "Work", "Reading"]);
        await moveCategory("Reading", "down");
        expect(storedSettings().categories).toEqual(["Personal", "Work", "Reading"]);
    });

    it("drag-reorders a category onto another's position", async () => {
        seed([], base);
        await reorderCategories("Reading", "Work");
        expect(storedSettings().categories).toEqual(["Reading", "Work", "Personal"]);
    });

    it("only accepts colors from the palette", async () => {
        seed([], base);
        await setCategoryColor("Work", "blue");
        await setCategoryColor("Work", "#ff0000");
        expect(storedSettings().categoryColors.Work).toBe("blue");
    });

    it("resolves display colors, with a neutral one for Uncategorized", () => {
        expect(getCategoryColorHex("Work", { Work: "teal" })).toBe("#2DBEA6");
        expect(getCategoryColorHex("Unknown", {})).toBe("#6C63C5");
        expect(getCategoryColorHex(UNCATEGORIZED, {})).toBe("#B9B4CF");
    });

    it("lists Uncategorized last among selectable categories", async () => {
        seed([], base);
        expect(await getSelectableCategories()).toEqual(["Work", "Personal", "Reading", UNCATEGORIZED]);
    });
});
