# Tab Sandwich

## Overview

**Tab Sandwich** is a Chrome extension for saving and organizing browser tabs. Save the tab you're on with one click, or add any link manually. Organize saved tabs into categories, filter and search visually, edit or delete entries in place, and get a nudge when something's been sitting around long enough to be worth revisiting.

Data is stored locally via `chrome.storage.local` — nothing leaves your browser.

## Features

- **Save the current tab** — the popup shows the page you're on; pick a category if you like and click Save.
- **Add a link manually** — for anything that isn't your active tab, via the **+** button in the header.
- **Duplicate detection** — saving an already-saved URL highlights the existing entry instead of creating a copy.
- **Search** — fuzzy-matches on title, domain, and path as you type, with matched characters highlighted; combines with an active category or Outdated filter.
- **Categories** — assign a category to each saved tab, filter the list by category, manage the category list (add/rename/remove/reorder) from Settings.
- **Color-coded categories** — each category gets a color from a preset palette (set per-category in Settings). Saved tabs are tinted and outlined in it and show the category name next to a matching dot, so the list scans by color without relying on color alone.
- **Inline editing** — fix a title, URL, or category without deleting and re-adding.
- **Undo delete** — deleting a tab shows an 8-second Undo option before it's gone for good.
- **Storage write protection** — a save, edit, delete, or category change that fails to write (e.g. storage full) shows a specific error instead of silently vanishing, and a warning appears once storage is over 80% full, before you actually hit the limit.
- **Export & import** — back up all your saved tabs and settings to a JSON file, and restore them later by merging into or replacing what's currently saved (also undoable).
- **Drag-to-reorder** — arrange saved tabs in whatever order makes sense to you.
- **Outdated tab tracking** — tabs saved longer than a configurable number of days (7 by default) get a small moon badge with their age and their own quick filter.
- **Light and dark** — the popup follows your computer's light or dark mode, even while it's open.
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

Needs Node.js 22 or newer and [pnpm](https://pnpm.io/installation). The pnpm version is pinned in `package.json`, and pnpm switches to it automatically.

```console
git clone https://github.com/eamoe/TabSandwich.git
cd TabSandwich
pnpm install
pnpm build
```

Then load the `dist/` folder (not the repository root) as an unpacked extension via `chrome://extensions` → **Load unpacked**, same as above. After any code change, run `pnpm build` again (or keep `pnpm watch` running) and click the reload icon on the extension's card.

## Development

- `pnpm build` — type-check and build the extension into `dist/`.
- `pnpm watch` — rebuild `dist/` on every save.
- `pnpm test` — logic and component tests (a second or so, no browser needed).
- `pnpm test:e2e` — robot tests: a real Chromium loads the built `dist/`, clicks through the popup, and runs an accessibility scan. Needs `pnpm exec playwright install chromium` once, and a fresh `pnpm build`.
- `pnpm lint` / `pnpm typecheck` — code checks.
- `pnpm check` — all of the above, in the same order CI runs them.
- GitHub Actions runs every check on each pull request (`.github/workflows/ci.yml`). Each version tag is checked the same way before its release zip is built from the tested `dist/` (`.github/workflows/release.yml`); `dist/` itself is never committed.

## License

See [LICENSE](LICENSE).
