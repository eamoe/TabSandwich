/**
 * When the "What's new" note shows. Pure, so the logic tests cover every case.
 *
 * Notes belong to feature releases ("3.1"), not patch releases: updating from 3.1.0 to 3.1.2
 * doesn't bring back a note you've dismissed, and a patch release never needs one of its own.
 */

/** "3.1" for "3.1.4". */
export function releaseOf(version: string): string {
    return version.split(".").slice(0, 2).join(".");
}

function compareReleases(a: string, b: string): number {
    const [aMajor = 0, aMinor = 0] = a.split(".").map(Number);
    const [bMajor = 0, bMinor = 0] = b.split(".").map(Number);
    return aMajor - bMajor || aMinor - bMinor;
}

/**
 * The release whose note to show, or null. Never on a fresh install (there's nothing "new" to
 * someone who just arrived); after an update, until dismissed. Someone updating from a version
 * that didn't record what they'd seen (before 3.1) counts as updating.
 */
export function whatsNewToShow(options: { current: string; lastSeen: string | undefined; freshInstall: boolean; notes: readonly string[] }): string | null {
    const release = releaseOf(options.current);
    if (options.freshInstall || !options.notes.includes(release)) return null;
    if (options.lastSeen !== undefined && compareReleases(releaseOf(options.lastSeen), release) >= 0) return null;
    return release;
}
