import { describe, expect, it } from "vitest";
import {
    DEFAULT_SETTINGS,
    StorageWriteError,
    getCleanupTipHiddenUntil,
    getOpenTrackingSince,
    getSettings,
    getStorageUsage,
    setCleanupTipHiddenUntil,
    getTabs,
    setSettings,
    setTabs,
} from "../../src/storage/chromeStorage";
import { withStorageLock } from "../../src/storage/writeQueue";
import { addTab, editTab } from "../../src/domain/TabRepository";
import { addCategory } from "../../src/domain/CategoryRepository";
import { storage } from "./setup";
import { SETTINGS_KEY, makeTab, seed, storedSettings, storedTabs } from "./helpers";

describe("chromeStorage", () => {
    it("starts empty with default settings", async () => {
        expect(await getTabs()).toEqual([]);
        expect(await getSettings()).toEqual(DEFAULT_SETTINGS);
    });

    it("fills settings fields missing from storage with defaults", async () => {
        storage.data[SETTINGS_KEY] = { outdatedDays: 30 };
        expect(await getSettings()).toEqual({ ...DEFAULT_SETTINGS, outdatedDays: 30 });
    });

    it("reads settings saved before v3.0, which have no theme, as following the system", async () => {
        storage.data[SETTINGS_KEY] = { outdatedEnabled: true, outdatedDays: 7, categories: ["Work"], categoryColors: { Work: "blue" } };
        expect((await getSettings()).theme).toBe("system");
    });

    it("round-trips tabs and settings", async () => {
        const tabs = [makeTab(), makeTab()];
        await setTabs(tabs);
        await setSettings({ ...DEFAULT_SETTINGS, waitingCategories: [] });
        expect(await getTabs()).toEqual(tabs);
        expect((await getSettings()).waitingCategories).toEqual([]);
    });

    it("recognizes a quota rejection as storage being full", async () => {
        storage.failNextSetWith = new Error("QUOTA_BYTES quota exceeded");
        const write = setTabs([makeTab()]);
        await expect(write).rejects.toBeInstanceOf(StorageWriteError);
        await expect(write).rejects.toMatchObject({ kind: "full" });
    });

    it("files any other rejection under \"other\"", async () => {
        storage.failNextSetWith = new Error("something odd");
        await expect(setSettings(DEFAULT_SETTINGS)).rejects.toMatchObject({ kind: "other" });
    });

    it("reports usage against Chrome's real quota", async () => {
        await setTabs([makeTab()]);
        const usage = await getStorageUsage();
        expect(usage.bytesInUse).toBeGreaterThan(0);
        expect(usage.quotaBytes).toBe(10_485_760);
    });
});

describe("withStorageLock", () => {
    it("runs queued work strictly one after another", async () => {
        const order: string[] = [];
        const slow = withStorageLock(async () => {
            order.push("slow:start");
            await new Promise((r) => setTimeout(r, 20));
            order.push("slow:end");
        });
        const fast = withStorageLock(async () => {
            order.push("fast");
        });
        await Promise.all([slow, fast]);
        expect(order).toEqual(["slow:start", "slow:end", "fast"]);
    });

    it("keeps the queue moving after a failed task", async () => {
        await expect(withStorageLock(async () => Promise.reject(new Error("boom")))).rejects.toThrow("boom");
        await expect(withStorageLock(async () => "next")).resolves.toBe("next");
    });

    it("never loses an update when two different changes overlap (slow writes)", async () => {
        const tab = makeTab({ title: "Before" });
        seed([tab]);
        storage.setDelayMs = 30;
        await Promise.all([editTab(tab.id, { title: "After" }), addTab({ title: "New", url: "https://new.example.com" }), addCategory("Fresh")]);
        const titles = storedTabs().map((t) => t.title);
        expect(titles).toContain("After");
        expect(titles).toContain("New");
        expect(storedSettings().categories).toContain("Fresh");
    });
});

describe("install-level dates", () => {
    it("records since when opens are counted the first time it's asked, then keeps it", async () => {
        const before = Date.now();
        const first = await getOpenTrackingSince();
        expect(first).toBeGreaterThanOrEqual(before);
        expect(storage.data["tabSandwich.openTrackingSince"]).toBe(first);
        storage.data["tabSandwich.openTrackingSince"] = 1;
        expect(await getOpenTrackingSince()).toBe(1);
    });

    it("keeps the cleanup tip's Not now until a date (none: shown)", async () => {
        expect(await getCleanupTipHiddenUntil()).toBe(0);
        await setCleanupTipHiddenUntil(1234);
        expect(await getCleanupTipHiddenUntil()).toBe(1234);
    });
});
