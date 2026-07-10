# Publishing to the Chrome Web Store

This is the step-by-step guide for submitting Tab Sandwich to the Chrome Web Store. Written for our **first** publication — a few steps here (developer registration, initial listing creation) are one-time only and won't apply to future version updates. Those are marked below.

## 0. Prerequisites (one-time)

1. Go to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) and sign in with the Google account you want to publish under.
2. Pay the one-time $5 developer registration fee if you haven't already registered as a Chrome Web Store developer.

## 1. Get the package to upload

Normally you'd use the zip CI already built and attached to the tagged release, so what you submit is exactly what was tagged and verified. For this first submission specifically, `manifest.json`'s description was tweaked after `v2.0.1` was tagged (without a version bump), so that release's zip is one commit behind. Build locally instead, matching what the release workflow packages:

```
npm ci
npm run build
```

Then zip `manifest.json`, `images/`, and `popup/` (the same set `.github/workflows/release.yml` packages) into a single archive.

(For future versions: bump `manifest.json`'s `version`, tag and push a new `vX.Y.Z` tag, wait for the release workflow to attach the new zip, then go to `https://github.com/eamoe/TabSandwich/releases/tag/vX.Y.Z` and download that asset directly — no need to build locally once the tag is current.)

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
Click the toolbar icon (or press Alt+S) and hit Save Tab — the current page's title, URL, and favicon are saved immediately. Need to save a link that isn't your active tab? Use "+ Add link manually."

ORGANIZE WITH CATEGORIES
Assign a color-coded category to any saved tab. Filter your list with a click, manage your categories (add, remove, recolor) from Settings, and scan your list at a glance by color.

NEVER LOSE TRACK OF STALE TABS
Tabs you saved a while ago and haven't revisited get a visible age badge, with a dedicated quick filter to round them all up and decide what to keep.

EDIT, REORDER, DELETE
Fix a title or URL without deleting and re-adding. Drag tabs into whatever order makes sense to you. Delete what you don't need with one click.

KEYBOARD FRIENDLY
Every core action — saving, filtering, editing, deleting, settings — works without a mouse. Open the popup itself with a customizable keyboard shortcut.

YOUR DATA STAYS YOURS
Tab Sandwich stores everything locally on your device using Chrome's own storage APIs. Nothing is ever sent to a server, tracked, or shared — there is no server. The extension requests only the two permissions it actually uses: access to your current tab (only when you click the extension) and local storage.
```

### Screenshots

Upload all three from `store-assets/` (each already sized to the required 1280×800):

1. `screenshot-1-main-list.png` — main list with color-coded categories
2. `screenshot-2-settings-categories.png` — Settings view with the color picker
3. `screenshot-3-manual-entry.png` — the manual-entry form open

### Icon

Already bundled in the package (`images/icon-128.png`, referenced from the manifest's top-level `icons` field) — the Store should pick it up automatically from the uploaded zip.

## 3. Privacy practices tab

1. **Single purpose description:**
   ```
   Tab Sandwich lets users save, organize, and revisit browser tabs they want to keep for later.
   ```

2. **Permission justifications:**
   - `activeTab`: "Used only when the user clicks the extension icon or its keyboard shortcut, to read the title/URL/favicon of the currently active tab so it can be saved. No access to any other tab."
   - `storage`: "Used to persist the user's saved tabs and settings locally via chrome.storage.local. No data is transmitted off-device."

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
4. Update the description/screenshots only if something user-facing actually changed.
5. Submit for review again (update reviews are usually faster than the first one).
