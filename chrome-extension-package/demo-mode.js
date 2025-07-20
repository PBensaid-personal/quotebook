// Demo mode functionality for WebCapture extension
class DemoMode {
  constructor() {
    this.isDemo = true;
    this.demoData = [];
  }

  showDemoNotice() {
    const notice = document.createElement('div');
    notice.style.cssText = `
      background: #fff3cd;
      color: #856404;
      padding: 8px 12px;
      border: 1px solid #ffeaa7;
      border-radius: 4px;
      margin-bottom: 12px;
      font-size: 12px;
      text-align: center;
    `;
    notice.innerHTML = '⚠️ Demo Mode - Data saved locally only. Connect Google to sync to Sheets.';
    
    const container = document.querySelector('.popup-container');
    container.insertBefore(notice, container.firstChild);
  }

  async saveToLocal(data) {
    // Save to Chrome storage for demo
    const existingData = await chrome.storage.local.get(['demoData']);
    const currentData = existingData.demoData || [];
    
    const newEntry = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      ...data
    };
    
    currentData.unshift(newEntry);
    
    // Keep only last 10 entries
    if (currentData.length > 10) {
      currentData.splice(10);
    }
    
    await chrome.storage.local.set({ demoData: currentData });
    
    return newEntry;
  }

  async getDemoData() {
    const result = await chrome.storage.local.get(['demoData']);
    return result.demoData || [];
  }

  showSaveSuccess(title) {
    const successMsg = document.createElement('div');
    successMsg.style.cssText = `
      background: #d4edda;
      color: #155724;
      padding: 8px 12px;
      border: 1px solid #c3e6cb;
      border-radius: 4px;
      margin-top: 8px;
      font-size: 12px;
      text-align: center;
    `;
    successMsg.innerHTML = `✓ "${title}" saved locally. View in popup history.`;
    
    const container = document.querySelector('.popup-container');
    container.appendChild(successMsg);
    
    // Remove after 3 seconds
    setTimeout(() => {
      if (successMsg.parentNode) {
        successMsg.remove();
      }
    }, 3000);
  }
}

// Export for use in popup.js
window.DemoMode = DemoMode;