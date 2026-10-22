import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatBytes, formatListValue } from '../src/format.js';

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
