# Testing

## Automated tests

```sh
npm install
npm test
```

Tests run on Node's built-in test runner (Node 22.2+), the panel DOM is emulated with jsdom:

- `tests/queries.test.js`: the code executed in the inspected page (`src/page/queries.js`), run in a separate
  JS realm against a fake Nuxt app. Also checks that every query is self-contained and can run repeatedly.
- `tests/snapshot.test.js`: section statuses: a broken section fails alone, a payload that can't be
  serialized doesn't break the Overview, optional features that aren't installed, pages without Nuxt.
- `tests/panel.test.js`: the real entry point wired to a fake page: all tabs get filled, refresh doesn't
  duplicate content, load errors are shown in their tabs, optional tabs hide and come back,
  "Nuxt is not found" is shown for pages without Nuxt.
- `tests/tabs.test.js`, `tests/i18n.test.js`, `tests/format.test.js`, `tests/dom.test.js`: rendering and pure logic.

## Manual smoke test

Automated tests use a fake Nuxt app, so check the real extension before publishing:

1. `chrome://extensions` → Developer mode → "Load unpacked" → the repository folder
   (or "Reload" if it's already loaded). Clear old entries on the extension's "Errors" page.
2. Open a Nuxt site, open DevTools → "Nuxt Assistant" panel, and check every tab:
   - **Overview**: site host, build ID, update time, Nuxt and Vue versions, i18n / Pinia flags, Rendering,
     Routes, SSR requests, Inline payload, Global components. Clicking a card opens its tab.
   - **Menu**: counters next to Routes, SSR Data, Pinia, Components; "N failed" / "N missing" / "!" are
     highlighted. Clicking a counter opens its tab.
   - **Routes**: the current route is highlighted with the `active` badge; the search filters by path, name
     or meta and the subtitle shows "Routes: N of M"; the query stays applied after "Refresh data".
   - **SSR Data**: requests with sizes, failed ones first, big arrays are truncated to the threshold from
     Settings. "Copy JSON" copies the full response (paste it somewhere to check) and doesn't toggle the request;
     "Expand all" / "Collapse all" work.
   - **Configs**: runtime config and state cards, empty strings are shown as `""`.
   - **i18n**: locales, missing translations (clicking a key searches for it), case-insensitive search,
     Arabic values with digits or Latin words are displayed in the right order.
   - **Pinia**, **Internals** (modules, directives, hooks), **Components**.
3. Press the refresh button in the header a few times: it spins while loading, nothing disappears or
   gets duplicated.
4. Reload the page and navigate to another page of the site: the panel updates.
5. Open a site without Nuxt: "Nuxt is not found!" is shown.
6. The extension's "Errors" page in `chrome://extensions` stays empty.

## Publishing

```sh
npm run pack
```

Creates `dist/nuxt-assistant-<version>.zip` with the extension files only (the version comes from
`manifest.json`). Upload it to the Chrome Web Store dashboard.
