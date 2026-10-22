import { createTable, el } from '../dom.js';

const compactNumber = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });

function createLink(href, text) {
    return el('a', { href, target: '_blank', rel: 'noopener noreferrer' }, text);
}

// The website comes from the modules API: only http(s) links are allowed, never javascript: or data:
function isWebUrl(url) {
    try {
        return ['http:', 'https:'].includes(new URL(url).protocol);
    } catch (error) {
        return false;
    }
}

function createModuleCard(module) {
    const stats = [
        module.latestVersion && `latest v${module.latestVersion}`,
        module.stars > 0 && `★ ${compactNumber.format(module.stars)}`,
        module.downloads > 0 && `${compactNumber.format(module.downloads)} downloads`,
        module.compatibility?.nuxt && `nuxt ${module.compatibility.nuxt}`,
    ].filter(Boolean);

    return el('div', { className: 'module-card' },
        el('div', { className: 'module-card__header' },
            createLink(`https://nuxt.com/modules/${encodeURIComponent(module.name)}`, module.name),
            module.category && el('span', { className: 'chip' }, module.category),
        ),
        module.description && el('div', { className: 'module-card__description' }, module.description),
        el('div', { className: 'module-card__stats' },
            stats.join(' · '),
            isWebUrl(module.website) && createLink(module.website, 'docs'),
        ),
    );
}

export function renderModules(moduleInfos) {
    const modules = moduleInfos.filter(Boolean);

    document.getElementById('modulesList').replaceChildren(
        ...(modules.length > 0
            ? modules.map(createModuleCard)
            : [el('div', { className: 'silent' }, 'No modules from the Nuxt modules catalog were detected')])
    );
}

function renderTable(containerId, headings, rows, emptyText) {
    document.getElementById(containerId).replaceChildren(
        rows.length > 0 ? createTable(headings, rows) : el('div', { className: 'silent' }, emptyText)
    );
}

export function renderHooks(hookListenerCounts) {
    renderTable('hooksList', ['Hook', 'Listeners'],
        Object.entries(hookListenerCounts).map(([hookName, count]) => [hookName, String(count)]),
        'No hooks');
}

// getDirectives() gives { name: { hook: 'function' } }, or { type: 'function' } for a function directive
export function renderDirectives(directives) {
    renderTable('directivesList', ['Directive', 'Hooks'],
        Object.entries(directives).map(([name, hooks]) => {
            const isFunctionDirective = Object.keys(hooks).length === 1 && hooks.type === 'function';

            return [
                `v-${name}`,
                el('span', { className: 'chips' },
                    isFunctionDirective
                        ? el('span', { className: 'chip', title: 'Runs on mounted and updated' }, 'function directive')
                        : Object.keys(hooks).map(hook => el('span', { className: 'chip' }, hook)),
                ),
            ];
        }),
        'No directives');
}
