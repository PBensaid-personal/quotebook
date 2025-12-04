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
                const currency = offer.priceCurrency || 'USD';
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

    // 3. Meta tags (Open Graph, Twitter Card, product meta)
    const metaPrice = this.extractFromMetaTags();
    if (metaPrice) return metaPrice;

    // 4. Etsy-specific selectors
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
          if (el && this.isVisible(el) && !this.isInExcludedArea(el)) {
            const text = el.textContent.trim();
            const price = this.parsePrice(text);
            if (price) return price;
          }
        } catch (e) {
          // Skip if selector fails
        }
      }
    }

    // 5. Amazon-specific: combine whole and fraction
    if (window.location.hostname.includes('amazon')) {
      const whole = document.querySelector('.a-price-whole');
      const fraction = document.querySelector('.a-price-fraction');
      if (whole && this.isVisible(whole) && !this.isInExcludedArea(whole)) {
        const wholeText = whole.textContent.trim().replace(/[^\d.,]/g, '');
        const fractionText = fraction ? fraction.textContent.trim() : '';
        if (wholeText) {
          const combined = '$' + wholeText + (fractionText ? '.' + fractionText : '');
          const price = this.parsePrice(combined);
          if (price) return price;
        }
      }
    }

    // 6. Context-aware: Only extract prices near shopping buttons
    const priceNearButton = this.extractPriceNearShoppingButton();
    if (priceNearButton) return priceNearButton;

    return '';
  }

  extractPriceNearShoppingButton() {
    // Find shopping action buttons
    const shoppingButtons = document.querySelectorAll(
      'button[class*="add-to-cart" i], ' +
      'button[class*="buy" i], ' +
      'button[class*="add-to-bag" i], ' +
      'button[class*="purchase" i], ' +
      'a[class*="add-to-cart" i], ' +
      'a[class*="buy-now" i], ' +
      '[id*="add-to-cart" i], ' +
      '[data-action*="add-to-cart" i]'
    );

    if (shoppingButtons.length === 0) {
      return ''; // No shopping context found
    }

    // For each button, search nearby for price elements
    for (const button of shoppingButtons) {
      if (!this.isVisible(button)) continue;

      // Find the closest product container (parent)
      const productContainer = button.closest(
        '[itemtype*="Product"], ' +
        '[data-product], ' +
        '[class*="product" i], ' +
        'article, ' +
        'section, ' +
        '.card, ' +
        'main'
      ) || button.parentElement;

      if (!productContainer) continue;

      // Look for price elements within this container
      const priceSelectors = [
        '[itemprop="price"]',
        '[data-price]',
        '[class*="price" i]:not([class*="old" i]):not([class*="was" i])',
        '.price'
      ];

      for (const selector of priceSelectors) {
        try {
          const priceElements = productContainer.querySelectorAll(selector);
          for (const el of priceElements) {
            if (!this.isVisible(el) || this.isInExcludedArea(el)) continue;

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
    }

    return '';
  }

  extractFromMetaTags() {
    // Check Open Graph, Twitter Card, and product meta tags
    const metaSelectors = [
      { selector: 'meta[property="product:price:amount"]', attr: 'content' },
      { selector: 'meta[property="og:price:amount"]', attr: 'content' },
      { selector: 'meta[name="twitter:data1"]', attr: 'content' },
      { selector: 'meta[property="price"]', attr: 'content' }
    ];

    for (const { selector, attr } of metaSelectors) {
      const meta = document.querySelector(selector);
      if (meta) {
        const content = meta.getAttribute(attr);
        if (content) {
          // Check for currency meta tag
          const currencyMeta = document.querySelector(
            'meta[property="product:price:currency"], meta[property="og:price:currency"]'
          );

          if (currencyMeta) {
            const currency = currencyMeta.getAttribute('content');
            return this.formatPriceWithCurrency(content, currency);
          }

          const price = this.parsePrice(content);
          if (price) return price;
        }
      }
    }

    return '';
  }

  formatPriceWithCurrency(amount, currency) {
    if (!amount || !currency) return '';

    const cleanAmount = amount.replace(/[^\d.,]/g, '');

    switch (currency.toUpperCase()) {
      case 'USD':
        return '$' + cleanAmount;
      case 'EUR':
        return cleanAmount + ' €';
      case 'GBP':
        return '£' + cleanAmount;
      default:
        return cleanAmount + ' ' + currency;
    }
  }

  isInExcludedArea(element) {
    // Check if element is in footer, header, sidebar, ad, or other excluded areas
    const excludedSelectors = [
      'footer',
      'header',
      'nav',
      '[class*="sidebar" i]',
      '[class*="ad-" i]',
      '[class*="advertisement" i]',
      '[id*="ad-" i]',
      '[class*="newsletter" i]',
      '[class*="subscription" i]',
      '[class*="related" i]',
      '[class*="you-may" i]',
      '[class*="also-like" i]',
      '[class*="recommended" i]',
      '.price-comparison',
      '[class*="shipping" i]',
      '[class*="promo" i]',
      '[class*="banner" i]'
    ];

    for (const selector of excludedSelectors) {
      if (element.closest(selector)) {
        return true;
      }
    }

    return false;
  }

  isVisible(element) {
    if (!element) return false;

    const style = window.getComputedStyle(element);
    return style.display !== 'none' &&
           style.visibility !== 'hidden' &&
           style.opacity !== '0' &&
           element.offsetParent !== null;
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
          if (this.isValidPrice(amount)) {
            return countryCode + currency + amount;
          }
        } else if (match[2] && match[1] && /[$€£¥]/.test(match[1])) {
          // Pattern 2: $99.99 (currency + amount)
          const currency = match[1];
          const amount = match[2].replace(/,/g, '');
          if (this.isValidPrice(amount)) {
            return currency + amount;
          }
        } else if (match[2] && match[1] && /^\d/.test(match[1])) {
          // Pattern 3: 99.99 USD (amount + currency code)
          const amount = match[1].replace(/,/g, '');
          const currency = match[2];
          if (this.isValidPrice(amount)) {
            return amount + ' ' + currency;
          }
        }
      }
    }

    // Fallback: only extract prices with currency symbols (no bare numbers)
    const simpleMatch = text.match(/([$€£¥][\d,]+\.?\d{0,2})/);
    if (simpleMatch && simpleMatch[1]) {
      const cleaned = simpleMatch[1].replace(/,/g, '');
      const amount = cleaned.replace(/[$€£¥]/g, '');
      if (this.isValidPrice(amount)) {
        return cleaned;
      }
    }

    return '';
  }

  isValidPrice(amount) {
    // Convert to number for validation
    const numAmount = parseFloat(amount);

    // Reject if:
    // - Not a valid number
    // - Less than $0.10 (too small to be a real product price)
    // - Greater than $1,000,000 (unrealistic)
    if (isNaN(numAmount)) return false;
    if (numAmount < 0.10) return false;
    if (numAmount > 1000000) return false;

    return true;
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

    // 1. Extract from <img> elements
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

    // 2. Extract from CSS background images
    // Focus on likely content containers to avoid performance issues
    const backgroundSelectors = [
      'main', 'article', 'section', '[class*="hero"]', '[class*="banner"]',
      '[class*="cover"]', '[class*="feature"]', '[class*="media"]',
      '[class*="image"]', '[class*="photo"]', '[class*="picture"]',
      '[class*="product"]', '[class*="gallery"]', '[id*="hero"]',
      '[id*="banner"]', '[id*="feature"]'
    ];

    // Get all potential background image elements
    const bgElements = document.querySelectorAll(backgroundSelectors.join(','));

    Array.from(bgElements).forEach((element) => {
      // Skip if element is too small (likely decorative)
      const width = element.offsetWidth;
      const height = element.offsetHeight;

      if (width < 200 || height < 200) return;

      const style = window.getComputedStyle(element);
      const bgImage = style.backgroundImage;

      // Check if element has a background image
      if (!bgImage || bgImage === 'none') return;

      // Extract URL from CSS url() function
      // Handles: url("..."), url('...'), url(...)
      const urlMatch = bgImage.match(/url\(['"]?([^'"()]+)['"]?\)/);
      if (!urlMatch) return;

      let imgSrc = urlMatch[1];
      imgSrc = this.getAbsoluteUrl(imgSrc);

      if (!imgSrc) return;

      // Apply same filters as <img> elements
      if (imgSrc.includes('data:image')) return;
      if (!imgSrc.startsWith('http')) return;

      const srcLower = imgSrc.toLowerCase();
      if (srcLower.includes('logo') ||
          srcLower.includes('icon') ||
          srcLower.includes('sprite') ||
          srcLower.includes('favicon')) return;

      images.push({
        src: imgSrc,
        alt: element.getAttribute('aria-label') || element.getAttribute('title') || 'Background image',
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