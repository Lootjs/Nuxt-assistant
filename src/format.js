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
