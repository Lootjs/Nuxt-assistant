import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { setupPanelDom } from './helpers/panel-dom.js';
import { renderOverview, setupOverview } from '../src/tabs/overview.js';
import { renderSsrData, setupSsrData } from '../src/tabs/ssr-data.js';
import { renderTabBadges } from '../src/badges.js';
import { filterRoutes, renderRoutes, setupRoutes } from '../src/tabs/routes.js';
import { renderI18n, setupI18n } from '../src/tabs/i18n.js';
import { renderHooks, renderModules, renderDirectives } from '../src/tabs/internals.js';
import { renderComponents } from '../src/tabs/components.js';
import { renderConfigs } from '../src/tabs/configs.js';
import { renderPinia } from '../src/tabs/pinia.js';
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
            host: 'shop.example.com',
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

    assert.equal(text('#pageHost'), 'shop.example.com');
    assert.equal(text('#buildId'), 'build-1');
    assert.match(text('#updatedAt'), /\d/);
    assert.equal(text('#nuxt-version'), '4.5.2');
    assert.equal(document.getElementById('nuxt-version').closest('.widget').querySelector('.widget__name').textContent, 'Nuxt');
    assert.equal(document.getElementById('vue-version').closest('.widget').querySelector('.widget__name').textContent, 'Vue');
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

    // Failed requests go first
    const [failed, list] = all('#ssrRequestsList > details');
    assert.equal(list.querySelector('.request-item__info').textContent, 'Response: array [3 items] · ~7 B');
    // The tree shows a page of settings.responseThreshold items and a button for the rest
    assert.equal(list.querySelectorAll('.json__number').length, 2);
    assert.equal(list.querySelector('.tree__more').textContent, 'Show 1 more of 1');
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
        { path: '/en', name: 'index___en', meta: {}, active: true },
        { path: '/ar', name: 'index___ar', meta: {}, active: false },
    ]);

    assert.equal(text('#routesTotal'), 'Routes total: 2');
    assert.deepEqual(all('#routesList .route-item--active .route-item__name').map(el => el.textContent), ['index___en']);
    assert.equal(text('.route-item__badge'), 'active');
});

test('routes show meta as chips and hide the meta column when no route has meta', () => {
    renderRoutes([
        { path: '/en', name: 'index___en', meta: { layout: 'form', middleware: ['auth', 'locale'] }, active: false },
        { path: '/ar', name: 'index___ar', meta: {}, active: false },
    ]);

    assert.deepEqual(all('.route-meta').map(el => el.textContent), ['layout: form', 'middleware: ["auth","locale"]']);
    assert.ok(!document.getElementById('routes').classList.contains('routes--no-meta'));

    renderRoutes([{ path: '/en', name: 'index___en', meta: {}, active: false }]);
    assert.ok(document.getElementById('routes').classList.contains('routes--no-meta'));
});

test('i18n explains that messages of a custom i18n cannot be read', () => {
    setupI18n();
    renderI18n({
        activeLocale: 'eng-e1',
        defaultLocale: null,
        browserLocale: null,
        locales: [],
        messages: null,
        api: ['locale', 'localeHead', 'localePath', 't'],
    });

    assert.equal(text('#currentLocale'), 'eng-e1');
    assert.equal(text('#i18nLocalesList'), 'Available locales: N/A');
    assert.equal(text('#messagesTotal'),
        "$i18n of this app isn't vue-i18n, so its messages can't be read. It provides: locale, localeHead, localePath, t.");
    assert.match(text('#missingTotal'), /Not available/);
    assert.equal(document.getElementById('i18nMessagesInput').disabled, true);
    assert.equal(document.getElementById('i18nMessagesList').hidden, true);

    // The next page uses vue-i18n again
    renderI18n({ activeLocale: 'en', locales: ['en'], messages: { en: { hello: 'Hello' } }, api: null });
    assert.equal(document.getElementById('i18nMessagesInput').disabled, false);
    assert.equal(document.getElementById('i18nMessagesList').hidden, false);
    assert.equal(all('#i18nMessagesList .i18nItem').length, 1);
});

test('i18n shows N/A for locales plain vue-i18n does not have', () => {
    setupI18n();
    renderI18n({
        activeLocale: 'ar',
        defaultLocale: null,
        browserLocale: null,
        locales: ['en', 'ar'],
        messages: { en: { hello: 'Hello' }, ar: { hello: 'x' } },
    });

    assert.equal(text('#currentLocale'), 'ar');
    assert.equal(text('#defaultLocale'), 'N/A');
    assert.equal(text('#browserLocale'), 'N/A');
    assert.equal(all('#i18nMessagesList .i18nItem').length, 2);
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
    assert.ok(all('#i18nMessagesList .i18nItem__value').every(value => value.dir === 'auto'));
    assert.equal(text('#missingTotal'), '1 keys are missing in some of the loaded locales. Not loaded yet (lazy loading): fr');

    document.querySelector('.i18nMissingItem').click();
    assert.equal(document.getElementById('i18nMessagesInput').value, 'b');
    assert.deepEqual(all('#i18nMessagesList .i18nItem__key').map(el => el.textContent), ['en.b']);
});

test('internals render modules, hooks and directives', () => {
    renderModules([null, { name: 'pinia', latestVersion: '3.0.0' }]);
    renderHooks({ 'app:mounted': 2 });
    renderDirectives({ tooltip: { mounted: 'function' }, empty: {} });

    assert.deepEqual(all('#modulesList .module-card__header a').map(el => el.textContent), ['pinia']);
    assert.equal(text('#hooksList tbody td:last-child'), '2');
    assert.deepEqual(all('#directivesList tbody td:first-child').map(el => el.textContent), ['v-tooltip', 'v-empty']);
});

test('components and configs render cards', () => {
    renderComponents([{ name: 'RouterLink', props: { replace: 'Boolean' } }]);
    renderConfigs({ config: { public: { apiBase: '/api', empty: '' } }, state: {} });

    assert.deepEqual(all('#componentsList .tabbed-card__header').map(el => el.textContent), ['<RouterLink>']);
    assert.deepEqual(all('#configList .tabbed-card__header').map(el => el.textContent), ['public']);
    assert.match(text('#configList'), /empty: ""/);
});

test('ssr data: failed requests go first, expand and collapse all', () => {
    setupSsrData();
    renderSsrData({
        data: { first: [1], failed: null, last: { a: 1, nested: { b: 2 } } },
        _errors: { first: null, failed: { message: 'boom', statusCode: 500 } },
    });

    const titles = () => all('#ssrRequestsList > details > summary').map(summary => summary.title);
    assert.deepEqual(titles(), ['failed', 'first', 'last']);

    document.getElementById('ssrExpandAll').click();
    assert.ok(all('#ssrRequestsList > details').every(details => details.open));
    // Only the requests: nodes of the response trees stay as they are
    assert.ok(all('#ssrRequestsList .tree details').every(details => !details.open));

    document.getElementById('ssrCollapseAll').click();
    assert.ok(all('#ssrRequestsList > details').every(details => !details.open));
});

test('pinia shows an error in the card of a store that cannot be read', () => {
    renderPinia({
        broken: { error: '[Error: Store is broken]' },
        user: { state: { name: 'John' }, getters: {}, actions: [] },
    });

    const [broken, user] = all('#piniaList .tabbed-card');
    assert.equal(broken.querySelector('.load-error').textContent, "Couldn't read this store: [Error: Store is broken]");
    assert.match(user.textContent, /name: "John"/);
});

test('pinia shows state and getters as trees and actions as chips', () => {
    renderPinia({
        user: {
            state: { name: 'John', profile: { age: 30 } },
            getters: { fullName: 'John Doe' },
            actions: ['login', 'logout'],
        },
        empty: { state: {}, getters: {}, actions: [] },
    });

    const [user, empty] = all('#piniaList .tabbed-card');
    const sectionTitles = card => [...card.querySelectorAll('.tree-section__title')].map(title => title.textContent);

    assert.deepEqual(sectionTitles(user), ['state', 'getters', 'actions']);
    assert.match(user.textContent, /name: "John"/);
    // The first level is expanded
    assert.match(user.textContent, /age: 30/);
    assert.deepEqual([...user.querySelectorAll('.chip')].map(chip => chip.textContent), ['login', 'logout']);
    assert.deepEqual(sectionTitles(empty), ['state']);
});

test('configs show their values as trees', () => {
    renderConfigs({ config: { public: { apiBase: '/api', flags: { beta: true } } }, state: {} });

    assert.equal(all('#configList .tabbed-card').length, 1);
    assert.ok(document.querySelector('#configList .tree'));
    assert.match(text('#configList'), /beta: true/);
});

test('ssr data copies the full response, not the truncated one, without toggling the request', async () => {
    const copied = [];
    Object.defineProperty(globalThis, 'navigator', {
        value: { clipboard: { writeText: async text => copied.push(text) } },
        configurable: true,
    });
    settings.responseThreshold = 1;
    const response = [{ deep: { deeper: { deepest: { value: 1 } } } }, { second: true }];
    renderSsrData({ data: { list: response } });

    const details = document.querySelector('#ssrRequestsList details');
    const button = details.querySelector('.request-item__copy');
    button.click();
    await new Promise(resolve => setTimeout(resolve));

    assert.deepEqual(JSON.parse(copied[0]), response);
    assert.equal(button.textContent, 'Copied');
    assert.equal(details.open, false);
});

test('copying falls back to execCommand when the Clipboard API is blocked', async () => {
    Object.defineProperty(globalThis, 'navigator', {
        value: { clipboard: { writeText: async () => { throw new Error('Blocked by permissions policy'); } } },
        configurable: true,
    });
    let copiedText = null;
    document.execCommand = command => {
        copiedText = command === 'copy' ? document.querySelector('.clipboard-buffer').value : null;

        return true;
    };
    renderSsrData({ data: { item: { a: 1 } } });

    const button = document.querySelector('.request-item__copy');
    button.click();
    await new Promise(resolve => setTimeout(resolve));

    assert.deepEqual(JSON.parse(copiedText), { a: 1 });
    assert.equal(button.textContent, 'Copied');
    assert.equal(document.querySelector('.clipboard-buffer'), null);
});

test('tab badges show counts, problems and load errors', () => {
    renderTabBadges({
        routes: ok([{}, {}]),
        payload: ok({ data: { a: 1, b: 2 }, _errors: { a: null, b: { message: 'boom' } } }),
        i18n: ok({ messages: { en: { a: 'A', b: 'B' }, ar: { a: 'x' } } }),
        pinia: { status: 'not-installed' },
        components: { status: 'error', error: 'Broken components' },
    });

    const badge = tab => document.querySelector(`[data-id=${tab}] .tablinks__badge`);
    assert.equal(badge('routes').textContent, '2');
    assert.ok(!badge('routes').classList.contains('tablinks__badge--warning'));
    assert.equal(badge('ssrData').textContent, '1 failed');
    assert.equal(badge('ssrData').title, '1 of 2 requests failed');
    assert.ok(badge('ssrData').classList.contains('tablinks__badge--warning'));
    assert.equal(badge('i18n').textContent, '1 missing');
    assert.equal(badge('pinia'), null);
    assert.equal(badge('components').textContent, '!');
    assert.match(badge('components').title, /Broken components/);

    renderTabBadges({
        routes: ok([{}]),
        payload: ok({ data: { a: 1 } }),
        i18n: ok({ messages: { en: { a: 'A' }, ar: { a: 'x' } } }),
        pinia: ok({ user: {}, cart: {} }),
        components: ok([]),
    });
    assert.equal(badge('ssrData').textContent, '1');
    assert.equal(badge('i18n'), null);
    assert.equal(badge('pinia').textContent, '2');
    assert.equal(badge('components').textContent, '0');
});
