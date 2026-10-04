import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { migrateFromLocalStorageIfNeeded } from "../../src/storage/migration";
import { TABS_KEY, makeTab, seed, storedTabs } from "./helpers";

// The pre-2.0 extension kept its list in the page's localStorage under "links".
let legacy: Record<string, string>;

beforeEach(() => {
    legacy = {};
    (globalThis as unknown as { localStorage: Pick<Storage, "getItem"> }).localStorage = {
        getItem: (key: string) => legacy[key] ?? null,
    };
});
afterEach(() => {
    delete (globalThis as { localStorage?: unknown }).localStorage;
});

describe("migrateFromLocalStorageIfNeeded", () => {
    it("TC-020: carries legacy links over on first run", async () => {
        legacy.links = JSON.stringify([
            { url: "https://example.com", description: "Example", checked: false },
            { url: "https://no-title.example.org/page" },
        ]);
        await migrateFromLocalStorageIfNeeded();
        expect(storedTabs().map((t) => [t.title, t.url])).toEqual([
            ["Example", "https://example.com"],
            ["no-title.example.org", "https://no-title.example.org/page"],
        ]);
    });

    it("TC-021: never runs again once tabs are stored", async () => {
        legacy.links = JSON.stringify([{ url: "https://example.com", description: "Example" }]);
        await migrateFromLocalStorageIfNeeded();
        await migrateFromLocalStorageIfNeeded();
        expect(storedTabs()).toHaveLength(1);
    });

    it("leaves an existing library alone", async () => {
        const existing = makeTab();
        seed([existing]);
        legacy.links = JSON.stringify([{ url: "https://example.com" }]);
        await migrateFromLocalStorageIfNeeded();
        expect(storedTabs()).toEqual([existing]);
    });

    it("TC-022: a fresh install starts with an empty, stored list", async () => {
        await migrateFromLocalStorageIfNeeded();
        expect(storedTabs()).toEqual([]);
        expect(TABS_KEY in (await chrome.storage.local.get(TABS_KEY))).toBe(true);
    });

    it.each([["not valid json"], [JSON.stringify({ not: "an array" })], [JSON.stringify([{ url: "::bad::" }, null])]])(
        "TC-023: unusable legacy data (%s) migrates as nothing, without throwing",
        async (raw) => {
            legacy.links = raw;
            await expect(migrateFromLocalStorageIfNeeded()).resolves.toBeUndefined();
            expect(storedTabs()).toEqual([]);
        }
    );
});
