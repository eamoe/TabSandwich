# Privacy Policy — Tab Sandwich

**Last updated:** 2026-10-04

Tab Sandwich is a Chrome extension for saving and organizing browser tabs. This policy explains what data the extension handles and what it does with it.

## What data is stored

When you save a tab, Tab Sandwich stores:

- The page's title
- The page's URL
- A category you assign (optional)
- The date and time you saved it

Tab Sandwich also stores your settings: your categories and their colors, the outdated-tab setting, your light/dark theme choice, and how you sort the list.

This data is stored **only on your own device**, using Chrome's built-in `chrome.storage.local` API — the same mechanism Chrome itself uses for extension settings. Tab Sandwich itself never transmits it anywhere.

Alongside it, Tab Sandwich keeps a data-format version number, the version number of the last "What's new" note you've seen (so it isn't shown again), and — only after an update has changed the format of your stored data — a backup copy of that data exactly as it was just before the update, so nothing is lost if an update goes wrong. The backup is stored in the same local place, contains only the data listed above plus your settings, and is never transmitted anywhere either.

## Favicons

No favicon data is stored at all. To show a saved tab's icon, the popup asks Chrome's built-in favicon cache for whatever it already has locally for that page's URL — the `favicon` permission is what allows this. The sites behind your saved tabs never see a request for their favicon: nothing is fetched over the network for this. A page Chrome has no cached icon for just shows a generic placeholder instead.

## Export & import

Settings includes an optional Export/Import feature. Export writes everything listed above, including your settings, to a `.json` file that downloads to your own device — this is a plain local file save, not a network transmission, and it only happens when you click "Export." Import reads a `.json` file you choose from your own device and lets you either merge it into your existing saved tabs or replace them entirely; nothing is sent anywhere as part of importing either. Both actions are entirely under your control and touch no server.

## What Tab Sandwich does not do

- It does not send any data to a server. Tab Sandwich has no server or backend of any kind.
- It does not track your browsing activity beyond the specific tabs you explicitly choose to save.
- It does not use analytics, telemetry, or third-party tracking of any kind.
- It does not sell, rent, or share your data with anyone, because it never leaves your device in the first place.
- It does not use your data for advertising, credit, lending, or any purpose other than letting you see and manage the tabs you saved.

## Permissions

- **`activeTab`** — used only after you click the extension's icon or use its keyboard shortcut, to read the title and URL of the tab you're currently viewing: the popup shows them so you can see what you're about to save, and saves them if you click Save. Nothing is stored unless you save. Tab Sandwich cannot see any other tab, and cannot see this information at any other time.
- **`storage`** — used to save your saved tabs and settings locally via `chrome.storage.local`, so they persist between browser sessions.
- **`favicon`** — lets the popup read icons out of Chrome's own local favicon cache to show next to each saved tab, instead of fetching them from the page's own site. See "Favicons" above.

## Data deletion

Since all data lives in your local browser storage, you can delete it at any time by:
- Deleting individual saved tabs from within the extension, or
- Uninstalling the extension, which removes all of its stored data, including any update backup copy, along with it.

## Changes to this policy

If this policy changes, the "Last updated" date above will change accordingly. Given the extension's design (no server, no data collection), material changes are unlikely.

## Contact

Questions about this policy can be raised via the project's GitHub repository: https://github.com/eamoe/TabSandwich
