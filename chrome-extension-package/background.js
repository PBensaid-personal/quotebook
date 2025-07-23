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

  handleFirstInstall() {
    // Set default settings
    chrome.storage.local.set({
      autoCapture: true,
      showNotifications: true,
      defaultTags: []
    });

    console.log('Extension installed successfully');
  }

  createContextMenus() {
    // Remove any existing context menu items first
    chrome.contextMenus.removeAll(() => {
      // Create "My quotes" context menu item
      chrome.contextMenus.create({
        id: "open-full-page",
        title: "My quotes",
        contexts: ["action"]
      });

      // Create separator
      chrome.contextMenus.create({
        id: "separator-1",
        type: "separator",
        contexts: ["action"]
      });

      // Create "Create web viewer" context menu item
      chrome.contextMenus.create({
        id: "create-web-viewer",
        title: "Create web viewer",
        contexts: ["action"]
      });

      // Create "Disconnect from Google" context menu item
      chrome.contextMenus.create({
        id: "disconnect-google",
        title: "Disconnect from Google",
        contexts: ["action"]
      });

      console.log('Context menu created for extension icon');
    });
  }

  async handleContextMenuClick(info, tab) {
    if (info.menuItemId === "open-full-page") {
      // Open the full page view in a new tab
      chrome.tabs.create({ 
        url: chrome.runtime.getURL('fullpage.html')
      });
    } else if (info.menuItemId === "create-web-viewer") {
      // Trigger web app creation
      await this.triggerWebAppCreation();
    } else if (info.menuItemId === "disconnect-google") {
      // Disconnect from Google
      await this.disconnectFromGoogle();
    }
  }

  async triggerWebAppCreation() {
    try {
      // Send message to popup to trigger web app creation
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Store a flag that web app creation was requested
      await chrome.storage.local.set({ webAppCreationRequested: true });
      
      // Open popup to trigger the web app creation
      chrome.action.openPopup();
      
      console.log('Web app creation triggered from context menu');
    } catch (error) {
      console.error('Failed to trigger web app creation:', error);
    }
  }

  async disconnectFromGoogle() {
    try {
      // Clear all stored authentication data
      await chrome.storage.local.clear();
      
      // Remove cached auth tokens
      try {
        const token = await chrome.identity.getAuthToken({ interactive: false });
        if (token) {
          const tokenToRemove = typeof token === 'object' ? token.token : token;
          await chrome.identity.removeCachedAuthToken({ token: tokenToRemove });
        }
      } catch (e) {
        // No cached token to remove
      }

      // Clear any auth token from identity cache
      try {
        await chrome.identity.clearAllCachedAuthTokens();
      } catch (e) {
        // Method might not be available
      }

      console.log('Disconnected from Google successfully');
      
      // Show notification
      try {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icon-48.png',
          title: 'Quotebook',
          message: 'Disconnected from Google Sheets. Click the extension to reconnect.'
        });
      } catch (notificationError) {
        console.log('Could not show notification, but disconnect was successful');
      }
      
    } catch (error) {
      console.error('Failed to disconnect from Google:', error);
    }
  }
}

// Initialize background script
new QuoteCollectorBackground();