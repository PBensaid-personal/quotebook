// Web Popup Simulator - Simulates Chrome extension popup functionality
class PopupSimulator {
  constructor() {
    this.clientId = 'demo-client-id';
    this.accessToken = null;
    this.spreadsheetId = 'demo-spreadsheet-id';
    this.userTags = [];
    this.suggestedTags = [];
    this.init();
  }

  async init() {
    this.setupEventListeners();
    await this.simulateAuthCheck();
    await this.loadSelectedText();
    this.setupTagInterface();
  }

  setupEventListeners() {
    document.getElementById('auth-button').addEventListener('click', () => {
      this.simulateAuthentication();
    });

    document.getElementById('save-button').addEventListener('click', () => {
      this.simulateSaveQuote();
    });

    document.getElementById('cancel-button').addEventListener('click', () => {
      this.closeWindow();
    });

    document.getElementById('view-all-button').addEventListener('click', () => {
      window.open('fullpage-simulator.html', '_blank');
    });

    // Header brand opens full page view
    document.getElementById('header-brand').addEventListener('click', (e) => {
      e.preventDefault();
      window.open('fullpage-simulator.html', '_blank');
    });

    // No pin functionality in web simulator
  }

  setupTagInterface() {
    this.userTags = [];
    this.renderUserTags();
  }

  renderUserTags() {
    const container = document.getElementById('user-tags');
    container.innerHTML = '';

    this.userTags.forEach((tag, index) => {
      const tagElement = document.createElement('span');
      tagElement.className = 'user-tag';
      tagElement.innerHTML = `
        ${this.escapeHtml(tag)}
        <button class="remove-tag" data-index="${index}">×</button>
      `;
      container.appendChild(tagElement);
    });

    // Add event listeners for remove buttons
    document.querySelectorAll('.remove-tag').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.target.getAttribute('data-index'));
        this.userTags.splice(index, 1);
        this.renderUserTags();
      });
    });
  }

  async simulateAuthCheck() {
    // Simulate checking existing authentication
    console.log("Simulating auth check...");
    
    // Simulate having authentication
    this.accessToken = 'demo-access-token';
    this.spreadsheetId = 'demo-spreadsheet-id';
    
    this.showAuthenticatedState();
  }

  async simulateAuthentication() {
    console.log("Simulating Google authentication...");
    
    // Show loading state
    const authButton = document.getElementById('auth-button');
    authButton.textContent = 'Connecting...';
    authButton.disabled = true;

    // Simulate delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Simulate successful auth
    this.accessToken = 'demo-access-token';
    this.spreadsheetId = 'demo-spreadsheet-id';
    
    this.showAuthenticatedState();
  }

  showAuthenticatedState() {
    document.getElementById('auth-required').style.display = 'none';
    document.getElementById('main-interface').style.display = 'block';
  }

  async loadSelectedText() {
    // Simulate text selection from current page
    const simulatedContent = "This is simulated selected text from the current webpage.";
    const simulatedUrl = window.location.href;
    const simulatedTitle = document.title;

    document.getElementById('content-text').value = simulatedContent;
    document.getElementById('title-input').value = simulatedTitle;
    document.getElementById('url-display').textContent = simulatedUrl;

    // Simulate suggested tags
    this.suggestedTags = ['web-demo', 'simulation', 'quotebook'];
    this.renderSuggestedTags();
  }

  renderSuggestedTags() {
    const container = document.getElementById('suggested-tags');
    container.innerHTML = '';

    this.suggestedTags.forEach(tag => {
      const tagElement = document.createElement('span');
      tagElement.className = 'suggested-tag';
      tagElement.textContent = tag;
      tagElement.addEventListener('click', () => {
        if (!this.userTags.includes(tag)) {
          this.userTags.push(tag);
          this.renderUserTags();
        }
      });
      container.appendChild(tagElement);
    });
  }

  async simulateSaveQuote() {
    const content = document.getElementById('content-text').value.trim();
    const title = document.getElementById('title-input').value.trim();
    const url = document.getElementById('url-display').textContent;

    if (!content) {
      this.showMessage('Please enter some content to save.', 'error');
      return;
    }

    // Show saving state
    const saveButton = document.getElementById('save-button');
    const originalText = saveButton.textContent;
    saveButton.textContent = 'Saving...';
    saveButton.disabled = true;

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Simulate successful save
    console.log('Simulating quote save:', {
      title,
      content,
      url,
      tags: this.userTags,
      timestamp: new Date().toISOString()
    });

    this.showMessage('Quote saved successfully! (Simulated)', 'success');

    // Reset button
    saveButton.textContent = originalText;
    saveButton.disabled = false;

    // Clear form
    setTimeout(() => {
      this.clearForm();
    }, 1500);
  }

  clearForm() {
    document.getElementById('content-text').value = '';
    document.getElementById('title-input').value = '';
    this.userTags = [];
    this.renderUserTags();
  }

  showMessage(message, type = 'info') {
    // Create toast notification
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 10000;
      font-size: 14px;
      animation: slideIn 0.3s ease-out;
      max-width: 300px;
    `;

    document.body.appendChild(toast);

    // Auto remove
    setTimeout(() => {
      if (toast.parentNode) {
        toast.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => {
          if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
          }
        }, 300);
      }
    }, 3000);
  }

  closeWindow() {
    // In real extension this would close popup, in web version go back
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = 'index.html';
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Add CSS animations
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
  
  @keyframes slideOut {
    from {
      opacity: 1;
      transform: translateX(0);
    }
    to {
      opacity: 0;
      transform: translateX(100%);
    }
  }
`;
document.head.appendChild(style);

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new PopupSimulator();
});