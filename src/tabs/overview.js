import { setText } from '../dom.js';
import { formatBytes } from '../format.js';
import { setTabVisible } from '../navigation.js';

export function resetOverview() {
    document.querySelectorAll('#i18n-included img, #pinia-included img')
        .forEach(image => image.style.display = 'none');
}

export function renderBuildId(buildId) {
    setText('buildId', buildId);
}

export function renderInlinePayloadSize(size) {
    setText('payload-size', size === null || size === undefined ? 'N/A' : formatBytes(size));
}

export function renderOverview({ versions, payload, i18nIncluded, piniaInstalled }) {
    let renderingMode = 'SPA';
    if (payload.prerenderedAt) {
        renderingMode = 'SSG';
    } else if (payload.serverRendered) {
        renderingMode = 'SSR';
    }
    setText('rendering-mode', renderingMode);

    document.getElementById(`i18n-${i18nIncluded ? 'true' : 'false'}`).style.display = 'block';
    document.getElementById(`pinia-${piniaInstalled ? 'true' : 'false'}`).style.display = 'block';
    setTabVisible('pinia', piniaInstalled);

    setText('nuxt-version', versions.nuxt);
    setText('vue-version', versions.vue);
}
