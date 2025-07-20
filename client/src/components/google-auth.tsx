import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle, AlertCircle, ExternalLink, Plus, Settings } from 'lucide-react';
import { GoogleAuthService, GoogleSheetsService } from '@/lib/google-sheets';
import { useToast } from '@/hooks/use-toast';

interface GoogleAuthProps {
  onAuthSuccess: (accessToken: string, spreadsheetId?: string) => void;
  onAuthError: (error: string) => void;
}

export default function GoogleAuth({ onAuthSuccess, onAuthError }: GoogleAuthProps) {
  const [isInitializing, setIsInitializing] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isCreatingSheet, setIsCreatingSheet] = useState(false);
  const [isConnectingSheet, setIsConnectingSheet] = useState(false);
  const [authService, setAuthService] = useState<GoogleAuthService | null>(null);
  const [accessToken, setAccessToken] = useState<string>('');
  const [sheetTitle, setSheetTitle] = useState('My Web Content Collection');
  const [existingSheetId, setExistingSheetId] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const { toast } = useToast();

  // Configuration - in production these would come from environment variables
  const googleConfig = {
    clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || 'your-client-id.apps.googleusercontent.com',
    apiKey: import.meta.env.VITE_GOOGLE_API_KEY || 'your-api-key',
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.file'
    ]
  };

  useEffect(() => {
    initializeGoogleServices();
  }, []);

  const initializeGoogleServices = async () => {
    setIsInitializing(true);
    try {
      const service = new GoogleAuthService(googleConfig);
      await service.initialize();
      setAuthService(service);
      toast({
        title: "Google Services Ready",
        description: "You can now authenticate with your Google account.",
      });
    } catch (error: any) {
      onAuthError(`Failed to initialize Google services: ${error.message}`);
    } finally {
      setIsInitializing(false);
    }
  };

  const handleAuthenticate = async () => {
    if (!authService) {
      onAuthError('Google services not initialized');
      return;
    }

    setIsAuthenticating(true);
    try {
      const token = await authService.authenticate();
      setAccessToken(token);
      toast({
        title: "Authentication Successful",
        description: "You're now connected to your Google account.",
      });
    } catch (error: any) {
      onAuthError(`Authentication failed: ${error.message}`);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleCreateNewSheet = async () => {
    if (!accessToken) {
      onAuthError('Please authenticate first');
      return;
    }

    setIsCreatingSheet(true);
    try {
      const sheetsService = new GoogleSheetsService({
        spreadsheetId: '',
        accessToken
      });

      const spreadsheetId = await sheetsService.createSpreadsheet(sheetTitle);
      
      toast({
        title: "Spreadsheet Created",
        description: `"${sheetTitle}" has been created in your Google Drive.`,
      });

      onAuthSuccess(accessToken, spreadsheetId);
    } catch (error: any) {
      onAuthError(`Failed to create spreadsheet: ${error.message}`);
    } finally {
      setIsCreatingSheet(false);
    }
  };

  const handleConnectExistingSheet = async () => {
    if (!accessToken) {
      onAuthError('Please authenticate first');
      return;
    }

    if (!existingSheetId) {
      onAuthError('Please enter a spreadsheet ID');
      return;
    }

    setIsConnectingSheet(true);
    try {
      // Test connection by attempting to read from the sheet
      const sheetsService = new GoogleSheetsService({
        spreadsheetId: existingSheetId,
        accessToken
      });

      await sheetsService.getAllRows();
      
      toast({
        title: "Spreadsheet Connected",
        description: "Successfully connected to your existing spreadsheet.",
      });

      onAuthSuccess(accessToken, existingSheetId);
    } catch (error: any) {
      onAuthError(`Failed to connect to spreadsheet: ${error.message}`);
    } finally {
      setIsConnectingSheet(false);
    }
  };

  const extractSpreadsheetId = (url: string): string => {
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : url;
  };

  const handleSheetUrlChange = (value: string) => {
    const id = extractSpreadsheetId(value);
    setExistingSheetId(id);
  };

  if (isInitializing) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="p-6">
          <div className="flex items-center justify-center space-x-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Initializing Google services...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {/* Authentication Step */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>Step 1: Authenticate with Google</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!accessToken ? (
            <div className="space-y-4">
              <p className="text-gray-600">
                Connect your Google account to access Google Sheets. Your data will be stored in your own Google Drive.
              </p>
              
              {!googleConfig.clientId.includes('your-client-id') ? (
                <Button 
                  onClick={handleAuthenticate} 
                  disabled={isAuthenticating || !authService}
                  className="w-full"
                >
                  {isAuthenticating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Authenticating...
                    </>
                  ) : (
                    <>
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Authenticate with Google
                    </>
                  )}
                </Button>
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Google API credentials are not configured. Please set VITE_GOOGLE_CLIENT_ID and VITE_GOOGLE_API_KEY environment variables.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          ) : (
            <div className="flex items-center space-x-2 text-green-600">
              <CheckCircle className="h-4 w-4" />
              <span>Successfully authenticated with Google</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sheet Setup Step */}
      {accessToken && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Plus className="h-5 w-5" />
              <span>Step 2: Set Up Your Spreadsheet</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Create New Sheet Option */}
            <div className="space-y-4">
              <h3 className="font-medium">Create a New Spreadsheet</h3>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="sheet-title">Spreadsheet Name</Label>
                  <Input
                    id="sheet-title"
                    value={sheetTitle}
                    onChange={(e) => setSheetTitle(e.target.value)}
                    placeholder="My Web Content Collection"
                  />
                </div>
                <Button 
                  onClick={handleCreateNewSheet}
                  disabled={isCreatingSheet || !sheetTitle.trim()}
                  className="w-full"
                >
                  {isCreatingSheet ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating spreadsheet...
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 h-4 w-4" />
                      Create New Spreadsheet
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <div className="flex-1 border-t border-gray-200"></div>
              <span className="text-sm text-gray-500">OR</span>
              <div className="flex-1 border-t border-gray-200"></div>
            </div>

            {/* Connect Existing Sheet Option */}
            <div className="space-y-4">
              <h3 className="font-medium">Use an Existing Spreadsheet</h3>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="sheet-url">Spreadsheet URL or ID</Label>
                  <Input
                    id="sheet-url"
                    value={existingSheetId}
                    onChange={(e) => handleSheetUrlChange(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/... or just the ID"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Paste the full Google Sheets URL or just the spreadsheet ID
                  </p>
                </div>
                <Button 
                  onClick={handleConnectExistingSheet}
                  disabled={isConnectingSheet || !existingSheetId.trim()}
                  variant="outline"
                  className="w-full"
                >
                  {isConnectingSheet ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Connect to Existing Spreadsheet
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Help Information */}
      <Card>
        <CardContent className="p-4">
          <h3 className="font-medium mb-2">Why Google Sheets?</h3>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• Your data stays in your own Google Drive</li>
            <li>• No subscription fees or account management</li>
            <li>• Access your content from anywhere</li>
            <li>• Easy to export, share, or analyze your data</li>
            <li>• Free to use with your Google account</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}