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
    assert.deepEqual(headers('#modulesList'), ['pinia']);
    assert.deepEqual(headers('#directivesList'), ['v-tooltip', 'v-focus']);
    assert.deepEqual(headers('#piniaList'), ['user']);
    assert.equal(document.querySelectorAll('#hooksList tbody tr').length, 2);
    assert.equal(document.querySelector('.nuxt-not-found').hidden, true);
});

test('refresh re-renders without duplicating content', async () => {
    document.getElementById('refetch-trigger').click();
    await wait(50);

    assert.equal(document.querySelectorAll('#routesList .route-item').length, 2);
    assert.deepEqual(headers('#modulesList'), ['pinia']);
    assert.equal(document.querySelectorAll('#ssrRequestsList details').length, 1);
});

async function refreshWith(page) {
    chromeStub.setPage(page);
    document.getElementById('refetch-trigger').click();
    await wait(50);
}

test('shows a load error in the tab whose data failed, the rest still renders', async () => {
    await refreshWith(createFakePage({
        patch: () => {
            window.useNuxtApp().$router.getRoutes = () => {
                throw new Error('Router is broken');
            };
        },
    }));

    assert.match(text('#routesList .load-error'), /Couldn't load this section: .*Router is broken/);
    assert.equal(text('#routes-count'), 'N/A');
    assert.equal(text('#components-count'), '1');
    assert.equal(text('.header__title'), 'Nuxt Assistant');
});

test('hides optional tabs that the app does not use, and shows them back', async () => {
    await refreshWith(createFakePage({
        patch: () => {
            delete window.useNuxtApp().$i18n;
            delete window.useNuxtApp().$pinia;
        },
    }));

    assert.equal(document.querySelector('[data-id=i18n]').hidden, true);
    assert.equal(document.querySelector('[data-id=pinia]').hidden, true);

    await refreshWith(createFakePage());

    assert.equal(document.querySelector('[data-id=i18n]').hidden, false);
    assert.equal(document.querySelector('[data-id=pinia]').hidden, false);
    assert.equal(document.querySelectorAll('#routesList .route-item').length, 2);
});

test('ignores navigation in other tabs', async () => {
    chromeStub.setPage(createFakePage({ withNuxt: false }));
    chromeStub.sendMessage({ type: 'page-navigation', tabId: 2 });
    await wait(50);

    assert.equal(document.querySelector('.nuxt-not-found').hidden, true);
});

test('shows "Nuxt is not found" and clears the previous page data on a page without Nuxt', async () => {
    chromeStub.sendMessage({ type: 'page-navigation', tabId: 1 });
    await wait(50);

    assert.equal(document.querySelector('.nuxt-not-found').hidden, false);

    for (const id of ['buildId', 'nuxt-version', 'routes-count', 'routesTotal', 'messagesTotal', 'currentLocale', 'ssrDataTotal']) {
        assert.equal(text(`#${id}`), '', id);
    }
    for (const id of ['routesList', 'ssrRequestsList', 'configList', 'modulesList', 'hooksList', 'directivesList',
        'componentsList', 'piniaList', 'i18nMessagesList', 'i18nMissingList']) {
        assert.equal(document.getElementById(id).childElementCount, 0, id);
    }
    assert.equal(document.querySelector('#i18n-included img').hidden, true);

    // The i18n search must not bring back messages of the previous page
    const search = document.getElementById('i18nMessagesInput');
    search.value = 'hello';
    search.dispatchEvent(new window.Event('input'));
    assert.equal(document.querySelectorAll('#i18nMessagesList .i18nItem').length, 0);
    search.value = '';
});

test('the data comes back when the page has Nuxt again', async () => {
    chromeStub.setPage(createFakePage());
    document.querySelector('.nuxt-not-found').click();
    await wait(50);

    assert.equal(document.querySelector('.nuxt-not-found').hidden, true);
    assert.equal(text('#buildId'), 'build-1');
    assert.equal(document.querySelectorAll('#routesList .route-item').length, 2);
});

test('an Overview card opens its tab, cards without a tab are not links', () => {
    document.getElementById('routes-count').closest('.widget').click();

    assert.ok(document.getElementById('routes').classList.contains('active'));
    assert.ok(document.querySelector('[data-id=routes]').classList.contains('active'));
    assert.ok(!document.getElementById('rendering-mode').closest('.widget').classList.contains('widget--link'));
    assert.equal(document.querySelectorAll('#common .widget').length, 9);
    assert.equal(document.querySelectorAll('#i18nWidgets .widget').length, 3);

    document.querySelector('[data-id=common]').click();
});

test('tabs switch on click', () => {
    document.querySelector('[data-id=routes]').click();

    assert.ok(document.getElementById('routes').classList.contains('active'));
    assert.ok(!document.getElementById('common').classList.contains('active'));
    assert.ok(document.querySelector('[data-id=routes]').classList.contains('active'));
});
