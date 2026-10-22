import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { createTable, el } from '../src/dom.js';
import { setupPanelDom } from './helpers/panel-dom.js';

beforeEach(() => setupPanelDom());

test('el sets props, skips empty classes and inserts strings as text', () => {
    const element = el('div', { className: ['a', false && 'b', 'c'], title: 't', hidden: undefined },
        '<img src=x onerror=alert(1)>', 0, null, false, ['x', el('b', {}, 'y')],
    );

    assert.equal(element.outerHTML, '<div class="a c" title="t">&lt;img src=x onerror=alert(1)&gt;0x<b>y</b></div>');
});

test('el adds on* props as event listeners', () => {
    let clicks = 0;
    const button = el('button', { onClick: () => clicks++ });
    button.click();

    assert.equal(clicks, 1);
});

test('el appends huge child lists', () => {
    const rows = Array.from({ length: 200000 }, (_, i) => el('span', {}, i));

    assert.equal(el('div', {}, rows).childElementCount, 200000);
});

test('createTable builds headings and rows', () => {
    const table = createTable(['Hook', 'Count'], [['app:mounted', el('span', {}, 2)]]);

    assert.equal(table.outerHTML,
        '<table class="internals"><thead><tr><th>Hook</th><th>Count</th></tr></thead>' +
        '<tbody><tr><td>app:mounted</td><td><span>2</span></td></tr></tbody></table>');
});
