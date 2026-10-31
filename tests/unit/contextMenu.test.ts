// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { addCategory, removeCategory } from "../../src/domain/CategoryRepository";
import { readLinkText, rebuildMenu, saveFromMenu } from "../../src/worker/contextMenu";
import { storage } from "./setup";
import { seed, storedTabs } from "./helpers";

const click = (category: string, target: Partial<chrome.contextMenus.OnClickData>, tab?: Partial<chrome.tabs.Tab>) =>
    saveFromMenu({ menuItemId: `save:${category}`, pageUrl: "https://page.example.com/", editable: false, ...target } as chrome.contextMenus.OnClickData, { id: 1, ...tab } as chrome.tabs.Tab);

describe("the right-click menu", () => {
    it("has one item per category, Uncategorized last, under Save to Tab Sandwich", async () => {
        seed([], { categories: ["Work", "Reading"] });
        await rebuildMenu();
        expect(storage.menu).toEqual([
            { id: "save", title: "Save to Tab Sandwich" },
            { id: "save:Work", parentId: "save", title: "Work" },
            { id: "save:Reading", parentId: "save", title: "Reading" },
            { id: "save:Uncategorized", parentId: "save", title: "Uncategorized" },
        ]);
    });

    it("follows the categories, and rebuilds asked for at once don't trip over each other", async () => {
        seed([], { categories: ["Work"] });
        await Promise.all([rebuildMenu(), rebuildMenu(), rebuildMenu()]);
        await addCategory("Travel");
        await removeCategory("Work");
        await rebuildMenu();
        expect(storage.menu.map((item) => item.title)).toEqual(["Save to Tab Sandwich", "Travel", "Uncategorized"]);
    });
});

describe("saving from the menu", () => {
    it("falls back to what's selected, then the site, when the page can't be read", async () => {
        seed([]);
        storage.pageReply = new Error("Cannot access contents of the page");
        await click("Work", { linkUrl: "https://a.example.com/x", selectionText: " Selected " });
        await click("Work", { linkUrl: "https://b.example.com/y" });
        expect(storedTabs().map((t) => t.title)).toEqual(["b.example.com", "Selected"]);
        expect(storage.badge.text).toBe("✓");
    });

    it("upgrades stored data first, when the worker is the first to write after an update", async () => {
        seed([]);
        storage.data["tabSandwich.schemaVersion"] = 2;
        await click("Work", { linkUrl: "https://a.example.com/x" });
        expect(storage.data["tabSandwich.schemaVersion"]).toBe(3);
        expect(storedTabs()).toHaveLength(1);
    });

    it("says so on the badge when the save fails, or the link isn't a web page", async () => {
        seed([]);
        storage.failNextSetWith = new Error("QUOTA_BYTES quota exceeded");
        storage.data["tabSandwich.schemaVersion"] = 3;
        await click("Work", { linkUrl: "https://a.example.com/x" });
        expect(storage.badge.text).toBe("!");
        storage.badge.text = "";
        await click("Work", { linkUrl: "javascript:void(0)" });
        expect(storage.badge.text).toBe("!");
        expect(storedTabs()).toEqual([]);
    });

    it("ignores the parent item", async () => {
        seed([]);
        await saveFromMenu({ menuItemId: "save", pageUrl: "https://a.example.com/", editable: false } as chrome.contextMenus.OnClickData, undefined);
        expect(storedTabs()).toEqual([]);
    });
});

describe("reading a link's words on the page", () => {
    it("takes the link's own text, tidied, skipping an empty link to the same place", () => {
        document.body.innerHTML = `<a href="https://a.example.com/x"></a><a href="https://a.example.com/x" aria-label="Spoken  name"></a>`;
        expect(readLinkText("https://a.example.com/x")).toBe("Spoken name");
        document.body.innerHTML = `<a href="https://a.example.com/x" title="Tooltip"></a><a href="https://other.example.com/">Other</a>`;
        expect(readLinkText("https://a.example.com/x")).toBe("Tooltip");
        expect(readLinkText("https://none.example.com/")).toBe("");
    });
});
