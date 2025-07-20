# Chrome Web Store Publishing Guide

## Pre-Submission Checklist

### 1. Complete Extension Files
Your extension needs these files (already created):
- ✅ `manifest.json` - Extension configuration
- ✅ `popup.html` - Extension popup interface  
- ✅ `popup.js` - Main functionality
- ✅ `content.js` - Page interaction script
- ✅ `background.js` - Background service worker

### 2. Required Assets (Need to Create)
- **Icon files**: 16x16, 48x48, 128x128 px PNG files
- **Screenshots**: 1280x800 or 640x400 px for store listing
- **Promotional images**: Optional but recommended

### 3. Google Cloud Console Setup
Before publishing, you need real Google API credentials:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project: "WebCapture Extension"
3. Enable APIs:
   - Google Sheets API
   - Google Drive API
4. Create OAuth 2.0 Client ID:
   - Application type: "Chrome Extension"
   - Application ID: Your extension ID (get after upload)
5. Update `manifest.json` with real client ID

## Publishing Steps

### Step 1: Chrome Developer Dashboard
1. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/developer/dashboard)
2. Pay one-time $5 developer registration fee
3. Verify your email and identity

### Step 2: Package Extension
1. Create ZIP file containing:
   ```
   WebCapture-Extension.zip
   ├── manifest.json
   ├── popup.html
   ├── popup.js
   ├── content.js
   ├── background.js
   ├── icon-16.png
   ├── icon-48.png
   └── icon-128.png
   ```

### Step 3: Upload & Configure
1. Click "Add new item" in dashboard
2. Upload your ZIP file
3. Fill out store listing:
   - **Name**: "WebCapture - Save to Google Sheets"
   - **Summary**: "Highlight text on any webpage and save it directly to your own Google Sheets"
   - **Description**: (detailed description below)
   - **Category**: Productivity
   - **Screenshots**: Upload 2-5 screenshots
   - **Icon**: 128x128 px icon

### Step 4: Store Listing Content

**Detailed Description:**
```
Save web content to your own Google Sheets with just a highlight and click!

★ YOUR DATA, YOUR CONTROL
Everything saves to your own Google Drive - no subscriptions, no vendor lock-in

★ SIMPLE 3-STEP PROCESS
1. Highlight any text on any webpage
2. Click the extension icon
3. Add tags/notes and save to your Google Sheets

★ FEATURES
• Direct Google Sheets integration
• Auto-captures page title, URL, and timestamp
• Add custom tags and notes
• Works on any website
• Visual feedback when text is captured
• One-time Google sign-in

★ PRIVACY FOCUSED
• No data stored on our servers
• All content remains in your Google account
• Open source and transparent
• You can revoke access anytime

Perfect for researchers, students, content creators, and anyone who wants to organize web content in their own spreadsheet database.

SETUP: Simply install, sign in with Google once, and start saving! The extension will create a "WebCapture Collection" spreadsheet in your Google Drive automatically.
```

### Step 5: Review Process
- Google reviews typically take 1-3 business days
- They check for policy compliance and functionality
- Common rejection reasons:
  - Missing privacy policy
  - Incorrect permissions
  - Broken functionality

### Step 6: Post-Approval Setup
1. Get your extension ID from the store
2. Update Google Cloud Console OAuth settings:
   - Add extension ID: `chrome-extension://YOUR_EXTENSION_ID/`
3. Update manifest.json with real client ID
4. Upload updated version

## Required Legal Documents

### Privacy Policy (Required)
Create at: `privacy-policy.html`
Must cover:
- What data you collect (none, in your case)
- How you use Google APIs
- User data ownership
- Contact information

### Terms of Service (Recommended)
Basic terms covering:
- Service description
- User responsibilities
- Limitation of liability

## Cost Breakdown
- **Chrome Web Store fee**: $5 (one-time)
- **Google Cloud Console**: Free tier sufficient
- **Total cost**: $5

## Timeline
- **Preparation**: 1-2 hours
- **Store review**: 1-3 business days
- **OAuth setup**: 30 minutes after approval
- **Total**: 3-5 days from start to published

## Next Steps
1. Create icon files (I can help with SVG designs)
2. Set up Google Cloud project
3. Create privacy policy
4. Package and upload extension
5. Submit for review

Would you like me to help create the icons, privacy policy, or set up the Google Cloud configuration?