# Quotebook Personal Web App Deployment Guide

This guide explains how to set up automatic web app deployment for your Quotebook Chrome extension users.

## Overview

When users authenticate with Google Sheets, the extension will automatically:
1. Create a Google Apps Script project in their account
2. Deploy a personal web viewer that shows their quotes
3. Provide direct links from extension to their web app

## Implementation Steps

### 1. Add Apps Script API Permission

Update your extension's `manifest.json`:

```json
{
  "permissions": [
    "https://script.googleapis.com/",
    // ... your existing permissions
  ],
  "oauth2": {
    "client_id": "YOUR_CLIENT_ID",
    "scopes": [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/script.projects",
      "https://www.googleapis.com/auth/script.deployments"
    ]
  }
}
```

### 2. Update OAuth Client Scopes

In your Google Cloud Console OAuth client, add these scopes:
- `https://www.googleapis.com/auth/script.projects`
- `https://www.googleapis.com/auth/script.deployments`

### 3. Integrate with Authentication Flow

Replace your existing authentication function with the enhanced version from `extension-web-app-integration.js`.

### 4. Add Web App Links to UI

Update your extension's popup and fullpage HTML to include "View Online" buttons:

```html
<!-- In popup.html -->
<button id="view-online-btn" class="view-online-btn" style="display: none;">
  View Full Collection Online
</button>

<!-- In fullpage.html -->
<a id="web-app-link" class="web-app-link" style="display: none;" target="_blank">
  Open in Web Browser
</a>
```

### 5. Handle Web App URL Storage

Update your extension to store and retrieve the web app URL:

```javascript
// Store after successful deployment
chrome.storage.local.set({ webAppUrl: webAppUrl });

// Retrieve when needed
chrome.storage.local.get(['webAppUrl'], (result) => {
  if (result.webAppUrl) {
    document.getElementById('view-online-btn').style.display = 'block';
    document.getElementById('view-online-btn').onclick = () => {
      chrome.tabs.create({ url: result.webAppUrl });
    };
  }
});
```

## Files Included

1. **`apps-script-code.gs`** - Google Apps Script backend code
2. **`apps-script-index.html`** - Web app frontend (identical to extension fullpage)
3. **`extension-web-app-integration.js`** - Extension code for auto-deployment
4. **`deployment-guide.md`** - This documentation

## User Experience

1. **Install Extension** → User installs and opens extension
2. **Authenticate** → User clicks "Connect Google Sheets"
3. **Auto-Deploy** → Extension silently creates personal web app (2-3 seconds)
4. **Ready** → "View Online" buttons appear throughout extension
5. **Access** → User can now view their quotes in beautiful web interface

## Benefits

- **Zero Setup**: Users don't need to do anything technical
- **Personal**: Each user gets their own private web app
- **Integrated**: Seamless flow from extension to web viewer
- **Live Data**: Web app always shows current spreadsheet data
- **Full Features**: Search, filter, delete, statistics - everything works

## Technical Details

- **Deployment**: Uses Google Apps Script API to create and deploy web app
- **Authentication**: Leverages user's existing Google authentication
- **Data Access**: Web app reads directly from user's spreadsheet
- **Permissions**: Web app has same access level as extension
- **Updates**: Extension can update web app code if needed

## Error Handling

The integration includes comprehensive error handling:
- API rate limits
- Permission failures
- Deployment timeouts
- Configuration errors

Users will see helpful error messages and retry options if anything fails.

## Security & Privacy

- **Private**: Web app only accessible to the user who created it
- **Secure**: Uses Google's OAuth and Apps Script security
- **No Tracking**: Web app doesn't send data anywhere except user's sheets
- **Ownership**: User owns the Apps Script project and can modify/delete it

This creates a complete quote management system with both extension and web interfaces, all deployed automatically for each user!