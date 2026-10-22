import vm from 'node:vm';

// Serialized into the fake page, so it must be self-contained like the page queries themselves
function installFakeNuxtApp() {
    const routes = [
        { path: '/en/claims/:id', name: 'claims-id___en', meta: { layout: 'form', middleware: () => {} }, props: { default: false } },
        { path: '/ar/claims/:id', name: 'claims-id___ar', meta: {}, props: { default: false } },
    ];
    // Like a Pinia store: state props are also exposed on the store, next to getters and actions
    function createUserStore() {
        const $state = { name: 'John', profile: { age: 30, tags: new Set(['admin']) }, visits: new Map([['home', 2]]) };
        $state.profile.self = $state.profile;

        return {
            $id: 'user',
            $state,
            _p: {},
            ...$state,
            fullName: 'John Doe',
            logout() {},
        };
    }

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
            // Refs, like in the composition mode of vue-i18n
            locale: { __v_isRef: true, value: 'en' },
            localeCodes: { __v_isRef: true, value: ['en', 'ar'] },
            getBrowserLocale: () => 'ar',
            messages: { __v_isRef: true, value: { en: { hello: { t: 0, b: { t: 2, s: 'Hello' } }, compiled: function compiled() {} }, ar: {} } },
        },
        $pinia: { _s: new Map([['user', createUserStore()]]) },
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
                    // defineAsyncComponent() wrappers: __asyncResolved is set once the component has been loaded
                    LazyBanner: { name: 'AsyncComponentWrapper', __asyncLoader() {}, __asyncResolved: undefined },
                    LazyCard: {
                        name: 'AsyncComponentWrapper',
                        __asyncLoader() {},
                        __asyncResolved: { name: 'Card', props: { size: { type: Number, default: 1 } }, render() {} },
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
    const page = vm.createContext({ Blob, location: { host: 'shop.example.com' } });
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
                        // Like in Chrome: "TypeError: message" followed by the "at ..." lines of the stack trace
                        // (Node prefixes vm stacks with the failing source line, so they're rebuilt)
                        const frames = String(error.stack ?? '').split('\n').filter(line => /^\s+at /.test(line));
                        callback(undefined, { isException: true, description: [String(error), ...frames].join('\n') });

                        return;
                    }
                    callback(result);
                },
            },
        },
        runtime: {
            onMessage: { addListener: listener => messageListeners.push(listener) },
            sendMessage() {},
            getManifest: () => ({ version: '1.24' }),
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
