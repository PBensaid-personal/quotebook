# Test Your Extension Locally

## Install Extension for Testing (2 minutes)

### 1. Prepare Extension Folder
1. **Extract your WebCapture-Extension.zip** to a folder on your computer
2. **Replace the empty PNG icon files** with real ones (or use the SVG files temporarily)

### 2. Load in Chrome
1. **Open Chrome** and go to `chrome://extensions/`
2. **Turn on "Developer mode"** (toggle in top-right corner)
3. **Click "Load unpacked"**
4. **Select the extracted extension folder**
5. **Your extension appears** in the extensions list

### 3. Test the Extension
1. **Go to any website** (like Wikipedia, news sites)
2. **Highlight some text** on the page
3. **Click the extension icon** in Chrome toolbar
4. **Try the popup interface** - it should open but won't connect to Google yet

## What Works Without Google Setup
✅ **Extension popup** opens and displays correctly  
✅ **Text selection** detection works  
✅ **Interface elements** function properly  
✅ **Form inputs** accept data  
❌ **Google authentication** won't work yet (needs real Client ID)  
❌ **Saving to Sheets** won't work yet  

## Testing Google Integration

### Option 1: Update with Real Credentials
1. **Get your Google Client ID** from Cloud Console
2. **Edit manifest.json** in the extracted folder
3. **Replace** the placeholder Client ID with your real one
4. **Click "Reload" button** on the extension in chrome://extensions/
5. **Test full functionality** including Google sign-in

### Option 2: Test Core Functionality First
- Verify popup interface works correctly
- Check text selection detection
- Test form validation and UI elements
- Ensure no JavaScript errors in console

## Debug Tools

### Chrome Extension Developer Tools
1. **Right-click extension icon** → "Inspect popup"
2. **Check console** for JavaScript errors
3. **Test all buttons and inputs**

### Check Content Script
1. **Go to any webpage**
2. **Right-click** → "Inspect"
3. **Go to Console tab**
4. **Highlight text** and check for messages

### Background Script Debugging
1. **Go to** `chrome://extensions/`
2. **Click "Inspect views: background page"** under your extension
3. **Check console** for background script errors

## Common Test Scenarios

### Basic Functionality
- Extension icon appears in toolbar
- Popup opens when clicked
- Text selection triggers feedback
- Form accepts input without errors

### Google Integration (with real Client ID)
- Google sign-in button works
- Authentication popup appears
- User can grant permissions
- Access token is received and stored

### End-to-End (full setup)
- Select text on webpage
- Open extension popup
- Sign in to Google (one time)
- Fill out save form
- Data appears in Google Sheets

## Fix Common Issues

### Extension Won't Load
- Check manifest.json syntax
- Ensure all files are present
- Look for console errors

### Popup Won't Open
- Check popup.html file exists
- Verify popup.js loads without errors
- Check permissions in manifest

### Text Selection Not Working
- Verify content.js is injected
- Check for JavaScript errors
- Test on different websites

## Ready for Production

Once local testing works:
1. **Icons converted** to proper PNG format
2. **Google Client ID** updated in manifest
3. **All functionality** tested and working
4. **No console errors**
5. **Ready to submit** updated ZIP to Chrome Web Store

Testing locally helps catch issues before users see them!