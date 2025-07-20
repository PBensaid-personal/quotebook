# Common Issues & Solutions

## Chrome Web Store Upload Issues

### "Manifest parsing failed"
- Check that your manifest.json has valid JSON syntax
- Make sure all required fields are present
- Icon files must exist and be valid PNG format

### "Invalid icon format"
- Icons must be PNG format (not SVG)
- Required sizes: 16x16, 48x48, 128x128 pixels
- Convert SVG files to PNG before uploading

### "Privacy policy required"
- Include privacy-policy.html in your ZIP
- Or host it online and provide URL in store listing

## Google Cloud Console Issues

### "OAuth client creation failed"
- Make sure APIs are enabled first (Sheets API + Drive API)
- Complete OAuth consent screen setup
- Use "Web application" type for client ID

### "API not enabled"
- Go to API Library in your project
- Search for "Google Sheets API" and "Google Drive API"
- Click Enable on both

### "Invalid redirect URI"
- Don't add redirect URIs when creating OAuth client
- Add them later after getting extension ID from Chrome Web Store

## Extension Functionality Issues

### "Authentication not working"
- Update manifest.json with real Google Client ID
- Add extension ID to OAuth client in Google Cloud Console
- Make sure user is using a Gmail account

### "Permission denied"
- Check OAuth scopes in manifest match Google Cloud setup
- User may need to re-authorize if scopes changed
- Verify APIs are enabled in Google Cloud project

## Testing Your Extension

### Load Unpacked for Testing
1. Go to chrome://extensions/
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select your extension folder
5. Test functionality before submitting

### Common Test Cases
- Highlight text on different websites
- Check popup opens and displays correctly
- Test Google authentication flow
- Verify data saves to Google Sheets
- Test on different types of content

## Store Review Issues

### Rejected for "Functionality"
- Make sure extension works end-to-end
- Test Google authentication thoroughly
- Ensure all permissions are used and necessary

### Rejected for "Privacy"
- Privacy policy must be complete and accurate
- Explain exactly what data you access
- Clarify that no data is stored on your servers

### Rejected for "Permissions"
- Only request permissions you actually use
- Justify each permission in store listing
- Remove any unnecessary permissions

## Post-Publication Issues

### Users can't authenticate
- Check Google Cloud Console quotas
- Verify OAuth client is properly configured
- Make sure extension ID is added to authorized origins

### Sheets API quota exceeded
- Free tier: 100 requests per 100 seconds per user
- Usually sufficient for normal use
- Enable billing if needed for higher quotas

### Users report data not saving
- Check if Google Sheets API is working
- Verify user has proper permissions to create files
- Test with different Google accounts

## Getting Help

- **Chrome Web Store**: Use developer dashboard support
- **Google Cloud**: Check documentation and console help
- **Extension Issues**: Test locally first with "Load unpacked"