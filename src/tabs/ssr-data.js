import { el, setText } from '../dom.js';
import { formatBytes } from '../format.js';
import { createTree } from '../tree.js';
import { copyText } from '../clipboard.js';

const HEAVY_RESPONSE_BYTES = 100 * 1024;
const COPY_FEEDBACK_MS = 1500;

export function setupSsrData() {
    const setAllOpen = isOpen => document.querySelectorAll('#ssrRequestsList > details')
        .forEach(details => details.open = isOpen);

    document.getElementById('ssrExpandAll').addEventListener('click', () => setAllOpen(true));
    document.getElementById('ssrCollapseAll').addEventListener('click', () => setAllOpen(false));
}

export function renderSsrData(payload) {
    // Formatted in the user's locale
    setText('prerenderedAt', payload.prerenderedAt
        ? `Prerendered at: ${new Date(payload.prerenderedAt).toLocaleString()}`
        : '');

    const errors = payload._errors || {};
    const data = payload.data || {};
    // Failed requests first, the rest keeps the payload order (sort is stable)
    const requestKeys = Object.keys(data).sort((a, b) => Boolean(errors[b]) - Boolean(errors[a]));
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

// Copies the full response (not the truncated one that's shown) and reports the result on the button
function createCopyButton(getJson) {
    return el('button', {
        className: ['button', 'request-item__copy'],
        title: 'Copy the full response as JSON',
        onClick: async event => {
            // The button is inside <summary>: without it the click would also toggle the request
            event.preventDefault();
            const button = event.currentTarget;
            const copied = await copyText(getJson());
            button.textContent = copied ? 'Copied' : 'Copy failed';
            setTimeout(() => button.textContent = 'Copy JSON', COPY_FEEDBACK_MS);
        },
    }, 'Copy JSON');
}

function createRequestItem(key, response, error) {
    const size = error ? 0 : new Blob([JSON.stringify(response) ?? '']).size;

    let labels = `Response: ${getType(response)}`;
    if (error) {
        labels = 'Response: error'
    } else {
        if (Array.isArray(response) && response.length > 1) {
            labels += ` [${response.length} items]`
        }
        labels += ` · ~${formatBytes(size)}`
    }

    let dataElement;
    if (error) {
        // The error comes from the inspected page, so it's inserted as text, not as HTML
        dataElement = el('div', {}, `The request has failed:\n${error.message}\n\nStatus code: ${error.statusCode}`);
    } else {
        // The tree renders big arrays page by page (Settings → threshold) and nested values on expand
        dataElement = el('div', {}, createTree(response));
    }

    const element = el('details', { className: ['request-item', error && 'request-item--has-error'] },
        el('summary', { title: key },
            el('span', {}, 'Request: '),
            key,
            el('div', { className: ['request-item__labels', size >= HEAVY_RESPONSE_BYTES && 'request-item__labels--heavy'] },
                el('span', { className: 'request-item__info' }, labels),
                createCopyButton(() => JSON.stringify(error || response, null, 2)),
            ),
        ),
        dataElement,
    );

    return { element, size };
}
