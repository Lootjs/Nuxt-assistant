import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as wait } from 'node:timers/promises';
import { setupPanelDom } from './helpers/panel-dom.js';
import { createFakePage, installChromeStub } from './helpers/fake-page.js';

// End-to-end wiring check: the real entry point runs against a fake Nuxt page

const text = selector => document.querySelector(selector).textContent;
const headers = selector => [...document.querySelectorAll(`${selector} .tabbed-card__header`)].map(el => el.textContent);

let chromeStub;

before(async () => {
    // Expected failures on the page without Nuxt are logged with console.debug
    console.debug = () => {};
    setupPanelDom();
    chromeStub = installChromeStub(createFakePage());
    globalThis.fetch = async url => {
        const name = url.split('/').pop();

        return name === 'pinia'
            ? { ok: true, json: async () => ({ name: 'pinia', maintainers: [], stats: { version: '3.0.0' } }) }
            : { ok: false, json: async () => ({ statusCode: 404 }) };
    };

    await import('../src/panel.js');
    await wait(50);
});

test('fills every tab from the inspected page', () => {
    assert.equal(text('#buildId'), 'build-1');
    assert.equal(text('#nuxt-version'), '4.5.2');
    assert.equal(text('#rendering-mode'), 'SSR');
    assert.equal(text('#payload-size'), 'N/A');
    assert.equal(text('#routes-count'), '2');
    assert.equal(text('#ssr-requests-count'), '1');
    assert.equal(text('#components-count'), '1');
    assert.equal(text('#messagesTotal'), 'Messages total: 2 (en: 2)');
    assert.equal(text('.route-item--active .route-item__name'), 'claims-id___en');
    assert.deepEqual(headers('#configList'), ['public', 'state']);
    assert.deepEqual(headers('#pluginsList'), ['pinia']);
    assert.deepEqual(headers('#directivesList'), ['v-tooltip', 'v-focus']);
    assert.deepEqual(headers('#piniaList'), ['user']);
    assert.equal(document.querySelectorAll('#hooksList tbody tr').length, 2);
    assert.equal(document.querySelector('.nuxt-not-found').style.display, 'none');
});

test('refresh re-renders without duplicating content', async () => {
    document.getElementById('refetch-trigger').click();
    await wait(50);

    assert.equal(document.querySelectorAll('#routesList .route-item').length, 2);
    assert.deepEqual(headers('#pluginsList'), ['pinia']);
    assert.equal(document.querySelectorAll('#ssrRequestsList details').length, 1);
});

test('ignores navigation in other tabs', async () => {
    chromeStub.setPage(createFakePage({ withNuxt: false }));
    chromeStub.sendMessage({ type: 'page-navigation', tabId: 2 });
    await wait(50);

    assert.equal(document.querySelector('.nuxt-not-found').style.display, 'none');
});

test('shows "Nuxt is not found" after navigating to a page without Nuxt', async () => {
    chromeStub.sendMessage({ type: 'page-navigation', tabId: 1 });
    await wait(50);

    assert.equal(document.querySelector('.nuxt-not-found').style.display, 'block');
    assert.equal(text('#buildId'), 'N/A');
});

test('tabs switch on click', () => {
    document.querySelector('[data-id=routes]').click();

    assert.equal(document.getElementById('routes').style.display, 'flex');
    assert.equal(document.getElementById('common').style.display, 'none');
    assert.ok(document.querySelector('[data-id=routes]').classList.contains('active'));
});
