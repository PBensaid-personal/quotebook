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