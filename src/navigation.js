import { el } from './dom.js';

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

// Shows a counter next to the tab name, removes it for an empty text
export function setTabBadge(tabName, text, { warning = false, title } = {}) {
    const tabLink = document.querySelector(`.tablinks[data-id=${tabName}]`);
    tabLink.querySelector('.tablinks__badge')?.remove();

    if (text !== null && text !== undefined && text !== '') {
        tabLink.append(el('span', { className: ['tablinks__badge', warning && 'tablinks__badge--warning'], title }, String(text)));
    }
}

export function clearTabBadges() {
    document.querySelectorAll('.tablinks__badge').forEach(badge => badge.remove());
}

export function setupNavigation({ onRefresh }) {
    document.getElementById('refetch-trigger').addEventListener('click', () => onRefresh());

    document.getElementById('tablinkNavigator').addEventListener('click', (event) => {
        // closest(): the click may land on the badge inside the tab link
        const tabLink = event.target.closest('.tablinks');

        if (tabLink?.dataset.id) {
            openTab(tabLink.dataset.id);
        }
    });
}
