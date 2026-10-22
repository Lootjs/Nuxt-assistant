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
        props: route.props,
        active: !!activeRecord && route.path === activeRecord.path,
    }));
}

export function getI18n() {
    const nuxtApp = window.useNuxtApp();

    if (!nuxtApp.hasOwnProperty('$i18n')) {
        return null;
    }

    const i18n = nuxtApp.$i18n;
    // Messages compiled into functions would silently disappear during serialization
    const messages = JSON.parse(JSON.stringify(
        i18n.messages.value,
        (key, value) => typeof value === 'function' ? '[compiled function]' : value,
    ));

    return {
        defaultLocale: i18n.defaultLocale,
        activeLocale: i18n.locale.value,
        locales: i18n.localeCodes.value,
        browserLocale: i18n.getBrowserLocale(),
        messages,
    };
}

export function getInternals() {
    const nuxtApp = window.useNuxtApp();

    return {
        globalProperties: Object.getOwnPropertyNames(nuxtApp.vueApp.config.globalProperties),
        hookListenerCounts: Object.fromEntries(
            Object.entries(nuxtApp.hooks._hooks).map(([hookName, listeners]) => [hookName, listeners.length])
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

export function getComponents() {
    const nativeTypes = [String, Number, Boolean, Array, Object, Date, Function, Symbol, BigInt, Promise];

    function replaceFunctions(item) {
        if (nativeTypes.includes(item)) {
            return item.name;
        } else if (Array.isArray(item) && item.length && item.every(element => nativeTypes.includes(element))) {
            return item.map(element => element.name).join(' | ');
        } else if (Array.isArray(item)) {
            return item.map(element => replaceFunctions(element));
        } else if (typeof item === 'object' && item !== null) {
            const newItem = {};
            for (const key in item) {
                newItem[key] = replaceFunctions(item[key]);
            }
            return newItem;
        } else if (typeof item === 'function') {
            return 'Function' + ('name' in item ? '<' + item.name + '>' : item);
        } else {
            return item;
        }
    }

    return replaceFunctions(Object.values(window.useNuxtApp().vueApp._context.components));
}

// Only primitive state is shown: objects are replaced with {} because big stores can't be transferred
export function getPinia() {
    const nuxtApp = window.useNuxtApp();

    if (!nuxtApp.hasOwnProperty('$pinia')) {
        return null;
    }

    return Object.fromEntries(Array.from(nuxtApp.$pinia._s).map(([storeName, store]) => {
        const entries = Object.entries(store)
            .filter(([prop]) => !prop.startsWith('$') && !prop.startsWith('_'))
            .map(([prop, value]) => {
                if (typeof value === 'function') {
                    return [prop, 'function'];
                }
                if (typeof value === 'object') {
                    return [prop, {}];
                }

                return [prop, value];
            });

        return [storeName, Object.fromEntries(entries)];
    }));
}
