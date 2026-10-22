import { renderCards } from '../cards.js';
import { el } from '../dom.js';
import { createTree } from '../tree.js';

function createSection(title, content) {
    return el('div', { className: 'tree-section' },
        el('div', { className: 'tree-section__title' }, title),
        content,
    );
}

function createStoreBody({ state, getters, actions }) {
    return [
        createSection('state', createTree(state, { expandDepth: 1 })),
        Object.keys(getters).length > 0 && createSection('getters', createTree(getters, { expandDepth: 1 })),
        actions.length > 0 && createSection('actions',
            el('div', { className: 'chips' }, actions.map(action => el('span', { className: 'chip' }, action)))
        ),
    ];
}

export function renderPinia(stores) {
    renderCards(stores, document.getElementById('piniaList'), createStoreBody);
}
