# Tab Sandwich

## Overview

**Tab Sandwich** is a Chrome extension for saving and organizing browser tabs. Save the tab you're on with one click, or add any link manually. Organize saved tabs into categories, filter and search visually, edit or delete entries in place, and get a nudge when something's been sitting around long enough to be worth revisiting.

Data is stored locally via `chrome.storage.local` — nothing leaves your browser.

## Features

- **Save the current tab** — the popup shows the page you're on; pick a category if you like and click Save.
- **Save a whole window** — "Save all tabs in this window", under Save, saves every web page open in the window into the picked category (Uncategorized when the page you're on is already saved, since its category is that one page's), skipping browser pages and pages already saved, and says exactly how many it saved and skipped. It then offers to close the saved tabs (never on its own; the tab you're on stays open). Chrome asks for permission to see your open tabs the first time; saying no leaves everything else working.
- **Saved windows** — a window saved in one go stays together in the list as one row with a random sandwich name ("Toasted Rye"), its tab count and the date; click it (or press →) to open it and see its tabs. Its ⋯ menu opens all its tabs in a new window (keeping or removing them), renames it, breaks it apart, or deletes it with its tabs (all undoable). Filtering or searching shows every tab as its own row, so nothing stays hidden in a closed window.
- **A friendly start** — with nothing saved yet, the list shows three tips: saving, the keyboard shortcut, and categories. A search that finds nothing says so and, inside a filter, offers to search everything.
- **What's new** — after an update, a short note at the top of the list says what changed; dismiss it with one click.
- **Add a link manually** — for anything that isn't your active tab, via the **+** button in the header.
- **Knows what you've saved** — on a page you've already saved, the popup says when ("Saved 12 days ago") instead of offering Save again. **Show** finds it in the list; **Update** refreshes the saved copy with the page's current title and address, today's date and the picked category (undoable). Adding an already-saved link by hand offers to open it.
- **Search** — fuzzy-matches on title, domain, and path as you type, with matched characters highlighted; combines with an active category or Outdated filter.
- **Categories** — assign a category to each saved tab, filter the list by category, manage the category list (add/rename/remove/reorder) from Settings.
- **Color-coded categories** — each category gets a color from a preset palette (set per-category in Settings). Saved tabs are tinted and outlined in it and show the category name next to a matching dot, so the list scans by color without relying on color alone.
- **Inline editing** — fix a title, URL, or category without deleting and re-adding.
- **Undo delete** — deleting a tab shows an 8-second Undo option before it's gone for good.
- **Storage write protection** — a save, edit, delete, or category change that fails to write (e.g. storage full) shows a specific error instead of silently vanishing, and a warning appears once storage is over 80% full, before you actually hit the limit.
- **Export & import** — back up all your saved tabs and settings to a JSON file, and restore them later by merging into or replacing what's currently saved (also undoable).
- **Drag-to-reorder** — arrange saved tabs in whatever order makes sense to you.
- **Sorting** — newest, oldest, title or site, remembered between opens. Sorting never rewrites your own order, so switching back restores it exactly.
- **Outdated tab tracking** — tabs saved longer than a configurable number of days (7 by default) get a small moon badge with their age and their own quick filter.
- **Light and dark** — the popup follows your computer's light or dark mode, even while it's open, or you can pin it to Light or Dark in Settings.
- **Calm Settings** — grouped into General, Categories, Backup and About; each category has one color dot that opens a small palette.
- **Keyboard shortcut** — open the popup with `Alt+S` (customizable via Chrome's own shortcut settings, linked from within the extension).
- **Works without a mouse** — every action works from the keyboard: arrow keys move through the list, Enter opens, E edits, Delete deletes (Ctrl+Z / ⌘Z undoes), Alt+arrows move a tab, → and ← open and close a saved window, / jumps to search. The keys are listed in Settings › General.

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
- `pnpm visual` — compares every screen, light and dark, with its approved screenshot, inside Playwright's Docker image (Docker must be running). `pnpm visual:update` approves new pictures after an intended visual change.
- `pnpm store:screenshots` — renders the Chrome Web Store screenshots into `store-assets/` (after `pnpm build`).
- `pnpm icons` — renders the extension's icons into `images/` from the drawings in `branding/`.
- `pnpm lint` / `pnpm typecheck` — code checks.
- `pnpm check` — all of the above, in the same order CI runs them.
- GitHub Actions runs every check on each pull request (`.github/workflows/ci.yml`). Each version tag is checked the same way before its release zip is built from the tested `dist/` (`.github/workflows/release.yml`); `dist/` itself is never committed.

## License

See [LICENSE](LICENSE).
