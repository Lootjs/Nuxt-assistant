import { collectSnapshot } from './snapshot.js';
import { renderSection } from './sections.js';
import { fetchModuleInfo, getModuleCandidates } from './modules-api.js';
import { openTab, setTabVisible, setupNavigation } from './navigation.js';
import { loadSettings, setupSettings } from './settings.js';
import { clearOverview, renderOverview, setupOverview } from './tabs/overview.js';
import { renderSsrData } from './tabs/ssr-data.js';
import { renderConfigs } from './tabs/configs.js';
import { renderRoutes } from './tabs/routes.js';
import { clearI18n, renderI18n, setupI18n } from './tabs/i18n.js';
import { renderDirectives, renderHooks, renderModules } from './tabs/internals.js';
import { renderComponents } from './tabs/components.js';
import { renderPinia } from './tabs/pinia.js';

// Incremented on every run so that async work from a previous run doesn't render stale data
let currentRunId = 0;

function setNuxtNotFoundVisible(isVisible) {
    document.querySelector('.nuxt-not-found').hidden = !isVisible;
}

// Removes data of the previous page, so it isn't shown for a page without Nuxt
function clearPageContent() {
    document.querySelectorAll('[data-page-content]').forEach(element => element.replaceChildren());
    clearOverview();
    clearI18n();
}

// Optional tabs (i18n, Pinia) are hidden when the app doesn't use the feature, but stay visible on a load error
function renderSnapshot(sections) {
    renderOverview(sections);

    renderSection(sections.payload, payload => {
        renderSsrData(payload);
        renderConfigs(payload);
    }, { errorContainers: ['ssrRequestsList', 'configList'] });

    renderSection(sections.routes, renderRoutes, { errorContainers: ['routesList'] });

    renderSection(sections.i18n, i18n => {
        setTabVisible('i18n', true);
        renderI18n(i18n);
    }, {
        errorContainers: ['i18nMessagesList'],
        onNotInstalled: () => setTabVisible('i18n', false),
        onError: () => {
            setTabVisible('i18n', true);
            clearI18n();
        },
    });

    renderSection(sections.internals, ({ hookListenerCounts }) => renderHooks(hookListenerCounts), {
        errorContainers: ['modulesList', 'hooksList'],
    });
    renderSection(sections.directives, renderDirectives, { errorContainers: ['directivesList'] });
    renderSection(sections.components, renderComponents, { errorContainers: ['componentsList'] });

    renderSection(sections.pinia, stores => {
        setTabVisible('pinia', true);
        renderPinia(stores);
    }, {
        errorContainers: ['piniaList'],
        onNotInstalled: () => setTabVisible('pinia', false),
        onError: () => setTabVisible('pinia', true),
    });
}

// Module info comes from the network, so it's rendered after the rest of the panel
async function loadModules(sections, runId) {
    if (sections.internals.status !== 'ok') {
        return;
    }

    const candidates = getModuleCandidates(sections.internals.data.globalProperties);
    const moduleInfos = await Promise.all(candidates.map(fetchModuleInfo));

    if (runId === currentRunId) {
        renderModules(moduleInfos);
    }
}

async function runAssistant() {
    const runId = ++currentRunId;
    const title = document.querySelector('.header__title');
    title.textContent = 'Fetching..';

    try {
        const { hasNuxt, sections } = await collectSnapshot();

        if (runId !== currentRunId) {
            return;
        }

        setNuxtNotFoundVisible(!hasNuxt);

        if (!hasNuxt) {
            clearPageContent();

            return;
        }

        renderSnapshot(sections);
        await loadModules(sections, runId);
    } finally {
        if (runId === currentRunId) {
            title.textContent = 'Nuxt Assistant';
        }
    }
}

chrome.runtime.onMessage.addListener(message => {
    if (message.type === 'page-navigation' && message.tabId === chrome.devtools.inspectedWindow.tabId) {
        runAssistant();
    }
});

setupNavigation({ onRefresh: runAssistant });
document.querySelector('.nuxt-not-found').addEventListener('click', () => runAssistant());
setupOverview();
setupI18n();
setupSettings({
    onSave: () => {
        runAssistant();
        openTab('common');
    },
});

document.getElementById('support-me').addEventListener('click', () => {
    chrome.runtime.sendMessage({ event: 'supportMe' });
});

loadSettings().then(runAssistant);
