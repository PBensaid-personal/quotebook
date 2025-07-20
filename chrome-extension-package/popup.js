// Simple Chrome extension popup for saving to Google Sheets
class QuoteCollectorPopup {
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
      
      if (chromeToken && typeof chromeToken === 'string') {
        console.log('Found Chrome token, validating...');
        this.accessToken = chromeToken;
        
        // Token found, proceed with setup
        console.log('Token found, setting up authenticated state...');
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
      
      if (!newToken || typeof newToken !== 'string') {
        throw new Error('OAuth2 not granted or revoked');
      }

      console.log('Received token, validating...');
      this.accessToken = newToken;

      // Token received, proceed with setup
      console.log('Token received, setting up spreadsheet...');
      
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
      
      // Show specific error messages with more detail
      if (error.message.includes('OAuth') || error.message.includes('bad client id')) {
        this.showStatus('OAuth configuration issue. Check Google Cloud Console setup.', 'error');
      } else if (error.message.includes('Token validation failed')) {
        this.showStatus(`Token validation failed: ${error.message}`, 'error');
      } else if (error.message.includes('403')) {
        this.showStatus('Permission denied. Check OAuth scopes in Google Cloud Console.', 'error');
      } else if (error.message.includes('401')) {
        this.showStatus('Authentication failed. Token may be invalid or expired.', 'error');
      } else {
        this.showStatus(`Authentication error: ${error.message}`, 'error');
      }
    }
  }

  async setupSpreadsheet() {
    try {
      // Check if user already has a Quote Collector spreadsheet
      const existingSheet = await chrome.storage.local.get(['spreadsheetId']);
      
      if (existingSheet.spreadsheetId) {
        this.spreadsheetId = existingSheet.spreadsheetId;
        return;
      }

      // Validate token
      if (!this.accessToken || typeof this.accessToken !== 'string') {
        throw new Error('Invalid access token - not a string');
      }
      
      // Create new spreadsheet
      console.log('Creating spreadsheet with token:', this.accessToken.substring(0, 20) + '...');
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
      
      console.log('Spreadsheet creation response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.log('Spreadsheet creation error:', errorText);
      }

      if (!response.ok) {
        throw new Error(`Failed to create spreadsheet: ${response.status}`);
      }

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
      container.appendChild(tagEl);
    });
  }

  async saveToSheets() {
    try {
      const saveBtn = document.getElementById('save-btn');
      saveBtn.textContent = 'Saving...';
      saveBtn.disabled = true;

      // Get current tab info
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Collect form data
      const title = document.getElementById('title-input').value || tab.title;
      const notes = document.getElementById('notes-input').value;
      const selectedText = document.getElementById('selected-text').textContent || '';
      const tags = document.getElementById('tags-input').value;
      
      // Prepare row data
      const rowData = [
        new Date().toISOString().split('T')[0], // Date
        title,
        selectedText,
        tab.url,
        tags,
        notes,
        new URL(tab.url).hostname
      ];

      // Append to spreadsheet
      const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}/values/A:G:append?valueInputOption=RAW`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          values: [rowData]
        })
      });

      if (response.ok) {
        this.showStatus('Saved to Google Sheets!', 'success');
      } else {
        throw new Error(`Failed to save: ${response.status}`);
      }

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
  new QuoteCollectorPopup();
});