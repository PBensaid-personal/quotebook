// Full page Quotebook simulator

class FullPageSimulator {
  constructor() {
    this.accessToken = 'demo-access-token';
    this.spreadsheetId = 'demo-spreadsheet-id';
    this.contentData = [];
    this.filteredData = [];
    this.displayedItems = [];
    this.itemsPerPage = 30;
    this.currentPage = 1;
    this.init();
  }

  async init() {
    console.log("Initializing Full Page Simulator...");

    // Simulate having auth data
    this.accessToken = 'demo-access-token';
    this.spreadsheetId = 'demo-spreadsheet-id';

    this.setupEventListeners();
    await this.loadSimulatedContent();
    this.updateSpreadsheetLink();
  }

  setupEventListeners() {
    // Search and filter listeners
    document.getElementById('searchInput').addEventListener('input', () => {
      this.applyFilters();
    });

    document.getElementById('tagFilter').addEventListener('change', () => {
      this.applyFilters();
    });

    document.getElementById('dateFilter').addEventListener('change', () => {
      this.applyFilters();
    });

    // Load more button
    document.getElementById('load-more-btn').addEventListener('click', () => {
      this.loadMoreItems();
    });
  }

  async loadSimulatedContent() {
    console.log("Loading simulated content...");
    
    // Show loading state
    document.getElementById('loading').style.display = 'block';
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Generate simulated data
    this.contentData = this.generateSimulatedData();
    
    console.log(`Loaded ${this.contentData.length} simulated items`);

    // Hide loading and render
    document.getElementById('loading').style.display = 'none';
    this.populateTagFilter();
    this.applyFilters();
    this.renderStats();
  }

  generateSimulatedData() {
    const sampleData = [
      {
        id: 1,
        title: "The Power of Simple Design",
        content: "Simplicity is the ultimate sophistication. Great design is not about adding more features, but about removing everything unnecessary while keeping what truly matters.",
        url: "https://medium.com/design-principles",
        tags: ["design", "simplicity", "ux"],
        date: new Date('2024-01-15').toISOString(),
        originalRowIndex: 0
      },
      {
        id: 2,
        title: "Building Better Software",
        content: "The best software is written not just to work, but to be understood. Code readability and maintainability should be prioritized from day one of any project.",
        url: "https://stackoverflow.com/software-engineering",
        tags: ["programming", "software", "best-practices"],
        date: new Date('2024-01-14').toISOString(),
        originalRowIndex: 1
      },
      {
        id: 3,
        title: "The Art of Learning",
        content: "Learning how to learn is perhaps the most important skill in our rapidly changing world. Embrace curiosity, ask questions, and never stop growing.",
        url: "https://www.coursera.org/learning",
        tags: ["learning", "growth", "education"],
        date: new Date('2024-01-13').toISOString(),
        originalRowIndex: 2
      },
      {
        id: 4,
        title: "Effective Communication",
        content: "Clear communication is not about using complex words, but about conveying ideas in the simplest way possible. Listen more than you speak.",
        url: "https://www.ted.com/communication",
        tags: ["communication", "leadership", "soft-skills"],
        date: new Date('2024-01-12').toISOString(),
        originalRowIndex: 3
      },
      {
        id: 5,
        title: "Innovation Mindset",
        content: "Innovation doesn't always mean inventing something new. Often it means looking at existing problems from a different angle and finding better solutions.",
        url: "https://www.harvard.edu/innovation",
        tags: ["innovation", "creativity", "problem-solving"],
        date: new Date('2024-01-11').toISOString(),
        originalRowIndex: 4
      },
      {
        id: 6,
        title: "Digital Minimalism",
        content: "Technology should enhance our lives, not control them. Be intentional about your digital consumption and focus on tools that truly add value.",
        url: "https://www.nytimes.com/digital-minimalism",
        tags: ["minimalism", "technology", "productivity"],
        date: new Date('2024-01-10').toISOString(),
        originalRowIndex: 5
      }
    ];

    return sampleData;
  }

  populateTagFilter() {
    const tagFilter = document.getElementById('tagFilter');
    const allTags = [...new Set(this.contentData.flatMap(item => item.tags))].sort();
    
    // Clear existing options (except "All Tags")
    while (tagFilter.children.length > 1) {
      tagFilter.removeChild(tagFilter.lastChild);
    }
    
    // Add tag options
    allTags.forEach(tag => {
      const option = document.createElement('option');
      option.value = tag;
      option.textContent = tag;
      tagFilter.appendChild(option);
    });
  }

  applyFilters() {
    const searchQuery = document.getElementById('searchInput').value.toLowerCase();
    const tagFilter = document.getElementById('tagFilter').value;
    const dateFilter = document.getElementById('dateFilter').value;

    this.filteredData = this.contentData.filter(item => {
      // Search filter
      if (searchQuery && !item.title.toLowerCase().includes(searchQuery) && 
          !item.content.toLowerCase().includes(searchQuery) &&
          !item.tags.some(tag => tag.toLowerCase().includes(searchQuery))) {
        return false;
      }

      // Tag filter
      if (tagFilter && !item.tags.includes(tagFilter)) {
        return false;
      }

      // Date filter
      if (dateFilter) {
        const itemDate = new Date(item.date);
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        switch (dateFilter) {
          case 'today':
            if (itemDate < today) return false;
            break;
          case 'week':
            const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
            if (itemDate < weekAgo) return false;
            break;
          case 'month':
            const monthAgo = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
            if (itemDate < monthAgo) return false;
            break;
        }
      }

      return true;
    });

    // Sort by date (newest first)
    this.filteredData.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Reset pagination
    this.currentPage = 1;
    this.displayedItems = [];
    
    this.renderContent();
    this.updateLoadMoreButton();
  }

  loadMoreItems() {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    const newItems = this.filteredData.slice(startIndex, endIndex);
    
    this.displayedItems.push(...newItems);
    this.currentPage++;
    
    this.renderContent();
    this.updateLoadMoreButton();
  }

  updateLoadMoreButton() {
    const loadMoreContainer = document.getElementById('load-more-container');
    const hasMore = this.displayedItems.length < this.filteredData.length;
    
    if (hasMore && this.filteredData.length > 0) {
      loadMoreContainer.style.display = 'block';
      const remaining = this.filteredData.length - this.displayedItems.length;
      document.getElementById('load-more-btn').textContent = `Load More Quotes (${remaining} remaining)`;
    } else {
      loadMoreContainer.style.display = 'none';
    }
  }

  renderContent() {
    // Load initial items if needed
    if (this.displayedItems.length === 0 && this.filteredData.length > 0) {
      this.loadMoreItems();
      return;
    }

    const contentContainer = document.getElementById('content');
    
    if (this.displayedItems.length === 0) {
      document.getElementById('no-results').style.display = 'block';
      contentContainer.innerHTML = '';
      return;
    }

    document.getElementById('no-results').style.display = 'none';
    this.renderMasonryLayout();
    this.attachEventListeners();
  }

  renderMasonryLayout() {
    const contentContainer = document.getElementById('content');
    contentContainer.innerHTML = '';
    
    // Number of columns based on screen size
    const getColumnCount = () => {
      if (window.innerWidth <= 600) return 1;
      if (window.innerWidth <= 1000) return 2;
      return 3;
    };
    
    const columnCount = getColumnCount();
    
    // Create columns
    const columns = [];
    const columnHeights = [];
    
    for (let i = 0; i < columnCount; i++) {
      const column = document.createElement('div');
      column.className = 'masonry-column';
      column.style.cssText = `
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 20px;
        margin: ${i === 0 ? '0' : '0 0 0 20px'};
      `;
      columns.push(column);
      columnHeights.push(0);
      contentContainer.appendChild(column);
    }

    // Set container style
    contentContainer.style.cssText = `
      display: flex;
      gap: 0;
      align-items: flex-start;
    `;

    this.displayedItems.forEach((item) => {
      // Find shortest column
      const shortestColumnIndex = columnHeights.indexOf(Math.min(...columnHeights));
      
      // Create card element
      const cardElement = document.createElement('div');
      cardElement.className = 'content-card';
      cardElement.setAttribute('data-item-id', item.id);
      cardElement.setAttribute('data-url', this.escapeHtml(item.url));
      
      cardElement.innerHTML = `
        <div class="content-actions">
          <button class="delete-btn" data-item-id="${item.id}" title="Delete">
            <svg width="19px" height="19px" stroke-width="2" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" color="#000000">
              <path d="M6.75827 17.2426L12.0009 12M17.2435 6.75736L12.0009 12M12.0009 12L6.75827 6.75736M12.0009 12L17.2435 17.2426" stroke="#000000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
            </svg>
          </button>
        </div>
        
        ${item.image ? `<img src="${item.image}" alt="" class="content-image">` : ""}
        
        <div class="content-text">
          ${this.escapeHtml(item.content)}
        </div>
        
        <div class="content-title">
          ${this.escapeHtml(item.title)}
        </div>
        
        ${
          item.tags.length > 0
            ? `
          <div class="content-tags">
            ${item.tags
              .map(
                (tag) => `
              <span class="tag-pill" data-tag="${this.escapeHtml(tag)}">
                ${this.escapeHtml(tag)}
              </span>`,
              )
              .join("")}
          </div>
        `
            : ""
        }
        
        <div class="content-meta">
          <span class="content-domain">${this.getDomain(item.url)}</span>
          <time class="content-date">${this.formatDate(item.date)}</time>
        </div>
      `;
      
      // Add to shortest column
      columns[shortestColumnIndex].appendChild(cardElement);
      
      // Estimate card height (rough approximation)
      const estimatedHeight = 200 + (item.content.length / 5); // Base height + content length factor
      columnHeights[shortestColumnIndex] += estimatedHeight;
    });
  }

  attachEventListeners() {
    // Card click listeners (open URL)
    document.querySelectorAll('.content-card').forEach((card) => {
      card.addEventListener('click', (e) => {
        // Don't open URL if clicking on delete button or tag pills
        if (e.target.closest('.delete-btn') || e.target.closest('.tag-pill')) {
          return;
        }
        
        const url = card.getAttribute('data-url');
        if (url) {
          window.open(url, '_blank');
        }
      });
    });

    // Delete button event listeners
    document.querySelectorAll('.delete-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const itemId = btn.getAttribute('data-item-id');
        this.simulateDeleteItem(parseInt(itemId));
      });
    });

    // Tag pill event listeners
    document.querySelectorAll('.tag-pill').forEach((pill) => {
      pill.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const tag = pill.getAttribute('data-tag');
        document.getElementById('tagFilter').value = tag;
        this.applyFilters();
      });
    });
  }

  async simulateDeleteItem(itemId) {
    // Show custom modal instead of ugly browser confirm
    const confirmed = await this.showDeleteConfirmation();
    if (!confirmed) {
      return;
    }

    try {
      console.log("Simulating deletion of item with ID:", itemId);

      // Find the item in our data array
      const itemIndex = this.contentData.findIndex((item) => item.id === itemId);
      if (itemIndex === -1) {
        console.error("Item not found:", itemId);
        this.showErrorMessage("Item not found. Please refresh and try again.");
        return;
      }

      // Remove from data
      this.contentData.splice(itemIndex, 1);

      // Store current state
      const currentSearchQuery = document.getElementById("searchInput").value;
      const currentTagFilter = document.getElementById("tagFilter").value;
      const currentDateFilter = document.getElementById("dateFilter").value;

      console.log("Item deleted successfully (simulated)");

      // Refresh content
      this.populateTagFilter();
      
      // Restore filter state
      document.getElementById("searchInput").value = currentSearchQuery;
      document.getElementById("tagFilter").value = currentTagFilter;
      document.getElementById("dateFilter").value = currentDateFilter;

      // Reapply filters
      this.applyFilters();
      this.renderStats();

      console.log("Deletion completed with preserved state");
    } catch (error) {
      console.error("Failed to delete item:", error);
      this.showErrorMessage("Failed to delete item. Please try again. Error: " + error.message);
    }
  }

  showDeleteConfirmation() {
    return new Promise((resolve) => {
      const modal = document.getElementById('delete-modal');
      const confirmBtn = document.getElementById('confirm-delete');
      const cancelBtn = document.getElementById('cancel-delete');
      
      // Show modal
      modal.style.display = 'flex';
      
      // Handle confirm
      const handleConfirm = () => {
        cleanup();
        resolve(true);
      };
      
      // Handle cancel
      const handleCancel = () => {
        cleanup();
        resolve(false);
      };
      
      // Handle clicking outside modal
      const handleOverlayClick = (e) => {
        if (e.target === modal) {
          handleCancel();
        }
      };
      
      // Handle escape key
      const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
          handleCancel();
        }
      };
      
      // Cleanup function
      const cleanup = () => {
        modal.style.display = 'none';
        confirmBtn.removeEventListener('click', handleConfirm);
        cancelBtn.removeEventListener('click', handleCancel);
        modal.removeEventListener('click', handleOverlayClick);
        document.removeEventListener('keydown', handleKeyDown);
      };
      
      // Add event listeners
      confirmBtn.addEventListener('click', handleConfirm);
      cancelBtn.addEventListener('click', handleCancel);
      modal.addEventListener('click', handleOverlayClick);
      document.addEventListener('keydown', handleKeyDown);
    });
  }

  showErrorMessage(message) {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #dc2626;
      color: white;
      padding: 16px 24px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 10001;
      max-width: 400px;
      font-size: 14px;
      line-height: 1.4;
      animation: slideIn 0.3s ease-out;
    `;
    
    toast.textContent = message;
    document.body.appendChild(toast);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (toast.parentNode) {
        toast.style.animation = 'slideIn 0.3s ease-out reverse';
        setTimeout(() => {
          if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
          }
        }, 300);
      }
    }, 5000);
  }

  renderStats() {
    const statsContainer = document.getElementById("stats");
    const totalItems = this.contentData.length;
    const totalTags = [...new Set(this.contentData.flatMap((item) => item.tags))].length;
    const thisMonth = this.contentData.filter((item) => {
      const itemDate = new Date(item.date);
      const now = new Date();
      return (
        itemDate.getMonth() === now.getMonth() &&
        itemDate.getFullYear() === now.getFullYear()
      );
    }).length;
    const uniqueWebsites = [...new Set(
      this.contentData.map((item) => {
        try {
          return new URL(item.url).hostname;
        } catch {
          return "Unknown";
        }
      })
    )].length;

    statsContainer.innerHTML = `
      <div class="stat-card">
        <span class="stat-number">${totalItems}</span>
        <span class="stat-label">Total</span>
      </div>
      <div class="stat-card">
        <span class="stat-number">${totalTags}</span>
        <span class="stat-label">Tags</span>
      </div>
      <div class="stat-card">
        <span class="stat-number">${thisMonth}</span>
        <span class="stat-label">This Month</span>
      </div>
      <div class="stat-card">
        <span class="stat-number">${uniqueWebsites}</span>
        <span class="stat-label">Sites</span>
      </div>
    `;
  }

  updateSpreadsheetLink() {
    const link = document.getElementById('spreadsheet-link');
    if (link) {
      // Simulate spreadsheet link
      link.href = 'https://docs.google.com/spreadsheets/d/demo-spreadsheet-id/edit';
      link.title = 'Open Google Sheet (Simulated)';
    }
  }

  formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  getDomain(url) {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return 'Unknown';
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new FullPageSimulator();
});