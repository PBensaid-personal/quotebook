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

  // Helper: Get absolute URL
  getAbsoluteUrl(url) {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    if (url.startsWith('//')) return 'https:' + url;

    try {
      return new URL(url, window.location.href).href;
    } catch {
      return null;
    }
  }

  extractPageImages() {
    const images = [];
    const imgElements = document.querySelectorAll('img');

    Array.from(imgElements).forEach((img) => {
      // Try multiple sources in priority order
      let imgSrc = img.currentSrc || // Current source (respects srcset)
                   img.src ||
                   img.dataset.src ||
                   img.dataset.lazySrc ||
                   img.dataset.original ||
                   img.getAttribute('data-lazy-src') ||
                   img.getAttribute('data-original');

      imgSrc = this.getAbsoluteUrl(imgSrc);

      if (!imgSrc) return;

      // Get dimensions - wait for naturalWidth if image is loaded
      let width = img.naturalWidth || img.width || 0;
      let height = img.naturalHeight || img.height || 0;

      // If dimensions are 0, try getting from attributes or computed style
      if (width === 0 || height === 0) {
        width = parseInt(img.getAttribute('width')) || img.clientWidth || 0;
        height = parseInt(img.getAttribute('height')) || img.clientHeight || 0;
      }

      // If still no dimensions, assume reasonable size to include it
      if (width === 0 && height === 0) {
        width = 800;
        height = 600;
      } else if (width === 0) {
        width = height; // Make it square
      } else if (height === 0) {
        height = width; // Make it square
      }

      // Basic filters
      if (width < 100 || height < 100) return;
      if (imgSrc.includes('data:image')) return;
      if (!imgSrc.startsWith('http')) return;

      // Filter out common UI elements by URL patterns
      const srcLower = imgSrc.toLowerCase();
      if (srcLower.includes('logo') ||
          srcLower.includes('icon') ||
          srcLower.includes('sprite') ||
          srcLower.includes('favicon')) return;

      images.push({
        src: imgSrc,
        alt: img.alt || '',
        width: width,
        height: height,
        area: width * height
      });
    });

    // Remove exact duplicates
    const uniqueImages = images.filter((img, index, arr) =>
      arr.findIndex(i => i.src === img.src) === index
    );

    // Sort by pixel area (largest first) and take top 12
    uniqueImages.sort((a, b) => b.area - a.area);

    return uniqueImages.slice(0, 12).map(img => ({
      src: img.src,
      alt: img.alt,
      width: img.width,
      height: img.height
    }));
  }
}

// Initialize content script
new WebCaptureContent();