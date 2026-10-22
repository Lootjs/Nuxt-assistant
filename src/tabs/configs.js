import { renderConfigCards } from '../cards.js';

export function renderConfigs(payload) {
    renderConfigCards({
        ...payload.config,
        state: payload.state,
    }, document.getElementById('configList'));
}
