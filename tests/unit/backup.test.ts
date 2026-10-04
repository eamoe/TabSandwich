import { describe, expect, it } from "vitest";
import { buildBackupFile, mergeImport, parseBackupFile, replaceImport } from "../../src/domain/backup";
import { DEFAULT_SETTINGS } from "../../src/storage/chromeStorage";
import { makeTab } from "./helpers";

const fileWith = (data: unknown) => JSON.stringify(data);

describe("parseBackupFile", () => {
    it("reads a file produced by export", () => {
        const tabs = [makeTab({ category: "Work" })];
        const parsed = parseBackupFile(fileWith(buildBackupFile(tabs, DEFAULT_SETTINGS)));
        expect(parsed?.tabs).toEqual([{ title: tabs[0].title, url: tabs[0].url, category: "Work", savedAt: tabs[0].savedAt }]);
        expect(parsed?.settingsFields.categories).toEqual(DEFAULT_SETTINGS.categories);
    });

    it.each([
        ["not JSON", "{oops"],
        ["no tabs array", fileWith({ settings: {} })],
        ["a tab without a title", fileWith({ tabs: [{ url: "https://a.com" }] })],
        ["a tab with an unusable URL", fileWith({ tabs: [{ title: "x", url: "nonsense" }] })],
        ["a non-object tab", fileWith({ tabs: ["https://a.com"] })],
    ])("rejects the whole file for %s", (_label, raw) => {
        expect(parseBackupFile(raw)).toBeNull();
    });

    it("drops malformed settings fields instead of rejecting the file", () => {
        const parsed = parseBackupFile(
            fileWith({
                tabs: [],
                settings: { outdatedDays: 9999, outdatedEnabled: "yes", categories: ["Ok"], categoryColors: { Ok: "teal", Bad: "#123456" } },
            })
        );
        expect(parsed?.settingsFields).toEqual({ categories: ["Ok"], categoryColors: { Ok: "teal" } });
    });
});

describe("mergeImport", () => {
    it("adds only tabs whose URL isn't saved yet, with fresh ids, ahead of existing ones", () => {
        const existing = makeTab({ url: "https://a.com/" });
        const parsed = parseBackupFile(
            fileWith({ tabs: [{ title: "Dup", url: "https://a.com" }, { title: "New", url: "https://b.com" }, { title: "Dup2", url: "https://b.com/" }] })
        )!;
        const result = mergeImport([existing], DEFAULT_SETTINGS, parsed);
        expect(result.addedCount).toBe(1);
        expect(result.tabs.map((t) => t.title)).toEqual(["New", existing.title]);
        expect(result.tabs[0].id).not.toBe(existing.id);
        expect(result.tabs[0].id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/); // TC-181
    });

    it("restores a category from the file even when no tab needs adding for it", () => {
        const parsed = parseBackupFile(fileWith({ tabs: [], settings: { categories: ["Old"], categoryColors: { Old: "blue" } } }))!;
        const result = mergeImport([], DEFAULT_SETTINGS, parsed);
        expect(result.addedCategoryCount).toBe(1);
        expect(result.settings.categories).toContain("Old");
        expect(result.settings.categoryColors.Old).toBe("blue");
    });

    it("never overwrites a color you already chose for an existing category", () => {
        const parsed = parseBackupFile(fileWith({ tabs: [], settings: { categories: ["Work"], categoryColors: { Work: "blue" } } }))!;
        expect(mergeImport([], DEFAULT_SETTINGS, parsed).settings.categoryColors.Work).toBe("purple");
    });
});

describe("replaceImport", () => {
    it("makes the file the entire library, deduplicated, with defaults for missing settings", () => {
        const parsed = parseBackupFile(
            fileWith({ tabs: [{ title: "A", url: "https://a.com", category: "Hobby" }, { title: "A again", url: "https://a.com/" }] })
        )!;
        const result = replaceImport(parsed);
        expect(result.tabs.map((t) => t.title)).toEqual(["A"]);
        expect(result.settings.outdatedDays).toBe(DEFAULT_SETTINGS.outdatedDays);
        expect(result.settings.categories).toContain("Hobby");
        expect(result.addedCategoryCount).toBe(1);
    });
});
