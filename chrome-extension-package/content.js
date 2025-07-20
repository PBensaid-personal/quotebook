// Content script for text selection and page interaction
class WebCaptureContent {
  constructor() {
    this.selectedText = '';
    this.init();
  }

  init() {
    // Listen for text selection
    document.addEventListener('mouseup', () => {
      this.handleTextSelection();
    });

    // Listen for messages from popup
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'getSelectedText') {
        sendResponse({ selectedText: this.selectedText });
        return true; // Keep message channel open for async response
      }
    });
  }

  handleTextSelection() {
    const selection = window.getSelection();
    const text = selection.toString().trim();
    
    if (text.length > 0) {
      this.selectedText = text;
      
      // Show a subtle indicator that text was captured
      this.showSelectionFeedback();
    }
  }

  showSelectionFeedback() {
    // Remove any existing feedback
    const existing = document.getElementById('webcapture-feedback');
    if (existing) {
      existing.remove();
    }

    // Create feedback element
    const feedback = document.createElement('div');
    feedback.id = 'webcapture-feedback';
    feedback.innerHTML = '✓ Text captured - Click extension to save';
    feedback.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #1a1f36;
      color: white;
      padding: 8px 16px;
      border-radius: 6px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 13px;
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      border: 1px solid #4F7CAC;
      animation: slideIn 0.3s ease-out;
    `;

    // Add slide-in animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);

    document.body.appendChild(feedback);

    // Remove after 3 seconds
    setTimeout(() => {
      if (feedback.parentNode) {
        feedback.style.animation = 'slideIn 0.3s ease-out reverse';
        setTimeout(() => feedback.remove(), 300);
      }
    }, 3000);
  }
}

// Initialize content script
new WebCaptureContent();