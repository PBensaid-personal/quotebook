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
    });

    // Handle extension icon click
    chrome.action.onClicked.addListener((tab) => {
      // Popup will open automatically due to manifest configuration
    });

    // Handle auth token refresh
    this.setupTokenRefresh();
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

  setupTokenRefresh() {
    // Check token validity periodically
    chrome.alarms.create('tokenCheck', { periodInMinutes: 30 });
    
    chrome.alarms.onAlarm.addListener(async (alarm) => {
      if (alarm.name === 'tokenCheck') {
        await this.checkTokenValidity();
      }
    });
  }

  async checkTokenValidity() {
    try {
      const result = await chrome.storage.local.get(['accessToken']);
      
      if (result.accessToken) {
        try {
          // Use Chrome identity API to check token validity
          const token = await chrome.identity.getAuthToken({
            interactive: false
          });
          
          if (!token) {
            // Token is invalid, clear stored data
            await chrome.storage.local.remove(['accessToken', 'spreadsheetId']);
            
            console.log('Authentication token expired - user needs to sign in again');
          }
        } catch (error) {
          // Token expired or invalid
          await chrome.storage.local.remove(['accessToken', 'spreadsheetId']);
        }
      }
    } catch (error) {
      console.error('Token check failed:', error);
    }
  }
}

// Initialize background script
new QuoteCollectorBackground();