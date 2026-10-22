import vm from 'node:vm';

// Serialized into the fake page, so it must be self-contained like the page queries themselves
function installFakeNuxtApp() {
    const routes = [
        { path: '/en/claims/:id', name: 'claims-id___en', meta: { layout: 'form', middleware: () => {} }, props: { default: false } },
        { path: '/ar/claims/:id', name: 'claims-id___ar', meta: {}, props: { default: false } },
    ];
    const nuxtApp = {
        versions: { nuxt: '4.5.2', vue: '3.5.43' },
        payload: {
            serverRendered: true,
            data: { wordings: [{ name: 'Life' }] },
            state: { locale: 'en' },
            config: { public: { apiBase: '/api' } },
            pinia: { huge: 'state' },
        },
        $config: { app: { buildId: 'build-1' } },
        $router: {
            currentRoute: { value: { matched: [routes[0]] } },
            getRoutes: () => routes,
        },
        $i18n: {
            defaultLocale: 'en',
            locale: { value: 'en' },
            localeCodes: { value: ['en', 'ar'] },
            getBrowserLocale: () => 'ar',
            messages: { value: { en: { hello: { t: 0, b: { t: 2, s: 'Hello' } }, compiled: function compiled() {} }, ar: {} } },
        },
        $pinia: { _s: new Map([['user', { name: 'John', profile: { age: 30 }, logout() {}, $id: 'user', _p: {} }]]) },
        hooks: { _hooks: { 'app:mounted': [() => {}, () => {}], 'page:finish': [() => {}] } },
        vueApp: {
            config: { globalProperties: { $router: {}, $i18n: {}, $pinia: {} } },
            _context: {
                directives: { tooltip: { mounted() {}, updated() {} }, focus: () => {} },
                components: {
                    RouterLink: {
                        name: 'RouterLink',
                        props: { to: { type: [String, Object], required: true }, replace: Boolean, custom: { validator: function validator() {} } },
                    },
                },
            },
        },
    };
    window.useNuxtApp = () => nuxtApp;
}

/**
 * A fake inspected page: a separate JS realm, like the real page is for the DevTools panel.
 * patch is a self-contained function run in the page after the Nuxt app is installed,
 * e.g. () => { delete window.useNuxtApp().$i18n }
 */
export function createFakePage({ withNuxt = true, payloadScript = null, patch = null } = {}) {
    const page = vm.createContext({ Blob });
    vm.runInContext('globalThis.window = globalThis', page);
    page.document = { querySelector: () => payloadScript };
    if (withNuxt) {
        vm.runInContext(`(${installFakeNuxtApp})()`, page);
    }
    if (patch) {
        vm.runInContext(`(${patch})()`, page);
    }

    return page;
}

/**
 * Installs a chrome API stub whose inspectedWindow.eval runs expressions in the given page,
 * in its global scope, like the real one. Returns a function to switch the page.
 */
export function installChromeStub(initialPage) {
    let page = initialPage;
    const messageListeners = [];

    globalThis.chrome = {
        devtools: {
            inspectedWindow: {
                tabId: 1,
                eval(expression, callback) {
                    let result;
                    try {
                        result = vm.runInContext(expression, page);
                    } catch (error) {
                        callback(undefined, { isException: true, description: String(error) });

                        return;
                    }
                    callback(result);
                },
            },
        },
        runtime: {
            onMessage: { addListener: listener => messageListeners.push(listener) },
            sendMessage() {},
            lastError: undefined,
        },
        storage: {
            local: {
                get: (key, callback) => callback({}),
                set: (value, callback) => callback?.(),
            },
        },
    };

    return {
        setPage: nextPage => page = nextPage,
        sendMessage: message => messageListeners.forEach(listener => listener(message)),
    };
}
