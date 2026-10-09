import { withStorageLock } from "./writeQueue";

/**
 * Versioned, protected upgrades of stored data — the safety net later releases need before
 * they change what's stored (new fields on SavedTab, a new key for saved-window groups, ...).
 *
 * Version 1 is the data shape v2.2.0 shipped with. Everything stored before this module
 * existed has no version number and is, by definition, version 1.
 */
export const CURRENT_SCHEMA_VERSION = 3;
export const SCHEMA_VERSION_KEY = "tabSandwich.schemaVersion";
/** The data as it was right before the most recent upgrade — kept (only the latest) as a recovery copy. */
export const UPGRADE_BACKUP_KEY = "tabSandwich.upgradeBackup";

/** Every stored key and value, as one object — what a migration step reads and returns. */
export type StoredData = Record<string, unknown>;

export interface Migration {
    from: number;
    to: number;
    /**
     * Must be pure: return the new data, never write to storage. Throwing aborts the whole upgrade.
     * Must also cope with empty data — a fresh install has no version number either, so it starts
     * at version 1 and runs every step, on nothing.
     */
    migrate: (data: StoredData) => StoredData;
}

/** Ordered steps from each version to the next. */
export const MIGRATIONS: Migration[] = [
    {
        // v3.2: saved windows. Adds the (empty) list of groups; tabs gain an optional groupId,
        // so every existing tab is simply not in a group and needs no change.
        from: 1,
        to: 2,
        migrate: (data) => ({ ...data, "tabSandwich.groups": Array.isArray(data["tabSandwich.groups"]) ? data["tabSandwich.groups"] : [] }),
    },
    {
        // v3.3: categories are kept (never age) unless chosen to. The one on/off switch becomes
        // the list of categories whose tabs age: for an existing library only Uncategorized
        // (none if the switch was off), so no category starts nudging on its own. A fresh install
        // (nothing stored) is left alone and gets the defaults, Reading included.
        from: 2,
        to: 3,
        migrate: (data) => {
            const SETTINGS = "tabSandwich.settings";
            const stored = data[SETTINGS];
            const settings = stored !== null && typeof stored === "object" && !Array.isArray(stored) ? (stored as Record<string, unknown>) : null;
            if (!settings && !("tabSandwich.tabs" in data)) return data;
            const { outdatedEnabled, ...rest } = settings ?? {};
            if (Array.isArray(rest.waitingCategories)) return { ...data, [SETTINGS]: rest };
            return { ...data, [SETTINGS]: { ...rest, waitingCategories: outdatedEnabled === false ? [] : ["Uncategorized"] } };
        },
    },
];

export type UpgradeResult =
    | { status: "current" }
    | { status: "upgraded"; from: number; to: number }
    | { status: "newer"; from: number; to: number }
    | { status: "failed"; from: number; to: number };

function chainFrom(version: number, target: number, migrations: Migration[]): Migration[] | null {
    const steps: Migration[] = [];
    let at = version;
    while (at < target) {
        const step = migrations.find((m) => m.from === at);
        if (!step || step.to <= at) return null;
        steps.push(step);
        at = step.to;
    }
    return at === target ? steps : null;
}

/**
 * Brings stored data up to `target`, or leaves it exactly as it was. The steps run on an
 * in-memory copy, so a step that throws never touches storage; only once every step has
 * succeeded is a backup saved and the result written — data and version number in one
 * write, so the two can't disagree. If that write is rejected (e.g. storage full), the
 * original is put back, including removing any key the upgrade had added.
 *
 * Runs under the storage lock so nothing else can read or write half-upgraded data. Never
 * throws: this runs on every popup open, before anything renders, so any storage failure is
 * reported as "failed" for the caller to show, never as an exception that stops startup.
 */
export async function upgradeStoredData(
    migrations: Migration[] = MIGRATIONS,
    target: number = CURRENT_SCHEMA_VERSION
): Promise<UpgradeResult> {
    return withStorageLock(() => runUpgrade(migrations, target)).catch(
        (): UpgradeResult => ({ status: "failed", from: -1, to: target })
    );
}

async function runUpgrade(migrations: Migration[], target: number): Promise<UpgradeResult> {
    const all: StoredData = await chrome.storage.local.get(null);
    const { [UPGRADE_BACKUP_KEY]: _previousBackup, ...original } = all;
    const stored = original[SCHEMA_VERSION_KEY];
    const version = typeof stored === "number" ? stored : 1;

    if (version > target) return { status: "newer", from: version, to: target };
    if (version === target) {
        // First run since versioning existed: record what this data already is. If that one
        // write fails (e.g. storage full), nothing else was touched; it's retried next open.
        if (stored === undefined) {
            try {
                await chrome.storage.local.set({ [SCHEMA_VERSION_KEY]: target });
            } catch {
                return { status: "failed", from: version, to: target };
            }
        }
        return { status: "current" };
    }

    const steps = chainFrom(version, target, migrations);
    if (!steps) return { status: "failed", from: version, to: target };

    let upgraded: StoredData;
    try {
        upgraded = steps.reduce((data, step) => step.migrate(structuredClone(data)), structuredClone(original));
    } catch {
        return { status: "failed", from: version, to: target };
    }
    upgraded = { ...upgraded, [SCHEMA_VERSION_KEY]: target };

    try {
        await chrome.storage.local.set({
            [UPGRADE_BACKUP_KEY]: { takenAt: Date.now(), fromVersion: version, data: original },
        });
    } catch {
        return { status: "failed", from: version, to: target };
    }

    const removedKeys = Object.keys(original).filter((k) => !(k in upgraded));
    try {
        await chrome.storage.local.set(upgraded);
        if (removedKeys.length > 0) await chrome.storage.local.remove(removedKeys);
    } catch {
        try {
            const addedKeys = Object.keys(upgraded).filter((k) => !(k in original));
            if (addedKeys.length > 0) await chrome.storage.local.remove(addedKeys);
            await chrome.storage.local.set(original);
        } catch {
            // Restoring failed too. The backup written above still holds the original, so it
            // isn't lost; report the failure rather than throwing.
        }
        return { status: "failed", from: version, to: target };
    }
    return { status: "upgraded", from: version, to: target };
}
