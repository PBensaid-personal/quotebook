// Chrome Extension with proper OAuth2 manifest configuration
class ChromeExtensionQuotes {
  constructor() {
    this.accessToken = null;
    this.spreadsheetId = null;
    this.init();
  }

  async init() {
    this.setupEventListeners();
    await this.checkAuth();
    await this.loadSelectedText();
  }

  setupEventListeners() {
    document.getElementById('auth-button').addEventListener('click', () => {
      this.authenticate();
    });

    document.getElementById('save-button').addEventListener('click', () => {
      this.saveQuote();
    });
  }

  async checkAuth() {
    try {
      // Try to get existing token silently
      const token = await chrome.identity.getAuthToken({ interactive: false });
      
      if (token) {
        this.log('Found existing token');
        this.accessToken = token;
        
        // Verify token works
        const isValid = await this.testToken();
        if (isValid) {
          await this.setupSpreadsheet();
          this.showMainSection();
          return;
        }
      }
      
      this.showAuthSection();
    } catch (error) {
      this.log('No existing auth: ' + error.message);
      this.showAuthSection();
    }
  }

  async testToken() {
    try {
      const response = await fetch(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${this.accessToken}`);
      const data = await response.json();
      
      if (response.ok) {
        this.log('Token valid: ' + data.scope);
        return true;
      } else {
        this.log('Token invalid: ' + data.error);
        return false;
      }
    } catch (error) {
      this.log('Token test failed: ' + error.message);
      return false;
    }
  }

  async authenticate() {
    try {
      this.showStatus('Authenticating with Google...', 'info');
      this.log('Starting interactive authentication');
      
      // Clear any bad cached tokens
      try {
        await chrome.identity.clearAllCachedAuthTokens();
        this.log('Cleared cached tokens');
      } catch (e) {
        this.log('No tokens to clear');
      }

      // Get new token interactively
      const token = await chrome.identity.getAuthToken({ interactive: true });
      
      if (!token) {
        throw new Error('No token received from Google');
      }

      this.log('Received token: ' + token.substring(0, 20) + '...');
      this.accessToken = token;

      // Test the token
      const isValid = await this.testToken();
      if (!isValid) {
        throw new Error('Token validation failed');
      }

      await this.setupSpreadsheet();
      this.showStatus('Authentication successful!', 'success');
      this.showMainSection();

    } catch (error) {
      this.log('Auth failed: ' + error.message);
      this.showStatus('Authentication failed: ' + error.message, 'error');
      
      // Show specific guidance based on error
      if (error.message.includes('OAuth2 not granted')) {
        this.showStatus('Make sure you are added as a test user in OAuth consent screen', 'error');
      } else if (error.message.includes('invalid_client')) {
        this.showStatus('OAuth client configuration issue - check client ID', 'error');
      }
    }
  }

  async setupSpreadsheet() {
    try {
      this.log('Setting up spreadsheet...');
      
      // Check for existing spreadsheet
      const stored = await chrome.storage.local.get(['spreadsheetId']);
      if (stored.spreadsheetId) {
        this.spreadsheetId = stored.spreadsheetId;
        this.log('Using existing spreadsheet: ' + this.spreadsheetId);
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
              title: 'Saved Quotes'
            }
          }]
        })
      });

      this.log('Spreadsheet creation response: ' + response.status);

      if (!response.ok) {
        const error = await response.text();
        this.log('Spreadsheet creation failed: ' + error);
        throw new Error(`Failed to create spreadsheet: ${response.status}`);
      }

      const data = await response.json();
      this.spreadsheetId = data.spreadsheetId;
      
      // Store for future use
      await chrome.storage.local.set({
        accessToken: this.accessToken,
        spreadsheetId: this.spreadsheetId
      });

      // Add headers
      await this.addHeaders();
      
      this.log('Spreadsheet created: ' + this.spreadsheetId);

    } catch (error) {
      this.log('Spreadsheet setup failed: ' + error.message);
      throw error;
    }
  }

  async addHeaders() {
    const headers = ['Date', 'Title', 'Content', 'URL', 'Notes'];
    
    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}/values/A1:E1?valueInputOption=RAW`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        values: [headers]
      })
    });

    this.log('Headers added: ' + response.status);
  }

  async loadSelectedText() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Try to get selected text from content script
      try {
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'getSelectedText' });
        
        if (response && response.selectedText) {
          document.getElementById('content').value = response.selectedText;
          document.getElementById('title').value = tab.title || '';
          this.log('Loaded selected text: ' + response.selectedText.substring(0, 50) + '...');
        }
      } catch (e) {
        this.log('Could not get selected text: ' + e.message);
      }
    } catch (error) {
      this.log('Could not access tab: ' + error.message);
    }
  }

  async saveQuote() {
    try {
      const title = document.getElementById('title').value;
      const content = document.getElementById('content').value;
      const notes = document.getElementById('notes').value;

      if (!content.trim()) {
        this.showStatusMain('Please enter some content to save', 'error');
        return;
      }

      this.showStatusMain('Saving to Google Sheets...', 'info');

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const row = [
        new Date().toLocaleDateString(),
        title || 'Untitled',
        content,
        tab.url,
        notes
      ];

      const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}/values/A:E:append?valueInputOption=RAW`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          values: [row]
        })
      });

      if (response.ok) {
        this.showStatusMain('Saved successfully!', 'success');
        this.log('Quote saved successfully');
        
        // Clear form
        document.getElementById('title').value = '';
        document.getElementById('content').value = '';
        document.getElementById('notes').value = '';
        
        setTimeout(() => window.close(), 1500);
      } else {
        const error = await response.text();
        this.log('Save failed: ' + error);
        this.showStatusMain(`Save failed: ${response.status}`, 'error');
      }

    } catch (error) {
      this.log('Save error: ' + error.message);
      this.showStatusMain(`Error: ${error.message}`, 'error');
    }
  }

  showAuthSection() {
    document.getElementById('auth-section').style.display = 'block';
    document.getElementById('main-section').classList.remove('active');
  }

  showMainSection() {
    document.getElementById('auth-section').style.display = 'none';
    document.getElementById('main-section').classList.add('active');
  }

  showStatus(message, type) {
    const status = document.getElementById('status');
    status.textContent = message;
    status.className = `status ${type}`;
    status.style.display = 'block';
    
    if (type === 'success') {
      setTimeout(() => {
        status.style.display = 'none';
      }, 3000);
    }
  }

  showStatusMain(message, type) {
    const status = document.getElementById('status-main');
    status.textContent = message;
    status.className = `status ${type}`;
    status.style.display = 'block';
    
    if (type === 'success') {
      setTimeout(() => {
        status.style.display = 'none';
      }, 3000);
    }
  }

  log(message) {
    const debug = document.getElementById('debug');
    debug.style.display = 'block';
    debug.textContent += new Date().toLocaleTimeString() + ': ' + message + '\n';
    debug.scrollTop = debug.scrollHeight;
    console.log('[ChromeQuotes]', message);
  }
}

// Initialize
new ChromeExtensionQuotes();