import type { SavedTab, TabGroup } from "../types";
import { getGroups, getTabs, setGroups, setTabsAndGroups } from "../storage/chromeStorage";
import { withStorageLock } from "../storage/writeQueue";

/**
 * Saved windows (groups): rename, collapse, break apart (archiving one is archiving its tabs: TabRepository). A group's tabs are ordinary
 * saved tabs carrying its id; the group itself is just a name and a collapsed flag. Changes that
 * touch both tabs and groups are written together, in one write.
 */

async function updateGroup(id: string, change: Partial<Pick<TabGroup, "name" | "collapsed">>): Promise<void> {
    return withStorageLock(async () => {
        const groups = await getGroups();
        if (!groups.some((g) => g.id === id)) return;
        await setGroups(groups.map((g) => (g.id === id ? { ...g, ...change } : g)));
    });
}

/** Blank names are refused (the group keeps its name); the caller shows why. */
export async function renameGroup(id: string, name: string): Promise<void> {
    const trimmed = name.trim();
    if (!trimmed) return;
    return updateGroup(id, { name: trimmed });
}

/** Remembered between opens. */
export async function setGroupCollapsed(id: string, collapsed: boolean): Promise<void> {
    return updateGroup(id, { collapsed });
}

/** What breaking a group apart took away — exactly what Undo puts back. */
export interface RemovedGroup {
    group: TabGroup;
    groupIndex: number;
    /** The tabs that left the group (still saved). */
    released: string[];
}

/** Breaks a saved window apart: its tabs stay saved, where they are, just no longer grouped. */
export async function ungroup(id: string): Promise<RemovedGroup | null> {
    return withStorageLock(async () => {
        const [tabs, groups] = [await getTabs(), await getGroups()];
        const groupIndex = groups.findIndex((g) => g.id === id);
        if (groupIndex === -1) return null;
        const released = tabs.filter((t) => t.groupId === id).map((t) => t.id);
        await setTabsAndGroups(
            tabs.map((t): SavedTab => {
                if (t.groupId !== id) return t;
                const { groupId: _gone, ...rest } = t;
                return rest;
            }),
            groups.filter((g) => g.id !== id)
        );
        return { group: groups[groupIndex], groupIndex, released };
    });
}

/** Undo for ungroup: the group back in its place, and its tabs back in it. */
export async function restoreGroup(snapshot: RemovedGroup): Promise<void> {
    return withStorageLock(async () => {
        const [tabs, groups] = [await getTabs(), await getGroups()];
        const nextGroups = groups.some((g) => g.id === snapshot.group.id)
            ? groups
            : [...groups.slice(0, snapshot.groupIndex), snapshot.group, ...groups.slice(snapshot.groupIndex)];
        const released = new Set(snapshot.released);
        await setTabsAndGroups(
            tabs.map((t) => (released.has(t.id) ? { ...t, groupId: snapshot.group.id } : t)),
            nextGroups
        );
    });
}
