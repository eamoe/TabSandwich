# Publishing to the Chrome Web Store

This is the step-by-step guide for submitting Tab Sandwich to the Chrome Web Store. Written for our **first** publication — a few steps here (developer registration, initial listing creation) are one-time only and won't apply to future version updates. Those are marked below.

## 0. Prerequisites (one-time)

1. Go to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) and sign in with the Google account you want to publish under.
2. Pay the one-time $5 developer registration fee if you haven't already registered as a Chrome Web Store developer.

## 1. Get the package to upload

Normally you'd use the zip CI already built and attached to the tagged release, so what you submit is exactly what was tagged and verified. For this first submission specifically, `manifest.json`'s description was tweaked after `v2.0.1` was tagged (without a version bump), so that release's zip is one commit behind. Build locally instead, matching what the release workflow packages:

```
pnpm install --frozen-lockfile
pnpm build
```

Then zip the *contents* of `dist/` (so `manifest.json` sits at the root of the zip — the same thing `.github/workflows/release.yml` packages): `cd dist && zip -r ../tab-sandwich.zip .`

(For future versions: bump `manifest.json`'s `version`, tag and push a new `vX.Y.Z` tag, wait for the release workflow to run every check and attach the new zip (a tag whose checks fail, or whose version doesn't match `manifest.json`, gets no zip), then go to `https://github.com/eamoe/TabSandwich/releases/tag/vX.Y.Z` and download that asset directly — no need to build locally once the tag is current.)

## 2. Create the listing (one-time)

1. In the Developer Dashboard, click **New Item**.
2. Upload the zip from Step 1.
3. Fill in the **Store Listing** tab with the content below.

### Store listing content

**Category:** Workflow & Planning

**Language:** English

**Summary** (132 char max — the Dashboard shows this as "Summary from package," pulled automatically from `manifest.json`'s `description` field — this is 127 chars, nothing to type in manually):
```
Save tabs in one click, organize with color-coded categories, and spot outdated ones. 100% local — nothing leaves your browser.
```

**Detailed description:**
```
Tab Sandwich is a fast, focused way to save and organize the tabs you want to come back to.

SAVE INSTANTLY
Click the toolbar icon (or press Alt+S): the popup shows the page you're on. Pick a category if you like and hit Save — its title and URL are saved immediately. Need to save a link that isn't your active tab? Use the + button.

FIND IT AGAIN, FAST
Search matches titles and sites as you type, with the matching letters highlighted. Press Enter to open the top result.

ORGANIZE WITH CATEGORIES
Give any saved tab a color-coded category. Each row is tinted in its category's color and names it under the title, so the list is easy to scan. Filter with a click, and manage categories (add, rename, remove, reorder, recolor) in Settings.

NEVER LOSE TRACK OF STALE TABS
Tabs you saved a while ago get a small moon badge with their age, and a quick filter rounds them all up so you can decide what to keep.

EDIT, REORDER, DELETE, UNDO
Fix a title or URL without deleting and re-adding. Drag tabs into whatever order makes sense to you. Delete what you don't need, with Undo if you change your mind.

LIGHT AND DARK
Follows your computer's light or dark mode, even while open, or pick one in Settings.

BACKUP AND KEYBOARD
Export everything to a file and import it later. Every core action works without a mouse, and a customizable keyboard shortcut opens the popup.

YOUR DATA STAYS YOURS
Tab Sandwich stores everything locally on your device using Chrome's own storage APIs. Nothing is ever sent to a server, tracked, or shared — there is no server. The extension requests only the permissions it actually uses: access to your current tab (only when you click the extension), local storage, and read-only access to Chrome's own local favicon cache to show each saved tab's icon (no favicon data is stored, and nothing is ever fetched from the tab's own site).

NEW IN 3.0
A fresh, playful look with dark mode; pick a category as you save; calmer Settings with Light / Dark / System; and safer data: upgrades keep a backup and undo themselves if anything goes wrong, and editing a link can no longer create a duplicate.
```

### Screenshots

Upload all five from `store-assets/`, in this order (each exactly 1280×800, as the Store requires). Each shows the popup next to a headline on the brand's purple background; the first (main) one also carries the 3D logo (`store-assets/3d-branded-logo.png`):

1. `screenshot-1-main-list.png` — "Save the tab you're on, in one click": the main list and save card
2. `screenshot-2-dark-mode.png` — "Easy on the eyes, day or night": the same list in dark mode
3. `screenshot-3-search.png` — "Find any saved tab in a keystroke": search with highlighted matches
4. `screenshot-4-categories.png` — "Organize your way": Settings › Categories with the color strip open
5. `screenshot-5-private.png` — "Your tabs stay in your browser": Settings › About in dark mode

They're rendered from the built extension, not edited by hand: `pnpm build && pnpm store:screenshots` (on a Mac, with network access — it visits each sample site once so the rows show real site icons). Re-run it whenever the look changes, and check the pictures before uploading: they're public.

### Icon

Already bundled in the package (`images/icon-128.png`, referenced from the manifest's top-level `icons` field) — the Store should pick it up automatically from the uploaded zip.

## 3. Privacy practices tab

1. **Single purpose description:**
   ```
   Tab Sandwich lets users save, organize, and revisit browser tabs they want to keep for later.
   ```

2. **Permission justifications:**
   - `activeTab`: "Used only after the user clicks the extension icon or its keyboard shortcut, to read the title/URL of the currently active tab: the popup shows them, and saves them if the user clicks Save. No access to any other tab."
   - `storage`: "Used to persist the user's saved tabs and settings locally via chrome.storage.local. No data is transmitted off-device."
   - `favicon`: "Used to show each saved tab's icon by reading it from Chrome's own local favicon cache, instead of fetching it from the page's own site. No favicon data is stored, and no request is ever made to the saved page's site for this."

3. **Data usage:**
   - Data types collected: check **"Web history"** (we store saved URLs/titles).
   - Purpose: **"App functionality"** only.
   - Certifications: all three can be checked truthfully — no selling/transferring data, no use for creditworthiness/lending, no use unrelated to core functionality.
   - Data encrypted in transit: mark **not applicable** (nothing is ever transmitted).

4. **Privacy policy URL:**
   ```
   https://github.com/eamoe/TabSandwich/blob/main/PRIVACY.md
   ```
   (Requires `PRIVACY.md` to be committed and pushed to `main` before submitting — the link must resolve.)

## 4. Submit for review

1. Review every tab in the dashboard for a "complete" checkmark — the Store won't let you submit with required fields missing.
2. Click **Submit for review**.
3. First-time reviews typically take longer than update reviews (can be anywhere from a few hours to a few days). You'll get an email when it's approved, rejected, or needs changes.

## 5. If it comes back with a policy question or rejection

Most likely causes for a first submission: a permission that isn't clearly justified, or the privacy policy link not matching what's declared in the Data Usage tab. Re-read Step 3 against whatever the rejection email says, adjust, and resubmit — there's no re-registration needed, just a re-review of the same listing.

## Future updates (after this first publish)

Once the listing exists, publishing a new version doesn't repeat Steps 0/2 (account, category, description) — just:

1. Bump `manifest.json`'s `version`.
2. Tag and push (`git tag -a vX.Y.Z -m "..."`, `git push origin vX.Y.Z`) — CI builds the new zip.
3. In the Developer Dashboard, open the existing Tab Sandwich item → **Package** tab → upload the new zip.
4. Update the description/screenshots only if something user-facing actually changed (3.0.0 did: paste the detailed description above, including its "New in 3.0" paragraph, and replace all screenshots with the five listed above — the old ones show the pre-3.0 look). The Store has no per-version notes field; the full notes go in the GitHub release.
5. Submit for review again (update reviews are usually faster than the first one).
