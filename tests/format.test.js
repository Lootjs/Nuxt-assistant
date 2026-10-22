import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatBytes } from '../src/format.js';

test('formats byte sizes', () => {
    assert.equal(formatBytes(0), '0 B');
    assert.equal(formatBytes(1023), '1023 B');
    assert.equal(formatBytes(1536), '1.5 KB');
    assert.equal(formatBytes(3 * 1024 * 1024), '3.00 MB');
});
