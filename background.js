// console.log('service worker')
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.event === 'supportMe') {
        chrome.tabs.create({
            url: 'https://www.patreon.com/user?u=45269161'
        })
    }
});
