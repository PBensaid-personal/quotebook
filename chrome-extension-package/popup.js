// Enhanced Quote Collector with Beautiful UI and Working OAuth
class EnhancedQuoteCollector {
  constructor() {
    this.accessToken = null;
    this.spreadsheetId = null;
    this.userTags = [];
    this.isLoggedOut = false; // Track logout state
    this.pageImages = []; // Available page images
    this.selectedImageIndices = new Set(); // Multiple images can be selected
    this.carouselStartIndex = 0; // Carousel view start
    this.existingTags = []; // Tags from Google Sheets for autocomplete
    this.selectedAutocompleteIndex = -1; // Currently selected autocomplete item
    this.isLoadingCardData = false; // Flag to prevent extractPageMetadata from overwriting during edit mode load
    this.currentSheetName = null; // Current selected sheet name for saving quotes
    this.allSheetNames = []; // All available sheet names
    this.init();
  }

  async init() {
    try {
      this.setupEventListeners();
      this.setupMessageListener();
      await this.checkUpdateNotification();
      await this.checkExistingAuth();
      await this.checkEditMode();
      await this.loadSelectedText();
      // Note: loadExistingTags() will be called after auth is confirmed
      this.setupTagInterface();
    } catch (error) {
      console.error('Initialization error:', error);
      // Fallback: show auth interface if anything fails
      this.showAuthInterface();
    }
  }

  setupMessageListener() {
    // Listen for logout messages from background script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'logout') {
        this.accessToken = null;
        this.spreadsheetId = null;
        this.userTags = [];
        this.isLoggedOut = true;
        this.showAuthInterface();
        return true;
      }
    });
  }

  async checkUpdateNotification() {
    const currentVersion = '1.1.0';
    const result = await chrome.storage.local.get(['lastSeenVersion']);

    // Show update notification if this is a new version
    if (!result.lastSeenVersion || result.lastSeenVersion !== currentVersion) {
      // Only show if user has used the extension before (has auth)
      const authState = await chrome.storage.local.get(['isAuthenticated']);
      if (authState.isAuthenticated) {
        this.showUpdateNotification();
      }
    }
  }

  showUpdateNotification() {
    const updateNotification = document.getElementById('update-notification');
    if (updateNotification) {
      updateNotification.classList.remove('hidden');
    }
  }

  async dismissUpdateNotification() {
    const currentVersion = '1.1.0';
    const updateNotification = document.getElementById('update-notification');

    if (updateNotification) {
      updateNotification.classList.add('hidden');
    }

    // Store that user has seen this version
    await chrome.storage.local.set({ lastSeenVersion: currentVersion });
  }

  setupEventListeners() {
    document.getElementById('auth-button').addEventListener('click', () => {
      this.authenticateFixed();
    });

    document.getElementById('save-button').addEventListener('click', (e) => {
      // Don't trigger save if clicking on the dropdown toggle area
      if (e.target.closest('#save-button-dropdown-toggle')) {
        return;
      }
      this.saveQuote();
    });

    document.getElementById('spreadsheet-icon').addEventListener('click', async () => {
      const result = await chrome.storage.local.get(['googleSpreadsheetId']);
      if (result.googleSpreadsheetId) {
        window.open(`https://docs.google.com/spreadsheets/d/${result.googleSpreadsheetId}/edit`, '_blank');
      }
    });

    // Sheet selector dropdown toggle
    const dropdownToggle = document.getElementById('save-button-dropdown-toggle');
    const sheetSelectorDropdown = document.getElementById('sheet-selector-popup-dropdown');
    const saveButtonContainer = document.getElementById('save-button-container');
    
    if (dropdownToggle && sheetSelectorDropdown) {
      dropdownToggle.addEventListener('click', async (e) => {
        e.stopPropagation();
        const isOpen = !sheetSelectorDropdown.classList.contains('hidden');
        if (isOpen) {
          sheetSelectorDropdown.classList.add('hidden');
          dropdownToggle.querySelector('svg').style.transform = 'rotate(0deg)';
        } else {
          await this.renderSheetSelectorPopup();
          sheetSelectorDropdown.classList.remove('hidden');
          dropdownToggle.querySelector('svg').style.transform = 'rotate(180deg)';
        }
      });

      // Close dropdown when clicking outside
      document.addEventListener('click', (e) => {
        if (sheetSelectorDropdown && !sheetSelectorDropdown.contains(e.target) &&
            saveButtonContainer && !saveButtonContainer.contains(e.target)) {
          sheetSelectorDropdown.classList.add('hidden');
          if (dropdownToggle.querySelector('svg')) {
            dropdownToggle.querySelector('svg').style.transform = 'rotate(0deg)';
          }
        }
      });
    }

    document.getElementById('view-all-icon').addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('fullpage.html') });
    });

    // Price toggle button
    document.getElementById('price-toggle-btn').addEventListener('click', () => {
      this.showPriceInput();
    });

    // Update notification handlers
    const updateClose = document.getElementById('update-close');
    const updateGotIt = document.getElementById('update-got-it');

    if (updateClose) {
      updateClose.addEventListener('click', () => {
        this.dismissUpdateNotification();
      });
    }

    if (updateGotIt) {
      updateGotIt.addEventListener('click', () => {
        this.dismissUpdateNotification();
      });
    }

    // Add tooltip functionality
    this.initTooltips();
    
    // Setup image carousel
    this.setupImageCarousel();
    
    // Setup tag autocomplete
    this.setupTagAutocomplete();

    // Header brand (logo + title) opens full page view
    document.getElementById('header-brand').addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: chrome.runtime.getURL('fullpage.html') });
    });

    // Post-save action buttons
    document.getElementById('view-collection-btn').addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('fullpage.html') });
    });

    document.getElementById('close-btn').addEventListener('click', () => {
      window.close();
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
    this.userTags = this.userTags.filter(tag => tag !== tagToRemove);
    this.renderUserTags();
  }

  updateSheetNameDisplay() {
    const sheetNameElement = document.getElementById('save-button-sheet-name');
    if (sheetNameElement) {
      sheetNameElement.textContent = this.currentSheetName || 'My quotes';
    }
  }

  async loadSheetNames() {
    try {
      const result = await chrome.storage.local.get(['googleSpreadsheetId']);
      if (!result.googleSpreadsheetId) {
        this.allSheetNames = [];
        this.updateSheetNameDisplay();
        return;
      }

      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${result.googleSpreadsheetId}?fields=sheets.properties`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const metadata = await response.json();
        this.allSheetNames = metadata.sheets.map(s => s.properties.title);
        
        // If no sheet selected or selected sheet doesn't exist, use first sheet or 'My quotes'
        if (!this.currentSheetName || !this.allSheetNames.includes(this.currentSheetName)) {
          this.currentSheetName = this.allSheetNames.find(s => s === 'My quotes') || this.allSheetNames[0] || 'My quotes';
          await chrome.storage.local.set({ currentSheetName: this.currentSheetName });
        }
        this.updateSheetNameDisplay();
      } else {
        this.allSheetNames = [];
        this.updateSheetNameDisplay();
      }
    } catch (error) {
      console.error('Failed to load sheet names:', error);
      this.allSheetNames = [];
      this.updateSheetNameDisplay();
    }
  }

  async renderSheetSelectorPopup() {
    const dropdown = document.getElementById('sheet-selector-popup-dropdown');
    if (!dropdown) return;

    // Refresh sheet names
    await this.loadSheetNames();

    // Update the sheet name in the button
    this.updateSheetNameDisplay();

    // Clear dropdown
    dropdown.innerHTML = '';

    // Add each sheet as an option
    this.allSheetNames.forEach((sheetName) => {
      const item = document.createElement('div');
      item.className = `sheet-selector-popup-item ${sheetName === this.currentSheetName ? 'active' : ''}`;
      if (sheetName === this.currentSheetName) {
        item.innerHTML = `<span style="margin-right: 8px;">✓</span>${sheetName}`;
      } else {
        item.textContent = sheetName;
      }
      
      item.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (sheetName !== this.currentSheetName) {
          this.currentSheetName = sheetName;
          await chrome.storage.local.set({ currentSheetName: sheetName });
          this.renderSheetSelectorPopup(); // Re-render to update active state
        }
        dropdown.classList.add('hidden');
        const dropdownToggle = document.getElementById('save-button-dropdown-toggle');
        if (dropdownToggle && dropdownToggle.querySelector('svg')) {
          dropdownToggle.querySelector('svg').style.transform = 'rotate(0deg)';
        }
      });

      dropdown.appendChild(item);
    });

    // Add "Create new tab" option
    const createNew = document.createElement('div');
    createNew.className = 'sheet-selector-popup-item create-new';
    createNew.textContent = '+ Create new collection';
    createNew.addEventListener('click', async (e) => {
      e.stopPropagation();
      await this.showCreateSheetDialogPopup();
      dropdown.classList.add('hidden');
      const dropdownToggle = document.getElementById('save-button-dropdown-toggle');
      if (dropdownToggle && dropdownToggle.querySelector('svg')) {
        dropdownToggle.querySelector('svg').style.transform = 'rotate(0deg)';
      }
    });
    dropdown.appendChild(createNew);
  }

  async showCreateSheetDialogPopup() {
    // Get next available sheet number
    let sheetNumber = 1;
    while (this.allSheetNames.includes(`Sheet ${sheetNumber}`)) {
      sheetNumber++;
    }
    const defaultName = `Sheet ${sheetNumber}`;

    // Show custom modal with input
    const sheetName = await this.showCreateSheetModalPopup(defaultName);
    
    if (!sheetName || sheetName.trim() === '') {
      return; // User cancelled or entered empty name
    }

    const trimmedName = sheetName.trim();
    
    // Check if name already exists
    if (this.allSheetNames.includes(trimmedName)) {
      this.showStatus(`A sheet named "${trimmedName}" already exists. Please choose a different name.`, 'error');
      // Show the modal again with the same default
      return await this.showCreateSheetDialogPopup();
    }

    await this.createNewSheetPopup(trimmedName);
  }

  showCreateSheetModalPopup(defaultName) {
    return new Promise((resolve) => {
      const modal = document.getElementById('create-sheet-modal-popup');
      const input = document.getElementById('create-sheet-input-popup');
      const confirmBtn = document.getElementById('confirm-create-sheet-popup');
      const cancelBtn = document.getElementById('cancel-create-sheet-popup');

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

  async createNewSheetPopup(sheetName) {
    try {
      // Create new sheet using batchUpdate
      const createResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}:batchUpdate`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            requests: [
              {
                addSheet: {
                  properties: {
                    title: sheetName
                  }
                }
              }
            ]
          })
        }
      );

      if (!createResponse.ok) {
        const errorData = await createResponse.json();
        throw new Error(errorData.error?.message || 'Failed to create sheet');
      }

      // Add headers to the new sheet
      const escapedSheetName = `'${sheetName.replace(/'/g, "''")}'`;
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}/values/${escapedSheetName}!A1:G1?valueInputOption=RAW`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            values: [['Title', 'Content', 'URL', 'Tags', 'Timestamp', 'Image', 'Price']]
          })
        }
      );

      // Refresh sheet list and switch to new sheet
      await this.loadSheetNames();
      this.currentSheetName = sheetName;
      await chrome.storage.local.set({ currentSheetName: sheetName });
      this.updateSheetNameDisplay();
      this.renderSheetSelectorPopup();
    } catch (error) {
      console.error('Failed to create sheet:', error);
      alert(`Failed to create sheet: ${error.message}`);
    }
  }

  async loadExistingTags() {
    try {
      const result = await chrome.storage.local.get(['googleSpreadsheetId']);
      if (!result.googleSpreadsheetId) {
        this.existingTags = []; // Start empty, no fallback tags
        return;
      }


      // Use current sheet name or default to 'My quotes'
      const sheetName = this.currentSheetName || 'My quotes';
      const escapedSheetName = `'${sheetName.replace(/'/g, "''")}'`;
      
      // Fetch all data from the sheet to extract unique tags
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${result.googleSpreadsheetId}/values/${escapedSheetName}!A:H`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        const tagOrder = []; // Track tag order (most recent first)
        const tagSet = new Set(); // Track unique tags

        // Extract tags from column D (index 3) - skip header row
        // Process in reverse to get most recently used tags first
        if (data.values && data.values.length > 1) {
          const rows = data.values.slice(1).reverse(); // Reverse to start with newest quotes
          rows.forEach(row => {
            if (row[3]) { // Tags column (4th column, index 3)
              const rowTags = row[3].split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
              rowTags.forEach(tag => {
                if (!tagSet.has(tag)) {
                  tagSet.add(tag);
                  tagOrder.push(tag); // Add to ordered list only on first occurrence
                }
              });
            }
          });
        }

        this.existingTags = tagOrder; // Use chronological order (most recent first)

        // Re-render tag pills now that we have tags loaded
        this.setupTagAutocomplete();
      } else {
        this.existingTags = [];
      }
    } catch (error) {
      this.existingTags = [];
    }
  }

  async checkExistingAuth() {
    try {

      // Check if user explicitly logged out
      const logoutState = await chrome.storage.local.get(['userLoggedOut']);
      if (logoutState.userLoggedOut) {
        this.isLoggedOut = true;
        this.showAuthInterface();
        return;
      }

      // Check for cached authentication state
      const authState = await chrome.storage.local.get(['isAuthenticated', 'googleAccessToken', 'googleSpreadsheetId', 'currentSheetName']);

      if (authState.isAuthenticated && authState.googleAccessToken && authState.googleSpreadsheetId) {
        // Show loading indicator while validating and loading
        this.showMainLoading();

        this.accessToken = authState.googleAccessToken;
        this.spreadsheetId = authState.googleSpreadsheetId;
        this.currentSheetName = authState.currentSheetName || null;

        // Quick validation - try to get token without interactive flow
        try {
          const accessToken = await chrome.identity.getAuthToken({ interactive: false });
          if (accessToken) {
            this.accessToken = typeof accessToken === 'object' ? accessToken.token : accessToken;

            // Quick test if still valid
            const isValid = await this.validateToken();
            if (isValid) {
              // Load sheet names and set current sheet
              await this.loadSheetNames();
              await this.loadExistingTags();
              this.showMainInterface();
              return;
            } else {
              await chrome.storage.local.remove(['isAuthenticated', 'googleAccessToken', 'googleSpreadsheetId']);
            }
          }
        } catch (error) {
          await chrome.storage.local.remove(['isAuthenticated', 'googleAccessToken', 'googleSpreadsheetId']);
        }
      }

      // No valid cached auth, need to authenticate
      this.showAuthInterface();

    } catch (error) {
      this.showAuthInterface();
    }
  }

  async checkEditMode() {
    try {
      const result = await chrome.storage.local.get(['editMode', 'editCardData']);
      if (result.editMode && result.editCardData) {
        // Set flag to prevent extractPageMetadata from overwriting saved data
        this.isLoadingCardData = true;
        // Add a delay to ensure all popup initialization is complete
        setTimeout(() => {
          this.loadCardDataForEdit(result.editCardData);
        }, 500);
        // Clear the edit mode flags
        await chrome.storage.local.remove(['editMode', 'editCardData']);
      }
    } catch (error) {
      console.error('Error checking edit mode:', error);
    }
  }

  loadCardDataForEdit(cardData) {
    // Populate the form fields with the card data
    const contentInput = document.getElementById('content');
    const tagsInput = document.getElementById('tag-input');
    const titlePreview = document.getElementById('preview-title');
    const urlPreview = document.getElementById('preview-url');
    
    if (contentInput) {
      contentInput.value = cardData.content || '';
    }
    
    if (tagsInput) {
      tagsInput.value = cardData.tags ? cardData.tags.join(', ') : '';
    }
    
    if (titlePreview) {
      titlePreview.textContent = cardData.title || '';
    }
    
    if (urlPreview) {
      urlPreview.textContent = cardData.url || '';
    }
    
    // Set the price if available
    const priceInput = document.getElementById('price-input');
    const priceLabel = document.getElementById('price-label');
    const priceToggleBtn = document.getElementById('price-toggle-btn');
    if (priceInput && priceLabel) {
      priceInput.value = cardData.price || '';
      if (cardData.price) {
        // Show price input/label, hide toggle button
        priceToggleBtn.style.display = 'none';
        priceInput.classList.remove('hidden');
        priceLabel.classList.remove('hidden');
        priceLabel.style.opacity = '0';
      } else {
        // Hide price input/label, show toggle button
        priceToggleBtn.style.display = '';
        priceInput.classList.add('hidden');
        priceLabel.classList.add('hidden');
        priceLabel.style.opacity = '1';
      }
    }
    
    // Set the image(s) if available
    if (cardData.image) {
      // Split pipe-delimited URLs if multiple images exist (||| delimiter)
      const savedImageUrls = cardData.image.split('|||').map(url => url.trim()).filter(url => url);
      
      if (savedImageUrls.length > 0) {
        // Merge saved images with current page images
        // First, add saved images that aren't already in pageImages
        const existingUrls = new Set(this.pageImages.map(img => img.src));
        savedImageUrls.forEach(url => {
          if (!existingUrls.has(url)) {
            this.pageImages.push({
              src: url,
              alt: 'Saved image'
            });
          }
        });
        
        // Select all saved images (by URL match, not just index)
        this.selectedImageIndices.clear();
        this.pageImages.forEach((img, index) => {
          if (savedImageUrls.includes(img.src)) {
            this.selectedImageIndices.add(index);
          }
        });
        
        // Reset carousel to start to show selected images
        this.carouselStartIndex = 0;
        this.showImageSelector();
      } else {
        // No valid images, hide selector
        this.hideImageSelector();
      }
    } else {
      // No image, but if page has images, show them (user can select new ones)
      if (this.pageImages.length > 0) {
        this.selectedImageIndices.clear();
        this.showImageSelector();
      } else {
        this.hideImageSelector();
      }
    }
    
    // Update the UI to show we're in edit mode
    const submitButton = document.getElementById('submitQuote');
    if (submitButton) {
      submitButton.textContent = 'Update Quote';
      submitButton.style.backgroundColor = '#059669'; // Green for update
    }
    
    // Store the original row index for updating
    this.editingCardId = cardData.originalRowIndex;
    this.isEditMode = true;
    // Clear the loading flag now that card data is loaded
    this.isLoadingCardData = false;
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
      
      // Clear any cached tokens first to force fresh auth
      try {
        const existingToken = await chrome.identity.getAuthToken({ interactive: false });
        if (existingToken) {
          const tokenToRemove = typeof existingToken === 'object' ? existingToken.token : existingToken;
          await chrome.identity.removeCachedAuthToken({ token: tokenToRemove });
        }
      } catch (e) {
      }
      
      // Use Chrome Identity API with interactive flow
      const accessToken = await chrome.identity.getAuthToken({ 
        interactive: true
      });

      if (!accessToken) {
        throw new Error('No access token received from Chrome Identity API');
      }

      
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
      
      // Store authentication state for future popup opens and fullpage compatibility
      await chrome.storage.local.set({
        isAuthenticated: true,
        googleAccessToken: this.accessToken,
        googleSpreadsheetId: this.spreadsheetId
      });
      
      // Load sheet names and set current sheet
      await this.loadSheetNames();
      this.showMainInterface();

    } catch (error) {
      console.error('Authentication error:', error);
      
      // Show user-friendly error messages
      let userMessage = 'Authentication failed. Please try again.';
      if (error.message.includes('cancelled') || error.message.includes('denied')) {
        userMessage = 'Authentication was cancelled. Please try again when ready.';
      } else if (error.message.includes('network') || error.message.includes('timeout')) {
        userMessage = 'Network error. Please check your connection and try again.';
      }
      
      this.showStatus(userMessage, 'error');
      
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
          
          // Now load sheet names and tags from the connected spreadsheet
          await this.loadSheetNames();
          await this.loadExistingTags();
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
              title: 'My quotes'
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
        
        // Load sheet names and tags from the newly created spreadsheet (will be empty initially)
        await this.loadSheetNames();
        await this.loadExistingTags();
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
    const headers = ['Title', 'Content', 'URL', 'Tags', 'Timestamp', 'Image', 'Price'];

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

      // Only try to get selected text from content pages (not chrome:// or extension pages)
      if (tab && tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
        try {
          const response = await chrome.tabs.sendMessage(tab.id, { action: 'getSelectedText' });

          if (response && response.selectedText && response.selectedText.trim()) {
            document.getElementById('content').value = response.selectedText.trim();
          } else {
            // If no text selected, show instruction
            document.getElementById('content').value = "Select text on the webpage to capture it here...";
          }
        } catch (error) {
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
      document.getElementById('content').value = "Select text on the webpage to capture it here...";
    }
  }

  showPriceInput() {
    const priceToggleBtn = document.getElementById('price-toggle-btn');
    const priceInput = document.getElementById('price-input');
    const priceLabel = document.getElementById('price-label');

    if (priceToggleBtn && priceInput && priceLabel) {
      // Hide button
      priceToggleBtn.style.display = 'none';

      // Show input and label by removing hidden class
      priceInput.classList.remove('hidden');
      priceLabel.classList.remove('hidden');

      // Focus the input
      priceInput.focus();
    }
  }

  async extractPageMetadata() {
    try {
      // Don't overwrite images/price if we're loading card data for edit or already in edit mode
      if (this.isLoadingCardData || this.isEditMode) {
        return;
      }

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const result = await chrome.tabs.sendMessage(tab.id, { action: 'getPageMetadata' });

      // Handle page images only - removed auto-tag functionality
      if (result && result.images && result.images.length > 0) {
        this.pageImages = result.images;
        this.showImageSelector();
      } else {
        this.hideImageSelector();
      }

      // Handle price extraction
      if (result && result.price) {
        const priceToggleBtn = document.getElementById('price-toggle-btn');
        const priceInput = document.getElementById('price-input');
        const priceLabel = document.getElementById('price-label');

        if (priceInput && priceToggleBtn && priceLabel) {
          // Hide toggle button, show input with detected price
          priceToggleBtn.style.display = 'none';
          priceInput.classList.remove('hidden');
          priceLabel.classList.remove('hidden');
          priceInput.value = result.price;
          priceLabel.style.opacity = '0';
        }
      }
    } catch (e) {
      // Could not access tab, this is normal
    }
  }

  updatePagePreview(tab) {
    // Update title and URL (removed favicon)
    document.getElementById('preview-title').textContent = tab.title || 'Untitled Page';
    document.getElementById('preview-url').textContent = tab.url || '';
  }

  async saveQuote() {
    try {
      const content = document.getElementById('content').value;

      if (!content.trim() || content === "Select text on the webpage to capture it here...") {
        this.showSaveButtonStatus('Please select some text first', 'error');
        return;
      }
      
      // Process any tags in the input field
      this.processInputTags();
      
      // Ensure we have a spreadsheet ID
      if (!this.spreadsheetId) {
        await this.setupSpreadsheetIfNeeded();
      }
      
      if (!this.spreadsheetId) {
        throw new Error('Failed to setup spreadsheet');
      }
      
      // Reset saved state if it's visible (in case user is saving again)
      this.resetSavedState();
      
      // Check if we're in edit mode
      if (this.isEditMode && this.editingCardId) {
        this.showSaveButtonStatus('Updating quote...', 'saving');
        await this.updateExistingQuote();
        return;
      }
      
      this.showSaveButtonStatus('Saving to Google Sheets...', 'saving');
      document.getElementById('save-button').disabled = true;

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Extract page image - use selected image only, no automatic fallbacks
      let pageImage = this.getSelectedImageUrl();
      
      // Get price from input field
      const priceInput = document.getElementById('price-input');
      const price = priceInput ? priceInput.value.trim() : '';
      
      const now = new Date();
      const row = [
        tab.title || 'Untitled',
        content,
        tab.url,
        this.userTags.join(', '),  // Only user tags
        now.toISOString(), // Full timestamp for accurate ordering
        pageImage,
        price // Price column
      ];

      // Use current sheet name or default to 'My quotes'
      const sheetName = this.currentSheetName || 'My quotes';
      const escapedSheetName = `'${sheetName.replace(/'/g, "''")}'`;

      const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}/values/${escapedSheetName}!A:G:append?valueInputOption=RAW`, {
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
        const responseData = await response.json();
        
        // Store only spreadsheet ID (Chrome Identity API handles tokens)
        await chrome.storage.local.set({
          googleSpreadsheetId: this.spreadsheetId
        });
        
        // Show saved state with animation
        this.showSavedState();

        // Clear content and reset
        document.getElementById('content').value = 'Select text on the webpage to capture it here...';
        this.userTags = [];
        this.renderUserTags();
        this.selectedImageIndices.clear();
        this.renderImageCarousel();
        
      } else {
        const errorData = await response.json();
        console.error('Save failed:', errorData);
        this.showSaveButtonStatus(`Save failed: ${errorData.error?.message || 'Unknown error'}`, 'error');
      }

    } catch (error) {
      this.showSaveButtonStatus(`Error: ${error.message}`, 'error');
    } finally {
      document.getElementById('save-button').disabled = false;
    }
  }

  async updateExistingQuote() {
    try {
      const content = document.getElementById('content').value;
      const titlePreview = document.getElementById('preview-title').textContent;
      const urlPreview = document.getElementById('preview-url').textContent;
      
      // Get the current tab for image
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      let pageImage = this.getSelectedImageUrl();
      
      // Get price from input field
      const priceInput = document.getElementById('price-input');
      const price = priceInput ? priceInput.value.trim() : '';
      
      const now = new Date();
      const row = [
        titlePreview,
        content,
        urlPreview,
        this.userTags.join(', '),
        now.toISOString(),
        pageImage,
        price // Price column
      ];
      
      // Use current sheet name or default to 'My quotes'
      const sheetName = this.currentSheetName || 'My quotes';
      const escapedSheetName = `'${sheetName.replace(/'/g, "''")}'`;
      
      // First, add the new row
      const addResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}/values/${escapedSheetName}!A:G:append?valueInputOption=RAW`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [row]
        })
      });
      
      if (addResponse.ok) {
        // Now delete the old row using the same method as the existing delete function
        const oldRowNumber = this.editingCardId + 2; // originalRowIndex + 2 (row 1 has headers)
        
        // First, get the correct sheet ID from the spreadsheet metadata
        const metadataResponse = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}?fields=sheets.properties`,
          {
            headers: {
              Authorization: `Bearer ${this.accessToken}`,
            },
          }
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
        
        const deleteResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}:batchUpdate`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            requests: [{
              deleteDimension: {
                range: {
                  sheetId: sheetId,
                  dimension: 'ROWS',
                  startIndex: oldRowNumber - 1, // Convert to 0-based index for API
                  endIndex: oldRowNumber // endIndex is exclusive
                }
              }
            }]
          })
        });
        
        if (deleteResponse.ok) {
          this.showSaveButtonStatus('Quote updated!', 'success');
        } else {
          this.showSaveButtonStatus('Quote updated (old row not deleted)', 'success');
        }
        
        // Reset edit mode
        this.isEditMode = false;
        this.editingCardId = null;
        
        // Reset button text
        const submitButton = document.getElementById('save-button');
        if (submitButton) {
          submitButton.textContent = 'Save Quote';
          submitButton.style.backgroundColor = '';
        }
        
        // Clear the form
        document.getElementById('content').value = '';
        document.getElementById('tag-input').value = '';
        this.userTags = [];
        this.renderUserTags();
        this.selectedImageIndices.clear();
        this.renderImageCarousel();
        const priceInput = document.getElementById('price-input');
        const priceLabel = document.getElementById('price-label');
        const priceToggleBtn = document.getElementById('price-toggle-btn');
        if (priceInput && priceLabel && priceToggleBtn) {
          priceInput.value = '';
          // Reset price input/label visibility - hide them, show toggle button
          priceInput.classList.add('hidden');
          priceLabel.classList.add('hidden');
          priceLabel.style.opacity = '1';
          priceToggleBtn.style.display = '';
        }
        
        // Close the popup after successful update and refresh the fullpage
        setTimeout(() => {
          // Send message to fullpage to refresh
          chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            if (tabs[0]) {
              chrome.tabs.sendMessage(tabs[0].id, {action: 'refreshContent'});
            }
          });
          window.close();
        }, 1000);
        
      } else {
        const errorData = await addResponse.json();
        this.showSaveButtonStatus(`Update failed: ${errorData.error?.message || 'Unknown error'}`, 'error');
      }
      
    } catch (error) {
      console.error('Error updating quote:', error);
      this.showSaveButtonStatus(`Error: ${error.message}`, 'error');
    } finally {
      document.getElementById('save-button').disabled = false;
    }
  }

  showAuthInterface() {
    const authSection = document.getElementById('auth-section');
    const mainSection = document.getElementById('main-section');

    if (authSection) {
      authSection.classList.remove('hidden');
      authSection.style.display = 'block';
    }
    if (mainSection) {
      mainSection.classList.remove('active');
      mainSection.style.display = 'none';
    }
  }

  showMainInterface() {
    const authSection = document.getElementById('auth-section');
    const mainSection = document.getElementById('main-section');
    const mainLoading = document.getElementById('main-loading');
    const contentSection = document.querySelector('.content-section');
    const tagsSection = document.querySelector('.tags-section');
    const contentPreview = document.querySelector('.content-preview');
    const imageSelector = document.getElementById('image-selector');
    const actions = document.querySelector('.actions');

    if (authSection) {
      authSection.classList.add('hidden');
      authSection.style.display = 'none';
    }
    if (mainSection) {
      mainSection.classList.add('active');
      mainSection.style.display = 'block';
    }

    // Hide loading indicator and show all form content
    if (mainLoading) {
      mainLoading.classList.add('hidden');
    }
    if (contentSection) contentSection.style.display = '';
    if (tagsSection) tagsSection.style.display = '';
    if (contentPreview) contentPreview.style.display = '';
    // imageSelector stays hidden by default, shown by JS when there are images
    if (actions) actions.style.display = '';
  }

  showStatus(message, type) {
    const status = document.getElementById('status');
    status.textContent = message;
    status.className = `status ${type}`;
    status.classList.remove('hidden');

    if (type === 'success') {
      setTimeout(() => {
        status.classList.add('hidden');
      }, 3000);
    }
  }

  showStatusMain(message, type) {
    const status = document.getElementById('status-main');
    status.textContent = message;
    status.className = `status ${type}`;
    status.classList.remove('hidden');

    if (type === 'success') {
      setTimeout(() => {
        status.classList.add('hidden');
      }, 3000);
    }
  }

  showSaveButtonStatus(message, type) {
    const button = document.getElementById('save-button');
    const buttonText = document.getElementById('save-button-text');
    const buttonStatus = document.getElementById('save-button-status');
    
    // Reset button classes
    button.classList.remove('saving', 'saved', 'centered');
    
    if (type === 'saving') {
      button.classList.add('saving');
      buttonText.style.display = 'none';
      buttonStatus.classList.remove('hidden');
      buttonStatus.textContent = message;
    } else if (type === 'error') {
      buttonText.style.display = 'inline';
      buttonStatus.classList.add('hidden');
      buttonText.textContent = 'Save';
      // Show error in status for a moment
      buttonStatus.classList.remove('hidden');
      buttonStatus.textContent = message;
      buttonStatus.style.color = '#ef4444';
      setTimeout(() => {
        buttonStatus.classList.add('hidden');
        buttonStatus.style.color = '';
      }, 3000);
    } else {
      // Reset to normal state
      buttonText.style.display = 'inline';
      buttonStatus.classList.add('hidden');
      buttonText.textContent = 'Save';
    }
  }

  resetSavedState() {
    // Hide saved state container
    const savedStateContainer = document.getElementById('saved-state-container');
    if (savedStateContainer) {
      savedStateContainer.classList.add('hidden');
      savedStateContainer.style.display = 'none';
      savedStateContainer.style.opacity = '0';
    }

    // Remove content-hidden classes to show form sections again
    const contentSection = document.querySelector('.content-section');
    const tagsSection = document.querySelector('.tags-section');
    const contentPreview = document.querySelector('.content-preview');
    const imageSelector = document.getElementById('image-selector');
    const actions = document.querySelector('.actions');

    if (contentSection) contentSection.classList.remove('content-hidden');
    if (tagsSection) tagsSection.classList.remove('content-hidden');
    if (contentPreview) contentPreview.classList.remove('content-hidden');
    if (imageSelector) imageSelector.classList.remove('content-hidden');
    if (actions) actions.classList.remove('content-hidden');
  }

  showMainLoading() {
    const mainSection = document.getElementById('main-section');
    const mainLoading = document.getElementById('main-loading');
    const contentSection = document.querySelector('.content-section');
    const tagsSection = document.querySelector('.tags-section');
    const contentPreview = document.querySelector('.content-preview');
    const imageSelector = document.getElementById('image-selector');
    const actions = document.querySelector('.actions');

    // Show main section
    if (mainSection) {
      mainSection.classList.add('active');
      mainSection.style.display = 'block';
    }

    // Show only the loading indicator, hide all form content
    if (mainLoading) {
      mainLoading.classList.remove('hidden');
    }
    if (contentSection) contentSection.style.display = 'none';
    if (tagsSection) tagsSection.style.display = 'none';
    if (contentPreview) contentPreview.style.display = 'none';
    if (imageSelector) imageSelector.style.display = 'none';
    if (actions) actions.style.display = 'none';
  }

  showSavedState() {
    const button = document.getElementById('save-button');
    const savedStateContainer = document.getElementById('saved-state-container');
    const mainSection = document.getElementById('main-section');

    if (!savedStateContainer) {
      console.error('Saved state container not found');
      return;
    }

    // Start the transition by hiding the original content with smooth animation
    const contentSection = document.querySelector('.content-section');
    const tagsSection = document.querySelector('.tags-section');
    const contentPreview = document.querySelector('.content-preview');
    const imageSelector = document.getElementById('image-selector');
    const actions = document.querySelector('.actions');

    // Add transition classes to fade out content
    if (contentSection) contentSection.classList.add('content-hidden');
    if (tagsSection) tagsSection.classList.add('content-hidden');
    if (contentPreview) contentPreview.classList.add('content-hidden');
    if (imageSelector) imageSelector.classList.add('content-hidden');
    if (actions) actions.classList.add('content-hidden');

    // Show the saved state container after content fades out
    setTimeout(() => {
      if (savedStateContainer) {
        savedStateContainer.classList.remove('hidden');
        savedStateContainer.style.display = 'flex';
        // Force animation to trigger by setting opacity after display is set
        setTimeout(() => {
          if (savedStateContainer) {
            savedStateContainer.style.opacity = '1';
          }
        }, 10);
      }
    }, 400);
  }

  initTooltips() {
    try {
      const icons = document.querySelectorAll('.header-icon[title], .header-icon[data-tooltip], .header-icon-with-text[title]');
      let tooltip = null;
      let hideTimeout = null;

      icons.forEach(icon => {
        icon.addEventListener('mouseenter', (e) => {
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
        const tooltipText = e.currentTarget.getAttribute('data-tooltip') || e.currentTarget.getAttribute('title');
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

      icon.addEventListener('mouseleave', () => {
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
    } catch (error) {
      console.error('Error initializing tooltips:', error);
    }
  }

  setupImageCarousel() {
    const prevBtn = document.getElementById('carousel-prev');
    const nextBtn = document.getElementById('carousel-next');

    if (prevBtn) {
      prevBtn.addEventListener('click', () => this.previousImages());
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', () => this.nextImages());
    }
  }

  showImageSelector() {
    if (this.pageImages.length > 0) {
      const imageSelector = document.getElementById('image-selector');
      if (imageSelector) {
        imageSelector.classList.remove('hidden');
        this.renderImageCarousel();
      }
    }
  }

  hideImageSelector() {
    const imageSelector = document.getElementById('image-selector');
    if (imageSelector) {
      imageSelector.classList.add('hidden');
    }
  }

  renderImageCarousel() {
    const container = document.getElementById('image-options');
    const prevBtn = document.getElementById('carousel-prev');
    const nextBtn = document.getElementById('carousel-next');
    const noImageIndicator = document.getElementById('no-image-indicator');
    
    // Show/hide "No image selected" indicator and update count
    if (noImageIndicator) {
      const selectedCount = this.selectedImageIndices.size;
      // Always show the indicator when image selector is visible
      noImageIndicator.classList.remove('hidden');
      if (selectedCount === 0) {
        noImageIndicator.textContent = 'No image selected';
      } else {
        noImageIndicator.textContent = `${selectedCount} image${selectedCount === 1 ? '' : 's'} selected`;
      }
    }
    
    // Show 4 images at a time (more fits with larger thumbnails)
    const visibleCount = 4;
    const startIndex = this.carouselStartIndex;
    const endIndex = Math.min(startIndex + visibleCount, this.pageImages.length);
    
    container.innerHTML = '';
    
    for (let i = startIndex; i < endIndex; i++) {
      const img = document.createElement('img');
      img.src = this.pageImages[i].src;
      img.alt = this.pageImages[i].alt;
      img.className = 'image-option';
      if (this.selectedImageIndices.has(i)) {
        img.classList.add('selected');
      }
      
      img.addEventListener('click', () => {
        // Toggle selection: add if not selected, remove if already selected
        if (this.selectedImageIndices.has(i)) {
          this.selectedImageIndices.delete(i);
        } else {
          this.selectedImageIndices.add(i);
        }
        this.renderImageCarousel();
      });
      
      container.appendChild(img);
    }
    
    // Show/hide buttons based on whether they're needed
    if (startIndex === 0) {
      prevBtn.style.display = 'none';
    } else {
      prevBtn.style.display = 'flex';
      prevBtn.disabled = false;
    }

    if (endIndex >= this.pageImages.length) {
      nextBtn.style.display = 'none';
    } else {
      nextBtn.style.display = 'flex';
      nextBtn.disabled = false;
    }
  }

  previousImages() {
    if (this.carouselStartIndex > 0) {
      this.carouselStartIndex = Math.max(0, this.carouselStartIndex - 4);
      this.renderImageCarousel();
    }
  }

  nextImages() {
    if (this.carouselStartIndex + 4 < this.pageImages.length) {
      this.carouselStartIndex = Math.min(this.pageImages.length - 4, this.carouselStartIndex + 4);
      this.renderImageCarousel();
    }
  }

  getSelectedImageUrl() {
    if (this.selectedImageIndices.size === 0) {
      return ''; // No images selected
    }
    
    // Get selected image URLs and join with triple pipe delimiter
    const selectedUrls = Array.from(this.selectedImageIndices)
      .sort((a, b) => a - b) // Sort by index to maintain order
      .map(index => this.pageImages[index].src)
      .filter(url => url); // Filter out any undefined URLs
    
    return selectedUrls.join('|||'); // Return pipe-delimited URLs (||| is unlikely in URLs)
  }

  // Tag Pills Autocomplete Methods
  setupTagAutocomplete() {
    const tagInput = document.getElementById('tag-input');
    const pillsContainer = document.getElementById('tag-pills-container');


    if (!tagInput || !pillsContainer) {
      console.error('Tag input or pills container not found!');
      return;
    }

    // Show pills initially if there are tags
    if (this.existingTags.length > 0) {
      this.renderTagPills();
      pillsContainer.style.display = 'flex';
    }

    // Filter tags as user types
    tagInput.addEventListener('input', (e) => {
      this.filterTagPills(e.target.value);
    });
  }

  renderTagPills(filteredTags = null) {
    const pillsContainer = document.getElementById('tag-pills-container');
    if (!pillsContainer) return;

    const tagsToShow = filteredTags || this.existingTags;
    const tagInput = document.getElementById('tag-input');
    
    // Get currently added tags from input (split by comma, trim, filter empty)
    const currentTags = tagInput ? 
      tagInput.value.split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0) : [];

    pillsContainer.innerHTML = '';

    tagsToShow.forEach(tag => {
      // Skip tags already added to input
      if (currentTags.includes(tag)) return;

      const pill = document.createElement('div');
      pill.className = 'tag-pill';
      pill.textContent = tag;
      
      pill.addEventListener('click', () => {
        this.addTagFromPill(tag);
      });
      
      pillsContainer.appendChild(pill);
    });

    // Show message if no tags to display
    if (pillsContainer.children.length === 0) {
      const noTagsMsg = document.createElement('div');
      noTagsMsg.style.cssText = 'color: #6b7280; font-size: 12px; padding: 8px;';
      if (filteredTags && filteredTags.length === 0) {
        noTagsMsg.textContent = 'No matching tags found';
      } else if (currentTags.length > 0 && tagsToShow.every(tag => currentTags.includes(tag))) {
        noTagsMsg.textContent = 'All available tags are already added';
      } else {
        noTagsMsg.textContent = 'No tags available';
      }
      pillsContainer.appendChild(noTagsMsg);
    }
  }

  filterTagPills(inputValue) {
    // Show all tags if input is empty or just whitespace
    if (!inputValue || inputValue.trim() === '') {
      this.renderTagPills();
      return;
    }

    const tags = inputValue.split(',');
    const currentTag = tags[tags.length - 1].trim().toLowerCase();

    if (currentTag.length === 0) {
      // Show all available tags when no current filter
      this.renderTagPills();
      return;
    }

    // Filter tags that contain the current input (autocomplete behavior)
    const filteredTags = this.existingTags.filter(tag => 
      tag.toLowerCase().includes(currentTag)
    );

    this.renderTagPills(filteredTags);

    // Highlight matching pills
    const pills = document.querySelectorAll('.tag-pill');
    pills.forEach(pill => {
      if (pill.textContent.toLowerCase().includes(currentTag)) {
        pill.classList.add('filtered');
      } else {
        pill.classList.remove('filtered');
      }
    });
  }

  addTagFromPill(selectedTag) {
    const tagInput = document.getElementById('tag-input');
    const pillsContainer = document.getElementById('tag-pills-container');
    if (!tagInput) return;

    const currentValue = tagInput.value;
    const tags = currentValue.split(',').map(t => t.trim());
    
    // Check if we're replacing an incomplete tag or adding a new one
    const lastTag = tags[tags.length - 1];
    
    if (lastTag === '' || currentValue.endsWith(',')) {
      // Adding a new tag (input ends with comma or is empty)
      tags[tags.length - 1] = selectedTag;
    } else {
      // Replacing the last incomplete tag
      tags[tags.length - 1] = selectedTag;
    }
    
    // Set value with comma and space for next tag, keep cursor ready
    tagInput.value = tags.filter(t => t).join(', ') + ', ';
    
    // Keep pills visible and update them with the new input state
    if (pillsContainer) {
      pillsContainer.style.display = 'flex';
    }
    
    // Re-render pills with updated input to show remaining options
    this.filterTagPills(tagInput.value);
    
    // Keep focus on input for continued typing
    tagInput.focus();
  }
}

// Initialize the extension
new EnhancedQuoteCollector();