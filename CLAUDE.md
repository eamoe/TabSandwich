# CLAUDE.md

Guidance for Claude Code (or any AI collaborator) working in this repo.

## What this is

Tab Sandwich — a Chrome Manifest V3 extension for saving, organizing, and
revisiting browser tabs. Popup-only UI (no background/content scripts),
category tagging with color coding, outdated-tab tracking, drag-to-reorder,
keyboard shortcut to open. Everything is stored locally via
`chrome.storage.local` — there is no server, no sync, no analytics.

## Architecture

TypeScript, built with Vite, no state library. Since v3.0 the screens are
Preact (a ~4 KB component library): every screen is a `.tsx` component in
`src/ui/`, styled with CSS modules and the shared tokens.
`popup/popup.html` points straight
at `src/popup.ts`; `pnpm build` type-checks with `tsc` (Vite itself
doesn't), then Vite bundles the popup into `dist/` and copies in
`manifest.json` and `images/`. `dist/` is the complete, loadable extension —
the folder you load unpacked, the one the robot tests run against, and the
one the release zip is made from.

```
src/
  types.ts              SavedTab, Settings, ThemeChoice
  storage/
    chromeStorage.ts     chrome.storage.local wrappers, DEFAULT_SETTINGS, StorageWriteError on a rejected write
    migration.ts          one-time legacy-localStorage → chrome.storage.local migration
    upgrade.ts            versioned data upgrades: schema version stamp, ordered migration steps,
                            backup before writing, original restored if anything fails
    writeQueue.ts          withStorageLock — serializes every read-modify-write cycle against
                            chrome.storage.local so two overlapping mutations can't lose one's update
  domain/
    TabRepository.ts      add/edit/delete/restore/reorder saved tabs, duplicate detection,
                           ids are crypto.randomUUID() (never derived from Date.now())
    CategoryRepository.ts add/rename/remove/reorder categories, color palette, "Uncategorized" sentinel
    search.ts              fuzzy-match scoring for search — pure, no DOM/chrome.* references,
                            so an omnibox or service-worker search can reuse it unchanged
    backup.ts              export/import JSON: hand-rolled shape validation (no schema lib),
                            merge (additive, dedupes by URL) vs. replace (full overwrite) — pure
    BackupRepository.ts    applies an import under the storage lock and keeps a snapshot for Undo
    SettingsRepository.ts  theme and outdated-tab settings writes; clamps the day count to 1–365
  util/
    errors.ts               writeErrorMessage — turns a caught error into the text shown to the user
    url.ts                 normalizeUrl, urlsMatch (duplicate detection), isSupportedTabUrl
    time.ts                daysSince, isOutdated
    favicon.ts             localFaviconUrl — builds a chrome-extension://…/_favicon/ URL so
                            icons come from Chrome's local favicon cache, never the page's own site
  ui/                       Preact screens and building blocks of the v3.0 look
    tokens.css              every color/shadow/size, light + dark; "System" = no data-theme attribute
                            (CSS follows the OS, even while open), Light/Dark = data-theme on <html>
    base.css                page-level basics (body, color-scheme, focus ring, reduced motion, .visually-hidden)
    controls.module.css     buttons, fields, the color dot — shared by several components
    theme.ts                applyTheme — stamps or clears data-theme from the stored ThemeChoice
    strings.ts              every piece of text the v3.0 screens show or announce (ready for translation)
    Icon.tsx                the stroke icon set (decorative; the control holding it carries the name)
    SiteIcon.tsx            a site's icon from Chrome's local cache, on a tinted first-letter tile
    CategoryPicker.tsx      native <select> with the chosen category's color dot
    Toast.tsx / toastStore.ts  the one bottom toast (Undo or error); a tiny store any screen can call
    main/                   the main screen
      App.tsx               root of the whole popup: loads the library, owns filter/search/highlight
                             and which screen shows; the main screen is hidden (not unmounted) while
                             Settings is open, so it keeps your place; re-applies the stored theme
      useLibrary.ts         loads tabs + settings + storage use for both screens; only the newest load paints
      useActiveTab.ts       the page the save card describes (re-read on tab switch; Save re-reads)
      Header.tsx            logo, search, + (add link manually), gear
      SaveCard.tsx          the page on its own row; category picker + Save below; feedback on the button
      ManualForm.tsx        add a link by hand, shown in place of the save card
      FilterPills.tsx       All / Outdated / category pills, plus the storage-nearly-full warning
      TabList.tsx / TabRow.tsx  the list: tinted, outlined rows; edit form; drag to reorder; entrance motion
      listModel.ts          pure list rules (filter options and order, filtering, site names) — logic-tested
    settings/               the Settings screen: four tabs (arrow keys move between them)
      SettingsScreen.tsx    header with Back, the tab bar, the panel; opens at least as tall as the main
                             screen so the popup window doesn't resize
      GeneralTab.tsx        Light/Dark/System, outdated switch + days, keyboard shortcut, storage meter
      CategoriesTab.tsx     add, rename (click the name), move, remove, drag; color strip and messages
                             float over the row so nothing ever shifts
      BackupTab.tsx         export, import with Merge / Replace all / Cancel, Undo from the toast
      AboutTab.tsx          version, local-only promise, privacy policy and source links
  vite-env.d.ts             types for non-code imports, e.g. *.module.css
  popup.ts                  entry point — migrate → upgrade → apply theme → render App

popup/popup.html               just the mount point for the Preact app
manifest.json                  MV3 manifest — permissions kept to activeTab + storage + favicon
dist/                          build output (the loadable extension) — gitignored, never commit this
vite.config.ts                 build: bundles the popup, copies manifest + icons into dist/
tests/unit/                    logic tests (Vitest, plain Node, in-memory chrome.storage fake) and
                                component tests (*.test.tsx, simulated DOM via happy-dom)
tests/e2e/                     robot tests (Playwright): real Chromium loads dist/, clicks through
                                the popup, and runs an accessibility scan (axe) in light and dark
eslint.config.js               lint rules, incl. "no localStorage outside migration.ts"
.github/workflows/             checks.yml (all checks) ← ci.yml (every PR / push to main),
                                release.yml (version tags: checks, then zip the tested dist/)
```

## Build & verify

Package manager is pnpm (version pinned in `package.json`'s `packageManager`;
`pnpm-lock.yaml` is the lockfile — don't add a `package-lock.json`). Node 22+.

```
pnpm install --frozen-lockfile
pnpm exec playwright install chromium   # once, for the robot tests
pnpm build        # tsc type-check, then Vite → dist/
pnpm watch        # rebuild dist/ on every save
pnpm check        # everything CI runs: lint, typecheck, logic tests, build, robot tests
```

Individually: `pnpm lint`, `pnpm typecheck`, `pnpm test` (logic and
component tests, ~1 s), `pnpm test:e2e` (robot tests against the current `dist/` — build
first). To try it by hand: `chrome://extensions` → Developer mode →
**Load unpacked** → select `dist/` (not the repo root).

**Automated checks are the release gate.** `.github/workflows/checks.yml`
runs all of the above on every pull request and before every release; a
version tag whose checks fail never gets a release zip. New behavior needs
tests in the same change: logic in `tests/unit/`, user-visible journeys in
`tests/e2e/` (select elements by role and accessible name, the way a user
finds them — not by CSS class — so tests survive restyling). The
accessibility scan in `tests/e2e/accessibility.spec.ts` skips only the rules
in its `KNOWN_GAPS` list (empty since v3.0 — every screen passes every rule,
color contrast included, in light and dark); never
add to that list to get a run passing.

What automation doesn't cover still needs a person: drag-and-drop feel,
animation smoothness, and the manual release pass at the top of
`TESTING.md`. Cases there are marked **[auto]** when a test implements them.

## Working conventions

- **No `localStorage`.** All persistent data goes through
  `chrome.storage.local` via `src/storage/chromeStorage.ts`. The one
  exception is `src/storage/migration.ts`, which reads legacy
  `localStorage` data on first run *in order to migrate it away* — never
  add new code that reads or writes `localStorage` for anything else.
  ESLint enforces this.
- **Changing what's stored goes through `src/storage/upgrade.ts`.** Bump
  `CURRENT_SCHEMA_VERSION` and add a pure `{ from, to, migrate }` step to
  `MIGRATIONS`, with tests (see `tests/unit/upgrade.test.ts`). Never
  reshape stored data anywhere else.
- **Manifest permissions are minimal on purpose** (`activeTab`, `storage`,
  `favicon`). If a new feature needs a new permission, that's a deliberate,
  visible change — don't add broader permissions "to be safe."
- **Preact for screens, no state library.** Preact was adopted for the
  v3.0 redesign; don't add another UI or state library. Components keep
  their styles in a sibling `*.module.css` (scoped by the build, so two
  components can never clash over a class name) and take every color
  from `src/ui/tokens.css` variables — never a hard-coded color, so light
  and dark both stay complete. Components call the domain modules
  (`TabRepository`, `CategoryRepository`, …), never `chrome.storage`
  directly.
- **Small, single-responsibility modules.** Data model, storage,
  rendering, and DOM wiring stay in separate files (see the `src/`
  breakdown above) rather than one file doing everything.
- **Every interactive control gives immediate visible feedback** — a
  state change, animation, or message. Don't ship a click handler that
  does something invisible.
- **Build output (`dist/`) is never committed.** CI
  (`.github/workflows/release.yml`) builds and packages a distributable
  zip on every `vX.Y.Z` tag push (after all checks pass, and only if the
  tag matches `manifest.json`'s version) — that's the artifact that gets
  distributed, not a locally-built copy, except when explicitly noted
  otherwise (e.g. `PUBLISHING.md` has a documented one-off exception for
  the first Store submission).
- **Git**: the repo owner runs `git commit` / `git push origin main`
  themselves — when asked for a commit, provide the message text, don't
  run the command. Tagging and pushing a release tag (`git tag -a vX.Y.Z`,
  `git push origin vX.Y.Z`) is fine to run directly once asked to do so.
- **Docs are part of the change, not a follow-up.** A change isn't done
  until every doc it affects agrees with the code: `README.md` (features,
  dev workflow), this file's `src/` breakdown, `TESTING.md` (new cases for
  new behavior, marked **[auto]** where a test covers them; existing cases
  whose expected UI text changed), the automated tests themselves,
  `PRIVACY.md` (any change to what's stored, computed, or requested over
  the network — its URL is the live Store-listing policy, so drift here
  is a compliance problem, not just a stale comment), `PUBLISHING.md`
  (its listing copy and permission justifications quote the current
  permission set and feature list — easy to forget since it's only
  touched at release time, not on every spec), and the manifest's
  `permissions` list. Check this before considering a spec finished, the
  same way a green `pnpm check` is — not as a separate pass at
  release time. This keeps a Store submission a packaging step rather
  than a scramble to reverse-engineer what actually shipped.

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

`PUBLISHING.md` (committed) has the full Chrome Web Store submission
playbook — listing copy, permission justifications, data-usage
disclosures, and the update flow for subsequent versions. Its listing
copy quotes the current permission set and feature list directly, so it
drifts the same way `PRIVACY.md` does: a spec that changes either needs
to update this file too, not just at release time. `PRIVACY.md`
(committed — its URL is the declared privacy policy in the Store listing,
so it must stay live on `main`) is the actual privacy policy shown to
users and reviewers.
