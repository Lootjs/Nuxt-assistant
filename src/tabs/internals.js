import { renderConfigCards } from '../cards.js';
import { createTable, el } from '../dom.js';

export function renderModules(moduleInfos) {
    const modules = {};
    moduleInfos.filter(Boolean).forEach(({ name, ...info }) => {
        modules[name] = info;
    });
    renderConfigCards(modules, document.getElementById('pluginsList'));
}

export function renderHooks(hookListenerCounts) {
    const hooksList = document.getElementById('hooksList');
    hooksList.replaceChildren();

    if (Object.keys(hookListenerCounts).length) {
        hooksList.append(createTable(
            ['Hook', 'Listeners count'],
            Object.entries(hookListenerCounts).map(([hookName, count]) => [hookName, el('span', {}, count)]),
        ));
    }
}

export function renderDirectives(directives) {
    const cards = {};
    Object.entries(directives).forEach(([name, hooks]) => {
        cards[`v-${name}`] = hooks;
    });
    renderConfigCards(cards, document.getElementById('directivesList'));
}
