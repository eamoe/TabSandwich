import { getSettings, getTabs } from "../storage/chromeStorage";
import { waitingCount } from "../ui/main/listModel";
import { strings } from "../ui/strings";

export const BADGE_ALARM = "tabSandwich.badge";

/** Time passing makes tabs wait without anything else happening, so while the count shows, it's looked at again. */
const RECOUNT_MINUTES = 60;
const MOST_SHOWN = 99;
const COUNT_COLOR = "#8A5A00";

/**
 * What a save from the right-click menu says: there's no popup open to show it in, so the
 * toolbar icon's badge flashes. An already-saved page counts as saved: it's in your library.
 */
const FLASH_MS = 2500;
const FLASHES = {
    saved: { text: "✓", color: "#1E7F4F" },
    failed: { text: "!", color: "#B42339" },
};

let flashing: ReturnType<typeof setTimeout> | undefined;

async function keepRecounting(on: boolean): Promise<void> {
    if (!on) await chrome.alarms.clear(BADGE_ALARM);
    else if (!(await chrome.alarms.get(BADGE_ALARM))) await chrome.alarms.create(BADGE_ALARM, { periodInMinutes: RECOUNT_MINUTES });
}

/** The count on the icon, if it's wanted: Chrome forgets it when it restarts. It waits while a flash is showing, which ends by coming back here. */
export async function refreshBadge(): Promise<void> {
    const settings = await getSettings();
    const count = settings.toolbarBadge ? waitingCount(await getTabs(), settings) : 0;
    await keepRecounting(settings.toolbarBadge);
    if (flashing !== undefined) return;
    await Promise.all([
        chrome.action.setBadgeBackgroundColor({ color: COUNT_COLOR }),
        chrome.action.setBadgeText({ text: count === 0 ? "" : count > MOST_SHOWN ? `${MOST_SHOWN}+` : String(count) }),
        // (A badge can't be read by a screen reader; the icon's name can.)
        chrome.action.setTitle({ title: count === 0 ? strings.appName : strings.badgeTitle(count) }),
    ]);
}

export async function flashBadge(outcome: keyof typeof FLASHES): Promise<void> {
    clearTimeout(flashing);
    flashing = setTimeout(() => {
        flashing = undefined;
        void refreshBadge();
    }, FLASH_MS);
    const { text, color } = FLASHES[outcome];
    await chrome.action.setBadgeBackgroundColor({ color });
    await chrome.action.setBadgeText({ text });
}
