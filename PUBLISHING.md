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

**Language:** English is the listing's default. Since 4.1 it has seven more: in the **Store listing** tab, add each from the language menu at the top, then fill in its own description and screenshots (the Store localizes only those and the promo video):

| Dashboard language | Description | Screenshots |
|---|---|---|
| English | `store-listing/en.txt` | `store-assets/en/` |
| Spanish | `store-listing/es.txt` | `store-assets/es/` |
| Portuguese (Brazil) | `store-listing/pt_BR.txt` | `store-assets/pt_BR/` |
| German | `store-listing/de.txt` | `store-assets/de/` |
| French | `store-listing/fr.txt` | `store-assets/fr/` |
| Russian | `store-listing/ru.txt` | `store-assets/ru/` |
| Japanese | `store-listing/ja.txt` | `store-assets/ja/` |
| Chinese (China) | `store-listing/zh_CN.txt` | `store-assets/zh_CN/` |

**Summary** (132 char max — the Dashboard shows this as "Summary from package," pulled automatically from the package: since 4.1 the manifest's `description` is `__MSG_appDescription__`, so it's `_locales/en/messages.json`'s `appDescription`, and each language's own folder gives that language's summary — this is 127 chars, nothing to type in manually):
```
Save a tab or a whole window in one click, organize with color-coded categories. 100% local — nothing leaves your browser.
```

**Detailed description:** paste the whole of `store-listing/<language>.txt`, one per language as in the table. Since 4.1 it's written around what people come to do (save all my tabs, find that link again, read it later), and ends with "New in 4.1". Every language says the same; in particular its "Your data stays yours" paragraph names the same permissions as the English one, so when a permission or a feature changes, change all eight files. The translations are machine-made, like the app's (no native review); the app's "Tell us" form is where better words come back.

### Screenshots

Each language has its own five, in `store-assets/<language>/` (see the table above); upload them to that language's listing in this order (each exactly 1280×800, as the Store requires). Each shows the extension next to a headline on the brand's purple background, the screens, the headlines and the sample library all in that language (its categories named in it, its pages from Wikipedia, MDN and sites in it); the first (main) one leads with the icon and the name, large, side by side (`branding/icon.svg`):

1. `screenshot-1-main-list.png` — "Save the page you're on, in one click": the main list (a pinned tab, a note) and save card, under the icon and the name; the privacy promise is a badge at the bottom ("Stored only in your browser. No account, no tracking.")
2. `screenshot-2-side-panel.png` — "Keep your list open beside the page": a Chrome window with a Wikipedia article and the side panel beside it, describing that page (the page and the panel are rendered apart; the window around them, tab strip, address bar and the panel's header, is drawn plainly, with no browser logo); its lines mention right-click saving
3. `screenshot-3-library.png` — "Find that link again": the full-page library in dark mode, a search typed in and its matches lit
4. `screenshot-4-whole-window.png` — "Forty tabs open? Save them all at once": a window just saved, open as a saved window, with "Close N tabs" on offer
5. `screenshot-5-read-later.png` — "Read it later, or keep it for good": the Waiting filter in dark mode, a reminder that's come among the waiting tabs, with "Archive all N waiting tabs"

(Since 3.2 the categories screenshot is gone to make room for saving a whole window; the main list still shows categories. Since 3.3.1 the About screenshot is gone too: it showed no feature, so read later / keep has its place, and the privacy promise moved onto the first screenshot. Since 4.0 the side panel and the library take the places of dark mode, which the library and read-later shots still show, and search, which the library shows. Since 4.1 there's a set per language, and the library shot shows a search.)

They're rendered from the built extension, not edited by hand: `pnpm build && pnpm store:screenshots` (on a Mac, with network access — it visits each sample site once so the rows show real site icons; some 10 minutes for all eight languages, or one with `pnpm store:screenshots -g "screenshots, de$"`). The run fails rather than save a picture with English left on a translated screen, words cut off or over the screen beside them, or a sample page that doesn't exist. Re-run it whenever the look changes, and check the pictures before uploading: they're public.

### Promo video

A short demo (about 36 seconds) of the real extension at work (saving the page you're on, then a whole window; opening the side panel from the popup's Open in menu and right-clicking a link into it; opening the library the same way and searching it; typing ts in a new tab's address bar to open a saved tab), 1920×1080, no sound, captions in English. It's filmed by a script, not by hand: `pnpm build && pnpm store:video` (on a Mac, with network access) writes `store-assets/video/demo-en.webm`, which isn't committed. The extension's screens in it are real, and so are its clicks; the Chrome window around them, the cursor, the right-click menu and the toolbar icon's ✓ are drawn, as on screenshot 2, since a script can't film Chrome's own toolbar or menus (the drawn menu's pick writes the link into the library, as the real one would; the drawn address bar lists what the extension's own suggestion code finds in the library at that moment).

**On YouTube (since 4.1):** https://www.youtube.com/watch?v=t6fd-LACGlM (the dashboard takes only this full form, not a youtu.be link). It's the same video for every language and every release, so an update that doesn't re-film it just keeps this link.

To put a new one up (only after re-filming):

1. Upload the file to YouTube (Public or Unlisted; title "Tab Sandwich: save tabs, find them again"; not made for kids; embedding allowed, or the Store can't play it). It may start at a low resolution while HD is still processing, and YouTube picks the resolution to fit the player.
2. Paste its link, as `https://www.youtube.com/watch?v=…`, into the **Store listing** tab's promo video fields for English, both Localized and Global. It's the same video for every language: if another language's page doesn't show it, paste the same link into that language's **Localized promo video** field.
3. Replace the link above.

### Icon

Already bundled in the package (`images/icon-128.png`, referenced from the manifest's top-level `icons` field) — the Store should pick it up automatically from the uploaded zip. The icons are drawn in `branding/` and rendered with `pnpm icons`; after changing them, re-run `pnpm store:screenshots` too, since the icon appears in every screenshot.

## 3. Privacy practices tab

1. **Single purpose description:**
   ```
   Tab Sandwich lets users save, organize, and revisit browser tabs they want to keep for later.
   ```

2. **Permission justifications:**
   - `activeTab`: "Used only after the user clicks the extension icon, its keyboard shortcut or its right-click menu item, to read the title/URL of the currently active tab: the popup shows them, and saves them if the user clicks Save. No access to any other tab."
   - `storage`: "Used to persist the user's saved tabs and settings locally via chrome.storage.local. No data is transmitted off-device."
   - `tabs` (optional permission): "Requested only when the user first clicks 'Save all tabs in this window' or Save in the side panel, never at install. Used to read the titles and URLs of the tabs open in the popup's or side panel's window, so they can be saved in one action and it can say how many are new, and so the side panel, which stays open while the user browses, can show and save the page they're on; read only while the popup or side panel is open, stored only for pages the user chooses to save, never transmitted. Declining leaves every other feature working."
   - `sidePanel`: "Lets the user keep their saved tabs open in Chrome's side panel beside the page they're on, as an alternative to the popup."
   - `contextMenus`: "Adds 'Save to Tab Sandwich' to the right-click menu, with one item per category, so the user can save a link or page without opening the popup."
   - `scripting`: "Used only when the user picks 'Save to Tab Sandwich' on a link in the right-click menu: reads the words on that one link, in that one tab, so the saved tab has a recognizable title (Chrome gives extensions a link's address but not its text). Nothing runs on any page until the user makes that choice, and nothing is sent anywhere."
   - `alarms`: "Wakes the extension at the time of a reminder the user set on a saved tab and, if the user turned on the toolbar badge, keeps its count up to date as tabs age."
   - `notifications` (optional permission): "Requested only when the user sets their first reminder, never at install. Shows that reminder, with the saved tab's title and site, at the time the user chose. Refused, the tab simply shows under Waiting in the extension."
   - `favicon`: "Used to show each saved tab's icon by reading it from Chrome's own local favicon cache, instead of fetching it from the page's own site. No favicon data is stored, and no request is ever made to the saved page's site for this."

3. **Data usage:**
   - Data types collected: check **"Web history"** (we store saved URLs/titles).
   - Purpose: **"App functionality"** only.
   - Certifications: all three can be checked truthfully — no selling/transferring data, no use for creditworthiness/lending, no use unrelated to core functionality.
   - Data encrypted in transit: mark **not applicable** (nothing is ever transmitted).
   - Since 4.1, Settings › About has a "Tell us" link to a feedback form on Google Forms. It only opens a web page when someone clicks it, with Chrome's language and the version in its address; the extension itself transmits nothing, so these answers stay as they are. `PRIVACY.md` describes it under "Feedback".

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

1. In the release pull request: bump `manifest.json`'s `version` and add the release notes as `release-notes/vX.Y.Z.md` (sections `### New` / `### Changed` / `### Fixed` / `### Under the hood`, only those that apply, ending with the **Full Changelog** link).
2. Tag and push (`git tag -a vX.Y.Z -m "..."`, `git push origin vX.Y.Z`) — CI builds the new zip and publishes the GitHub release with those notes already in it, so GitHub's release email carries them (notes added by editing a release afterwards never reach that email). A tag without its notes file gets no release.
3. In the Developer Dashboard, open the existing Tab Sandwich item → **Package** tab → upload the new zip.
4. Update the description/screenshots only if something user-facing actually changed (3.2.0 did: paste the detailed description (since 4.1, each language's `store-listing/<language>.txt`), including its "New in" paragraph, and replace all five screenshots — delete the old ones first, since two were renamed — re-rendered with `pnpm build && pnpm store:screenshots` after the version bump). The Store has no per-version notes field; the full notes go in the GitHub release.
   - 4.1.0 adds seven languages to the listing (Step 2's table): for each, add the language in the **Store listing** tab, paste its `store-listing/<language>.txt` and upload its five screenshots from `store-assets/<language>/`. For English, paste `store-listing/en.txt` again (rewritten around tasks, with "New in 4.1") and replace all five screenshots (delete the old ones first; they now live in `store-assets/en/`, and screenshot 3 is new: "Find that link again"). Add the promo video (Step 2's **Promo video**). Each language's summary comes from the package's `_locales/`. No permission change, nothing new stored or sent: **Privacy practices** stays as it is (the "Tell us" link is covered in its Data usage note).
   - 4.0.0 changes the description (paste it again, with its "New in 4.0" paragraph) and all five screenshots: delete the old ones first, since three are new or renamed (`screenshot-2-side-panel.png`, `screenshot-3-library.png`, `screenshot-4-whole-window.png`; `screenshot-3-dark-mode.png` and `screenshot-4-search.png` are gone). In the **Privacy practices** tab, add the justifications for `contextMenus`, `scripting`, `sidePanel`, `alarms` and the optional `notifications` (Step 3 above). None of the new required permissions shows a warning, so updating doesn't disable the extension; `notifications`, being optional, is asked for only with someone's first reminder. Nothing is sent anywhere: reminders and the badge setting stay on the device like the rest, so the **Data usage** answers stay as they are; `PRIVACY.md` lists them.
   - 3.3.1 keeps the description as it is but replaces all five screenshots (delete the old ones first: `screenshot-5-private.png` is gone, `screenshot-5-read-later.png` takes its place; screenshot 1 gains the privacy line, and every headline now breaks into balanced lines). No permission change, nothing new stored: **Privacy practices** stays as it is.
   - 3.3.0 changes the description (paste it again, with its "New in 3.3" paragraph) and all five screenshots (same names; re-render after the version bump). It adds no permission and sends nothing anywhere: the new data (pins, archive, notes, when a tab was last opened from Tab Sandwich) stays on the device like the rest, so the **Privacy practices** answers stay as they are; `PRIVACY.md` lists it.
   - 3.2.0 adds the optional `tabs` permission: in the **Privacy practices** tab, add its justification (Step 3 above). Being optional, it's asked for only when someone first saves a whole window, so updating doesn't disable the extension for existing users.
   - A new icon (3.1.0 has one) normally comes from the uploaded zip. If the **Store listing** tab also has its own 128×128 store icon field, upload `images/icon-128.png` there too, or the listing keeps the old one.
5. Submit for review again (update reviews are usually faster than the first one).
