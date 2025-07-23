// Google Apps Script code for Quotebook Web Viewer
// This will be automatically deployed by the Chrome extension

function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('Quotebook - Your Quote Collection')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getQuotebookData() {
  try {
    // Get the spreadsheet ID from script properties (set by extension)
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
    
    // Skip header row and convert to objects
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
      
      // Only add if we have content
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
    
    // Delete the row (add 1 because Apps Script uses 1-based indexing)
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