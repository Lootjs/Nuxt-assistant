// globalProperties registered by Nuxt, Vue Router and vue-i18n themselves, they aren't Nuxt modules
const builtinGlobalProperties = [
    '$nuxt', '$config', '$router', '$route', 'previousRoute', '$head',
    '$t', '$tc', '$te', '$tm', '$rt', '$d', '$n',
];

// moduleName -> module info, or null if it's not a Nuxt module
const modulesCache = new Map();

// Nuxt doesn't expose the list of installed modules, so they're guessed by globalProperties ($i18n -> i18n)
export function getModuleCandidates(globalProperties) {
    return globalProperties
        .filter(property => !builtinGlobalProperties.includes(property))
        .map(property => property.replace('$', ''));
}

export async function fetchModuleInfo(moduleName) {
    if (modulesCache.has(moduleName)) {
        return modulesCache.get(moduleName);
    }

    try {
        const response = await fetch(`https://api.nuxt.com/modules/${moduleName}`)
        const apiData = await response.json();

        if (!response.ok || apiData.statusCode === 404) {
            modulesCache.set(moduleName, null);

            return null;
        }

        const info = {
            name: apiData.name,
            description: apiData.description,
            website: apiData.website,
            category: apiData.category,
            maintainersCount: apiData.maintainers.length,
            compatibility: apiData.compatibility,
            latestVersion: apiData.stats.version,
            downloads: apiData.stats.downloads,
            stars: apiData.stats.stars,
        };
        modulesCache.set(moduleName, info);

        return info;
    } catch (e) {
        // Network errors aren't cached, so the module is retried on the next run
        return null;
    }
}
