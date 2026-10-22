import { el } from './dom.js';
import { openTab } from './navigation.js';

const FLAG_ICONS = {
    true: './images/icon-check.svg',
    false: './images/icon-denied.svg',
};

/**
 * Creates an Overview-style card. Its value is set later by id: with setText() for a text card,
 * with setFlag() for a flag card (flag: true).
 * - covered: tints the icon with the primary color, off for brand logos
 * - tab: the tab opened by a click on the card
 */
export function createWidget({ id, name, icon, iconAlt = '', covered = true, flag = false, tab, title }) {
    return el('div', {
            className: ['widget', covered && 'widget--covered', tab && 'widget--link'],
            title,
            onClick: tab ? () => openTab(tab) : undefined,
        },
        el('div', { className: 'widget__highlight', id },
            flag && el('img', { alt: '', hidden: true }),
        ),
        el('div', { className: 'widget__meta' },
            el('div', { className: 'widget__cover' }, el('img', { src: icon, alt: iconAlt })),
            el('div', { className: 'widget__name' }, name),
        ),
    );
}

// Shows a check or a cross on a flag card, nothing if the value is unknown (undefined)
export function setFlag(id, value) {
    const image = document.querySelector(`#${id} img`);
    image.hidden = value === undefined;

    if (value !== undefined) {
        image.src = FLAG_ICONS[Boolean(value)];
    }
}
