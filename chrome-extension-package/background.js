// Background script for Quote Collector extension
console.log('Background script initializing...');

// Global storage for authentication state - this ensures sync between popup and fullpage
let authState = {
  accessToken: null,
  spreadsheetId: null,
  isAuthenticated: false
};

// Load initial auth state from storage on startup
chrome.storage.local.get(['googleAccessToken', 'googleSpreadsheetId']).then(result => {
  if (result.googleAccessToken && result.googleSpreadsheetId) {
    authState = {
      accessToken: result.googleAccessToken,
      spreadsheetId: result.googleSpreadsheetId,
      isAuthenticated: true
    };
    console.log('Background: Loaded auth state from storage', { hasToken: !!authState.accessToken, spreadsheetId: authState.spreadsheetId });
  }
});

chrome.runtime.onInstalled.addListener(() => {
  console.log('Quote Collector extension installed');
});

// Handle messages from popup and fullpage
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request.action);
  
  if (request.action === 'getAuthState') {
    console.log('Background returning auth state:', { hasToken: !!authState.accessToken, spreadsheetId: authState.spreadsheetId });
    sendResponse(authState);
    return true;
  }
  
  if (request.action === 'setAuthState') {
    authState = { ...authState, ...request.data };
    console.log('Background: Auth state updated:', { hasToken: !!authState.accessToken, spreadsheetId: authState.spreadsheetId });
    
    // Also save to storage for persistence
    chrome.storage.local.set({
      googleAccessToken: authState.accessToken,
      googleSpreadsheetId: authState.spreadsheetId
    }).then(() => {
      console.log('Background: Auth state saved to storage');
    });
    
    sendResponse({ success: true });
    return true;
  }
  
  if (request.action === 'clearAuthState') {
    authState = {
      accessToken: null,
      spreadsheetId: null,
      isAuthenticated: false
    };
    console.log('Background: Auth state cleared');
    
    // Clear from storage too
    chrome.storage.local.remove(['googleAccessToken', 'googleSpreadsheetId']);
    
    sendResponse({ success: true });
    return true;
  }
});

// Listen for tab updates to inject content script if needed
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // Only inject on http/https pages
    if (tab.url.startsWith('http://') || tab.url.startsWith('https://')) {
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content.js']
      }).catch(() => {
        // Ignore errors (script may already be injected or page may not allow it)
      });
    }
  }
});