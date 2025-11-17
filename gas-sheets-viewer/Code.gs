/**
 * Quotebook - Private Google Sheets Viewer
 * Google Apps Script Backend (Code.gs)
 *
 * This script runs as the user accessing the web app, ensuring complete privacy.
 * Each user authenticates with their own Google account and accesses only their own spreadsheet.
 */

/**
 * Serves the HTML page when someone visits the Web App URL
 */
function doGet() {
  const html = HtmlService.createHtmlOutputFromFile('Page')
    .setTitle('Quotebook - Your Private Collection')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL); // Allow embedding in iframe
  return html;
}

/**
 * Auto-discover or create the user's Quotebook Collection spreadsheet
 * This runs as the authenticated user, so each user gets their own spreadsheet
 */
function setupSpreadsheet() {
  try {
    Logger.log('Looking for existing Quotebook Collection spreadsheet...');

    // Search for existing Quotebook Collection spreadsheets owned by the user
    const files = DriveApp.getFilesByName('Quotebook Collection');
    const existingSheets = [];

    while (files.hasNext()) {
      const file = files.next();
      // Only include if not in trash and is a spreadsheet
      if (!file.isTrashed() && file.getMimeType() === MimeType.GOOGLE_SHEETS) {
        existingSheets.push({
          id: file.getId(),
          name: file.getName(),
          createdDate: file.getDateCreated()
        });
      }
    }

    if (existingSheets.length > 0) {
      // Sort by creation date (newest first) and use the most recent one
      existingSheets.sort((a, b) => b.createdDate - a.createdDate);
      const spreadsheetId = existingSheets[0].id;

      Logger.log('Found existing spreadsheet: ' + existingSheets[0].name + ' (' + spreadsheetId + ')');

      // Verify it has the correct structure
      try {
        const ss = SpreadsheetApp.openById(spreadsheetId);
        const sheet = ss.getSheets()[0];
        const headers = sheet.getRange(1, 1, 1, 6).getValues()[0];

        // Check if headers match expected format
        // Accept either 'Date' or 'Timestamp' for column E
        const validDateHeader = headers[4] === 'Date' || headers[4] === 'Timestamp';

        if (headers[0] === 'Title' &&
            headers[1] === 'Content' &&
            headers[2] === 'URL' &&
            headers[3] === 'Tags' &&
            validDateHeader &&
            headers[5] === 'Image') {

          Logger.log('Successfully validated existing spreadsheet structure');
          return {
            success: true,
            spreadsheetId: spreadsheetId,
            message: 'Connected to existing Quotebook Collection'
          };
        } else {
          Logger.log('Spreadsheet structure mismatch. Headers found: ' + JSON.stringify(headers));
        }
      } catch (e) {
        Logger.log('Error verifying spreadsheet structure: ' + e.message);
      }
    }

    // No existing spreadsheet found or structure invalid, create new one
    Logger.log('Creating new Quotebook Collection spreadsheet...');

    const ss = SpreadsheetApp.create('Quotebook Collection');
    const spreadsheetId = ss.getId();
    const sheet = ss.getSheets()[0];
    sheet.setName('Saved Quotes');

    // Add headers
    const headers = ['Title', 'Content', 'URL', 'Tags', 'Timestamp', 'Image'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

    // Format header row
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#f3f4f6');

    // Auto-resize columns
    for (let i = 1; i <= headers.length; i++) {
      sheet.autoResizeColumn(i);
    }

    Logger.log('New Quotebook Collection created: ' + spreadsheetId);

    return {
      success: true,
      spreadsheetId: spreadsheetId,
      message: 'New Quotebook Collection created successfully'
    };

  } catch (error) {
    Logger.log('Error in setupSpreadsheet: ' + error.message);
    return {
      success: false,
      error: 'Failed to setup spreadsheet: ' + error.message
    };
  }
}

/**
 * Read all data from the user's Quotebook spreadsheet
 */
function readSheet(spreadsheetId) {
  try {
    if (!spreadsheetId) {
      throw new Error('Missing spreadsheet ID');
    }

    Logger.log('Reading data from spreadsheet: ' + spreadsheetId);

    const ss = SpreadsheetApp.openById(spreadsheetId);
    const sheet = ss.getSheets()[0]; // Get first sheet

    // Get all data (skip header row)
    const lastRow = sheet.getLastRow();

    if (lastRow <= 1) {
      // No data rows (only header or empty sheet)
      return {
        success: true,
        data: [],
        message: 'No quotes found'
      };
    }

    const dataRange = sheet.getRange(2, 1, lastRow - 1, 6);
    const values = dataRange.getValues();

    // Transform into structured data
    const data = values.map((row, index) => ({
      id: index,
      originalRowIndex: index,
      title: row[0] || 'Untitled',
      content: row[1] || '',
      url: row[2] || '',
      tags: row[3] ? row[3].split(',').map(tag => tag.trim()).filter(tag => tag) : [],
      date: row[4] || new Date().toISOString().split('T')[0],
      image: row[5] || ''
    }));

    Logger.log('Successfully read ' + data.length + ' quotes');

    return {
      success: true,
      data: data,
      message: 'Data loaded successfully'
    };

  } catch (error) {
    Logger.log('Error in readSheet: ' + error.message);
    return {
      success: false,
      error: 'Failed to read spreadsheet: ' + error.message
    };
  }
}

/**
 * Delete a row from the spreadsheet by row number
 */
function deleteRow(spreadsheetId, rowNumber) {
  try {
    if (!spreadsheetId || !rowNumber) {
      throw new Error('Missing spreadsheet ID or row number');
    }

    Logger.log('Deleting row ' + rowNumber + ' from spreadsheet: ' + spreadsheetId);

    const ss = SpreadsheetApp.openById(spreadsheetId);
    const sheet = ss.getSheets()[0];

    // Row number is 1-based and includes header, so we delete directly
    sheet.deleteRow(rowNumber);

    Logger.log('Successfully deleted row ' + rowNumber);

    return {
      success: true,
      message: 'Quote deleted successfully'
    };

  } catch (error) {
    Logger.log('Error in deleteRow: ' + error.message);
    return {
      success: false,
      error: 'Failed to delete row: ' + error.message
    };
  }
}

/**
 * Add a new quote to the spreadsheet
 */
function addQuote(spreadsheetId, quoteData) {
  try {
    if (!spreadsheetId || !quoteData) {
      throw new Error('Missing spreadsheet ID or quote data');
    }

    Logger.log('Adding new quote to spreadsheet: ' + spreadsheetId);

    const ss = SpreadsheetApp.openById(spreadsheetId);
    const sheet = ss.getSheets()[0];

    // Prepare row data
    const row = [
      quoteData.title || 'Untitled',
      quoteData.content || '',
      quoteData.url || '',
      quoteData.tags || '',
      quoteData.timestamp || new Date().toISOString(),
      quoteData.image || ''
    ];

    // Append to sheet
    sheet.appendRow(row);

    Logger.log('Successfully added new quote');

    return {
      success: true,
      message: 'Quote added successfully'
    };

  } catch (error) {
    Logger.log('Error in addQuote: ' + error.message);
    return {
      success: false,
      error: 'Failed to add quote: ' + error.message
    };
  }
}

/**
 * Get spreadsheet URL for opening in new tab
 */
function getSpreadsheetUrl(spreadsheetId) {
  try {
    if (!spreadsheetId) {
      throw new Error('Missing spreadsheet ID');
    }

    return {
      success: true,
      url: 'https://docs.google.com/spreadsheets/d/' + spreadsheetId + '/edit'
    };

  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Test function to verify permissions (optional - for debugging)
 */
function testPermissions() {
  try {
    const user = Session.getActiveUser().getEmail();
    Logger.log('Active user: ' + user);

    // Try to access Drive
    const files = DriveApp.getFiles();
    Logger.log('Can access Drive: true');

    return {
      success: true,
      user: user,
      message: 'Permissions verified'
    };

  } catch (error) {
    Logger.log('Permission test failed: ' + error.message);
    return {
      success: false,
      error: error.message
    };
  }
}
