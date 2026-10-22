import { el, setText } from '../dom.js';
import { formatBytes } from '../format.js';
import { sectionValue } from '../sections.js';
import { createWidget, setFlag } from '../widgets.js';

const WIDGET_ROWS = [
    [
        { id: 'nuxt-version', name: 'Version', icon: './images/icon-nuxt.svg', iconAlt: 'nuxt logo', covered: false },
        { id: 'vue-version', name: 'Version', icon: './images/icon-vue.svg', iconAlt: 'vue logo', covered: false },
        { id: 'i18n-included', name: 'I18n', icon: './images/icon-i18n.svg', flag: true },
        { id: 'pinia-included', name: 'Pinia', icon: './images/sidebar-crystal.svg', flag: true },
    ],
    [
        { id: 'rendering-mode', name: 'Rendering', icon: './images/icon-overview.svg' },
        { id: 'routes-count', name: 'Routes', icon: './images/icon-router.svg', tab: 'routes' },
        { id: 'ssr-requests-count', name: 'SSR requests', icon: './images/icon-ssr.svg', tab: 'ssrData' },
        {
            id: 'payload-size',
            name: 'Inline payload',
            icon: './images/icon-ssr.svg',
            tab: 'ssrData',
            title: 'Size of the payload inlined into the HTML (__NUXT_DATA__)',
        },
        { id: 'components-count', name: 'Global components', icon: './images/sidebar-crystal.svg', tab: 'components' },
    ],
];

export function setupOverview() {
    document.getElementById('overviewWidgets').replaceChildren(
        ...WIDGET_ROWS.map(row => el('div', { className: 'widgets' }, row.map(createWidget)))
    );
}

export function clearOverview() {
    setText('buildId', '');

    for (const widget of WIDGET_ROWS.flat()) {
        if (widget.flag) {
            setFlag(widget.id, undefined);
        } else {
            setText(widget.id, '');
        }
    }
}

function getRenderingMode({ prerenderedAt, serverRendered }) {
    if (prerenderedAt) {
        return 'SSG';
    }

    return serverRendered ? 'SSR' : 'SPA';
}

// The Overview summarizes the whole snapshot, so it gets all the sections
export function renderOverview(sections) {
    const overview = sections.overview.status === 'ok' ? sections.overview.data : null;

    setText('buildId', sectionValue(sections.buildId, buildId => buildId));
    setText('nuxt-version', overview ? overview.versions.nuxt : 'N/A');
    setText('vue-version', overview ? overview.versions.vue : 'N/A');
    setText('rendering-mode', overview ? getRenderingMode(overview) : 'N/A');
    setFlag('i18n-included', overview?.i18nIncluded);
    setFlag('pinia-included', overview?.piniaInstalled);

    setText('routes-count', sectionValue(sections.routes, routes => routes.length));
    setText('ssr-requests-count', sectionValue(sections.payload, payload => Object.keys(payload.data || {}).length));
    setText('payload-size', sectionValue(sections.inlinePayloadSize, size => size === null ? 'N/A' : formatBytes(size)));
    setText('components-count', sectionValue(sections.components, components => components.length));
}
