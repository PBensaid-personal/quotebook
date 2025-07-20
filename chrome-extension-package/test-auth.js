// Test authentication and API access
async function testAuthentication() {
  try {
    console.log('=== Starting Authentication Test ===');
    
    // Get token
    const token = await chrome.identity.getAuthToken({ interactive: true });
    console.log('✅ Token received:', token.substring(0, 30) + '...');
    
    // Test token info
    const tokenInfoResponse = await fetch(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${token}`);
    const tokenInfo = await tokenInfoResponse.json();
    console.log('✅ Token info:', tokenInfo);
    
    // Test simple Sheets API call - list user's spreadsheets
    console.log('Testing Google Sheets API access...');
    const sheetsResponse = await fetch('https://www.googleapis.com/drive/v3/files?q=mimeType="application/vnd.google-apps.spreadsheet"&pageSize=5', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    console.log('Sheets API response status:', sheetsResponse.status);
    
    if (sheetsResponse.ok) {
      const sheetsData = await sheetsResponse.json();
      console.log('✅ Sheets API working! Found spreadsheets:', sheetsData.files?.length || 0);
      
      // Now try creating a new spreadsheet
      console.log('Testing spreadsheet creation...');
      const createResponse = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          properties: { title: 'Test Quote Collector Sheet' }
        })
      });
      
      console.log('Create spreadsheet status:', createResponse.status);
      
      if (createResponse.ok) {
        const newSheet = await createResponse.json();
        console.log('✅ Successfully created test spreadsheet:', newSheet.spreadsheetId);
        return { success: true, spreadsheetId: newSheet.spreadsheetId };
      } else {
        const error = await createResponse.text();
        console.log('❌ Failed to create spreadsheet:', error);
        return { success: false, error: error };
      }
      
    } else {
      const error = await sheetsResponse.text();
      console.log('❌ Sheets API failed:', error);
      return { success: false, error: error };
    }
    
  } catch (error) {
    console.log('❌ Authentication test failed:', error);
    return { success: false, error: error.toString() };
  }
}

// Add test button to popup
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', addTestButton);
} else {
  addTestButton();
}

function addTestButton() {
  const authScreen = document.getElementById('auth-screen');
  if (authScreen) {
    const testButton = document.createElement('button');
    testButton.textContent = 'Test Authentication';
    testButton.style.cssText = 'margin-top: 10px; padding: 8px 16px; background: #orange; color: white; border: none; border-radius: 4px; cursor: pointer;';
    testButton.onclick = testAuthentication;
    authScreen.appendChild(testButton);
  }
}