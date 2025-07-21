// Background service worker for Quote Collector extension
class QuoteCollectorBackground {
  constructor() {
    this.init();
  }

  init() {
    chrome.runtime.onInstalled.addListener((details) => {
      if (details.reason === 'install') {
        this.handleFirstInstall();
      }
    });
  }

  handleFirstInstall() {
    chrome.storage.local.set({
      autoCapture: true,
      showNotifications: true,
      defaultTags: []
    });

    console.log('Extension installed successfully');
  }
}

new QuoteCollectorBackground();