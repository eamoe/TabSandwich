import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildBackupFile, parseBackupFile } from "../../src/domain/backup";
import { DEFAULT_SETTINGS } from "../../src/storage/chromeStorage";
import { waitingCount } from "../../src/ui/main/listModel";
import { BADGE_ALARM, flashBadge, refreshBadge } from "../../src/worker/badge";
import { storage } from "./setup";
import { makeTab, seed } from "./helpers";

const DAY = 24 * 60 * 60 * 1000;
const now = Date.UTC(2026, 10, 1);
const aged = () => makeTab({ category: "Reading", savedAt: now - 30 * DAY });
const due = () => makeTab({ category: "Work", savedAt: now, remindAt: now - DAY });
const waiting = { waitingCategories: ["Reading"], outdatedDays: 7, toolbarBadge: true };

describe("the waiting count", () => {
    beforeEach(() => vi.useFakeTimers({ now }));
    afterEach(() => vi.useRealTimers());

    it("counts a tab once, aged, due or both, and nothing archived, pinned or not yet due", () => {
        const both = makeTab({ category: "Reading", savedAt: now - 30 * DAY, remindAt: now - DAY });
        const others = [makeTab({ category: "Work", savedAt: now }), makeTab({ category: "Work", savedAt: now, remindAt: now + DAY }), makeTab({ category: "Reading", savedAt: now - 30 * DAY, pinned: true }), makeTab({ category: "Reading", savedAt: now - 30 * DAY, archivedAt: now })];
        expect(waitingCount([aged(), due(), both, ...others], { ...DEFAULT_SETTINGS, ...waiting })).toBe(3);
    });

    it("is off until it's turned on", async () => {
        expect(DEFAULT_SETTINGS.toolbarBadge).toBe(false);
        seed([aged()], { ...waiting, toolbarBadge: false });
        await refreshBadge();
        expect(storage.badge.text).toBe("");
        expect(storage.alarms[BADGE_ALARM]).toBeUndefined();
    });

    it("shows on the icon and in its name, and is looked at again as time passes", async () => {
        seed([aged(), due()], waiting);
        await refreshBadge();
        expect(storage.badge.text).toBe("2");
        expect(storage.badge.title).toBe("Tab Sandwich: 2 waiting");
        expect(storage.alarms[BADGE_ALARM]).toEqual({ periodInMinutes: 60 });
    });

    it("stops at 99+, and shows nothing at zero", async () => {
        seed(Array.from({ length: 120 }, aged), waiting);
        await refreshBadge();
        expect(storage.badge.text).toBe("99+");
        seed([], waiting);
        await refreshBadge();
        expect(storage.badge.text).toBe("");
        expect(storage.badge.title).toBe("Tab Sandwich");
    });

    it("stops being looked at when it's turned off", async () => {
        seed([aged()], waiting);
        await refreshBadge();
        seed([aged()], { ...waiting, toolbarBadge: false });
        await refreshBadge();
        expect(storage.badge.text).toBe("");
        expect(storage.alarms[BADGE_ALARM]).toBeUndefined();
    });

    it("waits while a save's flash shows, then comes back up to date", async () => {
        seed([aged()], waiting);
        await refreshBadge();
        await flashBadge("saved");
        expect(storage.badge.text).toBe("✓");
        seed([aged(), aged()], waiting);
        await refreshBadge();
        expect(storage.badge.text).toBe("✓");
        await vi.advanceTimersByTimeAsync(2500);
        expect(storage.badge.text).toBe("2");
    });

    it("clears after a flash when it's off, as before", async () => {
        seed([aged()], { ...waiting, toolbarBadge: false });
        await flashBadge("failed");
        expect(storage.badge.text).toBe("!");
        await vi.advanceTimersByTimeAsync(2500);
        expect(storage.badge.text).toBe("");
    });

    it("comes back with a backup", () => {
        const file = buildBackupFile([], { ...DEFAULT_SETTINGS, toolbarBadge: true });
        expect(parseBackupFile(JSON.stringify(file))?.settingsFields.toolbarBadge).toBe(true);
    });
});
