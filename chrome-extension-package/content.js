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
      images: [],
      price: ''
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

    // Extract price
    metadata.price = this.extractPrice();

    return metadata;
  }

  extractPrice() {
    // 1. JSON-LD structured data (most reliable)
    try {
      const scripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (const script of scripts) {
        try {
          const data = JSON.parse(script.textContent);
          // Handle single object or array of objects
          const items = Array.isArray(data) ? data : [data];

          for (const item of items) {
            // Check for Product schema with offers
            if (item['@type'] === 'Product' && item.offers) {
              const offer = Array.isArray(item.offers) ? item.offers[0] : item.offers;
              if (offer.price) {
                const currency = offer.priceCurrency || '$';
                const price = offer.price.toString();
                // Format the price with currency
                if (currency === 'USD') {
                  return '$' + price;
                } else if (currency === 'EUR') {
                  return price + ' €';
                } else if (currency === 'GBP') {
                  return '£' + price;
                } else {
                  return price + ' ' + currency;
                }
              }
            }
          }
        } catch (e) {
          // Skip invalid JSON
        }
      }
    } catch (e) {
      // Continue to next method
    }

    // 2. Structured data (schema.org microdata) - also reliable
    const schemaPrice = document.querySelector('[itemprop="price"]');
    if (schemaPrice) {
      const content = schemaPrice.getAttribute('content') || schemaPrice.textContent.trim();
      const price = this.parsePrice(content);
      if (price) return price;
    }

    // 2. Etsy-specific selectors
    if (window.location.hostname.includes('etsy')) {
      const etsySelectors = [
        '[data-buy-box-region-price]',
        'p[class*="wt-text-title"]',
        '.wt-text-title-01',
        '.wt-text-title-03',
        'p.wt-text-title-larger',
        '[data-selector="price"]',
        'p[data-buy-box-region="price"]'
      ];

      for (const selector of etsySelectors) {
        try {
          const el = document.querySelector(selector);
          if (el) {
            const text = el.textContent.trim();
            const price = this.parsePrice(text);
            if (price) return price;
          }
        } catch (e) {
          // Skip if selector fails
        }
      }
    }

    // 3. Amazon-specific: combine whole and fraction
    if (window.location.hostname.includes('amazon')) {
      const whole = document.querySelector('.a-price-whole');
      const fraction = document.querySelector('.a-price-fraction');
      if (whole) {
        const wholeText = whole.textContent.trim().replace(/[^\d.,]/g, '');
        const fractionText = fraction ? fraction.textContent.trim() : '';
        if (wholeText) {
          const combined = '$' + wholeText + (fractionText ? '.' + fractionText : '');
          const price = this.parsePrice(combined);
          if (price) return price;
        }
      }
    }

    // 4. Common selectors: data attributes and classes with "price"
    const selectors = [
      '[data-price]',
      '[data-selector*="price" i]',
      '[class*="price" i]',
      '.price',
      '.a-price'
    ];

    for (const selector of selectors) {
      try {
        const elements = document.querySelectorAll(selector);
        for (const el of elements) {
          // Check data-price attribute first
          if (el.hasAttribute('data-price')) {
            const price = this.parsePrice(el.getAttribute('data-price'));
            if (price) return price;
          }
          // Check text content
          const text = el.textContent.trim();
          if (text) {
            const price = this.parsePrice(text);
            if (price) return price;
          }
        }
      } catch (e) {
        // Skip unsupported selectors
      }
    }

    // 5. Fallback: regex search page text (fast and catches everything)
    const pageText = document.body.textContent || '';
    const priceMatch = pageText.match(/\$[\d,]+\.?\d{0,2}/);
    if (priceMatch) {
      return this.parsePrice(priceMatch[0]);
    }

    return '';
  }

  parsePrice(text) {
    if (!text) return '';

    // Clean up the text
    text = text.replace(/price[:\s]*/gi, '').trim();

    // Extract number with currency symbol
    // Match patterns like: $99.99, €1,234.56, £99, 99.99 USD, CA$99.99
    const patterns = [
      /([A-Z]{2})?([$€£¥])\s*([\d,]+\.?\d{0,2})/,  // CA$99.99, $99.99, €1,234.56
      /([$€£¥])\s*([\d,]+\.?\d{0,2})/,  // $99.99, €1,234.56
      /([\d,]+\.?\d{0,2})\s*([A-Z]{3})/i  // 99.99 USD
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        // Handle different match group configurations
        if (match[3]) {
          // Pattern 1: CA$99.99 (country code + currency + amount)
          const countryCode = match[1] || '';
          const currency = match[2];
          const amount = match[3].replace(/,/g, '');
          return countryCode + currency + amount;
        } else if (match[2] && match[1] && /[$€£¥]/.test(match[1])) {
          // Pattern 2: $99.99 (currency + amount)
          const currency = match[1];
          const amount = match[2].replace(/,/g, '');
          return currency + amount;
        } else if (match[2] && match[1] && /^\d/.test(match[1])) {
          // Pattern 3: 99.99 USD (amount + currency code)
          const amount = match[1].replace(/,/g, '');
          const currency = match[2];
          return amount + ' ' + currency;
        }
      }
    }

    // Fallback: just extract numbers with currency symbols
    const simpleMatch = text.match(/([$€£¥]?[\d,]+\.?\d{0,2})/);
    if (simpleMatch && simpleMatch[1]) {
      const cleaned = simpleMatch[1].replace(/,/g, '');
      // Only return if it actually has a price-like format
      if (/[$€£¥]?\d+\.?\d{0,2}/.test(cleaned)) {
        return cleaned;
      }
    }

    return '';
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