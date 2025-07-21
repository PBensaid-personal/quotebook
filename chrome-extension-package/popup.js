// Fixed OAuth for Chrome Extension
class FixedOAuthCollector {
  constructor() {
    this.clientId = '184152653641-m443n0obiua9uotnkts6lsbbo8ikks80.apps.googleusercontent.com';
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
      const tokenResult = await chrome.identity.getAuthToken({ interactive: false });

      if (tokenResult) {
        let accessToken;

        // Handle both new object format and old string format
        if (typeof tokenResult === 'object' && tokenResult !== null && tokenResult.token) {
          accessToken = tokenResult.token;
        } else if (typeof tokenResult === 'string') {
          accessToken = tokenResult;
        }

        if (accessToken) {
          this.accessToken = accessToken;

          const isValid = await this.validateToken();
          if (isValid) {
            await this.setupSpreadsheetIfNeeded();
            this.showMainInterface();
            return;
          } else {
            // Remove invalid token
            const tokenToRemove = typeof tokenResult === 'object' ? tokenResult.token : tokenResult;
            await chrome.identity.removeCachedAuthToken({ token: tokenToRemove });
          }
        }
      }
    } catch (error) {
      // No existing auth found, continue to show auth interface
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
      // Clear any existing tokens
      try {
        const oldToken = await chrome.identity.getAuthToken({ interactive: false });
        if (oldToken) {
          const tokenToRemove = typeof oldToken === 'object' ? oldToken.token : oldToken;
          await chrome.identity.removeCachedAuthToken({ token: tokenToRemove });
        }
      } catch (e) {
        // No cached token to remove
      }

      // Request new token
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
      await this.setupSpreadsheetIfNeeded();
      this.showMainInterface();

    } catch (error) {
      this.showStatus(`Auth error: ${error.message}`, 'error');
    }
  }

  async setupSpreadsheetIfNeeded() {
    try {
      // Check for existing spreadsheet
      const stored = await chrome.storage.local.get(['spreadsheetId']);
      if (stored.spreadsheetId) {
        this.spreadsheetId = stored.spreadsheetId;
        this.showStatus('Connected to existing spreadsheet', 'success');
        return;
      }

      this.showStatus('Setting up Google Sheets...', 'info');

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

      if (response.ok) {
        const data = await response.json();
        this.spreadsheetId = data.spreadsheetId;

        // Store credentials
        await chrome.storage.local.set({
          spreadsheetId: this.spreadsheetId
        });

        // Add headers
        await this.addHeaders();

        this.showStatus('Google Sheets connected!', 'success');
      } else {
        const error = await response.text();
        this.showStatus(`Failed to create spreadsheet: ${response.status}`, 'error');
      }

    } catch (error) {
      this.showStatus(`Setup error: ${error.message}`, 'error');
    }
  }

  async addHeaders() {
    const headers = ['Date', 'Title', 'Content', 'URL', 'Notes'];

    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}/values/A1:E1?valueInputOption=RAW`, {
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

  async loadSelectedText() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      try {
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'getSelectedText' });

        if (response && response.selectedText) {
          document.getElementById('content').value = response.selectedText;
          document.getElementById('title').value = tab.title || '';
        }
      } catch (e) {
        // Could not get selected text, this is normal for some pages
      }
    } catch (error) {
      // Could not access tab, this is normal
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
      }

    } catch (error) {
      this.showStatusMain(`Error: ${error.message}`, 'error');
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
}

// Initialize the extension
new FixedOAuthCollector();