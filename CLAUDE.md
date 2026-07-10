# CLAUDE.md

Guidance for Claude Code (or any AI collaborator) working in this repo.

## What this is

Tab Sandwich — a Chrome Manifest V3 extension for saving, organizing, and
revisiting browser tabs. Popup-only UI (no background/content scripts),
category tagging with color coding, outdated-tab tracking, drag-to-reorder,
keyboard shortcut to open. Everything is stored locally via
`chrome.storage.local` — there is no server, no sync, no analytics.

## Architecture

Vanilla TypeScript compiled with `tsc` — no bundler, no UI framework, no
state library. The browser loads native ES modules directly
(`<script type="module">` in `popup/popup.html`), so relative imports in
`.ts` files need explicit `.js` extensions once compiled; `fix-extensions.js`
(run as part of `npm run build`) rewrites `tsc`'s extension-less import
specifiers to add them, since native ESM resolution requires them.

```
src/
  types.ts              SavedTab, Settings interfaces
  storage/
    chromeStorage.ts     chrome.storage.local wrappers, DEFAULT_SETTINGS
    migration.ts          one-time legacy-localStorage → chrome.storage.local migration
  domain/
    TabRepository.ts      add/edit/delete/reorder saved tabs, duplicate detection
    CategoryRepository.ts category CRUD, color palette, "Uncategorized" sentinel
  render/
    ListRenderer.ts        tab list rows (display + edit modes, drag handlers)
    PillsRenderer.ts       category filter pills + "Outdated" pill
    HeroRenderer.ts         hero stats, save actions, manual-entry disclosure
    SettingsRenderer.ts    settings view (categories, outdated toggle, shortcut display)
    viewController.ts      central refreshView() orchestrator — exists to avoid
                            circular imports between the render modules above
  util/
    url.ts                 normalizeUrl, urlsMatch (duplicate detection), isSupportedTabUrl
    time.ts                daysSince, isOutdated
    color.ts               tintHex (pastel row-tint generation from palette colors)
  dom/domHelper.ts          getElement<T>(id) helper
  popup.ts                  DOMContentLoaded entry point — migrate → refreshView → wire hero/settings

popup/popup.html / popup.css   markup + styles (hand-written, no CSS framework)
popup/js/                      tsc build output — gitignored, never commit this
manifest.json                  MV3 manifest — permissions kept to activeTab + storage only
fix-extensions.js              post-build import-path fixer (see above)
```

## Build & verify

```
npm ci
npm run build      # tsc && node fix-extensions.js — outputs to popup/js/
```

Then load `chrome://extensions` → Developer mode → **Load unpacked** →
select the repo root, and exercise the feature by hand in the actual popup.

**There is no automated test suite.** A clean `tsc` build proves types
check, nothing else — it does not prove drag-and-drop works, a dropdown is
positioned correctly, or storage writes race-free. Manually click through
the feature in a real loaded extension before calling anything done. See
`TESTING.md` for the running list of manual test cases (written with
future automation in mind — element IDs are noted for that purpose).

## Working conventions

- **No `localStorage`.** All persistent data goes through
  `chrome.storage.local` via `src/storage/chromeStorage.ts`. The one
  exception is `src/storage/migration.ts`, which reads legacy
  `localStorage` data on first run *in order to migrate it away* — never
  add new code that reads or writes `localStorage` for anything else.
- **Manifest permissions are minimal on purpose** (`activeTab`, `storage`
  only). If a new feature needs a new permission, that's a deliberate,
  visible change — don't add broader permissions "to be safe."
- **No UI framework/state library.** Vanilla DOM APIs are the default;
  only reach for something heavier if a specific feature genuinely can't
  be built without it, and say so explicitly when you do.
- **Small, single-responsibility modules.** Data model, storage,
  rendering, and DOM wiring stay in separate files (see the `src/`
  breakdown above) rather than one file doing everything.
- **Every interactive control gives immediate visible feedback** — a
  state change, animation, or message. Don't ship a click handler that
  does something invisible.
- **Build output (`popup/js/`) is never committed.** CI
  (`.github/workflows/release.yml`) builds and packages a distributable
  zip on every `vX.Y.Z` tag push — that's the artifact that gets
  distributed, not a locally-built copy, except when explicitly noted
  otherwise (e.g. `PUBLISHING.md` has a documented one-off exception for
  the first Store submission).
- **Git**: the repo owner runs `git commit` / `git push origin main`
  themselves — when asked for a commit, provide the message text, don't
  run the command. Tagging and pushing a release tag (`git tag -a vX.Y.Z`,
  `git push origin vX.Y.Z`) is fine to run directly once asked to do so.

## Spec-driven development

This project was rebuilt using GitHub's spec-kit workflow
(constitution → specify → clarify → plan → tasks → implement). The
toolkit itself (`.specify/`, `.claude/skills/speckit-*`) lives locally and
is intentionally not committed to this repo, along with any per-feature
`specs/<feature>/` output — see `SPEC_KIT_GUIDE.md` (also local-only) for
the full playbook if you're running a new feature through it. The
short version if that file isn't present: constitution once, then per
feature run specify → clarify → plan → tasks → implement, implementing
and verifying one user story at a time rather than the whole feature at
once.

## Publishing

`PUBLISHING.md` (local-only) has the full Chrome Web Store submission
playbook — listing copy, permission justifications, data-usage
disclosures, and the update flow for subsequent versions. `PRIVACY.md`
(committed — its URL is the declared privacy policy in the Store listing,
so it must stay live on `main`) is the actual privacy policy shown to
users and reviewers.
