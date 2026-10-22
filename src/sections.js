import { el } from './dom.js';

export function renderLoadError(containerId, error) {
    document.getElementById(containerId).replaceChildren(
        el('div', { className: 'load-error' }, `Couldn't load this section: ${error}`)
    );
}

/**
 * Renders a snapshot section (see collectSnapshot): the data with render(), an error message
 * into errorContainers, or calls onNotInstalled for an optional feature the app doesn't use
 */
export function renderSection(section, render, { errorContainers = [], onError, onNotInstalled } = {}) {
    if (section.status === 'ok') {
        render(section.data);

        return;
    }

    if (section.status === 'not-installed') {
        onNotInstalled?.();

        return;
    }

    errorContainers.forEach(containerId => renderLoadError(containerId, section.error));
    onError?.(section.error);
}

// Picks a value for an Overview card from a section, 'N/A' if the section didn't load
export function sectionValue(section, pick) {
    return section.status === 'ok' ? pick(section.data) : 'N/A';
}
