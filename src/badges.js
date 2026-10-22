import { clearTabBadges, setTabBadge } from './navigation.js';
import { findMissingTranslations, flattenI18n } from './i18n/messages.js';

// tab -> [snapshot section, function returning the badge for the section data]
const BADGES = {
    routes: ['routes', routes => ({ text: routes.length })],
    ssrData: ['payload', payload => {
        const errors = payload._errors || {};
        const requestKeys = Object.keys(payload.data || {});
        const failedCount = requestKeys.filter(key => errors[key]).length;

        return failedCount
            ? { text: `${failedCount} failed`, warning: true, title: `${failedCount} of ${requestKeys.length} requests failed` }
            : { text: requestKeys.length };
    }],
    i18n: ['i18n', ({ messages }) => {
        const missingCount = findMissingTranslations(flattenI18n(messages)).missing.length;

        return missingCount
            ? { text: `${missingCount} missing`, warning: true, title: `${missingCount} missing translations` }
            : null;
    }],
    pinia: ['pinia', stores => ({ text: Object.keys(stores).length })],
    components: ['components', components => ({ text: components.length })],
};

// Counters next to the tab names, so problems are visible without opening the tab
export function renderTabBadges(sections) {
    clearTabBadges();

    for (const [tabName, [sectionName, getBadge]] of Object.entries(BADGES)) {
        const section = sections[sectionName];

        if (section.status === 'error') {
            setTabBadge(tabName, '!', { warning: true, title: `Couldn't load: ${section.error}` });
        } else if (section.status === 'ok') {
            const badge = getBadge(section.data);

            if (badge) {
                setTabBadge(tabName, badge.text, badge);
            }
        }
    }
}
