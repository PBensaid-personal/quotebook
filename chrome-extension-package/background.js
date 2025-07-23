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
      // Create "My quotes" context menu item (first position)
      chrome.contextMenus.create({
        id: "open-full-page",
        title: "My quotes",
        contexts: ["action"] // This targets the extension icon specifically
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
    }
  }
}

// Initialize background script
new QuoteCollectorBackground();