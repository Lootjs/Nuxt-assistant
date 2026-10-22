import { el, setText } from '../dom.js';

let routes = [];

const searchInput = () => document.getElementById('routesSearch');

export function setupRoutes() {
    searchInput().addEventListener('input', renderShownRoutes);
}

// Drops routes of the previous run, so the search doesn't bring them back
export function clearRoutes() {
    routes = [];
}

export function renderRoutes(newRoutes) {
    routes = newRoutes;
    document.getElementById('routes').classList.toggle('routes--no-meta', !routes.some(hasMeta));
    // Keeps the current search query applied after a refresh
    renderShownRoutes();
}

// Matches the path, the name and the meta, case-insensitively
export function filterRoutes(routes, query) {
    const normalizedQuery = query.trim().toLowerCase();

    if (normalizedQuery.length === 0) {
        return routes;
    }

    return routes.filter(route => [route.path, route.name ?? '', JSON.stringify(route.meta ?? {})]
        .some(value => String(value).toLowerCase().includes(normalizedQuery)));
}

function renderShownRoutes() {
    const shownRoutes = filterRoutes(routes, searchInput().value);

    setText('routesTotal', shownRoutes.length === routes.length
        ? `Routes total: ${routes.length}`
        : `Routes: ${shownRoutes.length} of ${routes.length}`);
    document.getElementById('routesList').replaceChildren(...shownRoutes.map(createRouteItem));
}

function hasMeta(route) {
    return Object.keys(route.meta ?? {}).length > 0;
}

function formatMetaValue(value) {
    return typeof value === 'string' ? value : JSON.stringify(value);
}

function createRouteItem(route) {
    return el('div', { className: ['route-item', route.active && 'route-item--active'] },
        el('div', { className: 'route-item__path' },
            route.path,
            route.active && el('span', { className: 'route-item__badge' }, 'active'),
        ),
        el('div', { className: 'route-item__name' }, route.name),
        el('div', { className: 'route-item__label' }, Object.entries(route.meta ?? {}).map(([key, value]) =>
            el('span', { className: 'route-meta' }, `${key}: ${formatMetaValue(value)}`)
        )),
    );
}
