import { describe, expect, it } from "vitest";
import { addTab, deleteTab, editTab, reorderTabs, restoreTab } from "../../src/domain/TabRepository";
import { makeTab, seed, storedTabs } from "./helpers";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("addTab", () => {
    it("saves new tabs first, with a UUID id and the current time", async () => {
        const existing = makeTab();
        seed([existing]);
        const before = Date.now();
        const { tab, duplicate } = await addTab({ title: "New", url: "https://new.example.com/", category: "Work" });
        expect(duplicate).toBe(false);
        expect(tab.id).toMatch(UUID);
        expect(tab.savedAt).toBeGreaterThanOrEqual(before);
        expect(storedTabs().map((t) => t.id)).toEqual([tab.id, existing.id]);
    });

    it("returns the existing tab untouched when the URL is already saved", async () => {
        const existing = makeTab({ url: "https://a.com/docs" });
        seed([existing]);
        const result = await addTab({ title: "Again", url: "https://a.com/docs/#section" });
        expect(result).toEqual({ tab: existing, duplicate: true });
        expect(storedTabs()).toEqual([existing]);
    });

    it("gives every tab a distinct id even when many are saved at once", async () => {
        seed([]);
        await Promise.all(Array.from({ length: 20 }, (_, i) => addTab({ title: `T${i}`, url: `https://site${i}.example.com` })));
        const ids = storedTabs().map((t) => t.id);
        expect(ids).toHaveLength(20);
        expect(new Set(ids).size).toBe(20);
    });
});

describe("editTab", () => {
    it("updates only the given tab", async () => {
        const [a, b] = [makeTab(), makeTab()];
        seed([a, b]);
        expect(await editTab(a.id, { title: "Renamed", category: "Reading" })).toEqual({ duplicateOf: null });
        expect(storedTabs()).toEqual([{ ...a, title: "Renamed", category: "Reading" }, b]);
    });

    it("refuses to change a URL into one that's already saved, and changes nothing", async () => {
        const [a, b] = [makeTab({ url: "https://a.com/" }), makeTab({ url: "https://b.com/" })];
        seed([a, b]);
        expect(await editTab(a.id, { title: "New title", url: "https://b.com" })).toEqual({ duplicateOf: b });
        expect(storedTabs()).toEqual([a, b]);
    });

    it("allows changing a URL to another address for the same page", async () => {
        const a = makeTab({ url: "https://a.com/docs" });
        seed([a, makeTab()]);
        expect(await editTab(a.id, { url: "https://a.com/docs/#intro" })).toEqual({ duplicateOf: null });
        expect(storedTabs()[0].url).toBe("https://a.com/docs/#intro");
    });

    it("still allows editing the title of a row that duplicates another (e.g. from old data)", async () => {
        const [a, b] = [makeTab({ url: "https://same.com/" }), makeTab({ url: "https://same.com/" })];
        seed([a, b]);
        expect(await editTab(b.id, { title: "Fixed", url: "https://same.com/" })).toEqual({ duplicateOf: null });
        expect(storedTabs()[1].title).toBe("Fixed");
    });
});

describe("deleteTab / restoreTab", () => {
    it("removes the tab immediately and reports where it was", async () => {
        const [a, b, c] = [makeTab(), makeTab(), makeTab()];
        seed([a, b, c]);
        expect(await deleteTab(b.id)).toEqual({ tab: b, index: 1 });
        expect(storedTabs()).toEqual([a, c]);
    });

    it("returns null for a tab that's already gone", async () => {
        seed([makeTab()]);
        expect(await deleteTab("missing")).toBeNull();
    });

    it("puts a restored tab back at its exact original position", async () => {
        const [a, b, c] = [makeTab(), makeTab(), makeTab()];
        seed([a, b, c]);
        const deleted = await deleteTab(b.id);
        await restoreTab(deleted!.tab, deleted!.index);
        expect(storedTabs()).toEqual([a, b, c]);
    });

    it("clamps the position if the list shrank during the undo window", async () => {
        const [a, b, c] = [makeTab(), makeTab(), makeTab()];
        seed([a, b, c]);
        const deleted = await deleteTab(c.id);
        await deleteTab(a.id);
        await deleteTab(b.id);
        await restoreTab(deleted!.tab, deleted!.index);
        expect(storedTabs()).toEqual([c]);
    });
});

describe("reorderTabs", () => {
    it("moves a tab to where the target tab is", async () => {
        const [a, b, c] = [makeTab(), makeTab(), makeTab()];
        seed([a, b, c]);
        await reorderTabs(a.id, c.id);
        expect(storedTabs().map((t) => t.id)).toEqual([b.id, c.id, a.id]);
        await reorderTabs(a.id, b.id);
        expect(storedTabs().map((t) => t.id)).toEqual([a.id, b.id, c.id]);
    });

    it("ignores unknown ids and dropping a tab on itself", async () => {
        const tabs = [makeTab(), makeTab()];
        seed(tabs);
        await reorderTabs(tabs[0].id, "missing");
        await reorderTabs(tabs[0].id, tabs[0].id);
        expect(storedTabs()).toEqual(tabs);
    });
});
