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

// Replaces nested values deeper than MAX_DEPTH with a short summary, so huge responses stay readable
export function normalizeResponse(response) {
    if (!Array.isArray(response)) {
        return response
    }
    const MAX_DEPTH = 2;
    function limitDepth(obj, maxDepth, currentDepth = 0) {
        if (currentDepth > maxDepth) {
            if (Array.isArray(obj)) {
                return `hidden-array[${obj.length}]`
            }
            return Object(obj) === obj ? `hidden-object[${Object.keys(obj).length}]` : typeof obj;
        }

        if (typeof obj === 'object' && obj !== null) {
            for (let key in obj) {
                if (typeof obj[key] === 'object') {
                    obj[key] = limitDepth(obj[key], maxDepth, currentDepth + 1);
                }
            }
        }

        return obj;
    }

    return response.map(log => limitDepth(log, MAX_DEPTH));
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
