# Chrome Web Store Submission Checklist

## Current Status
✅ Paid $5 Chrome Web Store developer fee
✅ Created Google Cloud project: quotecollector
⏳ Setting up APIs and OAuth (in progress)
⏳ Need Client ID for extension
⏳ Ready to upload extension

## Files to Include in ZIP

Create `WebCapture-Extension.zip` with these files:

### Required Files
- `manifest.json` (with real Client ID)
- `popup.html`
- `popup.js` 
- `content.js`
- `background.js`
- `privacy-policy.html`

### Icon Files (PNG format)
- `icon-16.png`
- `icon-48.png` 
- `icon-128.png`

## Store Listing Information

### Basic Info
- **Name**: WebCapture - Save to Google Sheets
- **Summary**: Highlight text on any webpage and save it directly to your own Google Sheets
- **Category**: Productivity
- **Language**: English

### Detailed Description
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

### Required URLs
- **Homepage URL**: https://your-website.com (optional)
- **Support URL**: Your support email or website
- **Privacy Policy**: Host the privacy-policy.html file online

### Screenshots Needed
You'll need 2-5 screenshots (1280x800 or 640x400):

1. **Extension popup interface** - showing the save form
2. **Text selection in action** - highlighting text on a webpage  
3. **Google Sheets result** - showing saved data in spreadsheet
4. **Settings/authentication** - Google sign-in flow
5. **Permissions screen** - what the extension requests

### Permissions Justification
When Chrome asks why you need permissions:

- **activeTab**: "To capture selected text from the current webpage"
- **storage**: "To remember user's Google authentication and preferences"
- **identity**: "To authenticate with user's Google account for Sheets access"
- **host_permissions**: "To communicate with Google Sheets API"

## Submission Steps

1. **Upload Extension**
   - Go to Chrome Developer Dashboard
   - Click "Add new item"
   - Upload your ZIP file
   - Wait for upload and processing

2. **Fill Store Listing**
   - Add all the information above
   - Upload screenshots
   - Upload 128x128 icon for store
   - Set privacy policy URL

3. **Submit for Review**
   - Review all information
   - Click "Submit for review"
   - Typically takes 1-3 business days

4. **After Approval**
   - Get your extension ID from the store URL
   - Update Google Cloud OAuth settings with extension ID
   - Upload updated extension if needed

## Common Rejection Reasons to Avoid

- Missing or inadequate privacy policy
- Requesting unnecessary permissions
- Broken functionality during review
- Missing or low-quality screenshots
- Vague or misleading description

## Post-Publication Steps

1. **Update OAuth Settings**
   - Add extension ID to Google Cloud Console
   - Test authentication flow
   
2. **Monitor Reviews**
   - Respond to user feedback
   - Fix any reported issues

3. **Promote Your Extension**
   - Share with friends/colleagues
   - Add to your website/portfolio
   - Social media announcement

Let me know when you have your Google Client ID and I'll help you create the final extension package!