import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import { collectSnapshot } from '../src/snapshot.js';
import { createFakePage, installChromeStub } from './helpers/fake-page.js';

let setPage;

before(() => {
    // Expected page failures are logged with console.debug
    console.debug = () => {};
    ({ setPage } = installChromeStub(createFakePage()));
});

test('every section loads from a healthy page', async () => {
    const { hasNuxt, sections } = await collectSnapshot();

    assert.equal(hasNuxt, true);
    assert.deepEqual(Object.entries(sections).filter(([, { status }]) => status !== 'ok'), []);
    assert.equal(sections.buildId.data, 'build-1');
    assert.equal(sections.routes.data.length, 2);
});

test('a broken section fails alone', async () => {
    setPage(createFakePage({
        patch: () => {
            window.useNuxtApp().$router.getRoutes = () => {
                throw new Error('Router is broken');
            };
        },
    }));

    const { sections } = await collectSnapshot();

    assert.equal(sections.routes.status, 'error');
    assert.match(sections.routes.error, /Router is broken/);
    assert.equal(sections.overview.status, 'ok');
    assert.equal(sections.components.status, 'ok');
});

test('a payload that can\'t be serialized doesn\'t break the overview', async () => {
    setPage(createFakePage({
        patch: () => {
            const payload = window.useNuxtApp().payload;
            payload.data.circular = payload;
        },
    }));

    const { sections } = await collectSnapshot();

    assert.equal(sections.payload.status, 'error');
    assert.match(sections.payload.error, /circular/i);
    assert.equal(sections.overview.status, 'ok');
    assert.equal(sections.overview.data.versions.nuxt, '4.5.2');
});

test('optional features that aren\'t installed', async () => {
    setPage(createFakePage({
        patch: () => {
            delete window.useNuxtApp().$i18n;
            delete window.useNuxtApp().$pinia;
        },
    }));

    const { sections } = await collectSnapshot();

    assert.deepEqual(sections.i18n, { status: 'not-installed' });
    assert.deepEqual(sections.pinia, { status: 'not-installed' });
});

test('a page without Nuxt', async () => {
    setPage(createFakePage({ withNuxt: false }));

    assert.deepEqual(await collectSnapshot(), { hasNuxt: false, sections: {} });
});
