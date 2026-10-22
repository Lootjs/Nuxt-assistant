import { renderCustomCards } from '../cards.js';
import { createTree } from '../tree.js';

export function renderConfigs(payload) {
    renderCustomCards({
        ...payload.config,
        state: payload.state,
    }, document.getElementById('configList'), config => createTree(config, { expandDepth: 1 }));
}
