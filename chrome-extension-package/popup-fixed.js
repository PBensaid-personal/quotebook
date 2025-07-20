// Fixed OAuth for Chrome Extension
class FixedOAuthCollector {
  constructor() {
    // Using a web application client ID instead of Chrome extension client
    this.clientId = '184152653641-m443n0obiua9uotnkts6lsbbo8ikks80.apps.googleusercontent.com';
    this.clientSecret = null; // Web apps don't need client secret for implicit flow
    this.accessToken = null;
    this.spreadsheetId = null;
    this.init();
  }

  async init() {
    this.setupEventListeners();
    await this.checkExistingAuth();
    await this.loadSelectedText();
  }

  setupEventListeners() {
    document.getElementById('auth-button').addEventListener('click', () => {
      this.authenticateFixed();
    });

    document.getElementById('save-button').addEventListener('click', () => {
      this.saveQuote();
    });
  }

  async checkExistingAuth() {
    try {
      const result = await chrome.storage.local.get(['accessToken', 'spreadsheetId']);
      if (result.accessToken) {
        this.accessToken = result.accessToken;
        this.spreadsheetId = result.spreadsheetId;
        
        // Verify token is still valid
        const isValid = await this.validateToken();
        if (isValid) {
          this.showMainInterface();
          return;
        }
      }
    } catch (error) {
      console.log('No existing auth found');
    }
    
    this.showAuthInterface();
  }

  async validateToken() {
    try {
      const response = await fetch(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${this.accessToken}`);
      return response.ok;
    } catch {
      return false;
    }
  }

  authenticateFixed() {
    this.showStatus('Starting authentication...', 'info');
    
    // Use extension ID as redirect URI
    const extensionId = chrome.runtime.id;
    const redirectUri = `https://${extensionId}.chromiumapp.org/`;
    
    const scope = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file';
    
    // Use implicit flow for web application
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${this.clientId}&` +
      `response_type=token&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `scope=${encodeURIComponent(scope)}&` +
      `state=extension_auth`;

    this.debugLog(`Extension ID: ${extensionId}`);
    this.debugLog(`Redirect URI: ${redirectUri}`);
    this.debugLog(`Auth URL: ${authUrl}`);

    // Open OAuth flow
    chrome.identity.launchWebAuthFlow({
      url: authUrl,
      interactive: true
    }, (responseUrl) => {
      this.handleAuthResponse(responseUrl);
    });
  }

  handleAuthResponse(responseUrl) {
    if (chrome.runtime.lastError) {
      this.showStatus(`Auth error: ${chrome.runtime.lastError.message}`, 'error');
      this.debugLog(`Chrome runtime error: ${chrome.runtime.lastError.message}`);
      return;
    }

    if (!responseUrl) {
      this.showStatus('Authentication cancelled', 'error');
      return;
    }

    this.debugLog(`Response URL: ${responseUrl}`);

    try {
      // Extract access token from fragment
      const url = new URL(responseUrl);
      const fragment = url.hash.substring(1);
      const params = new URLSearchParams(fragment);
      
      const accessToken = params.get('access_token');
      const error = params.get('error');

      if (error) {
        this.showStatus(`OAuth error: ${error}`, 'error');
        this.debugLog(`OAuth error: ${error}`);
        return;
      }

      if (accessToken) {
        this.accessToken = accessToken;
        this.showStatus('Authentication successful!', 'success');
        this.debugLog(`Access token received: ${accessToken.substring(0, 20)}...`);
        this.setupSpreadsheet();
      } else {
        this.showStatus('Failed to get access token', 'error');
        this.debugLog('No access token in response URL');
      }
    } catch (error) {
      this.showStatus(`Error parsing response: ${error.message}`, 'error');
      this.debugLog(`Parse error: ${error}`);
    }
  }

  async setupSpreadsheet() {
    try {
      this.showStatus('Setting up Google Sheets...', 'info');

      // Check for existing spreadsheet
      const stored = await chrome.storage.local.get(['spreadsheetId']);
      if (stored.spreadsheetId) {
        this.spreadsheetId = stored.spreadsheetId;
        this.showStatus('Connected to existing spreadsheet', 'success');
        this.showMainInterface();
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

      this.debugLog(`Spreadsheet response status: ${response.status}`);

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
        this.showMainInterface();
        
        this.debugLog(`Spreadsheet created: ${this.spreadsheetId}`);
      } else {
        const error = await response.text();
        this.showStatus(`Failed to create spreadsheet: ${response.status}`, 'error');
        this.debugLog(`Spreadsheet creation failed: ${error}`);
      }

    } catch (error) {
      this.showStatus(`Setup error: ${error.message}`, 'error');
      this.debugLog(`Setup error: ${error}`);
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

    this.debugLog(`Headers response: ${response.status}`);
  }

  async loadSelectedText() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Try to get selected text
      try {
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'getSelectedText' });
        
        if (response && response.selectedText) {
          document.getElementById('content').value = response.selectedText;
          document.getElementById('title').value = tab.title || '';
        }
      } catch (e) {
        this.debugLog('Could not get selected text: ' + e.message);
      }
    } catch (error) {
      console.log('Could not access tab:', error);
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
        
        // Clear form
        document.getElementById('title').value = '';
        document.getElementById('content').value = '';
        document.getElementById('notes').value = '';
        
        setTimeout(() => window.close(), 1500);
      } else {
        const error = await response.text();
        this.showStatusMain(`Save failed: ${response.status}`, 'error');
        this.debugLog(`Save error: ${error}`);
      }

    } catch (error) {
      this.showStatusMain(`Error: ${error.message}`, 'error');
      this.debugLog(`Save error: ${error}`);
    }
  }

  showAuthInterface() {
    document.getElementById('auth-section').style.display = 'block';
    document.getElementById('main-section').classList.remove('active');
  }

  showMainInterface() {
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

  debugLog(message) {
    const debug = document.getElementById('debug');
    debug.style.display = 'block';
    debug.textContent += new Date().toLocaleTimeString() + ': ' + message + '\n';
    console.log('[FixedOAuth]', message);
  }
}

// Initialize the extension
new FixedOAuthCollector();