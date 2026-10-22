import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { setupPanelDom } from './helpers/panel-dom.js';
import { renderOverview, setupOverview } from '../src/tabs/overview.js';
import { renderSsrData } from '../src/tabs/ssr-data.js';
import { filterRoutes, renderRoutes, setupRoutes } from '../src/tabs/routes.js';
import { renderI18n, setupI18n } from '../src/tabs/i18n.js';
import { renderHooks, renderModules, renderDirectives } from '../src/tabs/internals.js';
import { renderComponents } from '../src/tabs/components.js';
import { renderConfigs } from '../src/tabs/configs.js';
import { settings } from '../src/settings.js';

const text = selector => document.querySelector(selector).textContent;
const all = selector => [...document.querySelectorAll(selector)];

// Shown icon of a flag card, null when it shows nothing
const flagIcon = id => {
    const image = document.querySelector(`#${id} img`);

    return image.hidden ? null : image.src.split('/').pop();
};

beforeEach(() => {
    setupPanelDom();
    setupOverview();
    settings.responseThreshold = 20;
});

const ok = data => ({ status: 'ok', data });

test('overview summarizes the snapshot', () => {
    renderOverview({
        buildId: ok('build-1'),
        inlinePayloadSize: ok(2048),
        overview: ok({
            versions: { nuxt: '4.5.2', vue: '3.5.43' },
            serverRendered: true,
            prerenderedAt: null,
            i18nIncluded: true,
            piniaInstalled: false,
        }),
        payload: ok({ data: { a: 1, b: 2 } }),
        routes: ok([{}, {}, {}]),
        components: ok([{}]),
    });

    assert.equal(text('#buildId'), 'build-1');
    assert.equal(text('#nuxt-version'), '4.5.2');
    assert.equal(text('#rendering-mode'), 'SSR');
    assert.equal(text('#payload-size'), '2.0 KB');
    assert.equal(text('#routes-count'), '3');
    assert.equal(text('#ssr-requests-count'), '2');
    assert.equal(text('#components-count'), '1');
    assert.equal(flagIcon('i18n-included'), 'icon-check.svg');
    assert.equal(flagIcon('pinia-included'), 'icon-denied.svg');
});

test('overview shows N/A for sections that failed', () => {
    const failed = { status: 'error', error: 'boom' };
    renderOverview({
        buildId: failed,
        inlinePayloadSize: ok(null),
        overview: failed,
        payload: failed,
        routes: failed,
        components: failed,
    });

    for (const id of ['buildId', 'nuxt-version', 'rendering-mode', 'payload-size', 'routes-count', 'ssr-requests-count', 'components-count']) {
        assert.equal(text(`#${id}`), 'N/A', id);
    }
    assert.equal(flagIcon('i18n-included'), null);
    assert.equal(flagIcon('pinia-included'), null);
});

test('ssr data shows sizes, truncates big arrays and escapes errors', () => {
    settings.responseThreshold = 2;
    renderSsrData({
        data: { list: [1, 2, 3], failed: null },
        _errors: { failed: { message: '<b>boom</b>', statusCode: 500 } },
    });

    const [list, failed] = all('#ssrRequestsList details');
    assert.equal(list.querySelector('.request-item__labels').textContent, 'Response: array [3 items, but only 2 will be shown] · ~7 B');
    assert.equal(list.querySelectorAll('.json__number').length, 2);
    assert.ok(failed.classList.contains('request-item--has-error'));
    assert.equal(failed.querySelector('b'), null);
    assert.match(failed.textContent, /<b>boom<\/b>/);
    assert.equal(text('#ssrDataTotal'), 'Requests: 2, total size: ~7 B');
});

test('ssr data shows the prerender date only for prerendered pages', () => {
    const prerenderedAt = Date.UTC(2026, 0, 15, 10, 30);
    renderSsrData({ prerenderedAt, data: {} });

    assert.equal(text('#prerenderedAt'), `Prerendered at: ${new Date(prerenderedAt).toLocaleString()}`);

    renderSsrData({ data: {} });
    assert.equal(text('#prerenderedAt'), '');
});

const route = (path, name, meta = {}) => ({ path, name, meta, props: { default: false }, active: false });

test('routes search matches the path, the name and the meta, case-insensitively', () => {
    const routes = [
        route('/en/claims/:id', 'claims-id___en', { layout: 'Claims' }),
        route('/ar/claims/:id', 'claims-id___ar'),
        route('/en/about', 'about___en', { middleware: 'auth' }),
        route('/catch-all', undefined),
    ];
    const paths = query => filterRoutes(routes, query).map(({ path }) => path);

    assert.deepEqual(paths('/EN/'), ['/en/claims/:id', '/en/about']);
    assert.deepEqual(paths('___ar'), ['/ar/claims/:id']);
    assert.deepEqual(paths('claims'), ['/en/claims/:id', '/ar/claims/:id']);
    assert.deepEqual(paths('auth'), ['/en/about']);
    assert.deepEqual(paths('  '), routes.map(({ path }) => path));
    assert.deepEqual(paths('undefined'), []);
});

test('routes search filters the list and keeps the query after a refresh', () => {
    setupRoutes();
    renderRoutes([route('/en', 'index___en'), route('/ar', 'index___ar'), route('/en/about', 'about___en')]);

    const search = document.getElementById('routesSearch');
    search.value = '/en';
    search.dispatchEvent(new Event('input'));

    assert.equal(text('#routesTotal'), 'Routes: 2 of 3');
    assert.deepEqual(all('#routesList .route-item__name').map(el => el.textContent), ['index___en', 'about___en']);

    renderRoutes([route('/en', 'index___en'), route('/ar', 'index___ar')]);
    assert.equal(text('#routesTotal'), 'Routes: 1 of 2');

    search.value = 'nothing';
    search.dispatchEvent(new Event('input'));
    assert.equal(all('#routesList .route-item').length, 0);
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
    setupI18n();
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

    assert.deepEqual(all('#modulesList .tabbed-card__header').map(el => el.textContent), ['pinia']);
    assert.equal(text('#hooksList tbody td:last-child'), '2');
    assert.deepEqual(all('#directivesList .tabbed-card__header').map(el => el.textContent), ['v-tooltip']);
});

test('components and configs render cards', () => {
    renderComponents([{ name: 'RouterLink', props: { replace: 'Boolean' } }]);
    renderConfigs({ config: { public: { apiBase: '/api', empty: '' } }, state: {} });

    assert.deepEqual(all('#componentsList .tabbed-card__header').map(el => el.textContent), ['<RouterLink>']);
    assert.deepEqual(all('#configList .tabbed-card__header').map(el => el.textContent), ['public']);
    assert.match(text('#configList'), /empty: ""/);
});
