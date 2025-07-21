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
        return true;
      }
      if (request.action === 'getPageMetadata') {
        sendResponse(this.getPageMetadata());
        return true;
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

  getPageMetadata() {
    const metadata = {
      title: document.title || 'Untitled Page',
      url: window.location.href,
      domain: window.location.hostname,
      description: '',
      image: '',
      categories: []
    };

    // Get meta description
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metadata.description = metaDescription.getAttribute('content') || '';
    }

    // Get Open Graph image or first meaningful image
    let ogImage = document.querySelector('meta[property="og:image"]');
    if (!ogImage) {
      ogImage = document.querySelector('meta[name="twitter:image"]');
    }
    if (ogImage) {
      metadata.image = ogImage.getAttribute('content') || '';
    } else {
      // Get first meaningful image
      const firstImage = document.querySelector('img[src]:not([src^="data:"]):not([width="1"]):not([height="1"]):not([alt=""])');
      if (firstImage && firstImage.src) {
        metadata.image = firstImage.src;
      }
    }

    // Extract categories from various sources
    const categories = new Set();
    
    // From meta keywords
    const keywords = document.querySelector('meta[name="keywords"]');
    if (keywords) {
      const keywordList = keywords.getAttribute('content').split(',').map(k => k.trim()).slice(0, 5);
      keywordList.forEach(k => categories.add(k));
    }
    
    // From article tags, categories, or labels
    const tagElements = document.querySelectorAll('[class*="tag"], [class*="category"], [class*="label"], .tags a, .categories a');
    Array.from(tagElements).slice(0, 5).forEach(tag => {
      const text = tag.textContent?.trim();
      if (text && text.length < 30 && text.length > 2) {
        categories.add(text);
      }
    });
    
    // From structured data or JSON-LD
    const jsonLd = document.querySelector('script[type="application/ld+json"]');
    if (jsonLd) {
      try {
        const data = JSON.parse(jsonLd.textContent);
        if (data.keywords) {
          const keywords = Array.isArray(data.keywords) ? data.keywords : data.keywords.split(',');
          keywords.slice(0, 3).forEach(k => categories.add(k.trim()));
        }
      } catch (e) {
        // Ignore JSON parsing errors
      }
    }
    
    // From breadcrumbs
    const breadcrumbs = document.querySelectorAll('[class*="breadcrumb"] a, nav a');
    Array.from(breadcrumbs).slice(1, 4).forEach(crumb => {
      const text = crumb.textContent?.trim();
      if (text && text.length < 25 && text.length > 2) {
        categories.add(text);
      }
    });
    
    metadata.categories = Array.from(categories).slice(0, 5);
    
    return metadata;
  }
}

// Initialize content script
new WebCaptureContent();