// Extension integration for automatic web app deployment
// Add this code to your extension's authentication flow

class WebAppDeployer {
  constructor() {
    this.appsScriptApiUrl = 'https://script.googleapis.com/v1';
  }

  async createPersonalWebApp(accessToken, spreadsheetId) {
    try {
      console.log('Creating personal web app for user...');

      // Step 1: Create a new Apps Script project
      const projectResponse = await fetch(`${this.appsScriptApiUrl}/projects`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: 'Quotebook Personal Web Viewer',
          parentId: 'YOUR_GOOGLE_DRIVE_FOLDER_ID' // Optional: organize in a specific folder
        })
      });

      if (!projectResponse.ok) {
        throw new Error(`Failed to create project: ${projectResponse.status}`);
      }

      const project = await projectResponse.json();
      const scriptId = project.scriptId;
      console.log('Created Apps Script project:', scriptId);

      // Step 2: Upload the web app code
      const codeFiles = [
        {
          name: 'Code',
          type: 'SERVER_JS',
          source: this.getAppsScriptCode()
        },
        {
          name: 'index',
          type: 'HTML',
          source: this.getHtmlCode()
        }
      ];

      const updateResponse = await fetch(`${this.appsScriptApiUrl}/projects/${scriptId}/content`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          files: codeFiles
        })
      });

      if (!updateResponse.ok) {
        throw new Error(`Failed to update project: ${updateResponse.status}`);
      }

      console.log('Uploaded web app code to project');

      // Step 3: Deploy as web app
      const deployResponse = await fetch(`${this.appsScriptApiUrl}/projects/${scriptId}/deployments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          versionNumber: 1,
          description: 'Quotebook Personal Web Viewer',
          manifestFileName: 'appsscript',
          deploymentConfig: {
            scriptId: scriptId,
            description: 'Quotebook Personal Web Viewer',
            executeAs: 'USER_ACCESSING',
            whoHasAccess: 'ANYONE'
          }
        })
      });

      if (!deployResponse.ok) {
        throw new Error(`Failed to deploy web app: ${deployResponse.status}`);
      }

      const deployment = await deployResponse.json();
      console.log('Deployed web app:', deployment);

      // Step 4: Configure spreadsheet ID
      await this.configureSpreadsheet(accessToken, scriptId, spreadsheetId);

      const webAppUrl = deployment.entryPoints?.[0]?.webApp?.url;
      if (!webAppUrl) {
        throw new Error('Failed to get web app URL from deployment');
      }

      console.log('Personal web app created:', webAppUrl);
      return {
        success: true,
        webAppUrl: webAppUrl,
        scriptId: scriptId
      };

    } catch (error) {
      console.error('Failed to create personal web app:', error);
      throw error;
    }
  }

  async configureSpreadsheet(accessToken, scriptId, spreadsheetId) {
    // Call the setSpreadsheetId function to configure the web app
    const response = await fetch(`${this.appsScriptApiUrl}/projects/${scriptId}:run`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        function: 'setSpreadsheetId',
        parameters: [spreadsheetId]
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to configure spreadsheet: ${response.status}`);
    }

    console.log('Configured spreadsheet ID in web app');
  }

  getAppsScriptCode() {
    // Return the Google Apps Script code from apps-script-code.gs
    return `
function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('Quotebook - Your Quote Collection')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getQuotebookData() {
  try {
    const properties = PropertiesService.getScriptProperties();
    const spreadsheetId = properties.getProperty('SPREADSHEET_ID');
    
    if (!spreadsheetId) {
      throw new Error('Spreadsheet ID not configured');
    }
    
    const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    const sheet = spreadsheet.getActiveSheet();
    const data = sheet.getDataRange().getValues();
    
    if (data.length <= 1) {
      return [];
    }
    
    const headers = data[0];
    const quotes = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const quote = {
        id: i,
        title: row[0] || '',
        content: row[1] || '',
        url: row[2] || '',
        tags: row[3] ? row[3].split(',').map(tag => tag.trim()).filter(tag => tag) : [],
        date: row[4] ? new Date(row[4]).toISOString() : new Date().toISOString(),
        originalRowIndex: i
      };
      
      if (quote.content.trim()) {
        quotes.push(quote);
      }
    }
    
    return quotes;
  } catch (error) {
    console.error('Error fetching data:', error);
    throw new Error('Failed to load quotes: ' + error.message);
  }
}

function deleteQuote(rowIndex) {
  try {
    const properties = PropertiesService.getScriptProperties();
    const spreadsheetId = properties.getProperty('SPREADSHEET_ID');
    
    if (!spreadsheetId) {
      throw new Error('Spreadsheet ID not configured');
    }
    
    const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    const sheet = spreadsheet.getActiveSheet();
    
    sheet.deleteRow(rowIndex + 1);
    
    return { success: true };
  } catch (error) {
    console.error('Error deleting quote:', error);
    throw new Error('Failed to delete quote: ' + error.message);
  }
}

function setSpreadsheetId(spreadsheetId) {
  try {
    const properties = PropertiesService.getScriptProperties();
    properties.setProperty('SPREADSHEET_ID', spreadsheetId);
    return { success: true };
  } catch (error) {
    console.error('Error setting spreadsheet ID:', error);
    throw new Error('Failed to configure spreadsheet: ' + error.message);
  }
}
    `;
  }

  getHtmlCode() {
    // Return the HTML code from apps-script-index.html
    // (This would be the full HTML content - truncated for brevity)
    return fetch('./apps-script-index.html').then(r => r.text());
  }
}

// Integration with existing extension authentication
async function enhancedAuthentication() {
  try {
    // Your existing authentication code...
    const accessToken = await getGoogleAccessToken();
    const spreadsheetId = await setupGoogleSheet(accessToken);
    
    // NEW: Automatically create personal web app
    const deployer = new WebAppDeployer();
    const webAppResult = await deployer.createPersonalWebApp(accessToken, spreadsheetId);
    
    // Store web app URL for later use
    await chrome.storage.local.set({
      webAppUrl: webAppResult.webAppUrl,
      webAppScriptId: webAppResult.scriptId
    });
    
    console.log('Personal web app created and configured!');
    
    // Update UI to show web app link
    updateUIWithWebAppLink(webAppResult.webAppUrl);
    
    return {
      accessToken,
      spreadsheetId,
      webAppUrl: webAppResult.webAppUrl
    };
    
  } catch (error) {
    console.error('Enhanced authentication failed:', error);
    throw error;
  }
}

function updateUIWithWebAppLink(webAppUrl) {
  // Add "View Online" buttons throughout the extension
  const viewOnlineButtons = document.querySelectorAll('.view-online-btn');
  viewOnlineButtons.forEach(btn => {
    btn.style.display = 'block';
    btn.onclick = () => chrome.tabs.create({ url: webAppUrl });
  });
}