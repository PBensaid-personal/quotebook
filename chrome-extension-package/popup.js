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

  async authenticateFixed() {
    this.showStatus('Starting authentication...', 'info');

    try {
      // Clear any existing tokens first
      try {
        const tokenResult = await chrome.identity.getAuthToken({ interactive: false });
        if (tokenResult) {
          // Handle both old format (string) and new format (object)
          const tokenToRemove = typeof tokenResult === 'object' ? tokenResult.token : tokenResult;
          await chrome.identity.removeCachedAuthToken({ token: tokenToRemove });
        }
      } catch (e) {
        // No cached token to remove
      }

      // Request new token with interactive prompt
      const tokenResult = await chrome.identity.getAuthToken({ 
        interactive: true
      });

      let accessToken;

      // Handle both new object format and old string format
      if (typeof tokenResult === 'object' && tokenResult !== null) {
        if (tokenResult.token) {
          accessToken = tokenResult.token;

          // Verify we have the required scope
          const grantedScopes = tokenResult.grantedScopes || [];
          const hasSheetScope = grantedScopes.some(scope => 
            scope.includes('spreadsheets') || scope.includes('sheets')
          );

          if (!hasSheetScope) {
            throw new Error('Missing required Google Sheets permission');
          }
        } else {
          throw new Error('Authentication failed - no token received');
        }
      } else if (typeof tokenResult === 'string' && tokenResult) {
        accessToken = tokenResult;
      } else {
        throw new Error('Authentication failed - invalid response');
      }

      this.accessToken = accessToken;
      this.showStatus('Authentication successful!', 'success');
      this.debugLog(`Access token received: ${accessToken.substring(0, 20)}...`);
      this.setupSpreadsheet();

    } catch (error) {
      this.showStatus(`Auth error: ${error.message}`, 'error');
      this.debugLog(`Chrome runtime error: ${error.message}`);
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