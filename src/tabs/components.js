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

function createComponentCard(component) {
    const props = normalizeProps(component.props);
    const emits = Array.isArray(component.emits) ? component.emits : Object.keys(component.emits || {});

    return el('div', { className: 'tabbed-card component-card' },
        el('div', { className: 'tabbed-card__header' }, `<${component.name}>`),
        el('div', { className: 'tabbed-card__body' },
            props.length > 0
                ? createTable(['Prop', 'Type', 'Required', 'Default'], props.map(prop => [
                    prop.name,
                    el('span', { className: 'component-card__type' }, prop.type),
                    prop.required ? el('span', { className: 'component-card__required' }, 'required') : '',
                    el('code', {}, prop.defaultValue),
                ]))
                : el('div', { className: 'silent' }, 'No props'),
            emits.length > 0 && el('div', { className: 'component-card__emits' },
                el('span', { className: 'silent' }, 'Emits: '),
                el('span', { className: 'chips' }, emits.map(event => el('span', { className: 'chip' }, event))),
            ),
        ),
    );
}

export function renderComponents(components) {
    setText('components-subtitle',
        `Globally registered components: ${components.length}. Auto-imported components of the project are not listed`);

    document.getElementById('componentsList').replaceChildren(...components.map(createComponentCard));
}
