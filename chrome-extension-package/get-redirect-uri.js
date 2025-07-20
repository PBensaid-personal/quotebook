// Script to get the correct redirect URI for Chrome Extension OAuth client
console.log('=== Chrome Extension Redirect URI ===');
console.log('Extension ID:', chrome.runtime.id);
console.log('Redirect URI to add to OAuth client:', chrome.identity.getRedirectURL());
console.log('');
console.log('STEPS TO FIX:');
console.log('1. Go to Google Cloud Console → APIs & Services → Credentials');
console.log('2. Find your OAuth 2.0 Client ID: 184152653641-m443n0obiua9uotnkts6lsbbo8ikks80.apps.googleusercontent.com');
console.log('3. Click EDIT');
console.log('4. Add this redirect URI:', chrome.identity.getRedirectURL());
console.log('5. Save changes');
console.log('');
console.log('Then retry authentication in the extension.');

// Also display in the popup
if (document.getElementById('status')) {
  document.getElementById('status').innerHTML = `
    <strong>Add this redirect URI to your OAuth client:</strong><br>
    <code>${chrome.identity.getRedirectURL()}</code><br>
    <small>See console for detailed steps</small>
  `;
  document.getElementById('status').className = 'status info';
  document.getElementById('status').style.display = 'block';
}