import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { setupPanelDom } from './helpers/panel-dom.js';
import { createTree } from '../src/tree.js';
import { settings } from '../src/settings.js';

let window;

beforeEach(() => {
    window = setupPanelDom();
    settings.responseThreshold = 20;
});

// Top-level entries of a tree: rows for primitives, details for objects
const topEntries = tree => [...tree.querySelectorAll(':scope > .tree__children > .tree__row, :scope > .tree__children > details')];
const rootMoreButton = tree => tree.querySelector(':scope > .tree__children > .tree__more');

function expand(node) {
    node.open = true;
    node.dispatchEvent(new window.Event('toggle'));
}

test('renders primitives with their type classes', () => {
    const tree = createTree({ text: 'Life', count: 40, isActive: true, code: null, empty: '', list: [], object: {} });
    const values = Object.fromEntries(topEntries(tree).map(row => [
        row.querySelector('.json__key').textContent,
        [row.lastElementChild.className, row.lastElementChild.textContent],
    ]));

    assert.deepEqual(values, {
        'text: ': ['json__string', '"Life"'],
        'count: ': ['json__number', '40'],
        'isActive: ': ['json__boolean', 'true'],
        'code: ': ['json__null', 'null'],
        'empty: ': ['json__string', '""'],
        'list: ': ['tree__preview', '[]'],
        'object: ': ['tree__preview', '{}'],
    });
});

test('inserts strings as text and marks them for right-to-left content', () => {
    const tree = createTree({ html: '<img src=x onerror=alert(1)>', arabic: 'مرحبا 123' });

    assert.equal(tree.querySelector('img'), null);
    assert.ok([...tree.querySelectorAll('.json__string')].every(value => value.dir === 'auto'));
});

test('renders a primitive root', () => {
    assert.equal(createTree('text').textContent, '"text"');
    assert.equal(createTree(5).textContent, '5');
    assert.equal(createTree({}).textContent, '{}');
});

test('shows a one-line preview of collapsed objects and arrays', () => {
    const tree = createTree({
        item: { categoryCode: 40, categoryName: 'Life Critical', nested: { a: 1 }, extra: true },
        list: [1, 'two', { three: 3 }],
        long: [{ title: 'A very long title that goes on and on' }],
    });
    const summaries = [...tree.querySelectorAll('summary')].map(summary => summary.textContent);

    assert.deepEqual(summaries, [
        'item: {categoryCode: 40, categoryName: "Life Critical", nested: {…}, …}',
        'list: (3) [1, "two", {…}]',
        'long: (1) [{…}]',
    ]);

    expand(tree.querySelector('details:last-of-type'));
    assert.equal(tree.querySelector('details:last-of-type details summary').textContent,
        '0: {title: "A very long title that goes on…"}');
});

test('renders nested values on the first expand only', () => {
    const tree = createTree({ item: { a: 1, b: { c: 2 } } });
    const node = tree.querySelector('details');

    assert.equal(node.querySelectorAll('.tree__row').length, 0);

    expand(node);
    assert.equal(node.querySelectorAll(':scope > .tree__children > .tree__row').length, 1);

    node.open = false;
    node.dispatchEvent(new window.Event('toggle'));
    expand(node);
    assert.equal(node.querySelectorAll(':scope > .tree__children').length, 1);
});

test('expands the given number of levels initially', () => {
    const tree = createTree({ public: { a: 1, nested: { b: 2 } } }, { expandDepth: 1 });

    assert.equal(tree.querySelectorAll('details[open]').length, 1);
    assert.deepEqual([...tree.querySelectorAll('.tree__row')].map(row => row.textContent), ['a: 1']);
});

test('shows big lists page by page', () => {
    settings.responseThreshold = 2;
    const tree = createTree([1, 2, 3, 4, 5]);

    assert.equal(topEntries(tree).length, 2);
    assert.equal(rootMoreButton(tree).textContent, 'Show 2 more of 3');

    rootMoreButton(tree).click();
    assert.equal(topEntries(tree).length, 4);
    assert.equal(rootMoreButton(tree).textContent, 'Show 1 more of 1');

    rootMoreButton(tree).click();
    assert.deepEqual(topEntries(tree).map(row => row.textContent), ['0: 1', '1: 2', '2: 3', '3: 4', '4: 5']);
    assert.equal(rootMoreButton(tree), null);
});

test('renders a huge list without rendering every item', () => {
    const tree = createTree(Array.from({ length: 100000 }, (_, index) => ({ index })));

    assert.equal(topEntries(tree).length, 20);
    assert.equal(rootMoreButton(tree).textContent, 'Show 20 more of 99980');
});
