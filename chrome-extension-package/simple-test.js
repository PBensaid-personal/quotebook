// Ultra-simple authentication test
async function simpleAuthTest() {
  console.log('=== SIMPLE AUTH TEST ===');
  
  try {
    // Step 1: Try non-interactive first
    console.log('Step 1: Checking for existing token...');
    const existingToken = await chrome.identity.getAuthToken({ interactive: false });
    
    if (existingToken) {
      console.log('✅ Found existing token:', existingToken.substring(0, 20) + '...');
      return testApiWithToken(existingToken);
    }
    
    console.log('No existing token found.');
    
    // Step 2: Try interactive authentication
    console.log('Step 2: Starting interactive authentication...');
    const newToken = await chrome.identity.getAuthToken({ interactive: true });
    
    if (newToken) {
      console.log('✅ Got new token:', newToken.substring(0, 20) + '...');
      return testApiWithToken(newToken);
    } else {
      console.log('❌ No token received');
      return false;
    }
    
  } catch (error) {
    console.log('❌ Auth error:', error);
    
    if (error.message.includes('OAuth2 not granted')) {
      console.log('🔍 DIAGNOSIS: OAuth consent screen issue');
      console.log('   → Check Google Cloud Console OAuth consent screen');
      console.log('   → Make sure app is published or you are added as test user');
      console.log('   → Verify scopes are properly configured');
    }
    
    return false;
  }
}

async function testApiWithToken(token) {
  try {
    console.log('Testing token with Google API...');
    
    // Test with tokeninfo API first
    const tokenResponse = await fetch(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${token}`);
    const tokenData = await tokenResponse.json();
    
    if (tokenResponse.ok) {
      console.log('✅ Token is valid:', tokenData);
      console.log('   Scopes:', tokenData.scope);
      console.log('   Audience:', tokenData.audience);
      
      // Now test Sheets API
      const sheetsResponse = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          properties: { title: 'Test Sheet' }
        })
      });
      
      console.log('Sheets API response:', sheetsResponse.status);
      
      if (sheetsResponse.ok) {
        const sheetData = await sheetsResponse.json();
        console.log('✅ SUCCESS: Created test spreadsheet:', sheetData.spreadsheetId);
        return true;
      } else {
        const error = await sheetsResponse.text();
        console.log('❌ Sheets API failed:', error);
        return false;
      }
      
    } else {
      console.log('❌ Token invalid:', tokenData);
      return false;
    }
    
  } catch (error) {
    console.log('❌ API test failed:', error);
    return false;
  }
}

// Auto-run test
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(simpleAuthTest, 1000);
  });
} else {
  setTimeout(simpleAuthTest, 1000);
}