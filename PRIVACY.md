# Privacy Policy — Tab Sandwich

**Last updated:** 2026-07-08

Tab Sandwich is a Chrome extension for saving and organizing browser tabs. This policy explains what data the extension handles and what it does with it.

## What data is stored

When you save a tab, Tab Sandwich stores:

- The page's title
- The page's URL
- The page's favicon (an image URL supplied by the page/browser)
- A category you assign (optional)
- The date and time you saved it

This data is stored **only on your own device**, using Chrome's built-in `chrome.storage.local` API — the same mechanism Chrome itself uses for extension settings. It is never transmitted anywhere.

## What Tab Sandwich does not do

- It does not send any data to a server. Tab Sandwich has no server or backend of any kind.
- It does not track your browsing activity beyond the specific tabs you explicitly choose to save.
- It does not use analytics, telemetry, or third-party tracking of any kind.
- It does not sell, rent, or share your data with anyone, because it never leaves your device in the first place.
- It does not use your data for advertising, credit, lending, or any purpose other than letting you see and manage the tabs you saved.

## Permissions

- **`activeTab`** — used only at the moment you click the extension's icon or use its keyboard shortcut, to read the title, URL, and favicon of the tab you're currently viewing so it can be saved. Tab Sandwich cannot see any other tab, and cannot see this information at any other time.
- **`storage`** — used to save your saved tabs and settings locally via `chrome.storage.local`, so they persist between browser sessions.

## Data deletion

Since all data lives in your local browser storage, you can delete it at any time by:
- Deleting individual saved tabs from within the extension, or
- Uninstalling the extension, which removes all of its stored data along with it.

## Changes to this policy

If this policy changes, the "Last updated" date above will change accordingly. Given the extension's design (no server, no data collection), material changes are unlikely.

## Contact

Questions about this policy can be raised via the project's GitHub repository: https://github.com/eamoe/TabSandwich
