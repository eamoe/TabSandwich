import { useEffect, useState } from "preact/hooks";

/** Chrome's own page for changing extension shortcuts (an extension can't set its own). */
export const SHORTCUTS_PAGE = "chrome://extensions/shortcuts";

/** The keyboard shortcut that opens the popup: "Alt+S", "" when none is set, null until Chrome answers. */
export function useShortcut(): string | null {
    const [shortcut, setShortcut] = useState<string | null>(null);
    useEffect(() => {
        chrome.commands.getAll((commands) => {
            setShortcut(commands.find((c) => c.name === "_execute_action")?.shortcut || "");
        });
    }, []);
    return shortcut;
}
