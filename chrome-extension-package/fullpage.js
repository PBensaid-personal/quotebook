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
    this.selectedTags = new Set(); // Track multiple selected tags
    this.currentSheetName = null; // Current selected sheet name
    this.allSheetNames = []; // All available sheet names
    this.init();
    this.setupMessageListener();
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'refreshContent') {
        this.loadContent();
      }
    });
  }

  async init() {

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
      "currentSheetName",
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


    if (result.googleAccessToken && result.googleSpreadsheetId) {
      // Try to refresh the token silently (extends session without user interaction)
      try {
        const freshToken = await chrome.identity.getAuthToken({ interactive: false });
        if (freshToken) {
          const newToken = typeof freshToken === 'object' ? freshToken.token : freshToken;
          // Update both instance and storage with fresh token
          this.accessToken = newToken;
          await chrome.storage.local.set({ googleAccessToken: newToken });
        } else {
          // No fresh token available, use cached
          this.accessToken = result.googleAccessToken;
        }
      } catch (e) {
        // Silent refresh failed, proceed with cached token
        this.accessToken = result.googleAccessToken;
      }

      this.spreadsheetId = result.googleSpreadsheetId;
      this.currentSheetName = result.currentSheetName || null; // Restore selected sheet

      // Verify spreadsheet access with exponential retry for network resilience
      let verified = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const sheetsResponse = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}?fields=sheets.properties`,
            {
              headers: {
                Authorization: `Bearer ${this.accessToken}`,
              },
            },
          );

          if (sheetsResponse.ok) {
            verified = true;
            const metadata = await sheetsResponse.json();
            this.allSheetNames = metadata.sheets.map(s => s.properties.title);
            
            // If no sheet selected or selected sheet doesn't exist, use first sheet
            if (!this.currentSheetName || !this.allSheetNames.includes(this.currentSheetName)) {
              this.currentSheetName = this.allSheetNames[0] || 'My quotes';
              await chrome.storage.local.set({ currentSheetName: this.currentSheetName });
            }
            
            this.renderSheetSelector();
            await this.loadContent();
            break;
          } else if (sheetsResponse.status === 401 || sheetsResponse.status === 403) {
            // Explicit auth failure - don't retry
            await chrome.storage.local.remove([
              "googleSpreadsheetId",
              "googleAccessToken",
            ]);
            this.showAuthRequired();
            return;
          } else if (sheetsResponse.status === 404) {
            // Spreadsheet deleted - don't retry
            await chrome.storage.local.remove([
              "googleSpreadsheetId",
              "googleAccessToken",
            ]);
            this.showAuthRequired();
            return;
          }
          // Other errors (5xx, network issues) - will retry
        } catch (error) {
          // Network error - will retry
          console.log(`Verification attempt ${attempt + 1} failed:`, error.message);
        }

        // Wait before retry (exponential backoff: 500ms, 1000ms, 1500ms)
        if (attempt < 2) {
          await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
        }
      }

      if (!verified) {
        // All retries failed - graceful degradation
        // Don't clear storage, just show auth with option to retry
        console.warn('Could not verify spreadsheet access after retries');
        this.showAuthRequired();
      }
    } else {
      this.showAuthRequired();
    }

    this.setupEventListeners();
  }

  setupEventListeners() {
    const searchInput = document.getElementById("searchInput");
    const tagFilter = document.getElementById("tagFilter");
    const authButton = document.getElementById("auth-button");
    const logo = document.getElementById("logo");
    const sheetSelectorButton = document.getElementById("sheet-selector-button");
    const sheetSelectorDropdown = document.getElementById("sheet-selector-dropdown");

    // Sheet selector dropdown toggle
    if (sheetSelectorButton) {
      sheetSelectorButton.addEventListener("click", (e) => {
        e.stopPropagation();
        
        // Close filter dropdowns if open
        const tagFilterDropdown = document.getElementById('tag-filter-dropdown');
        const tagFilterButton = document.getElementById('tag-filter-button');
        if (tagFilterDropdown && tagFilterDropdown.classList.contains("show")) {
          tagFilterDropdown.classList.remove("show");
          if (tagFilterButton) tagFilterButton.classList.remove("active");
        }
        
        const isOpen = sheetSelectorDropdown.classList.contains("show");
        if (isOpen) {
          sheetSelectorDropdown.classList.remove("show");
          sheetSelectorButton.classList.remove("active");
        } else {
          this.renderSheetSelector();
          sheetSelectorDropdown.classList.add("show");
          sheetSelectorButton.classList.add("active");
        }
      });
    }

    // Close dropdown when clicking outside (handled in initDropdownButtons)

    if (searchInput) {
      searchInput.addEventListener("input", () => this.applyFilters());
    }
    if (tagFilter) {
      tagFilter.addEventListener("change", () => {
        // Clear tag navigation buttons when using dropdown
        this.selectedTags.clear();
        this.updateTagNavButtonStates();
        this.updateTagHeader();
        this.applyFilters();
      });
    }
    if (authButton) {
      authButton.addEventListener("click", () => this.authenticateWithGoogle());
    }
    if (logo) {
      logo.addEventListener("click", (e) => {
        e.preventDefault();
        // Clear all filters and return to full view
        document.getElementById("searchInput").value = "";
        document.getElementById("tagFilter").value = "";
        this.selectedTags.clear();
        this.updateTagNavButtonStates();
        this.updateTagHeader();

        // Reset filter button appearance
        const tagFilterContainer = document.querySelector('[data-tooltip="Filter by tag"]');
        if (tagFilterContainer) {
          this.updateFilterButtonAppearance(tagFilterContainer, document.getElementById("tagFilter"));
        }

        // Reset to first page and reload content
        this.currentPage = 1;
        this.applyFilters();

        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }

    const loadMoreBtn = document.getElementById("load-more-btn");
    if (loadMoreBtn) {
      loadMoreBtn.addEventListener("click", () => this.loadMoreItems());
    }

  }

  async authenticateWithGoogle() {
    try {

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

      // Create or find spreadsheet
      const spreadsheetId = await this.setupSpreadsheet();
      this.spreadsheetId = spreadsheetId;

      // Save to storage
      await chrome.storage.local.set({
        googleAccessToken: accessToken,
        googleSpreadsheetId: spreadsheetId,
      });

      // Load sheet names and set current sheet
      await this.getAllSheetNames();
      if (!this.currentSheetName && this.allSheetNames.length > 0) {
        this.currentSheetName = this.allSheetNames[0];
        await chrome.storage.local.set({ currentSheetName: this.currentSheetName });
      }
      
      this.renderSheetSelector();
      await this.loadContent();
    } catch (error) {
      console.error("Authentication failed:", error);
      
      // Show user-friendly error message
      const errorMessage = error.message || "Unknown error occurred";
      if (errorMessage.includes("cancelled") || errorMessage.includes("rejected")) {
        // Authentication cancelled by user
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
                  title: "My quotes",
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
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A1:G1?valueInputOption=RAW`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            values: [["Title", "Content", "URL", "Tags", "Timestamp", "Image", "Price"]],
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

  async getAllSheetNames() {
    try {
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}?fields=sheets.properties`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        },
      );

      if (response.ok) {
        const metadata = await response.json();
        this.allSheetNames = metadata.sheets.map(s => s.properties.title);
        return this.allSheetNames;
      } else {
        throw new Error(`Failed to fetch sheets: ${response.status}`);
      }
    } catch (error) {
      console.error("Failed to get sheet names:", error);
      return [];
    }
  }

  renderSheetSelector() {
    const dropdown = document.getElementById("sheet-selector-dropdown");
    const buttonName = document.getElementById("sheet-selector-name");
    
    if (!dropdown || !buttonName) return;

    // Update button text
    buttonName.textContent = this.currentSheetName || 'My quotes';

    // Clear dropdown
    dropdown.innerHTML = '';

    // Add each sheet as an option
    this.allSheetNames.forEach((sheetName) => {
      const container = document.createElement("div");
      container.className = `dropdown-item ${sheetName === this.currentSheetName ? 'active' : ''} dropdown-item-flex`;

      const item = document.createElement("div");
      item.className = "dropdown-item-content";
      if (sheetName === this.currentSheetName) {
        item.innerHTML = `<span style="margin-right: 8px;">✓</span>${sheetName}`;
      } else {
        item.textContent = sheetName;
      }

      container.addEventListener("click", async (e) => {
        // Don't trigger if clicking the delete button
        if (!e.target.closest('[data-delete-btn]')) {
          e.stopPropagation();
          if (sheetName !== this.currentSheetName) {
            await this.switchSheet(sheetName);
          }
          dropdown.classList.remove("show");
          const button = document.getElementById("sheet-selector-button");
          if (button) button.classList.remove("active");
        }
      });

      container.appendChild(item);

      // Add delete button for each sheet (except if it's the only sheet)
      if (this.allSheetNames.length > 1) {
        const deleteBtn = document.createElement("div");
        deleteBtn.className = "dropdown-delete-btn";
        deleteBtn.setAttribute("data-delete-btn", "true");
        deleteBtn.title = `Delete "${sheetName}"`;
        deleteBtn.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
            <path d="M3 6h18"/>
            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        `;
        
        deleteBtn.addEventListener("click", async (e) => {
          e.stopPropagation();
          const confirmed = await this.showDeleteSheetConfirmation(sheetName);
          if (confirmed) {
            await this.deleteSheet(sheetName);
          }
        });

        container.appendChild(deleteBtn);
      }
      
      dropdown.appendChild(container);
    });

    // Add "Create new tab" option
    const createNew = document.createElement("div");
    createNew.className = "dropdown-item create-new dropdown-item-flex-gap";
    createNew.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;">
        <path d="M5 12h14"/>
        <path d="M12 5v14"/>
      </svg>
      <span>Create new collection</span>
    `;
    createNew.addEventListener("click", async (e) => {
      e.stopPropagation();
      await this.showCreateSheetDialog();
      dropdown.classList.remove("show");
      const button = document.getElementById("sheet-selector-button");
      if (button) button.classList.remove("active");
    });
    dropdown.appendChild(createNew);

    // Add "Open your Google Sheet" option
    if (this.spreadsheetId) {
      const openSheet = document.createElement("div");
      openSheet.className = "dropdown-item dropdown-item-flex-gap";
      openSheet.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;">
          <path d="M7 7h10v10"/>
          <path d="M7 17 17 7"/>
        </svg>
        <span>Open your Google Sheet</span>
      `;
      openSheet.addEventListener("click", (e) => {
        e.stopPropagation();
        if (this.spreadsheetId) {
          window.open(
            `https://docs.google.com/spreadsheets/d/${this.spreadsheetId}/edit`,
            "_blank",
          );
        }
        dropdown.classList.remove("show");
        const button = document.getElementById("sheet-selector-button");
        if (button) button.classList.remove("active");
      });
      dropdown.appendChild(openSheet);
    }
  }

  async showCreateSheetDialog() {
    // Get next available sheet number
    let sheetNumber = 1;
    while (this.allSheetNames.includes(`Sheet ${sheetNumber}`)) {
      sheetNumber++;
    }
    const defaultName = `Sheet ${sheetNumber}`;

    // Show custom modal with input
    const sheetName = await this.showCreateSheetModal(defaultName);
    
    if (!sheetName || sheetName.trim() === '') {
      return; // User cancelled or entered empty name
    }

    const trimmedName = sheetName.trim();
    
    // Check if name already exists
    if (this.allSheetNames.includes(trimmedName)) {
      this.showErrorMessage(`A sheet named "${trimmedName}" already exists. Please choose a different name.`);
      // Show the modal again with the same default
      return await this.showCreateSheetDialog();
    }

    await this.createNewSheet(trimmedName);
  }

  showDeleteSheetConfirmation(sheetName) {
    return new Promise((resolve) => {
      const modal = document.getElementById('delete-sheet-modal');
      const message = document.getElementById('delete-sheet-message');
      const confirmBtn = document.getElementById('confirm-delete-sheet');
      const cancelBtn = document.getElementById('cancel-delete-sheet');

      // Update message with sheet name
      message.textContent = `Are you sure you want to permanently delete the sheet "${sheetName}"? This action cannot be undone.`;

      // Show modal
      modal.classList.remove('hidden');

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
        modal.classList.add('hidden');
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

  showCreateSheetModal(defaultName) {
    return new Promise((resolve) => {
      const modal = document.getElementById('create-sheet-modal');
      const input = document.getElementById('create-sheet-input');
      const confirmBtn = document.getElementById('confirm-create-sheet');
      const cancelBtn = document.getElementById('cancel-create-sheet');

      // Set default value
      input.value = defaultName;
      input.focus();
      input.select();

      // Show modal
      modal.classList.remove('hidden');

      // Handle confirm
      const handleConfirm = () => {
        const value = input.value.trim();
        cleanup();
        resolve(value);
      };

      // Handle cancel
      const handleCancel = () => {
        cleanup();
        resolve(null);
      };

      // Handle Enter key
      const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleConfirm();
        } else if (e.key === 'Escape') {
          handleCancel();
        }
      };

      // Handle clicking outside modal
      const handleOverlayClick = (e) => {
        if (e.target === modal) {
          handleCancel();
        }
      };

      // Cleanup function
      const cleanup = () => {
        modal.classList.add('hidden');
        input.value = '';
        confirmBtn.removeEventListener('click', handleConfirm);
        cancelBtn.removeEventListener('click', handleCancel);
        input.removeEventListener('keydown', handleKeyDown);
        modal.removeEventListener('click', handleOverlayClick);
        document.removeEventListener('keydown', handleKeyDown);
      };

      // Add event listeners
      confirmBtn.addEventListener('click', handleConfirm);
      cancelBtn.addEventListener('click', handleCancel);
      input.addEventListener('keydown', handleKeyDown);
      modal.addEventListener('click', handleOverlayClick);
    });
  }

  async createNewSheet(sheetName) {
    try {
      // First, get the sheet ID for the first sheet to copy headers
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
      const firstSheetId = metadata.sheets[0].properties.sheetId;

      // Create new sheet using batchUpdate
      const createResponse = await fetch(
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
                addSheet: {
                  properties: {
                    title: sheetName,
                  },
                },
              },
            ],
          }),
        },
      );

      if (!createResponse.ok) {
        const errorData = await createResponse.json();
        throw new Error(errorData.error?.message || "Failed to create sheet");
      }

      // Add headers to the new sheet
      const escapedSheetName = `'${sheetName.replace(/'/g, "''")}'`;
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}/values/${escapedSheetName}!A1:G1?valueInputOption=RAW`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            values: [["Title", "Content", "URL", "Tags", "Timestamp", "Image", "Price"]],
          }),
        },
      );

      // Refresh sheet list and switch to new sheet
      await this.getAllSheetNames();
      await this.switchSheet(sheetName);
      this.renderSheetSelector();
    } catch (error) {
      console.error("Failed to create sheet:", error);
      alert(`Failed to create sheet: ${error.message}`);
    }
  }

  async deleteSheet(sheetName) {
    try {
      // Don't allow deleting if it's the only sheet
      if (this.allSheetNames.length <= 1) {
        alert("Cannot delete the last remaining sheet.");
        return;
      }

      // Get sheet ID
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
      const sheetToDelete = metadata.sheets.find(s => s.properties.title === sheetName);
      
      if (!sheetToDelete) {
        throw new Error(`Sheet "${sheetName}" not found`);
      }

      const sheetId = sheetToDelete.properties.sheetId;

      // Delete sheet using batchUpdate
      const deleteResponse = await fetch(
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
                deleteSheet: {
                  sheetId: sheetId,
                },
              },
            ],
          }),
        },
      );

      if (!deleteResponse.ok) {
        const errorData = await deleteResponse.json();
        throw new Error(errorData.error?.message || "Failed to delete sheet");
      }

      // If deleted sheet was current, switch to first available sheet
      if (sheetName === this.currentSheetName) {
        await this.getAllSheetNames();
        if (this.allSheetNames.length > 0) {
          await this.switchSheet(this.allSheetNames[0]);
        }
      } else {
        await this.getAllSheetNames();
      }

      this.renderSheetSelector();
    } catch (error) {
      console.error("Failed to delete sheet:", error);
      alert(`Failed to delete sheet: ${error.message}`);
    }
  }

  async switchSheet(sheetName) {
    this.currentSheetName = sheetName;
    await chrome.storage.local.set({ currentSheetName: sheetName });
    this.renderSheetSelector();
    
    // Reset filters and reload content
    document.getElementById("searchInput").value = "";
    document.getElementById("tagFilter").value = "";
    this.selectedTags.clear();
    this.updateTagNavButtonStates();
    this.updateTagHeader();
    
    await this.loadContent();
  }

  async loadContent() {
    try {
      // Hide load more button immediately before showing loading
      this.hideLoadMoreButton();
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

      // Use current sheet name, escape single quotes in sheet name
      const sheetName = this.currentSheetName || 'My quotes';
      const escapedSheetName = `'${sheetName.replace(/'/g, "''")}'`;
      
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}/values/${escapedSheetName}!A2:G1000`,
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

      // Check if Price column header exists, add it if missing
      const headerResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}/values/${escapedSheetName}!A1:G1`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        },
      );

      if (headerResponse.ok) {
        const headerData = await headerResponse.json();
        const headers = headerData.values && headerData.values[0] ? headerData.values[0] : [];
        
        // If Price column is missing, add it
        if (headers.length < 7 || headers[6] !== "Price") {
          // Update headers to include Price column
          const updatedHeaders = ["Title", "Content", "URL", "Tags", "Timestamp", "Image", "Price"];
          await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}/values/${escapedSheetName}!A1:G1?valueInputOption=RAW`,
            {
              method: "PUT",
              headers: {
                Authorization: `Bearer ${this.accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                values: [updatedHeaders],
              }),
            },
          );
        }
      }

      this.contentData = rows.map((row, index) => {
        // Parse pipe-delimited image URLs into array (||| delimiter)
        const imageField = row[5] || "";
        const images = imageField
          ? imageField.split("|||").map((url) => url.trim()).filter((url) => url)
          : [];
        
        return {
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
          image: imageField, // Keep original for backward compatibility
          images: images, // Array of image URLs
          price: row[6] || "", // Price column - use exclusively, no extraction from content
        };
      });

      // Sort by date in reverse chronological order (newest first)
      this.contentData.sort((a, b) => new Date(b.date) - new Date(a.date));
      this.filteredData = [...this.contentData];
      this.currentPage = 1;
      this.renderStats();
      this.renderTagFilter();
      this.renderTagNavButtons();
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
    // Use event delegation to prevent duplicate listeners
    // Remove any existing listener first
    const contentContainer = document.getElementById("content");
    if (!contentContainer) return;
    
    // Remove old listener if it exists
    if (this._cardClickHandler) {
      contentContainer.removeEventListener("click", this._cardClickHandler);
    }
    
    // Create a single delegated event handler
    this._cardClickHandler = (e) => {
      const card = e.target.closest(".content-card");
      if (!card) return;
      
      // Don't navigate if user clicked on delete button, tag, or gallery navigation
      if (e.target.closest(".delete-btn") || 
          e.target.closest(".tag-pill") || 
          e.target.closest(".gallery-nav-btn")) {
        return;
      }

      const url = card.getAttribute("data-url");
      if (url) {
        window.open(url, "_blank");
      }
    };
    
    // Attach single delegated listener to container
    contentContainer.addEventListener("click", this._cardClickHandler);

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
        const tagFilter = document.getElementById("tagFilter");
        tagFilter.value = tag;

        // Update the filter button appearance to show the active filter
        const tagFilterContainer = document.querySelector('[data-tooltip="Filter by tag"]');
        if (tagFilterContainer) {
          this.updateFilterButtonAppearance(tagFilterContainer, tagFilter);
        }

        this.applyFilters();
      });
    });

    // Gallery navigation event listeners
    document.querySelectorAll(".gallery-nav-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation(); // Prevent card click
        
        // Don't proceed if button is disabled
        if (btn.disabled) return;
        
        const container = btn.closest(".content-image-container");
        if (!container) return;
        
        const imageUrlsAttr = container.getAttribute("data-image-urls");
        if (!imageUrlsAttr) return;
        
        // Parse image URLs from attribute
        const imageUrls = JSON.parse(imageUrlsAttr.replace(/&quot;/g, '"'));
        if (imageUrls.length <= 1) return;
        
        const currentIndex = parseInt(container.getAttribute("data-image-index")) || 0;
        const img = container.querySelector(".gallery-image");
        const leftBtn = container.querySelector(".gallery-nav-left");
        const rightBtn = container.querySelector(".gallery-nav-right");
        
        let newIndex;
        if (btn.classList.contains("gallery-nav-left")) {
          newIndex = Math.max(0, currentIndex - 1);
        } else {
          newIndex = Math.min(imageUrls.length - 1, currentIndex + 1);
        }
        
        // Update image with fade effect
        img.style.opacity = "0";
        setTimeout(() => {
          img.src = imageUrls[newIndex];
          container.setAttribute("data-image-index", newIndex);
          img.style.opacity = "1";
          
          // Update arrow disabled state
          if (leftBtn) {
            leftBtn.disabled = newIndex === 0;
          }
          if (rightBtn) {
            rightBtn.disabled = newIndex === imageUrls.length - 1;
          }
        }, 150);
      });
    });

    // Date click listeners (open popup for editing)
    document.querySelectorAll(".content-date").forEach((dateEl) => {
      dateEl.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation(); // Prevent card click
        const cardId = e.target.closest(".content-card").getAttribute("data-item-id");
        const cardData = this.contentData.find(item => item.id == cardId); // Use == for type coercion
        if (cardData) {
          this.openPopupWithCard(cardData);
        }
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

      // Get the correct sheet ID from the spreadsheet metadata
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
      const targetSheet = metadata.sheets.find(s => s.properties.title === this.currentSheetName) || metadata.sheets?.[0];
      if (!targetSheet) {
        throw new Error("No sheets found in spreadsheet");
      }

      const sheetId = targetSheet.properties.sheetId;
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

        console.log("Preserving pagination state:", {
          page: currentPageBeforeDeletion,
          itemsPerPage: currentItemsPerPage,
          scroll: currentScrollPosition,
          filters: {
            search: currentSearchQuery,
            tag: currentTagFilter,
          },
        });

        // Reload fresh data from spreadsheet to get correct row numbers
        await this.loadContent();

        // Restore filter state after reload
        document.getElementById("searchInput").value = currentSearchQuery;
        document.getElementById("tagFilter").value = currentTagFilter;

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
      modal.classList.remove('hidden');

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
        modal.classList.add('hidden');
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
    toast.className = 'toast-message';
    toast.textContent = message;
    document.body.appendChild(toast);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (toast.parentNode) {
        toast.classList.add('toast-exit');
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
    
    // Also render the custom dropdown
    this.renderTagFilterDropdown();
  }

  renderTagFilterDropdown() {
    const dropdown = document.getElementById("tag-filter-dropdown");
    const tagFilter = document.getElementById("tagFilter");
    if (!dropdown || !tagFilter) return;

    dropdown.innerHTML = '';

    // Add "All Tags" option
    const allTagsItem = document.createElement("div");
    allTagsItem.className = `dropdown-item ${tagFilter.value === '' ? 'active' : ''}`;
    allTagsItem.innerHTML = tagFilter.value === '' ? '<span style="margin-right: 8px;">✓</span>All Tags' : 'All Tags';
    allTagsItem.addEventListener("click", (e) => {
      e.stopPropagation();
      tagFilter.value = '';
      tagFilter.dispatchEvent(new Event('change'));
      dropdown.classList.remove("show");
      const button = document.getElementById("tag-filter-button");
      if (button) button.classList.remove("active");
    });
    dropdown.appendChild(allTagsItem);

    // Add each tag as an option
    const allTags = [
      ...new Set(this.contentData.flatMap((item) => item.tags)),
    ].sort();

    allTags.forEach((tag) => {
      const item = document.createElement("div");
      item.className = `dropdown-item ${tagFilter.value === tag ? 'active' : ''}`;
      item.innerHTML = tagFilter.value === tag ? `<span style="margin-right: 8px;">✓</span>${tag}` : tag;
      item.addEventListener("click", (e) => {
        e.stopPropagation();
        tagFilter.value = tag;
        tagFilter.dispatchEvent(new Event('change'));
        dropdown.classList.remove("show");
        const button = document.getElementById("tag-filter-button");
        if (button) button.classList.remove("active");
      });
      dropdown.appendChild(item);
    });
  }


  renderTagNavButtons() {
    const tagNavContainer = document.getElementById("tag-nav-buttons");
    if (!tagNavContainer) return;

    // Count tag occurrences
    const tagCounts = {};
    this.contentData.forEach((item) => {
      item.tags.forEach((tag) => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });

    // Get top 10 tags by count
    const topTags = Object.entries(tagCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([tag]) => tag);

    // Clear existing buttons
    tagNavContainer.innerHTML = "";

    // Create buttons for top 10 tags
    topTags.forEach((tag) => {
      const button = document.createElement("button");
      button.className = "tag-nav-button";
      button.textContent = tag;
      button.setAttribute("data-tag", tag);
        button.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();

          // Check if Command (Mac) or Ctrl (Windows/Linux) is pressed
          const isMultiSelect = e.metaKey || e.ctrlKey;

          if (isMultiSelect) {
            // Command/Ctrl + Click: Toggle the tag (additive behavior)
            if (this.selectedTags.has(tag)) {
              this.selectedTags.delete(tag);
              // Clear dropdown when deselecting
              document.getElementById("tagFilter").value = "";
            } else {
              this.selectedTags.add(tag);
              // Update dropdown to show the selected tag (only works with one tag)
              if (this.selectedTags.size === 1) {
                document.getElementById("tagFilter").value = tag;
              } else {
                // If multiple tags selected, clear dropdown
                document.getElementById("tagFilter").value = "";
              }
            }
          } else {
            // Regular click: If tag is already selected (and it's the only one), deselect it
            // Otherwise, clear all tags and select only this one
            if (this.selectedTags.has(tag) && this.selectedTags.size === 1) {
              this.selectedTags.clear();
              document.getElementById("tagFilter").value = "";
            } else {
              this.selectedTags.clear();
              this.selectedTags.add(tag);
              // Update dropdown to show the selected tag
              document.getElementById("tagFilter").value = tag;
            }
          }

          // Update filter button appearance
          const tagFilterContainer = document.querySelector('[data-tooltip="Filter by tag"]');
          const tagFilterElement = document.getElementById("tagFilter");
          if (tagFilterContainer && tagFilterElement) {
            this.updateFilterButtonAppearance(tagFilterContainer, tagFilterElement);
          }

          this.applyFilters();
          this.updateTagNavButtonStates();
        });
      tagNavContainer.appendChild(button);
    });

    // Update button states based on current filter
    this.updateTagNavButtonStates();
  }

  updateTagNavButtonStates() {
    // Update all tag nav buttons based on selectedTags Set
    document.querySelectorAll(".tag-nav-button").forEach((button) => {
      const buttonTag = button.getAttribute("data-tag");
      if (this.selectedTags.has(buttonTag)) {
        button.classList.add("active");
      } else {
        button.classList.remove("active");
      }
    });

    // Update tag header
    this.updateTagHeader();
  }

  parsePrice(priceString) {
    if (!priceString) return null;
    
    // Convert to string if it's not already
    const priceStr = String(priceString).trim();
    if (priceStr === '') return null;
    
    // Remove currency symbols and extract numeric value
    // Handles formats like: $10.99, €20, £15.50, 10.99 USD, etc.
    const cleaned = priceStr
      .replace(/[$€£¥₹]|\s*(USD|EUR|GBP|JPY|INR|CAD|AUD)\s*/gi, '')
      .replace(/,/g, '') // Remove thousand separators
      .trim();
    
    const numericValue = parseFloat(cleaned);
    return isNaN(numericValue) ? null : numericValue;
  }

  calculateTotalPrice() {
    if (!this.filteredData || this.filteredData.length === 0) return null;
    
    let total = 0;
    let hasPrices = false;
    
    this.filteredData.forEach((item) => {
      // Use only the dedicated price field - no extraction from content
      if (item.price && String(item.price).trim() !== '') {
        const priceStr = String(item.price).trim();
        const priceValue = this.parsePrice(priceStr);
        if (priceValue !== null && !isNaN(priceValue)) {
          total += priceValue;
          hasPrices = true;
        }
      }
    });
    
    return hasPrices ? total : null;
  }

  formatTotalPrice(total) {
    if (total === null) return '';
    
    // Try to detect currency from first item with price (use only price field)
    let currencySymbol = '$';
    for (const item of this.filteredData) {
      // Use only the dedicated price field - no extraction from content
      if (item.price && String(item.price).trim() !== '') {
        const priceStr = String(item.price).trim();
        if (priceStr.includes('€')) {
          currencySymbol = '€';
          break;
        } else if (priceStr.includes('£')) {
          currencySymbol = '£';
          break;
        } else if (priceStr.includes('$')) {
          currencySymbol = '$';
          break;
        }
      }
    }
    
    // Format with 2 decimal places
    const formatted = total.toFixed(2);
    return `Total: ${currencySymbol}${formatted}`;
  }

  updateTagHeader() {
    const tagHeader = document.getElementById("tag-header");
    const tagHeaderText = document.getElementById("tag-header-text");
    const tagHeaderPrice = document.getElementById("tag-header-price");
    const tagFilter = document.getElementById("tagFilter");

    if (!tagHeader || !tagHeaderText) return;

    // Check both selectedTags (from nav buttons) and tagFilter dropdown
    const selectedTagFromDropdown = tagFilter ? tagFilter.value : "";
    const tagsToDisplay = this.selectedTags.size > 0 
      ? Array.from(this.selectedTags)
      : (selectedTagFromDropdown ? [selectedTagFromDropdown] : []);

    if (tagsToDisplay.length > 0) {
      // Convert tags to title case and join with " + "
      const formattedTags = tagsToDisplay
        .map(tag => {
          // Split by spaces and capitalize first letter of each word
          return tag
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
        })
        .join(" + ");

      tagHeaderText.textContent = formattedTags;
      
      // Calculate and display total price
      const totalPrice = this.calculateTotalPrice();
      if (tagHeaderPrice) {
        if (totalPrice !== null) {
          tagHeaderPrice.textContent = this.formatTotalPrice(totalPrice);
        } else {
          tagHeaderPrice.textContent = '';
        }
      }
      
      tagHeader.classList.add("visible");
    } else {
      if (tagHeaderPrice) {
        tagHeaderPrice.textContent = '';
      }
      tagHeader.classList.remove("visible");
    }
  }

  async openPopupWithCard(cardData) {
    try {
      // Store the card data in chrome storage for the popup to access
      await chrome.storage.local.set({
        'editCardData': cardData,
        'editMode': true
      });
      
      // Small delay to ensure data is stored before popup opens
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Open the popup
      await chrome.action.openPopup();
    } catch (error) {
      console.error('Could not open popup:', error);
      // Fallback: show a message to user
      alert('Could not open editor. Please try clicking the extension icon manually.');
    }
  }


  applyFilters() {
    const searchTerm = document
      .getElementById("searchInput")
      .value.toLowerCase();
    const selectedTag = document.getElementById("tagFilter").value; // This is the dropdown, not the nav buttons

    this.filteredData = this.contentData.filter((item) => {
      // Search filter - enhanced with better debugging and robustness
      const matchesSearch = !searchTerm || (() => {
        const titleMatch = item.title && item.title.toLowerCase().includes(searchTerm);
        const contentMatch = item.content && item.content.toLowerCase().includes(searchTerm);
        const tagMatch = item.tags && Array.isArray(item.tags) && 
          item.tags.some((tag) => tag && tag.toLowerCase().includes(searchTerm));
        
        // Debug logging (can be removed in production)
        if (searchTerm && (titleMatch || contentMatch || tagMatch)) {
          console.log(`Search match found for "${searchTerm}":`, {
            title: titleMatch,
            content: contentMatch,
            tags: tagMatch,
            item: { title: item.title, tags: item.tags }
          });
        }
        
        return titleMatch || contentMatch || tagMatch;
      })();

      // Tag filter - check if item has ANY of the selected tags from nav buttons (OR logic)
      const matchesTagNav = this.selectedTags.size === 0 ||
        Array.from(this.selectedTags).some(tag => item.tags.includes(tag));

      // Tag filter - check dropdown filter (legacy)
      const matchesTagDropdown = !selectedTag || item.tags.includes(selectedTag);

      return matchesSearch && matchesTagNav && matchesTagDropdown;
    });

    // Reset pagination when filters change
    this.currentPage = 1;
    this.renderContent();
    this.updateLoadMoreButton();
    // attachEventListeners() is already called in renderContent()
    this.updateTagHeader();
  }

  updateSearchPlaceholder() {
    const searchInput = document.getElementById("searchInput");
    const totalQuotes = this.contentData.length;
    searchInput.placeholder = `Search your ${totalQuotes} quotes...`;
  }

  updateSearchResultsIndicator() {
    const searchInput = document.getElementById("searchInput");
    const searchTerm = searchInput?.value.trim() || "";
    
    // Find or create search results indicator
    let searchIndicator = document.getElementById("search-results-indicator");
    if (!searchIndicator) {
      searchIndicator = document.createElement("div");
      searchIndicator.id = "search-results-indicator";
      searchIndicator.style.cssText = `
        text-align: center;
        margin: 20px 0;
        padding: 12px 20px;
        background: hsl(20, 5.9%, 95%);
        border-radius: 8px;
        color: hsl(20, 14.3%, 4.1%);
        font-size: 14px;
        border: 1px solid hsl(20, 5.9%, 90%);
      `;
      
      // Insert after the header
      const header = document.querySelector(".header");
      if (header) {
        header.insertAdjacentElement("afterend", searchIndicator);
      }
    }
    
    if (searchTerm) {
      const totalResults = this.filteredData.length;
      const totalQuotes = this.contentData.length;
      searchIndicator.innerHTML = `
        <strong>Search results for "${searchTerm}"</strong><br>
        Found ${totalResults} of ${totalQuotes} quotes
        ${totalResults > 0 ? '<br><small>Search includes titles, content, and tags</small>' : ''}
      `;
      searchIndicator.classList.remove("hidden");
    } else {
      searchIndicator.classList.add("hidden");
    }
  }

  renderContent() {
    const contentContainer = document.getElementById("content");
    const noResults = document.getElementById("no-results");

    // Update search placeholder with current quote count
    this.updateSearchPlaceholder();

    // Show search results indicator if search is active
    this.updateSearchResultsIndicator();

    if (this.filteredData.length === 0) {
      contentContainer.classList.add("hidden");
      noResults.classList.remove("hidden");
      this.hideLoadMoreButton();
      return;
    }

    contentContainer.classList.remove("hidden");
    noResults.classList.add("hidden");

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
      if (window.innerWidth <= 1200) return 3;
      return 4;
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
      
      // Build image gallery HTML
      let imageGalleryHtml = '';
      if (item.images && item.images.length > 0) {
        const firstImage = item.images[0];
        const hasMultipleImages = item.images.length > 1;
        const imageUrlsJson = JSON.stringify(item.images).replace(/"/g, '&quot;');
        
        imageGalleryHtml = `
          <div class="content-image-container" data-item-id="${item.id}" data-image-index="0" data-image-urls="${imageUrlsJson}">
            <img src="${firstImage}" alt="" class="content-image gallery-image">
            ${hasMultipleImages ? `
              <button class="gallery-nav-btn gallery-nav-left" disabled title="Previous image">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="m15 18-6-6 6-6"/>
                </svg>
              </button>
              <button class="gallery-nav-btn gallery-nav-right" title="Next image">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="m9 18 6-6-6-6"/>
                </svg>
              </button>
            ` : ''}
          </div>
        `;
      }
      
      cardElement.innerHTML = `
        ${imageGalleryHtml}
        
        <div class="content-text">
          ${this.escapeHtml(item.content).replace(/\n/g, '<br>')}
          ${item.price && String(item.price).trim() !== '' ? `<br><span class="content-price">${this.escapeHtml(String(item.price).trim())}</span>` : ''}
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
                (tag) => {
                const searchTerm = document.getElementById("searchInput")?.value.toLowerCase() || "";
                const isTagMatch = searchTerm && tag.toLowerCase().includes(searchTerm);
                return `
              <span class="tag-pill ${isTagMatch ? 'search-highlight' : ''}" data-tag="${this.escapeHtml(tag)}">
                ${this.escapeHtml(tag)}
              </span>`;
                }
              )
              .join("")}
          </div>
        `
            : ""
        }
        
        <div class="content-meta">
          <span class="content-domain">${this.getDomain(item.url)}</span>
          <div class="content-meta-right">
            <time class="content-date">${this.formatDate(item.date)}</time>
            <button class="delete-btn" data-item-id="${item.id}" title="Delete">
              <svg width="14px" height="14px" stroke-width="2" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" color="#666666">
                <path d="M6.75827 17.2426L12.0009 12M17.2435 6.75736L12.0009 12M12.0009 12L6.75827 6.75736M12.0009 12L17.2435 17.2426" stroke="#666666" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
              </svg>
            </button>
          </div>
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
      // Add a spacer element at the bottom of each column
      const spacer = document.createElement('div');
      spacer.style.height = '120px';
      spacer.style.width = '100%';
      column.appendChild(spacer);
      
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

  isAnyDropdownOpen() {
    const dropdowns = [
      document.getElementById('sheet-selector-dropdown'),
      document.getElementById('tag-filter-dropdown')
    ];
    return dropdowns.some(dropdown => dropdown && dropdown.classList.contains('show'));
  }

  initTooltips() {
    const elements = document.querySelectorAll('[data-tooltip]');
    let tooltip = null;
    let hideTimeout = null;

    elements.forEach(element => {
      element.addEventListener('mouseenter', (e) => {
        // Don't show tooltip if any dropdown is open
        if (this.isAnyDropdownOpen()) {
          return;
        }

        // Don't show tooltip on tag filter button if a tag is active
        if (e.currentTarget.getAttribute('data-tooltip') === 'Filter by tag') {
          const tagFilter = document.getElementById('tagFilter');
          if (tagFilter && tagFilter.value) {
            return; // Don't show tooltip when a tag filter is active
          }
        }

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
          // Check again if dropdown is still closed before showing
          if (tooltip && !this.isAnyDropdownOpen()) {
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
    const tagFilterButton = document.getElementById('tag-filter-button');
    const tagFilterDropdown = document.getElementById('tag-filter-dropdown');
    const tagFilter = document.getElementById('tagFilter');
    
    if (tagFilterButton && tagFilterDropdown) {
      tagFilterButton.addEventListener('click', (e) => {
        e.stopPropagation();
        
        // Close other dropdowns if open
        const sheetSelectorDropdown = document.getElementById('sheet-selector-dropdown');
        const sheetSelectorButton = document.getElementById('sheet-selector-button');
        if (sheetSelectorDropdown && sheetSelectorDropdown.classList.contains("show")) {
          sheetSelectorDropdown.classList.remove("show");
          if (sheetSelectorButton) sheetSelectorButton.classList.remove("active");
        }
        
        const isOpen = tagFilterDropdown.classList.contains("show");
        if (isOpen) {
          tagFilterDropdown.classList.remove("show");
          tagFilterButton.classList.remove("active");
        } else {
          this.renderTagFilterDropdown();
          tagFilterDropdown.classList.add("show");
          tagFilterButton.classList.add("active");
        }
      });
      
      // Update button appearance when selection changes
      if (tagFilter) {
        tagFilter.addEventListener('change', () => {
          this.renderTagFilterDropdown();
          this.updateTagNavButtonStates();
          this.updateTagHeader();

          // Update filter button appearance
          const tagFilterContainer = document.querySelector('[data-tooltip="Filter by tag"]');
          if (tagFilterContainer) {
            this.updateFilterButtonAppearance(tagFilterContainer, tagFilter);
          }
        });
      }
    }

    // Close dropdowns when clicking outside
    document.addEventListener("click", (e) => {
      // Close sheet selector if clicking outside
      const sheetSelectorDropdown = document.getElementById('sheet-selector-dropdown');
      const sheetSelectorButton = document.getElementById('sheet-selector-button');
      if (sheetSelectorDropdown && !sheetSelectorDropdown.contains(e.target) && 
          sheetSelectorButton && !sheetSelectorButton.contains(e.target)) {
        sheetSelectorDropdown.classList.remove("show");
        if (sheetSelectorButton) sheetSelectorButton.classList.remove("active");
      }
      
      // Close tag filter if clicking outside
      if (tagFilterDropdown && !tagFilterDropdown.contains(e.target) && 
          tagFilterButton && !tagFilterButton.contains(e.target)) {
        tagFilterDropdown.classList.remove("show");
        if (tagFilterButton) tagFilterButton.classList.remove("active");
      }
      
    });
  }

  updateFilterButtonAppearance(container, selectElement) {
    const selectedValue = selectElement.value;
    const selectedText = selectElement.options[selectElement.selectedIndex].text;

    // Get the actual button element (not the container)
    const button = container.querySelector('#tag-filter-button');
    if (!button) return;

    // Remove any existing clear button and text label
    const existingClearBtn = container.querySelector('.filter-clear-btn');
    const existingLabel = container.querySelector('.filter-label');
    if (existingClearBtn) existingClearBtn.remove();
    if (existingLabel) existingLabel.remove();

    if (selectedValue && selectedValue !== '') {
      // Expand button to show tag name
      button.style.width = 'auto';
      button.style.minWidth = '100px';
      button.style.padding = '8px 32px 8px 12px';
      button.style.gap = '6px';

      // Add text label showing selected tag
      const label = document.createElement('span');
      label.className = 'filter-label';
      label.textContent = selectedText;
      label.style.cssText = `
        color: hsl(20, 14.3%, 4.1%);
        font-size: 14px;
        white-space: nowrap;
      `;
      button.appendChild(label);

      // Add clear button (X) on the right
      const clearBtn = document.createElement('button');
      clearBtn.className = 'filter-clear-btn';
      clearBtn.innerHTML = '×';
      clearBtn.style.cssText = `
        position: absolute;
        right: 8px;
        top: 50%;
        transform: translateY(-50%);
        width: 20px;
        height: 20px;
        border: none;
        background: transparent;
        color: #6b7280;
        border-radius: 50%;
        font-size: 18px;
        font-weight: bold;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 3;
        transition: all 0.2s ease;
        line-height: 1;
      `;

      // Add hover effect
      clearBtn.addEventListener('mouseenter', () => {
        clearBtn.style.background = 'rgb(255, 217, 16)';
        clearBtn.style.color = '#374151';
        clearBtn.style.transform = 'translateY(-50%) scale(1.1)';
      });

      clearBtn.addEventListener('mouseleave', () => {
        clearBtn.style.background = 'transparent';
        clearBtn.style.color = '#6b7280';
        clearBtn.style.transform = 'translateY(-50%) scale(1)';
      });

      // Add click handler to clear the filter
      clearBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        // Hide any visible tooltips
        const tooltips = document.querySelectorAll('.tooltip');
        tooltips.forEach(tooltip => {
          tooltip.classList.remove('show');
          tooltip.remove();
        });

        // Reset the select value
        selectElement.value = '';

        // Clear selected tags
        this.selectedTags.clear();
        this.updateTagNavButtonStates();

        // Update the appearance (this will remove the clear button)
        this.updateFilterButtonAppearance(container, selectElement);

        // Apply filters to reload content
        this.applyFilters();
      });

      container.appendChild(clearBtn);
    } else {
      // Reset to icon-only state
      button.style.width = '36px';
      button.style.minWidth = '36px';
      button.style.padding = '0';
      button.style.gap = '';
    }
  }

  showLoading(show) {
    const loading = document.getElementById("loading");
    const content = document.getElementById("content");
    const authRequired = document.getElementById("auth-required");
    const noResults = document.getElementById("no-results");
    const loadMoreContainer = document.getElementById("load-more-container");

    if (show) {
      loading.classList.remove("hidden");
      content.classList.add("hidden");
      authRequired.classList.add("hidden");
      if (noResults) noResults.classList.add("hidden");
      if (loadMoreContainer) loadMoreContainer.classList.add("hidden");
    } else {
      loading.classList.add("hidden");
    }
  }

  showAuthRequired() {
    const loading = document.getElementById("loading");
    const content = document.getElementById("content");
    const authRequired = document.getElementById("auth-required");

    loading.classList.add("hidden");
    content.classList.add("hidden");
    authRequired.classList.remove("hidden");

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


  loadMoreItems() {
    this.currentPage++;
    this.renderContent();
  }

  updateLoadMoreButton() {
    const loadMoreContainer = document.getElementById("load-more-container");
    const totalItems = this.filteredData.length;
    const displayedItems = this.currentPage * this.itemsPerPage;

    if (loadMoreContainer) {
      // Only show if there's content and more items to load
      if (totalItems > 0 && displayedItems < totalItems) {
        loadMoreContainer.classList.remove("hidden");
        const remaining = totalItems - displayedItems;
        const loadMoreBtn = document.getElementById("load-more-btn");
        loadMoreBtn.textContent = `Load more (${remaining} remaining)`;
      } else {
        loadMoreContainer.classList.add("hidden");
      }
    }
  }

  hideLoadMoreButton() {
    const loadMoreContainer = document.getElementById("load-more-container");
    if (loadMoreContainer) {
      loadMoreContainer.classList.add("hidden");
    }
  }
}

// Global functions
window.selectTag = function (tag) {
  const tagFilter = document.getElementById("tagFilter");
  tagFilter.value = tag;
  
  // Update the filter button appearance to show the active filter
  const tagFilterContainer = document.querySelector('[data-tooltip="Filter by tag"]');
  if (tagFilterContainer && fullPageCollector) {
    fullPageCollector.updateFilterButtonAppearance(tagFilterContainer, tagFilter);
  }
  
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
