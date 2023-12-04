const extractPayloadAndVersions = `
  JSON.stringify({
    versions: window.useNuxtApp().versions,
    payload: window.useNuxtApp().payload
  })
`

const extractRoutes = `window.useNuxtApp().$router.getRoutes()`

function runAssistant() {
    const routesList = document.getElementById("routesList");
    const configList = document.getElementById("configList");
    const requestsList = document.getElementById("ssrRequestsList");

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

            console.log("Data from useNuxtApp():", flags);
            document.getElementById('nuxt-version').textContent = versions.nuxt;
            document.getElementById('vue-version').textContent = versions.vue;
            document.getElementById('currentRoute').textContent = flags.path;
            document.getElementById('prerenderedAt').textContent = formattedDate;


            for (let key in flags.data) {
                renderRequestItem(key, flags.data[key])
            }

            createList(flags.config, configList);
        } else {
            console.error("Error accessing useNuxtApp()");
            nuxtNotFound();
        }
    });

    chrome.devtools.inspectedWindow.eval(extractRoutes, (result, isException) => {
        if (!isException) {
            console.log("Data from useNuxtApp() routes:", result);
            result.forEach(renderRouteItem)
        } else {
            console.error("Error accessing useNuxtApp()");
            nuxtNotFound();
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

    function renderRequestItem(hash, response) {
        const requestItem = document.createElement("details");
        requestItem.className = "routeItem";

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
}

runAssistant()

chrome.devtools.network.onNavigated.addListener(url => {
    setTimeout(runAssistant, 800)
});