![Alt text](/images/icon128.png)
# Nuxt Assistant Extension

**Nuxt Assistant** is an invaluable tool for debugging your Nuxt websites in a production environment. This extension offers a comprehensive suite of features designed to enhance your development experience.

## Features

- **Overview**: Nuxt and Vue versions, build ID, rendering mode (SSR / SSG / SPA), i18n and Pinia detection,
  and quick stats: routes, SSR requests, inline payload size and global components. Each card opens its tab.
- **Routes**:
    - All routes with their meta, with case-insensitive search by path, name or meta.
    - The current route is highlighted, dynamic routes (`/users/:id`) included.
- **SSR Data**:
    - All requests made during server-side rendering, with their responses.
    - Response sizes, with large ones highlighted, and the total payload data size.
    - Failed requests with their error message and status code.
- **Configs**: Public runtime config, app config and the State.
- **i18n**:
    - Current, default and browser locales.
    - All translations with case-insensitive search, including messages with placeholders, plurals and linked messages.
    - Missing translations: keys present in one locale but absent in another.
- **Pinia**: Stores with their primitive state and getters values, and their actions.
- **Internals**:
    - Installed Nuxt modules with their info from the Nuxt modules catalog.
    - Directives and their hooks.
    - Hooks with the number of listeners.
- **Components**: Globally registered components with their props.

## Development

The extension has no build step: `src/panel.js` is loaded as an ES module by `nuxt-assistant-panel.html`.
Load the repository folder with "Load unpacked" in `chrome://extensions`.

- `npm test` runs the tests, `npm run pack` builds the zip for the Chrome Web Store.
- Code in `src/page/queries.js` is executed in the inspected page, so each function there must be self-contained.

See [TESTING.md](TESTING.md) for details and the manual smoke test.

## Links

- **Check it out**: [Nuxt Assistant on Chrome Web Store](https://chromewebstore.google.com/detail/nuxt-assistant/nebkdnlhchcbbjpgfmhifafhfjipphgi?hl=ru)
- **Support me on Patreon**: [Become a Patron](https://www.patreon.com/user?u=45269161)

Nuxt Assistant is designed to make your Nuxt development process smoother and more efficient. Try it out and take your Nuxt projects to the next level!
