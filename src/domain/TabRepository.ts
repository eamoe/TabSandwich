import { SavedTab } from "../types";
import { getTabs, setTabs } from "../storage/chromeStorage";
import { urlsMatch } from "../util/url";

export interface AddTabInput {
    title: string;
    url: string;
    faviconUrl?: string;
    category?: string;
}

export interface AddTabResult {
    tab: SavedTab;
    duplicate: boolean;
}

/** Adds a tab, or returns the existing match untouched — FR-003's duplicate rule lives here so every save path shares it. */
export async function addTab(input: AddTabInput): Promise<AddTabResult> {
    const tabs = await getTabs();
    const existing = tabs.find((t) => urlsMatch(t.url, input.url));
    if (existing) {
        return { tab: existing, duplicate: true };
    }

    const newTab: SavedTab = {
        id: Date.now().toString(),
        title: input.title,
        url: input.url,
        faviconUrl: input.faviconUrl,
        category: input.category,
        savedAt: Date.now(),
    };
    await setTabs([newTab, ...tabs]);
    return { tab: newTab, duplicate: false };
}
