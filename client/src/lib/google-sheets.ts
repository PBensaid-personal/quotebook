// Google Sheets API integration using Google Identity Services (GIS)
// Implements OAuth 2.0 flow for client-side web applications

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: any) => any;
          revoke: (accessToken: string) => void;
        };
      };
    };
    gapi?: {
      load: (api: string, callback: () => void) => void;
      client: {
        init: (config: any) => Promise<void>;
        sheets: {
          spreadsheets: {
            create: (params: any) => Promise<any>;
            values: {
              get: (params: any) => Promise<any>;
              append: (params: any) => Promise<any>;
              update: (params: any) => Promise<any>;
            };
          };
        };
        setToken: (token: any) => void;
        getToken: () => any;
      };
    };
  }
}

export interface GoogleSheetsConfig {
  spreadsheetId: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
}

export interface GoogleAuthConfig {
  clientId: string;
  apiKey: string;
  scopes: string[];
}

export interface ContentRow {
  id: string;
  title: string;
  content: string;
  url: string;
  siteName: string;
  imageUrl: string;
  tags: string;
  createdAt: string;
}

export class GoogleAuthService {
  private config: GoogleAuthConfig;
  private tokenClient: any;
  private isGapiInitialized = false;
  private isGisInitialized = false;
  
  constructor(config: GoogleAuthConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    // Load Google Identity Services and GAPI libraries
    await Promise.all([
      this.loadGoogleIdentityServices(),
      this.loadGoogleAPI()
    ]);
    
    await Promise.all([
      this.initializeGapi(),
      this.initializeGis()
    ]);
  }

  private loadGoogleIdentityServices(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (window.google?.accounts) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
      document.head.appendChild(script);
    });
  }

  private loadGoogleAPI(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (window.gapi) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Google API'));
      document.head.appendChild(script);
    });
  }

  private async initializeGapi(): Promise<void> {
    return new Promise((resolve) => {
      window.gapi!.load('client', async () => {
        await window.gapi!.client.init({
          apiKey: this.config.apiKey,
          discoveryDocs: ['https://sheets.googleapis.com/$discovery/rest?version=v4'],
        });
        this.isGapiInitialized = true;
        resolve();
      });
    });
  }

  private initializeGis(): void {
    this.tokenClient = window.google!.accounts.oauth2.initTokenClient({
      client_id: this.config.clientId,
      scope: this.config.scopes.join(' '),
      callback: (response: any) => {
        if (response.error) {
          throw new Error(`Authentication failed: ${response.error}`);
        }
        // Token received, will be handled by the promise
      },
    });
    this.isGisInitialized = true;
  }

  async authenticate(): Promise<string> {
    if (!this.isGapiInitialized || !this.isGisInitialized) {
      throw new Error('Google services not initialized');
    }

    return new Promise((resolve, reject) => {
      this.tokenClient.callback = (response: any) => {
        if (response.error) {
          reject(new Error(`Authentication failed: ${response.error}`));
          return;
        }
        resolve(response.access_token);
      };

      this.tokenClient.requestAccessToken({ prompt: 'consent' });
    });
  }

  revokeAuth(accessToken: string): void {
    window.google!.accounts.oauth2.revoke(accessToken);
    window.gapi!.client.setToken('');
  }
}

export class GoogleSheetsService {
  private config: GoogleSheetsConfig;

  constructor(config: GoogleSheetsConfig) {
    this.config = config;
  }

  private setAuthToken(): void {
    window.gapi!.client.setToken({
      access_token: this.config.accessToken
    });
  }

  async createSpreadsheet(title: string): Promise<string> {
    this.setAuthToken();
    
    try {
      const response = await window.gapi!.client.sheets.spreadsheets.create({
        resource: {
          properties: {
            title: title
          },
          sheets: [{
            properties: {
              title: 'Content',
              gridProperties: {
                rowCount: 1000,
                columnCount: 8
              }
            }
          }]
        }
      });

      const spreadsheetId = response.result.spreadsheetId;
      
      // Add headers to the new sheet
      await this.setupHeaders(spreadsheetId);
      
      return spreadsheetId;
    } catch (error: any) {
      throw new Error(`Failed to create spreadsheet: ${error.message}`);
    }
  }

  private async setupHeaders(spreadsheetId: string): Promise<void> {
    const headers = [
      'ID', 'Title', 'Content', 'URL', 'Site Name', 'Image URL', 'Tags', 'Created At'
    ];

    await window.gapi!.client.sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Content!A1:H1',
      valueInputOption: 'RAW',
      resource: {
        values: [headers]
      }
    });
  }

  async appendRow(data: Omit<ContentRow, 'id'>): Promise<string> {
    this.setAuthToken();
    const rowId = Date.now().toString();
    
    try {
      const values = [
        rowId,
        data.title,
        data.content,
        data.url,
        data.siteName,
        data.imageUrl,
        data.tags,
        data.createdAt
      ];

      await window.gapi!.client.sheets.spreadsheets.values.append({
        spreadsheetId: this.config.spreadsheetId,
        range: 'Content!A:H',
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        resource: {
          values: [values]
        }
      });

      return rowId;
    } catch (error: any) {
      throw new Error(`Failed to append row: ${error.message}`);
    }
  }

  async updateRow(rowId: string, data: Partial<ContentRow>): Promise<void> {
    this.setAuthToken();
    
    try {
      // First, find the row by ID
      const response = await window.gapi!.client.sheets.spreadsheets.values.get({
        spreadsheetId: this.config.spreadsheetId,
        range: 'Content!A:A'
      });

      const rows = response.result.values || [];
      const rowIndex = rows.findIndex((row: string[]) => row[0] === rowId);
      
      if (rowIndex === -1) {
        throw new Error(`Row with ID ${rowId} not found`);
      }

      // Get current row data
      const currentRowResponse = await window.gapi!.client.sheets.spreadsheets.values.get({
        spreadsheetId: this.config.spreadsheetId,
        range: `Content!A${rowIndex + 1}:H${rowIndex + 1}`
      });

      const currentRow = currentRowResponse.result.values?.[0] || [];
      
      // Update with new data
      const updatedRow = [
        rowId, // ID stays the same
        data.title !== undefined ? data.title : currentRow[1],
        data.content !== undefined ? data.content : currentRow[2],
        data.url !== undefined ? data.url : currentRow[3],
        data.siteName !== undefined ? data.siteName : currentRow[4],
        data.imageUrl !== undefined ? data.imageUrl : currentRow[5],
        data.tags !== undefined ? data.tags : currentRow[6],
        data.createdAt !== undefined ? data.createdAt : currentRow[7]
      ];

      await window.gapi!.client.sheets.spreadsheets.values.update({
        spreadsheetId: this.config.spreadsheetId,
        range: `Content!A${rowIndex + 1}:H${rowIndex + 1}`,
        valueInputOption: 'RAW',
        resource: {
          values: [updatedRow]
        }
      });
    } catch (error: any) {
      throw new Error(`Failed to update row: ${error.message}`);
    }
  }

  async deleteRow(rowId: string): Promise<void> {
    // Note: Google Sheets API doesn't have a direct delete row method
    // This would require more complex implementation using batchUpdate
    console.log('Delete row functionality would require Google Sheets API batchUpdate');
  }

  async getAllRows(): Promise<ContentRow[]> {
    this.setAuthToken();
    
    try {
      const response = await window.gapi!.client.sheets.spreadsheets.values.get({
        spreadsheetId: this.config.spreadsheetId,
        range: 'Content!A2:H' // Skip header row
      });

      const rows = response.result.values || [];
      
      return rows.map((row: string[]) => ({
        id: row[0] || '',
        title: row[1] || '',
        content: row[2] || '',
        url: row[3] || '',
        siteName: row[4] || '',
        imageUrl: row[5] || '',
        tags: row[6] || '',
        createdAt: row[7] || ''
      }));
    } catch (error: any) {
      throw new Error(`Failed to fetch rows: ${error.message}`);
    }
  }
}

// Utility functions for Chrome extension environment
export const chromeStorageKey = 'webcapture_sheets_config';

export async function getStoredConfig(): Promise<GoogleSheetsConfig | null> {
  // In Chrome extension, this would use chrome.storage.local
  const stored = localStorage.getItem(chromeStorageKey);
  return stored ? JSON.parse(stored) : null;
}

export async function storeConfig(config: GoogleSheetsConfig): Promise<void> {
  // In Chrome extension, this would use chrome.storage.local
  localStorage.setItem(chromeStorageKey, JSON.stringify(config));
}

export async function clearConfig(): Promise<void> {
  // In Chrome extension, this would use chrome.storage.local
  localStorage.removeItem(chromeStorageKey);
}
