import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { setupPanelDom } from './helpers/panel-dom.js';
import { renderDirectives, renderHooks, renderModules } from '../src/tabs/internals.js';

beforeEach(() => setupPanelDom());

const tableRows = containerId => [...document.querySelectorAll(`#${containerId} tr`)]
    .map(row => [...row.children].map(cell => cell.textContent));

const pinia = {
    name: 'pinia',
    description: 'The Vue Store that you will enjoy using',
    website: 'https://pinia.vuejs.org/',
    category: 'State Management',
    compatibility: { nuxt: '^3.15.0 || ^4.0.0' },
    latestVersion: '1.0.3',
    downloads: 3851597,
    stars: 14744,
};

test('module cards link to nuxt.com and the docs, with compact stats', () => {
    renderModules([null, pinia]);

    const card = document.querySelector('.module-card');
    assert.equal(document.querySelectorAll('.module-card').length, 1);
    assert.equal(card.querySelector('.module-card__header a').textContent, 'pinia');
    assert.equal(card.querySelector('.module-card__header a').href, 'https://nuxt.com/modules/pinia');
    assert.equal(card.querySelector('.chip').textContent, 'State Management');
    assert.equal(card.querySelector('.module-card__description').textContent, 'The Vue Store that you will enjoy using');
    assert.equal(card.querySelector('.module-card__stats').firstChild.textContent,
        'latest v1.0.3 · ★ 14.7K · 3.9M downloads · nuxt ^3.15.0 || ^4.0.0');

    const docs = card.querySelector('.module-card__stats a');
    assert.equal(docs.href, 'https://pinia.vuejs.org/');
    assert.equal(docs.target, '_blank');
    assert.equal(docs.rel, 'noopener noreferrer');
});

test('module cards skip empty stats and links that are not http(s)', () => {
    renderModules([
        { name: 'i18n', downloads: 0, stars: 0, latestVersion: '10.6.0', website: 'javascript:alert(1)' },
        { name: 'other', website: 'data:text/html,<script>alert(1)</script>' },
        { name: 'broken', website: 'not a url' },
    ]);

    const [i18n, other, broken] = document.querySelectorAll('.module-card');
    assert.equal(i18n.querySelector('.module-card__stats').textContent, 'latest v10.6.0');
    for (const card of [i18n, other, broken]) {
        assert.deepEqual([...card.querySelectorAll('a')].map(link => link.href).filter(href => !href.startsWith('https://nuxt.com/')), []);
    }
    assert.equal(i18n.querySelector('.chip'), null);
    assert.equal(i18n.querySelector('.module-card__description'), null);
});

test('modules show a message when none are detected', () => {
    renderModules([null, null]);

    assert.match(document.getElementById('modulesList').textContent, /No modules/);
});

test('directives table lists hooks as chips', () => {
    renderDirectives({ tooltip: { mounted: 'function', updated: 'function' }, focus: { type: 'function' } });

    assert.deepEqual(tableRows('directivesList'), [
        ['Directive', 'Hooks'],
        ['v-tooltip', 'mountedupdated'],
        ['v-focus', 'function directive'],
    ]);
    assert.deepEqual([...document.querySelectorAll('#directivesList .chip')].map(chip => chip.textContent),
        ['mounted', 'updated', 'function directive']);
});

test('hooks table lists listener counts', () => {
    renderHooks({ 'app:mounted': 2, 'page:finish': 1 });

    assert.deepEqual(tableRows('hooksList'), [
        ['Hook', 'Listeners'],
        ['app:mounted', '2'],
        ['page:finish', '1'],
    ]);
});

test('empty directives and hooks show a message instead of a table', () => {
    renderDirectives({});
    renderHooks({});

    assert.equal(document.querySelector('#directivesList table'), null);
    assert.equal(document.getElementById('directivesList').textContent, 'No directives');
    assert.equal(document.getElementById('hooksList').textContent, 'No hooks');
});
