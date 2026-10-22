import { renderConfigCards } from '../cards.js';
import { setText } from '../dom.js';

export function renderComponents(components) {
    setText('components-subtitle',
        `Globally registered components: ${components.length}. Auto-imported components of the project are not listed`);
    setText('components-count', components.length);

    const cards = {};
    components.forEach(component => {
        cards[`<${component.name}>`] = component;
    });
    renderConfigCards(cards, document.getElementById('componentsList'));
}
