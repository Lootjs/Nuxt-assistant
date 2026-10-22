const DEFAULT_RESPONSE_THRESHOLD = 20;

export const settings = {
    // Page size of data trees (src/tree.js): items shown at once before the "Show more" button
    responseThreshold: DEFAULT_RESPONSE_THRESHOLD,
};

export function loadSettings() {
    return new Promise(resolve => {
        chrome.storage.local.get('responseThreshold', data => {
            settings.responseThreshold = data.responseThreshold || DEFAULT_RESPONSE_THRESHOLD;
            document.getElementById('response-threshold-config').value = settings.responseThreshold;
            resolve();
        });
    });
}

export function setupSettings({ onSave }) {
    document.getElementById('save-settings').addEventListener('click', () => {
        const thresholdValue = parseInt(document.getElementById('response-threshold-config').value);
        settings.responseThreshold = thresholdValue || DEFAULT_RESPONSE_THRESHOLD;
        chrome.storage.local.set({ responseThreshold: thresholdValue }, () => {
            if (chrome.runtime.lastError) {
                console.error(chrome.runtime.lastError);
            }
        });
        onSave();
    });
}
