// Content script for text selection and page interaction
class WebCaptureContent {
  constructor() {
    this.selectedText = '';
    this.init();
  }

  init() {
    document.addEventListener('mouseup', () => {
      this.handleTextSelection();
    });

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'getSelectedText') {
        sendResponse({ selectedText: this.selectedText });
        return true;
      }
    });
  }

  handleTextSelection() {
    const selection = window.getSelection();
    const text = selection.toString().trim();

    if (text.length > 0) {
      this.selectedText = text;
      this.showSelectionFeedback();
    }
  }

  showSelectionFeedback() {
    const existing = document.getElementById('webcapture-feedback');
    if (existing) {
      existing.remove();
    }

    const feedback = document.createElement('div');
    feedback.id = 'webcapture-feedback';
    feedback.innerHTML = '✓ Text captured - Click extension to save';

    document.body.appendChild(feedback);

    setTimeout(() => {
      if (feedback.parentNode) {
        feedback.style.animation = 'slideIn 0.3s ease-out reverse';
        setTimeout(() => feedback.remove(), 300);
      }
    }, 3000);
  }
}

new WebCaptureContent();