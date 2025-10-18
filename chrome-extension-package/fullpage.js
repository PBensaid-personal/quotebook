// Full page Quotebook interface

class FullPageCollector {
  constructor() {
    this.accessToken = null;
    this.spreadsheetId = null;
    this.contentData = [];
    this.filteredData = [];
    this.displayedItems = [];
    this.itemsPerPage = 30;
    this.currentPage = 1;
    this.init();
  }

  async init() {
    console.log("Initializing Full Page Collector...");

    // Initialize tooltips
    this.initTooltips();

    // Initialize dropdown buttons
    this.initDropdownButtons();

    // Wait a moment for storage to sync from popup
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Check for cached authentication data with multiple attempts
    let result = await chrome.storage.local.get([
      "googleAccessToken",
      "googleSpreadsheetId",
    ]);

    // If no data found, try a few more times with delays (popup may have just saved)
    for (
      let attempt = 0;
      attempt < 3 && (!result.googleAccessToken || !result.googleSpreadsheetId);
      attempt++
    ) {
      console.log(`Storage attempt ${attempt + 1}: waiting for sync...`);
      await new Promise((resolve) => setTimeout(resolve, 200 * (attempt + 1)));
      result = await chrome.storage.local.get([
        "googleAccessToken",
        "googleSpreadsheetId",
      ]);
    }

    console.log("Fullpage cached data:", {
      hasSpreadsheetId: !!result.googleSpreadsheetId,
      hasAccessToken: !!result.googleAccessToken,
      spreadsheetId: result.googleSpreadsheetId,
    });

    if (result.googleAccessToken && result.googleSpreadsheetId) {
      console.log(
        "Testing cached spreadsheet in fullpage:",
        result.googleSpreadsheetId,
      );
      // Verify the spreadsheet still exists and is not trashed
      try {
        // Check if file is trashed using Drive API
        const driveResponse = await fetch(
          `https://www.googleapis.com/drive/v3/files/${result.googleSpreadsheetId}?fields=trashed,name`,
          {
            headers: { Authorization: `Bearer ${result.googleAccessToken}` },
          },
        );

        console.log("Fullpage Drive API test response:", driveResponse.status);

        if (driveResponse.ok) {
          const fileInfo = await driveResponse.json();
          console.log("Fullpage file info:", fileInfo);

          if (fileInfo.trashed === true) {
            console.log("Fullpage spreadsheet is in trash, clearing cache");
            await chrome.storage.local.remove([
              "googleSpreadsheetId",
              "googleAccessToken",
            ]);
            this.showAuthRequired();
          } else {
            // File exists and is not trashed, verify it's still accessible via Sheets API
            const sheetsResponse = await fetch(
              `https://sheets.googleapis.com/v4/spreadsheets/${result.googleSpreadsheetId}`,
              {
                headers: {
                  Authorization: `Bearer ${result.googleAccessToken}`,
                },
              },
            );

            if (sheetsResponse.ok) {
              console.log(
                "Fullpage spreadsheet verified and accessible, loading content",
              );
              this.accessToken = result.googleAccessToken;
              this.spreadsheetId = result.googleSpreadsheetId;
              this.updateSpreadsheetLink();
              await this.loadContent();
            } else {
              console.log(
                "Fullpage spreadsheet not accessible via Sheets API, clearing cache",
              );
              await chrome.storage.local.remove([
                "googleSpreadsheetId",
                "googleAccessToken",
              ]);
              this.showAuthRequired();
            }
          }
        } else {
          // File not found or not accessible, clear cache and show auth
          console.log(
            "Fullpage file not accessible via Drive API, clearing cache",
          );
          await chrome.storage.local.remove([
            "googleSpreadsheetId",
            "googleAccessToken",
          ]);
          this.showAuthRequired();
        }
      } catch (error) {
        // Error accessing spreadsheet, clear cache and show auth
        console.log("Fullpage error testing spreadsheet:", error);
        await chrome.storage.local.remove([
          "googleSpreadsheetId",
          "googleAccessToken",
        ]);
        this.showAuthRequired();
      }
    } else {
      console.log("No cached data found after retries, showing auth required");
      this.showAuthRequired();
    }

    this.setupEventListeners();
  }

  setupEventListeners() {
    const searchInput = document.getElementById("searchInput");
    const tagFilter = document.getElementById("tagFilter");
    const dateFilter = document.getElementById("dateFilter");
    const authButton = document.getElementById("auth-button");
    const spreadsheetLink = document.getElementById("spreadsheet-link");
    const logo = document.getElementById("logo");

    if (searchInput) {
      searchInput.addEventListener("input", () => this.applyFilters());
    }
    if (tagFilter) {
      tagFilter.addEventListener("change", () => this.applyFilters());
    }
    if (dateFilter) {
      dateFilter.addEventListener("change", () => this.applyFilters());
    }
    if (authButton) {
      authButton.addEventListener("click", () => this.authenticateWithGoogle());
    }
    if (spreadsheetLink) {
      spreadsheetLink.addEventListener("click", (e) => {
        e.preventDefault();
        if (this.spreadsheetId) {
          window.open(
            `https://docs.google.com/spreadsheets/d/${this.spreadsheetId}/edit`,
            "_blank",
          );
        }
      });
    }
    if (logo) {
      logo.addEventListener("click", (e) => {
        e.preventDefault();
        this.clearAllFilters();
      });
    }

    const loadMoreBtn = document.getElementById("load-more-btn");
    if (loadMoreBtn) {
      loadMoreBtn.addEventListener("click", () => this.loadMoreItems());
    }

    const clearFiltersLink = document.getElementById("clear-filters-link");
    if (clearFiltersLink) {
      clearFiltersLink.addEventListener("click", (e) => {
        e.preventDefault();
        this.clearAllFilters();
      });
    }
  }

  async authenticateWithGoogle() {
    try {
      console.log("Starting authentication...");

      // Clear any existing cached data when re-authenticating
      await chrome.storage.local.remove([
        "googleSpreadsheetId",
        "googleAccessToken",
      ]);

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

      // Request new token using getAuthToken (same method as popup.js)
      console.log("Requesting authentication token...");
      const tokenResult = await chrome.identity.getAuthToken({ 
        interactive: true
      });

      let accessToken;

      // Handle both new object format and old string format
      if (typeof tokenResult === 'object' && tokenResult !== null) {
        if (tokenResult.token) {
          accessToken = tokenResult.token;

          // Note: drive.file scope is sufficient for Google Sheets access
          // No need to check for specific spreadsheets scope
        } else {
          throw new Error('Authentication failed - no token received');
        }
      } else if (typeof tokenResult === 'string' && tokenResult) {
        accessToken = tokenResult;
      } else {
        throw new Error('Authentication failed - invalid response');
      }

      this.accessToken = accessToken;
      console.log("Access token received successfully");

      // Create or find spreadsheet
      const spreadsheetId = await this.setupSpreadsheet();
      this.spreadsheetId = spreadsheetId;

      // Save to storage
      await chrome.storage.local.set({
        googleAccessToken: accessToken,
        googleSpreadsheetId: spreadsheetId,
      });

      await this.loadContent();
      console.log("Authentication successful!");
    } catch (error) {
      console.error("Authentication failed:", error);
      
      // Show user-friendly error message
      const errorMessage = error.message || "Unknown error occurred";
      if (errorMessage.includes("cancelled") || errorMessage.includes("rejected")) {
        console.log("Authentication cancelled by user");
      } else {
        alert(`Authentication failed: ${errorMessage}\n\nPlease try again or check your internet connection.`);
      }
      
      // Ensure auth screen is shown
      this.showAuthRequired();
    }
  }

  async setupSpreadsheet() {
    try {
      console.log("Looking for existing Quotebook spreadsheet...");

      // Search for existing Quotebook spreadsheets with more specific query
      const searchResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=name='Quotebook Collection' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false&fields=files(id,name,createdTime)`,
        {
          headers: { Authorization: `Bearer ${this.accessToken}` },
        },
      );

      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        const existingSheets = searchData.files || [];

        if (existingSheets.length > 0) {
          // Sort by creation date (newest first)
          existingSheets.sort(
            (a, b) => new Date(b.createdTime) - new Date(a.createdTime),
          );

          console.log(
            `Found existing spreadsheet: "${existingSheets[0].name}" (${existingSheets[0].id})`,
          );
          
          // Verify the spreadsheet has the correct headers
          try {
            const sheetResponse = await fetch(
              `https://sheets.googleapis.com/v4/spreadsheets/${existingSheets[0].id}/values/A1:F1`,
              {
                headers: { Authorization: `Bearer ${this.accessToken}` },
              }
            );
            
            if (sheetResponse.ok) {
              return existingSheets[0].id;
            }
          } catch (error) {
            console.log("Error verifying spreadsheet, will create new one:", error);
          }
        }
      }

      // No existing spreadsheet found, create a new one
      console.log("Creating new Quotebook spreadsheet...");

      const createResponse = await fetch(
        "https://sheets.googleapis.com/v4/spreadsheets",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            properties: {
              title: "Quotebook Collection",
            },
            sheets: [
              {
                properties: {
                  title: "Saved Quotes",
                },
              },
            ],
          }),
        },
      );

      const spreadsheet = await createResponse.json();
      const spreadsheetId = spreadsheet.spreadsheetId;

      // Add headers
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A1:F1?valueInputOption=RAW`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            values: [["Title", "Content", "URL", "Tags", "Timestamp", "Image"]],
          }),
        },
      );

      console.log("New Quotebook spreadsheet created!");
      return spreadsheetId;
    } catch (error) {
      console.error("Failed to setup spreadsheet:", error);
      throw error;
    }
  }

  async loadContent() {
    try {
      this.showLoading(true);

      // First verify the spreadsheet exists
      const verifyResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}`,
        {
          headers: { Authorization: `Bearer ${this.accessToken}` },
        },
      );

      if (!verifyResponse.ok) {
        if (verifyResponse.status === 404) {
          console.log(
            "Spreadsheet was deleted, clearing storage and requiring re-authentication",
          );
          await chrome.storage.local.remove([
            "googleSpreadsheetId",
            "googleAccessToken",
          ]);
          this.showAuthRequired();
          return;
        }
        throw new Error(
          `Failed to verify spreadsheet: ${verifyResponse.status}`,
        );
      }

      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}/values/A2:F1000`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        },
      );

      if (!response.ok) {
        if (response.status === 404) {
          console.log(
            "Spreadsheet was deleted, clearing storage and requiring re-authentication",
          );
          await chrome.storage.local.remove([
            "googleSpreadsheetId",
            "googleAccessToken",
          ]);
          this.showAuthRequired();
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const rows = data.values || [];

      this.contentData = rows.map((row, index) => ({
        id: index, // 0-based index in the data array
        originalRowIndex: index, // Original position in spreadsheet (before sorting)
        title: row[0] || "Untitled",
        content: row[1] || "",
        url: row[2] || "",
        tags: row[3]
          ? row[3]
              .split(",")
              .map((tag) => tag.trim())
              .filter((tag) => tag)
          : [],
        date: row[4] || new Date().toISOString().split("T")[0],
        image: row[5] || "",
      }));

      // Sort by date in reverse chronological order (newest first)
      this.contentData.sort((a, b) => new Date(b.date) - new Date(a.date));
      this.filteredData = [...this.contentData];
      this.currentPage = 1;
      this.renderStats();
      this.renderTagFilter();
      this.renderContent();
      this.showLoading(false);
    } catch (error) {
      console.error("Failed to load content:", error);
      this.showLoading(false);
      if (error.message.includes("401")) {
        this.showAuthRequired();
      }
    }
  }

  applyDynamicImageSizing() {
    // Images now use their natural aspect ratios without height calculations
    // The CSS handles the sizing with height: auto
  }

  attachEventListeners() {
    // Card click listeners (entire card navigates to URL)
    document.querySelectorAll(".content-card").forEach((card) => {
      card.addEventListener("click", (e) => {
        // Don't navigate if user clicked on delete button or tag
        if (e.target.closest(".delete-btn") || e.target.closest(".tag-pill")) {
          return;
        }

        const url = card.getAttribute("data-url");
        if (url) {
          window.open(url, "_blank");
        }
      });
    });

    // Delete button event listeners
    document.querySelectorAll(".delete-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const itemId = btn.getAttribute("data-item-id");
        this.deleteItem(parseInt(itemId));
      });
    });

    // Tag pill event listeners
    document.querySelectorAll(".tag-pill").forEach((pill) => {
      pill.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation(); // Prevent card click
        const tag = pill.getAttribute("data-tag");
        document.getElementById("tagFilter").value = tag;
        this.applyFilters();
      });
    });
  }

  async deleteItem(itemId) {
    // Show custom modal instead of ugly browser confirm
    const confirmed = await this.showDeleteConfirmation();
    if (!confirmed) {
      return;
    }

    try {
      console.log("Deleting item with ID:", itemId);

      // Find the item in our data array
      const item = this.contentData.find((item) => item.id === itemId);
      if (!item) {
        console.error("Item not found:", itemId);
        alert("Item not found. Please refresh and try again.");
        return;
      }

      // Calculate the actual spreadsheet row number using originalRowIndex
      // Row 1 has headers, so data starts at row 2
      // originalRowIndex 0 = row 2, originalRowIndex 1 = row 3, etc.
      const rowNumber = item.originalRowIndex + 2;
      console.log(
        "Deleting spreadsheet row:",
        rowNumber,
        "for original row index:",
        item.originalRowIndex,
      );

      // First, get the correct sheet ID from the spreadsheet metadata
      const metadataResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}?fields=sheets.properties`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        },
      );

      if (!metadataResponse.ok) {
        throw new Error("Failed to get spreadsheet metadata");
      }

      const metadata = await metadataResponse.json();
      const firstSheet = metadata.sheets?.[0];
      if (!firstSheet) {
        throw new Error("No sheets found in spreadsheet");
      }

      const sheetId = firstSheet.properties.sheetId;
      console.log("Using sheet ID:", sheetId, "for deletion");

      // Delete row from spreadsheet using batchUpdate with correct sheet ID
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}:batchUpdate`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            requests: [
              {
                deleteDimension: {
                  range: {
                    sheetId: sheetId,
                    dimension: "ROWS",
                    startIndex: rowNumber - 1, // Convert to 0-based index for API
                    endIndex: rowNumber, // endIndex is exclusive
                  },
                },
              },
            ],
          }),
        },
      );

      if (response.ok) {
        console.log("Item deleted successfully from spreadsheet");

        // Store current pagination state to preserve user's position
        const currentPageBeforeDeletion = this.currentPage;
        const currentItemsPerPage = this.itemsPerPage;
        const currentScrollPosition = window.scrollY;

        // Store current filter state
        const currentSearchQuery = document.getElementById("searchInput").value;
        const currentTagFilter = document.getElementById("tagFilter").value;
        const currentDateFilter = document.getElementById("dateFilter").value;

        console.log("Preserving pagination state:", {
          page: currentPageBeforeDeletion,
          itemsPerPage: currentItemsPerPage,
          scroll: currentScrollPosition,
          filters: {
            search: currentSearchQuery,
            tag: currentTagFilter,
            date: currentDateFilter,
          },
        });

        // Reload fresh data from spreadsheet to get correct row numbers
        await this.loadContent();

        // Restore filter state after reload
        document.getElementById("searchInput").value = currentSearchQuery;
        document.getElementById("tagFilter").value = currentTagFilter;
        document.getElementById("dateFilter").value = currentDateFilter;

        // Reapply filters with preserved state
        this.applyFilters();

        // Restore pagination state - but adjust if we deleted an item that affects current page
        const itemsBeforePage =
          (currentPageBeforeDeletion - 1) * currentItemsPerPage;
        const totalItemsAfterDeletion = this.filteredData.length;

        if (
          itemsBeforePage >= totalItemsAfterDeletion &&
          currentPageBeforeDeletion > 1
        ) {
          // If current page would be empty after deletion, go back one page
          this.currentPage = Math.max(1, currentPageBeforeDeletion - 1);
        } else {
          // Keep the same page
          this.currentPage = currentPageBeforeDeletion;
        }

        // Re-render with preserved pagination
        this.renderContent();

        // Restore scroll position after a brief delay to allow rendering
        setTimeout(() => {
          window.scrollTo(0, currentScrollPosition);
        }, 100);

        console.log("Deletion completed with preserved pagination state:", {
          newPage: this.currentPage,
          totalItems: totalItemsAfterDeletion,
        });
      } else {
        const errorData = await response.json();
        console.error("Delete failed:", errorData);
        this.showErrorMessage(
          "Failed to delete item. Error: " +
            (errorData.error?.message || "Unknown error")
        );
      }
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
    // Create a simple toast-style error message
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
    
    // Add slide-in animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from {
          opacity: 0;
          transform: translateX(100%);
        }
        to {
          opacity: 1;
          transform: translateX(0);
        }
      }
    `;
    document.head.appendChild(style);
    
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
    // Stats functionality removed - no longer displaying datapoints
    return;
    const totalItems = this.contentData.length;
    const totalTags = [
      ...new Set(this.contentData.flatMap((item) => item.tags)),
    ].length;
    const thisMonth = this.contentData.filter((item) => {
      const itemDate = new Date(item.date);
      const now = new Date();
      return (
        itemDate.getMonth() === now.getMonth() &&
        itemDate.getFullYear() === now.getFullYear()
      );
    }).length;
    const uniqueWebsites = [
      ...new Set(
        this.contentData.map((item) => {
          try {
            return new URL(item.url).hostname;
          } catch {
            return "Unknown";
          }
        }),
      ),
    ].length;

    statsContainer.innerHTML = `
      <div class="stat-card">
        <div class="stat-number">${totalItems}</div>
        <div class="stat-label">Quotes</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${totalTags}</div>
        <div class="stat-label">Tags</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${thisMonth}</div>
        <div class="stat-label">This Month</div>
      </div>
    `;
  }

  renderTagFilter() {
    const tagFilter = document.getElementById("tagFilter");
    const allTags = [
      ...new Set(this.contentData.flatMap((item) => item.tags)),
    ].sort();

    tagFilter.innerHTML = '<option value="">All Tags</option>';
    allTags.forEach((tag) => {
      const option = document.createElement("option");
      option.value = tag;
      option.textContent = tag;
      tagFilter.appendChild(option);
    });
  }

  clearAllFilters() {
    // Check if there are any active filters
    const searchInput = document.getElementById("searchInput");
    const tagFilter = document.getElementById("tagFilter");
    const dateFilter = document.getElementById("dateFilter");
    
    const hasSearchTerm = searchInput && searchInput.value.trim() !== "";
    const hasTagFilter = tagFilter && tagFilter.value !== "";
    const hasDateFilter = dateFilter && dateFilter.value !== "";
    
    // Only clear if there are active filters
    if (hasSearchTerm || hasTagFilter || hasDateFilter) {
      if (searchInput) searchInput.value = "";
      if (tagFilter) tagFilter.value = "";
      if (dateFilter) dateFilter.value = "";
      
      // Reset button appearances to icon-only state
      const tagFilterContainer = document.querySelector('[data-tooltip="Filter by tag"]');
      const dateFilterContainer = document.querySelector('[data-tooltip="Filter by time"]');
      
      if (tagFilterContainer && tagFilter) {
        this.updateFilterButtonAppearance(tagFilterContainer, tagFilter);
      }
      if (dateFilterContainer && dateFilter) {
        this.updateFilterButtonAppearance(dateFilterContainer, dateFilter);
      }
      
      // Reset filtered data to show all content
      this.filteredData = [...this.contentData];
      this.currentPage = 1;
      this.renderContent();
      
      console.log('All filters cleared');
    } else {
      console.log('No active filters to clear');
    }
  }

  applyFilters() {
    const searchTerm = document
      .getElementById("searchInput")
      .value.toLowerCase();
    const selectedTag = document.getElementById("tagFilter").value;
    const dateRange = document.getElementById("dateFilter").value;

    this.filteredData = this.contentData.filter((item) => {
      // Search filter
      const matchesSearch =
        !searchTerm ||
        item.title.toLowerCase().includes(searchTerm) ||
        item.content.toLowerCase().includes(searchTerm) ||
        item.tags.some((tag) => tag.toLowerCase().includes(searchTerm));

      // Tag filter
      const matchesTag = !selectedTag || item.tags.includes(selectedTag);

      // Date filter
      let matchesDate = true;
      if (dateRange) {
        const itemDate = new Date(item.date);
        const now = new Date();
        switch (dateRange) {
          case "today":
            matchesDate = itemDate.toDateString() === now.toDateString();
            break;
          case "week":
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            matchesDate = itemDate >= weekAgo;
            break;
          case "month":
            matchesDate =
              itemDate.getMonth() === now.getMonth() &&
              itemDate.getFullYear() === now.getFullYear();
            break;
        }
      }

      return matchesSearch && matchesTag && matchesDate;
    });

    // Reset pagination when filters change
    this.currentPage = 1;
    this.renderContent();
  }

  updateSearchPlaceholder() {
    const searchInput = document.getElementById("searchInput");
    const totalQuotes = this.contentData.length;
    searchInput.placeholder = `Search your ${totalQuotes} quotes...`;
  }

  renderContent() {
    const contentContainer = document.getElementById("content");
    const noResults = document.getElementById("no-results");

    // Update search placeholder with current quote count
    this.updateSearchPlaceholder();

    if (this.filteredData.length === 0) {
      contentContainer.style.display = "none";
      noResults.style.display = "block";
      this.hideLoadMoreButton();
      return;
    }

    contentContainer.style.display = "block";
    noResults.style.display = "none";

    // Calculate pagination
    const startIndex = 0;
    const endIndex = this.currentPage * this.itemsPerPage;
    this.displayedItems = this.filteredData.slice(startIndex, endIndex);

    // Create masonry layout
    this.renderMasonryLayout();

    // Show/hide load more button
    this.updateLoadMoreButton();

    // Add event listeners for delete buttons and tag pills
    this.attachEventListeners();
  }

  renderMasonryLayout() {
    const contentContainer = document.getElementById("content");
    
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
      columns.push(column);
      columnHeights.push(0);
    }
    this.displayedItems.forEach((item, index) => {
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
        
        ${item.image ? `<img src="${item.image}" alt="" class="content-image" data-image-url="${item.image}">` : ""}
        
        <div class="content-text">
          ${this.escapeHtml(item.content).replace(/\n/g, '<br>')}
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
      
      // Update column height (approximate - will be refined after DOM insertion)
      columnHeights[shortestColumnIndex] += 200 + (item.content.length * 0.3); // Rough height estimation
    });

    // Clear container and add columns
    contentContainer.innerHTML = '';
    columns.forEach(column => {
      contentContainer.appendChild(column);
    });

    // Apply dynamic image sizing after DOM insertion
    this.applyDynamicImageSizing();

    // Set container height based on tallest column
    setTimeout(() => {
      const actualColumnHeights = columns.map(col => col.offsetHeight);
      const maxHeight = Math.max(...actualColumnHeights);
      contentContainer.style.height = maxHeight + 'px';
    }, 0);
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
      return new URL(url).hostname.replace("www.", "");
    } catch {
      return "Unknown";
    }
  }

  formatDate(dateStr) {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  initTooltips() {
    const elements = document.querySelectorAll('[data-tooltip]');
    let tooltip = null;
    let hideTimeout = null;

    elements.forEach(element => {
      element.addEventListener('mouseenter', (e) => {
        // Clear any pending hide timeout
        if (hideTimeout) {
          clearTimeout(hideTimeout);
          hideTimeout = null;
        }

        // Remove existing tooltip
        if (tooltip) {
          tooltip.remove();
        }

        // Create new tooltip
        tooltip = document.createElement('div');
        tooltip.className = 'tooltip';
        const tooltipText = e.currentTarget.getAttribute('data-tooltip');
        tooltip.textContent = tooltipText;
        document.body.appendChild(tooltip);

        // Position tooltip with edge detection
        const rect = e.currentTarget.getBoundingClientRect();
        let left = rect.left + rect.width / 2 - tooltip.offsetWidth / 2;

        // Prevent tooltip from going off the right edge (with 8px padding)
        const maxLeft = window.innerWidth - tooltip.offsetWidth - 8;
        if (left > maxLeft) {
          left = maxLeft;
        }

        // Prevent tooltip from going off the left edge (with 8px padding)
        if (left < 8) {
          left = 8;
        }

        tooltip.style.left = left + 'px';
        tooltip.style.top = (rect.bottom + 8) + 'px';

        // Show tooltip
        setTimeout(() => {
          if (tooltip) {
            tooltip.classList.add('show');
          }
        }, 10);
      });

      element.addEventListener('mouseleave', () => {
        if (tooltip) {
          tooltip.classList.remove('show');
          hideTimeout = setTimeout(() => {
            if (tooltip) {
              tooltip.remove();
              tooltip = null;
            }
            hideTimeout = null;
          }, 200);
        }
      });
    });
  }

  initDropdownButtons() {
    // Handle tag filter dropdown
    const tagFilterContainer = document.querySelector('[data-tooltip="Filter by tag"]');
    const tagFilter = document.getElementById('tagFilter');
    
    if (tagFilterContainer && tagFilter) {
      tagFilterContainer.addEventListener('click', (e) => {
        e.preventDefault();
        tagFilter.focus();
        tagFilter.click();
      });
      
      // Update button appearance when selection changes
      tagFilter.addEventListener('change', () => {
        this.updateFilterButtonAppearance(tagFilterContainer, tagFilter);
      });
    }

    // Handle date filter dropdown
    const dateFilterContainer = document.querySelector('[data-tooltip="Filter by time"]');
    const dateFilter = document.getElementById('dateFilter');
    
    if (dateFilterContainer && dateFilter) {
      dateFilterContainer.addEventListener('click', (e) => {
        e.preventDefault();
        dateFilter.focus();
        dateFilter.click();
      });
      
      // Update button appearance when selection changes
      dateFilter.addEventListener('change', () => {
        this.updateFilterButtonAppearance(dateFilterContainer, dateFilter);
      });
    }
  }

  updateFilterButtonAppearance(container, selectElement) {
    const selectedValue = selectElement.value;
    const selectedText = selectElement.options[selectElement.selectedIndex].text;
    
    if (selectedValue && selectedValue !== '') {
      // Show selected label with proper styling
      container.style.width = 'auto';
      container.style.minWidth = 'auto';
      selectElement.style.width = 'auto';
      selectElement.style.minWidth = 'auto';
      selectElement.style.padding = '8px 40px 8px 32px';
      selectElement.style.color = 'hsl(20, 14.3%, 4.1%)';
      selectElement.style.background = 'hsl(0, 0%, 100%)';
      selectElement.style.border = '1px solid hsl(20, 5.9%, 90%)';
      selectElement.style.borderRadius = '8px';
      selectElement.style.backgroundImage = `url('data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23374151\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6,9 12,15 18,9\'%3e%3c/polyline%3e%3c/svg%3e')`;
      selectElement.style.backgroundRepeat = 'no-repeat';
      selectElement.style.backgroundPosition = 'right 12px center';
      selectElement.style.backgroundSize = '16px';
      
      // Remove active state styling
      selectElement.style.outline = 'none';
      selectElement.style.boxShadow = 'none';
      
      // Move the SVG icon to the left side
      const svg = container.querySelector('svg');
      if (svg) {
        svg.style.left = '8px';
        svg.style.transform = 'translateY(-50%)';
      }
      
      // Force resize to content by temporarily setting width to auto
      setTimeout(() => {
        const tempWidth = selectElement.scrollWidth;
        selectElement.style.width = tempWidth + 'px';
      }, 0);
    } else {
      // Reset to icon-only state
      container.style.width = '32px';
      container.style.minWidth = '32px';
      selectElement.style.width = '32px';
      selectElement.style.minWidth = '32px';
      selectElement.style.padding = '0';
      selectElement.style.color = 'transparent';
      selectElement.style.background = 'hsl(0, 0%, 100%)';
      selectElement.style.border = '1px solid hsl(20, 5.9%, 90%)';
      selectElement.style.borderRadius = '8px';
      selectElement.style.backgroundImage = 'none';
      selectElement.style.backgroundRepeat = 'no-repeat';
      selectElement.style.backgroundPosition = 'unset';
      selectElement.style.backgroundSize = 'unset';
      
      // Center the SVG icon
      const svg = container.querySelector('svg');
      if (svg) {
        svg.style.left = '50%';
        svg.style.transform = 'translate(-50%, -50%)';
      }
    }
  }

  showLoading(show) {
    const loading = document.getElementById("loading");
    const content = document.getElementById("content");
    const authRequired = document.getElementById("auth-required");

    if (show) {
      loading.style.display = "block";
      content.style.display = "none";
      authRequired.style.display = "none";
    } else {
      loading.style.display = "none";
    }
  }

  showAuthRequired() {
    const loading = document.getElementById("loading");
    const content = document.getElementById("content");
    const authRequired = document.getElementById("auth-required");
    const spreadsheetLink = document.getElementById("spreadsheet-link");

    loading.style.display = "none";
    content.style.display = "none";
    authRequired.style.display = "block";
    if (spreadsheetLink) spreadsheetLink.style.display = "none";
    
    // Ensure the auth button is functional
    const authButton = document.getElementById("auth-button");
    if (authButton) {
      // Remove any existing listeners and add fresh one with debouncing
      authButton.replaceWith(authButton.cloneNode(true));
      const newAuthButton = document.getElementById("auth-button");
      let isAuthenticating = false;
      
      newAuthButton.addEventListener("click", async () => {
        if (isAuthenticating) {
          console.log("Authentication already in progress, ignoring click");
          return;
        }
        
        console.log("Auth button clicked");
        isAuthenticating = true;
        newAuthButton.disabled = true;
        newAuthButton.textContent = "Authenticating...";
        
        try {
          await this.authenticateWithGoogle();
        } finally {
          isAuthenticating = false;
          newAuthButton.disabled = false;
          newAuthButton.textContent = "Authenticate with Google";
        }
      });
    }
  }

  updateSpreadsheetLink() {
    const spreadsheetLink = document.getElementById("spreadsheet-link");
    if (spreadsheetLink && this.spreadsheetId) {
      spreadsheetLink.href = `https://docs.google.com/spreadsheets/d/${this.spreadsheetId}/edit`;
      spreadsheetLink.style.display = "flex";
    } else if (spreadsheetLink) {
      spreadsheetLink.style.display = "none";
    }
  }

  loadMoreItems() {
    this.currentPage++;
    this.renderContent();
  }

  updateLoadMoreButton() {
    const loadMoreContainer = document.getElementById("load-more-container");
    const totalItems = this.filteredData.length;
    const displayedItems = this.currentPage * this.itemsPerPage;

    if (loadMoreContainer) {
      if (displayedItems < totalItems) {
        loadMoreContainer.style.display = "block";
        const remaining = totalItems - displayedItems;
        const loadMoreBtn = document.getElementById("load-more-btn");
        loadMoreBtn.textContent = `Load More (${remaining} remaining)`;
      } else {
        loadMoreContainer.style.display = "none";
      }
    }
  }

  hideLoadMoreButton() {
    const loadMoreContainer = document.getElementById("load-more-container");
    if (loadMoreContainer) {
      loadMoreContainer.style.display = "none";
    }
  }
}

// Global functions
window.selectTag = function (tag) {
  const tagFilter = document.getElementById("tagFilter");
  tagFilter.value = tag;
  fullPageCollector.applyFilters();
};

window.authenticateWithGoogle = function () {
  fullPageCollector.authenticateWithGoogle();
};

// Initialize when page loads
let fullPageCollector;
document.addEventListener("DOMContentLoaded", () => {
  fullPageCollector = new FullPageCollector();
});
