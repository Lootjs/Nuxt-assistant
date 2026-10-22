import { evalInPage, PageEvalError } from './page/eval.js';
import {
    getBuildId,
    getComponents,
    getDirectives,
    getI18n,
    getInlinePayloadSize,
    getInternals,
    getOverview,
    getPinia,
    getRoutes,
} from './page/queries.js';
import { fetchModuleInfo, getModuleCandidates } from './modules-api.js';
import { openTab, setupNavigation } from './navigation.js';
import { loadSettings, setupSettings } from './settings.js';
import { renderBuildId, renderInlinePayloadSize, renderOverview, resetOverview } from './tabs/overview.js';
import { renderSsrData } from './tabs/ssr-data.js';
import { renderConfigs } from './tabs/configs.js';
import { renderRoutes } from './tabs/routes.js';
import { hideI18n, renderI18n, setupI18nSearch } from './tabs/i18n.js';
import { renderDirectives, renderHooks, renderModules } from './tabs/internals.js';
import { renderComponents } from './tabs/components.js';
import { renderPinia } from './tabs/pinia.js';

// Incremented on every run so that async work from a previous run doesn't render stale data
let currentRunId = 0;

/**
 * Runs a page query and renders its result. Failures in the page are expected (pages without Nuxt,
 * apps without i18n or pinia), so they're logged with console.debug: console.warn would flood
 * the extension's error page in chrome://extensions. Rendering errors are real bugs and are rethrown.
 */
function load(query, render, onFailure) {
    return evalInPage(query).then(render, error => {
        if (!(error instanceof PageEvalError)) {
            throw error;
        }

        console.debug(`[Nuxt Assistant] ${query.name} failed:`, error.message);
        onFailure?.(error);
    });
}

function showNuxtNotFound() {
    const notFound = document.querySelector('.nuxt-not-found');
    notFound.textContent = 'Nuxt is not found! Click here to re-fetch data';
    notFound.onclick = () => runAssistant();
    notFound.style.display = 'block';
}

function hideNuxtNotFound() {
    document.querySelector('.nuxt-not-found').style.display = 'none';
}

function runAssistant() {
    const runId = ++currentRunId;
    const title = document.querySelector('.header__title');
    title.textContent = 'Fetching..';
    setTimeout(() => title.textContent = 'Nuxt Assistant', 300);
    resetOverview();

    load(getBuildId, renderBuildId, () => renderBuildId('N/A'));
    load(getInlinePayloadSize, renderInlinePayloadSize, () => renderInlinePayloadSize(null));

    load(getOverview, overview => {
        hideNuxtNotFound();
        renderOverview(overview);
        renderSsrData(overview.payload);
        renderConfigs(overview.payload);
    }, showNuxtNotFound);

    load(getRoutes, renderRoutes);
    // null means the app simply has no i18n installed
    load(getI18n, i18n => i18n ? renderI18n(i18n) : hideI18n(), hideI18n);

    load(getInternals, async ({ globalProperties, hookListenerCounts }) => {
        const moduleInfos = await Promise.all(getModuleCandidates(globalProperties).map(fetchModuleInfo));

        if (runId !== currentRunId) {
            return;
        }

        renderModules(moduleInfos);
        renderHooks(hookListenerCounts);
    });

    load(getDirectives, renderDirectives);
    load(getComponents, renderComponents);
    load(getPinia, renderPinia);
}

chrome.runtime.onMessage.addListener(message => {
    if (message.type === 'page-navigation' && message.tabId === chrome.devtools.inspectedWindow.tabId) {
        runAssistant();
    }
});

setupNavigation({ onRefresh: runAssistant });
setupI18nSearch();
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
