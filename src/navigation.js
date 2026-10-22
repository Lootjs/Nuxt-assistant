export function openTab(tabName) {
    for (const tabContent of document.getElementsByClassName('tabcontent')) {
        tabContent.classList.toggle('active', tabContent.id === tabName);
    }

    for (const tabLink of document.getElementsByClassName('tablinks')) {
        tabLink.classList.toggle('active', tabLink.dataset.id === tabName);
    }
}

export function setTabVisible(tabName, isVisible) {
    document.querySelector(`[data-id=${tabName}]`).hidden = !isVisible;
}

export function setupNavigation({ onRefresh }) {
    document.getElementById('refetch-trigger').addEventListener('click', () => onRefresh());

    document.getElementById('tablinkNavigator').addEventListener('click', (event) => {
        if (event.target.classList.contains('tablinks') && event.target.dataset.id) {
            openTab(event.target.dataset.id);
        }
    });
}
