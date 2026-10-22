// Node types of the vue-i18n message compiler AST
const I18N_NODE = {
    RESOURCE: 0,
    PLURAL: 1,
    MESSAGE: 2,
    TEXT: 3,
    NAMED: 4,
    LIST: 5,
    LINKED: 6,
    LINKED_KEY: 7,
    LINKED_MODIFIER: 8,
    LITERAL: 9,
};

// Precompiled messages are ASTs, in production their props are minified (type -> t, body -> b, ...)
export function isI18nAstNode(value) {
    return typeof value === 'object' && value !== null && (
        (typeof value.type === 'number' && 'body' in value) ||
        (typeof value.t === 'number' && 'b' in value)
    );
}

// Restores the message source, e.g. "Hello {name} | Hello all" or "@.lower:common.title"
export function i18nAstToString(node) {
    if (node === null || typeof node !== 'object') {
        return node === null || node === undefined ? '' : String(node);
    }

    const prop = (name, shortName) => node[name] !== undefined ? node[name] : node[shortName];

    switch (prop('type', 't')) {
        case I18N_NODE.RESOURCE:
            return i18nAstToString(prop('body', 'b'));
        case I18N_NODE.PLURAL:
            return (prop('cases', 'c') || []).map(i18nAstToString).join(' | ');
        case I18N_NODE.MESSAGE: {
            const staticValue = prop('static', 's');
            if (staticValue !== undefined) {
                return staticValue;
            }

            return (prop('items', 'i') || []).map(i18nAstToString).join('');
        }
        case I18N_NODE.TEXT:
        case I18N_NODE.LINKED_KEY:
        case I18N_NODE.LINKED_MODIFIER:
            return i18nAstToString(prop('value', 'v'));
        case I18N_NODE.NAMED:
            return `{${prop('key', 'k')}}`;
        case I18N_NODE.LIST:
            return `{${prop('index', 'i')}}`;
        case I18N_NODE.LITERAL:
            return `{'${prop('value', 'v')}'}`;
        case I18N_NODE.LINKED: {
            const modifier = prop('modifier', 'm');

            return `@${modifier ? '.' + i18nAstToString(modifier) : ''}:${i18nAstToString(prop('key', 'k'))}`;
        }
        default:
            return '';
    }
}
