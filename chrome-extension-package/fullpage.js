// Full Page Quote Collector - Local Extension with Google Sheets Integration
class FullPageQuoteCollector {
  constructor() {
    this.clientId = '184152653641-m443n0obiua9uotnkts6lsbbo8ikks80.apps.googleusercontent.com';
    this.accessToken = null;
    this.spreadsheetId = null;
    this.allContent = [];
    this.filteredContent = [];
    this.allTags = new Set();
    this.init();
  }

  async init() {
    this.setupEventListeners();
    await this.checkAuthAndLoadData();
  }

  setupEventListeners() {
    // Search functionality
    document.getElementById('search-input').addEventListener('input', (e) => {
      this.filterContent();
    });

    // Tag filter
    document.getElementById('tag-filter').addEventListener('change', (e) => {
      this.filterContent();
    });

    // Date filter
    document.getElementById('date-filter').addEventListener('change', (e) => {
      this.filterContent();
    });

    // Auth link
    document.getElementById('auth-link').addEventListener('click', (e) => {
      e.preventDefault();
      this.authenticate();
    });
  }

  async checkAuthAndLoadData() {
    try {
      // Check for existing auth
      const tokenResult = await chrome.identity.getAuthToken({ interactive: false });
      
      if (tokenResult) {
        let accessToken;
        if (typeof tokenResult === 'object' && tokenResult !== null && tokenResult.token) {
          accessToken = tokenResult.token;
        } else if (typeof tokenResult === 'string') {
          accessToken = tokenResult;
        }

        if (accessToken) {
          this.accessToken = accessToken;
          const isValid = await this.validateToken();
          
          if (isValid) {
            const stored = await chrome.storage.local.get(['spreadsheetId']);
            if (stored.spreadsheetId) {
              this.spreadsheetId = stored.spreadsheetId;
              await this.loadDataFromSheets();
              return;
            }
          } else {
            // Remove invalid token
            const tokenToRemove = typeof tokenResult === 'object' ? tokenResult.token : tokenResult;
            await chrome.identity.removeCachedAuthToken({ token: tokenToRemove });
          }
        }
      }
    } catch (error) {
      console.log('No existing auth found');
    }

    this.showAuthRequired();
  }

  async validateToken() {
    try {
      const response = await fetch(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${this.accessToken}`);
      return response.ok;
    } catch {
      return false;
    }
  }

  async authenticate() {
    try {
      // Clear any existing tokens
      await chrome.identity.clearAllCachedAuthTokens();

      const tokenResult = await chrome.identity.getAuthToken({ 
        interactive: true,
        scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive.file']
      });

      let accessToken;
      if (typeof tokenResult === 'object' && tokenResult !== null && tokenResult.token) {
        accessToken = tokenResult.token;
        
        // Verify we have the required scope
        const grantedScopes = tokenResult.grantedScopes || [];
        const hasSheetScope = grantedScopes.some(scope => 
          scope.includes('spreadsheets') || scope.includes('sheets')
        );

        if (!hasSheetScope) {
          throw new Error('Missing required Google Sheets permission');
        }
      } else if (typeof tokenResult === 'string' && tokenResult) {
        accessToken = tokenResult;
      } else {
        throw new Error('Authentication failed - invalid response');
      }

      this.accessToken = accessToken;
      
      // Get or create spreadsheet
      const stored = await chrome.storage.local.get(['spreadsheetId']);
      if (stored.spreadsheetId) {
        this.spreadsheetId = stored.spreadsheetId;
      } else {
        await this.createSpreadsheet();
      }

      await this.loadDataFromSheets();

    } catch (error) {
      this.showError(`Authentication failed: ${error.message}`);
    }
  }

  async createSpreadsheet() {
    try {
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
        const headers = ['Date', 'Title', 'Content', 'URL', 'Tags'];
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

      } else {
        throw new Error(`Failed to create spreadsheet: ${response.status}`);
      }

    } catch (error) {
      this.showError(`Spreadsheet creation failed: ${error.message}`);
    }
  }

  async loadDataFromSheets() {
    this.showLoading(true);
    
    try {
      const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}/values/A:E`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        const rows = data.values || [];
        
        // Skip header row, convert to content objects
        this.allContent = rows.slice(1).map((row, index) => ({
          id: index,
          date: row[0] || '',
          title: row[1] || 'Untitled',
          content: row[2] || '',
          url: row[3] || '',
          tags: row[4] ? row[4].split(', ').filter(Boolean) : [],
          createdAt: row[0] || new Date().toLocaleDateString()
        })).reverse(); // Show newest first

        // Extract all unique tags
        this.allTags = new Set();
        this.allContent.forEach(item => {
          item.tags.forEach(tag => this.allTags.add(tag));
        });

        this.populateTagFilter();
        this.updateStats();
        this.filteredContent = [...this.allContent];
        this.renderContent();
        this.showMainContent();

      } else {
        throw new Error(`Failed to load data: ${response.status}`);
      }

    } catch (error) {
      this.showError(`Failed to load collection: ${error.message}`);
    } finally {
      this.showLoading(false);
    }
  }

  populateTagFilter() {
    const tagFilter = document.getElementById('tag-filter');
    tagFilter.innerHTML = '<option value="">All Tags</option>';
    
    Array.from(this.allTags).sort().forEach(tag => {
      const option = document.createElement('option');
      option.value = tag;
      option.textContent = tag;
      tagFilter.appendChild(option);
    });
  }

  filterContent() {
    const searchQuery = document.getElementById('search-input').value.toLowerCase();
    const selectedTag = document.getElementById('tag-filter').value;
    const dateFilter = document.getElementById('date-filter').value;

    this.filteredContent = this.allContent.filter(item => {
      // Search in title and content
      const matchesSearch = !searchQuery || 
        item.title.toLowerCase().includes(searchQuery) ||
        item.content.toLowerCase().includes(searchQuery);

      // Filter by tag
      const matchesTag = !selectedTag || item.tags.includes(selectedTag);

      // Filter by date
      const matchesDate = !dateFilter || item.date === new Date(dateFilter).toLocaleDateString();

      return matchesSearch && matchesTag && matchesDate;
    });

    this.renderContent();
  }

  updateStats() {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const thisMonthCount = this.allContent.filter(item => {
      const itemDate = new Date(item.date);
      return itemDate.getMonth() === currentMonth && itemDate.getFullYear() === currentYear;
    }).length;

    const uniqueWebsites = new Set(
      this.allContent.map(item => {
        try {
          return new URL(item.url).hostname;
        } catch {
          return item.url;
        }
      })
    ).size;

    document.getElementById('stat-total').textContent = this.allContent.length;
    document.getElementById('stat-tags').textContent = this.allTags.size;
    document.getElementById('stat-month').textContent = thisMonthCount;
    document.getElementById('stat-websites').textContent = uniqueWebsites;
  }

  renderContent() {
    const grid = document.getElementById('content-grid');
    
    if (this.filteredContent.length === 0) {
      grid.style.display = 'none';
      document.getElementById('empty-state').style.display = 'block';
      return;
    }

    grid.style.display = 'grid';
    document.getElementById('empty-state').style.display = 'none';

    grid.innerHTML = this.filteredContent.map(item => `
      <div class="content-card">
        <div class="content-body">
          <p class="content-quote">${this.escapeHtml(item.content)}</p>
          
          <a href="${item.url}" target="_blank" class="content-title">
            ${this.escapeHtml(item.title)}
          </a>
          
          <div class="content-tags">
            ${item.tags.map(tag => `
              <span class="tag" onclick="window.selectTag('${tag}')">${this.escapeHtml(tag)}</span>
            `).join('')}
          </div>
          
          <div class="content-footer">
            <a href="${item.url}" target="_blank" class="content-source">
              ${this.getHostname(item.url)}
            </a>
            <span class="content-date">${this.formatDate(item.date)}</span>
          </div>
        </div>
      </div>
    `).join('');
  }

  selectTag(tag) {
    document.getElementById('tag-filter').value = tag;
    this.filterContent();
  }

  getHostname(url) {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  }

  formatDate(dateStr) {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffTime = Math.abs(now - date);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) return "1 day ago";
      if (diffDays <= 7) return `${diffDays} days ago`;
      
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      });
    } catch {
      return dateStr;
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  showAuthRequired() {
    document.getElementById('auth-required').style.display = 'block';
    document.getElementById('main-content').style.display = 'none';
  }

  showMainContent() {
    document.getElementById('auth-required').style.display = 'none';
    document.getElementById('main-content').style.display = 'block';
  }

  showLoading(show) {
    document.getElementById('loading').style.display = show ? 'block' : 'none';
  }

  showError(message) {
    const errorDiv = document.getElementById('error-message');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    setTimeout(() => {
      errorDiv.style.display = 'none';
    }, 5000);
  }
}

// Global function for tag selection (called from HTML)
window.selectTag = function(tag) {
  document.getElementById('tag-filter').value = tag;
  window.fullPageCollector.filterContent();
}

// Initialize the full page view
window.fullPageCollector = new FullPageQuoteCollector();