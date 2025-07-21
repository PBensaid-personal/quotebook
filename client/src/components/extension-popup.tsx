import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

export default function ExtensionPopup() {
  const { toast } = useToast();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("");
  const [statusType, setStatusType] = useState<"info" | "success" | "error">("info");
  const [debugLog, setDebugLog] = useState("");

  // Simulate the Chrome extension's working authentication
  useEffect(() => {
    const checkAuth = () => {
      setStatus("Checking authentication...");
      setStatusType("info");
      
      setTimeout(() => {
        setStatus("");
        setIsAuthenticated(false);
      }, 1000);
    };
    
    checkAuth();
  }, []);

  const handleAuthenticate = () => {
    setStatus("Starting authentication...");
    setStatusType("info");
    addDebugLog("Starting OAuth flow with chrome.identity.getAuthToken");
    
    setTimeout(() => {
      setStatus("Authentication successful!");
      setStatusType("success");
      addDebugLog("Access token received: ya29.a0AcM612...");
      
      setTimeout(() => {
        setStatus("Setting up Google Sheets...");
        setStatusType("info");
        addDebugLog("Creating spreadsheet...");
        
        setTimeout(() => {
          setStatus("Google Sheets connected!");
          setStatusType("success");
          addDebugLog("Spreadsheet created: 1ABC-DEF123...");
          setIsAuthenticated(true);
          
          setTimeout(() => setStatus(""), 3000);
        }, 1500);
      }, 1000);
    }, 2000);
  };

  const addDebugLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugLog(prev => prev + `${timestamp}: ${message}\n`);
  };

  const handleSave = () => {
    if (!content.trim()) {
      setStatus("Please enter some content to save");
      setStatusType("error");
      return;
    }

    setStatus("Saving to Google Sheets...");
    setStatusType("info");
    addDebugLog("Saving quote to spreadsheet...");

    setTimeout(() => {
      setStatus("Saved successfully!");
      setStatusType("success");
      addDebugLog("Quote saved successfully");
      
      setTitle("");
      setContent("");
      setNotes("");
      
      toast({
        title: "Quote Saved",
        description: "Your quote has been saved to Google Sheets!",
      });
      
      setTimeout(() => setStatus(""), 3000);
    }, 1500);
  };

  const getStatusClass = () => {
    switch (statusType) {
      case "success": return "bg-green-50 text-green-700 border-green-200";
      case "error": return "bg-red-50 text-red-700 border-red-200";
      case "info": return "bg-blue-50 text-blue-700 border-blue-200";
      default: return "bg-gray-50 text-gray-700 border-gray-200";
    }
  };

  return (
    <div className="max-w-sm mx-auto mt-8 p-4">
      <Card className="bg-white rounded-lg shadow-lg overflow-hidden" style={{ width: "350px" }}>
        {/* Header */}
        <div className="bg-blue-600 text-white p-5">
          <h1 className="text-lg font-medium text-center">Quote Collector</h1>
        </div>

        {/* Auth Section */}
        {!isAuthenticated && (
          <div className="p-5 text-center">
            <p className="mb-4 text-gray-600">Connect to Google Sheets to save your quotes</p>
            <Button 
              onClick={handleAuthenticate}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              Connect with Google
            </Button>
            {status && (
              <div className={`mt-3 p-2 rounded text-sm border ${getStatusClass()}`}>
                {status}
              </div>
            )}
          </div>
        )}

        {/* Main Section */}
        {isAuthenticated && (
          <div className="p-5">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title
                </label>
                <Input
                  type="text"
                  placeholder="Enter a title for this quote"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Selected Text
                </label>
                <Textarea
                  placeholder="Selected text will appear here"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (optional)
                </label>
                <Input
                  type="text"
                  placeholder="Add any notes or tags"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <Button 
                onClick={handleSave}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
              >
                Save to Google Sheets
              </Button>

              {status && (
                <div className={`p-2 rounded text-sm border ${getStatusClass()}`}>
                  {status}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Debug Log */}
        {debugLog && (
          <div className="p-5 border-t bg-gray-50">
            <div className="bg-gray-100 p-3 rounded text-xs font-mono whitespace-pre-wrap">
              {debugLog}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}