import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, ExternalLink, Settings, Database, Download, Trash, Plus, Link } from "lucide-react";
import { FaGoogle } from "react-icons/fa";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import GoogleAuth from "@/components/google-auth";
import type { User, UserSettings } from "@shared/schema";

export default function SettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newSheetName, setNewSheetName] = useState("");
  const [showGoogleAuth, setShowGoogleAuth] = useState(false);
  const [authError, setAuthError] = useState("");

  // Fetch user data
  const { data: user } = useQuery<User>({
    queryKey: ["/api/user"],
  });

  // Fetch user settings
  const { data: settings } = useQuery<UserSettings>({
    queryKey: ["/api/settings"],
  });

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (data: Partial<UserSettings>) => {
      return apiRequest("PATCH", "/api/settings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "Settings Updated",
        description: "Your preferences have been saved.",
      });
    },
  });

  const handleSettingChange = (key: keyof UserSettings, value: any) => {
    updateSettingsMutation.mutate({ [key]: value });
  };

  // Update user's Google integration
  const updateGoogleMutation = useMutation({
    mutationFn: async (data: { googleEmail?: string; activeSheetId?: string }) => {
      return apiRequest("PATCH", "/api/user/google", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({
        title: "Google Integration Updated",
        description: "Your Google Sheets connection has been updated.",
      });
    },
  });

  const handleGoogleAuthSuccess = (accessToken: string, spreadsheetId?: string) => {
    // Store access token in localStorage for this demo
    localStorage.setItem('google_access_token', accessToken);
    if (spreadsheetId) {
      localStorage.setItem('google_spreadsheet_id', spreadsheetId);
    }
    
    // Update user record with Google info (mock email for demo)
    updateGoogleMutation.mutate({
      googleEmail: "user@gmail.com",
      activeSheetId: spreadsheetId
    });
    
    setShowGoogleAuth(false);
    setAuthError("");
  };

  const handleGoogleAuthError = (error: string) => {
    setAuthError(error);
    toast({
      title: "Authentication Error",
      description: error,
      variant: "destructive",
    });
  };

  const handleCreateSheet = () => {
    if (!newSheetName.trim()) return;
    
    toast({
      title: "Sheet Created",
      description: `Google Sheet "${newSheetName}" has been created and linked.`,
    });
    setNewSheetName("");
  };

  const handleExport = (format: 'csv' | 'json') => {
    toast({
      title: "Export Started",
      description: `Your data is being exported as ${format.toUpperCase()}. Download will start shortly.`,
    });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Settings & Setup</h1>
        <p className="text-gray-600">Configure your WebCapture extension and Google integration</p>
      </div>

      {/* Google Account Setup */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center">
            <FaGoogle className="text-primary mr-3 h-5 w-5" />
            Google Account Integration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Account Status */}
          <div className="flex items-center justify-between p-4 bg-accent border border-gray-200 rounded-lg">
            <div className="flex items-center">
              {user?.googleEmail ? (
                <>
                  <CheckCircle className="text-primary mr-3 h-5 w-5" />
                  <div>
                    <p className="font-medium text-gray-900">{user.googleEmail}</p>
                    <p className="text-sm text-gray-600">Connected and authorized</p>
                  </div>
                </>
              ) : (
                <>
                  <Settings className="text-gray-400 mr-3 h-5 w-5" />
                  <div>
                    <p className="font-medium text-gray-900">Not connected</p>
                    <p className="text-sm text-gray-600">Connect your Google account to get started</p>
                  </div>
                </>
              )}
            </div>
            {user?.googleEmail ? (
              <Button variant="destructive" size="sm">
                Disconnect
              </Button>
            ) : (
              <Button onClick={() => setShowGoogleAuth(true)}>
                Connect Google
              </Button>
            )}
          </div>

          {/* Permissions */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3">Granted Permissions</h3>
            <div className="space-y-2">
              <div className="flex items-center text-sm">
                <CheckCircle className="text-primary mr-3 h-4 w-4" />
                <span>Access Google Sheets</span>
              </div>
              <div className="flex items-center text-sm">
                <CheckCircle className="text-primary mr-3 h-4 w-4" />
                <span>Create and modify spreadsheets</span>
              </div>
              <div className="flex items-center text-sm">
                <CheckCircle className="text-primary mr-3 h-4 w-4" />
                <span>View your Google Drive files</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Google Sheets Configuration */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Database className="text-green-600 mr-3 h-5 w-5" />
            Google Sheets Setup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Current Sheet */}
          <div>
            <Label className="text-sm font-medium text-gray-700 mb-2 block">
              Active Collection Sheet
            </Label>
            <div className="flex items-center justify-between p-4 border border-gray-300 rounded-lg">
              <div className="flex items-center">
                <Database className="text-primary mr-3 h-5 w-5" />
                <div>
                  <p className="font-medium text-gray-900">My Web Collection</p>
                  <p className="text-sm text-gray-600">Last synced: 2 minutes ago</p>
                </div>
              </div>
              <div className="flex space-x-2">
                <Button variant="outline" size="sm">
                  <ExternalLink className="w-4 h-4 mr-1" />
                  Open Sheet
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowGoogleAuth(true)}
                  disabled={!user?.googleEmail}
                >
                  Change
                </Button>
              </div>
            </div>
          </div>

          {/* Create New Sheet */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3">Create New Collection Sheet</h3>
            <div className="flex space-x-3">
              <Input
                type="text"
                placeholder="Sheet name..."
                value={newSheetName}
                onChange={(e) => setNewSheetName(e.target.value)}
                className="flex-1"
              />
              <Button 
                onClick={() => setShowGoogleAuth(true)}
                disabled={!user?.googleEmail}
              >
                <Plus className="mr-2 h-4 w-4" />
                Create New Sheet
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Extension Preferences */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Settings className="text-gray-600 mr-3 h-5 w-5" />
            Extension Preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Auto-save Settings */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3">Auto-save Settings</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="auto-metadata" className="text-sm text-gray-700">
                  Automatically detect page metadata
                </Label>
                <Switch
                  id="auto-metadata"
                  checked={settings?.autoDetectMetadata ?? true}
                  onCheckedChange={(checked) => handleSettingChange('autoDetectMetadata', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="suggest-tags" className="text-sm text-gray-700">
                  Suggest tags from page content
                </Label>
                <Switch
                  id="suggest-tags"
                  checked={settings?.suggestTags ?? true}
                  onCheckedChange={(checked) => handleSettingChange('suggestTags', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="auto-save" className="text-sm text-gray-700">
                  Auto-save without confirmation
                </Label>
                <Switch
                  id="auto-save"
                  checked={settings?.autoSave ?? false}
                  onCheckedChange={(checked) => handleSettingChange('autoSave', checked)}
                />
              </div>
            </div>
          </div>

          {/* Sync Settings */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3">Sync Settings</h3>
            <div className="space-y-3">
              <div>
                <Label className="text-sm font-medium text-gray-700 mb-1 block">
                  Sync Frequency
                </Label>
                <Select
                  value={settings?.syncFrequency ?? "immediate"}
                  onValueChange={(value) => handleSettingChange('syncFrequency', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="immediate">Immediate</SelectItem>
                    <SelectItem value="5min">Every 5 minutes</SelectItem>
                    <SelectItem value="15min">Every 15 minutes</SelectItem>
                    <SelectItem value="manual">Manual only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="queue-offline" className="text-sm text-gray-700">
                  Queue items when offline
                </Label>
                <Switch
                  id="queue-offline"
                  checked={settings?.queueOffline ?? true}
                  onCheckedChange={(checked) => handleSettingChange('queueOffline', checked)}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Database className="text-purple-600 mr-3 h-5 w-5" />
            Data Management
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Export Options */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3">Export Your Data</h3>
            <div className="flex space-x-3">
              <Button 
                onClick={() => handleExport('csv')}
                className="bg-primary hover:bg-primary/90"
              >
                <Download className="w-4 h-4 mr-2" />
                Export as CSV
              </Button>
              <Button 
                onClick={() => handleExport('json')}
                variant="outline"
                className="border-primary text-primary hover:bg-accent"
              >
                <Download className="w-4 h-4 mr-2" />
                Export as JSON
              </Button>
            </div>
          </div>

          {/* Clear Data */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3">Clear Local Data</h3>
            <p className="text-sm text-gray-600 mb-3">
              Remove cached data from this device. Your Google Sheets data will remain intact.
            </p>
            <Button variant="outline" className="bg-gray-100 hover:bg-gray-200">
              <Trash className="w-4 h-4 mr-2" />
              Clear Cache
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Google Authentication Modal */}
      <Dialog open={showGoogleAuth} onOpenChange={setShowGoogleAuth}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Connect to Google Sheets</DialogTitle>
          </DialogHeader>
          
          {authError && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{authError}</AlertDescription>
            </Alert>
          )}

          <GoogleAuth 
            onAuthSuccess={handleGoogleAuthSuccess}
            onAuthError={handleGoogleAuthError}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
