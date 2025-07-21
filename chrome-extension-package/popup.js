// Enhanced Quote Collector with Beautiful UI and Working OAuth
class EnhancedQuoteCollector {
  constructor() {
    this.clientId = '184152653641-m443n0obiua9uotnkts6lsbbo8ikks80.apps.googleusercontent.com';
    this.accessToken = null;
    this.spreadsheetId = null;
    this.userTags = [];
    this.suggestedTags = [];
    this.init();
  }

  async init() {
    this.setupEventListeners();
    await this.checkExistingAuth();
    await this.loadSelectedText();
    this.setupTagInterface();
  }

  setupEventListeners() {
    document.getElementById('auth-button').addEventListener('click', () => {
      this.authenticateFixed();
    });

    document.getElementById('save-button').addEventListener('click', () => {
      this.saveQuote();
    });

    document.getElementById('cancel-button').addEventListener('click', () => {
      window.close();
    });

    document.getElementById('view-all-button').addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('fullpage.html') });
    });

    document.getElementById('tag-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.addCustomTags();
      }
    });
  }

  setupTagInterface() {
    // Generate some suggested tags based on content
    this.suggestedTags = ['web development', 'technology'];
    this.renderSuggestedTags();
    this.renderUserTags();
  }

  renderSuggestedTags() {
    const container = document.getElementById('suggested-tags');
    container.innerHTML = '';
    
    this.suggestedTags.forEach(tag => {
      const tagElement = document.createElement('div');
      tagElement.className = 'tag tag-suggested';
      tagElement.innerHTML = `
        <svg class="sparkles-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .962 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.582a.5.5 0 0 1 0 .962L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.962 0L9.937 15.5z"/>
        </svg>
        ${tag}
      `;
      container.appendChild(tagElement);
    });
  }

  renderUserTags() {
    const container = document.getElementById('user-tags');
    container.innerHTML = '';
    
    this.userTags.forEach(tag => {
      const tagElement = document.createElement('div');
      tagElement.className = 'tag tag-user';
      tagElement.innerHTML = `
        ${tag}
        <button class="tag-remove" data-tag="${tag}">×</button>
      `;
      
      tagElement.querySelector('.tag-remove').addEventListener('click', () => {
        this.removeUserTag(tag);
      });
      
      container.appendChild(tagElement);
    });
  }

  addCustomTags() {
    const input = document.getElementById('tag-input');
    const newTags = input.value.split(',').map(tag => tag.trim()).filter(Boolean);
    
    if (newTags.length > 0) {
      this.userTags = [...this.userTags, ...newTags];
      input.value = '';
      this.renderUserTags();
    }
  }

  removeUserTag(tagToRemove) {
    this.userTags = this.userTags.filter(tag => tag !== tagToRemove);
    this.renderUserTags();
  }

  async checkExistingAuth() {
    try {
      // First check if we have cached spreadsheet data
      const stored = await chrome.storage.local.get(['googleSpreadsheetId', 'googleAccessToken']);
      console.log('Cached data found:', { 
        hasSpreadsheetId: !!stored.googleSpreadsheetId, 
        hasAccessToken: !!stored.googleAccessToken 
      });
      
      if (stored.googleSpreadsheetId && stored.googleAccessToken) {
        console.log('Testing cached spreadsheet:', stored.googleSpreadsheetId);
        // We have cached data, but let's verify the spreadsheet still exists and is not trashed
        try {
          // Check if file is trashed using Drive API
          const driveResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${stored.googleSpreadsheetId}?fields=trashed,name`, {
            headers: { 'Authorization': `Bearer ${stored.googleAccessToken}` }
          });
          
          console.log('Drive API test response:', driveResponse.status);
          
          if (driveResponse.ok) {
            const fileInfo = await driveResponse.json();
            console.log('File info:', fileInfo);
            
            if (fileInfo.trashed === true) {
              console.log('Spreadsheet is in trash, clearing cache');
              await chrome.storage.local.remove(['googleSpreadsheetId', 'googleAccessToken']);
            } else {
              // File exists and is not trashed, verify it's still accessible via Sheets API
              const sheetsResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${stored.googleSpreadsheetId}`, {
                headers: { 'Authorization': `Bearer ${stored.googleAccessToken}` }
              });
              
              if (sheetsResponse.ok) {
                console.log('Spreadsheet verified and accessible, showing main interface');
                this.accessToken = stored.googleAccessToken;
                this.spreadsheetId = stored.googleSpreadsheetId;
                this.showMainInterface();
                return;
              } else {
                console.log('Spreadsheet not accessible via Sheets API, clearing cache');
                await chrome.storage.local.remove(['googleSpreadsheetId', 'googleAccessToken']);
              }
            }
          } else {
            // File not found or not accessible, clear cache
            console.log('File not accessible via Drive API, clearing cache');
            await chrome.storage.local.remove(['googleSpreadsheetId', 'googleAccessToken']);
          }
        } catch (error) {
          // Error accessing spreadsheet, clear cache
          console.log('Error testing spreadsheet:', error);
          await chrome.storage.local.remove(['googleSpreadsheetId', 'googleAccessToken']);
        }
      }

      // No valid cached data, try to get fresh auth token
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
      // Clear any existing cached data when re-authenticating
      await chrome.storage.local.remove(['googleSpreadsheetId', 'googleAccessToken']);

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

      // Request new token using getAuthToken (the original working method)
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
      // Check for existing spreadsheet in storage
      const stored = await chrome.storage.local.get(['googleSpreadsheetId']);
      if (stored.googleSpreadsheetId) {
        // Verify the spreadsheet still exists and is not trashed
        try {
          // Check if file is trashed using Drive API first
          const driveResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${stored.googleSpreadsheetId}?fields=trashed,name`, {
            headers: { 'Authorization': `Bearer ${this.accessToken}` }
          });
          
          if (driveResponse.ok) {
            const fileInfo = await driveResponse.json();
            if (fileInfo.trashed === true) {
              console.log('Stored spreadsheet is trashed, clearing cache');
              await chrome.storage.local.remove(['googleSpreadsheetId']);
            } else {
              // Not trashed, test Sheets API access
              const testResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${stored.googleSpreadsheetId}`, {
                headers: { 'Authorization': `Bearer ${this.accessToken}` }
              });
              
              if (testResponse.ok) {
                this.spreadsheetId = stored.googleSpreadsheetId;
                this.showStatus('Connected to existing spreadsheet', 'success');
                return;
              } else {
                // Sheets API failed, clear cache
                await chrome.storage.local.remove(['googleSpreadsheetId']);
              }
            }
          } else {
            // Drive API failed, clear cache
            await chrome.storage.local.remove(['googleSpreadsheetId']);
          }
        } catch (error) {
          // Error accessing stored spreadsheet, clear it
          await chrome.storage.local.remove(['googleSpreadsheetId']);
        }
      }

      this.showStatus('Looking for existing Quote Collector spreadsheet...', 'info');

      // Search for existing Quote Collector spreadsheets (excluding trashed files)
      const searchResponse = await fetch(`https://www.googleapis.com/drive/v3/files?q=name contains 'Quote Collector' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false&fields=files(id,name,createdTime)`, {
        headers: { 'Authorization': `Bearer ${this.accessToken}` }
      });

      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        const existingSheets = searchData.files || [];

        if (existingSheets.length > 0) {
          // Sort by creation date (newest first)
          existingSheets.sort((a, b) => new Date(b.createdTime) - new Date(a.createdTime));
          
          // Use the most recent Quote Collector spreadsheet
          this.spreadsheetId = existingSheets[0].id;
          
          // Store the found spreadsheet
          await chrome.storage.local.set({
            googleAccessToken: this.accessToken,
            googleSpreadsheetId: this.spreadsheetId
          });

          this.showStatus(`Connected to existing "${existingSheets[0].name}"`, 'success');
          return;
        }
      }

      // No existing spreadsheet found, create a new one
      this.showStatus('Creating new Quote Collector spreadsheet...', 'info');
      
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
          googleAccessToken: this.accessToken,
          googleSpreadsheetId: this.spreadsheetId
        });

        // Add headers
        await this.addHeaders();

        this.showStatus('New Quote Collector spreadsheet created!', 'success');
      } else {
        const error = await response.text();
        this.showStatus(`Failed to create spreadsheet: ${response.status}`, 'error');
      }

    } catch (error) {
      this.showStatus(`Setup error: ${error.message}`, 'error');
    }
  }

  async addHeaders() {
    const headers = ['Title', 'Content', 'URL', 'Tags', 'Date', 'Image', 'Categories'];

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

  async loadSelectedText() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      // Update page preview
      this.updatePagePreview(tab);

      try {
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'getSelectedText' });

        if (response && response.selectedText) {
          document.getElementById('content').value = response.selectedText;
          
          // Auto-generate tags based on content
          this.generateSuggestedTags(response.selectedText);
        } else {
          // If no text selected, show sample content for demo
          document.getElementById('content').value = "Select text on the webpage to capture it here...";
        }
      } catch (e) {
        // Could not get selected text, this is normal for some pages
        document.getElementById('content').value = "Select text on the webpage to capture it here...";
      }
    } catch (error) {
      // Could not access tab, this is normal
    }
  }

  updatePagePreview(tab) {
    // Update preview image (favicon or default)
    const previewImg = document.getElementById('preview-image');
    const favicon = tab.favIconUrl || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23e2e8f0"/><text y="50" x="50" text-anchor="middle" dy=".3em" font-size="40">📄</text></svg>';
    previewImg.src = favicon;
    
    // Update title and URL
    document.getElementById('preview-title').textContent = tab.title || 'Untitled Page';
    document.getElementById('preview-url').textContent = tab.url || '';
  }

  generateSuggestedTags(content) {
    // Simple keyword extraction for suggested tags
    const keywords = [];
    const text = content.toLowerCase();
    
    // Technology keywords
    if (text.includes('javascript') || text.includes('js')) keywords.push('javascript');
    if (text.includes('python')) keywords.push('python');
    if (text.includes('react')) keywords.push('react');
    if (text.includes('api')) keywords.push('api');
    if (text.includes('database')) keywords.push('database');
    
    // General categories
    if (text.includes('tutorial') || text.includes('guide')) keywords.push('tutorial');
    if (text.includes('tips') || text.includes('advice')) keywords.push('tips');
    if (text.includes('best practices')) keywords.push('best practices');
    
    this.suggestedTags = [...new Set(keywords)].slice(0, 4); // Max 4 tags
    
    this.renderSuggestedTags();
  }

  async saveQuote() {
    try {
      const content = document.getElementById('content').value;

      if (!content.trim() || content === "Select text on the webpage to capture it here...") {
        this.showStatusMain('Please select some text on the webpage first', 'error');
        return;
      }

      console.log('Starting save process...');
      
      // Ensure we have a spreadsheet ID
      if (!this.spreadsheetId) {
        console.log('No spreadsheet ID, setting up spreadsheet...');
        await this.setupSpreadsheetIfNeeded();
      }
      
      if (!this.spreadsheetId) {
        throw new Error('Failed to setup spreadsheet');
      }
      
      console.log('Using spreadsheet ID:', this.spreadsheetId);
      
      this.showStatusMain('Saving to Google Sheets...', 'info');
      document.getElementById('save-button').disabled = true;

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Extract page metadata including image and categories
      let pageImage = '';
      let pageCategories = [];
      
      try {
        const result = await chrome.tabs.sendMessage(tab.id, { action: 'getPageMetadata' });
        if (result) {
          pageImage = result.image || '';
          pageCategories = result.categories || [];
        }
      } catch (e) {
        // Fallback to basic image extraction
        pageImage = tab.favIconUrl || '';
      }
      
      // Combine only user tags (no defaults)
      const uniqueTags = [...new Set(this.userTags)];
      
      const row = [
        tab.title || 'Untitled',
        content,
        tab.url,
        uniqueTags.join(', '),
        new Date().toISOString().split('T')[0],
        pageImage,
        pageCategories.join(', ')
      ];
      
      console.log('Saving row data:', row);

      const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}/values/A:G:append?valueInputOption=RAW`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          values: [row]
        })
      });

      console.log('Save response status:', response.status);

      if (response.ok) {
        const responseData = await response.json();
        console.log('Save successful:', responseData);
        
        // Make sure storage is up to date with current spreadsheet
        await chrome.storage.local.set({
          googleAccessToken: this.accessToken,
          googleSpreadsheetId: this.spreadsheetId
        });
        console.log('Storage updated with:', { 
          hasAccessToken: !!this.accessToken, 
          spreadsheetId: this.spreadsheetId 
        });
        
        this.showStatusMain('Content saved successfully!', 'success');

        // Clear content and reset
        document.getElementById('content').value = 'Select text on the webpage to capture it here...';
        this.userTags = [];
        this.renderUserTags();
        
        setTimeout(() => {
          window.close();
        }, 1500);
      } else {
        const errorData = await response.json();
        console.error('Save failed:', errorData);
        this.showStatusMain(`Save failed: ${errorData.error?.message || 'Unknown error'}`, 'error');
      }

    } catch (error) {
      this.showStatusMain(`Error: ${error.message}`, 'error');
    } finally {
      document.getElementById('save-button').disabled = false;
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
new EnhancedQuoteCollector();