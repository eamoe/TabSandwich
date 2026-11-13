# Progress

- **Current release and stage:** 4.2 Smooth drag, on the branch `v4.2-smooth-drag` (4.1.1 is live on the Chrome Web Store since 12 Nov 2026). Stages: 1 the shared drag engine, 2 the tab list in the popup and the side panel, 3 Settings › Categories, 4 release 4.2.0. Stages 1 and 2 are committed (`usePointerDrag`, `dragModel`, `tabsWithPlaced`; the tab list on it), after the owner's hand check in real Chrome; notes at the bottom of the popup now wrap to two lines; on a touchscreen a drag starts after holding a row still 250 ms (owner checked in DevTools' touch emulation). `release-notes/v4.2.0.md` is started; the version is still 4.1.1 (bumped at the release stage).
- **Waiting on (whom, what):** nothing.
- **Next step:** site icons on a plain white tile in light mode; then stage 3, Settings › Categories on the same engine; then stage 4 (version 4.2.0, a "What's new" note in all eight languages, the frame rate with 200 tabs measured for the pull request).
