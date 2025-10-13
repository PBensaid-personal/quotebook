// Background service worker for Quote Collector extension
class QuoteCollectorBackground {
  constructor() {
    this.init();
  }

  init() {
    // Handle extension installation
    chrome.runtime.onInstalled.addListener((details) => {
      if (details.reason === 'install') {
        this.handleFirstInstall();
      }
      // Create context menu items for extension icon
      this.createContextMenus();
    });

    // Handle extension icon click
    chrome.action.onClicked.addListener((tab) => {
      // Popup will open automatically due to manifest configuration
    });

    // Handle context menu clicks
    chrome.contextMenus.onClicked.addListener((info, tab) => {
      this.handleContextMenuClick(info, tab);
    });
  }

  async handleFirstInstall() {
    // Set default settings
    await chrome.storage.local.set({
      autoCapture: true,
      showNotifications: true,
      defaultTags: []
    });

    console.log('Extension installed successfully');
    
    // Auto-open popup for first-time users
    try {
      // Open the popup in a new tab for first-time users
      // This provides a better welcome experience
      chrome.tabs.create({ 
        url: chrome.runtime.getURL('popup.html'),
        active: true
      });
      
      
    } catch (error) {
      console.log('Could not auto-open popup:', error);
      // This is not critical - the user can still click the extension icon
    }
  }

  createContextMenus() {
    // Remove any existing context menu items first
    chrome.contextMenus.removeAll(() => {
      // Create "My quotes" context menu item (first position)
      chrome.contextMenus.create({
        id: "open-full-page",
        title: "My quotes",
        contexts: ["action"] // This targets the extension icon specifically
      });

      // Create "Disconnect" context menu item
      chrome.contextMenus.create({
        id: "logout",
        title: "Disconnect from Google",
        contexts: ["action"]
      });

      console.log('Context menu created for extension icon');
    });
  }

  handleContextMenuClick(info, tab) {
    if (info.menuItemId === "open-full-page") {
      // Open the full page view in a new tab
      chrome.tabs.create({ 
        url: chrome.runtime.getURL('fullpage.html')
      });
    } else if (info.menuItemId === "logout") {
      this.performLogout();
    }
  }

  async performLogout() {
    try {
      console.log('Performing logout...');
      
      // Clear Chrome Identity tokens - try multiple approaches
      try {
        // Method 1: Clear any cached token
        const token = await chrome.identity.getAuthToken({ interactive: false });
        if (token) {
          const tokenToRemove = typeof token === 'object' ? token.token : token;
          await chrome.identity.removeCachedAuthToken({ token: tokenToRemove });
          console.log('Chrome Identity token cleared');
        }
      } catch (e) {
        console.log('No cached token to clear');
      }
      
      // Method 2: Clear all cached auth tokens (if available)
      if (chrome.identity.clearAllCachedAuthTokens) {
        await new Promise((resolve) => {
          chrome.identity.clearAllCachedAuthTokens(() => {
            console.log('All cached auth tokens cleared');
            resolve();
          });
        });
      }
      
      // Clear all stored extension data
      await chrome.storage.local.clear();
      await chrome.storage.sync.clear(); // Also clear sync storage
      
      // Set logout flag to prevent automatic re-authorization
      await chrome.storage.local.set({ userLoggedOut: true });
      console.log('Extension storage cleared and logout flag set');
      
      // Force popup to reset by sending message to any open popups
      try {
        chrome.runtime.sendMessage({action: 'logout'});
      } catch (e) {
        // No popup open, that's fine
      }
      
      console.log('User disconnected successfully');
      
      // Show notification that logout was successful
      chrome.action.setBadgeText({text: '✓'});
      chrome.action.setBadgeBackgroundColor({color: '#4CAF50'});
      setTimeout(() => {
        chrome.action.setBadgeText({text: ''});
      }, 3000);
      
    } catch (error) {
      console.error('Logout error:', error);
      
      // Show error badge
      chrome.action.setBadgeText({text: '✗'});
      chrome.action.setBadgeBackgroundColor({color: '#f44336'});
      setTimeout(() => {
        chrome.action.setBadgeText({text: ''});
      }, 3000);
    }
  }
}

// Initialize background script
new QuoteCollectorBackground();