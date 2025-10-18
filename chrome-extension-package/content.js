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
    
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const contents = range.cloneContents();
      
      // Convert the selection to text while preserving line breaks
      let text = '';
      
      // Walk through all nodes in the selection
      const walker = document.createTreeWalker(
        contents,
        NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
        null,
        false
      );
      
      let node;
      while (node = walker.nextNode()) {
        if (node.nodeType === Node.TEXT_NODE) {
          text += node.textContent;
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          // Add line breaks for block elements and <br> tags
          const tagName = node.tagName.toLowerCase();
          if (tagName === 'br') {
            text += '\n';
          } else if (['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote', 'pre'].includes(tagName)) {
            // Add line break before block elements (except if it's the first element)
            if (text.length > 0 && !text.endsWith('\n')) {
              text += '\n';
            }
          }
        }
      }
      
      // Clean up the text: remove extra whitespace but preserve intentional line breaks
      text = text.replace(/\r\n/g, '\n')  // Normalize line endings
                 .replace(/\r/g, '\n')    // Convert old Mac line endings
                 .replace(/[ \t]+/g, ' ') // Collapse multiple spaces/tabs to single space
                 .replace(/[ \t]*\n[ \t]*/g, '\n') // Remove spaces around line breaks
                 .replace(/\n{3,}/g, '\n\n') // Limit consecutive line breaks to max 2
                 .trim();

      if (text.length > 0) {
        this.selectedText = text;
      }
    }
  }

  getPageMetadata() {
    const metadata = {
      title: document.title || 'Untitled Page',
      url: window.location.href,
      domain: window.location.hostname,
      description: '',
      image: '',
      images: []
    };

    // Get meta description
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metadata.description = metaDescription.getAttribute('content') || '';
    }

    // No automatic image extraction from meta tags
    // Users must explicitly select images from the carousel

    // Extract page images
    metadata.images = this.extractPageImages();
    
    return metadata;
  }

  extractPageImages() {
    const images = [];
    const imgElements = document.querySelectorAll('img[src]');
    
    Array.from(imgElements).forEach(img => {
      // Get absolute URL for relative paths
      let imgSrc = img.src;
      if (!imgSrc.startsWith('http')) {
        // Convert relative URLs to absolute
        imgSrc = new URL(img.src, window.location.href).href;
      }
      
      // Filter for meaningful images with more relaxed criteria
      if (img.width > 50 && img.height > 50 && // Reduced size requirement
          !imgSrc.includes('data:') && 
          !imgSrc.includes('/favicon') && // More specific exclusions
          !imgSrc.includes('icon-') &&
          !imgSrc.includes('logo-') &&
          imgSrc.startsWith('http')) {
        
        images.push({
          src: imgSrc,
          alt: img.alt || '',
          width: img.width,
          height: img.height
        });
      }
    });
    
    // Remove duplicates and limit to 6 images
    const uniqueImages = images.filter((img, index, arr) => 
      arr.findIndex(i => i.src === img.src) === index
    );
    
    return uniqueImages.slice(0, 6);
  }
}

// Initialize content script
new WebCaptureContent();