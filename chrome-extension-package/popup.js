// Enhanced Quote Collector with Beautiful UI and Working OAuth
class EnhancedQuoteCollector {
  constructor() {
    this.accessToken = null;
    this.spreadsheetId = null;
    this.userTags = [];
    this.isLoggedOut = false; // Track logout state
    this.init();
  }

  async init() {
    this.setupEventListeners();
    this.setupMessageListener();
    await this.checkExistingAuth();
    await this.loadSelectedText();
    this.setupTagInterface();
  }

  setupMessageListener() {
    // Listen for logout messages from background script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'logout') {
        console.log('Received logout message, resetting popup');
        this.accessToken = null;
        this.spreadsheetId = null;
        this.userTags = [];
        this.isLoggedOut = true;
        this.showAuthInterface();
        return true;
      }
    });
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

    // Header brand (logo + title) opens full page view
    document.getElementById('header-brand').addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: chrome.runtime.getURL('fullpage.html') });
    });

    // Remove Enter key handler - tags will be processed on Save
  }

  setupTagInterface() {
    // Initialize with empty user tags
    this.userTags = [];
    this.renderUserTags();
  }

  // Remove renderSuggestedTags - no longer needed

  renderUserTags() {
    // Render user-added tags - all with X to delete
    const container = document.getElementById('user-tags');
    container.innerHTML = '';
    
    console.log('Rendering user tags:', this.userTags);
    
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

  processInputTags() {
    // Process tags from input field during save
    const input = document.getElementById('tag-input');
    const inputValue = input.value.trim();
    
    if (inputValue) {
      const newTags = inputValue.split(',').map(tag => tag.trim()).filter(Boolean);
      console.log('Processing input tags:', newTags);
      
      // Add new tags, avoiding duplicates
      newTags.forEach(tag => {
        if (!this.userTags.includes(tag)) {
          this.userTags.push(tag);
        }
      });
      
      input.value = ''; // Clear input after processing
    }
  }

  removeUserTag(tagToRemove) {
    console.log('Removing tag:', tagToRemove);
    this.userTags = this.userTags.filter(tag => tag !== tagToRemove);
    console.log('Updated userTags after removal:', this.userTags);
    this.renderUserTags();
  }

  async checkExistingAuth() {
    try {
      console.log('Checking existing authentication...');
      
      // Check if user explicitly logged out
      const logoutState = await chrome.storage.local.get(['userLoggedOut']);
      if (logoutState.userLoggedOut) {
        console.log('User previously logged out, showing auth interface');
        this.isLoggedOut = true;
        this.showAuthInterface();
        return;
      }
      
      // Try to get existing token from Chrome Identity (non-interactive first)
      let accessToken = null;
      try {
        accessToken = await chrome.identity.getAuthToken({ interactive: false });
      } catch (e) {
        // Expected on first load - user hasn't granted permissions yet
        console.log('No existing token (expected on first load):', e.message);
      }

      if (accessToken) {
        console.log('Found existing Chrome Identity token');
        // Handle both string and object token formats
        this.accessToken = typeof accessToken === 'object' ? accessToken.token : accessToken;
        
        // Validate token by testing API access
        const isValid = await this.validateToken();
        if (!isValid) {
          console.log('Token invalid, removing cached token');
          const tokenToRemove = typeof accessToken === 'object' ? accessToken.token : accessToken;
          await chrome.identity.removeCachedAuthToken({ token: tokenToRemove });
          this.showAuthInterface();
          return;
        }
        
        // Check if we have cached spreadsheet ID
        const stored = await chrome.storage.local.get(['googleSpreadsheetId']);
        
        if (stored.googleSpreadsheetId) {
          console.log('Testing cached spreadsheet:', stored.googleSpreadsheetId);
          
          try {
            // Quick test if spreadsheet is still accessible
            const sheetsResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${stored.googleSpreadsheetId}`, {
              headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            
            if (sheetsResponse.ok) {
              console.log('Spreadsheet verified, showing main interface');
              this.spreadsheetId = stored.googleSpreadsheetId;
              this.showMainInterface();
              return;
            } else {
              console.log('Spreadsheet not accessible, will create/find one');
              await chrome.storage.local.remove(['googleSpreadsheetId']);
            }
          } catch (error) {
            console.log('Error testing spreadsheet, will create/find one:', error);
            await chrome.storage.local.remove(['googleSpreadsheetId']);
          }
        }
        
        // Have token but need to setup spreadsheet
        console.log('Have auth token, setting up spreadsheet...');
        try {
          await this.setupSpreadsheetIfNeeded();
          this.showMainInterface();
          return;
        } catch (error) {
          console.error('Spreadsheet setup failed:', error);
          // Only show error if we actually had a token and tried to setup
          this.showStatus(`Setup error: ${error.message}`, 'error');
        }
      } else {
        console.log('No existing Chrome Identity token found');
      }
    } catch (error) {
      console.log('Error checking existing auth:', error);
      // Don't show error on first load - it's expected to not have auth yet
      // Only show error if we have indications this was a real connection failure
      if (this.accessToken || this.spreadsheetId) {
        this.showStatus(`Auth check error: ${error.message}`, 'error');
      }
    }

    // Show auth interface if no valid token or setup failed (no error message)
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
      console.log('Requesting authentication token...');
      
      // Clear any cached tokens first to force fresh auth
      try {
        const existingToken = await chrome.identity.getAuthToken({ interactive: false });
        if (existingToken) {
          const tokenToRemove = typeof existingToken === 'object' ? existingToken.token : existingToken;
          await chrome.identity.removeCachedAuthToken({ token: tokenToRemove });
          console.log('Cleared existing cached token');
        }
      } catch (e) {
        console.log('No existing token to clear');
      }
      
      // Use Chrome Identity API with interactive flow
      const accessToken = await chrome.identity.getAuthToken({ 
        interactive: true
      });

      if (!accessToken) {
        throw new Error('No access token received from Chrome Identity API');
      }

      console.log('Authentication successful, got access token');
      
      // Handle both string and object token formats
      this.accessToken = typeof accessToken === 'object' ? accessToken.token : accessToken;
      this.isLoggedOut = false; // Clear logout state
      
      // Clear the logout flag from storage
      await chrome.storage.local.remove(['userLoggedOut']);
      
      this.showStatus('Authentication successful!', 'success');
      
      // Test the token immediately
      const isValid = await this.validateToken();
      if (!isValid) {
        throw new Error('Received token is invalid');
      }
      
      await this.setupSpreadsheetIfNeeded();
      this.showMainInterface();

    } catch (error) {
      console.error('Authentication error:', error);
      this.showStatus(`Authentication failed: ${error.message}`, 'error');
      
      // If auth fails, ensure we're showing the auth interface
      setTimeout(() => {
        this.showAuthInterface();
      }, 2000);
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

      this.showStatus('Looking for existing Quotebook spreadsheet...', 'info');

      // Search for existing Quotebook Collection spreadsheet (exact match, excluding trashed files)
      const searchResponse = await fetch(`https://www.googleapis.com/drive/v3/files?q=name='Quotebook Collection' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false&fields=files(id,name,createdTime)`, {
        headers: { 'Authorization': `Bearer ${this.accessToken}` }
      });

      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        const existingSheets = searchData.files || [];

        if (existingSheets.length > 0) {
          // Sort by creation date (newest first)
          existingSheets.sort((a, b) => new Date(b.createdTime) - new Date(a.createdTime));
          
          // Use the most recent Quotebook Collection spreadsheet
          this.spreadsheetId = existingSheets[0].id;
          
          // Store only spreadsheet ID (Chrome Identity handles tokens)
          await chrome.storage.local.set({
            googleSpreadsheetId: this.spreadsheetId
          });

          this.showStatus(`Connected to existing "${existingSheets[0].name}"`, 'success');
          return;
        }
      }

      // No existing spreadsheet found, create a new one
      this.showStatus('Creating new Quotebook spreadsheet...', 'info');
      
      const response = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          properties: {
            title: 'Quotebook Collection'
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

        // Store only spreadsheet ID (Chrome Identity handles tokens)
        await chrome.storage.local.set({
          googleSpreadsheetId: this.spreadsheetId
        });

        // Add headers
        await this.addHeaders();

        this.showStatus('New Quotebook spreadsheet created!', 'success');
      } else {
        const error = await response.text();
        const errorMsg = `Failed to create spreadsheet: ${response.status}`;
        this.showStatus(errorMsg, 'error');
        throw new Error(errorMsg);
      }

    } catch (error) {
      const errorMsg = `Setup error: ${error.message}`;
      this.showStatus(errorMsg, 'error');
      throw error;
    }
  }

  async addHeaders() {
    const headers = ['Title', 'Content', 'URL', 'Tags', 'Timestamp', 'Image'];

    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}/values/A1:F1?valueInputOption=RAW`, {
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

      // Only try to get selected text from content pages (not chrome:// or extension pages)
      if (tab && tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
        try {
          const response = await chrome.tabs.sendMessage(tab.id, { action: 'getSelectedText' });

          if (response && response.selectedText && response.selectedText.trim()) {
            document.getElementById('content').value = response.selectedText.trim();
            
            // Auto-generate suggested tags and add them as user tags
            this.generateSuggestedTags(response.selectedText.trim());
          } else {
            // If no text selected, show instruction
            document.getElementById('content').value = "Select text on the webpage to capture it here...";
          }
        } catch (error) {
          console.log('Could not get selected text from tab:', error.message);
          document.getElementById('content').value = "Select text on the webpage to capture it here...";
        }
      } else {
        // Invalid tab or special page
        document.getElementById('content').value = "Select text on a webpage to capture it here...";
      }
        
      // Always try to get page metadata and add as user tags
      this.extractPageMetadata();
        
    } catch (error) {
      // Could not access tab, this is normal
      console.log('Could not access tab:', error.message);
      document.getElementById('content').value = "Select text on the webpage to capture it here...";
    }
  }

  async extractPageMetadata() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const result = await chrome.tabs.sendMessage(tab.id, { action: 'getPageMetadata' });
      
      if (result && result.categories && result.categories.length > 0) {
        console.log('Extracted page categories:', result.categories);
        
        // Add page categories directly as user tags (pre-added, removable)
        result.categories.slice(0, 3).forEach(tag => {
          if (!this.userTags.includes(tag)) {
            this.userTags.push(tag);
          }
        });
        
        console.log('Added page categories to user tags:', this.userTags);
        this.renderUserTags();
      }
    } catch (e) {
      console.log('Could not extract page metadata:', e);
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
    // Simple keyword extraction - directly add as user tags
    const keywords = [];
    const text = content.toLowerCase();
    
    // Technology keywords
    if (text.includes('javascript') || text.includes('js')) keywords.push('javascript');
    if (text.includes('python')) keywords.push('python');
    if (text.includes('react')) keywords.push('react');
    if (text.includes('api')) keywords.push('api');
    if (text.includes('database')) keywords.push('database');
    if (text.includes('hospital') || text.includes('medical')) keywords.push('healthcare');
    if (text.includes('security') || text.includes('cyber')) keywords.push('security');
    if (text.includes('research') || text.includes('study')) keywords.push('research');
    
    // General categories
    if (text.includes('tutorial') || text.includes('guide')) keywords.push('tutorial');
    if (text.includes('tips') || text.includes('advice')) keywords.push('tips');
    if (text.includes('best practices')) keywords.push('best practices');
    if (text.includes('news') || text.includes('report')) keywords.push('news');
    
    console.log('Generated tags from content:', keywords);
    
    // Add suggested tags directly to user tags (pre-added, removable)
    keywords.slice(0, 4).forEach(tag => {
      if (!this.userTags.includes(tag)) {
        this.userTags.push(tag);
      }
    });
    
    this.renderUserTags();
  }

  async saveQuote() {
    try {
      const content = document.getElementById('content').value;

      if (!content.trim() || content === "Select text on the webpage to capture it here...") {
        this.showStatusMain('Please select some text on the webpage first', 'error');
        return;
      }

      console.log('Starting save process...');
      
      // Process any tags in the input field
      this.processInputTags();
      
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
      
      // Extract page image only (don't mess with tags during save)
      let pageImage = '';
      try {
        const result = await chrome.tabs.sendMessage(tab.id, { action: 'getPageMetadata' });
        if (result) {
          pageImage = result.image || '';
        }
      } catch (e) {
        // Fallback to basic image extraction
        pageImage = tab.favIconUrl || '';
      }
      
      // ONLY save user-added tags
      console.log('Final user tags to save:', this.userTags);
      
      const now = new Date();
      const row = [
        tab.title || 'Untitled',
        content,
        tab.url,
        this.userTags.join(', '),  // Only user tags
        now.toISOString(), // Full timestamp for accurate ordering
        pageImage
      ];
      
      console.log('Saving row data:', row);

      const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}/values/A:F:append?valueInputOption=RAW`, {
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
        
        // Store only spreadsheet ID (Chrome Identity API handles tokens)
        await chrome.storage.local.set({
          googleSpreadsheetId: this.spreadsheetId
        });
        console.log('Storage updated with spreadsheet ID:', this.spreadsheetId);
        
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