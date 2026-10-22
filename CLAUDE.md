# Nuxt Assistant

Chrome DevTools extension (Manifest V3) for debugging Nuxt 3/4 apps in production. Published on the
Chrome Web Store. Vanilla JS, no framework, no build step.

## Commands

- `npm test`: all tests (Node's built-in `node:test`, jsdom for the DOM). Requires Node 22.2+.
- `npm run pack`: builds `dist/nuxt-assistant-<version>.zip` for the Chrome Web Store.
- Manual check: "Load unpacked" the repo folder in `chrome://extensions`, then the smoke test in `TESTING.md`.

## Architecture

- `manifest.json` → `nuxt-assistant.html` / `nuxt-assistant.js` (devtools page: registers the panel and
  broadcasts `page-navigation` when a tab finishes loading) and `background.js` (opens Patreon).
- `nuxt-assistant-panel.html` + `.css`: the panel markup. It loads `src/panel.js` as an ES module.
- `src/panel.js`: entry point. `runAssistant()` collects a snapshot, renders it, then loads module info
  from the network.
- `src/snapshot.js`: `collectSnapshot()` checks for Nuxt (`detectNuxt`), then runs every section query in
  parallel. Each section gets `{ status: 'ok', data }`, `{ status: 'not-installed' }` or `{ status: 'error', error }`.
- `src/sections.js`: `renderSection()` renders a section's data, or its load error into the tab, or hides
  an optional tab. `sectionValue()` gives an Overview card value or `N/A`.
- `src/page/queries.js`: code executed in the inspected page. `src/page/eval.js`: `evalInPage(fn)`.
- `src/tabs/*.js`: one module per panel tab, they receive data as arguments and render it.
  `tabs/overview.js` gets all sections and computes every Overview card; other tabs don't touch it.
- `src/dom.js` (`el`, `createTable`, `setText`), `src/cards.js`, `src/format.js`, `src/i18n/`, `src/modules-api.js`,
  `src/settings.js`, `src/navigation.js`.
- Extension entry files stay in the repo root on purpose; don't move them into `src/`.

## Rules and gotchas

- **Page queries must be self-contained.** `evalInPage` serializes them with `toString()` and runs them in the
  page, so they can't use imports or anything declared outside the function body. Results must be
  JSON-serializable: convert functions, Maps, class instances to plain data inside the query.
  `tests/queries.test.js` checks this for every exported query.
- Never pass raw code strings to `chrome.devtools.inspectedWindow.eval`: they run in the page's global scope,
  so a top-level `const` breaks the next run ("already been declared"). Always go through `evalInPage`.
- A new section = a query in `queries.js` + an entry in `SECTION_QUERIES` (`snapshot.js`) + a `renderSection()`
  call in `panel.js` with the containers that show its load error.
- Queries of optional features return `null` when the feature isn't installed (add the section to
  `OPTIONAL_SECTIONS`) and throw when something is broken. One failing query must not break other sections:
  keep heavy or fragile data (like the payload) in its own query.
- Failed page queries are normal (sites without Nuxt, broken pages). They're shown in the tab as a load error
  and logged with `console.debug`. Don't use `console.warn`/`console.error` for them: they flood the
  extension's error page in `chrome://extensions`. Rendering errors are bugs and must not be swallowed.
- Elements filled with data of the inspected page are marked with `data-page-content` in the HTML: they're
  cleared for a page without Nuxt. Mark new ones too; Overview and i18n values are cleared by
  `clearOverview()` / `clearRoutes()` / `clearI18n()`. Tabs with a search (Routes, i18n) keep their data
  in module state for filtering: reset it in their `clear*()` and call that on a load error too.
  A renderer must also reset what it doesn't fill this time (e.g. `prerenderedAt` for a page that
  isn't prerendered), or the previous page's value stays.
- Toggle visibility with the `hidden` attribute (a global `[hidden]` rule in the CSS wins over `display: flex`
  classes) and switch tabs with the `active` class via `openTab()`. Don't set `style.display`.
- Overview and i18n cards are generated from lists in `tabs/overview.js` / `tabs/i18n.js` with
  `createWidget()` (`src/widgets.js`); a card with `tab` opens that tab on click. Set values by id with
  `setText()`, flag cards with `setFlag()`. Tests that render these cards call `setupOverview()` / `setupI18n()` first.
- Build DOM with `el()`: string children become text nodes, so page data can't inject HTML.
  `innerHTML` is only used for `jsonSyntaxHighlight()` output, which escapes its input.
- Data from the inspected page is untrusted (payload, error messages, i18n strings).
- `runtime.sendMessage` reaches every open panel: compare `message.tabId` with
  `chrome.devtools.inspectedWindow.tabId`.
- Every `await` in `runAssistant()` is followed by a `runId !== currentRunId` check before rendering,
  so a slow previous run never overwrites a newer one.
- Event listeners are registered once at startup, never inside `runAssistant()`.
- The panel HTML declares `<meta charset="utf-8">`; without it non-ASCII text in scripts is garbled.
- i18n: messages are vue-i18n ASTs, minified in production (`t`, `b`, `s`, `i`...), see `src/i18n/ast.js`.
  Lazy-loaded locales have no messages until the user switches to them, so they're excluded from the
  missing-translations comparison.
- Nuxt modules are guessed from `vueApp.config.globalProperties` and looked up on `api.nuxt.com`;
  built-in properties (`$router`, `$t`...) are excluded in `src/modules-api.js`.
- New files that must ship with the extension go into the allowlist in `scripts/pack.js`.

## Conventions

- Match the surrounding style: 4-space indent, single quotes, comments explain why, not what.
- Tests: pure logic gets unit tests; tab rendering goes to `tests/tabs.test.js`; section statuses to
  `tests/snapshot.test.js`; wiring to `tests/panel.test.js`. The fake Nuxt app lives in
  `tests/helpers/fake-page.js`; break it for a test with `createFakePage({ patch: () => { ... } })`.
- Commit messages: `[v<manifest version>] feat|fix: description`, e.g. `[v1.24] fix: ...`.
  The version is bumped in `manifest.json`.

## Backlog

Ideas postponed during the refactoring, not started:

- Refresh on client-side (SPA) navigation: now only full page loads trigger a refresh.
- Pinia: show object state with a depth limit (like `normalizeResponse`) instead of `{}`.
- Drop the `{"default":false}` noise from route labels.
- Routes search by a concrete URL (`/en/claims/123` → `/en/claims/:id`), e.g. with `router.resolve()` in the page.
