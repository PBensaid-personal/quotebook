// Full page Quote Collector interface

class FullPageCollector {
  constructor() {
    this.accessToken = null;
    this.spreadsheetId = null;
    this.contentData = [];
    this.filteredData = [];
    this.init();
  }

  async init() {
    console.log('Initializing Full Page Collector...');
    
    // Check for existing auth
    const result = await chrome.storage.local.get(['googleAccessToken', 'googleSpreadsheetId']);
    
    if (result.googleAccessToken && result.googleSpreadsheetId) {
      this.accessToken = result.googleAccessToken;
      this.spreadsheetId = result.googleSpreadsheetId;
      await this.loadContent();
    } else {
      this.showAuthRequired();
    }

    this.setupEventListeners();
  }

  setupEventListeners() {
    const searchInput = document.getElementById('searchInput');
    const tagFilter = document.getElementById('tagFilter');
    const dateFilter = document.getElementById('dateFilter');
    const authButton = document.getElementById('auth-button');

    if (searchInput) {
      searchInput.addEventListener('input', () => this.applyFilters());
    }
    if (tagFilter) {
      tagFilter.addEventListener('change', () => this.applyFilters());
    }
    if (dateFilter) {
      dateFilter.addEventListener('change', () => this.applyFilters());
    }
    if (authButton) {
      authButton.addEventListener('click', () => this.authenticateWithGoogle());
    }
  }

  async authenticateWithGoogle() {
    try {
      console.log('Starting authentication...');
      
      const redirectURL = chrome.identity.getRedirectURL();
      const clientId = '184152653641-m443n0obiua9uotnkts6lsbbo8ikks80.apps.googleusercontent.com';
      const scopes = ['https://www.googleapis.com/auth/spreadsheets'];
      let authURL = 'https://accounts.google.com/oauth2/authorize';
      authURL += `?client_id=${clientId}`;
      authURL += `&response_type=token`;
      authURL += `&redirect_uri=${encodeURIComponent(redirectURL)}`;
      authURL += `&scope=${encodeURIComponent(scopes.join(' '))}`;

      const result = await chrome.identity.launchWebAuthFlow({
        url: authURL,
        interactive: true
      });

      const url = new URL(result);
      const params = new URLSearchParams(url.hash.substring(1));
      const accessToken = params.get('access_token');

      if (!accessToken) {
        throw new Error('No access token received');
      }

      this.accessToken = accessToken;
      
      // Create or find spreadsheet
      const spreadsheetId = await this.setupSpreadsheet();
      this.spreadsheetId = spreadsheetId;

      // Save to storage
      await chrome.storage.local.set({
        googleAccessToken: accessToken,
        googleSpreadsheetId: spreadsheetId
      });

      await this.loadContent();
      console.log('Authentication successful!');

    } catch (error) {
      console.error('Authentication failed:', error);
      alert('Authentication failed. Please try again.');
    }
  }

  async setupSpreadsheet() {
    try {
      console.log('Looking for existing Quote Collector spreadsheet...');

      // Search for existing Quote Collector spreadsheets
      const searchResponse = await fetch(`https://www.googleapis.com/drive/v3/files?q=name contains 'Quote Collector' and mimeType='application/vnd.google-apps.spreadsheet'&fields=files(id,name,createdTime)`, {
        headers: { 'Authorization': `Bearer ${this.accessToken}` }
      });

      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        const existingSheets = searchData.files || [];

        if (existingSheets.length > 0) {
          // Sort by creation date (newest first)
          existingSheets.sort((a, b) => new Date(b.createdTime) - new Date(a.createdTime));
          
          console.log(`Found existing spreadsheet: "${existingSheets[0].name}"`);
          return existingSheets[0].id;
        }
      }

      // No existing spreadsheet found, create a new one
      console.log('Creating new Quote Collector spreadsheet...');
      
      const createResponse = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
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

      const spreadsheet = await createResponse.json();
      const spreadsheetId = spreadsheet.spreadsheetId;

      // Add headers
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A1:G1?valueInputOption=RAW`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [['Title', 'Content', 'URL', 'Tags', 'Date', 'Image', 'Categories']]
        })
      });

      console.log('New Quote Collector spreadsheet created!');
      return spreadsheetId;
    } catch (error) {
      console.error('Failed to setup spreadsheet:', error);
      throw error;
    }
  }

  async loadContent() {
    try {
      this.showLoading(true);

      const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}/values/A2:G1000`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          // Spreadsheet was deleted, clear stored ID and show auth required
          await chrome.storage.local.remove(['googleSpreadsheetId']);
          this.spreadsheetId = null;
          this.showAuthRequired();
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const rows = data.values || [];

      this.contentData = rows.map((row, index) => ({
        id: index + 2, // Row number (starting from 2 since 1 is header)
        title: row[0] || 'Untitled',
        content: row[1] || '',
        url: row[2] || '',
        tags: row[3] ? row[3].split(',').map(tag => tag.trim()).filter(tag => tag) : [],
        date: row[4] || new Date().toISOString().split('T')[0],
        image: row[5] || '',
        categories: row[6] ? row[6].split(',').map(cat => cat.trim()).filter(cat => cat) : []
      }));

      this.filteredData = [...this.contentData];
      this.renderStats();
      this.renderTagFilter();
      this.renderContent();
      this.showLoading(false);

    } catch (error) {
      console.error('Failed to load content:', error);
      this.showLoading(false);
      if (error.message.includes('401')) {
        this.showAuthRequired();
      } else if (error.message.includes('404')) {
        // Spreadsheet deleted - clear data and require re-auth
        await chrome.storage.local.clear();
        this.showAuthRequired();
      }
    }
  }

  async deleteItem(itemId) {
    if (!confirm('Are you sure you want to delete this item?')) {
      return;
    }

    try {
      // Delete row from spreadsheet
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}:batchUpdate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [{
            deleteDimension: {
              range: {
                sheetId: 0,
                dimension: 'ROWS',
                startIndex: itemId - 1,
                endIndex: itemId
              }
            }
          }]
        })
      });

      // Reload content
      await this.loadContent();
      
    } catch (error) {
      console.error('Failed to delete item:', error);
      alert('Failed to delete item. Please try again.');
    }
  }

  renderStats() {
    const statsContainer = document.getElementById('stats');
    const totalItems = this.contentData.length;
    const totalTags = [...new Set(this.contentData.flatMap(item => item.tags))].length;
    const thisMonth = this.contentData.filter(item => {
      const itemDate = new Date(item.date);
      const now = new Date();
      return itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear();
    }).length;
    const uniqueWebsites = [...new Set(this.contentData.map(item => {
      try {
        return new URL(item.url).hostname;
      } catch {
        return 'Unknown';
      }
    }))].length;

    statsContainer.innerHTML = `
      <div class="stat-card">
        <div class="stat-number">${totalItems}</div>
        <div class="stat-label">Total Items</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${totalTags}</div>
        <div class="stat-label">Unique Tags</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${thisMonth}</div>
        <div class="stat-label">This Month</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${uniqueWebsites}</div>
        <div class="stat-label">Websites</div>
      </div>
    `;
  }

  renderTagFilter() {
    const tagFilter = document.getElementById('tagFilter');
    const allTags = [...new Set(this.contentData.flatMap(item => item.tags))].sort();
    
    tagFilter.innerHTML = '<option value="">All Tags</option>';
    allTags.forEach(tag => {
      const option = document.createElement('option');
      option.value = tag;
      option.textContent = tag;
      tagFilter.appendChild(option);
    });
  }

  applyFilters() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const selectedTag = document.getElementById('tagFilter').value;
    const dateRange = document.getElementById('dateFilter').value;

    this.filteredData = this.contentData.filter(item => {
      // Search filter
      const matchesSearch = !searchTerm || 
        item.title.toLowerCase().includes(searchTerm) ||
        item.content.toLowerCase().includes(searchTerm) ||
        item.tags.some(tag => tag.toLowerCase().includes(searchTerm));

      // Tag filter
      const matchesTag = !selectedTag || item.tags.includes(selectedTag);

      // Date filter
      let matchesDate = true;
      if (dateRange) {
        const itemDate = new Date(item.date);
        const now = new Date();
        switch (dateRange) {
          case 'today':
            matchesDate = itemDate.toDateString() === now.toDateString();
            break;
          case 'week':
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            matchesDate = itemDate >= weekAgo;
            break;
          case 'month':
            matchesDate = itemDate.getMonth() === now.getMonth() && 
                         itemDate.getFullYear() === now.getFullYear();
            break;
        }
      }

      return matchesSearch && matchesTag && matchesDate;
    });

    this.renderContent();
  }

  renderContent() {
    const contentContainer = document.getElementById('content');
    const noResults = document.getElementById('no-results');

    if (this.filteredData.length === 0) {
      contentContainer.style.display = 'none';
      noResults.style.display = 'block';
      return;
    }

    contentContainer.style.display = 'block';
    noResults.style.display = 'none';

    contentContainer.innerHTML = this.filteredData.map(item => `
      <div class="content-card">
        <div class="content-actions">
          <button class="delete-btn" onclick="fullPageCollector.deleteItem(${item.id})" title="Delete">
            🗑️
          </button>
        </div>
        
        ${item.image ? `<img src="${item.image}" alt="" class="content-image">` : ''}
        
        <a href="${item.url}" target="_blank" class="content-title">
          ${this.escapeHtml(item.title)}
        </a>
        
        <div class="content-text">
          ${this.escapeHtml(item.content)}
        </div>
        
        ${item.tags.length > 0 ? `
          <div class="content-tags">
            ${item.tags.map(tag => `
              <span class="tag-pill" onclick="document.getElementById('tagFilter').value='${this.escapeHtml(tag)}'; fullPageCollector.applyFilters()">
                ${this.escapeHtml(tag)}
              </span>`).join('')}
          </div>
        ` : ''}
        
        <div class="content-meta">
          <time class="content-date">${item.date}</time>
          <span class="content-domain">${this.getDomain(item.url)}</span>
        </div>
      </div>
    `).join('');
  }

  renderNoResults() {
    return `
      <div id="no-results" style="display: none;">
        <div style="text-align: center; padding: 60px 20px; color: hsl(25, 5.3%, 44.7%);">
          <h3 style="color: hsl(220, 30%, 18%); margin-bottom: 12px;">No content found</h3>
          <p>Try adjusting your search terms or filters</p>
        </div>
      </div>
    `;
  }

  getDomain(url) {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return 'Unknown';
    }
  }

  formatDate(dateStr) {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
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

  async clearAllData() {
    if (confirm('This will clear all stored data and require re-authentication. Continue?')) {
      await chrome.storage.local.clear();
      this.contentData = [];
      this.filteredData = [];
      this.accessToken = null;
      this.spreadsheetId = null;
      this.showAuthRequired();
    }
  }

  showLoading(show) {
    const loading = document.getElementById('loading');
    const content = document.getElementById('content');
    const stats = document.getElementById('stats');
    const authRequired = document.getElementById('auth-required');

    if (show) {
      loading.style.display = 'block';
      content.style.display = 'none';
      stats.style.display = 'none';
      authRequired.style.display = 'none';
    } else {
      loading.style.display = 'none';
      stats.style.display = 'grid';
    }
  }

  showAuthRequired() {
    const loading = document.getElementById('loading');
    const content = document.getElementById('content');
    const stats = document.getElementById('stats');
    const authRequired = document.getElementById('auth-required');

    loading.style.display = 'none';
    content.style.display = 'none';
    stats.style.display = 'none';
    authRequired.style.display = 'block';
  }
}

// Global functions
window.selectTag = function(tag) {
  const tagFilter = document.getElementById('tagFilter');
  tagFilter.value = tag;
  fullPageCollector.applyFilters();
};

window.authenticateWithGoogle = function() {
  fullPageCollector.authenticateWithGoogle();
};

// Initialize when page loads
let fullPageCollector;
document.addEventListener('DOMContentLoaded', () => {
  fullPageCollector = new FullPageCollector();
});