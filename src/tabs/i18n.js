import { el, setText } from '../dom.js';
import { setTabVisible } from '../navigation.js';
import { countMessagesByLocale, filterMessages, findMissingTranslations, flattenI18n } from '../i18n/messages.js';

let messages = [];

const searchInput = () => document.getElementById('i18nMessagesInput');

export function setupI18nSearch() {
    searchInput().addEventListener('input', event => renderMessages(filterMessages(messages, event.target.value)));
}

export function hideI18n() {
    setTabVisible('i18n', false);
}

export function renderI18n({ activeLocale, defaultLocale, browserLocale, locales, messages: rawMessages }) {
    messages = flattenI18n(rawMessages);

    setTabVisible('i18n', true);
    setText('currentLocale', activeLocale);
    setText('defaultLocale', defaultLocale);
    setText('browserLocale', browserLocale);
    setText('i18nLocalesList', `Available locales: ${locales.join(', ')}`);

    const localeCounts = Object.entries(countMessagesByLocale(messages))
        .map(([locale, count]) => `${locale}: ${count}`)
        .join(', ');
    setText('messagesTotal', `Messages total: ${messages.length}${localeCounts ? ` (${localeCounts})` : ''}`);

    renderMissingTranslations(locales);
    // Re-applies the current search query to the new messages
    searchInput().dispatchEvent(new Event('input'));
}

function renderMessages(shownMessages) {
    document.getElementById('i18nMessagesList').replaceChildren(el('div', {}, shownMessages.map(({ key, value }) =>
        el('div', { className: 'i18nItem' },
            el('span', { className: 'i18nItem__key' }, key),
            el('span', { className: 'i18nItem__value' }, value),
        )
    )));
}

function renderMissingTranslations(locales) {
    const { loadedLocales, missing } = findMissingTranslations(messages);
    const notLoadedLocales = locales.filter(locale => !loadedLocales.includes(locale));
    const list = document.getElementById('i18nMissingList');
    list.replaceChildren();

    const notLoadedNote = notLoadedLocales.length
        ? `. Not loaded yet (lazy loading): ${notLoadedLocales.join(', ')}`
        : '';

    if (loadedLocales.length < 2) {
        setText('missingTotal', `At least two loaded locales are needed to compare${notLoadedNote}`);

        return;
    }

    setText('missingTotal', missing.length
        ? `${missing.length} keys are missing in some of the loaded locales${notLoadedNote}`
        : `All keys are translated in ${loadedLocales.join(', ')}${notLoadedNote}`);

    const showTranslations = (path) => {
        const input = searchInput();
        input.value = path;
        input.dispatchEvent(new Event('input'));
        input.scrollIntoView({ behavior: 'smooth' });
    };

    for (const { path, missingIn } of missing) {
        list.append(el('div', {
                className: 'i18nMissingItem',
                title: 'Show the existing translations',
                onClick: () => showTranslations(path),
            },
            el('span', { className: 'i18nMissingItem__key' }, path),
            el('span', { className: 'i18nMissingItem__locales' }, `missing in: ${missingIn.join(', ')}`),
        ));
    }
}
