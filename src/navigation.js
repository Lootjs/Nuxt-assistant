export function openTab(tabName) {
    for (const tabContent of document.getElementsByClassName("tabcontent")) {
        tabContent.style.display = "none";
    }

    for (const tabLink of document.getElementsByClassName("tablinks")) {
        tabLink.classList.toggle('active', tabLink.dataset.id === tabName);
    }

    document.getElementById(tabName).style.display = "flex";
}

export function setTabVisible(tabName, isVisible) {
    document.querySelector(`[data-id=${tabName}]`).style.display = isVisible ? '' : 'none';
}

export function setupNavigation({ onRefresh }) {
    document.getElementById('refetch-trigger').addEventListener('click', () => onRefresh());

    document.getElementById('tablinkNavigator').addEventListener('click', (event) => {
        if (event.target.classList.contains("tablinks") && event.target.dataset.id) {
            openTab(event.target.dataset.id);
        }
    });

    // Overview widgets open the tab with their details
    document.querySelectorAll('#common [data-tab]').forEach(widget => {
        widget.addEventListener('click', () => openTab(widget.dataset.tab));
    });
}
