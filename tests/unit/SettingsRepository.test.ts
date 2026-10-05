import { describe, expect, it } from "vitest";
import { clampOutdatedDays, setOutdatedDays, setOutdatedEnabled, setSort, setTheme } from "../../src/domain/SettingsRepository";
import { getSettings } from "../../src/storage/chromeStorage";

describe("SettingsRepository", () => {
    it("stores the theme choice and leaves everything else alone", async () => {
        const before = await getSettings();
        await setTheme("dark");
        expect(await getSettings()).toEqual({ ...before, theme: "dark" });
    });

    it("remembers the chosen sort and leaves everything else alone", async () => {
        const before = await getSettings();
        expect(before.sort).toBe("custom");
        await setSort("newest");
        expect(await getSettings()).toEqual({ ...before, sort: "newest" });
    });

    it("turns outdated tracking on and off", async () => {
        await setOutdatedEnabled(false);
        expect((await getSettings()).outdatedEnabled).toBe(false);
    });

    it.each([
        ["0", 1],
        ["-5", 1],
        ["400", 365],
        ["12", 12],
        ["", 7],
        ["abc", 7],
    ])("turns a typed day count of %j into %i", (raw, expected) => {
        expect(clampOutdatedDays(raw)).toBe(expected);
    });

    it("never stores a day count outside 1–365", async () => {
        await setOutdatedDays(1000);
        expect((await getSettings()).outdatedDays).toBe(365);
    });
});
