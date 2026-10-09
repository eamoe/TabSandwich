import { describe, expect, it } from "vitest";
import { renameGroup, restoreGroup, setGroupCollapsed, ungroup } from "../../src/domain/GroupRepository";
import { makeGroup, makeTab, seed, seedGroups, storedGroups, storedTabs } from "./helpers";

function library() {
    const [g1, g2] = [makeGroup(), makeGroup()];
    const tabs = [makeTab(), makeTab({ groupId: g1.id }), makeTab({ groupId: g1.id }), makeTab(), makeTab({ groupId: g2.id })];
    seed(tabs);
    seedGroups([g1, g2]);
    return { g1, g2, tabs };
}

describe("GroupRepository", () => {
    it("renames a group, refusing a blank name", async () => {
        const { g1 } = library();
        await renameGroup(g1.id, "  Research  ");
        expect(storedGroups()[0].name).toBe("Research");
        await renameGroup(g1.id, "   ");
        expect(storedGroups()[0].name).toBe("Research");
    });

    it("remembers whether a group is collapsed", async () => {
        const { g2 } = library();
        await setGroupCollapsed(g2.id, false);
        expect(storedGroups()[1].collapsed).toBe(false);
    });

    it("breaks a group apart: its tabs stay saved, in place, ungrouped; Undo regroups them", async () => {
        const { g1, g2, tabs } = library();
        const snapshot = await ungroup(g1.id);
        expect(storedTabs().map((t) => t.id)).toEqual(tabs.map((t) => t.id));
        expect(storedTabs().some((t) => t.groupId === g1.id)).toBe(false);
        expect(storedTabs()[1]).not.toHaveProperty("groupId");
        expect(storedGroups()).toEqual([g2]);
        await restoreGroup(snapshot!);
        expect(storedTabs()).toEqual(tabs);
        expect(storedGroups()).toEqual([g1, g2]);
    });

    it("does nothing for a group that's gone", async () => {
        library();
        expect(await ungroup("nope")).toBeNull();
    });
});
