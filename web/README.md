# Quotebook Web Simulator - Google Drive Deployment

This guide shows you how to host the Quotebook web simulator on Google Drive for private access.

## Quick Setup (5 minutes)

### Step 1: Download the Files
Download these 4 files to your computer:
- `index.html` (landing page)
- `popup-simulator.html` (popup interface)
- `popup-simulator.js` (popup functionality)
- `fullpage-simulator.html` (full collection view)
- `fullpage-simulator.js` (full collection functionality)

### Step 2: Upload to Google Drive
1. Go to [Google Drive](https://drive.google.com)
2. Create a new folder called "Quotebook Web Simulator"
3. Upload all 5 files to this folder
4. Right-click the folder → "Share" → "Anyone with the link can view"
5. Copy the share link

### Step 3: Get the Direct Link
Your Google Drive share link looks like:
```
https://drive.google.com/drive/folders/FOLDER_ID?usp=sharing
```

To access the web simulator, replace the URL format:
```
https://drive.google.com/uc?export=view&id=FILE_ID
```

### Step 4: Access Your Simulator
1. Open the `index.html` file in Google Drive
2. Click "Open with" → "Google Sites" or use the direct link method above
3. Your private web simulator is now accessible!

## Alternative: Google Sites Method

1. Create a new [Google Site](https://sites.google.com)
2. Add an "Embed" component
3. Upload your HTML files as attachments
4. Embed the `index.html` file
5. Publish your site with restricted access

## Features Available in Web Simulator

✅ **Popup Interface Simulation**
- Exact replica of Chrome extension popup
- Simulated Google authentication
- Form for saving quotes with tags
- Visual feedback and animations

✅ **Full Collection View**
- Masonry layout matching extension exactly  
- Search and filter functionality
- Statistics dashboard
- Delete confirmation modals
- Pagination with load more

✅ **Content Structure**
- Content text → Title (with yellow underline) → Tags → Metadata (site + date)
- Realistic sample data with proper domains
- Click to open URLs, click tags to filter

## Privacy & Security

- **Fully Client-Side**: No server required, runs entirely in browser
- **No Data Collection**: All interactions are simulated locally  
- **Private Access**: Only you and people with the link can access
- **No Installation**: Works directly from Google Drive

## Limitations

- Authentication is simulated (no real Google Sheets integration)
- Data doesn't persist between sessions
- Designed for demonstration purposes

## Support

This web simulator perfectly mirrors your Chrome extension functionality for easy demonstration and testing. For the real extension with Google Sheets integration, install from the Chrome Web Store.