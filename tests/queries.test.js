import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { evalInPage, PageEvalError } from '../src/page/eval.js';
import * as queries from '../src/page/queries.js';
import { createFakePage, installChromeStub } from './helpers/fake-page.js';

let setPage;

beforeEach(() => {
    ({ setPage } = installChromeStub(createFakePage()));
});

test('every query is self-contained and can run repeatedly in the same page', async () => {
    for (const [name, query] of Object.entries(queries)) {
        await assert.doesNotReject(evalInPage(query), `${name}, first run`);
        await assert.doesNotReject(evalInPage(query), `${name}, second run`);
    }
});

test('rejects with PageEvalError when the page has no Nuxt', async () => {
    setPage(createFakePage({ withNuxt: false }));

    await assert.rejects(evalInPage(queries.getOverview), error => {
        assert.ok(error instanceof PageEvalError);
        // The UI gets one line, the stack trace stays in details for the console
        assert.equal(error.message, 'TypeError: window.useNuxtApp is not a function');
        assert.match(error.details, /\n\s+at /);

        return true;
    });
});

test('passes arguments to the query', async () => {
    assert.equal(await evalInPage((a, b) => a + b, 2, 3), 5);
});

test('detectNuxt', async () => {
    assert.equal(await evalInPage(queries.detectNuxt), true);

    setPage(createFakePage({ withNuxt: false }));
    assert.equal(await evalInPage(queries.detectNuxt), false);
});

test('getOverview', async () => {
    assert.deepEqual(await evalInPage(queries.getOverview), {
        host: 'shop.example.com',
        versions: { nuxt: '4.5.2', vue: '3.5.43' },
        serverRendered: true,
        prerenderedAt: null,
        i18nIncluded: true,
        piniaInstalled: true,
    });
});

test('getPayload drops the pinia state', async () => {
    const payload = await evalInPage(queries.getPayload);

    assert.equal(payload.pinia, undefined);
    assert.deepEqual(payload.data, { wordings: [{ name: 'Life' }] });
    assert.deepEqual(payload.config, { public: { apiBase: '/api' } });
});

test('optional features return null when not installed', async () => {
    setPage(createFakePage({
        patch: () => {
            delete window.useNuxtApp().$i18n;
            delete window.useNuxtApp().$pinia;
        },
    }));

    assert.equal(await evalInPage(queries.getI18n), null);
    assert.equal(await evalInPage(queries.getPinia), null);
});

test('getBuildId and getInlinePayloadSize', async () => {
    assert.equal(await evalInPage(queries.getBuildId), 'build-1');
    assert.equal(await evalInPage(queries.getInlinePayloadSize), null);

    setPage(createFakePage({ payloadScript: { textContent: '[1,"ü"]' } }));
    assert.equal(await evalInPage(queries.getInlinePayloadSize), 8);
});

test('getRoutes marks the active route by its record', async () => {
    const routes = await evalInPage(queries.getRoutes);

    assert.deepEqual(routes.map(({ name, active }) => [name, active]), [['claims-id___en', true], ['claims-id___ar', false]]);
    assert.deepEqual(routes[0].meta, { layout: 'form' });
});

test('getI18n keeps compiled messages instead of dropping them', async () => {
    const i18n = await evalInPage(queries.getI18n);

    assert.equal(i18n.browserLocale, 'ar');
    assert.deepEqual(i18n.locales, ['en', 'ar']);
    assert.equal(i18n.messages.en.compiled, '[compiled function]');
    assert.deepEqual(i18n.messages.en.hello, { t: 0, b: { t: 2, s: 'Hello' } });
});

test('getI18n reads the global composer when a plugin provides the createI18n() instance', async () => {
    setPage(createFakePage({
        patch: () => {
            const nuxtApp = window.useNuxtApp();
            nuxtApp.$i18n = { mode: 'composition', install() {}, global: nuxtApp.$i18n };
        },
    }));

    const i18n = await evalInPage(queries.getI18n);
    assert.equal(i18n.activeLocale, 'en');
    assert.deepEqual(i18n.locales, ['en', 'ar']);
    assert.equal(i18n.messages.en.hello.b.s, 'Hello');
});

test('getI18n supports the legacy mode of vue-i18n with plain values', async () => {
    setPage(createFakePage({
        patch: () => {
            window.useNuxtApp().$i18n = {
                locale: 'ar',
                availableLocales: ['en', 'ar'],
                messages: { en: { hello: 'Hello' }, ar: { hello: 'مرحبا' } },
            };
        },
    }));

    assert.deepEqual(await evalInPage(queries.getI18n), {
        defaultLocale: null,
        activeLocale: 'ar',
        locales: ['en', 'ar'],
        browserLocale: null,
        messages: { en: { hello: 'Hello' }, ar: { hello: 'مرحبا' } },
        api: null,
    });
});

test('getI18n reports a custom i18n whose messages are hidden in a closure', async () => {
    setPage(createFakePage({
        patch: () => {
            // Like a hand-written i18n plugin: messages live in the closure of t()
            const dictionary = { title: 'Hello' };
            window.useNuxtApp().$i18n = {
                locale: 'eng-e1',
                localeHead() {},
                localePath: path => path,
                t: key => dictionary[key] || '',
                _internal: true,
            };
        },
    }));

    assert.deepEqual(await evalInPage(queries.getI18n), {
        defaultLocale: null,
        activeLocale: 'eng-e1',
        locales: [],
        browserLocale: null,
        messages: null,
        api: ['locale', 'localeHead', 'localePath', 't'],
    });
});

test('getI18n takes the locales from the messages when nothing else lists them', async () => {
    setPage(createFakePage({
        patch: () => {
            window.useNuxtApp().$i18n = { messages: { __v_isRef: true, value: { en: {}, de: {} } } };
        },
    }));

    const i18n = await evalInPage(queries.getI18n);
    assert.deepEqual(i18n.locales, ['en', 'de']);
    assert.equal(i18n.activeLocale, null);
});

test('getInternals returns global properties and hook listener counts', async () => {
    assert.deepEqual(await evalInPage(queries.getInternals), {
        globalProperties: ['$router', '$i18n', '$pinia'],
        hookListenerCounts: { 'app:mounted': 2, 'page:finish': 1 },
    });
});

test('getInternals skips removed hooks left as undefined', async () => {
    setPage(createFakePage({
        patch: () => {
            window.useNuxtApp().hooks._hooks['page:start'] = undefined;
        },
    }));

    assert.deepEqual((await evalInPage(queries.getInternals)).hookListenerCounts, { 'app:mounted': 2, 'page:finish': 1 });
});

test('getDirectives lists directive hooks', async () => {
    assert.deepEqual(await evalInPage(queries.getDirectives), {
        tooltip: { mounted: 'function', updated: 'function' },
        focus: { type: 'function' },
    });
});

test('getComponents names components by their registration and resolves lazy ones', async () => {
    const [, notLoaded, loaded] = await evalInPage(queries.getComponents);

    assert.deepEqual(notLoaded, { name: 'LazyBanner', lazy: true, loaded: false });
    assert.deepEqual(loaded, { name: 'LazyCard', lazy: true, loaded: true, props: { size: { type: 'Number', default: 1 } } });
});

test('getComponents shows prop types by name', async () => {
    const [routerLink] = await evalInPage(queries.getComponents);

    assert.deepEqual(routerLink.props, {
        to: { type: 'String | Object', required: true },
        replace: 'Boolean',
        custom: { validator: 'Function<validator>' },
    });
});

test('getPinia splits stores into state, getters and actions, and makes the state transferable', async () => {
    assert.deepEqual(await evalInPage(queries.getPinia), {
        user: {
            state: { name: 'John', profile: { age: 30, tags: ['admin'], self: '[Circular]' }, visits: { home: 2 } },
            getters: { fullName: 'John Doe' },
            actions: ['logout'],
        },
    });
});

test('getPinia shows errors of app code in place of values, so the other stores still load', async () => {
    setPage(createFakePage({
        patch: () => {
            const stores = window.useNuxtApp().$pinia._s;
            // A getter that fails while the state it needs isn't loaded yet, like a minified "t.map is not a function"
            const $state = { items: {}, owner: { get name() { throw new TypeError('owner is not loaded'); } } };
            stores.set('cart', {
                $id: 'cart',
                $state,
                ...$state,
                get total() {
                    return this.items.map(item => item.price);
                },
                clear() {},
            });
            stores.set('broken', {
                $id: 'broken',
                get $state() {
                    throw new Error('Store is broken');
                },
            });
        },
    }));

    const stores = await evalInPage(queries.getPinia);

    assert.deepEqual(stores.cart, {
        state: { items: {}, owner: { name: '[Error: owner is not loaded]' } },
        getters: { total: '[Error: this.items.map is not a function]' },
        actions: ['clear'],
    });
    assert.deepEqual(stores.broken, { error: '[Error: Store is broken]' });
    assert.deepEqual(stores.user.getters, { fullName: 'John Doe' });
});
