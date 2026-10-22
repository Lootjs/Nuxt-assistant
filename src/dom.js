/**
 * Creates an element, e.g. el('div', { className: 'card', onClick: handler }, 'text', childElement)
 * - className accepts an array, falsy items are skipped: ['item', isActive && 'item--active']
 * - on* props are added as event listeners, the rest are assigned as element properties
 * - string children are inserted as text, never as HTML; null, undefined and false are skipped
 */
export function el(tag, props = {}, ...children) {
    const element = document.createElement(tag);

    for (const [name, value] of Object.entries(props)) {
        if (value === undefined || value === null) {
            continue;
        }

        if (name === 'className' && Array.isArray(value)) {
            element.className = value.filter(Boolean).join(' ');
        } else if (name.startsWith('on')) {
            element.addEventListener(name.slice(2).toLowerCase(), value);
        } else {
            element[name] = value;
        }
    }

    // Appended one by one: spreading thousands of i18n rows into append() may exceed the arguments limit
    for (const child of children.flat()) {
        if (child !== null && child !== undefined && child !== false) {
            element.append(child);
        }
    }

    return element;
}

export function createTable(headings, rows) {
    return el('table', { className: 'internals' },
        el('thead', {}, el('tr', {}, headings.map(heading => el('th', {}, heading)))),
        el('tbody', {}, rows.map(cells => el('tr', {}, cells.map(cell => el('td', {}, cell))))),
    );
}

export function setText(id, text) {
    document.getElementById(id).textContent = text;
}
