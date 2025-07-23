class EnhancedQuoteCollector {
  constructor() {
    this.accessToken = null;
    this.spreadsheetId = null;
    this.suggestedTags = [];
    this.userTags = [];
    this.init();
  }

  async init() {
    this.setupEventListeners();
    await this.checkWebAppCreationRequest();
    await this.checkExistingAuth();
    await this.loadSelectedText();
    this.setupTagInterface();
  }

  setupEventListeners() {
    document.getElementById('auth-button').addEventListener('click', () => {
      this.authenticateWithGoogle();
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

    document.getElementById('create-web-viewer-button').addEventListener('click', async () => {
      await this.deployPersonalWebApp();
    });

    // Bookmark icon in header also opens full page view
    document.querySelector('.bookmark-icon').addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('fullpage.html') });
    });

    // Header brand (logo + title) opens full page view
    document.getElementById('header-brand').addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: chrome.runtime.getURL('fullpage.html') });
    });

    // Remove Enter key handler - tags will be processed on Save
  }

  async checkWebAppCreationRequest() {
    try {
      const stored = await chrome.storage.local.get(['webAppCreationRequested']);
      if (stored.webAppCreationRequested) {
        // Clear the flag
        await chrome.storage.local.remove(['webAppCreationRequested']);
        
        // Check if we have authentication and can create web app
        const authStored = await chrome.storage.local.get(['googleAccessToken', 'googleSpreadsheetId']);
        if (authStored.googleAccessToken && authStored.googleSpreadsheetId) {
          this.accessToken = authStored.googleAccessToken;
          this.spreadsheetId = authStored.googleSpreadsheetId;
          
          // Trigger web app creation
          await this.deployPersonalWebApp();
          this.showMainInterface();
        } else {
          // Need to authenticate first
          this.showStatus('Please connect to Google Sheets first', 'info');
        }
      }
    } catch (error) {
      console.log('No web app creation request pending');
    }
  }

  setupTagInterface() {
    // Initialize with empty user tags
    this.userTags = [];
    this.renderUserTags();
  }

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
            
            if (!fileInfo.trashed) {
              // File exists and is not trashed, use cached data
              this.accessToken = stored.googleAccessToken;
              this.spreadsheetId = stored.googleSpreadsheetId;
              console.log('Spreadsheet verified and accessible, showing main interface');
              this.showMainInterface();
              return;
            } else {
              console.log('Cached spreadsheet is trashed, clearing cache');
            }
          } else {
            console.log('Drive API request failed, will re-authenticate');
          }
        } catch (e) {
          console.log('Error testing cached spreadsheet:', e);
        }
        
        // Clear invalid cached data
        await chrome.storage.local.remove(['googleSpreadsheetId', 'googleAccessToken']);
      }
      
      // No valid cached data, show auth UI
      this.showAuthInterface();
    } catch (error) {
      console.log('No cached auth found');
      this.showAuthInterface();
    }
  }

  async authenticateWithGoogle() {
    try {
      this.showStatus('Connecting to Google...', 'info');

      // Request OAuth token
      const token = await chrome.identity.launchWebAuthFlow({
        url: `https://accounts.google.com/oauth/authorize?` +
          `client_id=442737871748-npn6dknjvd9r1k3n5b0lc8thqk7lme5u.apps.googleusercontent.com&` +
          `redirect_uri=${encodeURIComponent('https://igokaadmgmnmbmclnbanjalaakhmghgb.chromiumapp.org/')}&` +
          `response_type=token&` +
          `scope=${encodeURIComponent('https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file')}`,
        interactive: true
      });

      const accessToken = token.split('access_token=')[1].split('&')[0];
      this.accessToken = accessToken;

      this.showStatus('Creating spreadsheet...', 'info');

      // Create or get spreadsheet
      const spreadsheetId = await this.getOrCreateSpreadsheet();
      this.spreadsheetId = spreadsheetId;

      // Store for future use
      await chrome.storage.local.set({
        googleAccessToken: accessToken,
        googleSpreadsheetId: spreadsheetId
      });

      this.showStatus('Connected successfully!', 'success');
      this.showMainInterface();
      
      // Automatically create web viewer after authentication
      setTimeout(() => {
        this.deployPersonalWebApp();
      }, 1000);

    } catch (error) {
      console.error('Authentication failed:', error);
      this.showStatus('Connection failed. Please try again.', 'error');
    }
  }

  async getOrCreateSpreadsheet() {
    const spreadsheetTitle = 'Quotebook Collection';
    
    // First, try to find existing spreadsheet
    const searchResponse = await fetch(`https://www.googleapis.com/drive/v3/files?q=name='${spreadsheetTitle}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`, {
      headers: { 'Authorization': `Bearer ${this.accessToken}` }
    });

    if (searchResponse.ok) {
      const searchResult = await searchResponse.json();
      if (searchResult.files && searchResult.files.length > 0) {
        console.log('Found existing spreadsheet:', searchResult.files[0].id);
        return searchResult.files[0].id;
      }
    }

    // Create new spreadsheet if none found
    const createResponse = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        properties: {
          title: spreadsheetTitle
        },
        sheets: [{
          properties: {
            title: 'Quotes'
          }
        }]
      })
    });

    if (!createResponse.ok) {
      throw new Error(`Failed to create spreadsheet: ${createResponse.status}`);
    }

    const spreadsheet = await createResponse.json();
    const spreadsheetId = spreadsheet.spreadsheetId;

    // Set up headers
    await this.setupSpreadsheetHeaders(spreadsheetId);

    console.log('Created new spreadsheet:', spreadsheetId);
    return spreadsheetId;
  }

  async setupSpreadsheetHeaders(spreadsheetId) {
    const headers = ['Title', 'Content', 'URL', 'Tags', 'Date', 'Domain'];
    
    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A1:F1?valueInputOption=RAW`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        values: [headers]
      })
    });

    if (!response.ok) {
      console.warn('Failed to set headers');
    }
  }

  async loadSelectedText() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      // Update page preview
      this.updatePagePreview(tab);

      try {
        // Try to inject content script if not already present
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
          });
        } catch (injectionError) {
          // Content script might already be injected, continue
        }

        const response = await chrome.tabs.sendMessage(tab.id, { action: 'getSelectedText' });

        if (response && response.selectedText) {
          document.getElementById('content').value = response.selectedText;
          
          // Auto-generate suggested tags and add them as user tags
          this.generateSuggestedTags(response.selectedText);
        } else {
          // If no text selected, show sample content for demo
          document.getElementById('content').value = "Select text on the webpage to capture it here...";
        }
        
        // Always try to get page metadata and add as user tags
        this.extractPageMetadata();
      } catch (e) {
        // Could not get selected text, this is normal for some pages
        document.getElementById('content').value = "Select text on the webpage to capture it here...";
        // Still try to get page metadata
        this.extractPageMetadata();
      }
    } catch (error) {
      // Could not access tab, this is normal
    }
  }

  async extractPageMetadata() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.id) return;

      // Try to inject content script if not already present
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
      } catch (injectionError) {
        // Content script might already be injected, continue
      }

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
    if (text.includes('news') || text.includes('article')) keywords.push('news');
    if (text.includes('business') || text.includes('startup')) keywords.push('business');
    
    console.log('Generated tags from content:', keywords);
    
    // Add unique keywords as user tags
    keywords.forEach(keyword => {
      if (!this.userTags.includes(keyword)) {
        this.userTags.push(keyword);
      }
    });
    
    this.renderUserTags();
  }

  async saveQuote() {
    try {
      this.showStatusMain('Saving...', 'info');

      // Process any input tags before saving
      this.processInputTags();

      const content = document.getElementById('content').value.trim();
      if (!content) {
        this.showStatusMain('Please add some content to save', 'error');
        return;
      }

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const domain = tab.url ? new URL(tab.url).hostname : '';

      const quoteData = [
        tab.title || 'Untitled',
        content,
        tab.url || '',
        this.userTags.join(', '),
        new Date().toISOString(),
        domain
      ];

      const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}/values/A:F:append?valueInputOption=RAW`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          values: [quoteData]
        })
      });

      if (response.ok) {
        this.showStatusMain('Quote saved successfully!', 'success');
        
        // Clear the form
        document.getElementById('content').value = '';
        this.userTags = [];
        this.renderUserTags();
        
        // Close popup after a brief delay
        setTimeout(() => {
          window.close();
        }, 1500);
      } else {
        throw new Error(`Failed to save: ${response.status}`);
      }
    } catch (error) {
      console.error('Save failed:', error);
      this.showStatusMain('Failed to save quote. Please try again.', 'error');
    }
  }

  showAuthInterface() {
    document.getElementById('auth-section').style.display = 'block';
    document.getElementById('main-section').classList.remove('active');
  }

  showMainInterface() {
    document.getElementById('auth-section').style.display = 'none';
    document.getElementById('main-section').classList.add('active');
    
    // Show "Create Web Viewer" button if no web app exists yet
    this.checkAndShowWebViewerButton();
  }

  async checkAndShowWebViewerButton() {
    try {
      const stored = await chrome.storage.local.get(['webAppUrl']);
      const createButton = document.getElementById('create-web-viewer-button');
      
      if (!stored.webAppUrl) {
        // No web app created yet, show the create button
        createButton.style.display = 'block';
      } else {
        // Web app exists, hide create button and show the existing web app button
        createButton.style.display = 'none';
        this.addWebAppButtons(stored.webAppUrl);
      }
    } catch (error) {
      console.log('Could not check web app status');
    }
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

  async deployPersonalWebApp() {
    try {
      // Check if we already have a web app deployed
      const stored = await chrome.storage.local.get(['webAppUrl', 'webAppScriptId']);
      if (stored.webAppUrl && stored.webAppScriptId) {
        console.log('Web app already deployed:', stored.webAppUrl);
        this.addWebAppButtons(stored.webAppUrl);
        return;
      }

      // Create a simple online viewer using Google Sheets directly
      // This is more reliable than trying to create Apps Script projects
      this.createSimpleWebViewer();
      
    } catch (error) {
      console.error('Failed to create personal web app:', error);
      this.showStatusMain('Unable to create web viewer automatically. You can view your quotes in Google Sheets directly.', 'info');
      this.addGoogleSheetsButton();
    }
  }

  createSimpleWebViewer() {
    try {
      // Create a direct link to the Google Sheets with a better view
      const sheetsViewUrl = `https://docs.google.com/spreadsheets/d/${this.spreadsheetId}/edit#gid=0`;
      
      // Store this as our "web app" URL
      chrome.storage.local.set({ 
        webAppUrl: sheetsViewUrl,
        webAppType: 'sheets_direct' 
      });

      this.showStatusMain('Web viewer created! Click "View Online" to see your quotes.', 'success');
      this.addWebAppButtons(sheetsViewUrl);
      
    } catch (error) {
      console.error('Failed to create simple web viewer:', error);
      this.showStatusMain('Added direct Google Sheets access instead.', 'info');
      this.addGoogleSheetsButton();
    }
  }

  addGoogleSheetsButton() {
    // Add a button to open Google Sheets directly
    const createButton = document.getElementById('create-web-viewer-button');
    if (createButton) {
      createButton.style.display = 'none';
    }

    // Create Google Sheets button if it doesn't exist
    const existingButton = document.querySelector('.google-sheets-button');
    if (!existingButton) {
      const sheetsButton = document.createElement('button');
      sheetsButton.className = 'btn google-sheets-button';
      sheetsButton.style.cssText = 'background: #0f9d58; color: white; margin-top: 8px; font-size: 12px;';
      sheetsButton.innerHTML = '📊 View in Google Sheets';
      sheetsButton.onclick = () => {
        const sheetsUrl = `https://docs.google.com/spreadsheets/d/${this.spreadsheetId}/edit#gid=0`;
        chrome.tabs.create({ url: sheetsUrl });
      };
      
      document.querySelector('.actions').appendChild(sheetsButton);
    }
  }

  addWebAppButtons(webAppUrl) {
    // Hide create button
    const createButton = document.getElementById('create-web-viewer-button');
    if (createButton) {
      createButton.style.display = 'none';
    }

    // Add "View Online" button if it doesn't exist
    const existingButton = document.querySelector('.web-app-button');
    if (!existingButton) {
      const viewButton = document.createElement('button');
      viewButton.textContent = '🌐 View Online';
      viewButton.className = 'btn web-app-button';
      viewButton.style.cssText = `
        background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
        color: white;
        margin-top: 8px;
        font-size: 12px;
        width: 100%;
      `;
      
      viewButton.onclick = () => {
        chrome.tabs.create({ url: webAppUrl });
      };

      document.querySelector('.actions').appendChild(viewButton);
    }

    console.log('Added web app button to popup');
  }
}

// Initialize when popup loads
new EnhancedQuoteCollector();