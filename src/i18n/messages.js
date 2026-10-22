import { i18nAstToString, isI18nAstNode } from './ast.js';

// { en: { about: { title: ... } } } -> [{ locale: 'en', path: 'about.title', key: 'en.about.title', value }]
export function flattenI18n(data) {
    const output = [];

    function recurse(locale, obj, current) {
        for (const key in obj) {
            const value = obj[key];
            const path = current ? `${current}.${key}` : key;

            if (value === null || value === undefined) {
                continue;
            }

            if (isI18nAstNode(value)) {
                output.push({ locale, path, key: `${locale}.${path}`, value: i18nAstToString(value) });
            } else if (typeof value === 'object') {
                recurse(locale, value, path);
            } else {
                output.push({ locale, path, key: `${locale}.${path}`, value: String(value) });
            }
        }
    }

    for (const locale in data) {
        recurse(locale, data[locale], '');
    }

    return output;
}

export function filterMessages(messages, query) {
    const normalizedQuery = query.toLowerCase();

    if (normalizedQuery.length === 0) {
        return messages;
    }

    return messages.filter(({ key, value }) => {
        return key.toLowerCase().includes(normalizedQuery) || value.toLowerCase().includes(normalizedQuery)
    });
}

export function countMessagesByLocale(messages) {
    const countByLocale = {};
    messages.forEach(({ locale }) => {
        countByLocale[locale] = (countByLocale[locale] || 0) + 1;
    });

    return countByLocale;
}

// Locales loaded lazily have no messages until the user switches to them, so they can't be compared
export function findMissingTranslations(messages) {
    const keysByLocale = {};
    messages.forEach(({ locale, path }) => {
        (keysByLocale[locale] = keysByLocale[locale] || new Set()).add(path);
    });
    const loadedLocales = Object.keys(keysByLocale);
    const allPaths = [...new Set(messages.map(({ path }) => path))].sort();

    const missing = allPaths
        .map(path => ({ path, missingIn: loadedLocales.filter(locale => !keysByLocale[locale].has(path)) }))
        .filter(({ missingIn }) => missingIn.length > 0);

    return { loadedLocales, missing };
}
