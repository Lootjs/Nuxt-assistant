import { createTable, el, setText } from '../dom.js';

// getComponents() turns functions into 'Function<name>' strings: show them as code-like names
function formatFunction(value) {
    const match = /^Function<(.*)>$/.exec(value);

    return match ? `${match[1] || 'anonymous'}()` : value;
}

// Prop types arrive as 'String', 'String | Object' or 'Function<MyClass>' for custom constructors
function formatType(type) {
    if (type === undefined || type === null) {
        return 'any';
    }

    return String(type).split(' | ').map(part => part.replace(/^Function<(.+)>$/, '$1')).join(' | ');
}

function formatDefault(value) {
    if (value === undefined) {
        return '';
    }

    return typeof value === 'string' && value.startsWith('Function<') ? formatFunction(value) : JSON.stringify(value);
}

/**
 * Vue accepts props as ['a', 'b'], { a: String } or { a: { type, required, default, validator } }:
 * all of them are normalized to rows of the props table
 */
export function normalizeProps(props) {
    if (Array.isArray(props)) {
        return props.map(name => ({ name, type: 'any', required: false, defaultValue: '' }));
    }

    return Object.entries(props || {}).map(([name, definition]) => {
        const isOptions = typeof definition === 'object' && definition !== null && !Array.isArray(definition);

        return {
            name,
            type: formatType(isOptions ? definition.type : definition),
            required: isOptions && definition.required === true,
            defaultValue: isOptions ? formatDefault(definition.default) : '',
        };
    });
}

function getEmits(component) {
    return Array.isArray(component.emits) ? component.emits : Object.keys(component.emits || {});
}

function createComponentCard(component) {
    const props = normalizeProps(component.props);
    const emits = getEmits(component);

    return el('div', { className: 'tabbed-card component-card' },
        el('div', { className: 'tabbed-card__header' },
            `<${component.name}>`,
            component.lazy && el('span', { className: 'chip component-card__lazy', title: 'Registered with defineAsyncComponent()' }, 'lazy'),
        ),
        el('div', { className: 'tabbed-card__body' },
            props.length > 0 && createTable(['Prop', 'Type', 'Required', 'Default'], props.map(prop => [
                prop.name,
                el('span', { className: 'component-card__type' }, prop.type),
                prop.required ? el('span', { className: 'component-card__required' }, 'required') : '',
                el('code', {}, prop.defaultValue),
            ])),
            emits.length > 0 && el('div', { className: 'component-card__emits' },
                el('span', { className: 'silent' }, 'Emits: '),
                el('span', { className: 'chips' }, emits.map(event => el('span', { className: 'chip' }, event))),
            ),
        ),
    );
}

// Components with nothing to show in a table are listed by name in one card, so dozens of them stay compact
function createNamesCard(title, hint, components) {
    return el('div', { className: 'tabbed-card component-card component-card--names' },
        el('div', { className: 'tabbed-card__header', title: hint }, `${title} (${components.length})`),
        el('div', { className: 'tabbed-card__body' },
            el('div', { className: 'chips' }, components.map(component => el('span', { className: 'chip' }, `<${component.name}>`))),
        ),
    );
}

export function renderComponents(components) {
    const notLoaded = components.filter(component => component.loaded === false);
    const loaded = components.filter(component => component.loaded !== false);
    const withDetails = loaded.filter(component => normalizeProps(component.props).length > 0 || getEmits(component).length > 0);
    const withoutDetails = loaded.filter(component => !withDetails.includes(component));

    setText('components-subtitle', [
        `Globally registered components: ${components.length}`,
        notLoaded.length > 0 && `${notLoaded.length} lazy ones are not loaded yet`,
        'Auto-imported components of the project are not listed',
    ].filter(Boolean).join('. '));

    // filter(Boolean): unlike el(), replaceChildren() would insert false as text
    document.getElementById('componentsList').replaceChildren(...[
        ...withDetails.map(createComponentCard),
        withoutDetails.length > 0 && createNamesCard('Without props', 'Components without props and emits', withoutDetails),
        notLoaded.length > 0 && createNamesCard('Lazy, not loaded yet',
            'Their props are known once they are rendered on the page', notLoaded),
    ].filter(Boolean));
}
