import { evalInPage, PageEvalError } from './page/eval.js';
import {
    detectNuxt,
    getBuildId,
    getComponents,
    getDirectives,
    getI18n,
    getInlinePayloadSize,
    getInternals,
    getOverview,
    getPayload,
    getPinia,
    getRoutes,
} from './page/queries.js';

const SECTION_QUERIES = {
    buildId: getBuildId,
    inlinePayloadSize: getInlinePayloadSize,
    overview: getOverview,
    payload: getPayload,
    routes: getRoutes,
    i18n: getI18n,
    internals: getInternals,
    directives: getDirectives,
    components: getComponents,
    pinia: getPinia,
};

// Sections that may be absent in an app: their queries return null in that case
const OPTIONAL_SECTIONS = ['i18n', 'pinia'];

/**
 * Collects everything the panel shows from the inspected page. Each section gets a status:
 * - { status: 'ok', data }
 * - { status: 'not-installed' } for an optional feature the app doesn't use
 * - { status: 'error', error } when its query threw in the page
 * Returns { hasNuxt: false } for pages without Nuxt.
 */
export async function collectSnapshot() {
    if (!await isNuxtPage()) {
        return { hasNuxt: false, sections: {} };
    }

    const names = Object.keys(SECTION_QUERIES);
    const results = await Promise.allSettled(names.map(name => evalInPage(SECTION_QUERIES[name])));
    const sections = {};

    results.forEach((result, index) => {
        const name = names[index];

        if (result.status === 'fulfilled') {
            sections[name] = result.value === null && OPTIONAL_SECTIONS.includes(name)
                ? { status: 'not-installed' }
                : { status: 'ok', data: result.value };

            return;
        }

        // Anything but a page exception is a bug in the panel
        if (!(result.reason instanceof PageEvalError)) {
            throw result.reason;
        }

        // Failures are logged with console.debug: console.warn would flood the extension's error page
        console.debug(`[Nuxt Assistant] ${SECTION_QUERIES[name].name} failed:`, result.reason.details);
        sections[name] = { status: 'error', error: result.reason.message };
    });

    return { hasNuxt: true, sections };
}

async function isNuxtPage() {
    try {
        return await evalInPage(detectNuxt);
    } catch (error) {
        // E.g. pages the extension can't access, like chrome:// or the Web Store
        if (error instanceof PageEvalError) {
            return false;
        }

        throw error;
    }
}
