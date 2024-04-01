chrome.devtools.panels.create(
    "Nuxt Assistant",
    'images/icon128.png',
    "nuxt-assistant-panel.html"
);

chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    if (changeInfo.status === 'complete') {
        chrome.runtime.sendMessage({ type: 'page-navigation', tabId });
    }
});

