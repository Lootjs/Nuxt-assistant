import { el } from './dom.js';
import { settings } from './settings.js';

const PREVIEW_ENTRIES = 3;
const PREVIEW_STRING_LENGTH = 30;

function isExpandable(value) {
    return typeof value === 'object' && value !== null && Object.keys(value).length > 0;
}

function createPrimitive(value) {
    if (value === null || value === undefined) {
        return el('span', { className: 'json__null' }, String(value));
    }

    if (typeof value === 'string') {
        return el('span', { className: 'json__string', dir: 'auto' }, JSON.stringify(value));
    }

    if (typeof value === 'object') {
        return el('span', { className: 'tree__preview' }, Array.isArray(value) ? '[]' : '{}');
    }

    return el('span', { className: `json__${typeof value}` }, String(value));
}

function shortValue(value) {
    if (Array.isArray(value)) {
        return value.length ? `Array(${value.length})` : '[]';
    }

    if (typeof value === 'object' && value !== null) {
        return Object.keys(value).length ? '{…}' : '{}';
    }

    if (typeof value === 'string') {
        return JSON.stringify(value.length > PREVIEW_STRING_LENGTH ? `${value.slice(0, PREVIEW_STRING_LENGTH)}…` : value);
    }

    return String(value);
}

// One-line summary of a collapsed value, like in the DevTools console: {id: 1, name: "Life", …}
function preview(value) {
    const entries = Object.entries(value);
    const shown = entries.slice(0, PREVIEW_ENTRIES)
        .map(([key, item]) => Array.isArray(value) ? shortValue(item) : `${key}: ${shortValue(item)}`);
    const rest = entries.length > PREVIEW_ENTRIES ? ', …' : '';

    return Array.isArray(value)
        ? `(${entries.length}) [${shown.join(', ')}${rest}]`
        : `{${shown.join(', ')}${rest}}`;
}

/**
 * Renders entries page by page: big arrays and objects show settings.responseThreshold items
 * and a "Show more" button, so a huge response doesn't freeze the panel
 */
function createChildren(value, depth, expandDepth) {
    const entries = Object.entries(value);
    const container = el('div', { className: 'tree__children' });
    let shownCount = 0;

    const moreButton = el('button', {
        className: ['button', 'tree__more'],
        onClick: () => showMore(),
    });

    function showMore() {
        const pageSize = Math.max(1, settings.responseThreshold);
        const page = entries.slice(shownCount, shownCount + pageSize);
        shownCount += page.length;
        page.forEach(([key, item]) => moreButton.before(createEntry(key, item, depth, expandDepth)));

        const restCount = entries.length - shownCount;
        if (restCount > 0) {
            moreButton.textContent = `Show ${Math.min(pageSize, restCount)} more of ${restCount}`;
        } else {
            moreButton.remove();
        }
    }

    container.append(moreButton);
    showMore();

    return container;
}

function createEntry(key, value, depth, expandDepth) {
    const label = el('span', { className: 'json__key' }, `${key}: `);

    if (!isExpandable(value)) {
        return el('div', { className: 'tree__row' }, label, createPrimitive(value));
    }

    const node = el('details', { className: 'tree__node' },
        el('summary', {}, label, el('span', { className: 'tree__preview' }, preview(value))),
    );

    // Children are rendered on the first expand only: a payload may have thousands of nested values
    let isRendered = false;
    const renderChildren = () => {
        if (!isRendered && node.open) {
            isRendered = true;
            node.append(createChildren(value, depth + 1, expandDepth));
        }
    };
    node.addEventListener('toggle', renderChildren);

    if (depth < expandDepth) {
        node.open = true;
        renderChildren();
    }

    return node;
}

/**
 * Collapsible tree of a JSON-like value (objects, arrays, primitives) for data of unknown shape.
 * expandDepth: how many levels of nested objects are expanded initially
 */
export function createTree(value, { expandDepth = 0 } = {}) {
    return el('div', { className: 'tree' },
        isExpandable(value)
            ? createChildren(value, 0, expandDepth)
            : el('div', { className: 'tree__row' }, createPrimitive(value)),
    );
}
