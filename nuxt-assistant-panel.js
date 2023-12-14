const extractPayloadAndVersions = `
    JSON.stringify({
        versions: window.useNuxtApp().versions,
        payload: window.useNuxtApp().payload
    })
`

const extractRoutes = `window.useNuxtApp().$router.getRoutes()`
const extractI18n = `
    JSON.stringify({
        defaultLocale: window.useNuxtApp().$i18n.defaultLocale,
        activeLocale: window.useNuxtApp().$i18n.locale.value,
        locales: window.useNuxtApp().$i18n.locales.value,
        messages: window.useNuxtApp().$i18n.messages.value,
        getBrowserLocale: window.useNuxtApp().$i18n.getBrowserLocale()
    })
`

function runAssistant() {
    const routesList = document.getElementById("routesList");
    const configList = document.getElementById("configList");
    const requestsList = document.getElementById("ssrRequestsList");
    const i18nLocalesList = document.getElementById("i18nLocalesList");
    const i18nMessagesList = document.getElementById("i18nMessagesList");
    clearOldData();

    chrome.devtools.inspectedWindow.eval(extractPayloadAndVersions, (result, isException) => {
        if (!isException) {
            document.querySelector(".panel-title").textContent = 'Nuxt Assistant';
            document.querySelector(".panel-title").onclick = () => {};
            document.querySelector("#debug-content").style.display = 'flex';
            
            const {versions, payload} = JSON.parse(result);
            const flags = {...payload};
            let formattedDate = 'N/A';

            if (flags.prerenderedAt) {
                const date = new Date(flags.prerenderedAt);
                formattedDate = date.toLocaleDateString('ru-RU') + ' ' + date.toLocaleTimeString();
            }

            // console.log("Data from useNuxtApp():", flags);
            document.getElementById('nuxt-version').textContent = versions.nuxt;
            document.getElementById('vue-version').textContent = versions.vue;
            document.getElementById('currentRoute').textContent = flags.path;
            document.getElementById('prerenderedAt').textContent = formattedDate;


            for (let key in flags.data) {
                renderRequestItem(key, flags.data[key], flags._errors[key])
            }

            createList(flags.config, configList);
        } else {
            console.error("Error accessing useNuxtApp()");
            nuxtNotFound();
        }
    });

    chrome.devtools.inspectedWindow.eval(extractRoutes, (result, isException) => {
        if (!isException) {
            // console.log("Data from useNuxtApp() routes:", result);
            result.forEach(renderRouteItem)
        } else {
            console.error("Error accessing useNuxtApp()");
            nuxtNotFound();
        }
    });

    chrome.devtools.inspectedWindow.eval(extractI18n, (result, isException) => {
        if (!isException) {
            const {
                activeLocale,
                defaultLocale,
                locales,
                messages,
                getBrowserLocale,
            } = JSON.parse(result);

            document.getElementById('currentLocale').textContent = activeLocale;
            document.getElementById('defaultLocale').textContent = defaultLocale;
            document.getElementById('getBrowserLocale').textContent = getBrowserLocale;

            locales.forEach(locale => {
               createList(locale, i18nLocalesList)
            });
            i18nMessagesList.textContent = flattenI18n(messages)
        } else {
            console.error("Error accessing useNuxtApp()");
            nuxtNotFound();
        }
    });

    function clearOldData() {
        routesList.innerText = '';
        configList.innerText = '';
        requestsList.innerText = '';
        i18nLocalesList.innerText = '';
        i18nMessagesList.innerText = '';
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

    document.getElementById("common").style.display = "flex";

    document.getElementById('tablinkNavigator').addEventListener('click', (event) => {
        if (event.target.classList.contains("tablinks")) {
            const id = event.target.dataset.id;

            openTab(event, id);
        }
    })

    function nuxtNotFound() {
        document.querySelector(".panel-title").textContent = 'Nuxt is not found! Click here to re-fetch data';
        document.querySelector(".panel-title").onclick = runAssistant;
        document.querySelector("#debug-content").style.display = 'none';
    }

    function renderRouteItem(route) {
        const routeItem = document.createElement("details");
        routeItem.className = "routeItem";

        const summary = document.createElement("summary");
        summary.textContent = route.path;
        summary.setAttribute("title", route.name);

        const dataElement = document.createElement("div");
        createList(route, dataElement)

        routeItem.appendChild(summary);
        routeItem.appendChild(dataElement);

        routesList.appendChild(routeItem);
    }

    // Requests tab

    function renderRequestItem(hash, response, error) {
        const requestItem = document.createElement("details");
        requestItem.className = "routeItem";

        if (error !== null) {
            requestItem.className += ' routeItem--hasError'
        }

        const summary = document.createElement("summary");
        summary.textContent = hash;
        summary.setAttribute("title", hash);
        let data = '';

        if (Array.isArray(response)) {
            if (response.length > 3) {
                data = `First item:\n${JSON.stringify(response[0])}\n\nResponse contains ${response.length} elements.`
            } else {
                data = JSON.stringify(response)
            }
        } else if (error !== null) {
            data = `The request has failed:\n${error.message}\n\nStatus code: ${error.statusCode}`
        }

        const dataElement = document.createElement("div");;
        dataElement.innerHTML = data.replace(/\n/g, "<br>")

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

            if (typeof data[key] === "object" && Object.keys(data[key]).length > 0) {
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

    // i18n tab
    function flattenI18n(data) {
        let output = [];
        for (const locale in data) {
            function recurse(obj, current) {
                for (const key in obj) {
                    let newKey = current ? `${current}.${key}` : key;
                    if (obj[key] && typeof obj[key] === 'object' && !obj[key].end) {
                        recurse(obj[key], newKey);
                    } else if (obj[key].end) {
                        output.push(`${locale}.${newKey} = "${obj[key].body.static}"`);
                    }
                }
            }
            recurse(data[locale], '');
        }
        return output.join('\n');
    }
}

runAssistant()

chrome.devtools.network.onNavigated.addListener(url => {
    setTimeout(runAssistant, 800)
});