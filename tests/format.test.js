import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatBytes, formatListValue, jsonSyntaxHighlight, normalizeResponse } from '../src/format.js';

test('formats byte sizes', () => {
    assert.equal(formatBytes(0), '0 B');
    assert.equal(formatBytes(1023), '1023 B');
    assert.equal(formatBytes(1536), '1.5 KB');
    assert.equal(formatBytes(3 * 1024 * 1024), '3.00 MB');
});

test('formats list values', () => {
    assert.equal(formatListValue(''), '""');
    assert.equal(formatListValue(true), 'Boolean<true>');
    assert.equal(formatListValue(null), 'null');
    assert.equal(formatListValue({}), '{}');
    assert.equal(formatListValue(0), '0');
    assert.equal(formatListValue('text'), 'text');
});

test('highlights JSON and escapes HTML in it', () => {
    const html = jsonSyntaxHighlight(JSON.stringify({ key: '<img src=x onerror=alert(1)>', n: 1, b: true, z: null }));

    assert.ok(!html.includes('<img'));
    assert.ok(html.includes('&lt;img'));
    assert.ok(html.includes('<span class="json__key">"key":</span>'));
    assert.ok(html.includes('<span class="json__number">1</span>'));
    assert.ok(html.includes('<span class="json__boolean">true</span>'));
    assert.ok(html.includes('<span class="json__null">null</span>'));
});

test('hides values nested deeper than the limit in array responses', () => {
    // Item is depth 0, so values at depth 3 (c, list[0]) get hidden
    const response = [{ a: { b: { c: { d: 1 } }, list: [[[1, 2]]] } }];

    assert.deepEqual(normalizeResponse(response), [{ a: { b: { c: 'hidden-object[1]' }, list: ['hidden-array[1]'] } }]);
});

test("doesn't change the response itself", () => {
    const response = [{ a: { b: { c: { d: 1 } } } }];
    const copy = structuredClone(response);
    normalizeResponse(response);

    assert.deepEqual(response, copy);
});

test('leaves non-array responses as they are', () => {
    const response = { a: { b: { c: { d: 1 } } } };

    assert.equal(normalizeResponse(response), response);
});
