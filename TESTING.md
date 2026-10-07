# Test Cases

This is the full list of what Tab Sandwich must do — the spec the automated tests implement, plus the cases only a person can judge. Cases marked **[auto]** are checked automatically on every pull request and before every release (`pnpm check` runs the same checks locally); the rest are checked by hand, and the short manual release pass below lists the ones to repeat every release.

## Automated checks

```console
pnpm install --frozen-lockfile
pnpm exec playwright install chromium   # once
pnpm check                     # lint, typecheck, logic tests, build, robot tests
```

- **Logic tests** (`tests/unit/`, `pnpm test`): storage, duplicate detection, search, the main list's filter rules, categories, backup files, the theme setting, data upgrades, legacy migration, manifest permissions; plus component tests for the shared building blocks.
- **Robot tests** (`tests/e2e/`, `pnpm test:e2e`): a real Chromium loads the built `dist/` and clicks through the popup — saving, editing, deleting and undo, search, filters and sorting, categories, export and import, the keyboard, saving a whole window (with a stand-in for Chrome's permission prompt), saved windows, selecting many — then runs an accessibility scan of each screen, once in light and once in dark mode, color contrast included (`KNOWN_GAPS` in `tests/e2e/accessibility.spec.ts` is empty).
- **Approved screenshots** (`tests/visual/`, `pnpm visual`): every screen and key state, in light and dark, compared pixel for pixel with its approved picture, in Playwright's Docker image (CI's `visual` job). Any visual change fails with expected / actual / diff side by side; approve an intended one with `pnpm visual:update`.
- In tests, "Save Tab" saves a page of a fake site (`https://example.test`) served by the test itself; the test copy of the extension is granted access to that fake site in place of the `activeTab` grant a real toolbar click gives. That's why opening the popup from the real toolbar stays in the manual pass.

## Manual release pass

Run on the build being released (`dist/`, or the release zip unpacked), about 10 minutes:

1. Open the popup from the toolbar icon and with the keyboard shortcut (TC-072) on a real web page, and save it (TC-001). Check its icon shows in the list (or a letter tile for a site Chrome has no icon for, TC-102) and that no request goes to the site for it (TC-105).
2. Drag to reorder tabs and categories (TC-050, TC-051, TC-159); confirm drag is off while searching (TC-119).
3. Watch the animations: rows rise in on open, a saved row drops in and flashes, a deleted row slides away, Save presses and pops and the logo hops; all of it stops with the system's reduce-motion setting (TC-049, TC-192, TC-228).
4. Full keyboard pass (TC-090 – TC-092, TC-095).
5. Shortcut display and the **Customize** link (TC-070, TC-071).
6. Glance at every screen in both themes on your own computer (TC-193): the approved screenshots are Linux renders, so fonts on a Mac or Windows PC look slightly different — check nothing is cut off or crowded.
7. Save all tabs in a real window: Chrome's permission prompt, allowed and (on another profile) denied (TC-233); saved windows in real Chrome: open all in a new window, drag tabs in, out and around (TC-245).
8. Update in place from the previous release on the same profile (TC-256) — always, and especially when the release upgrades stored data (3.2 is the first that does).
9. Anything new in this release that isn't marked **[auto]** yet.

## Manual setup

```console
pnpm install
pnpm build
```

1. Open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, select the `dist/` folder.
2. After any code change: `pnpm build` (or keep `pnpm watch` running), then click the reload icon on the extension's card.
3. Unless a case says otherwise, start from a clean state: open the popup's DevTools (right-click → Inspect) and run `chrome.storage.local.clear()`, then reopen the popup.

## Format

Each case: **ID**, **Preconditions**, **Steps**, **Expected Result**. Priority: **P1** (blocks release), **P2** (should pass), **P3** (nice-to-have / cosmetic).

---

## 1. Saving Tabs

**TC-001 — Save the active tab (P1)** **[auto]**
- Preconditions: popup open on a normal `http(s)` page; list empty.
- Steps: Click **Save** in the card under the header (`#save-btn`, named "Save Tab" for screen readers).
- Expected: Entry appears at the top of the list with the page's title, site, and icon, dropping in with a brief highlight. The button briefly reads "✓ Saved!" (also announced to screen readers) and returns to "Save" after ~2.5s.

**TC-002 — Save via manual entry, URL only (P1)** **[auto]**
- Preconditions: popup open; list empty.
- Steps: Click the **+** button in the header ("Add link manually") → the save card turns into the add-a-link form → enter `example.com` in the URL field (`#manual-url`) → click **Add**.
- Expected: Entry appears with title = `example.com` (hostname fallback), URL normalized to `https://example.com/`. The form closes and the save card is back.

**TC-003 — Save via manual entry, all fields (P2)** **[auto]**
- Steps: Open manual entry → URL `https://example.org`, Title `My Site`, Category = any existing category → **Add**.
- Expected: Entry appears with title `My Site` and the selected category.

**TC-004 — Cancel manual entry (P2)** **[auto]**
- Steps: Open manual entry → type something in URL → click **Cancel**.
- Expected: The form closes (the save card is back), no entry created, fields cleared (verify by reopening — URL field is empty).

**TC-005 — Reject unsupported active-tab page (P1)** **[auto]**
- Steps: Open the popup on an internal page (e.g. `chrome://extensions`).
- Expected: The save card says "Only web pages can be saved" under the page's title, and **Save** is disabled; nothing can be saved.

**TC-006 — Reject invalid manual URL — gibberish text (P1)** **[auto]**
- Steps: Open manual entry → enter `weuirytuiwerytweury` (no scheme, no dot) → **Add**.
- Expected: Rejected ("Enter a valid URL" under the fields, the URL field outlined in red); no entry created; the form stays open with the text still in the field.

**TC-007 — Accept manual URL with explicit scheme even if unusual (P3)**
- Steps: Enter `https://localhost` → **Add**.
- Expected: Accepted (explicit scheme is trusted regardless of domain shape).

**TC-008 — Reject empty manual URL (P2)**
- Steps: Open manual entry, leave URL blank → try to submit.
- Expected: Rejected with "Enter a valid URL" under the fields; no entry created.

---

## 2. Duplicate Detection

**TC-010 — Duplicate via Save Tab (P1)** **[auto]**
- Preconditions: one tab already saved.
- Steps: Revisit that same URL as the active tab → open the popup. Also: save a page, and watch the card right after.
- Expected: No **Save Tab** button for a page that's already saved: the card says "✓ Saved N days ago" with **Show** and **Update** instead (TC-215), so no second entry can be created. Right after saving, the button shows "Saved!" for a moment, then the card settles into that saved look. (If the page somehow gets saved twice anyway, e.g. from two windows at once, the button reads "Already saved" in orange with a small shake and the existing entry flashes.)

**TC-011 — Duplicate acknowledgment visible when entry is off-screen (P1)**
- Preconditions: enough tabs saved that the list scrolls; the duplicate target is scrolled out of view.
- Steps: Save a duplicate of an off-screen entry.
- Expected: The acknowledgment at the Save button is visible without scrolling. The list auto-scrolls to reveal and highlight the existing entry.

**TC-012 — Duplicate via manual entry (P2)** **[auto]**
- Steps: Manually add a URL that's already saved.
- Expected: No second entry. The form stays open and says "Already saved as “<title>”." under the fields, followed by **Open** (TC-219); the existing entry is highlighted in the list.

---

## 3. Data Migration (legacy upgrade)

**TC-020 — Migrate existing localStorage data on first run (P1)** **[auto]**
- Preconditions: `chrome.storage.local` cleared (simulate pre-migration).
- Steps: In the popup's console: `localStorage.setItem('links', JSON.stringify([{url:'https://example.com', description:'Example', checked:false}]))` → close and reopen the popup.
- Expected: "Example" appears automatically in the list, no user action needed.

**TC-021 — Migration doesn't repeat or duplicate (P1)** **[auto]**
- Steps: After TC-020, close and reopen the popup again.
- Expected: Still exactly one entry for that URL.

**TC-022 — Fresh install with no legacy data (P2)** **[auto]**
- Steps: Clear both `chrome.storage.local` and `localStorage.removeItem('links')` → reopen popup.
- Expected: Normal empty state, no console errors.

**TC-023 — Corrupt legacy data doesn't crash migration (P3)** **[auto]**
- Steps: `localStorage.setItem('links', 'not valid json')`, clear `chrome.storage.local`, reopen popup.
- Expected: No crash; treated as nothing to migrate (empty list).

---

## 4. Categories

**TC-030 — Assign a category via Edit (P1)**
- Preconditions: one saved tab.
- Steps: Hover the row → click its pencil icon (`aria-label="Edit ..."`) → change the category picker → **Save**.
- Expected: The row's tint, outline and the category name under its title update to match.

**TC-031 — Filter by category (P1)** **[auto]**
- Preconditions: tabs across 2+ categories.
- Steps: Click a category pill under the save card.
- Expected: List narrows to only that category, and rows stop repeating the category name under their titles (it's the same for all of them). Click **All** → full list restored.

**TC-032 — Add a new category (P1)** **[auto]**
- Steps: Settings → Categories → type a name (≤15 chars) → **Add**.
- Expected: New category appears at the top of the list, immediately selectable in Edit mode and the manual-entry form.

**TC-033 — Category name length capped at 15 characters (P2)**
- Steps: Settings → **Categories** tab → type into the "New category" field.
- Expected: Input stops accepting characters at 15 (`maxlength`); the counter inside the field reads "15/15".

**TC-034 — Removing an unused category (P1)** **[auto]**
- Preconditions: a category with no tabs assigned to it.
- Steps: Settings → **Categories** → hover the category → click its trash icon ("Remove …").
- Expected: Category removed from the list, from all category selects, and from filter pills.

**TC-035 — Removing an in-use category is blocked (P1)** **[auto]**
- Preconditions: a category assigned to at least one tab.
- Steps: Settings → **Categories** → hover the category → click its trash icon.
- Expected: Not removed. A message floats just under that category ("In use — reassign its tabs first."), without moving the rows, and clears after ~3s. The trash icon is visually muted but remains clickable.

**TC-036 — "Uncategorized" cannot be removed or renamed (P1)**
- Steps: Inspect the Settings category list.
- Expected: "Uncategorized" never appears there at all (protected sentinel, not manageable).

**TC-037 — Assign a category color (P2)** **[auto]**
- Steps: Settings → **Categories** → click a category's color dot → pick a different color in the strip that floats over the row.
- Expected: The strip opens without moving any row, closes after the pick, and the category's dot, its rows' tint and outline, and its pill dot all take the new color. Escape or a click elsewhere also closes the strip (TC-195).

**TC-038 — Uncategorized tabs stay visually neutral (P2)**
- Steps: Save a tab without assigning a category.
- Expected: Row background is plain white (no colored tint), with a light grey outline and dot; the "Uncategorized" pill has the same grey dot.

**TC-039 — Category-in-use status stays fresh across navigation (P2)**
- Steps: In Settings, attempt to remove an in-use category (see the blocked message) → click **Back** → reassign that tab's category away from it elsewhere → reopen Settings.
- Expected: The category now shows as removable (no stale "in use" state), and the old message is gone.

---

## 5. Editing & Deleting

**TC-040 — Edit title/URL/category (P1)** **[auto]**
- Steps: Hover the row → pencil icon → change title, URL, and category → **Save**.
- Expected: Changes persist after closing and reopening the popup.

**TC-041 — Edit rejects invalid URL (P1)** **[auto]**
- Steps: Enter edit mode → clear URL, type `notaurl` → **Save**.
- Expected: Save blocked, "Enter a valid URL." under the fields, the URL field outlined in red and focused; edit mode stays open.

**TC-042 — Cancel edit discards changes (P2)** **[auto]**
- Steps: Enter edit mode → change fields → **Cancel**.
- Expected: Original values remain; nothing persisted.

**TC-043 — Delete a tab (P1)** **[auto]**
- Steps: Hover a row → click its trash icon.
- Expected: The row slides away and is removed from the list and from storage (still gone after reopening the popup). A toast ("Deleted") appears at the bottom with an **Undo** button.

**TC-044 — Undo restores the tab to its exact original position (P1)** **[auto]**
- Preconditions: 3+ saved tabs in manual order.
- Steps: Delete the middle tab → click **Undo** in the toast before it disappears.
- Expected: The tab reappears at the same position it was deleted from (not at the top or bottom of the list), scrolled into view and briefly highlighted, same as a fresh save.

**TC-045 — Undo toast auto-dismisses and the deletion becomes permanent (P2)**
- Steps: Delete a tab → wait ~8 seconds without clicking Undo.
- Expected: Toast disappears on its own; the tab stays deleted (reopening the popup confirms it's gone from storage).

**TC-046 — Closing the popup during the undo window finalizes the deletion (P1)**
- Steps: Delete a tab → immediately close the popup (before the toast times out or is clicked) → reopen it.
- Expected: The tab is gone, with no error. (The delete write is immediate and doesn't wait on the undo window — only the *offer* to undo is time-limited.)

**TC-047 — A second delete replaces the toast; the first deletion stays permanent (P2)**
- Preconditions: 2+ saved tabs.
- Steps: Delete tab A → before its toast times out, delete tab B.
- Expected: The toast now offers to undo tab B only. Clicking it restores B; A remains deleted.

**TC-048 — Undo toast is unreachable while hidden (P2)**
- Steps: With no toast showing, Tab through the popup.
- Expected: Focus never lands on the (invisible) Undo button.

**TC-049 — Undo from within Settings doesn't corrupt the list (P1)**
- Preconditions: 5+ saved tabs.
- Steps: Delete a tab → open Settings (gear icon) before the toast times out → click **Undo** → click **Back**.
- Expected: The list renders normally — every row at its usual height with normal spacing, the restored tab in its original position. (Regression case from v2.x, where restoring while the list was hidden corrupted row heights. Since v3.0 the main screen stays in the page, just hidden, while Settings is open.)

---

## 6. Drag-and-Drop Reorder

**TC-050 — Reorder persists (P1)** **[auto]**
- Preconditions: 3+ saved tabs.
- Steps: Hover a row so its drag handle (⋮⋮) replaces the icon, then drag it by the handle to a new position: once onto a row's upper half, once onto the last row's lower half.
- Expected: While dragging, a line in the gap shows where the tab will land: above the row under the pointer's upper half, below it on the lower half. The order updates immediately (the very end of the list is reachable) and is preserved after closing/reopening the popup.

**TC-051 — Reorder respects the underlying full list, not just the filtered view (P2)**
- Preconditions: tabs across 2+ categories, filtered to one category.
- Steps: Drag-reorder within the filtered view → switch to **All**.
- Expected: The dragged tab's position relative to same-category tabs reflects the reorder; non-visible tabs from other categories aren't disturbed.

**TC-052 — A row in edit mode is not draggable (P3)**
- Steps: Enter edit mode on a row → attempt to drag it.
- Expected: No drag occurs.

---

## 7. Outdated Tracking

**TC-060 — Outdated badge appears past threshold (P1)** **[auto]**
- Preconditions: Settings → outdated threshold set to 1 day; a tab's `savedAt` backdated via console (`chrome.storage.local.get('tabSandwich.tabs', r => {...})`) to 2+ days ago.
- Steps: Reopen popup.
- Expected: That row shows a small moon badge with its age (e.g. "☾ 2d"); hovering it says "Saved 2 days ago".

**TC-061 — Outdated quick filter (P1)** **[auto]**
- Preconditions: at least one outdated tab exists.
- Steps: Click the moon "Outdated N" pill (appears right after "All"; screen readers hear "Outdated (N)").
- Expected: List narrows to only outdated tabs, regardless of position in the full list.

**TC-062 — Disabling outdated tracking hides badges and filter (P1)** **[auto]**
- Steps: Settings → **General** → switch "Outdated tabs" off.
- Expected: All age badges disappear; the "Outdated" pill is no longer offered.

**TC-063 — Default threshold is 7 days on fresh install (P2)**
- Steps: Clear storage, reopen popup, check Settings.
- Expected: Toggle is on, day input reads 7.

**TC-064 — Changing the day threshold updates badges live (P2)** **[auto]**
- Steps: Change the day-threshold input to a smaller/larger value (press Enter or click away).
- Expected: Badges and the Outdated pill count update; a value outside 1–365 is corrected to the nearest limit.

---

## 8. Settings

**TC-070 — Keyboard shortcut display (P2)**
- Steps: Open Settings (it opens on **General**).
- Expected: Key caps show the actual assigned shortcut (e.g. "Alt" "S", or "⌥S" on a Mac), or "Not set" if there is none.

**TC-071 — Shortcut customize link (P2)**
- Steps: Click **Customize** next to the shortcut badge.
- Expected: Opens `chrome://extensions/shortcuts` in a new tab.

**TC-072 — Trigger popup via keyboard shortcut (P2)**
- Steps: Press the assigned shortcut with focus on a normal web page.
- Expected: Popup opens.

**TC-073 — Settings view toggle + focus management (P1)** **[auto]**
- Steps: Click the gear button in the header → note focus location → click **Back**.
- Expected: Settings replaces the main screen; focus lands on **Back**. Back returns to the main screen exactly as it was (same search, filter and scroll position) and focus returns to the gear button.

---

## 9. Storage Capacity Indicator

**TC-080 — Storage use shown in Settings (P2)** **[auto]**
- Steps: Settings → **General** → **Storage**.
- Expected: A meter and "N saved · less than 1% of the space Chrome gives extensions" (or the real percentage), against the real `chrome.storage.local` quota. Past 80% the meter turns orange and the line adds "Export a backup, then remove tabs you no longer need."

**TC-081 — Storage with nothing saved (P3)**
- Steps: Delete every tab → Settings → **General**.
- Expected: "0 saved · less than 1% of …"; the meter shows a sliver, never an error.

**TC-082 — A storage warning appears past 80% (P2)** **[auto]** (TC-191)
- Preconditions: `chrome.storage.local` usage pushed past 80% of quota — e.g. from the popup's DevTools console, `chrome.storage.local.set({ "tabSandwich.tabs": Array.from({length: N}, (_, i) => ({ id: String(i), title: "x".repeat(2000), url: "https://example.com/"+i, savedAt: Date.now() })) })` with `N` large enough to cross the threshold against the real quota reported by TC-103's `chrome.storage.local.QUOTA_BYTES`.
- Steps: Reopen the popup.
- Expected: An amber "Storage is 83% full." line appears at the top of the list, with **See storage**, which opens Settings. Below the threshold there is no such line. Reset with `chrome.storage.local.clear()` afterward.

---

## 10. Accessibility (keyboard-only, no mouse)

**TC-090 — Full keyboard pass: save flow (P1)**
- Steps: Tab to and activate **Save**; Tab to the **+** button ("Add link manually") and open it, fill the fields via keyboard (including the category picker), submit.
- Expected: All operable via Tab/Shift+Tab/Enter/Space; no dead ends.

**TC-091 — Full keyboard pass: filter/edit/delete (P1)**
- Steps: Tab to a category pill and the Outdated pill and activate each; Tab into the list (it's one stop: the current row's title, then its edit and delete icons) and activate each; use the list's own keys too (TC-220 – TC-226).
- Expected: All operable via keyboard; edit mode's Save/Cancel reachable and usable, Escape cancels.

**TC-092 — Full keyboard pass: Settings (P1)**
- Steps: Tab into Settings; move between the four tabs with the arrow keys; choose a theme; operate the outdated switch and day input; on **Categories** add and remove a category, open a color dot and select a color with Enter/Space (Escape closes it); reach the shortcut **Customize** button; return via **Back**.
- Expected: All operable via keyboard with visible focus indicators throughout.

**TC-093 — No control relies on color alone (P2)**
- Steps: Using a screen reader (or the browser's accessibility inspector), inspect a saved-tab row.
- Expected: The category is written under the title next to its color dot (or, under a category filter, given as screen-reader-only text "Category: …"), never conveyed only by the row's tint and outline.

**TC-094 — Reordering from the keyboard (P2)** **[auto]**
- Since v3.1, Alt+↑/↓ (⌥ on a Mac) moves the focused tab, the keyboard equivalent of dragging. See TC-223.

**TC-095 — The add-a-link fields are unreachable until the form is opened (P1)**
- Preconditions: a freshly opened popup where **+** has never been clicked this session.
- Steps: Tab through the header and the save card.
- Expected: Focus never lands on URL/Title/Category fields of a closed form. (Since v3.0 the form isn't in the page at all until **+** opens it, in place of the save card.)

---

## 11. Edge Cases

**TC-100 — Empty state (P2)**
- Steps: Delete all tabs.
- Expected: The "Nothing saved yet" welcome with its three tips (TC-209) instead of a blank list.

**TC-101 — Rapid duplicate save attempts (P3)**
- Steps: Click **Save** twice in quick succession on the same page.
- Expected: Only one entry ever exists for that URL.

**TC-102 — Favicon with no local cache entry falls back to placeholder (P3)**
- Preconditions: a saved tab for a page Chrome has never visited (so its local favicon cache has nothing for that URL) — e.g. manually add a link to a domain you've never opened in this browser.
- Expected: Chrome's own generic icon, or a tinted tile with the site's first letter, is shown — never a broken-image glyph.

**TC-103 — Manifest permissions remain minimal (P1, release gate)** **[auto]**
- Steps: Inspect `manifest.json`.
- Expected: `permissions` is exactly `["activeTab", "storage", "favicon"]`; `optional_permissions` is exactly `["tabs"]` (asked for only when you first save a whole window, TC-229); `web_accessible_resources` exposes only `_favicon/*`; no other permission has crept back in.

**TC-104 — Build output is not committed (P2, release gate)**
- Steps: `git status` after a fresh `pnpm build`.
- Expected: `dist/` does not appear as new/modified tracked content (it's gitignored and untracked).

**TC-105 — Favicon lookup makes no request to the page's own site (P2)**
- Preconditions: a saved tab for a page you *have* visited before (so Chrome has a cached favicon for it); DevTools Network tab open on the popup (right-click the popup → Inspect → Network), filtered to that page's domain.
- Steps: Reload the popup.
- Expected: No request to the saved page's own domain appears in the Network tab for its favicon, or at all — the icon loads from `chrome-extension://<id>/_favicon/…`, sourced from Chrome's local cache, never the site.

---

## 12. Search

**TC-110 — Basic substring match (P1)** **[auto]**
- Preconditions: a saved tab titled "GitHub" (`github.com`) among several others.
- Steps: Type `git` into the search box in the header (`#search-input`).
- Expected: Only tabs matching on title/domain/path remain; matched characters in the title are visually highlighted.

**TC-111 — Non-contiguous (fuzzy) match (P1)** **[auto]**
- Preconditions: a saved tab titled "GitHub".
- Steps: Type `gthb`.
- Expected: The GitHub tab still matches, with each matched letter highlighted individually.

**TC-112 — Search matches on URL, not just title (P2)** **[auto]**
- Preconditions: a tab whose title doesn't contain the domain (e.g. title "My Notes", url `https://example.com/notes`).
- Steps: Search `example`.
- Expected: The tab appears (matched on hostname), even though its title shows no highlight.

**TC-113 — Multi-word query requires every term to match (P2)**
- Preconditions: a tab titled "Python Tutorial" and a tab titled "Python Reference".
- Steps: Search `python tutorial`.
- Expected: Only "Python Tutorial" remains.

**TC-114 — No results state (P1)** **[auto]**
- Steps: Search for a string that matches nothing, e.g. `zzzzz`.
- Expected: The list says "No saved tabs match “zzzzz”" with a hint to try fewer letters or part of the site's name (distinct from the "Nothing saved yet" welcome); screen readers hear "No matching tabs".

**TC-115 — Search composes with an active category/Outdated pill (P1)** **[auto]**
- Preconditions: tabs across 2+ categories.
- Steps: Click a category pill → then type a query that matches tabs both inside and outside that category.
- Expected: Only matches within the selected pill's tabs appear. Pills themselves are unaffected by the query (all pills with any tabs in the full library stay visible).

**TC-116 — Clearing search restores prior state (P1)** **[auto]**
- Steps: Apply a category pill → search a query → click the × in the search box or press **Escape**.
- Expected: Search input empties, full (category-filtered) list returns in its original manual order, focus stays in the search input.

**TC-117 — Escape on an empty search field closes the popup (P3)**
- Steps: With the search field empty and focused, press **Escape**.
- Expected: Popup closes (native browser behavior — the extension does not intercept it).

**TC-118 — Enter opens the top result (P2)**
- Steps: Type a query that matches at least one tab → press **Enter**.
- Expected: The top-ranked result opens in a new tab.

**TC-119 — Drag-to-reorder is disabled while searching (P2)** **[auto]**
- Steps: With a query active, attempt to drag a row.
- Expected: No drag occurs; cursor does not indicate draggability. Clearing the query restores drag-to-reorder.

**TC-120 — Search box hidden on an empty library (P3)**
- Steps: Delete all tabs.
- Expected: The search box is hidden (the header keeps the logo, **+** and the gear), and so are the filter pills.

**TC-121 — Rapid typing doesn't show stale results (P2)**
- Steps: Type a multi-character query very quickly (fast enough that renders could overlap).
- Expected: Final displayed results match the final typed query — no flash of an intermediate query's results after typing stops.

**TC-122 — Search is hidden and non-interactive while Settings is open (P1)**
- Preconditions: several saved tabs.
- Steps: Open Settings (gear icon). Try to click into where the search box was.
- Expected: The whole main screen, search included, is hidden while Settings is open and cannot receive focus or input.

**TC-123 — Searching, then visiting Settings and back, doesn't corrupt the list (P1)**
- Preconditions: 5+ saved tabs.
- Steps: Type a query that narrows the list to a subset → clear the query (list returns to full) → open Settings → click **Back**.
- Expected: Every row renders at its normal height with normal spacing — no squished, overlapping, or zero-height rows. (Regression case from v2.x.)

---

## 13. Export & Import

**TC-130 — Export downloads a valid backup file (P1)** **[auto]**
- Preconditions: several saved tabs across 2+ categories.
- Steps: Open Settings → click **Export** (`#export-btn`).
- Expected: A `.json` file downloads (named `tab-sandwich-backup-YYYY-MM-DD.json`, dated today). Opening it shows `version`, `exportedAt`, a `tabs` array matching what's saved, and a `settings` object.

**TC-131 — Import: selecting a valid backup shows a merge/replace confirmation (P1)**
- Preconditions: a backup file from TC-130.
- Steps: Click **Import** (`#import-btn`) → choose the file.
- Expected: The Export/Import buttons are replaced by a confirmation (`#backup-confirm`) stating how many tabs the file contains, with **Merge**, **Replace all**, and **Cancel** options.

**TC-132 — Cancel makes no changes (P2)**
- Steps: From the confirmation in TC-131, click **Cancel**.
- Expected: Returns to the plain Export/Import buttons; no tabs or settings changed.

**TC-133 — Merge adds only genuinely new tabs (P1)** **[auto]**
- Preconditions: a backup file containing some tabs already saved (same URL) and some not.
- Steps: Import the file → click **Merge**.
- Expected: Only the tabs whose URL isn't already saved get added (no duplicates created); existing tabs and their positions are untouched. A toast reports how many tabs were imported, with **Undo**.

**TC-134 — Merge preserves existing settings and adds only missing categories (P1)**
- Preconditions: an imported tab references a category not currently configured.
- Steps: Merge the file.
- Expected: The new category appears in Settings with an assigned color; existing categories, colors, and the outdated toggle/threshold are unchanged.

**TC-135 — Merge restores a category even when zero tabs are re-added (P1)**
- Preconditions: export a backup, then locally remove only a category that currently has no tabs on it (no tab deletion) — e.g. export, then delete an empty "Reading" category in Settings without touching any tab.
- Steps: Import that same backup → **Merge**.
- Expected: "Reading" reappears in Settings with its original color, and the toast reads "Imported 1 category" (not "1 tab") with **Undo**. (Regression case: the merge handler originally gated its storage write on `addedCount === 0` — the tab count alone — so when merging added zero tabs but did restore a category, the write was skipped and the category silently failed to come back. Fixed by tracking added-tabs and added-categories as two separate counts and writing whenever either is nonzero.)

**TC-136 — Merge is undoable (P1)**
- Steps: Merge a file → click **Undo** in the toast before it times out.
- Expected: The list and settings return to exactly their pre-import state (newly imported tabs and any newly added category are gone).

**TC-137 — Merging a file with nothing new changes nothing (P2)**
- Preconditions: a backup file whose every tab URL is already saved *and* whose every category is already configured (a true no-op import — contrast with TC-135, where the tabs are all duplicates but a category still needs restoring).
- Steps: Import it → click **Merge**.
- Expected: A status message explains nothing new was found; no toast/Undo appears (there's nothing to undo).

**TC-138 — Replace overwrites everything (P1)** **[auto]**
- Preconditions: current tabs/settings differ from the backup file being imported.
- Steps: Import a file → click **Replace all**.
- Expected: The saved list and settings (categories, colors, outdated toggle/threshold) become exactly what the file contained (missing settings fields fall back to defaults). A toast confirms the replace, with **Undo**.

**TC-139 — Replace is undoable (P1)** **[auto]**
- Steps: Replace → click **Undo** in the toast before it times out.
- Expected: Tabs and settings return to exactly their pre-replace state.

**TC-140 — Malformed or unrelated JSON is rejected (P1)** **[auto]**
- Preconditions: a `.json` file that isn't a Tab Sandwich backup (e.g. `{"hello": "world"}`, or a tabs array containing one entry with a missing `title`).
- Steps: Click **Import** → choose that file.
- Expected: An error message appears (e.g. "That file doesn't look like a Tab Sandwich backup."); no confirmation UI appears; nothing is changed.

**TC-141 — Re-selecting the same file works (P3)**
- Steps: Import a file → **Cancel** → click **Import** again → choose the same file again.
- Expected: The confirmation appears again (the file input's selection isn't "stuck" from the first pick).

**TC-142 — Export/Import require no additional permission (P1, release gate)** **[auto]**
- Steps: Inspect `manifest.json`.
- Expected: No `downloads` permission is present — export/import use only the File/Blob/anchor-download web APIs. (The exact permission list is asserted once, in TC-103, so this doesn't need to duplicate it and risk drifting out of sync as other permissions are added.)

---

## 14. Category Rename & Reorder

**TC-150 — Rename a category (P1)** **[auto]**
- Preconditions: a category (`aria-label="Rename ..."` icon in Settings → Categories) assigned to at least one tab.
- Steps: Click the rename icon → type a new name → press **Enter** (or click away).
- Expected: The category's name updates everywhere: the Settings list, every category select (edit row, manual-entry form), and every tab previously tagged with the old name now shows the new one. Its assigned color is unchanged.

**TC-151 — Renaming to an existing category name is rejected (P2)** **[auto]**
- Preconditions: two categories, e.g. "Work" and "Reading".
- Steps: Rename "Work" to "Reading".
- Expected: Not renamed. A message appears on that category's own card ("That name is already used by another category."), auto-clears after ~3s; "Work" keeps its original name.

**TC-152 — Renaming to an empty value is rejected (P3)** **[auto]**
- Steps: Click the category's name (rename), clear the input entirely, click away.
- Expected: Reverts to the original name with a "Name can't be empty." message; nothing is written to storage.

**TC-153 — Renaming to "Uncategorized" is rejected (P2)** **[auto]**
- Steps: Click rename on any category, type "Uncategorized", press Enter.
- Expected: Not renamed — the reserved sentinel can't be reused as a real category's name (same message as TC-151).

**TC-154 — Escape cancels a rename without saving (P2)**
- Steps: Click rename, change the text, press **Escape**.
- Expected: Reverts to the original name immediately; no message shown, nothing written to storage.

**TC-155 — Rename respects the 15-character cap (P3)**
- Steps: Click rename, try to type more than 15 characters.
- Expected: Input stops accepting characters at 15, same limit as the add-category field.

**TC-156 — Reorder categories with the up/down controls (P1)** **[auto]**
- Preconditions: 3+ configured categories.
- Steps: Settings → **Categories** → hover the first category → click its down-arrow.
- Expected: It swaps places with the category directly below it. The new order shows immediately in the Settings list and in every category select dropdown (edit row, manual-entry form).

**TC-157 — Reorder controls disable at the ends of the list (P2)** **[auto]**
- Steps: Inspect the first and last category's move buttons.
- Expected: The first category's up-arrow and the last category's down-arrow are both disabled.

**TC-158 — Reordering categories reorders their filter pills (P2)**
- Preconditions: 2+ categories, each with at least one tab.
- Steps: Reorder categories in Settings, then check the filter pill order on the main view.
- Expected: Category pills appear in the same order as Settings' category list. **All** and **Outdated** (when shown) always come first, in that fixed order, and **Uncategorized**'s pill (when shown) always comes last — reordering never moves those three.

**TC-159 — Drag-and-drop also reorders categories (P2)** **[auto]**
- Preconditions: 3+ configured categories.
- Steps: Drag a category by its handle (⋮⋮) to a different position in the list (not just an adjacent swap).
- Expected: It moves to sit exactly where dropped; order updates immediately and is reflected in both category select dropdowns. Available alongside the up/down buttons, not instead of them (drag has no keyboard equivalent — same documented gap as tab-list reorder, see TC-094).

**TC-160 — A category mid-rename is not draggable (P3)**
- Steps: Click a category's name so the rename field shows → attempt to drag that row.
- Expected: No drag occurs. Pressing Escape or committing the rename restores normal drag behavior.

---

## 15. Storage Write Hardening

All cases here simulate a rejected `chrome.storage.local.set()` from the popup's own DevTools console (right-click the popup → Inspect → Console), since there's no in-app way to make a real write fail on demand:
```js
const __origSet = chrome.storage.local.set;
chrome.storage.local.set = () => Promise.reject(new Error("QUOTA_BYTES quota exceeded"));
```
Restore it afterward with `chrome.storage.local.set = __origSet;` before continuing to other cases — leaving it patched breaks everything else in the popup.

**TC-170 — A failed save shows a specific error, not a silent no-op (P1)**
- Preconditions: write patched to reject (see above).
- Steps: Click **Save**.
- Expected: A toast says "Storage is full. Export your tabs, remove some, then try again." and the button never reads "Saved!". Reopen the popup with the patch removed: the tab was not actually saved.

**TC-171 — A failed manual-entry save leaves the form open with its input intact (P2)**
- Preconditions: write patched to reject.
- Steps: Click **+**, fill in a URL, click **Add**.
- Expected: The error appears under the fields; the form stays open with what was typed still in it (nothing is reset, since nothing was saved).

**TC-172 — A failed edit shows an error and reverts the row (P1)**
- Preconditions: write patched to reject; at least one saved tab.
- Steps: Edit a tab's title, click **Save**.
- Expected: An error toast appears and the row closes showing its original, actually-stored title.

**TC-173 — A failed delete shows an error and leaves the row in place (P1)** **[auto]**
- Preconditions: write patched to reject; at least one saved tab.
- Steps: Delete a tab.
- Expected: An error toast appears; the row starts to slide away but comes straight back at full size (no undo toast either — nothing was deleted to undo).

**TC-174 — A failed tab reorder shows an error and leaves the order unchanged (P2)**
- Preconditions: write patched to reject; 2+ saved tabs.
- Steps: Drag one tab to a new position.
- Expected: An error toast appears; reopening the popup (patch removed) shows the original order.

**TC-175 — A failed category action shows an error on that category's own card (P2)**
- Preconditions: write patched to reject; 1+ configured category.
- Steps: Try renaming a category, changing its color, and moving it up/down — one at a time.
- Expected: Each attempt shows an error message floating just under that category (the same spot used for validation errors like "That name is already used"), without moving the rows; nothing changes in the category list once the patch is removed and the popup is reopened.

**TC-176 — A failed category add shows an error (P3)**
- Preconditions: write patched to reject.
- Steps: Add a new category.
- Expected: An error toast appears; the typed name stays in the input (nothing is cleared, since nothing was saved).

**TC-177 — A failed outdated-settings change shows an error and reverts the control (P3)** **[auto]** (TC-199)
- Preconditions: write patched to reject.
- Steps: Settings → **General** → flip the outdated switch, or change the days field.
- Expected: An error toast appears and the control snaps back to its actual stored value (not left showing the un-saved change).

**TC-178 — A failed import shows an error without discarding what was there before (P2)**
- Preconditions: write patched to reject; a valid backup file ready to import.
- Steps: Settings → **Backup** → import the file, choose **Merge** (or **Replace all**).
- Expected: The line under the Backup buttons shows the error in red, not a success message; reopening the popup (patch removed) shows the tabs/settings from before the import attempt, untouched.

**TC-179 — No `unlimitedStorage` permission (P1, release gate)** **[auto]**
- Steps: Inspect `manifest.json`.
- Expected: `permissions` is unchanged by this spec — no `unlimitedStorage` added. (See S06: at this app's data-model size the real 10 MB quota isn't a realistic ceiling, and the permission wouldn't change what the capacity indicator reports anyway, since `chrome.storage.local.QUOTA_BYTES` is a fixed constant regardless of whether it's granted.)

## 16. Stable Ids & Serialized Writes

**TC-180 — Saved tab ids are UUIDs, not derived from time (P3)** **[auto]**
- Steps: Save a tab. In the popup's DevTools console: `(await chrome.storage.local.get("tabSandwich.tabs"))["tabSandwich.tabs"]`.
- Expected: each tab's `id` is a UUID (`xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`), not a plain numeric timestamp string.

**TC-181 — Imported tabs get UUID ids too (P3)** **[auto]**
- Steps: Import a backup file (Merge or Replace), then inspect stored tabs as in TC-180.
- Expected: every imported tab's `id` is also a UUID, not the old `<timestamp>-<index>` scheme.

**TC-182 — Overlapping writes never lose an update (P1)** **[auto]**
- Preconditions: 2+ saved tabs, at least one in different categories. From the popup's DevTools console, slow every write down to widen the race window:
  ```js
  const __origSet = chrome.storage.local.set.bind(chrome.storage.local);
  chrome.storage.local.set = (obj) => new Promise((r) => setTimeout(() => r(__origSet(obj)), 400));
  ```
- Steps: While the delay is patched in, trigger two different mutations back to back, well within that 400ms window — e.g. edit one tab's title (click Save) and immediately delete a different tab; or rename a category and immediately flip the outdated switch.
- Expected: Wait for both actions to finish (~800ms), then reopen the popup with the patch removed (`chrome.storage.local.set = __origSet;`) — both changes are present. Neither mutation's write silently reverted the other's (the historical failure mode: two overlapping read-modify-write cycles, the second one's read taken before the first one's write landed).

---

## 17. Safety Net (v2.3)

**TC-183 — Editing a URL into one that's already saved is refused (P1)** **[auto]**
- Preconditions: two saved tabs, A and B.
- Steps: Edit B → change its URL to A's URL (any variant of it, e.g. without the trailing slash) → **Save**.
- Expected: The row stays in edit mode with everything typed still in place; the URL field is marked and a message reads "Already saved as “A”."; nothing is written. Changing only a title or category still saves, even on a row that already duplicates another (possible in older data).

**TC-184 — Data upgrades are versioned and can't half-apply (P1)** **[auto]**
- Steps: Open the popup on data saved by v2.2.0 or earlier, then inspect `(await chrome.storage.local.get(null))` in the popup's DevTools.
- Expected: `tabSandwich.schemaVersion` is `2` since v3.2 (version 2 adds saved windows); tabs and settings are unchanged, and a backup of the data as it was is kept in `tabSandwich.upgradeBackup`. (A release that changes the stored format runs each upgrade step on a copy, keeps a backup in `tabSandwich.upgradeBackup`, writes data and version together, and restores the original exactly if anything fails — the logic tests force each failure path.)

**TC-185 — Accessibility scan passes on every screen (P1)** **[auto]**
- Steps: `pnpm test:e2e` (the accessibility tests scan the list, manual entry, edit mode, Settings, and the undo toast, in both light and dark mode).
- Expected: No violations. `KNOWN_GAPS` is empty since v3.0: every screen, including each Settings tab, passes every rule, color contrast included, in both themes.

**TC-186 — A failing check blocks the release zip (P1, release gate)**
- Steps: On GitHub, open the run for the release tag under **Actions**.
- Expected: The **Release** job only runs after **checks** passes, and fails if the tag doesn't match `manifest.json`'s version. A tag whose checks fail gets no release zip.

---

## 18. Fresh Look (v3.0)

**TC-187 — The save card shows the page you're on (P1)** **[auto]**
- Steps: Open the popup on a normal web page.
- Expected: The white card under the purple header shows the page's title on its own full-width row with its site underneath; the category picker and **Save** sit on the row below, so the title is never squeezed by them.

**TC-188 — Save straight into a category (P1)** **[auto]**
- Steps: Pick a category in the card's picker → **Save**.
- Expected: The tab is saved with that category; the row shows it under the title. No editing needed afterwards.

**TC-189 — Settings and back keeps your place (P2)** **[auto]**
- Steps: Pick a category pill, type a search, scroll the list → open Settings → **Back**.
- Expected: The same filter, search text and scroll position are still there.

**TC-190 — Roomy rows, at least 8 visible (P2)** **[auto]**
- Preconditions: 25 saved tabs.
- Expected: At least 8 whole rows are visible at once in the 600px-tall popup; each row is a rounded tile with breathing room around its two lines of text.

**TC-191 — Storage warning on the main screen (P2)** **[auto]**
- See TC-082.

**TC-192 — Motion, and reduce-motion (P3)**
- Steps: Open the popup; save a tab; delete one; hover a row. Then turn on the system's reduce-motion setting and repeat.
- Expected: Rows rise in quickly on open, a saved row drops in and flashes, a deleted row slides away, Save presses down and pops "✓ Saved!" while the logo hops (TC-228), "Already saved" gives a small shake, hovered rows lift slightly. With reduce motion on, all of it is instant.

**TC-193 — Dark mode follows the system (P1)** **[auto]**
- Steps: Switch the computer between light and dark mode with the popup open.
- Expected: Both screens switch theme immediately, without reopening, and stay readable in both (the accessibility scan checks contrast in both themes).

**TC-194 — Light / Dark / System in Settings (P1)** **[auto]**
- Steps: Settings → **General** → **Appearance** → choose **Dark**, then reopen the popup; then choose **System**.
- Expected: Dark applies at once and is still on after reopening, whatever the computer's setting. System goes back to following the computer.

**TC-195 — The color strip closes with Escape (P3)** **[auto]**
- Steps: Settings → **Categories** → open a category's color dot → press **Escape**.
- Expected: The strip closes and focus returns to that color dot.

**TC-196 — About (P3)** **[auto]**
- Steps: Settings → **About**.
- Expected: The app icon, "Version x.y.z" matching the manifest, the local-only promise, and working **Privacy policy** and **Source code** links (they open in a new tab).

**TC-197 — Settings tabs work from the keyboard (P2)** **[auto]**
- Steps: Focus the **General** tab → press the right arrow.
- Expected: **Categories** becomes the selected tab and shows its contents; Left, Home and End move the same way.

**TC-198 — The popup never shrinks back and forth (P2)** **[auto]**
- Steps: With one saved tab, and again with a dozen: open Settings, click through all four tabs, then **Back**.
- Expected: The popup window may grow when a screen needs more room, but never shrinks while it's open — no resizing back and forth between screens or tabs.

**TC-199 — A settings change that fails to save is undone on screen (P2)** **[auto]**
- Preconditions: writes patched to fail (see section 15).
- Steps: Settings → **General** → change the day count, choose **Dark**, flip the outdated switch.
- Expected: Each shows "Couldn't save your changes. Try again." in a toast, and each control goes back to what's actually stored (the day count, the theme, the switch).

**TC-200 — Every screen matches its approved screenshot (P1, release gate)** **[auto]**
- Steps: `pnpm visual` (or CI's `visual` job).
- Expected: All screens match. A failure's report shows what changed; if the change is intended, approve it with `pnpm visual:update` and show before/after in the pull request.

## 19. Effortless Everyday (v3.1)

**TC-201 — The new icon looks right everywhere (P2)**
- Steps: Load the build; look at the toolbar icon in Chrome's light and dark themes (pin it if needed), on a normal and a high-resolution screen; open `chrome://extensions`; open the popup and Settings › **About**.
- Expected: The icon is the purple tile with a white browser-tab top slice, a yellow filling and a white bottom slice, crisp (no blur or smeared edges) at toolbar size in both themes, and as big as other extensions' icons in the toolbar and the extensions (puzzle-piece) menu, not shrunk inside a margin. `chrome://extensions` shows the same icon, filling its square. The popup header shows the same shape without its tile, white and yellow, and **About** shows the full icon. The approved screenshots cover the header and About (TC-200); the toolbar and `chrome://extensions` need a person.

**TC-202 — Sort the list (P1)** **[auto]**
- Steps: Click the sort button at the right end of the filter row → pick **Newest first**, then **Oldest first**, **Title (A–Z)**, **Site (A–Z)**.
- Expected: The menu floats over the list (nothing moves when it opens). Each choice reorders the list at once; the button turns purple and names the sort ("Newest"). Titles sort ignoring case, with numbers in number order ("Chapter 9" before "Chapter 10"); sites sort as shown under the title, without "www.".

**TC-203 — The sort is remembered (P2)** **[auto]**
- Steps: Pick **Oldest first** → close and reopen the popup.
- Expected: Still sorted oldest first, and the button still says so.

**TC-204 — Back to your order restores it exactly (P1)** **[auto]**
- Steps: Arrange tabs by dragging → pick **Title (A–Z)** → pick **Your order**.
- Expected: Your arrangement comes back exactly; sorting never rewrote it. With your own order on, the button shows only its icon.

**TC-205 — Dragging only in your own order (P2)** **[auto]**
- Steps: Pick any sort other than **Your order** → try to drag a row.
- Expected: Rows can't be dragged (no handle on hover) until you switch back to **Your order** — the other orders are views, so a drag there would mean nothing.

**TC-206 — The sort menu from the keyboard (P2)** **[auto]**
- Steps: Tab to the sort button → Enter → arrow keys → Enter. Open it again → Escape.
- Expected: The menu opens on the current choice; arrows move, Enter picks and closes it, Escape closes it without changing anything. Focus returns to the sort button either way.

**TC-207 — Sorting inside a filter (P3)** **[auto]**
- Steps: Pick a category pill → change the sort.
- Expected: The filtered list is sorted the same way.

**TC-208 — Clicking outside closes the sort menu (P3)** **[auto]**
- Steps: Open the sort menu → click anywhere else.
- Expected: The menu closes without changing the sort.

**TC-209 — A welcoming first run (P1)** **[auto]**
- Preconditions: Nothing saved (a fresh install, or every tab deleted).
- Expected: Under the save card, the app icon, "Nothing saved yet", and three tips: save the page you're on (pick a category above, then Save); open Tab Sandwich from anywhere with your keyboard shortcut, shown as keys (or **Set one** when no shortcut is set, which opens Chrome's shortcut page); make the categories yours with **Edit categories**, which opens Settings straight on **Categories**.

**TC-210 — Widen a search that a filter narrowed (P2)** **[auto]**
- Steps: Pick a category pill → search for something only in another category.
- Expected: "No saved tabs match “…”" and "Only tabs in Work were searched." with a **Search all tabs** button. Clicking it switches the filter to All, keeps the search, and shows the match.

**TC-211 — No "What's new" on a fresh install (P2)** **[auto]**
- Steps: Install fresh, open the popup, reopen it.
- Expected: No "What's new" note either time: there's nothing new to someone who just arrived.

**TC-212 — "What's new" after an update (P1)** **[auto]**
- Preconditions: Updated from 3.0 (or any earlier version) with tabs saved.
- Steps: Open the popup; reopen it; click the note's ×; reopen it.
- Expected: A "New in 3.1" note sits at the top of the list with three short lines about the release. It stays on every open until dismissed; × removes it at once (focus moves to the search box) and it doesn't come back. A later patch release (3.1.x) doesn't bring it back either.

**TC-213 — "What's new" when updating from before 3.1 (P2)** **[auto]**
- Expected: Versions before 3.1 kept no record of notes seen; updating from one still shows the note.

**TC-214 — Restoring a backup doesn't bring back a dismissed note (P3)** **[auto]**
- Steps: Dismiss the note → import an older backup with **Replace all**.
- Expected: The note stays dismissed: what you've seen is kept apart from the settings a backup carries.

**TC-215 — The save card knows a page is already saved (P1)** **[auto]**
- Preconditions: The page you're on was saved 20 days ago, in Reading.
- Steps: Open the popup.
- Expected: Under the page title: "✓ Saved 20 days ago · example.com" (today / yesterday read naturally). The picker shows Reading, labelled "Saved in category", and **Show** and **Update** take the place of Save.

**TC-216 — Show finds the saved copy (P2)** **[auto]**
- Steps: Pick a category pill that hides the saved copy → **Show**.
- Expected: The filter switches to All (only if needed; a search is cleared too), and the saved row scrolls into view and flashes. Nothing is written.

**TC-217 — Update brings the saved copy up to date (P1)** **[auto]**
- Steps: Optionally pick another category → **Update** → then **Undo** in the toast.
- Expected: The button pops "✓ Updated!" without moving anything else on the card. The saved copy takes the page's current title and exact address, the picked category (unchanged if you didn't touch the picker), and today's date, so the moon badge goes away; it keeps its place in your own order. The card now says "Saved today". **Undo** puts the old title, address, category and date back exactly.

**TC-218 — Saving settles into the saved look (P2)** **[auto]**
- See TC-010.

**TC-219 — Open an already-saved link from the add-a-link form (P2)** **[auto]**
- Steps: **+** → type a link that's already saved → **Add** → **Open**.
- Expected: The saved link opens in a new tab. Typing in the URL field again clears the message and its **Open**.

**TC-220 — Arrow keys move through the list (P1)** **[auto]**
- Steps: In the search box press ↓; then ↓, ↑, Home, End. Then Tab.
- Expected: ↓ from search lands on the first row; arrows, Home and End move between rows (stopping at the ends), with a purple outline on the current row and its Edit and Delete showing. The list is one Tab stop: Tab goes to the current row's Edit, its Delete, then on past the list.

**TC-221 — Enter opens, E edits (P1)** **[auto]**
- Steps: On a row press Enter. Then E, Escape. Then E, change the title, Enter.
- Expected: Enter opens the tab in a new browser tab. E opens the edit form with the title selected; Escape cancels it and focus returns to the row; saving with Enter also returns focus to the row.

**TC-222 — Delete from the keyboard, and undo (P1)** **[auto]**
- Steps: On a row press Delete (on a Mac, the delete key, which is Backspace). Then Ctrl+Z (⌘Z on a Mac).
- Expected: The row is deleted with the usual Undo toast, and focus moves to the next row (or the one before, at the end of the list). Ctrl+Z / ⌘Z undoes it while Undo is showing.

**TC-223 — Move a tab with Alt+arrows (P1)** **[auto]**
- Steps: On a row press Alt+↓ (⌥↓), then Alt+↑. Try it under a category filter, and with a sort on.
- Expected: The tab moves one place and keeps focus; screen readers hear "Moved “…” to position 2 of 9". Under a filter it moves past the next tab you can see. With a sort on (or while searching) nothing moves and screen readers hear why.

**TC-224 — / and Escape (P2)** **[auto]**
- Steps: Anywhere on the main screen (not in a field) press /. On a row press Escape.
- Expected: / puts focus in the search box; Escape on a row goes back to the search box. (Escape in an empty search box still closes the popup, as before.)

**TC-225 — Keys typed in a field stay in the field (P1)** **[auto]**
- Steps: In a row's edit form, type "e", "/" and press Backspace.
- Expected: They edit the text; nothing is deleted, edited or searched.

**TC-226 — Everything without a mouse (P1, release gate)** **[auto]**
- Steps: Using only the keyboard: save the page into a category, find it with search, open it, edit it, delete it, undo, and move it.
- Expected: Every step works. This is v3.1's "done when".

**TC-227 — The keys are listed in Settings (P3)**
- Steps: Settings → **General**, under **Keyboard shortcut**.
- Expected: A short list of the list's keys (including → and ← for saved windows, and Space while selecting), named as this computer's keyboard labels them (⌘, ⌥ and ⌫ on a Mac; Ctrl, Alt and Delete elsewhere).

## 20. Save Everything (v3.2)

**TC-228 — The logo hops on a new save (P3)** **[auto]**
- Steps: Save the page you're on. Then add a link by hand. Then try adding a link that's already saved, and press **Update** on a saved page. Repeat the first step with the system's reduce-motion setting on.
- Expected: The logo left of the search field hops once — up, a tilt each way, and down — for each new save (about half a second). An already-saved link and Update don't make it hop. With reduce motion on, it stays still.

**TC-229 — Save all tabs in a window (P1)** **[auto]**
- Preconditions: Several web pages open in one window, one of them already saved, plus a browser page (e.g. `chrome://settings`).
- Steps: Open the popup on a page that isn't saved, pick a category, and click **Save all N tabs in this window** under Save. The first time, Chrome asks to let Tab Sandwich read your open tabs: allow it.
- Expected: Every unsaved web page in the window is saved, in the window's order, in the picked category, and the logo hops. Two or more of them land at the top as one closed saved window with a random sandwich name (e.g. "Toasted Rye"), "N tabs" and today's date, which flashes; open it to see them (TC-234). The line says "✓ Saved N tabs · M skipped"; hovering "M skipped" (or a screen reader) says why: how many were already saved and how many were browser pages. Chrome asked only this once. Started from a page that's already saved (the picker shows its category), the window's pages go to Uncategorized instead.

**TC-230 — Close the saved tabs (P1)** **[auto]**
- Steps: After TC-229, click **Close N tabs**.
- Expected: Nothing closed before the click. Then every saved web page in the window closes, except the tab you're on; browser pages and anything not saved stay open. The line says "✓ Closed N tabs".

**TC-231 — Saying no to the permission (P1, release gate)** **[auto]**
- Steps: On a fresh install, click **Save all N tabs in this window** and choose **Deny** in Chrome's prompt.
- Expected: Nothing is saved; the line says "Nothing saved. Saving a window needs your OK to see its tabs." with **Try again**. Save, search, editing and everything else work as before.

**TC-232 — Counting new tabs once allowed (P2)** **[auto]**
- Steps: After allowing once, close and reopen the popup; open a page you haven't saved.
- Expected: No second prompt. The line counts only what's new ("Save 1 new tab from this window"), and disappears when every page in the window is already saved. Without the permission it counts every open tab ("Save all 7 tabs in this window").

**TC-233 — The real permission prompt (P1, release gate)**
- Steps: In a normal Chrome with the release build, on a fresh install, open the popup from the toolbar in a window with several tabs and click **Save all N tabs in this window**. Allow Chrome's prompt. Repeat on another profile choosing **Deny**. Afterwards, in `chrome://extensions` › Tab Sandwich › Details, remove the "Read your browsing history" permission and reopen the popup.
- Expected: The prompt explains what's asked ("Read your browsing history"). Allowing saves the window, either straight away or, if Chrome closed the popup while asking, on the next click after reopening it, with no second prompt. Denying saves nothing and the popup keeps working. With the permission removed, the line counts every open tab again and asks again on click.

**TC-234 — A saved window opens and closes (P1)** **[auto]**
- Preconditions: A saved window (from TC-229) among loose tabs.
- Steps: Click the window's row. Close and reopen the popup. Click it again.
- Expected: Closed, it's one row drawn as a small stack: its name, a few site icons, "N tabs" and the date it was saved. Open, its tabs show underneath, indented along a rail, working like any other row. It stays open or closed as you left it.

**TC-235 — Filters and search look inside windows (P1)** **[auto]**
- Steps: With a closed saved window, search for one of its tabs; then pick a category filter; then **All**.
- Expected: Searching or filtering shows every matching tab as its own row, including ones in a closed window. **All** with no search shows the window again.

**TC-236 — Rename a saved window (P2)** **[auto]**
- Steps: ⋯ → **Rename**; type a name and press Enter. Again, but press Escape.
- Expected: The name changes in place and is kept; Escape (or clicking away) leaves it as it was. A blank name is not accepted.

**TC-237 — Break a window apart (P2)** **[auto]**
- Steps: ⋯ → **Break apart**; then **Undo** in the toast.
- Expected: The window goes, its tabs stay saved, in place, as ordinary rows. Undo brings the window back with the same tabs.

**TC-238 — Remove a window and its tabs from the list (P1)** **[auto]**
- Steps: ⋯ → **Remove from list**; then **Undo**.
- Expected: The toast says "Removed N tabs" and they're gone. Undo puts the window and every tab back where they were.

**TC-239 — Open a window's tabs (P1)** **[auto]**
- Steps: ⋯ → **Open all in a new window**. Then ⋯ → **Open all and remove from list**.
- Expected: Each opens the window's tabs in one new browser window. The first keeps them saved; the second removes them (and the window) from the list, with Undo while the popup is open.

**TC-240 — The ⋯ menu from the keyboard (P2)** **[auto]**
- Steps: Tab to a window's ⋯ button and press Enter; use the arrow keys, Home and End; press Escape.
- Expected: Focus lands on the first item and moves with the keys (wrapping around); Escape closes the menu and returns focus to ⋯.

**TC-241 — The list's keys on saved windows (P1)** **[auto]**
- Steps: Arrow onto a window's row; press →, → again, ←, ← again; Enter twice; ↓; then Delete on the window's row and Ctrl+Z (⌘Z).
- Expected: → opens the window, then moves onto its first tab; ← from a tab goes back to the window's row, then closes it; Enter opens and closes it; ↓ past a closed window skips its tabs. Delete on the window's row deletes the window with its tabs, focus moves on, and Ctrl+Z brings it all back.

**TC-242 — Moving tabs with Alt+arrows around windows (P2)** **[auto]**
- Steps: In your own order, with a window open: Alt+↓ on a loose tab just above it; Alt+↑ back. Then Alt+↓ on a tab inside the window, to the bottom of the window, and once more; then **Undo**.
- Expected: A loose tab steps past the whole window in one move. A tab inside the window moves within it ("position 2 of 3" counts within the window); past the window's last (or first) tab it steps out of the window, staying where it is, with "Moved “…” out of …" read out, a toast with Undo, and focus still on it. Undo puts it back in the window.

**TC-243 — Show finds a tab inside a closed window (P2)** **[auto]**
- Steps: Open the popup on a page that's saved inside a closed saved window; click **Show**.
- Expected: The window opens and the tab flashes. Undoing a delete of a tab inside a closed window opens the window the same way.

**TC-244 — A window down to one tab (P3)** **[auto]**
- Steps: Delete all but one tab of a saved window.
- Expected: The last tab shows as an ordinary row; no window row with a single tab.

**TC-245 — Saved windows in real Chrome (P1, release gate)**
- Steps: In a normal Chrome with the release build: save a window of 5+ tabs; open the popup from the toolbar; ⋯ → **Open all in a new window**; reopen the popup; ⋯ → **Open all and remove from list**; drag tabs within the open window, out of it, and into it.
- Expected: Opening a new window may close the popup (it takes focus); either way the tabs open in one new window and, for the second action, are gone from the list when you reopen the popup. Dragging feels like the rest of the list: a tab dropped on a loose tab leaves its window, one dropped on a window's tab joins it, each with a toast and Undo. Export a backup, delete the window, import it with **Replace all**: the window comes back with its name and tabs.

**TC-246 — A window's menu always fits (P1)** **[auto]**
- Preconditions: Nothing saved but one saved window (so the popup is short).
- Steps: Open the window's ⋯ menu. Then, with many tabs saved, open a window's ⋯ menu and scroll the list.
- Expected: The whole menu shows, opening upward over the filter row when there's no room below, on top of everything; it works from there. Scrolling the list closes it rather than leaving it floating away from its row.

**TC-247 — The sort menu always fits (P2)** **[auto]**
- Preconditions: One saved tab (so the popup is short).
- Steps: Open the sort menu.
- Expected: All five choices show (opening upward when there's no room below) and work. (Before 3.2 the bottom of the menu could be cut off here.)

**TC-248 — Drag into and out of a window (P1)** **[auto]**
- Steps: With a window open, drag one of its tabs onto a loose tab; **Undo**. Drag a loose tab onto one of the window's tabs. Drag a tab onto a window's own row.
- Expected: A line in the gap shows where the tab will land: above the row on its upper half (that row and the rest move down), below it on its lower half. Out: the tab leaves the window and lands at the line ("Moved out of …"). In: it joins the window at the line ("Moved into …"). On the window's own row: its upper half puts the tab just above the window, outside it; its lower half just below a closed window, or into an open one as its first tab. Undo puts the tab back exactly as it was.

**TC-249 — Selecting starts and stops without moving anything (P1)** **[auto]**
- Steps: Click the ☑ button at the end of the filter row. Pick a row by clicking it, another by clicking its checkbox. Click ✕. Start again and press Escape.
- Expected: The popup doesn't change size or jump: the bar ("N selected · Select all · Move to… · 🗑 · ✕") takes the filter row's place at the same height, and focus moves to ✕. Rows become checkboxes; clicking anywhere on a row (checkbox included) picks it without opening the tab; rows' own edit and delete step aside, and dragging is off. Move to… and 🗑 wait until something is picked. ✕ or Escape stops (Escape doesn't close the popup) and forgets the picks.

**TC-250 — Pick a range (P2)** **[auto]**
- Steps: Pick one row, then Shift-click another further down. Then Shift-click a picked row in between.
- Expected: Everything between is picked; the second Shift-click unpicks from the last row picked back to the clicked one.

**TC-251 — Pick a whole saved window (P2)** **[auto]**
- Steps: While selecting, click a closed window's row; open it with its chevron; unpick one of its tabs; click the window's row twice.
- Expected: The window's row picks all its tabs (its checkbox ticked), shows a dash when only some are picked, and picks them all again, then none. The chevron opens and closes the window while selecting.

**TC-252 — Select all, and filters (P2)** **[auto]**
- Steps: While selecting, click **Select all**. Stop; pick a category filter; start again and **Select all**.
- Expected: Every tab shown is picked, including tabs in closed windows; under a filter, only that filter's tabs. Changing the filter or search forgets earlier picks, so nothing hidden is moved or deleted.

**TC-253 — Move picked tabs to a category (P1)** **[auto]**
- Steps: Pick a few tabs (and a window); choose a category in **Move to…**; then **Undo**.
- Expected: All of them move in one step ("Moved N tabs to …") and selecting ends. Undo puts each back in the category it had.

**TC-254 — Delete picked tabs (P1)** **[auto]**
- Steps: Pick a few tabs (and a window); click 🗑; then **Undo**.
- Expected: All of them are deleted in one step ("Deleted N tabs") and selecting ends. Undo puts every one back where it was, the window included.

**TC-255 — Selecting from the keyboard (P1)** **[auto]**
- Steps: Start selecting; Tab into the list; Space; ↓; Space; press E and Delete; → on a window.
- Expected: Space picks and unpicks the row (screen readers hear a checkbox, checked or not); arrows move as usual; E and Delete do nothing while selecting; → and ← still open and close windows.

**TC-256 — Updating an existing install keeps everything (P1, release gate)**
- Preconditions: The previous release (3.1.0's zip from GitHub Releases) loaded unpacked, with a few saved tabs in several categories, a custom category and color, a theme and a sort chosen, and the "What's new" note dismissed.
- Steps: Replace that folder's contents with this release's `dist/` (or the release zip unpacked) and press **Reload** on the extension in `chrome://extensions`. Open the popup.
- Expected: Every tab, category, color, theme and sort is as it was; "New in 3.2" shows once. Export a backup, import it with **Replace all**, and Undo: all of it works. (Behind the scenes the stored data was upgraded to version 2, with a backup copy; the robot tests cover the upgrade itself (TC-184), but not an existing install updating in place.)

