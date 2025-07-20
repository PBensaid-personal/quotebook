// Simple Chrome extension popup for saving to Google Sheets
class WebCapturePopup {
  constructor() {
    this.isAuthenticated = false;
    this.accessToken = null;
    this.spreadsheetId = null;
    this.init();
  }

  async init() {
    await this.checkAuthStatus();
    this.setupEventListeners();
    await this.loadPageData();
  }

  async checkAuthStatus() {
    try {
      console.log('Checking authentication status...');
      
      // First try to get a token from Chrome identity API
      const chromeToken = await chrome.identity.getAuthToken({ interactive: false });
      
      if (chromeToken) {
        console.log('Found Chrome token, validating...');
        this.accessToken = chromeToken;
        
        // Test if token is valid
        try {
          const testResponse = await fetch('https://www.googleapis.com/oauth2/v1/userinfo', {
            headers: { 'Authorization': `Bearer ${chromeToken}` }
          });
          
          if (testResponse.ok) {
            console.log('Token is valid, setting up authenticated state...');
            this.isAuthenticated = true;
            
            // Get or create spreadsheet
            await this.setupSpreadsheet();
            
            // Store authentication
            await chrome.storage.local.set({
              accessToken: this.accessToken,
              spreadsheetId: this.spreadsheetId
            });
            
            this.showMainScreen();
            return;
          } else {
            console.log('Token is invalid, clearing...');
            if (typeof chromeToken === 'string') {
              await chrome.identity.removeCachedAuthToken({ token: chromeToken });
            }
          }
        } catch (tokenError) {
          console.log('Token validation failed:', tokenError);
          if (typeof chromeToken === 'string') {
            await chrome.identity.removeCachedAuthToken({ token: chromeToken });
          }
        }
      }
      
      // Check stored authentication as fallback
      const result = await chrome.storage.local.get(['accessToken', 'spreadsheetId']);
      if (result.accessToken) {
        console.log('Found stored token, using it...');
        this.isAuthenticated = true;
        this.accessToken = result.accessToken;
        this.spreadsheetId = result.spreadsheetId;
        this.showMainScreen();
      } else {
        console.log('No valid authentication found, showing auth screen');
        this.showAuthScreen();
      }
      
    } catch (error) {
      console.error('Auth check failed:', error);
      this.showAuthScreen();
    }
  }

  showAuthScreen() {
    document.getElementById('auth-screen').classList.add('active');
    document.getElementById('main-screen').classList.remove('active');
  }

  showMainScreen() {
    document.getElementById('auth-screen').classList.remove('active');
    document.getElementById('main-screen').classList.add('active');
  }

  setupEventListeners() {
    // Sign in button
    document.getElementById('sign-in-btn').addEventListener('click', () => {
      this.authenticateWithGoogle();
    });

    // Save button
    document.getElementById('save-btn').addEventListener('click', () => {
      this.saveToSheets();
    });

    // View sheets button
    document.getElementById('view-sheets-btn').addEventListener('click', () => {
      this.openGoogleSheets();
    });

    // Settings button
    document.getElementById('settings-btn').addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });
  }

  async authenticateWithGoogle() {
    try {
      console.log('Starting interactive authentication...');
      this.showStatus('Authenticating with Google...', 'info');
      
      // Request token with user interaction
      const newToken = await chrome.identity.getAuthToken({
        interactive: true
      });
      
      if (!newToken) {
        throw new Error('OAuth2 not granted or revoked');
      }

      console.log('Received token, validating...');
      this.accessToken = newToken;

      // Test the token by making a simple API call
      const testResponse = await fetch('https://www.googleapis.com/oauth2/v1/userinfo', {
        headers: { 'Authorization': `Bearer ${this.accessToken}` }
      });

      if (!testResponse.ok) {
        throw new Error('Token validation failed');
      }

      console.log('Token validated, setting up spreadsheet...');
      
      // Create or get spreadsheet
      await this.setupSpreadsheet();
      
      // Store authentication
      await chrome.storage.local.set({
        accessToken: this.accessToken,
        spreadsheetId: this.spreadsheetId
      });

      this.isAuthenticated = true;
      this.showMainScreen();
      this.showStatus('Connected to Google Sheets!', 'success');
      
    } catch (error) {
      console.error('Authentication failed:', error);
      
      // Clear any bad tokens
      try {
        if (this.accessToken && typeof this.accessToken === 'string') {
          await chrome.identity.removeCachedAuthToken({ token: this.accessToken });
        }
      } catch (e) {
        console.log('No token to clear');
      }
      
      // Show specific error messages
      if (error.message.includes('OAuth') || error.message.includes('bad client id')) {
        this.showStatus('Authentication setup incomplete. This extension needs proper Google Cloud configuration to work.', 'error');
      } else if (error.message.includes('Token validation failed')) {
        this.showStatus('Authentication token expired. Please sign in again.', 'error');
      } else {
        this.showStatus('Failed to connect to Google: ' + error.message, 'error');
      }
    }
  }

  async setupSpreadsheet() {
    try {
      // Check if user already has a WebCapture spreadsheet
      const existingSheet = await chrome.storage.local.get(['spreadsheetId']);
      
      if (existingSheet.spreadsheetId) {
        this.spreadsheetId = existingSheet.spreadsheetId;
        return;
      }

      // Create new spreadsheet
      const response = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          properties: {
            title: 'Quote Collector Collection'
          },
          sheets: [{
            properties: {
              title: 'Saved Content'
            }
          }]
        })
      });

      const data = await response.json();
      this.spreadsheetId = data.spreadsheetId;

      // Add headers to the spreadsheet
      await this.addHeaders();

    } catch (error) {
      console.error('Failed to setup spreadsheet:', error);
      throw error;
    }
  }

  async addHeaders() {
    const headers = [
      'Date Saved',
      'Title',
      'Selected Text',
      'Page URL',
      'Tags',
      'Notes',
      'Source Domain'
    ];

    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}/values/A1:G1?valueInputOption=RAW`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        values: [headers]
      })
    });
  }

  async loadPageData() {
    try {
      // Get current tab info
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Auto-fill title from page title
      document.getElementById('title-input').placeholder = tab.title || 'Add a title...';

      // Generate suggested tags from URL  
      this.generateSuggestedTags(tab.url);

      // Try to get selected text from content script (with timeout)
      try {
        const response = await Promise.race([
          chrome.tabs.sendMessage(tab.id, { action: 'getSelectedText' }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 1000))
        ]);
        
        if (response?.selectedText) {
          document.getElementById('selected-text').style.display = 'block';
          document.getElementById('selected-text').textContent = response.selectedText;
        }
      } catch (contentError) {
        console.log('Content script not ready or no selected text:', contentError.message);
        // This is normal - content script may not be loaded yet
      }

    } catch (error) {
      console.error('Failed to load page data:', error);
      // Gracefully handle all errors
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        document.getElementById('title-input').placeholder = tab.title || 'Add a title...';
      }
    }
  }

  generateSuggestedTags(url) {
    const domain = new URL(url).hostname.replace('www.', '');
    const tags = [domain];
    
    // Add common tags based on domain
    const domainTags = {
      'github.com': ['code', 'development'],
      'stackoverflow.com': ['programming', 'help'],
      'medium.com': ['article', 'blog'],
      'youtube.com': ['video'],
      'twitter.com': ['social', 'news'],
      'linkedin.com': ['professional', 'career']
    };

    if (domainTags[domain]) {
      tags.push(...domainTags[domain]);
    }

    const container = document.getElementById('suggested-tags');
    container.innerHTML = '';
    
    tags.forEach(tag => {
      const tagEl = document.createElement('span');
      tagEl.className = 'tag';
      tagEl.textContent = tag;
      tagEl.style.cursor = 'pointer';
      tagEl.onclick = () => this.addTag(tag);
      container.appendChild(tagEl);
    });
  }

  addTag(tag) {
    const input = document.getElementById('tags-input');
    const currentTags = input.value.split(',').map(t => t.trim()).filter(t => t);
    
    if (!currentTags.includes(tag)) {
      currentTags.push(tag);
      input.value = currentTags.join(', ');
    }
  }

  async saveToSheets() {
    if (!this.isAuthenticated) {
      this.showStatus('Please sign in first', 'error');
      return;
    }

    try {
      const saveBtn = document.getElementById('save-btn');
      saveBtn.textContent = 'Saving...';
      saveBtn.disabled = true;

      // Get current tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Get form data
      const selectedText = document.getElementById('selected-text').textContent || '';
      const title = document.getElementById('title-input').value || tab.title;
      const tags = document.getElementById('tags-input').value;
      const notes = document.getElementById('notes-input').value;
      
      // Prepare row data
      const rowData = [
        new Date().toLocaleString(),
        title,
        selectedText,
        tab.url,
        tags,
        notes,
        new URL(tab.url).hostname.replace('www.', '')
      ];

      // Append to spreadsheet
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}/values/A:G:append?valueInputOption=RAW`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          values: [rowData]
        })
      });

      this.showStatus('Saved to Google Sheets!', 'success');
      
      // Clear form
      document.getElementById('title-input').value = '';
      document.getElementById('tags-input').value = '';
      document.getElementById('notes-input').value = '';

    } catch (error) {
      console.error('Failed to save:', error);
      this.showStatus('Failed to save', 'error');
    } finally {
      const saveBtn = document.getElementById('save-btn');
      saveBtn.textContent = 'Save to Google Sheets';
      saveBtn.disabled = false;
    }
  }

  openGoogleSheets() {
    if (this.spreadsheetId) {
      chrome.tabs.create({
        url: `https://docs.google.com/spreadsheets/d/${this.spreadsheetId}/edit`
      });
    }
  }

  showStatus(message, type) {
    const statusEl = document.getElementById('status-message');
    statusEl.textContent = message;
    statusEl.className = `status status-${type}`;
    statusEl.style.display = 'block';
    
    setTimeout(() => {
      statusEl.style.display = 'none';
    }, 3000);
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new WebCapturePopup();
});