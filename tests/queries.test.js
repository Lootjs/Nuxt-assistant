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
        assert.match(error.message, /useNuxtApp is not a function/);

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

test('getInternals returns global properties and hook listener counts', async () => {
    assert.deepEqual(await evalInPage(queries.getInternals), {
        globalProperties: ['$router', '$i18n', '$pinia'],
        hookListenerCounts: { 'app:mounted': 2, 'page:finish': 1 },
    });
});

test('getDirectives lists directive hooks', async () => {
    assert.deepEqual(await evalInPage(queries.getDirectives), {
        tooltip: { mounted: 'function', updated: 'function' },
        focus: { type: 'function' },
    });
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
