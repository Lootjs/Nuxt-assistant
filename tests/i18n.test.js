import { test } from 'node:test';
import assert from 'node:assert/strict';
import { i18nAstToString, isI18nAstNode } from '../src/i18n/ast.js';
import {
    countMessagesByLocale,
    filterMessages,
    findMissingTranslations,
    flattenI18n,
} from '../src/i18n/messages.js';

// Minified AST, as vue-i18n ships it in production
const minified = {
    static: { t: 0, b: { t: 2, s: 'Hello world', i: [{ t: 3, v: 'Hello world' }] } },
    named: { t: 0, b: { t: 2, i: [{ t: 3, v: 'Hello ' }, { t: 4, k: 'name' }, { t: 3, v: '!' }] } },
    list: { t: 0, b: { t: 2, i: [{ t: 3, v: 'Item ' }, { t: 5, i: 0 }] } },
    plural: { t: 0, b: { t: 1, c: [{ t: 2, s: 'no apples' }, { t: 2, i: [{ t: 4, k: 'n' }, { t: 3, v: ' apples' }] }] } },
    linked: { t: 0, b: { t: 2, i: [{ t: 6, m: { t: 8, v: 'lower' }, k: { t: 7, v: 'common.title' } }] } },
    literal: { t: 0, b: { t: 2, i: [{ t: 9, v: '@' }] } },
};

test('restores sources of minified messages', () => {
    assert.equal(i18nAstToString(minified.static), 'Hello world');
    assert.equal(i18nAstToString(minified.named), 'Hello {name}!');
    assert.equal(i18nAstToString(minified.list), 'Item {0}');
    assert.equal(i18nAstToString(minified.plural), 'no apples | {n} apples');
    assert.equal(i18nAstToString(minified.linked), '@.lower:common.title');
    assert.equal(i18nAstToString(minified.literal), "{'@'}");
});

test('restores sources of non-minified messages', () => {
    const message = { type: 0, body: { type: 2, items: [{ type: 3, value: 'Hi ' }, { type: 4, key: 'name' }] } };

    assert.equal(i18nAstToString(message), 'Hi {name}');
    assert.equal(i18nAstToString({ type: 0, body: { type: 2, static: 'Static', items: [] } }), 'Static');
});

test('tells AST nodes from nested message groups', () => {
    assert.ok(isI18nAstNode(minified.static));
    assert.ok(isI18nAstNode({ type: 0, body: {} }));
    assert.ok(!isI18nAstNode({ title: 'x' }));
    assert.ok(!isI18nAstNode(null));
    assert.ok(!isI18nAstNode('string'));
});

test('flattens nested messages and skips null values', () => {
    const flat = flattenI18n({
        en: { about: { title: minified.static, count: 5 }, empty: null, plain: 'text' },
    });

    assert.deepEqual(flat, [
        { locale: 'en', path: 'about.title', key: 'en.about.title', value: 'Hello world' },
        { locale: 'en', path: 'about.count', key: 'en.about.count', value: '5' },
        { locale: 'en', path: 'plain', key: 'en.plain', value: 'text' },
    ]);
});

test('filters messages by key or value, case-insensitively', () => {
    const messages = flattenI18n({ en: { title: 'Hello', other: 'World' } });

    assert.deepEqual(filterMessages(messages, 'HELLO').map(({ key }) => key), ['en.title']);
    assert.deepEqual(filterMessages(messages, 'OTHER').map(({ key }) => key), ['en.other']);
    assert.equal(filterMessages(messages, ''), messages);
});

test('counts messages per locale', () => {
    const messages = flattenI18n({ en: { a: 'a', b: 'b' }, ar: { a: 'a' } });

    assert.deepEqual(countMessagesByLocale(messages), { en: 2, ar: 1 });
});

test('finds keys missing in some of the loaded locales', () => {
    const messages = flattenI18n({
        en: { shared: 'x', onlyEn: 'x' },
        ar: { shared: 'x', onlyAr: 'x' },
        fr: {}, // lazy locale that isn't loaded yet
    });

    assert.deepEqual(findMissingTranslations(messages), {
        loadedLocales: ['en', 'ar'],
        missing: [
            { path: 'onlyAr', missingIn: ['en'] },
            { path: 'onlyEn', missingIn: ['ar'] },
        ],
    });
});
