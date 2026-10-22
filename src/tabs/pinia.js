import { renderConfigCards } from '../cards.js';

export function renderPinia(stores) {
    renderConfigCards(stores, document.getElementById('piniaList'));
}
