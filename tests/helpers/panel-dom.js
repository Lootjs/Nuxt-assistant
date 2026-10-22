import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

// Loads the panel markup (without its scripts) and exposes the DOM globals the panel modules use
export function setupPanelDom() {
    const html = readFileSync(new URL('../../nuxt-assistant-panel.html', import.meta.url), 'utf8')
        .replace(/<script\b[^>]*><\/script>/g, '');
    const { window } = new JSDOM(html);

    window.HTMLElement.prototype.scrollIntoView = () => {};
    globalThis.window = window;
    globalThis.document = window.document;
    globalThis.Event = window.Event;

    return window;
}
