import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { setupPanelDom } from './helpers/panel-dom.js';
import { renderOverview, renderInlinePayloadSize } from '../src/tabs/overview.js';
import { renderSsrData } from '../src/tabs/ssr-data.js';
import { renderRoutes } from '../src/tabs/routes.js';
import { renderI18n, setupI18nSearch } from '../src/tabs/i18n.js';
import { renderHooks, renderModules, renderDirectives } from '../src/tabs/internals.js';
import { renderComponents } from '../src/tabs/components.js';
import { renderConfigs } from '../src/tabs/configs.js';
import { settings } from '../src/settings.js';

const text = selector => document.querySelector(selector).textContent;
const all = selector => [...document.querySelectorAll(selector)];

beforeEach(() => {
    setupPanelDom();
    settings.responseThreshold = 20;
});

test('overview shows versions, rendering mode and payload size', () => {
    renderOverview({
        versions: { nuxt: '4.5.2', vue: '3.5.43' },
        payload: { serverRendered: true },
        i18nIncluded: true,
        piniaInstalled: false,
    });
    renderInlinePayloadSize(2048);

    assert.equal(text('#nuxt-version'), '4.5.2');
    assert.equal(text('#rendering-mode'), 'SSR');
    assert.equal(text('#payload-size'), '2.0 KB');
    assert.equal(document.getElementById('pinia-false').style.display, 'block');
    assert.equal(document.querySelector('[data-id=pinia]').style.display, 'none');
});

test('ssr data shows sizes, truncates big arrays and escapes errors', () => {
    settings.responseThreshold = 2;
    renderSsrData({
        data: { list: [1, 2, 3], failed: null },
        _errors: { failed: { message: '<b>boom</b>', statusCode: 500 } },
    });

    const [list, failed] = all('#ssrRequestsList details');
    assert.equal(list.querySelector('.routeItem__labels').textContent, 'Response: array [3 items, but only 2 will be shown] · ~7 B');
    assert.equal(list.querySelectorAll('.json__number').length, 2);
    assert.ok(failed.classList.contains('routeItem--hasError'));
    assert.equal(failed.querySelector('b'), null);
    assert.match(failed.textContent, /<b>boom<\/b>/);
    assert.equal(text('#ssrDataTotal'), 'Requests: 2, total size: ~7 B');
    assert.equal(text('#ssr-requests-count'), '2');
});

test('routes mark the active one', () => {
    renderRoutes([
        { path: '/en', name: 'index___en', meta: {}, props: { default: false }, active: true },
        { path: '/ar', name: 'index___ar', meta: {}, props: { default: false }, active: false },
    ]);

    assert.equal(text('#routesTotal'), 'Routes total: 2');
    assert.deepEqual(all('#routesList .route-item--active .route-item__name').map(el => el.textContent), ['index___en']);
    assert.equal(text('.route-item__badge'), 'active');
});

test('i18n lists messages, missing translations and searches by click', () => {
    setupI18nSearch();
    renderI18n({
        activeLocale: 'en',
        defaultLocale: 'en',
        browserLocale: 'ar',
        locales: ['en', 'ar', 'fr'],
        messages: { en: { a: 'Apple', b: 'Banana' }, ar: { a: 'تفاحة' }, fr: {} },
    });

    assert.equal(text('#messagesTotal'), 'Messages total: 3 (en: 2, ar: 1)');
    assert.equal(all('#i18nMessagesList .i18nItem').length, 3);
    assert.equal(text('#missingTotal'), '1 keys are missing in some of the loaded locales. Not loaded yet (lazy loading): fr');

    document.querySelector('.i18nMissingItem').click();
    assert.equal(document.getElementById('i18nMessagesInput').value, 'b');
    assert.deepEqual(all('#i18nMessagesList .i18nItem__key').map(el => el.textContent), ['en.b']);
});

test('internals render modules, hooks and directives', () => {
    renderModules([null, { name: 'pinia', latestVersion: '3.0.0' }]);
    renderHooks({ 'app:mounted': 2 });
    renderDirectives({ tooltip: { mounted: 'function' }, empty: {} });

    assert.deepEqual(all('#pluginsList .tabbed-card__header').map(el => el.textContent), ['pinia']);
    assert.equal(text('#hooksList tbody td:last-child'), '2');
    assert.deepEqual(all('#directivesList .tabbed-card__header').map(el => el.textContent), ['v-tooltip']);
});

test('components and configs render cards', () => {
    renderComponents([{ name: 'RouterLink', props: { replace: 'Boolean' } }]);
    renderConfigs({ config: { public: { apiBase: '/api', empty: '' } }, state: {} });

    assert.equal(text('#components-count'), '1');
    assert.deepEqual(all('#componentsList .tabbed-card__header').map(el => el.textContent), ['<RouterLink>']);
    assert.deepEqual(all('#configList .tabbed-card__header').map(el => el.textContent), ['public']);
    assert.match(text('#configList'), /empty: ""/);
});
