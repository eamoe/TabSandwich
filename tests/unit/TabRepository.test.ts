import { describe, expect, it } from "vitest";
import { addTab, addTabs, deleteTab, deleteTabs, moveTab, placeTab, restoreCategories, restoreTabs, setCategoryOf, undoMoveTab, editTab, putBackTab, refreshTab, reorderTabs, restoreTab, setPinned, archiveTabs, unarchiveTabs, tidyNote, MAX_NOTE_LENGTH } from "../../src/domain/TabRepository";
import { makeGroup, makeTab, seed, seedGroups, storedGroups, storedTabs } from "./helpers";
import { storage } from "./setup";

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

describe("addTabs", () => {
    it("saves new pages at the top in the given order, in one category, skipping saved ones", async () => {
        const existing = makeTab({ url: "https://saved.example.com/" });
        seed([existing]);
        const { added, duplicates } = await addTabs(
            [
                { title: "One", url: "https://one.example.com/" },
                { title: "Saved", url: "https://saved.example.com" },
                { title: "Two", url: "https://two.example.com/" },
                { title: "One again", url: "https://one.example.com/#top" },
            ],
            "Reading"
        );
        expect(added.map((t) => t.title)).toEqual(["One", "Two"]);
        expect(added.every((t) => t.category === "Reading" && UUID.test(t.id))).toBe(true);
        expect(duplicates).toBe(2);
        expect(storedTabs().map((t) => t.title)).toEqual(["One", "Two", existing.title]);
    });

    it("puts two or more new tabs in one collapsed saved window, written in the same write", async () => {
        const bagel = makeGroup({ name: "Crispy Bagel" });
        seed([makeTab({ groupId: bagel.id })]);
        seedGroups([bagel]);
        const writes: string[][] = [];
        let offered: string[] = [];
        storage.rejectSet = (items) => {
            writes.push(Object.keys(items).sort());
            return null;
        };
        const { added, group } = await addTabs(
            [
                { title: "One", url: "https://one.example.com/" },
                { title: "Two", url: "https://two.example.com/" },
            ],
            undefined,
            (taken) => {
                offered = taken;
                return "Toasted Rye";
            }
        );
        // Named knowing which names are taken, so it can pick another.
        expect(offered).toEqual(["Crispy Bagel"]);
        expect(group).toEqual(expect.objectContaining({ name: "Toasted Rye", collapsed: true }));
        expect(added.every((t) => t.groupId === group!.id)).toBe(true);
        expect(storedGroups().map((g) => g.name)).toEqual(["Toasted Rye", "Crispy Bagel"]);
        expect(writes).toEqual([["tabSandwich.groups", "tabSandwich.tabs"]]);
    });

    it("doesn't count the name of a window none of whose tabs are saved any more as taken", async () => {
        seed([makeTab()]);
        seedGroups([makeGroup({ name: "Crispy Bagel" })]);
        let offered: string[] = ["?"];
        await addTabs([{ title: "One", url: "https://one.example.com/" }, { title: "Two", url: "https://two.example.com/" }], undefined, (taken) => {
            offered = taken;
            return "Crispy Bagel";
        });
        expect(offered).toEqual([]);
    });

    it("makes no saved window for a single new tab", async () => {
        seed([]);
        const { added, group } = await addTabs([{ title: "One", url: "https://one.example.com/" }], undefined, () => "Window");
        expect(group).toBeNull();
        expect(added[0].groupId).toBeUndefined();
        expect(storedGroups()).toEqual([]);
    });

    it("writes nothing when every page is already saved", async () => {
        const existing = makeTab({ url: "https://saved.example.com/" });
        seed([existing]);
        expect(await addTabs([{ title: "Saved", url: "https://saved.example.com/" }], undefined, () => "Window")).toEqual({ added: [], duplicates: 1, group: null });
        expect(storedTabs()).toEqual([existing]);
    });
});

describe("setCategoryOf / restoreCategories", () => {
    it("moves several tabs into one category in one write, and Undo puts each back", async () => {
        const tabs = [makeTab({ category: "Work" }), makeTab(), makeTab({ category: "Reading" })];
        seed(tabs);
        const previous = await setCategoryOf([tabs[0].id, tabs[1].id, "gone"], "Reading");
        expect(previous).toEqual([
            { id: tabs[0].id, category: "Work" },
            { id: tabs[1].id, category: undefined },
        ]);
        expect(storedTabs().map((t) => t.category)).toEqual(["Reading", "Reading", "Reading"]);
        await restoreCategories(previous);
        expect(storedTabs().map((t) => t.category)).toEqual(["Work", undefined, "Reading"]);
    });

    it("moves to Uncategorized", async () => {
        const tab = makeTab({ category: "Work" });
        seed([tab]);
        await setCategoryOf([tab.id], undefined);
        expect(storedTabs()[0].category).toBeUndefined();
    });
});

describe("moveTab / undoMoveTab", () => {
    it("moves a tab into a saved window, and out of one, and Undo puts it back exactly", async () => {
        const tabs = [makeTab(), makeTab({ groupId: "g" }), makeTab({ groupId: "g" }), makeTab()];
        seed(tabs);
        const into = await moveTab(tabs[3].id, tabs[2].id, "g");
        expect(storedTabs().map((t) => [t.id, t.groupId])).toEqual([
            [tabs[0].id, undefined],
            [tabs[1].id, "g"],
            [tabs[3].id, "g"],
            [tabs[2].id, "g"],
        ]);
        await undoMoveTab(into!);
        expect(storedTabs()).toEqual(tabs);

        // Out, staying in place (Alt+arrow past the window's edge).
        const out = await moveTab(tabs[1].id, tabs[1].id, null);
        expect(storedTabs()[1]).not.toHaveProperty("groupId");
        expect(storedTabs().map((t) => t.id)).toEqual(tabs.map((t) => t.id));
        await undoMoveTab(out!);
        expect(storedTabs()).toEqual(tabs);
    });

    it("does nothing when either tab is gone", async () => {
        seed([makeTab()]);
        expect(await moveTab("nope", "nope", null)).toBeNull();
    });

    it("placeTab puts a tab just above or below another, wherever it came from, with Undo", async () => {
        const tabs = [makeTab({ groupId: "g" }), makeTab({ groupId: "g" }), makeTab(), makeTab()];
        seed(tabs);
        // Out of the window, onto a loose tab's upper half: it takes that tab's place, the rest move down.
        const out = await placeTab(tabs[0].id, tabs[3].id, "before", null);
        expect(storedTabs().map((t) => t.id)).toEqual([tabs[1].id, tabs[2].id, tabs[0].id, tabs[3].id]);
        expect(storedTabs()[2]).not.toHaveProperty("groupId");
        await undoMoveTab(out!);
        expect(storedTabs()).toEqual(tabs);
        // Below the last tab: the very end is reachable.
        await placeTab(tabs[0].id, tabs[3].id, "after", null);
        expect(storedTabs().at(-1)!.id).toBe(tabs[0].id);
        // Into the window, above its first tab.
        await placeTab(tabs[2].id, tabs[1].id, "before", "g");
        expect(storedTabs().map((t) => [t.id, t.groupId])).toEqual([
            [tabs[2].id, "g"],
            [tabs[1].id, "g"],
            [tabs[3].id, undefined],
            [tabs[0].id, undefined],
        ]);
        // Next to itself: stays put, only its window changes.
        await placeTab(tabs[2].id, tabs[2].id, "before", null);
        expect(storedTabs()[0]).toEqual(expect.objectContaining({ id: tabs[2].id }));
        expect(storedTabs()[0]).not.toHaveProperty("groupId");
    });
});

describe("deleteTabs / restoreTabs", () => {
    it("deletes several tabs in one write, and Undo puts each back in its place", async () => {
        const tabs = [makeTab(), makeTab(), makeTab(), makeTab(), makeTab()];
        seed(tabs);
        const removed = await deleteTabs([tabs[3].id, tabs[0].id, "gone"]);
        expect(removed.map((r) => [r.tab.id, r.index])).toEqual([
            [tabs[0].id, 0],
            [tabs[3].id, 3],
        ]);
        expect(storedTabs().map((t) => t.id)).toEqual([tabs[1].id, tabs[2].id, tabs[4].id]);
        await restoreTabs(removed);
        expect(storedTabs()).toEqual(tabs);
        // A second Undo doesn't duplicate anything.
        await restoreTabs(removed);
        expect(storedTabs()).toEqual(tabs);
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

describe("refreshTab / putBackTab (Update in the save card, and its Undo)", () => {
    it("takes the page's title, exact address and the chosen category, and counts as saved now", async () => {
        const old = makeTab({ title: "Old title", url: "https://a.example.com/page", category: "Work", savedAt: Date.UTC(2025, 0, 1) });
        const other = makeTab();
        seed([other, old]);
        const before = Date.now();
        const previous = await refreshTab(old.id, { title: "New title", url: "https://a.example.com/page/", category: "Reading" });
        expect(previous).toEqual(old);
        const [, refreshed] = storedTabs();
        expect(refreshed).toMatchObject({ id: old.id, title: "New title", url: "https://a.example.com/page/", category: "Reading" });
        expect(refreshed.savedAt).toBeGreaterThanOrEqual(before);
        // Stays where it was in your own order, and nothing else changes.
        expect(storedTabs().map((t) => t.id)).toEqual([other.id, old.id]);
        expect(storedTabs()[0]).toEqual(other);
    });

    it("can move a tab to Uncategorized", async () => {
        const tab = makeTab({ category: "Work" });
        seed([tab]);
        await refreshTab(tab.id, { title: tab.title, url: tab.url, category: undefined });
        expect(storedTabs()[0].category).toBeUndefined();
    });

    it("writes nothing for a tab that's gone", async () => {
        const tab = makeTab();
        seed([tab]);
        expect(await refreshTab("missing", { title: "x", url: "https://x.example.com" })).toBeNull();
        expect(storedTabs()).toEqual([tab]);
    });

    it("Undo puts the tab back exactly as it was, in its place", async () => {
        const [a, b] = [makeTab({ title: "A" }), makeTab({ title: "B", savedAt: Date.UTC(2025, 5, 1) })];
        seed([a, b]);
        const previous = await refreshTab(b.id, { title: "B2", url: "https://b2.example.com" });
        await putBackTab(previous!);
        expect(storedTabs()).toEqual([a, b]);
    });

    it("Undo does nothing if the tab was deleted in the meantime", async () => {
        const tab = makeTab();
        seed([tab]);
        const previous = await refreshTab(tab.id, { title: "New", url: tab.url });
        await deleteTab(tab.id);
        await putBackTab(previous!);
        expect(storedTabs()).toEqual([]);
    });
});

describe("setPinned", () => {
    it("pins a loose tab to the end of the pinned ones; unpinning leaves it just below them", async () => {
        const [p, a, b, c] = [makeTab({ pinned: true }), makeTab(), makeTab(), makeTab()];
        seed([a, p, b, c]);
        const pinned = await setPinned(c.id, true);
        expect(pinned).toMatchObject({ id: c.id, pinned: true });
        expect(storedTabs().map((t) => t.id)).toEqual([a.id, p.id, c.id, b.id]);
        await setPinned(c.id, false);
        expect(storedTabs().find((t) => t.id === c.id)).not.toHaveProperty("pinned");
        expect(storedTabs().map((t) => t.id)).toEqual([a.id, p.id, c.id, b.id]);
    });

    it("with nothing pinned yet, a pinned tab goes first; one inside a saved window stays put", async () => {
        const group = makeGroup();
        const [a, m1, m2] = [makeTab(), makeTab({ groupId: group.id }), makeTab({ groupId: group.id })];
        seed([a, m1, m2]);
        seedGroups([group]);
        await setPinned(m2.id, true);
        expect(storedTabs().map((t) => t.id)).toEqual([a.id, m1.id, m2.id]);
        await setPinned(a.id, false);
        await setPinned(m1.id, false);
        const b = makeTab();
        seed([a, b]);
        await setPinned(b.id, true);
        expect(storedTabs().map((t) => t.id)).toEqual([b.id, a.id]);
    });

    it("returns null for a tab that's gone", async () => {
        seed([makeTab()]);
        expect(await setPinned("nope", true)).toBeNull();
    });
});

describe("archiveTabs / unarchiveTabs", () => {
    it("marks tabs archived where they stand (order and window kept), and restores them as they were", async () => {
        const group = makeGroup();
        const [a, b, c] = [makeTab(), makeTab({ groupId: group.id }), makeTab({ pinned: true })];
        seed([a, b, c]);
        const before = Date.now();
        expect(await archiveTabs([b.id, c.id, "gone"])).toEqual([b.id, c.id]);
        const stored = storedTabs();
        expect(stored.map((t) => t.id)).toEqual([a.id, b.id, c.id]);
        expect(stored[1]).toMatchObject({ groupId: group.id });
        expect(stored[1].archivedAt).toBeGreaterThanOrEqual(before);
        // Already archived: skipped, so Undo of a second archive doesn't restore the first.
        expect(await archiveTabs([b.id])).toEqual([]);

        expect(await unarchiveTabs([b.id, c.id, a.id])).toEqual([b.id, c.id]);
        expect(storedTabs()).toEqual([a, b, c]);
    });

    it("a pinned tab inside a window whose other tabs are archived counts as loose when pinned again", async () => {
        const group = makeGroup();
        const [a, m1, m2] = [makeTab(), makeTab({ groupId: group.id }), makeTab({ groupId: group.id, archivedAt: 1 })];
        seed([a, m1, m2]);
        seedGroups([group]);
        await setPinned(m1.id, true);
        expect(storedTabs().map((t) => t.id)).toEqual([m1.id, a.id, m2.id]);
    });
});

describe("notes", () => {
    it("are one tidy line, at most MAX_NOTE_LENGTH characters; blank is no note", () => {
        expect(tidyNote("  auth   endpoints\nfor mobile ")).toBe("auth endpoints for mobile");
        expect(tidyNote("x".repeat(200))).toHaveLength(MAX_NOTE_LENGTH);
        expect(tidyNote("   ")).toBeUndefined();
        expect(tidyNote(undefined)).toBeUndefined();
    });

    it("are saved with a new tab, changed or cleared by an edit, and kept by edits that don't touch them", async () => {
        seed([]);
        const { tab } = await addTab({ title: "API", url: "https://api.example.com/", note: " why: auth " });
        expect(storedTabs()[0].note).toBe("why: auth");
        await editTab(tab.id, { title: "API docs" });
        expect(storedTabs()[0]).toMatchObject({ title: "API docs", note: "why: auth" });
        await editTab(tab.id, { note: "for the mobile app" });
        expect(storedTabs()[0].note).toBe("for the mobile app");
        await editTab(tab.id, { note: "  " });
        expect(storedTabs()[0]).not.toHaveProperty("note");
        const { tab: plain } = await addTab({ title: "Plain", url: "https://plain.example.com/", note: "" });
        expect(plain).not.toHaveProperty("note");
    });
});
