import { useEffect, useState } from "preact/hooks";

/**
 * The tab the save card describes. Read when the popup opens (the toolbar click grants
 * activeTab for exactly this tab), and re-read if the active tab changes or finishes loading
 * while the popup is open — Save itself always re-reads, so it saves what is active right then.
 * `undefined` until the first read completes.
 */
export function useActiveTab(): chrome.tabs.Tab | null | undefined {
    const [tab, setTab] = useState<chrome.tabs.Tab | null | undefined>(undefined);

    useEffect(() => {
        let live = true;
        const read = async () => {
            const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (live) setTab(active ?? null);
        };
        const onActivated = () => void read();
        const onUpdated = (_id: number, change: chrome.tabs.TabChangeInfo) => {
            if (change.title !== undefined || change.url !== undefined || change.status === "complete") void read();
        };
        void read();
        chrome.tabs.onActivated.addListener(onActivated);
        chrome.tabs.onUpdated.addListener(onUpdated);
        return () => {
            live = false;
            chrome.tabs.onActivated.removeListener(onActivated);
            chrome.tabs.onUpdated.removeListener(onUpdated);
        };
    }, []);

    return tab;
}
