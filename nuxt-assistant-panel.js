const extractPayloadAndVersions = `
    JSON.stringify({
        versions: window.useNuxtApp().versions,
        payload: (({ pinia, ...rest }) => rest)(window.useNuxtApp().payload),
        i18nIncluded: (window.useNuxtApp()).hasOwnProperty('$i18n'),
        piniaInstalled: (window.useNuxtApp()).hasOwnProperty('$pinia')
    })
`

// The active route is detected by its record, so dynamic routes (/users/:id) are matched too
const extractRoutes = `
    (() => {
        const router = window.useNuxtApp().$router;
        const matched = router.currentRoute.value.matched;
        const activeRecord = matched[matched.length - 1];

        return router.getRoutes().map(route => ({
            path: route.path,
            name: route.name,
            meta: route.meta,
            props: route.props,
            active: !!activeRecord && route.path === activeRecord.path
        }));
    })()
`

// Size of the payload inlined into the HTML, null if the page has none (e.g. SPA mode)
const extractInlinePayloadSize = `
    (() => {
        const script = document.querySelector('script[data-nuxt-data], script#__NUXT_DATA__');

        return script ? new Blob([script.textContent]).size : null;
    })()
`
const extractI18n = `
    (window.useNuxtApp()).hasOwnProperty('$i18n') ? JSON.stringify({
        defaultLocale: window.useNuxtApp().$i18n.defaultLocale,
        activeLocale: window.useNuxtApp().$i18n.locale.value,
        locales: window.useNuxtApp().$i18n.localeCodes.value,
        localesProps: window.useNuxtApp().$i18n.localeProperties.value,
        messages: window.useNuxtApp().$i18n.messages.value,
        getBrowserLocale: window.useNuxtApp().$i18n.getBrowserLocale()
    }, (key, value) => typeof value === 'function' ? '[compiled function]' : value) : null
`

const extractBuildId = `
    JSON.stringify({
        buildId: window.useNuxtApp().$config.app.buildId
    })`;

const extractInternals = `
    JSON.stringify({
        plugins: Object.getOwnPropertyNames(window.useNuxtApp().vueApp.config.globalProperties),
        hooks: window.useNuxtApp().hooks._hooks
    })`;

// Directive definitions are functions or objects of hook functions, which don't survive serialization
const extractDirectives = `
    Object.fromEntries(
        Object.entries(window.useNuxtApp().vueApp._context.directives).map(([name, directive]) => [
            name,
            typeof directive === 'function'
                ? { type: 'function' }
                : Object.fromEntries(Object.keys(directive).map(hook => [hook, typeof directive[hook]]))
        ])
    )
`

// Evals run in the page's global scope, so declarations are kept inside an IIFE:
// a top-level const would throw "already been declared" on the next run
const extractComponents = `
    (() => {
        const nativeTypes = [String, Number, Boolean, Array, Object, Date, Function, Symbol, BigInt, Promise];

        function recurseReplaceFunction(item) {
            if (nativeTypes.includes(item)) {
                return item.name;
            } else if (Array.isArray(item) && item.length && item.every(element => nativeTypes.includes(element))) {
                return item.map(element => element.name).join(' | ');
            } else if (Array.isArray(item)) {
                return item.map(element => recurseReplaceFunction(element));
            } else if (typeof item === 'object' && item !== null) {
                const newItem = {};
                for (const key in item) {
                    newItem[key] = recurseReplaceFunction(item[key]);
                }
                return newItem;
            } else if (typeof item === 'function') {
                return 'Function' + ('name' in item ? '<' + item.name + '>' : item);
            } else {
                return item;
            }
        }

        return recurseReplaceFunction(Object.values(window.useNuxtApp().vueApp._context.components));
    })()
    `

const extractPinia = `
    window.useNuxtApp().hasOwnProperty('$pinia') ?
        Array.from(window.useNuxtApp().$pinia._s).map(([storeName, store]) => {
            const entries = Object.entries(store).filter(([prop]) => {
                return !prop.startsWith('$') && !prop.startsWith('_')
            }).map(([prop, value]) => {
                const type = typeof value;
                let returnValue = value;

                if (type === 'function') {
                    returnValue = 'function';
                } else if (type === 'object') {
                    returnValue = {}
                }
                return {[prop]: returnValue};
            })

            return {[storeName]: entries}
    }) : []
`

let responseThresholdConfig = 20;
let fetchedMessages = [];
// Incremented on every run so that async work from a previous run doesn't render stale data
let currentRunId = 0;
// moduleName -> module info, or null if it's not a Nuxt module
const modulesCache = new Map();
// globalProperties registered by Nuxt, Vue Router and vue-i18n themselves, they aren't Nuxt modules
const builtinGlobalProperties = [
    '$nuxt', '$config', '$router', '$route', 'previousRoute', '$head',
    '$t', '$tc', '$te', '$tm', '$rt', '$d', '$n',
];
const HEAVY_RESPONSE_BYTES = 100 * 1024;

chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    if (message.type === 'page-navigation' && message.tabId === chrome.devtools.inspectedWindow.tabId) {
        runAssistant();
    }
});

document.getElementById('refetch-trigger').onclick = () => runAssistant();

document.getElementById('tablinkNavigator').addEventListener('click', (event) => {
    if (event.target.classList.contains("tablinks") && event.target.id !== 'refetch-trigger') {
        const id = event.target.dataset.id;

        openTab(event, id);
    }
})

document.querySelectorAll('#common [data-tab]').forEach(widget => {
    widget.addEventListener('click', () => {
        const tabName = widget.dataset.tab;

        openTab({ target: document.querySelector(`[data-id=${tabName}]`) }, tabName);
    })
})

document.getElementById('i18nMessagesInput').addEventListener('input', e => {
    let messages = fetchedMessages;
    const query = e.target.value.toLowerCase();

    if (query.length > 0) {
        messages = messages.filter(({ key, value }) => {
            return key.toLowerCase().includes(query) || value.toLowerCase().includes(query)
        })
    }

    renderI18nList(messages, document.getElementById("i18nMessagesList"))
})

document.getElementById('save-settings').addEventListener('click', () => {
    const thresholdValue = parseInt(document.getElementById('response-threshold-config').value);
    responseThresholdConfig = thresholdValue || 20;
    chrome.storage.local.set({ responseThreshold: thresholdValue }, function() {
        if (chrome.runtime.lastError) {
            console.error(chrome.runtime.lastError);
        }
    });
    runAssistant();
    openTab({ target: document.querySelector('[data-id=common]')}, 'common')
})

document.getElementById('support-me').addEventListener('click', () => {
    chrome.runtime.sendMessage({event: 'supportMe'});
})

function runAssistant() {
    const runId = ++currentRunId;
    document.querySelector(".header__title").textContent = 'Fetching..';
    setTimeout(() => document.querySelector(".header__title").textContent = 'Nuxt Assistant', 300)
    document.querySelectorAll('#i18n-included img, #pinia-included img')
        .forEach(el => el.style.display = 'none')

    chrome.devtools.inspectedWindow.eval(extractBuildId, (result, isException) => {
        const buildIdContainer = document.getElementById('buildId');
        if (isException) {
            logEvalFailure('Cannot load buildId', isException);
            buildIdContainer.textContent = 'N/A';

            return void (0);
        }

        const data = JSON.parse(result);
        buildIdContainer.textContent = data.buildId;
    })

    chrome.devtools.inspectedWindow.eval(extractInlinePayloadSize, (result, isException) => {
        document.getElementById('payload-size').textContent = isException || result === null
            ? 'N/A'
            : formatBytes(result);
    })

    chrome.devtools.inspectedWindow.eval(extractPayloadAndVersions, (result, isException) => {
        if (!isException) {
            document.querySelector(".nuxt-not-found").style.display = 'none';

            const {versions, payload, i18nIncluded, piniaInstalled} = JSON.parse(result);
            const flags = {...payload};
            let formattedDate = null;

            if (flags.prerenderedAt) {
                const date = new Date(flags.prerenderedAt);
                formattedDate = date.toLocaleDateString('ru-RU') + ' ' + date.toLocaleTimeString();
                document.getElementById('prerenderedAt').textContent = `Prerendered at: ${formattedDate}`;
            }

            let renderingMode = 'SPA';
            if (flags.prerenderedAt) {
                renderingMode = 'SSG';
            } else if (flags.serverRendered) {
                renderingMode = 'SSR';
            }
            document.getElementById('rendering-mode').textContent = renderingMode;

            document.getElementById(`i18n-${i18nIncluded ? 'true' : 'false'}`).style.display = 'block';
            document.getElementById(`pinia-${piniaInstalled ? 'true' : 'false'}`).style.display = 'block';

            document.querySelector('[data-id=pinia]').style.display = piniaInstalled ? 'inherit' : 'none';
            document.getElementById('nuxt-version').textContent = versions.nuxt;
            document.getElementById('vue-version').textContent = versions.vue;

            const requestsList = document.getElementById("ssrRequestsList");
            requestsList.replaceChildren();
            const errors = flags._errors || {};
            const requestKeys = Object.keys(flags.data || {});
            let totalSize = 0;
            for (let key of requestKeys) {
                totalSize += renderRequestItem(key, flags.data[key], errors[key])
            }
            document.getElementById('ssr-requests-count').textContent = requestKeys.length;
            document.getElementById('ssrDataTotal').textContent =
                `Requests: ${requestKeys.length}, total size: ~${formatBytes(totalSize)}`;

            const configList = document.getElementById("configList");
            configList.replaceChildren();
            renderConfigCards({
                ...flags.config,
                state: flags.state
            }, configList);
        } else {
            logEvalFailure('Error accessing useNuxtApp()', isException);
            nuxtNotFound();
        }
    });

    chrome.devtools.inspectedWindow.eval(extractRoutes, (result, isException) => {
        if (!isException) {
            const routesList = document.getElementById("routesList");
            document.getElementById('routesTotal').innerText = `Routes total: ${result.length}`;
            document.getElementById('routes-count').textContent = result.length;
            routesList.replaceChildren(...result.map(createRouteItem));
        } else {
            logEvalFailure('Cannot load routes', isException);
        }
    });

    chrome.devtools.inspectedWindow.eval(extractI18n, (result, isException) => {
        if (!isException && result) {
            const {
                activeLocale,
                defaultLocale,
                locales,
                messages,
                getBrowserLocale,
            } = JSON.parse(result);
            fetchedMessages = flattenI18n(messages);

            document.querySelector('[data-id=i18n]').style.display = '';
            document.getElementById('currentLocale').textContent = activeLocale
            document.getElementById('defaultLocale').textContent = defaultLocale
            document.getElementById('browserLocale').textContent = getBrowserLocale
            document.getElementById("i18nLocalesList").textContent = `Available locales: ${locales.join(', ')}`;

            const countByLocale = {};
            fetchedMessages.forEach(({ locale }) => {
                countByLocale[locale] = (countByLocale[locale] || 0) + 1;
            });
            const localeCounts = Object.entries(countByLocale)
                .map(([locale, count]) => `${locale}: ${count}`)
                .join(', ');
            document.getElementById('messagesTotal').textContent =
                `Messages total: ${fetchedMessages.length}${localeCounts ? ` (${localeCounts})` : ''}`;

            renderMissingTranslations(fetchedMessages, locales);
            document.getElementById('i18nMessagesInput').dispatchEvent(new Event('input'));
        } else {
            document.querySelector('[data-id=i18n]').style.display = 'none';
            // Without an exception the app simply has no i18n installed
            if (isException) {
                logEvalFailure('Cannot load i18n', isException);
            }
        }
    });

    chrome.devtools.inspectedWindow.eval(extractInternals, async (result, isException) => {
        if (isException) {
            logEvalFailure('Cannot load internal info', isException);

            return void(0);
        }

        const data = JSON.parse(result);

        const moduleNames = data.plugins
            .filter(moduleItem => !builtinGlobalProperties.includes(moduleItem))
            .map(moduleItem => moduleItem.replace('$', ''));
        const moduleInfos = await Promise.all(moduleNames.map(fetchModuleInfo));

        if (runId !== currentRunId) {
            return void(0);
        }

        const pluginsList = document.getElementById("pluginsList");
        pluginsList.replaceChildren();
        const modules = {};
        moduleInfos.filter(Boolean).forEach(({ name, ...info }) => {
            modules[name] = info;
        });
        renderConfigCards(modules, pluginsList);

        const hooksList = document.getElementById("hooksList");
        hooksList.replaceChildren();

        if (Object.keys(data.hooks).length) {
            hooksList.append(createTable(
                ['Hook', 'Listeners count'],
                Object.entries(data.hooks).map(([hookName, content]) => [hookName, el('span', {}, content.length)]),
            ));
        }
    });

    chrome.devtools.inspectedWindow.eval(extractDirectives, (result, isException) => {
        if (isException) {
            logEvalFailure('Cannot load directives', isException);

            return void(0);
        }

        const directivesList = document.getElementById("directivesList");
        directivesList.replaceChildren();
        const directives = {};
        Object.entries(result).forEach(([name, contains]) => {
            directives[`v-${name}`] = contains;
        });
        renderConfigCards(directives, directivesList);
    });

    chrome.devtools.inspectedWindow.eval(extractComponents, (result, isException) => {
        if (isException) {
            logEvalFailure('Cannot load components', isException);

            return void(0);
        }
        const componentsList = document.getElementById("componentsList");
        componentsList.replaceChildren();
        document.getElementById("components-subtitle").innerText =
            `Globally registered components: ${result.length}. Auto-imported components of the project are not listed`;
        document.getElementById('components-count').textContent = result.length;
        const components = {};

        result.forEach((component) => {
            components[`<${component.name}>`] = component;
        });
        renderConfigCards(components, componentsList);
    });

    chrome.devtools.inspectedWindow.eval(extractPinia, (result, isException) => {
        if (isException) {
            logEvalFailure('Cannot load pinia', isException);

            return void(0);
        }

        function transformArrayToObject(arr) {
            const result = {};

            arr.forEach(item => {
                const key = Object.keys(item)[0];
                result[key] = Object.assign({}, ...item[key]);
            });

            return result;
        }

        const piniaList = document.getElementById("piniaList");
        piniaList.replaceChildren();
        renderConfigCards(transformArrayToObject(result), piniaList);
    });
}

async function fetchModuleInfo(moduleName) {
    if (modulesCache.has(moduleName)) {
        return modulesCache.get(moduleName);
    }

    try {
        const response = await fetch(`https://api.nuxt.com/modules/${moduleName}`)
        const apiData = await response.json();

        if (!response.ok || apiData.statusCode === 404) {
            modulesCache.set(moduleName, null);

            return null;
        }

        const info = {
            name: apiData.name,
            description: apiData.description,
            website: apiData.website,
            category: apiData.category,
            maintainersCount: apiData.maintainers.length,
            compatibility: apiData.compatibility,
            latestVersion: apiData.stats.version,
            downloads: apiData.stats.downloads,
            stars: apiData.stats.stars,
        };
        modulesCache.set(moduleName, info);

        return info;
    } catch (e) {
        // Network errors aren't cached, so the module is retried on the next run
        return null;
    }
}

// Failed evals are expected (pages without Nuxt, apps without i18n or pinia), so they're logged
// with console.debug: console.warn would flood the extension's error page in chrome://extensions
function logEvalFailure(message, exceptionInfo) {
    console.debug(`[Nuxt Assistant] ${message}`, exceptionInfo && (exceptionInfo.description || exceptionInfo.value) || '');
}

// DOM helpers

/**
 * Creates an element, e.g. el('div', { className: 'card', onClick: handler }, 'text', childElement)
 * - className accepts an array, falsy items are skipped: ['item', isActive && 'item--active']
 * - on* props are added as event listeners, the rest are assigned as element properties
 * - string children are inserted as text, never as HTML; null, undefined and false are skipped
 */
function el(tag, props = {}, ...children) {
    const element = document.createElement(tag);

    for (const [name, value] of Object.entries(props)) {
        if (value === undefined || value === null) {
            continue;
        }

        if (name === 'className' && Array.isArray(value)) {
            element.className = value.filter(Boolean).join(' ');
        } else if (name.startsWith('on')) {
            element.addEventListener(name.slice(2).toLowerCase(), value);
        } else {
            element[name] = value;
        }
    }

    // Appended one by one: spreading thousands of i18n rows into append() may exceed the arguments limit
    for (const child of children.flat()) {
        if (child !== null && child !== undefined && child !== false) {
            element.append(child);
        }
    }

    return element;
}

function createTable(headings, rows) {
    return el('table', { className: 'internals' },
        el('thead', {}, el('tr', {}, headings.map(heading => el('th', {}, heading)))),
        el('tbody', {}, rows.map(cells => el('tr', {}, cells.map(cell => el('td', {}, cell))))),
    );
}

function openTab(evt, tabName) {
    let i, tabcontent, tablinks;

    tabcontent = document.getElementsByClassName("tabcontent");
    for (i = 0; i < tabcontent.length; i++) {
        tabcontent[i].style.display = "none";
    }

    tablinks = document.getElementsByClassName("tablinks");
    for (i = 0; i < tablinks.length; i++) {
        tablinks[i].className = tablinks[i].className.replace(" active", "");
    }

    document.getElementById(tabName).style.display = "flex";
    evt.target.className += " active";
}

function nuxtNotFound() {
    document.querySelector(".nuxt-not-found").textContent = 'Nuxt is not found! Click here to re-fetch data';
    document.querySelector(".nuxt-not-found").onclick = () => runAssistant();
    document.querySelector(".nuxt-not-found").style.display = 'block';
}

function renderConfigCards(configs, parentEl) {
    for (const key in configs) {
        const config = configs[key];
        if (typeof config !== 'object' || config === null || Object.keys(config).length === 0) {
            continue;
        }
        parentEl.append(el('div', { className: 'tabbed-card' },
            el('div', { className: 'tabbed-card__header' }, key),
            el('div', { className: 'tabbed-card__body' }, createList(config)),
        ));
    }
}

function createRouteItem(route) {
    const labels = {...route.meta};
    labels.default = route.props.default;

    return el('div', { className: ['route-item', route.active && 'route-item--active'] },
        el('div', { className: 'route-item__path' },
            route.path,
            route.active && el('span', { className: 'route-item__badge' }, 'active'),
        ),
        el('div', { className: 'route-item__name' }, route.name),
        el('div', { className: 'route-item__label' }, JSON.stringify(labels)),
    );
}

// Requests tab

function renderRequestItem(hash, response, error) {
    const getType = (value) => {
        if (Array.isArray(value)) {
            return 'array'
        }

        return typeof value;
    }

    const size = error ? 0 : new Blob([JSON.stringify(response) ?? '']).size;
    let labels = `Response: ${getType(response)}`;
    if (error) {
        labels = 'Response: error'
    } else {
        if (response && response.hasOwnProperty('length') && response.length > 1) {
            labels += ` [${response.length} items${response.length > responseThresholdConfig ? ', but only ' + responseThresholdConfig + ' will be shown' : ''}]`
        }
        labels += ` · ~${formatBytes(size)}`
    }

    let dataElement;
    if (error) {
        // The error comes from the inspected page, so it's inserted as text, not as HTML
        dataElement = el('div', {}, `The request has failed:\n${error.message}\n\nStatus code: ${error.statusCode}`);
    } else {
        let _response = response;
        if (response.length && response.length > responseThresholdConfig && Array.isArray(response)) {
            _response = response.slice(0, responseThresholdConfig)
        }
        _response = normalizeResponse(_response)
        dataElement = el('div', { innerHTML: jsonSyntaxHighlight(JSON.stringify(_response, null, 4)) });
    }

    document.getElementById("ssrRequestsList").append(
        el('details', { className: ['routeItem', error && 'routeItem--hasError'] },
            el('summary', { title: hash },
                el('span', {}, 'Request: '),
                hash,
                el('div', { className: ['routeItem__labels', size >= HEAVY_RESPONSE_BYTES && 'routeItem__labels--heavy'] }, labels),
            ),
            dataElement,
        )
    );

    return size;
}

function formatBytes(bytes) {
    if (bytes < 1024) {
        return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function normalizeResponse(response) {
    if (!Array.isArray(response)) {
        return response
    }
    const MAX_DEPTH = 2;
    function limitDepth(obj, maxDepth, currentDepth = 0) {
        if (currentDepth > maxDepth) {
            if (Array.isArray(obj)) {
                return `hidden-array[${obj.length}]`
            }
            return Object(obj) === obj ? `hidden-object[${Object.keys(obj).length}]` : typeof obj;
        }

        if (typeof obj === 'object' && obj !== null) {
            for (let key in obj) {
                if (typeof obj[key] === 'object') {
                    obj[key] = limitDepth(obj[key], maxDepth, currentDepth + 1);
                }
            }
        }

        return obj;
    }

    return response.map(log => limitDepth(log, MAX_DEPTH));
}

function jsonSyntaxHighlight(json) {
    json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|true|false|null|-?\d+(\.\d+)?([eE][+\-]?\d+)?)/g, function(match) {
        let cls = 'json__number';
        if (/^"/.test(match)) {
            if (/:$/.test(match)) {
                cls = 'json__key';
            } else {
                cls = 'json__string';
            }
        } else if (/true|false/.test(match)) {
            cls = 'json__boolean';
        } else if (/null/.test(match)) {
            cls = 'json__null';
        }
        return '<span class="' + cls + '">' + match + '</span>';
    });
}

// Configs tab

function formatListValue(value) {
    if (typeof value === "object") {
        return JSON.stringify(value);
    }
    if (value === '') {
        return '""';
    }
    if (typeof value === 'boolean') {
        return `Boolean<${value ? 'true' : 'false'}>`;
    }

    return String(value);
}

function createList(data) {
    return el('ul', {}, Object.keys(data).map(key => {
        const value = data[key];
        const isNested = typeof value === "object" && value !== null && Object.keys(value).length > 0;

        return el('li', {},
            el('span', { className: 'silent' }, `${key}: `),
            isNested
                ? createList(value)
                : el('span', { className: 'item-value' }, formatListValue(value)),
        );
    }));
}

function renderI18nList(data, parentElement) {
    parentElement.replaceChildren(el('div', {}, data.map(({ key, value }) =>
        el('div', { className: 'i18nItem' },
            el('span', { className: 'i18nItem__key' }, key),
            el('span', { className: 'i18nItem__value' }, value),
        )
    )));
}

// i18n tab

// Node types of the vue-i18n message compiler AST
const I18N_NODE = {
    RESOURCE: 0,
    PLURAL: 1,
    MESSAGE: 2,
    TEXT: 3,
    NAMED: 4,
    LIST: 5,
    LINKED: 6,
    LINKED_KEY: 7,
    LINKED_MODIFIER: 8,
    LITERAL: 9,
};

// Precompiled messages are ASTs, in production their props are minified (type -> t, body -> b, ...)
function isI18nAstNode(value) {
    return typeof value === 'object' && value !== null && (
        (typeof value.type === 'number' && 'body' in value) ||
        (typeof value.t === 'number' && 'b' in value)
    );
}

// Restores the message source, e.g. "Hello {name} | Hello all" or "@.lower:common.title"
function i18nAstToString(node) {
    if (node === null || typeof node !== 'object') {
        return node === null || node === undefined ? '' : String(node);
    }

    const prop = (name, shortName) => node[name] !== undefined ? node[name] : node[shortName];

    switch (prop('type', 't')) {
        case I18N_NODE.RESOURCE:
            return i18nAstToString(prop('body', 'b'));
        case I18N_NODE.PLURAL:
            return (prop('cases', 'c') || []).map(i18nAstToString).join(' | ');
        case I18N_NODE.MESSAGE: {
            const staticValue = prop('static', 's');
            if (staticValue !== undefined) {
                return staticValue;
            }

            return (prop('items', 'i') || []).map(i18nAstToString).join('');
        }
        case I18N_NODE.TEXT:
        case I18N_NODE.LINKED_KEY:
        case I18N_NODE.LINKED_MODIFIER:
            return i18nAstToString(prop('value', 'v'));
        case I18N_NODE.NAMED:
            return `{${prop('key', 'k')}}`;
        case I18N_NODE.LIST:
            return `{${prop('index', 'i')}}`;
        case I18N_NODE.LITERAL:
            return `{'${prop('value', 'v')}'}`;
        case I18N_NODE.LINKED: {
            const modifier = prop('modifier', 'm');

            return `@${modifier ? '.' + i18nAstToString(modifier) : ''}:${i18nAstToString(prop('key', 'k'))}`;
        }
        default:
            return '';
    }
}

function flattenI18n(data) {
    const output = [];

    function recurse(locale, obj, current) {
        for (const key in obj) {
            const value = obj[key];
            const path = current ? `${current}.${key}` : key;

            if (value === null || value === undefined) {
                continue;
            }

            if (isI18nAstNode(value)) {
                output.push({ locale, path, key: `${locale}.${path}`, value: i18nAstToString(value) });
            } else if (typeof value === 'object') {
                recurse(locale, value, path);
            } else {
                output.push({ locale, path, key: `${locale}.${path}`, value: String(value) });
            }
        }
    }

    for (const locale in data) {
        recurse(locale, data[locale], '');
    }

    return output;
}

// Locales loaded lazily have no messages until the user switches to them, so they can't be compared
function findMissingTranslations(messages) {
    const keysByLocale = {};
    messages.forEach(({ locale, path }) => {
        (keysByLocale[locale] = keysByLocale[locale] || new Set()).add(path);
    });
    const loadedLocales = Object.keys(keysByLocale);
    const allPaths = [...new Set(messages.map(({ path }) => path))].sort();

    const missing = allPaths
        .map(path => ({ path, missingIn: loadedLocales.filter(locale => !keysByLocale[locale].has(path)) }))
        .filter(({ missingIn }) => missingIn.length > 0);

    return { loadedLocales, missing };
}

function renderMissingTranslations(messages, locales) {
    const { loadedLocales, missing } = findMissingTranslations(messages);
    const notLoadedLocales = locales.filter(locale => !loadedLocales.includes(locale));
    const subtitle = document.getElementById('missingTotal');
    const list = document.getElementById('i18nMissingList');
    list.replaceChildren();

    const notLoadedNote = notLoadedLocales.length
        ? `. Not loaded yet (lazy loading): ${notLoadedLocales.join(', ')}`
        : '';

    if (loadedLocales.length < 2) {
        subtitle.textContent = `At least two loaded locales are needed to compare${notLoadedNote}`;

        return void(0);
    }

    subtitle.textContent = missing.length
        ? `${missing.length} keys are missing in some of the loaded locales${notLoadedNote}`
        : `All keys are translated in ${loadedLocales.join(', ')}${notLoadedNote}`;

    const showTranslations = (path) => {
        const input = document.getElementById('i18nMessagesInput');
        input.value = path;
        input.dispatchEvent(new Event('input'));
        input.scrollIntoView({ behavior: 'smooth' });
    };

    for (const { path, missingIn } of missing) {
        list.append(el('div', {
                className: 'i18nMissingItem',
                title: 'Show the existing translations',
                onClick: () => showTranslations(path),
            },
            el('span', { className: 'i18nMissingItem__key' }, path),
            el('span', { className: 'i18nMissingItem__locales' }, `missing in: ${missingIn.join(', ')}`),
        ));
    }
}

function createTableFromArray(list) {
    return createTable(['Item', 'URL'], list.map(item => {
        const name = camelToSnake(item);

        return [name, el('span', {}, `https://nuxt.com/modules/${name}`)];
    }));
}

function camelToSnake(str) {
    return str.replace('$', '').replace(/([A-Z])/g, letter => `-${letter.toLowerCase()}`);
}

chrome.storage.local.get('responseThreshold', function(data) {
    responseThresholdConfig = data.responseThreshold || 20
    document.getElementById('response-threshold-config').value = responseThresholdConfig;
    runAssistant()
});
