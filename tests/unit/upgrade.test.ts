import { describe, expect, it } from "vitest";
import {
    CURRENT_SCHEMA_VERSION,
    SCHEMA_VERSION_KEY,
    MIGRATIONS,
    UPGRADE_BACKUP_KEY,
    upgradeStoredData,
    type Migration,
} from "../../src/storage/upgrade";
import { storage } from "./setup";
import { TABS_KEY, makeTab, seed } from "./helpers";

const v1ToV2: Migration = {
    from: 1,
    to: 2,
    migrate: (data) => ({
        ...data,
        [TABS_KEY]: (data[TABS_KEY] as Array<Record<string, unknown>>).map((t) => ({ ...t, openCount: 0 })),
        "tabSandwich.sessions": [],
    }),
};
const v2ToV3: Migration = {
    from: 2,
    to: 3,
    migrate: (data) => {
        const { ["tabSandwich.sessions"]: _dropped, ...rest } = data;
        return rest;
    },
};
const throwing: Migration = {
    from: 2,
    to: 3,
    migrate: () => {
        throw new Error("bad step");
    },
};

const snapshot = () => structuredClone(storage.data);

describe("upgradeStoredData", () => {
    it("stamps data from before versioning (v2.2 and earlier) as version 1, without changing it", async () => {
        seed([makeTab()]);
        const before = snapshot();
        expect(await upgradeStoredData([], 1)).toEqual({ status: "current" });
        expect(storage.data).toEqual({ ...before, [SCHEMA_VERSION_KEY]: 1 });
    });

    it("v3.2 (version 2): data from before gets an empty list of saved windows, tabs untouched, with a backup", async () => {
        const tab = makeTab();
        seed([tab]);
        const before = snapshot();
        expect(CURRENT_SCHEMA_VERSION).toBe(3);
        expect(await upgradeStoredData()).toEqual({ status: "upgraded", from: 1, to: 3 });
        expect(storage.data[TABS_KEY]).toEqual([tab]);
        expect(storage.data["tabSandwich.groups"]).toEqual([]);
        expect(storage.data[SCHEMA_VERSION_KEY]).toBe(3);
        expect(storage.data[UPGRADE_BACKUP_KEY]).toMatchObject({ fromVersion: 1, data: before });
    });

    describe("v3.3 (version 3): categories are kept unless chosen to age", () => {
        const step = MIGRATIONS.find((m) => m.from === 2)!;
        const SETTINGS = "tabSandwich.settings";
        const old = { outdatedEnabled: true, outdatedDays: 9, categories: ["Work", "Reading"], categoryColors: { Work: "blue" } };

        it("an existing library: only Uncategorized ages (Reading too is kept now), the old switch is gone", () => {
            const result = step.migrate({ [TABS_KEY]: [], [SETTINGS]: old });
            expect(result[SETTINGS]).toEqual({ outdatedDays: 9, categories: ["Work", "Reading"], categoryColors: { Work: "blue" }, waitingCategories: ["Uncategorized"] });
        });

        it("reminders switched off before stay off: nothing ages", () => {
            const result = step.migrate({ [TABS_KEY]: [], [SETTINGS]: { ...old, outdatedEnabled: false } });
            expect((result[SETTINGS] as Record<string, unknown>).waitingCategories).toEqual([]);
        });

        it("a library whose settings were never changed (none stored) still gets only Uncategorized", () => {
            expect(step.migrate({ [TABS_KEY]: [makeTab()] })[SETTINGS]).toEqual({ waitingCategories: ["Uncategorized"] });
        });

        it("leaves a fresh install (nothing stored) to the defaults, and keeps a list that's already there", () => {
            expect(step.migrate({})).toEqual({});
            const already = { ...old, waitingCategories: ["Work"] };
            expect((step.migrate({ [SETTINGS]: already })[SETTINGS] as Record<string, unknown>).waitingCategories).toEqual(["Work"]);
        });
    });

    it("the version 2 step keeps saved windows that are somehow already there, and copes with no data", () => {
        const step = MIGRATIONS.find((m) => m.from === 1)!;
        const groups = [{ id: "g", name: "Window", createdAt: 1, collapsed: true }];
        expect(step.migrate({ "tabSandwich.groups": groups })["tabSandwich.groups"]).toEqual(groups);
        expect(step.migrate({})).toEqual({ "tabSandwich.groups": [] });
    });

    it("does nothing at all when data is already current", async () => {
        seed([makeTab()]);
        storage.data[SCHEMA_VERSION_KEY] = CURRENT_SCHEMA_VERSION;
        const before = snapshot();
        storage.rejectSet = () => new Error("should not write");
        expect(await upgradeStoredData()).toEqual({ status: "current" });
        expect(storage.data).toEqual(before);
    });

    it("runs every step in order, saves data and version together, and keeps a backup of the original", async () => {
        seed([makeTab({ id: "a" })]);
        storage.data[SCHEMA_VERSION_KEY] = 1;
        const original = snapshot();
        const writes: string[][] = [];
        storage.rejectSet = (items) => {
            writes.push(Object.keys(items).sort());
            return null;
        };

        expect(await upgradeStoredData([v1ToV2, v2ToV3], 3)).toEqual({ status: "upgraded", from: 1, to: 3 });

        expect((storage.data[TABS_KEY] as Array<{ openCount: number }>)[0].openCount).toBe(0);
        expect(storage.data).not.toHaveProperty("tabSandwich.sessions");
        expect(storage.data[SCHEMA_VERSION_KEY]).toBe(3);
        expect(writes.at(-1)).toContain(SCHEMA_VERSION_KEY); // version written in the same call as the data
        expect(writes.at(-1)).toContain(TABS_KEY);
        expect(storage.data[UPGRADE_BACKUP_KEY]).toMatchObject({ fromVersion: 1, data: original });
    });

    it("leaves stored data exactly as it was when a step fails", async () => {
        seed([makeTab()]);
        storage.data[SCHEMA_VERSION_KEY] = 1;
        const before = snapshot();
        const result = await upgradeStoredData([v1ToV2, throwing], 3);
        expect(result).toEqual({ status: "failed", from: 1, to: 3 });
        expect(storage.data).toEqual(before);
    });

    it("puts everything back, and removes keys the upgrade added, when the final save is rejected", async () => {
        seed([makeTab()]);
        storage.data[SCHEMA_VERSION_KEY] = 1;
        const before = snapshot();
        storage.rejectSet = (items) => (SCHEMA_VERSION_KEY in items && items[SCHEMA_VERSION_KEY] === 2 ? new Error("quota") : null);
        expect(await upgradeStoredData([v1ToV2], 2)).toEqual({ status: "failed", from: 1, to: 2 });
        const { [UPGRADE_BACKUP_KEY]: backup, ...rest } = storage.data;
        expect(rest).toEqual(before);
        expect(backup).toMatchObject({ fromVersion: 1, data: before });
    });

    it("refuses, untouched, when no chain of steps reaches the current version", async () => {
        seed([makeTab()]);
        storage.data[SCHEMA_VERSION_KEY] = 1;
        const before = snapshot();
        expect(await upgradeStoredData([v2ToV3], 3)).toEqual({ status: "failed", from: 1, to: 3 });
        expect(storage.data).toEqual(before);
    });

    it("leaves data from a newer version alone (e.g. after reinstalling an older release)", async () => {
        seed([makeTab()]);
        storage.data[SCHEMA_VERSION_KEY] = 99;
        const before = snapshot();
        expect(await upgradeStoredData()).toEqual({ status: "newer", from: 99, to: CURRENT_SCHEMA_VERSION });
        expect(storage.data).toEqual(before);
    });

    it("reports a failed first-open version stamp instead of throwing, changing nothing", async () => {
        seed([makeTab()]);
        const before = snapshot();
        storage.rejectSet = () => new Error("QUOTA_BYTES quota exceeded");
        expect(await upgradeStoredData()).toEqual({ status: "failed", from: 1, to: CURRENT_SCHEMA_VERSION });
        expect(storage.data).toEqual(before);
    });

    it("still resolves, keeping the backup, when restoring after a failed save fails too", async () => {
        seed([makeTab()]);
        storage.data[SCHEMA_VERSION_KEY] = 1;
        const before = snapshot();
        storage.rejectSet = (items) => (UPGRADE_BACKUP_KEY in items ? null : new Error("storage broken"));
        expect(await upgradeStoredData([v1ToV2], 2)).toEqual({ status: "failed", from: 1, to: 2 });
        expect(storage.data[UPGRADE_BACKUP_KEY]).toMatchObject({ fromVersion: 1, data: before });
    });

    it("reports, rather than throws, when storage can't even be read", async () => {
        chrome.storage.local.get = (() => Promise.reject(new Error("unreadable"))) as typeof chrome.storage.local.get;
        expect(await upgradeStoredData()).toEqual({ status: "failed", from: -1, to: CURRENT_SCHEMA_VERSION });
    });
});
