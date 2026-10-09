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

    it("reads which categories age from a v3.3 backup, and an older backup's reminders-off as none", () => {
        const current = parseBackupFile(fileWith(buildBackupFile([], { ...DEFAULT_SETTINGS, waitingCategories: ["Work"] })));
        expect(current?.settingsFields.waitingCategories).toEqual(["Work"]);
        expect(parseBackupFile(fileWith({ tabs: [], settings: { outdatedEnabled: false } }))?.settingsFields.waitingCategories).toEqual([]);
        // An older backup with reminders on says nothing about categories: whatever's set now stays.
        expect(parseBackupFile(fileWith({ tabs: [], settings: { outdatedEnabled: true } }))?.settingsFields.waitingCategories).toBeUndefined();
        expect(parseBackupFile(fileWith({ tabs: [], settings: { waitingCategories: [1] } }))?.settingsFields.waitingCategories).toBeUndefined();
    });

    it("keeps when a tab was archived, so Replace all doesn't bring the archive back into the list", () => {
        const parsed = parseBackupFile(fileWith({ tabs: [{ title: "a", url: "https://a.com", archivedAt: 1700000000000 }, { title: "b", url: "https://b.com", archivedAt: "x" }] }));
        expect(parsed?.tabs.map((t) => t.archivedAt)).toEqual([1700000000000, undefined]);
    });

    it("keeps a tab's pin, and nothing but true counts as pinned", () => {
        const parsed = parseBackupFile(fileWith({ tabs: [{ title: "a", url: "https://a.com", pinned: true }, { title: "b", url: "https://b.com", pinned: "yes" }] }));
        expect(parsed?.tabs.map((t) => t.pinned)).toEqual([true, undefined]);
    });

    it("reads the theme from a backup exported by v3.0 or later", () => {
        const parsed = parseBackupFile(fileWith(buildBackupFile([], { ...DEFAULT_SETTINGS, theme: "dark" })));
        expect(parsed?.settingsFields.theme).toBe("dark");
    });

    it("reads the sort from a backup exported by v3.1 or later, ignoring one it doesn't recognize", () => {
        expect(parseBackupFile(fileWith(buildBackupFile([], { ...DEFAULT_SETTINGS, sort: "title" })))?.settingsFields.sort).toBe("title");
        expect(parseBackupFile(fileWith({ tabs: [], settings: { sort: "random" } }))?.settingsFields.sort).toBeUndefined();
    });

    it("ignores a theme value it doesn't recognize", () => {
        const parsed = parseBackupFile(fileWith({ tabs: [], settings: { theme: "sepia" } }));
        expect(parsed?.settingsFields).toEqual({});
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

    it("keeps your current sort when merging, and takes the file's when replacing", () => {
        const parsed = parseBackupFile(fileWith({ tabs: [], settings: { sort: "site" } }))!;
        expect(mergeImport([], { ...DEFAULT_SETTINGS, sort: "newest" }, parsed).settings.sort).toBe("newest");
        expect(replaceImport(parsed).settings.sort).toBe("site");
    });

    it("keeps your current theme — merging only ever adds tabs and categories", () => {
        const parsed = parseBackupFile(fileWith({ tabs: [], settings: { theme: "dark" } }))!;
        expect(mergeImport([], { ...DEFAULT_SETTINGS, theme: "light" }, parsed).settings.theme).toBe("light");
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

    it("takes the theme from the file", () => {
        const parsed = parseBackupFile(fileWith({ tabs: [], settings: { theme: "light" } }))!;
        expect(replaceImport(parsed).settings.theme).toBe("light");
    });

    it("still imports a backup made before v3.0, which has no theme, falling back to following the system", () => {
        const preV3 = { version: 1, exportedAt: "2026-09-01T10:00:00.000Z", tabs: [{ title: "A", url: "https://a.com", savedAt: 1 }],
            settings: { outdatedEnabled: true, outdatedDays: 7, categories: ["Work"], categoryColors: { Work: "purple" } } };
        const result = replaceImport(parseBackupFile(fileWith(preV3))!);
        expect(result.tabs.map((t) => t.title)).toEqual(["A"]);
        expect(result.settings.theme).toBe("system");
    });
});

describe("saved windows in backups (v3.2)", () => {
    const g = { id: "file-g", name: "Research", createdAt: 5, collapsed: false };
    const tabs = [
        { id: "a", title: "A", url: "https://a.example.com/", savedAt: 1, groupId: "file-g" },
        { id: "b", title: "B", url: "https://b.example.com/", savedAt: 1, groupId: "file-g" },
        { id: "c", title: "C", url: "https://c.example.com/", savedAt: 1 },
    ];

    it("round-trips: export, then Replace, brings the groups back with new ids", () => {
        const parsed = parseBackupFile(fileWith(buildBackupFile(tabs, DEFAULT_SETTINGS, [g])))!;
        const result = replaceImport(parsed);
        expect(result.groups).toEqual([expect.objectContaining({ name: "Research", createdAt: 5, collapsed: false })]);
        const [newGroup] = result.groups;
        expect(newGroup.id).not.toBe("file-g");
        expect(result.tabs.map((t) => t.groupId)).toEqual([newGroup.id, newGroup.id, undefined]);
    });

    it("imports a v3.1 file (no groups) as before", () => {
        const parsed = parseBackupFile(fileWith({ version: 1, tabs: [{ title: "A", url: "https://a.example.com/" }], settings: {} }))!;
        expect(parsed.groups).toEqual([]);
        expect(replaceImport(parsed).groups).toEqual([]);
    });

    it("leaves out malformed groups, and their tabs import ungrouped", () => {
        const parsed = parseBackupFile(fileWith({ tabs, groups: [{ id: "file-g", name: "" }, "junk"] }))!;
        const result = replaceImport(parsed);
        expect(result.groups).toEqual([]);
        expect(result.tabs.every((t) => t.groupId === undefined)).toBe(true);
    });

    it("Merge brings a group along only with its tabs that are new, and keeps existing groups", () => {
        const existingGroup = { id: "mine", name: "Mine", createdAt: 1, collapsed: true };
        const existing = [makeTab({ url: "https://a.example.com/" })];
        const parsed = parseBackupFile(fileWith(buildBackupFile(tabs, DEFAULT_SETTINGS, [g])))!;
        const result = mergeImport(existing, DEFAULT_SETTINGS, parsed, [existingGroup]);
        expect(result.addedCount).toBe(2);
        expect(result.groups).toHaveLength(2);
        expect(result.groups[1]).toEqual(existingGroup);
        const b = result.tabs.find((t) => t.title === "B")!;
        expect(b.groupId).toBe(result.groups[0].id);
    });

    it("Merge adds no group when all of its tabs were already saved", () => {
        const existing = [makeTab({ url: "https://a.example.com/" }), makeTab({ url: "https://b.example.com/" })];
        const parsed = parseBackupFile(fileWith(buildBackupFile(tabs, DEFAULT_SETTINGS, [g])))!;
        expect(mergeImport(existing, DEFAULT_SETTINGS, parsed).groups).toEqual([]);
    });
});
