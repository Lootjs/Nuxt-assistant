import { el, setText } from '../dom.js';

export function renderRoutes(routes) {
    setText('routesTotal', `Routes total: ${routes.length}`);
    setText('routes-count', routes.length);
    document.getElementById('routesList').replaceChildren(...routes.map(createRouteItem));
}

function createRouteItem(route) {
    const labels = {...route.meta};
    labels.default = route.props.default;

    return el('div', { className: ['route-item', route.active && 'route-item--active'] },
        el('div', { className: 'route-item__path' },
            route.path,
            route.active && el('span', { className: 'route-item__badge' }, 'active'),
        ),
        el('div', { className: 'route-item__name' }, route.name),
        el('div', { className: 'route-item__label' }, JSON.stringify(labels)),
    );
}
