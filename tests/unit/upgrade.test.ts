import { describe, expect, it } from "vitest";
import {
    CURRENT_SCHEMA_VERSION,
    SCHEMA_VERSION_KEY,
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
    it("stamps data from before versioning (v2.2 and earlier) as the current version, without changing it", async () => {
        seed([makeTab()]);
        const before = snapshot();
        expect(await upgradeStoredData()).toEqual({ status: "current" });
        expect(storage.data).toEqual({ ...before, [SCHEMA_VERSION_KEY]: CURRENT_SCHEMA_VERSION });
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
