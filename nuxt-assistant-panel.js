const extractPayloadAndVersions = `
    JSON.stringify({
        versions: window.useNuxtApp().versions,
        payload: window.useNuxtApp().payload,
        i18nIncluded: (window.useNuxtApp()).hasOwnProperty('$i18n'),
    })
`

const extractCurrentRoute = `
    JSON.stringify({
        fullPath: window.useNuxtApp().$router.currentRoute.value.fullPath,
        name: window.useNuxtApp().$router.currentRoute.value.name,
        params: window.useNuxtApp().$router.currentRoute.value.params,
        path: window.useNuxtApp().$router.currentRoute.value.path,
        query: window.useNuxtApp().$router.currentRoute.value.query,
        redirectedFrom: window.useNuxtApp().$router.currentRoute.value.redirectedFrom,
    })
`

const extractRoutes = `window.useNuxtApp().$router.getRoutes()`
const extractI18n = `
    (window.useNuxtApp()).hasOwnProperty('$i18n') ? JSON.stringify({
        defaultLocale: window.useNuxtApp().$i18n.defaultLocale,
        activeLocale: window.useNuxtApp().$i18n.locale.value,
        locales: window.useNuxtApp().$i18n.locales.value,
        messages: window.useNuxtApp().$i18n.messages.value,
        getBrowserLocale: window.useNuxtApp().$i18n.getBrowserLocale()
    }) : null
`
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    if (message.type === 'page-navigation') {
        runAssistant();
    }
});
function runAssistant() {
    document.querySelector(".nuxt-not-found").textContent = 'Fetching..';
    const i18nMessagesList = document.getElementById("i18nMessagesList")
    document.querySelectorAll('#i18n-included img, #server-rendered img')
        .forEach(el => el.style.display = 'none')
    document.getElementById('refetch-trigger').onclick = runAssistant;
    let fetchedMessages = [];

    chrome.devtools.inspectedWindow.eval(extractPayloadAndVersions, (result, isException) => {
        if (!isException) {
            document.querySelector(".nuxt-not-found").style.display = 'none';
            // document.querySelector(".panel-title").textContent = 'Nuxt Assistant';
            // document.querySelector(".panel-title").onclick = () => {};
            // document.querySelector("#debug-content").style.display = 'flex';

            const {versions, payload, i18nIncluded} = JSON.parse(result);
            const flags = {...payload};
            let formattedDate = null;

            if (flags.prerenderedAt) {
                const date = new Date(flags.prerenderedAt);
                formattedDate = date.toLocaleDateString('ru-RU') + ' ' + date.toLocaleTimeString();
                document.getElementById('prerenderedAt').textContent = `Prerendered at: ${formattedDate}`;
            }

            document.getElementById(`ssr-${flags.serverRendered ? 'true' : 'false'}`).style.display = 'block';
            document.getElementById(`i18n-${i18nIncluded ? 'true' : 'false'}`).style.display = 'block';

            // console.log("Data from useNuxtApp():", flags);
            document.getElementById('nuxt-version').textContent = versions.nuxt;
            document.getElementById('vue-version').textContent = versions.vue;

            for (let key in flags.data) {
                renderRequestItem(key, flags.data[key], flags._errors[key])
            }

            const configList = document.getElementById("configList");
            configList.innerText = '';
            createList(flags.config, configList);
        } else {
            console.warn("Error accessing useNuxtApp()");
            nuxtNotFound();
        }
    });

    chrome.devtools.inspectedWindow.eval(extractRoutes, (result, isException) => {
        if (!isException) {
            const routesList = document.getElementById("routesList");
            routesList.innerText = '';
            result.forEach(el => renderRouteItem(el, routesList))
        } else {
            console.warn("Error accessing useNuxtApp()");
            // nuxtNotFound();
        }
    });

    chrome.devtools.inspectedWindow.eval(extractCurrentRoute, (result, isException) => {
        if (!isException) {
            const currentRoute = JSON.parse(result);
            const parentEl = document.getElementById('currentRoute');
            parentEl.innerText = '';
            // console.log("Data from useNuxtApp() current route:", currentRoute);
            createList(currentRoute, parentEl)
        } else {
            console.warn("Error accessing useNuxtApp()");
            // nuxtNotFound();
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

            document.getElementById('currentLocale').textContent = activeLocale
            document.getElementById('defaultLocale').textContent = defaultLocale
            document.getElementById('browserLocale').textContent = getBrowserLocale
            const i18nLocalesList = document.getElementById("i18nLocalesList");

            i18nLocalesList.innerText = '';
            createList(locales, i18nLocalesList)
            fetchedMessages = flattenI18n(messages);
            renderI18nList(fetchedMessages, i18nMessagesList)
        } else {
            document.querySelector('[data-id=i18n]').style.display = 'none';
            console.warn("Error accessing useNuxtApp()");
            // nuxtNotFound();
        }
    });

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

    document.getElementById('tablinkNavigator').addEventListener('click', (event) => {
        if (event.target.classList.contains("tablinks")) {
            const id = event.target.dataset.id;

            openTab(event, id);
        }
    })

    function nuxtNotFound() {
        document.querySelector(".nuxt-not-found").textContent = 'Nuxt is not found! Click here to re-fetch data';
        document.querySelector(".nuxt-not-found").onclick = runAssistant;
        document.querySelector(".nuxt-not-found").style.display = 'block';
    }

    function renderRouteItem(route, parentEl) {
        const routeItem = document.createElement("details");
        routeItem.className = "routeItem";

        const summary = document.createElement("summary");
        summary.textContent = route.path;
        summary.setAttribute("title", route.name);

        const dataElement = document.createElement("div");
        createList(route, dataElement)

        routeItem.appendChild(summary);
        routeItem.appendChild(dataElement);

        parentEl.appendChild(routeItem);
    }

    // Requests tab

    function renderRequestItem(hash, response, error) {
        const requestsList = document.getElementById("ssrRequestsList");
        requestsList.innerText = '';
        const requestItem = document.createElement("details");
        requestItem.className = "routeItem";

        if (error !== null) {
            requestItem.className += ' routeItem--hasError'
        }

        const getType = (value) => {
            if (Array.isArray(value)) {
                return 'array'
            }

            return typeof value;
        }
        let labels = `[response type is ${getType(response)}`;
        if (response.hasOwnProperty('length') && response.length > 1) {
            labels += ` and contains ${response.length} items`
        }
        labels += ']';
        const summary = document.createElement("summary");
        const prefixElement = document.createElement('span');
        prefixElement.className = "routeItem__labels";
        prefixElement.textContent = 'Request: ';
        summary.appendChild(prefixElement);
        summary.appendChild(document.createTextNode(hash));
        const labelsElement = document.createElement('span');
        labelsElement.className = "routeItem__labels";
        labelsElement.textContent = labels;
        summary.appendChild(labelsElement);
        summary.setAttribute("title", hash);
        let data = '';

        if (error !== null) {
            data = `The request has failed:\n${error.message}\n\nStatus code: ${error.statusCode}`
        } else {
            data = JSON.stringify(response, null, 2)
        }

        const dataElement = document.createElement("div");
        dataElement.innerHTML = data;

        requestItem.appendChild(summary);
        requestItem.appendChild(dataElement);

        requestsList.appendChild(requestItem);
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
                span.textContent = JSON.stringify(data[key]);
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
    function flattenI18n(data) {
        let output = [];
        for (const locale in data) {
            function recurse(obj, current) {
                for (const key in obj) {
                    let newKey = current ? `${current}.${key}` : key;
                    if (obj[key] && typeof obj[key] === 'object' && (!obj[key].hasOwnProperty('t') && !obj[key].end)) {
                        recurse(obj[key], newKey);
                    } else if (obj[key].hasOwnProperty('t') || obj[key].hasOwnProperty('end')) {
                        const body = obj[key].body ? 'body' : 'b'
                        const staticKey = obj[key][body].static ? 'static' : 's'
                        output.push({
                            key: `${locale}.${newKey}`,
                            value: obj[key][body][staticKey] || ''
                        });
                    }
                }
            }
            recurse(data[locale], '');
        }
        return output;
    }

    document.getElementById('i18nMessagesInput').addEventListener('input', e => {
        let messages = fetchedMessages;

        if (e.target.value.length > 0) {
            messages = messages.filter(({ key, value }) => {
                return key.indexOf(e.target.value) !== -1 || value.indexOf(e.target.value) !== -1
            })
        }

        renderI18nList(messages, i18nMessagesList)
    })
}

runAssistant()
