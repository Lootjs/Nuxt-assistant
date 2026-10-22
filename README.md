![Alt text](/images/icon128.png)
# Nuxt Assistant Extension

**Nuxt Assistant** is an invaluable tool for debugging your Nuxt websites in a production environment. This extension offers a comprehensive suite of features designed to enhance your development experience.

## Features

- **Nuxt & Vue Versions**: Easily view the current versions of Nuxt and Vue being used in your project.
- **Plugins**: Get a detailed list of plugins added to your project, helping you manage and understand your site's functionality.
- **Hooks & Directives**: Keep track of which hooks and directives are installed, streamlining your development process.
- **i18n Support**:
    - View all translations.
    - Search functionality within i18n.
    - Access to detailed i18n data.
- **Server-Side Rendering (SSR)**:
    - Monitor all SSR requests.
    - Identify and debug erroneous requests efficiently.
- **Router Insights**:
    - Overview of all routes.
    - Details of the current route.
- **Configuration Details**:
    - Insight into the application and runtime configurations.
    - Comprehensive information about the State.

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
