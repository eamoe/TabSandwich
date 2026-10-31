/**
 * What a save from the right-click menu says: there's no popup open to show it in, so the
 * toolbar icon's badge flashes. An already-saved page counts as saved: it's in your library.
 */
const FLASH_MS = 2500;
const FLASHES = {
    saved: { text: "✓", color: "#1E7F4F" },
    failed: { text: "!", color: "#B42339" },
};

let clearing: ReturnType<typeof setTimeout> | undefined;

export async function flashBadge(outcome: keyof typeof FLASHES): Promise<void> {
    clearTimeout(clearing);
    const { text, color } = FLASHES[outcome];
    await chrome.action.setBadgeBackgroundColor({ color });
    await chrome.action.setBadgeText({ text });
    clearing = setTimeout(() => void chrome.action.setBadgeText({ text: "" }), FLASH_MS);
}
