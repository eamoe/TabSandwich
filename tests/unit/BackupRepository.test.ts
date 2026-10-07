import { describe, expect, it } from "vitest";
import { importMerge, importReplace, restoreSnapshot } from "../../src/domain/BackupRepository";
import { parseBackupFile } from "../../src/domain/backup";
import { getGroups, getSettings, getTabs } from "../../src/storage/chromeStorage";
import { makeGroup, makeTab, seed, seedGroups } from "./helpers";

const file = (data: unknown) => parseBackupFile(JSON.stringify(data))!;

describe("BackupRepository", () => {
    it("merges only what's new and can be undone exactly", async () => {
        const kept = makeTab({ title: "Kept", url: "https://kept.example.com/" });
        seed([kept]);
        const outcome = await importMerge(file({ tabs: [{ title: "Again", url: "https://kept.example.com" }, { title: "New", url: "https://new.example.com" }] }));
        expect(outcome?.result.addedCount).toBe(1);
        expect((await getTabs()).map((t) => t.title)).toEqual(["New", "Kept"]);

        await restoreSnapshot(outcome!.before);
        expect(await getTabs()).toEqual([kept]);
    });

    it("writes nothing when the file has nothing new", async () => {
        seed([makeTab({ url: "https://kept.example.com/" })]);
        expect(await importMerge(file({ tabs: [{ title: "Again", url: "https://kept.example.com" }] }))).toBeNull();
    });

    it("replaces everything, theme included, and can be undone", async () => {
        seed([makeTab({ title: "Kept" })], { theme: "light" });
        const outcome = await importReplace(file({ tabs: [{ title: "Only", url: "https://only.example.com" }], settings: { theme: "dark" } }));
        expect((await getTabs()).map((t) => t.title)).toEqual(["Only"]);
        expect((await getSettings()).theme).toBe("dark");

        await restoreSnapshot(outcome.before);
        expect((await getTabs()).map((t) => t.title)).toEqual(["Kept"]);
        expect((await getSettings()).theme).toBe("light");
    });

    it("Undo of a Replace brings back saved windows too", async () => {
        const group = makeGroup();
        seed([makeTab({ groupId: group.id }), makeTab({ groupId: group.id })]);
        seedGroups([group]);
        const outcome = await importReplace(file({ tabs: [{ title: "Only", url: "https://only.example.com" }] }));
        expect(await getGroups()).toEqual([]);
        await restoreSnapshot(outcome.before);
        expect(await getGroups()).toEqual([group]);
        expect((await getTabs()).every((t) => t.groupId === group.id)).toBe(true);
    });
});
