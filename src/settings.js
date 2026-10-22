const DEFAULT_RESPONSE_THRESHOLD = 20;

export const settings = {
    // Max number of items shown for an array response on the SSR Data tab
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
