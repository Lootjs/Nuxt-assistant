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

// Renders a card per key into the container, replacing its content. Empty and non-object values are skipped
export function renderConfigCards(configs, container) {
    container.replaceChildren();

    for (const key in configs) {
        const config = configs[key];
        if (typeof config !== 'object' || config === null || Object.keys(config).length === 0) {
            continue;
        }

        container.append(el('div', { className: 'tabbed-card' },
            el('div', { className: 'tabbed-card__header' }, key),
            el('div', { className: 'tabbed-card__body' }, createList(config)),
        ));
    }
}
