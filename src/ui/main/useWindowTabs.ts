import { useEffect, useState } from "preact/hooks";

/** The optional permission that lets the popup see every open tab's address and title. */
export const ALL_TABS_PERMISSION: chrome.permissions.Permissions = { permissions: ["tabs"] };

export interface WindowTabs {
    /** The window's open tabs; without the permission only the active one carries its address and title. */
    tabs: chrome.tabs.Tab[];
    /** Whether "Save all tabs in this window" may read every tab (the optional "tabs" permission). */
    canSeeAll: boolean;
}

/**
 * The tabs open in the popup's window, kept current while the popup is open (opened, closed,
 * navigated), and whether the optional permission to read them all has been granted — asked
 * for only when you first save a whole window, and it can be taken back in Chrome at any time.
 * `undefined` until the first read completes.
 */
export function useWindowTabs(): WindowTabs | undefined {
    const [state, setState] = useState<WindowTabs | undefined>(undefined);

    useEffect(() => {
        let live = true;
        let reading = 0;
        const read = async () => {
            const turn = ++reading;
            const [tabs, canSeeAll] = await Promise.all([
                chrome.tabs.query({ currentWindow: true }),
                chrome.permissions.contains(ALL_TABS_PERMISSION),
            ]);
            // Only the newest read paints: events can arrive in bursts (closing ten tabs).
            if (live && turn === reading) setState({ tabs, canSeeAll });
        };
        const onChange = () => void read();
        const onUpdated = (_id: number, change: chrome.tabs.TabChangeInfo) => {
            if (change.title !== undefined || change.url !== undefined) void read();
        };
        void read();
        chrome.tabs.onCreated.addListener(onChange);
        chrome.tabs.onRemoved.addListener(onChange);
        chrome.tabs.onUpdated.addListener(onUpdated);
        permissionEvents().forEach((event) => event.addListener(onChange));
        return () => {
            live = false;
            chrome.tabs.onCreated.removeListener(onChange);
            chrome.tabs.onRemoved.removeListener(onChange);
            chrome.tabs.onUpdated.removeListener(onUpdated);
            permissionEvents().forEach((event) => event.removeListener(onChange));
        };
    }, []);

    return state;
}

/** Permission granted or taken back (in Chrome's extension settings, say). Typed as full events:
 *  @types/chrome leaves out their removeListener, which Chrome has like every other event. */
function permissionEvents(): chrome.events.Event<() => void>[] {
    return [chrome.permissions.onAdded, chrome.permissions.onRemoved] as unknown as chrome.events.Event<() => void>[];
}
