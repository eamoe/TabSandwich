# Privacy Policy — Tab Sandwich

**Last updated:** 2026-10-31

Tab Sandwich is a Chrome extension for saving and organizing browser tabs. This policy explains what data the extension handles and what it does with it.

## What data is stored

When you save a tab, Tab Sandwich stores:

- The page's title
- The page's URL
- A category you assign (optional)
- The date and time you saved it
- Which saved window it belongs to, if you saved it as part of a whole window
- Whether you've pinned it
- Whether, and when, you archived it
- A note you write about it (optional)
- When you last opened it from Tab Sandwich, and how many times (only opens from Tab Sandwich's own list are counted; it can't see your browsing)

For each saved window, Tab Sandwich stores its name (a random one like "Toasted Rye", which you can change), when it was saved, and whether you've left it open or closed in the list.

Tab Sandwich also stores your settings: your categories and their colors, the waiting reminder (after how many days, and which categories it covers), your light/dark theme choice, and how you sort the list. It also notes, for this browser only, since when it has counted opens and until when you've put off the cleanup tip.

This data is stored **only on your own device**, using Chrome's built-in `chrome.storage.local` API — the same mechanism Chrome itself uses for extension settings. Tab Sandwich itself never transmits it anywhere.

Alongside it, Tab Sandwich keeps a data-format version number, the version number of the last "What's new" note you've seen (so it isn't shown again), a random marker of which part of the extension wrote last (so its open screens can stay up to date; it says nothing about you), and — only after an update has changed the format of your stored data — a backup copy of that data exactly as it was just before the update, so nothing is lost if an update goes wrong. The backup is stored in the same local place, contains only the data listed above plus your settings, and is never transmitted anywhere either.

## Saving from the right-click menu

"Save to Tab Sandwich" in the right-click menu saves the link you clicked (or the page, away from any link) into the category you pick. Chrome tells extensions where a link goes but not what it says, so at that moment, and only then, Tab Sandwich reads the words on that one link from that one page, to use as the saved tab's title. It reads nothing else on the page, nothing runs on any page until you make that choice, and the words stay on your device like the rest.

## Searching from the address bar

After you type `ts` and a space in Chrome's address bar, Chrome passes what you type next to Tab Sandwich, and only that. It's searched against your saved tabs on your device, and nothing is stored or sent anywhere.

## Saving a whole window, or from the side panel (optional)

"Save all tabs in this window" saves every web page open in the current window in one go. To read those tabs' titles and addresses, Tab Sandwich needs Chrome's optional **`tabs`** permission. The side panel needs it too, to show and save the page you're on, because it stays open while you browse. It is not requested at install: Chrome asks you the first time you save a whole window or save from the side panel, and Tab Sandwich works without it if you say no (the side panel then shows your list, but can't save the page you're on). You can take it back at any time in Chrome's extension settings.

With the permission granted, the popup or side panel reads the titles and addresses of the tabs open in its window, only while it is open, so the save card can say how many of them are new. Nothing is stored unless you click to save them, and then only the same four things as for any saved tab (title, URL, category, date). Without the permission, the popup only counts how many tabs are open, without seeing what they are. Closing the saved tabs afterwards happens only when you click to close them.

## Favicons

No favicon data is stored at all. To show a saved tab's icon, the popup asks Chrome's built-in favicon cache for whatever it already has locally for that page's URL — the `favicon` permission is what allows this. The sites behind your saved tabs never see a request for their favicon: nothing is fetched over the network for this. A page Chrome has no cached icon for just shows a generic placeholder instead. So that one-color icons (such as GitHub's black cat) stay visible in dark mode, the popup looks at each icon's colors on your device while it's open; the result is kept only until the popup closes, never stored or sent anywhere.

## Export & import

Settings includes an optional Export/Import feature. Export writes everything listed above, including your settings and saved windows, to a `.json` file that downloads to your own device — this is a plain local file save, not a network transmission, and it only happens when you click "Export." Import reads a `.json` file you choose from your own device and lets you either merge it into your existing saved tabs or replace them entirely; nothing is sent anywhere as part of importing either. Both actions are entirely under your control and touch no server.

## What Tab Sandwich does not do

- It does not send any data to a server. Tab Sandwich has no server or backend of any kind.
- It does not track your browsing activity beyond the specific tabs you explicitly choose to save. With the optional `tabs` permission, it looks at the tabs open in a window only while its popup or side panel is open there, and keeps nothing it hasn't been asked to save.
- It does not use analytics, telemetry, or third-party tracking of any kind.
- It does not sell, rent, or share your data with anyone, because it never leaves your device in the first place.
- It does not use your data for advertising, credit, lending, or any purpose other than letting you see and manage the tabs you saved.

## Permissions

- **`activeTab`** — used only after you click the extension's icon, use its keyboard shortcut or pick "Save to Tab Sandwich" in the right-click menu, to read the title and URL of the tab you're currently viewing: the popup shows them so you can see what you're about to save, and saves them if you click Save. Nothing is stored unless you save. Tab Sandwich cannot see any other tab, and cannot see this information at any other time.
- **`contextMenus`** — adds "Save to Tab Sandwich" to the right-click menu.
- **`scripting`** — lets that menu item read the words on the one link you right-clicked, at that moment. See "Saving from the right-click menu" above.
- **`storage`** — used to save your saved tabs and settings locally via `chrome.storage.local`, so they persist between browser sessions.
- **`sidePanel`** — lets you keep Tab Sandwich open in Chrome's side panel, beside the page you're on.
- **`tabs`** (optional, asked for only when you first save a whole window or save from the side panel) — lets the popup or side panel read the titles and addresses of the tabs open in its window, so it can save them all at once and say how many are new. See "Saving a whole window" above. Saying no leaves every other feature working.
- **`favicon`** — lets the popup read icons out of Chrome's own local favicon cache to show next to each saved tab, instead of fetching them from the page's own site. See "Favicons" above.

## Data deletion

Since all data lives in your local browser storage, you can delete it at any time by:
- Deleting individual saved tabs from within the extension, or
- Uninstalling the extension, which removes all of its stored data, including any update backup copy, along with it.

## Changes to this policy

If this policy changes, the "Last updated" date above will change accordingly. Given the extension's design (no server, no data collection), material changes are unlikely.

## Contact

Questions about this policy can be raised via the project's GitHub repository: https://github.com/eamoe/TabSandwich
