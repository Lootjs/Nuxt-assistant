export function formatBytes(bytes) {
    if (bytes < 1024) {
        return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export function formatListValue(value) {
    if (typeof value === "object") {
        return JSON.stringify(value);
    }
    if (value === '') {
        return '""';
    }
    if (typeof value === 'boolean') {
        return `Boolean<${value ? 'true' : 'false'}>`;
    }

    return String(value);
}

// Replaces objects nested deeper than MAX_DEPTH in array items with a short summary, so huge responses
// stay readable. Returns new objects: the response itself is kept intact, e.g. for "Copy JSON".
export function normalizeResponse(response) {
    if (!Array.isArray(response)) {
        return response
    }
    const MAX_DEPTH = 2;

    function limitDepth(value, depth) {
        if (typeof value !== 'object' || value === null) {
            return value;
        }

        if (depth > MAX_DEPTH) {
            return Array.isArray(value)
                ? `hidden-array[${value.length}]`
                : `hidden-object[${Object.keys(value).length}]`;
        }

        if (Array.isArray(value)) {
            return value.map(item => limitDepth(item, depth + 1));
        }

        return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, limitDepth(item, depth + 1)]));
    }

    return response.map(item => limitDepth(item, 0));
}

// Returns HTML: the JSON is escaped first, so the result is safe to assign to innerHTML
export function jsonSyntaxHighlight(json) {
    json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|true|false|null|-?\d+(\.\d+)?([eE][+\-]?\d+)?)/g, function(match) {
        let cls = 'json__number';
        if (/^"/.test(match)) {
            if (/:$/.test(match)) {
                cls = 'json__key';
            } else {
                cls = 'json__string';
            }
        } else if (/true|false/.test(match)) {
            cls = 'json__boolean';
        } else if (/null/.test(match)) {
            cls = 'json__null';
        }
        return '<span class="' + cls + '">' + match + '</span>';
    });
}
