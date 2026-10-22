import { el } from './dom.js';

// The Clipboard API is usually blocked in DevTools extension panels by the permissions policy,
// so it falls back to a hidden textarea and execCommand('copy'). Resolves with whether it worked.
export async function copyText(text) {
    try {
        await navigator.clipboard.writeText(text);

        return true;
    } catch (error) {
        // Falls back below
    }

    const buffer = el('textarea', { value: text, readOnly: true, className: 'clipboard-buffer' });
    document.body.append(buffer);
    buffer.select();

    try {
        return document.execCommand('copy');
    } catch (error) {
        return false;
    } finally {
        buffer.remove();
    }
}
