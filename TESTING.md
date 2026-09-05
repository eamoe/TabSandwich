# Manual Test Cases

This document is the manual regression suite for Tab Sandwich. Run it before any release. Each case is written to be automatable later (e.g. with Puppeteer/Playwright driving a loaded extension) — element ids are noted in parentheses so selectors are easy to derive.

## Setup

```console
npm install
npm run build
```

1. Open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, select the repo root.
2. After any code change: `npm run build`, then click the reload icon on the extension's card.
3. Unless a case says otherwise, start from a clean state: open the popup's DevTools (right-click → Inspect) and run `chrome.storage.local.clear()`, then reopen the popup.

## Format

Each case: **ID**, **Preconditions**, **Steps**, **Expected Result**. Priority: **P1** (blocks release), **P2** (should pass), **P3** (nice-to-have / cosmetic).

---

## 1. Saving Tabs

**TC-001 — Save the active tab (P1)**
- Preconditions: popup open on a normal `http(s)` page; list empty.
- Steps: Click **Save Tab** (`#save-btn`).
- Expected: Entry appears at the top of the list (`#tab-list`) with the page's title, URL, and favicon. A "Saved!" acknowledgment appears under the button (`#save-status`) and fades after ~2.5s.

**TC-002 — Save via manual entry, URL only (P1)**
- Preconditions: popup open; list empty.
- Steps: Click **+ Add link manually** (`#manual-entry-toggle`) → enter `example.com` in URL (`#manual-url`) → click **Add** (`.manual-entry-submit`).
- Expected: Entry appears with title = `example.com` (hostname fallback), URL normalized to `https://example.com/`. Manual-entry section closes automatically.

**TC-003 — Save via manual entry, all fields (P2)**
- Steps: Open manual entry → URL `https://example.org`, Title `My Site`, Category = any existing category → **Add**.
- Expected: Entry appears with title `My Site` and the selected category.

**TC-004 — Cancel manual entry (P2)**
- Steps: Open manual entry → type something in URL → click **Cancel** (`#manual-entry-cancel`).
- Expected: Section closes, no entry created, fields cleared (verify by reopening — URL field is empty).

**TC-005 — Reject unsupported active-tab page (P1)**
- Steps: Open the popup on an internal page (e.g. `chrome://extensions`) → click **Save Tab**.
- Expected: "This page can't be saved." acknowledgment; no entry created.

**TC-006 — Reject invalid manual URL — gibberish text (P1)**
- Steps: Open manual entry → enter `weuirytuiwerytweury` (no scheme, no dot) → **Add**.
- Expected: Rejected ("Enter a valid URL."); no entry created; section stays open with the text still in the field.

**TC-007 — Accept manual URL with explicit scheme even if unusual (P3)**
- Steps: Enter `https://localhost` → **Add**.
- Expected: Accepted (explicit scheme is trusted regardless of domain shape).

**TC-008 — Reject empty manual URL (P2)**
- Steps: Open manual entry, leave URL blank → try to submit.
- Expected: Browser's native `required` validation blocks submission (no entry created).

---

## 2. Duplicate Detection

**TC-010 — Duplicate via Save Tab (P1)**
- Preconditions: one tab already saved.
- Steps: Revisit that same URL as the active tab → click **Save Tab**.
- Expected: No second entry created. "Already saved" acknowledgment appears at the button. The existing entry is highlighted/flashed in the list.

**TC-011 — Duplicate acknowledgment visible when entry is off-screen (P1)**
- Preconditions: enough tabs saved that the list scrolls; the duplicate target is scrolled out of view.
- Steps: Save a duplicate of an off-screen entry.
- Expected: The acknowledgment at the Save button is visible without scrolling. The list auto-scrolls to reveal and highlight the existing entry.

**TC-012 — Duplicate via manual entry (P2)**
- Steps: Manually add a URL that's already saved.
- Expected: Same "Already saved" behavior as TC-010.

---

## 3. Data Migration (legacy upgrade)

**TC-020 — Migrate existing localStorage data on first run (P1)**
- Preconditions: `chrome.storage.local` cleared (simulate pre-migration).
- Steps: In the popup's console: `localStorage.setItem('links', JSON.stringify([{url:'https://example.com', description:'Example', checked:false}]))` → close and reopen the popup.
- Expected: "Example" appears automatically in the list, no user action needed.

**TC-021 — Migration doesn't repeat or duplicate (P1)**
- Steps: After TC-020, close and reopen the popup again.
- Expected: Still exactly one entry for that URL.

**TC-022 — Fresh install with no legacy data (P2)**
- Steps: Clear both `chrome.storage.local` and `localStorage.removeItem('links')` → reopen popup.
- Expected: Normal empty state, no console errors.

**TC-023 — Corrupt legacy data doesn't crash migration (P3)**
- Steps: `localStorage.setItem('links', 'not valid json')`, clear `chrome.storage.local`, reopen popup.
- Expected: No crash; treated as nothing to migrate (empty list).

---

## 4. Categories

**TC-030 — Assign a category via Edit (P1)**
- Preconditions: one saved tab.
- Steps: Click the row's edit icon (`aria-label="Edit ..."`) → change category select → **Save**.
- Expected: Row's background tint and category (visible in Edit mode, and via the screen-reader-only label) update to match.

**TC-031 — Filter by category (P1)**
- Preconditions: tabs across 2+ categories.
- Steps: Click a category pill in `#pills-container`.
- Expected: List narrows to only that category. Click **All** → full list restored.

**TC-032 — Add a new category (P1)**
- Steps: Settings → Categories → type a name (≤15 chars) → **Add**.
- Expected: New category appears at the top of the list, immediately selectable in Edit mode and the manual-entry form.

**TC-033 — Category name length capped at 15 characters (P2)**
- Steps: Try to type a 20-character name into the new-category input.
- Expected: Input stops accepting characters at 15 (`maxlength`); the live counter (`#new-category-counter`) reads "15/15".

**TC-034 — Removing an unused category (P1)**
- Preconditions: a category with no tabs assigned to it.
- Steps: Settings → click **×** next to that category.
- Expected: Category removed from the list, from all category selects, and from filter pills.

**TC-035 — Removing an in-use category is blocked (P1)**
- Preconditions: a category assigned to at least one tab.
- Steps: Settings → click **×** next to that category.
- Expected: Not removed. A message appears on that category's own card ("In use — reassign its tabs first."), auto-clears after ~3s. The **×** is visually muted but remains clickable.

**TC-036 — "Uncategorized" cannot be removed or renamed (P1)**
- Steps: Inspect the Settings category list.
- Expected: "Uncategorized" never appears there at all (protected sentinel, not manageable).

**TC-037 — Assign a category color (P2)**
- Steps: Settings → click a different color swatch under any category.
- Expected: That category's row tint and pill color update immediately to match; the previously-selected swatch loses its selection ring, the new one gains it.

**TC-038 — Uncategorized tabs stay visually neutral (P2)**
- Steps: Save a tab without assigning a category.
- Expected: Row background is plain white (no gray/colored tint); "Uncategorized" pill (if shown) is also neutral, not colored.

**TC-039 — Category-in-use status stays fresh across navigation (P2)**
- Steps: In Settings, attempt to remove an in-use category (see the blocked message) → click **Back** → reassign that tab's category away from it elsewhere → reopen Settings.
- Expected: The category now shows as removable (no stale "in use" state), and the old message is gone.

---

## 5. Editing & Deleting

**TC-040 — Edit title/URL/category (P1)**
- Steps: Click edit icon → change title, URL, and category → **Save**.
- Expected: Changes persist after closing and reopening the popup.

**TC-041 — Edit rejects invalid URL (P1)**
- Steps: Enter edit mode → clear URL, type `notaurl` → **Save**.
- Expected: Save blocked, field shows an error state, edit mode stays open.

**TC-042 — Cancel edit discards changes (P2)**
- Steps: Enter edit mode → change fields → **Cancel**.
- Expected: Original values remain; nothing persisted.

**TC-043 — Delete a tab (P1)**
- Steps: Click the delete icon on a row.
- Expected: Removed immediately from the list and from storage (still gone after reopening the popup).

---

## 6. Drag-and-Drop Reorder

**TC-050 — Reorder persists (P1)**
- Preconditions: 3+ saved tabs.
- Steps: Drag one row to a new position.
- Expected: Order updates immediately and is preserved after closing/reopening the popup.

**TC-051 — Reorder respects the underlying full list, not just the filtered view (P2)**
- Preconditions: tabs across 2+ categories, filtered to one category.
- Steps: Drag-reorder within the filtered view → switch to **All**.
- Expected: The dragged tab's position relative to same-category tabs reflects the reorder; non-visible tabs from other categories aren't disturbed.

**TC-052 — A row in edit mode is not draggable (P3)**
- Steps: Enter edit mode on a row → attempt to drag it.
- Expected: No drag occurs.

---

## 7. Outdated Tracking

**TC-060 — Outdated badge appears past threshold (P1)**
- Preconditions: Settings → outdated threshold set to 1 day; a tab's `savedAt` backdated via console (`chrome.storage.local.get('tabSandwich.tabs', r => {...})`) to 2+ days ago.
- Steps: Reopen popup.
- Expected: That row shows an age badge (e.g. "2d").

**TC-061 — Outdated quick filter (P1)**
- Preconditions: at least one outdated tab exists.
- Steps: Click the "Outdated (N)" pill (appears right after "All").
- Expected: List narrows to only outdated tabs, regardless of position in the full list.

**TC-062 — Disabling outdated tracking hides badges and filter (P1)**
- Steps: Settings → toggle "Outdated tabs" off.
- Expected: All age badges disappear; the "Outdated" pill is no longer offered.

**TC-063 — Default threshold is 7 days on fresh install (P2)**
- Steps: Clear storage, reopen popup, check Settings.
- Expected: Toggle is on, day input reads 7.

**TC-064 — Changing the day threshold updates badges live (P2)**
- Steps: Change the day-threshold input to a smaller/larger value.
- Expected: Badges and the Outdated pill count update on the next render.

---

## 8. Settings

**TC-070 — Keyboard shortcut display (P2)**
- Steps: Open Settings.
- Expected: A badge shows the actual assigned shortcut (e.g. "Alt+S"), not a placeholder.

**TC-071 — Shortcut customize link (P2)**
- Steps: Click **Customize** next to the shortcut badge.
- Expected: Opens `chrome://extensions/shortcuts` in a new tab.

**TC-072 — Trigger popup via keyboard shortcut (P2)**
- Steps: Press the assigned shortcut with focus on a normal web page.
- Expected: Popup opens.

**TC-073 — Settings view toggle + focus management (P1)**
- Steps: Click the gear icon → note focus location → click **Back**.
- Expected: Gear click shows Settings and hides the main list/pills/action row; focus lands on **Back**. Back click reverses this and returns focus to the gear icon.

---

## 9. Storage Capacity Indicator

**TC-080 — Capacity estimate reflects real usage (P2)**
- Preconditions: several tabs saved.
- Steps: Read the hero's storage line.
- Expected: Shows "N% of storage used" against the real `chrome.storage.local` quota (below 1%, shows "<1%" rather than rounding to "0%").

**TC-081 — No capacity text on empty list (P3)**
- Steps: Clear all tabs.
- Expected: Storage-usage text is blank (not "0% of storage used" or similar).

---

## 10. Accessibility (keyboard-only, no mouse)

**TC-090 — Full keyboard pass: save flow (P1)**
- Steps: Tab to and activate **Save Tab**; Tab to and open **+ Add link manually**, fill fields via keyboard, submit.
- Expected: All operable via Tab/Shift+Tab/Enter/Space; no dead ends.

**TC-091 — Full keyboard pass: filter/edit/delete (P1)**
- Steps: Tab to a category pill and the Outdated pill and activate each; Tab to a row's edit and delete icons and activate each.
- Expected: All operable via keyboard; edit mode's Save/Cancel reachable and usable.

**TC-092 — Full keyboard pass: Settings (P1)**
- Steps: Tab into Settings; operate the outdated toggle and day input, add and remove a category, reach the shortcut Customize button, tab to a color swatch and select it with Enter/Space, return via Back.
- Expected: All operable via keyboard with visible focus indicators throughout.

**TC-093 — No control relies on color alone (P2)**
- Steps: Using a screen reader (or the browser's accessibility inspector), inspect a saved-tab row.
- Expected: Category is exposed via an accessible name/label (screen-reader-only text), not conveyed only by the row's background tint.

**TC-094 — Drag-reorder has no keyboard equivalent (documented exemption) (P3)**
- Expected: Confirm this is a known, accepted gap (FR-019 exemption) — not something to fail the suite over.

**TC-095 — Collapsed manual-entry fields are unreachable on a fresh popup open (P1)**
- Preconditions: a freshly opened popup where **+ Add link manually** has never been clicked this session.
- Steps: Tab to **+ Add link manually**, then press **Tab** once more.
- Expected: Focus moves to the next visible control (e.g. the search input), not into the collapsed form's URL/Title/Category fields. (Regression case: `inert` on the collapsed form was only ever applied reactively via toggle/cancel/submit, never on initial load, so its fields were tabbable until the form had been opened and closed at least once.)

---

## 11. Edge Cases

**TC-100 — Empty state (P2)**
- Steps: Delete all tabs.
- Expected: "No saved tabs yet." message shown instead of a blank list.

**TC-101 — Rapid duplicate save attempts (P3)**
- Steps: Click **Save Tab** twice in quick succession on the same page.
- Expected: Only one entry ever exists for that URL.

**TC-102 — Favicon load failure falls back to placeholder (P3)**
- Preconditions: a saved tab whose `faviconUrl` points to a broken/unreachable image.
- Expected: Placeholder icon shown instead of a broken image.

**TC-103 — Manifest permissions remain minimal (P1, release gate)**
- Steps: Inspect `manifest.json`.
- Expected: `permissions` is exactly `["activeTab", "storage"]`; no unused permission has crept back in.

**TC-104 — Build output is not committed (P2, release gate)**
- Steps: `git status` after a fresh `npm run build`.
- Expected: `popup/js/` does not appear as new/modified tracked content (it's gitignored and untracked).

---

## 12. Search

**TC-110 — Basic substring match (P1)**
- Preconditions: a saved tab titled "GitHub" (`github.com`) among several others.
- Steps: Type `git` into search (`#search-input`).
- Expected: Only tabs matching on title/domain/path remain; matched characters in the title are visually highlighted.

**TC-111 — Non-contiguous (fuzzy) match (P1)**
- Preconditions: a saved tab titled "GitHub".
- Steps: Type `gthb`.
- Expected: The GitHub tab still matches, with each matched letter highlighted individually.

**TC-112 — Search matches on URL, not just title (P2)**
- Preconditions: a tab whose title doesn't contain the domain (e.g. title "My Notes", url `https://example.com/notes`).
- Steps: Search `example`.
- Expected: The tab appears (matched on hostname), even though its title shows no highlight.

**TC-113 — Multi-word query requires every term to match (P2)**
- Preconditions: a tab titled "Python Tutorial" and a tab titled "Python Reference".
- Steps: Search `python tutorial`.
- Expected: Only "Python Tutorial" remains.

**TC-114 — No results state (P1)**
- Steps: Search for a string that matches nothing, e.g. `zzzzz`.
- Expected: List shows "No matching tabs." (distinct from the "No saved tabs yet." empty-library message); `#search-status` announces "No matching tabs".

**TC-115 — Search composes with an active category/Outdated pill (P1)**
- Preconditions: tabs across 2+ categories.
- Steps: Click a category pill → then type a query that matches tabs both inside and outside that category.
- Expected: Only matches within the selected pill's tabs appear. Pills themselves are unaffected by the query (all pills with any tabs in the full library stay visible).

**TC-116 — Clearing search restores prior state (P1)**
- Steps: Apply a category pill → search a query → click the clear button (`#search-clear`) or press **Escape**.
- Expected: Search input empties, full (category-filtered) list returns in its original manual order, focus stays in the search input.

**TC-117 — Escape on an empty search field closes the popup (P3)**
- Steps: With the search field empty and focused, press **Escape**.
- Expected: Popup closes (native browser behavior — the extension does not intercept it).

**TC-118 — Enter opens the top result (P2)**
- Steps: Type a query that matches at least one tab → press **Enter**.
- Expected: The top-ranked result opens in a new tab.

**TC-119 — Drag-to-reorder is disabled while searching (P2)**
- Steps: With a query active, attempt to drag a row.
- Expected: No drag occurs; cursor does not indicate draggability. Clearing the query restores drag-to-reorder.

**TC-120 — Search box hidden on an empty library (P3)**
- Steps: Delete all tabs.
- Expected: The search row is hidden along with the pills row.

**TC-121 — Rapid typing doesn't show stale results (P2)**
- Steps: Type a multi-character query very quickly (fast enough that renders could overlap).
- Expected: Final displayed results match the final typed query — no flash of an intermediate query's results after typing stops.

**TC-122 — Search is hidden and non-interactive while Settings is open (P1)**
- Preconditions: several saved tabs.
- Steps: Open Settings (gear icon). Try to click into where the search box was.
- Expected: The search row is not visible and cannot receive focus or input while Settings is open.

**TC-123 — Searching, then visiting Settings and back, doesn't corrupt the list (P1)**
- Preconditions: 5+ saved tabs.
- Steps: Type a query that narrows the list to a subset → clear the query (list returns to full) → open Settings → click **Back**.
- Expected: Every row renders at its normal height with normal spacing — no squished, overlapping, or zero-height rows. (Regression case: TC-122 closes off the only path that could previously cause this — typing into a search box left reachable while the list behind it was hidden corrupted row-insert animations.)
