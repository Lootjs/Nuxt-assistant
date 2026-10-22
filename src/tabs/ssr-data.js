import { el, setText } from '../dom.js';
import { formatBytes, jsonSyntaxHighlight, normalizeResponse } from '../format.js';
import { settings } from '../settings.js';

const HEAVY_RESPONSE_BYTES = 100 * 1024;

export function renderSsrData(payload) {
    // Formatted in the user's locale
    setText('prerenderedAt', payload.prerenderedAt
        ? `Prerendered at: ${new Date(payload.prerenderedAt).toLocaleString()}`
        : '');

    const errors = payload._errors || {};
    const data = payload.data || {};
    const requestKeys = Object.keys(data);
    const items = requestKeys.map(key => createRequestItem(key, data[key], errors[key]));
    const totalSize = items.reduce((sum, { size }) => sum + size, 0);

    document.getElementById('ssrRequestsList').replaceChildren(...items.map(({ element }) => element));
    setText('ssrDataTotal', `Requests: ${requestKeys.length}, total size: ~${formatBytes(totalSize)}`);
}

function getType(value) {
    if (Array.isArray(value)) {
        return 'array'
    }

    return typeof value;
}

function createRequestItem(key, response, error) {
    const threshold = settings.responseThreshold;
    const size = error ? 0 : new Blob([JSON.stringify(response) ?? '']).size;

    let labels = `Response: ${getType(response)}`;
    if (error) {
        labels = 'Response: error'
    } else {
        if (response && response.hasOwnProperty('length') && response.length > 1) {
            labels += ` [${response.length} items${response.length > threshold ? ', but only ' + threshold + ' will be shown' : ''}]`
        }
        labels += ` · ~${formatBytes(size)}`
    }

    let dataElement;
    if (error) {
        // The error comes from the inspected page, so it's inserted as text, not as HTML
        dataElement = el('div', {}, `The request has failed:\n${error.message}\n\nStatus code: ${error.statusCode}`);
    } else {
        let shownResponse = response;
        if (Array.isArray(response) && response.length > threshold) {
            shownResponse = response.slice(0, threshold)
        }
        shownResponse = normalizeResponse(shownResponse)
        dataElement = el('div', { innerHTML: jsonSyntaxHighlight(JSON.stringify(shownResponse, null, 4)) });
    }

    const element = el('details', { className: ['request-item', error && 'request-item--has-error'] },
        el('summary', { title: key },
            el('span', {}, 'Request: '),
            key,
            el('div', { className: ['request-item__labels', size >= HEAVY_RESPONSE_BYTES && 'request-item__labels--heavy'] }, labels),
        ),
        dataElement,
    );

    return { element, size };
}
