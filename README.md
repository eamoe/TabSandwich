# Tab Sandwich

## Overview

**Tab Sandwich** is a Chrome extension for saving and organizing browser tabs. Save the tab you're on with one click, or add any link manually. Organize saved tabs into categories, filter and search visually, edit or delete entries in place, and get a nudge when something's been sitting around long enough to be worth revisiting.

Data is stored locally via `chrome.storage.local` — nothing leaves your browser.

## Features

- **Save the current tab** — one click, no setup.
- **Add a link manually** — for anything that isn't your active tab, via a secondary "+ Add a link manually" form.
- **Duplicate detection** — saving an already-saved URL highlights the existing entry instead of creating a copy.
- **Categories** — assign a category to each saved tab, filter the list by category, manage the category list (add/remove) from Settings.
- **Inline editing** — fix a title, URL, or category without deleting and re-adding.
- **Drag-to-reorder** — arrange saved tabs in whatever order makes sense to you.
- **Outdated tab tracking** — tabs saved longer than a configurable number of days (7 by default) get a visible badge and their own quick filter.
- **Keyboard shortcut** — open the popup with `Alt+S` (customizable via Chrome's own shortcut settings, linked from within the extension).
- **Keyboard accessible** — every core action (save, filter, edit, delete, settings) works without a mouse.

## Installation

### From a release (recommended)

1. Go to the [Releases](../../releases) page and download the zip attached to the latest release.
2. Unzip it.
3. Open `chrome://extensions` in Chrome.
4. Enable **Developer mode** (top-right toggle).
5. Click **Load unpacked** and select the unzipped folder.

### From source (for development)

```console
git clone https://github.com/eamoe/TabSandwich.git
cd TabSandwich
npm install
npm run build
```

Then load the repository root as an unpacked extension via `chrome://extensions` → **Load unpacked**, same as above. After any code change, run `npm run build` again and click the reload icon on the extension's card.

## Development

- `npm run build` — compile once.
- `npm run watch` — compile on every save.
- Compiled output (`popup/js/`) is not committed to version control; a GitHub Actions workflow builds and packages a release zip for each tagged release (see `.github/workflows/release.yml`).

## License

See [LICENSE](LICENSE).
