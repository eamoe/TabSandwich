# Privacy Policy — Tab Sandwich

**Last updated:** 2026-10-09

Tab Sandwich is a Chrome extension for saving and organizing browser tabs. This policy explains what data the extension handles and what it does with it.

## What data is stored

When you save a tab, Tab Sandwich stores:

- The page's title
- The page's URL
- A category you assign (optional)
- The date and time you saved it
- Which saved window it belongs to, if you saved it as part of a whole window

For each saved window, Tab Sandwich stores its name (a random one like "Toasted Rye", which you can change), when it was saved, and whether you've left it open or closed in the list.

Tab Sandwich also stores your settings: your categories and their colors, the waiting reminder (after how many days, and which categories it covers), your light/dark theme choice, and how you sort the list.

This data is stored **only on your own device**, using Chrome's built-in `chrome.storage.local` API — the same mechanism Chrome itself uses for extension settings. Tab Sandwich itself never transmits it anywhere.

Alongside it, Tab Sandwich keeps a data-format version number, the version number of the last "What's new" note you've seen (so it isn't shown again), and — only after an update has changed the format of your stored data — a backup copy of that data exactly as it was just before the update, so nothing is lost if an update goes wrong. The backup is stored in the same local place, contains only the data listed above plus your settings, and is never transmitted anywhere either.

## Saving a whole window (optional)

"Save all tabs in this window" saves every web page open in the current window in one go. To read those tabs' titles and addresses, Tab Sandwich needs Chrome's optional **`tabs`** permission. It is not requested at install: Chrome asks you the first time you use this feature, and Tab Sandwich works fully without it if you say no. You can take it back at any time in Chrome's extension settings.

With the permission granted, the popup reads the titles and addresses of the tabs open in its window, only while the popup is open, so the save card can say how many of them are new. Nothing is stored unless you click to save them, and then only the same four things as for any saved tab (title, URL, category, date). Without the permission, the popup only counts how many tabs are open, without seeing what they are. Closing the saved tabs afterwards happens only when you click to close them.

## Favicons

No favicon data is stored at all. To show a saved tab's icon, the popup asks Chrome's built-in favicon cache for whatever it already has locally for that page's URL — the `favicon` permission is what allows this. The sites behind your saved tabs never see a request for their favicon: nothing is fetched over the network for this. A page Chrome has no cached icon for just shows a generic placeholder instead. So that one-color icons (such as GitHub's black cat) stay visible in dark mode, the popup looks at each icon's colors on your device while it's open; the result is kept only until the popup closes, never stored or sent anywhere.

## Export & import

Settings includes an optional Export/Import feature. Export writes everything listed above, including your settings and saved windows, to a `.json` file that downloads to your own device — this is a plain local file save, not a network transmission, and it only happens when you click "Export." Import reads a `.json` file you choose from your own device and lets you either merge it into your existing saved tabs or replace them entirely; nothing is sent anywhere as part of importing either. Both actions are entirely under your control and touch no server.

## What Tab Sandwich does not do

- It does not send any data to a server. Tab Sandwich has no server or backend of any kind.
- It does not track your browsing activity beyond the specific tabs you explicitly choose to save. With the optional `tabs` permission, it looks at the tabs open in a window only while its popup is open there, and keeps nothing it hasn't been asked to save.
- It does not use analytics, telemetry, or third-party tracking of any kind.
- It does not sell, rent, or share your data with anyone, because it never leaves your device in the first place.
- It does not use your data for advertising, credit, lending, or any purpose other than letting you see and manage the tabs you saved.

## Permissions

- **`activeTab`** — used only after you click the extension's icon or use its keyboard shortcut, to read the title and URL of the tab you're currently viewing: the popup shows them so you can see what you're about to save, and saves them if you click Save. Nothing is stored unless you save. Tab Sandwich cannot see any other tab, and cannot see this information at any other time.
- **`storage`** — used to save your saved tabs and settings locally via `chrome.storage.local`, so they persist between browser sessions.
- **`tabs`** (optional, asked for only when you first save a whole window) — lets the popup read the titles and addresses of the tabs open in its window, so it can save them all at once and say how many are new. See "Saving a whole window" above. Saying no leaves every other feature working.
- **`favicon`** — lets the popup read icons out of Chrome's own local favicon cache to show next to each saved tab, instead of fetching them from the page's own site. See "Favicons" above.

## Data deletion

Since all data lives in your local browser storage, you can delete it at any time by:
- Deleting individual saved tabs from within the extension, or
- Uninstalling the extension, which removes all of its stored data, including any update backup copy, along with it.

## Changes to this policy

If this policy changes, the "Last updated" date above will change accordingly. Given the extension's design (no server, no data collection), material changes are unlikely.

## Contact

Questions about this policy can be raised via the project's GitHub repository: https://github.com/eamoe/TabSandwich
