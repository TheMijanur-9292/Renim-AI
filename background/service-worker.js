/**
 * Renim AI - Background Service Worker (Manifest V3)
 * Manages side panel initialization, cross-tab message relays, and lifecycle events.
 */

// Configure side panel to open when clicking the extension icon
chrome.runtime.onInstalled.addListener(() => {
  console.log('[Renim AI] Extension installed.');
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error) => {
    console.error('[Renim AI] Error setting panel behavior:', error);
  });
});

// Relay messages between content script and side panel if required
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'RENIM_CHECK_ACTIVE_MEET') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      const isMeet = activeTab?.url?.includes('meet.google.com');
      sendResponse({ isMeet, tabId: activeTab?.id, url: activeTab?.url });
    });
    return true; // async response
  }
});
