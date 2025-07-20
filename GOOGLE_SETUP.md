# Google Sheets Integration Setup Guide

## Overview

This extension allows users to store their web content in their own Google Sheets, giving them complete ownership of their data without requiring any subscription or managed database.

## Demo Mode

The application currently runs in demo mode to showcase the authentication flow. To test:

1. Navigate to **Settings & Setup** page
2. Click **"Connect Google"** in the Google Account Integration section
3. This opens the authentication modal with a step-by-step setup process
4. Click **"Simulate Google Authentication (Demo)"** to test the flow
5. Choose to create a new spreadsheet or connect to an existing one

## Production Setup (for real deployment)

### 1. Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the following APIs:
   - Google Sheets API
   - Google Drive API

### 2. OAuth 2.0 Configuration

1. Go to **APIs & Services > Credentials**
2. Click **"Create Credentials" > "OAuth client ID"**
3. Select **"Web application"**
4. Add authorized JavaScript origins:
   - `http://localhost:5000` (development)
   - `https://your-domain.com` (production)
5. Add authorized redirect URIs if needed
6. Copy the **Client ID**

### 3. API Key Setup

1. In **APIs & Services > Credentials**
2. Click **"Create Credentials" > "API key"**
3. Restrict the API key to:
   - Google Sheets API
   - Google Drive API
4. Copy the **API Key**

### 4. Environment Variables

Create a `.env` file with:

```bash
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
VITE_GOOGLE_API_KEY=your-api-key
```

### 5. OAuth Consent Screen

1. Configure the OAuth consent screen
2. Add required scopes:
   - `https://www.googleapis.com/auth/spreadsheets`
   - `https://www.googleapis.com/auth/drive.file`
3. Add test users during development
4. Publish the app when ready for production

## Features

### User Data Ownership
- Content stored in user's own Google Drive
- No vendor lock-in
- Full export capabilities
- Direct access to raw data

### Authentication Flow
- Modern OAuth 2.0 with Google Identity Services
- Secure token-based authentication
- Proper scope permissions
- Token refresh handling

### Spreadsheet Management
- Create new spreadsheets automatically
- Connect to existing spreadsheets
- Automatic header setup
- Real-time sync capabilities

### Privacy & Security
- No data stored on our servers
- All content remains in user's Google account
- Transparent permission model
- User can revoke access anytime

## Chrome Extension Deployment

When packaged as a Chrome extension, the integration will:
1. Use `chrome.identity` API for authentication
2. Store credentials securely in extension storage
3. Sync content automatically when saved
4. Work offline with queue-and-sync functionality

## Cost Structure

- **Free for users** - No subscription required
- **Uses user's Google account** - No additional storage costs
- **No server maintenance** - Entirely client-side operation
- **Chrome Web Store fee** - One-time $5 developer fee only