# Progress

- **Current release and stage:** 4.2 Smooth drag, on the branch `v4.2-smooth-drag` (4.1.1 is live on the Chrome Web Store since 12 Nov 2026). Stages: 1 the shared drag engine, 2 the tab list in the popup and the side panel, 3 Settings › Categories, 4 release 4.2.0. Stages 1, 2 and 3 (Settings › Categories) are committed (`usePointerDrag`, `dragModel`, `tabsWithPlaced`; the tab list on it), after the owner's hand check in real Chrome; notes at the bottom of the popup now wrap to two lines; on a touchscreen a drag starts after holding a row still 250 ms (owner checked in DevTools' touch emulation); in light mode site icons sit on a plain white tile (owner checked real icons). `release-notes/v4.2.0.md` is started; the version is still 4.1.1 (bumped at the release stage).
- **Waiting on (whom, what):** nothing.
- **Next step:** stage 4 (version 4.2.0, a "What's new" note in all eight languages, the frame rate with 200 tabs measured for the pull request).
