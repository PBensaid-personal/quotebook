// Chrome Extension OAuth implementation
class ChromeExtensionOAuth {
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
      this.authenticateWithExtensionFlow();
    });

    document.getElementById('save-button').addEventListener('click', () => {
      this.saveQuote();
    });
  }

  async checkExistingAuth() {
    try {
      const token = await chrome.identity.getAuthToken({ interactive: false });

      if (token) {
        console.log('Found existing token');
        this.accessToken = token;

        const isValid = await this.validateToken();
        if (isValid) {
          await this.setupSpreadsheetIfNeeded();
          this.showMainInterface();
          return;
        } else {
          await chrome.identity.removeCachedAuthToken({ token: token });
        }
      }
    } catch (error) {
      console.log('No existing auth found:', error);
    }

    this.showAuthInterface();
  }

  async validateToken() {
    if (!this.accessToken) return false;

    try {
      const response = await fetch(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${this.accessToken}`);
      const data = await response.json();

      if (response.ok && data.scope && data.scope.includes('spreadsheets')) {
        console.log('Token valid:', data);
        return true;
      } else {
        console.log('Token invalid or missing scopes:', data);
        return false;
      }
    } catch (error) {
      console.log('Token validation failed:', error);
      return false;
    }
  }

  async authenticateWithExtensionFlow() {
    console.log('=== DEBUG OAUTH ===');
    console.log('Extension ID:', chrome.runtime.id);
    console.log('Manifest:', chrome.runtime.getManifest());

    this.showStatus('Connecting to Google...', 'info');
    
    this.showStatus('Connecting to Google...', 'info');

    try {
      try {
        const oldToken = await chrome.identity.getAuthToken({ interactive: false });
        if (oldToken) {
          await chrome.identity.removeCachedAuthToken({ token: oldToken });
        }
      } catch (e) {
        // No cached token to remove
      }

      const token = await chrome.identity.getAuthToken({ 
        interactive: true
      });

      if (token) {
        this.accessToken = token;
        console.log('Authentication successful, token received');

        const isValid = await this.validateToken();
        if (isValid) {
          this.showStatus('Authentication successful!', 'success');
          await this.setupSpreadsheetIfNeeded();
          this.showMainInterface();
        } else {
          throw new Error('Token validation failed - check OAuth scopes');
        }
      } else {
        throw new Error('No token received from Google');
      }

    } catch (error) {
      console.error('Authentication failed:', error);
      this.showStatus(`Authentication failed: ${error.message}`, 'error');

      if (error.message.includes('OAuth2 not granted')) {
        this.showStatus('Please approve the permissions in the popup window', 'error');
      } else if (error.message.includes('scopes')) {
        this.showStatus('Missing required permissions. Check OAuth configuration.', 'error');
      }
    }
  }

  async setupSpreadsheetIfNeeded() {
    try {
      const result = await chrome.storage.local.get(['spreadsheetId']);
      if (result.spreadsheetId) {
        this.spreadsheetId = result.spreadsheetId;
        console.log('Using existing spreadsheet:', this.spreadsheetId);
        return;
      }

      this.showStatus('Setting up Google Sheets...', 'info');

      const response = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          properties: {
            title: `Quote Collector - ${new Date().toLocaleDateString()}`
          },
          sheets: [{
            properties: {
              title: 'Collected Quotes',
              gridProperties: {
                rowCount: 1000,
                columnCount: 5
              }
            }
          }]
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Spreadsheet creation failed:', response.status, errorText);

        if (response.status === 403) {
          throw new Error('Google Sheets API not enabled. Please enable it in Google Cloud Console.');
        } else if (response.status === 401) {
          throw new Error('Authentication token expired. Please try connecting again.');
        } else {
          throw new Error(`Failed to create spreadsheet: ${response.status}`);
        }
      }

      const data = await response.json();
      this.spreadsheetId = data.spreadsheetId;

      await chrome.storage.local.set({ spreadsheetId: this.spreadsheetId });
      await this.addHeaders();

      this.showStatus('Google Sheets ready!', 'success');
      console.log('Spreadsheet created:', `https://docs.google.com/spreadsheets/d/${this.spreadsheetId}`);

    } catch (error) {
      console.error('Spreadsheet setup error:', error);
      this.showStatus(`Setup failed: ${error.message}`, 'error');
      throw error;
    }
  }

  async addHeaders() {
    const headers = ['Date', 'Title', 'Content', 'Source URL', 'Notes'];

    try {
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}/values/A1:E1?valueInputOption=RAW`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            values: [headers]
          })
        }
      );

      if (!response.ok) {
        console.warn('Failed to add headers:', await response.text());
      } else {
        console.log('Headers added successfully');
      }
    } catch (error) {
      console.warn('Error adding headers:', error);
    }
  }

  async loadSelectedText() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      const response = await chrome.tabs.sendMessage(tab.id, { action: 'getSelectedText' });

      if (response && response.selectedText) {
        document.getElementById('content').value = response.selectedText;

        const title = tab.title || 'Untitled';
        document.getElementById('title').value = title.length > 50 ? title.substring(0, 50) + '...' : title;
      }
    } catch (error) {
      console.log('Could not get selected text:', error);
    }
  }

  async saveQuote() {
    try {
      const title = document.getElementById('title').value.trim();
      const content = document.getElementById('content').value.trim();
      const notes = document.getElementById('notes').value.trim();

      if (!content) {
        this.showStatusMain('Please enter some content to save', 'error');
        return;
      }

      this.showStatusMain('Saving to Google Sheets...', 'info');

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const timestamp = new Date().toLocaleString();

      const row = [
        timestamp,
        title || 'Untitled Quote',
        content,
        tab.url || '',
        notes || ''
      ];

      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}/values/A:E:append?valueInputOption=RAW`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            values: [row]
          })
        }
      );

      if (response.ok) {
        this.showStatusMain('✅ Saved successfully!', 'success');
        console.log('Quote saved successfully');

        document.getElementById('title').value = '';
        document.getElementById('content').value = '';
        document.getElementById('notes').value = '';

        setTimeout(() => {
          if (window.close) window.close();
        }, 1500);

      } else {
        const errorText = await response.text();
        console.error('Save failed:', response.status, errorText);

        if (response.status === 401) {
          this.showStatusMain('Session expired. Please reconnect.', 'error');
          this.showAuthInterface();
        } else {
          this.showStatusMain(`Save failed: ${response.status}`, 'error');
        }
      }

    } catch (error) {
      console.error('Save error:', error);
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
    if (status) {
      status.textContent = message;
      status.className = `status ${type}`;
      status.style.display = 'block';

      if (type === 'success') {
        setTimeout(() => {
          status.style.display = 'none';
        }, 3000);
      }
    }
    console.log(`[Status ${type}]`, message);
  }

  showStatusMain(message, type) {
    const status = document.getElementById('status-main');
    if (status) {
      status.textContent = message;
      status.className = `status ${type}`;
      status.style.display = 'block';

      if (type === 'success') {
        setTimeout(() => {
          status.style.display = 'none';
        }, 3000);
      }
    }
    console.log(`[Main Status ${type}]`, message);
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new ChromeExtensionOAuth();
  });
} else {
  new ChromeExtensionOAuth();
}