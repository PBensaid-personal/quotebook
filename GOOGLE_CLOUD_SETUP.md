# Google Cloud Console Setup for WebCapture Extension

## Your Project: quotecollector
URL: https://console.cloud.google.com/iam-admin/settings?project=quotecollector

## Step 1: Enable Required APIs

1. **Go to APIs & Services**
   - In your Google Cloud Console, click the hamburger menu (☰) in top-left
   - Click "APIs & Services" → "Library"
   - URL: https://console.cloud.google.com/apis/library?project=quotecollector

2. **Enable Google Sheets API**
   - Search for "Google Sheets API"
   - Click on "Google Sheets API"
   - Click the blue "ENABLE" button
   - Wait for it to enable (takes ~30 seconds)

3. **Enable Google Drive API**
   - Go back to Library (or search again)
   - Search for "Google Drive API" 
   - Click on "Google Drive API"
   - Click the blue "ENABLE" button

## Step 2: Create OAuth 2.0 Credentials

1. **Go to Credentials**
   - Click "APIs & Services" → "Credentials"
   - URL: https://console.cloud.google.com/apis/credentials?project=quotecollector

2. **Create OAuth Client ID**
   - Click "+ CREATE CREDENTIALS" button at top
   - Select "OAuth client ID"
   
3. **Configure OAuth Consent Screen** (if prompted)
   - Choose "External" user type
   - Click "CREATE"
   - Fill required fields:
     - App name: "WebCapture Extension"
     - User support email: your email
     - Developer contact: your email
   - Click "SAVE AND CONTINUE" through all steps

4. **Create Client ID**
   - Application type: "Web application"
   - Name: "WebCapture Chrome Extension"
   - Authorized JavaScript origins: Leave blank for now
   - Authorized redirect URIs: Leave blank for now
   - Click "CREATE"

5. **Copy Your Client ID**
   - You'll see a popup with your Client ID
   - Copy this long string (ends with .apps.googleusercontent.com)
   - Save it - you'll need it for the extension

## Step 3: Configure OAuth Scopes

1. **Go to OAuth Consent Screen**
   - Click "APIs & Services" → "OAuth consent screen"
   - URL: https://console.cloud.google.com/apis/credentials/consent?project=quotecollector

2. **Add Scopes**
   - Click "EDIT APP"
   - Go to "Scopes" step
   - Click "ADD OR REMOVE SCOPES"
   - Search and select:
     - "../auth/spreadsheets" (Google Sheets API)
     - "../auth/drive.file" (Google Drive API)
   - Click "UPDATE"
   - Click "SAVE AND CONTINUE"

3. **Add Test Users** (during development)
   - Go to "Test users" step
   - Click "ADD USERS"
   - Add your Gmail address
   - Click "SAVE"

## What You Need for Extension

After completing above steps, you'll have:

✅ **Client ID**: Something like `123456789-abcdef.apps.googleusercontent.com`
✅ **APIs Enabled**: Sheets API and Drive API
✅ **Scopes Configured**: Spreadsheets and Drive access

## Next: Update Extension

Once you have your Client ID:

1. Update `manifest.json`:
   ```json
   "oauth2": {
     "client_id": "YOUR_ACTUAL_CLIENT_ID.apps.googleusercontent.com",
     "scopes": [
       "https://www.googleapis.com/auth/spreadsheets",
       "https://www.googleapis.com/auth/drive.file"
     ]
   }
   ```

2. Upload updated extension ZIP to Chrome Web Store

3. Get your extension ID from Chrome Web Store

4. Return to Google Cloud Console and add extension ID to OAuth settings

## Quick Navigation Links for Your Project

- **API Library**: https://console.cloud.google.com/apis/library?project=quotecollector
- **Credentials**: https://console.cloud.google.com/apis/credentials?project=quotecollector  
- **OAuth Consent**: https://console.cloud.google.com/apis/credentials/consent?project=quotecollector
- **Enabled APIs**: https://console.cloud.google.com/apis/dashboard?project=quotecollector

Let me know when you have your Client ID and I'll help update the extension!