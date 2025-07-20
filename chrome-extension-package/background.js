// Background service worker for WebCapture extension
class WebCaptureBackground {
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

    // Open welcome page
    chrome.tabs.create({
      url: chrome.runtime.getURL('welcome.html')
    });
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
        // Test token with a simple API call
        const response = await fetch('https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=' + result.accessToken);
        
        if (!response.ok) {
          // Token is invalid, clear it
          await chrome.storage.local.remove(['accessToken', 'spreadsheetId']);
          
          // Show notification
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icon-48.png',
            title: 'WebCapture',
            message: 'Please sign in again to continue saving to Google Sheets'
          });
        }
      }
    } catch (error) {
      console.error('Token check failed:', error);
    }
  }
}

// Initialize background script
new WebCaptureBackground();