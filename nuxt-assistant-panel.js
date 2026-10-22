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
            requestsList.innerText = '';
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
            configList.innerText = '';
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
            routesList.innerText = '';
            result.forEach(el => renderRouteItem(el, routesList))
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
        pluginsList.innerText = '';
        const modules = {};
        moduleInfos.filter(Boolean).forEach(({ name, ...info }) => {
            modules[name] = info;
        });
        renderConfigCards(modules, pluginsList);

        const hooksList = document.getElementById("hooksList");
        hooksList.innerText = '';

        if (Object.keys(data.hooks).length) {
            const table = document.createElement('table');
            table.className = 'internals';
            const thead = document.createElement('thead');
            const tbody = document.createElement('tbody');

            thead.innerHTML = '<tr><th>Hook</th><th>Listeners count</th></tr>';

            table.appendChild(thead);

            Object.entries(data.hooks).forEach(([hookName, content]) => {
                const tr = document.createElement('tr');
                const tdElement = document.createElement('td');
                const tdUrl = document.createElement('td');
                const span = document.createElement('span');

                tdElement.textContent = hookName;
                span.textContent = content.length;
                tdUrl.appendChild(span);

                tr.appendChild(tdElement);
                tr.appendChild(tdUrl);

                tbody.appendChild(tr);
            });

            table.appendChild(tbody);
            hooksList.appendChild(table);
        }
    });

    chrome.devtools.inspectedWindow.eval(extractDirectives, (result, isException) => {
        if (isException) {
            logEvalFailure('Cannot load directives', isException);

            return void(0);
        }

        const directivesList = document.getElementById("directivesList");
        directivesList.innerText = '';
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
        componentsList.innerText = '';
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
        piniaList.innerText = '';
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
        const tabbedCard = document.createElement('div');
        tabbedCard.className = 'tabbed-card';
        const header = document.createElement('div');
        header.className = 'tabbed-card__header';
        header.textContent = key;
        tabbedCard.appendChild(header);
        const body = document.createElement('div');
        body.className = 'tabbed-card__body';
        tabbedCard.appendChild(body);
        createList(config, body);

        parentEl.appendChild(tabbedCard);
    }
}

function renderRouteItem(route, parentEl) {
    const routeItem = document.createElement("div");
    routeItem.className = "route-item";

    const path = document.createElement("div");
    path.className = 'route-item__path';
    path.textContent = route.path;

    if (route.active) {
        routeItem.className += ' route-item--active';
        const badge = document.createElement("span");
        badge.className = 'route-item__badge';
        badge.textContent = 'active';
        path.appendChild(badge);
    }

    const name = document.createElement("div");
    name.className = 'route-item__name';
    name.textContent = route.name;

    const labels = {...route.meta};
    labels.default = route.props.default;
    const labelWrapper = document.createElement("div");
    labelWrapper.className = 'route-item__label';
    labelWrapper.textContent = JSON.stringify(labels);

    routeItem.appendChild(path);
    routeItem.appendChild(name);
    routeItem.appendChild(labelWrapper);
    parentEl.appendChild(routeItem);
}

// Requests tab

function renderRequestItem(hash, response, error) {
    const requestsList = document.getElementById("ssrRequestsList");
    const requestItem = document.createElement("details");
    requestItem.className = "routeItem";

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
        requestItem.className += ' routeItem--hasError'
    } else {
        if (response && response.hasOwnProperty('length') && response.length > 1) {
            labels += ` [${response.length} items${response.length > responseThresholdConfig ? ', but only ' + responseThresholdConfig + ' will be shown' : ''}]`
        }
    }
    const summary = document.createElement("summary");
    const prefixElement = document.createElement('span');
    prefixElement.textContent = 'Request: ';
    summary.appendChild(prefixElement);
    summary.appendChild(document.createTextNode(hash));
    if (!error) {
        labels += ` · ~${formatBytes(size)}`
    }
    const labelsElement = document.createElement('div');
    labelsElement.className = "routeItem__labels";
    if (size >= HEAVY_RESPONSE_BYTES) {
        labelsElement.className += " routeItem__labels--heavy";
    }
    labelsElement.textContent = labels;
    summary.appendChild(labelsElement);
    summary.setAttribute("title", hash);

    const dataElement = document.createElement("div");

    if (error) {
        // The error comes from the inspected page, so it must not be treated as HTML
        dataElement.textContent = `The request has failed:\n${error.message}\n\nStatus code: ${error.statusCode}`
    } else {
        let _response = response;
        if (response.length && response.length > responseThresholdConfig && Array.isArray(response)) {
            _response = response.slice(0, responseThresholdConfig)
        }
        _response = normalizeResponse(_response)
        dataElement.innerHTML = jsonSyntaxHighlight(JSON.stringify(_response, null, 4));
    }

    requestItem.appendChild(summary);
    requestItem.appendChild(dataElement);

    requestsList.appendChild(requestItem);

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

function createList(data, parentElement) {
    const ul = document.createElement("ul");

    for (let key in data) {
        const li = document.createElement("li");
        const span = document.createElement("span");
        span.textContent = `${key}: `;
        span.setAttribute('class', 'silent');

        li.appendChild(span);

        if (typeof data[key] === "object" && data[key] !== null && Object.keys(data[key]).length > 0) {
            createList(data[key], li);
        } else {
            const span = document.createElement("span");
            span.className = 'item-value';
            if (typeof data[key] === "object") {
                span.textContent = JSON.stringify(data[key])
            } else if (data[key] === '') {
                span.textContent = '""'
            } else if (typeof data[key] === 'boolean') {
                span.textContent = `Boolean<${data[key] ? 'true' : 'false'}>`
            } else {
                span.textContent = data[key]
            }
            li.appendChild(span);
        }

        ul.appendChild(li);
    }

    parentElement.appendChild(ul);
}

function renderI18nList(data, parentElement) {
    parentElement.innerText = '';
    const wrapper = document.createElement("div");

    data.forEach(({ key, value }) => {
        const div = document.createElement("div");
        div.setAttribute('class', 'i18nItem');
        const keyWrapper = document.createElement("span");
        keyWrapper.textContent = key;
        keyWrapper.setAttribute('class', 'i18nItem__key');
        const valueWrapper = document.createElement("span");
        valueWrapper.setAttribute('class', 'i18nItem__value');
        valueWrapper.textContent = value;

        div.appendChild(keyWrapper);
        div.appendChild(valueWrapper);

        wrapper.appendChild(div);
    });

    parentElement.appendChild(wrapper);
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
    list.innerText = '';

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

    missing.forEach(({ path, missingIn }) => {
        const div = document.createElement("div");
        div.className = 'i18nMissingItem';
        div.title = 'Show the existing translations';
        const keyWrapper = document.createElement("span");
        keyWrapper.className = 'i18nMissingItem__key';
        keyWrapper.textContent = path;
        const localesWrapper = document.createElement("span");
        localesWrapper.className = 'i18nMissingItem__locales';
        localesWrapper.textContent = `missing in: ${missingIn.join(', ')}`;

        div.appendChild(keyWrapper);
        div.appendChild(localesWrapper);
        div.addEventListener('click', () => {
            const input = document.getElementById('i18nMessagesInput');
            input.value = path;
            input.dispatchEvent(new Event('input'));
            input.scrollIntoView({ behavior: 'smooth' });
        });

        list.appendChild(div);
    });
}

function createTableFromArray(list) {
    const table = document.createElement('table');
    table.className = 'internals';
    const thead = document.createElement('thead');
    const tbody = document.createElement('tbody');

    thead.innerHTML = '<tr><th>Item</th><th>URL</th></tr>';

    table.appendChild(thead);

    list.forEach(item => {
        const tr = document.createElement('tr');
        const tdElement = document.createElement('td');
        const tdUrl = document.createElement('td');
        const span = document.createElement('span');

        const name = camelToSnake(item);
        tdElement.textContent = name;
        span.textContent = `https://nuxt.com/modules/${name}`;
        tdUrl.appendChild(span);

        tr.appendChild(tdElement);
        tr.appendChild(tdUrl);

        tbody.appendChild(tr);
    });

    table.appendChild(tbody);

    return table;
}

function camelToSnake(str) {
    return str.replace('$', '').replace(/([A-Z])/g, letter => `-${letter.toLowerCase()}`);
}

chrome.storage.local.get('responseThreshold', function(data) {
    responseThresholdConfig = data.responseThreshold || 20
    document.getElementById('response-threshold-config').value = responseThresholdConfig;
    runAssistant()
});
