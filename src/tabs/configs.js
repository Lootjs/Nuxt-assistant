import { renderCards } from '../cards.js';
import { createTree } from '../tree.js';

export function renderConfigs(payload) {
    renderCards({
        ...payload.config,
        state: payload.state,
    }, document.getElementById('configList'), config => createTree(config, { expandDepth: 1 }));
}
