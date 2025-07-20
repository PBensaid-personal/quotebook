// Working Chrome Extension OAuth using launchWebAuthFlow
class WorkingQuoteCollector {
  constructor() {
    // Use Web Application client ID instead of Chrome Extension
    this.clientId = '184152653641-m443n0obiua9uotnkts6lsbbo8ikks80.apps.googleusercontent.com';
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
      const result = await chrome.storage.local.get(['accessToken', 'spreadsheetId']);
      if (result.accessToken) {
        this.accessToken = result.accessToken;
        this.spreadsheetId = result.spreadsheetId;
        
        // Test if token still works
        const isValid = await this.testToken();
        if (isValid) {
          this.showMainSection();
          return;
        }
      }
      
      this.showAuthSection();
    } catch (error) {
      this.log('Auth check failed: ' + error.message);
      this.showAuthSection();
    }
  }

  async testToken() {
    try {
      const response = await fetch(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${this.accessToken}`);
      return response.ok;
    } catch {
      return false;
    }
  }

  authenticate() {
    this.showStatus('Starting authentication...', 'info');
    this.log('Starting OAuth flow with launchWebAuthFlow');
    
    // Use the extension's redirect URI
    const redirectUri = chrome.identity.getRedirectURL();
    this.log('Redirect URI: ' + redirectUri);
    
    // Build OAuth URL for Web Application flow
    const authUrl = `https://accounts.google.com/o/oauth2/auth?` +
      `client_id=${this.clientId}&` +
      `response_type=token&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `scope=${encodeURIComponent('https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file')}`;

    this.log('Auth URL: ' + authUrl);

    // Launch web auth flow
    chrome.identity.launchWebAuthFlow({
      url: authUrl,
      interactive: true
    }, (responseUrl) => {
      this.handleAuthResponse(responseUrl);
    });
  }

  handleAuthResponse(responseUrl) {
    if (chrome.runtime.lastError) {
      this.log('Auth error: ' + chrome.runtime.lastError.message);
      this.showStatus('Authentication failed: ' + chrome.runtime.lastError.message, 'error');
      return;
    }

    if (!responseUrl) {
      this.log('No response URL received');
      this.showStatus('Authentication cancelled', 'error');
      return;
    }

    this.log('Response URL: ' + responseUrl);

    try {
      // Parse the fragment to get the access token
      const url = new URL(responseUrl);
      const fragment = url.hash.substring(1);
      const params = new URLSearchParams(fragment);
      
      const accessToken = params.get('access_token');
      const error = params.get('error');

      if (error) {
        this.log('OAuth error: ' + error);
        this.showStatus('OAuth error: ' + error, 'error');
        return;
      }

      if (accessToken) {
        this.accessToken = accessToken;
        this.log('Access token received: ' + accessToken.substring(0, 20) + '...');
        this.showStatus('Authentication successful!', 'success');
        this.setupSpreadsheet();
      } else {
        this.log('No access token in response');
        this.showStatus('Failed to get access token', 'error');
      }
    } catch (error) {
      this.log('Error parsing response: ' + error.message);
      this.showStatus('Error parsing response: ' + error.message, 'error');
    }
  }

  async setupSpreadsheet() {
    try {
      this.showStatus('Setting up Google Sheets...', 'info');
      this.log('Setting up spreadsheet');

      // Check for existing spreadsheet
      const stored = await chrome.storage.local.get(['spreadsheetId']);
      if (stored.spreadsheetId) {
        this.spreadsheetId = stored.spreadsheetId;
        this.log('Using existing spreadsheet: ' + this.spreadsheetId);
        this.showMainSection();
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

      if (response.ok) {
        const data = await response.json();
        this.spreadsheetId = data.spreadsheetId;
        
        // Store credentials
        await chrome.storage.local.set({
          accessToken: this.accessToken,
          spreadsheetId: this.spreadsheetId
        });

        // Add headers
        await this.addHeaders();
        
        this.showStatus('Google Sheets connected!', 'success');
        this.showMainSection();
        
        this.log('Spreadsheet created successfully: ' + this.spreadsheetId);
      } else {
        const error = await response.text();
        this.log('Spreadsheet creation failed: ' + error);
        this.showStatus(`Failed to create spreadsheet: ${response.status}`, 'error');
      }

    } catch (error) {
      this.log('Setup error: ' + error.message);
      this.showStatus(`Setup error: ${error.message}`, 'error');
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

    this.log('Headers response: ' + response.status);
  }

  async loadSelectedText() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      try {
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'getSelectedText' });
        
        if (response && response.selectedText) {
          document.getElementById('content').value = response.selectedText;
          document.getElementById('title').value = tab.title || '';
          this.log('Loaded selected text');
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
    console.log('[WorkingQuotes]', message);
  }
}

// Initialize
new WorkingQuoteCollector();