// Functions in this file are executed in the inspected page via evalInPage(), which serializes them
// with toString(). So each of them must be self-contained: no imports and no references to anything
// declared outside the function body. Their results must be JSON-serializable.

// Queries return null when the feature isn't installed (i18n, Pinia) and throw when something is broken

export function detectNuxt() {
    return typeof window.useNuxtApp === 'function';
}

// Kept apart from getPayload: a payload that can't be serialized mustn't break the versions
export function getOverview() {
    const nuxtApp = window.useNuxtApp();

    return {
        host: location.host,
        versions: nuxtApp.versions,
        serverRendered: !!nuxtApp.payload.serverRendered,
        prerenderedAt: nuxtApp.payload.prerenderedAt ?? null,
        i18nIncluded: nuxtApp.hasOwnProperty('$i18n'),
        piniaInstalled: nuxtApp.hasOwnProperty('$pinia'),
    };
}

// The Pinia state is dropped: it's shown on its own tab and can be huge
export function getPayload() {
    const { pinia, ...payload } = window.useNuxtApp().payload;

    return payload;
}

export function getBuildId() {
    return window.useNuxtApp().$config.app.buildId;
}

// Size of the payload inlined into the HTML, null if the page has none (e.g. SPA mode)
export function getInlinePayloadSize() {
    const script = document.querySelector('script[data-nuxt-data], script#__NUXT_DATA__');

    return script ? new Blob([script.textContent]).size : null;
}

// The active route is detected by its record, so dynamic routes (/users/:id) are matched too
export function getRoutes() {
    const router = window.useNuxtApp().$router;
    const matched = router.currentRoute.value.matched;
    const activeRecord = matched[matched.length - 1];

    return router.getRoutes().map(route => ({
        path: route.path,
        name: route.name,
        meta: route.meta,
        active: !!activeRecord && route.path === activeRecord.path,
    }));
}

export function getI18n() {
    const nuxtApp = window.useNuxtApp();

    if (!nuxtApp.hasOwnProperty('$i18n')) {
        return null;
    }

    // @nuxtjs/i18n provides the global composer; a custom plugin may provide the createI18n() instance instead
    const i18n = nuxtApp.$i18n.global ?? nuxtApp.$i18n;
    // Composition mode keeps values in refs, legacy mode has plain values
    const unref = value => value?.__v_isRef ? value.value : value;

    // A custom i18n (not vue-i18n) may keep its messages in a closure, e.g. inside its t(): then messages is null
    // and api lists what its $i18n provides, so the panel can explain why there's nothing to show
    const rawMessages = unref(i18n.messages);
    const hasMessages = typeof rawMessages === 'object' && rawMessages !== null;

    // Messages compiled into functions would silently disappear during serialization
    const messages = hasMessages
        ? JSON.parse(JSON.stringify(rawMessages, (key, value) => typeof value === 'function' ? '[compiled function]' : value))
        : null;

    // localeCodes, defaultLocale and getBrowserLocale come from @nuxtjs/i18n, plain vue-i18n has none of them
    return {
        defaultLocale: i18n.defaultLocale ?? null,
        activeLocale: unref(i18n.locale) ?? null,
        locales: unref(i18n.localeCodes) ?? i18n.availableLocales ?? (hasMessages ? Object.keys(messages) : []),
        browserLocale: typeof i18n.getBrowserLocale === 'function' ? i18n.getBrowserLocale() ?? null : null,
        messages,
        api: hasMessages ? null : Object.keys(i18n).filter(key => !key.startsWith('_')).sort(),
    };
}

export function getInternals() {
    const nuxtApp = window.useNuxtApp();

    return {
        globalProperties: Object.getOwnPropertyNames(nuxtApp.vueApp.config.globalProperties),
        // A removed hook may be left as undefined instead of an array of listeners
        hookListenerCounts: Object.fromEntries(
            Object.entries(nuxtApp.hooks._hooks)
                .filter(([, listeners]) => Array.isArray(listeners))
                .map(([hookName, listeners]) => [hookName, listeners.length])
        ),
    };
}

// Directive definitions are functions or objects of hook functions, which don't survive serialization
export function getDirectives() {
    return Object.fromEntries(
        Object.entries(window.useNuxtApp().vueApp._context.directives).map(([name, directive]) => [
            name,
            typeof directive === 'function'
                ? { type: 'function' }
                : Object.fromEntries(Object.keys(directive).map(hook => [hook, typeof directive[hook]])),
        ])
    );
}

// [{ name, props, emits, lazy, loaded }]: only what the Components tab shows, a whole component object
// may hold render functions, nested components and circular references
export function getComponents() {
    const nativeTypes = [String, Number, Boolean, Array, Object, Date, Function, Symbol, BigInt, Promise];
    // Prop defaults are plain data, the limit only guards against circular or huge ones
    const MAX_DEPTH = 5;

    function replaceFunctions(item, depth = 0) {
        if (nativeTypes.includes(item)) {
            return item.name;
        } else if (Array.isArray(item) && item.length && item.every(element => nativeTypes.includes(element))) {
            return item.map(element => element.name).join(' | ');
        } else if (typeof item === 'object' && item !== null && depth >= MAX_DEPTH) {
            return Array.isArray(item) ? '[Array]' : '[Object]';
        } else if (Array.isArray(item)) {
            return item.map(element => replaceFunctions(element, depth + 1));
        } else if (typeof item === 'object' && item !== null) {
            const newItem = {};
            for (const key in item) {
                newItem[key] = replaceFunctions(item[key], depth + 1);
            }
            return newItem;
        } else if (typeof item === 'function') {
            return `Function<${item.name}>`;
        } else {
            return item;
        }
    }

    // The registration key is the name used in templates. Lazy components are defineAsyncComponent()
    // wrappers named "AsyncComponentWrapper": their props are known once the component has been loaded
    return Object.entries(window.useNuxtApp().vueApp._context.components).map(([name, component]) => {
        const lazy = typeof component.__asyncLoader === 'function';
        const resolved = lazy ? component.__asyncResolved : component;

        if (!resolved) {
            return { name, lazy, loaded: false };
        }

        return {
            name,
            lazy,
            loaded: true,
            props: replaceFunctions(resolved.props),
            emits: replaceFunctions(resolved.emits),
        };
    });
}

// { storeName: { state, getters, actions: [names] } }, or { storeName: { error } } for a store that can't be read
export function getPinia() {
    const nuxtApp = window.useNuxtApp();

    if (!nuxtApp.hasOwnProperty('$pinia')) {
        return null;
    }

    // Limits keep big stores transferable (DevTools can't pass huge eval results)
    const MAX_DEPTH = 8;
    const MAX_ITEMS = 500;

    // Reading a getter runs app code, which may throw, e.g. when the state it needs isn't loaded yet.
    // The error is shown in place of the value, so one broken getter doesn't hide the other stores.
    function describeError(error) {
        return `[Error: ${error instanceof Error ? error.message : String(error)}]`;
    }

    function read(object, key) {
        try {
            return { value: object[key] };
        } catch (error) {
            return { error: describeError(error) };
        }
    }

    // Store values can be anything: circular references, Maps, Sets, Dates, class instances, huge lists
    function toPlain(value, depth, ancestors) {
        if (typeof value === 'function') {
            return `function ${value.name}`.trim();
        }
        if (typeof value === 'bigint') {
            return `${value}n`;
        }
        if (typeof value === 'symbol') {
            return value.toString();
        }
        if (value === null || typeof value !== 'object') {
            return value;
        }
        if (value instanceof Date) {
            return value.toISOString();
        }
        if (ancestors.has(value)) {
            return '[Circular]';
        }
        if (depth >= MAX_DEPTH) {
            return Array.isArray(value) ? `[Array(${value.length})]` : '[Object]';
        }

        ancestors.add(value);
        const items = value instanceof Map || value instanceof Set ? Array.from(value) : null;
        let result;

        if (value instanceof Map) {
            result = Object.fromEntries(items.slice(0, MAX_ITEMS)
                .map(([key, item]) => [String(key), toPlain(item, depth + 1, ancestors)]));
        } else if (Array.isArray(value) || value instanceof Set) {
            const list = items || value;
            result = list.slice(0, MAX_ITEMS).map(item => toPlain(item, depth + 1, ancestors));
            if (list.length > MAX_ITEMS) {
                result.push(`… ${list.length - MAX_ITEMS} more items`);
            }
        } else {
            result = {};
            for (const key of Object.keys(value).slice(0, MAX_ITEMS)) {
                const property = read(value, key);
                result[key] = 'error' in property ? property.error : toPlain(property.value, depth + 1, ancestors);
            }
        }

        // Only ancestors make a cycle: the same object may appear in two branches
        ancestors.delete(value);

        return result;
    }

    function describeStore(store) {
        const stateKeys = Object.keys(store.$state);
        const getters = {};
        const actions = [];

        // Store props that aren't state are getters (computed values) and actions (functions)
        for (const key of Object.keys(store)) {
            if (key.startsWith('$') || key.startsWith('_') || stateKeys.includes(key)) {
                continue;
            }

            const property = read(store, key);
            if ('error' in property) {
                getters[key] = property.error;
            } else if (typeof property.value === 'function') {
                actions.push(key);
            } else {
                getters[key] = toPlain(property.value, 1, new Set());
            }
        }

        return { state: toPlain(store.$state, 0, new Set()), getters, actions };
    }

    return Object.fromEntries(Array.from(nuxtApp.$pinia._s).map(([storeName, store]) => {
        try {
            return [storeName, describeStore(store)];
        } catch (error) {
            return [storeName, { error: describeError(error) }];
        }
    }));
}
