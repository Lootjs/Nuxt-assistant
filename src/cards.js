import { el } from './dom.js';
import { formatListValue } from './format.js';

export function createList(data) {
    return el('ul', {}, Object.keys(data).map(key => {
        const value = data[key];
        const isNested = typeof value === "object" && value !== null && Object.keys(value).length > 0;

        return el('li', {},
            el('span', { className: 'silent' }, `${key}: `),
            isNested
                ? createList(value)
                : el('span', { className: 'item-value' }, formatListValue(value)),
        );
    }));
}

function isEmptyCard(value) {
    return typeof value !== 'object' || value === null || Object.keys(value).length === 0;
}

// Renders a card per key into the container, replacing its content. Empty and non-object values are skipped.
// createBody(value, key) creates the card content, e.g. a JSON tree for data of unknown shape
export function renderCustomCards(items, container, createBody) {
    container.replaceChildren();

    for (const key in items) {
        if (isEmptyCard(items[key])) {
            continue;
        }

        container.append(el('div', { className: 'tabbed-card' },
            el('div', { className: 'tabbed-card__header' }, key),
            el('div', { className: 'tabbed-card__body' }, createBody(items[key], key)),
        ));
    }
}

// Cards with a key-value list of the value
export function renderConfigCards(configs, container) {
    renderCustomCards(configs, container, createList);
}
