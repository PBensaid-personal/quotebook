import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Bookmark, Save, X, ExternalLink, Sparkles } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface SelectedContent {
  title: string;
  content: string;
  url: string;
  siteName: string;
  imageUrl: string;
  suggestedTags: string[];
}

export default function ExtensionPopup() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Mock selected content - in real extension this would come from content script
  const [selectedContent] = useState<SelectedContent>({
    title: "The Future of Web Development",
    content: "Modern web development has evolved significantly with the introduction of new frameworks and tools that enable developers to create more interactive and performant applications...",
    url: "https://techblog.example.com/web-dev-future",
    siteName: "TechBlog",
    imageUrl: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&h=80",
    suggestedTags: ["web development", "technology"],
  });

  const [customTags, setCustomTags] = useState("");
  const [userTags, setUserTags] = useState<string[]>(["programming"]);

  const saveContentMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/content", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/content"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "Content Saved",
        description: "Your content has been saved to your collection.",
      });
    },
    onError: () => {
      toast({
        title: "Save Failed",
        description: "Failed to save content. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    const allTags = [
      ...selectedContent.suggestedTags,
      ...userTags,
      ...customTags.split(",").map(tag => tag.trim()).filter(Boolean),
    ];
    
    const uniqueTags = [...new Set(allTags)];

    saveContentMutation.mutate({
      title: selectedContent.title,
      content: selectedContent.content,
      url: selectedContent.url,
      siteName: selectedContent.siteName,
      imageUrl: selectedContent.imageUrl,
      tags: uniqueTags,
    });
  };

  const handleAddCustomTag = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && customTags.trim()) {
      const newTags = customTags.split(",").map(tag => tag.trim()).filter(Boolean);
      setUserTags(prev => [...prev, ...newTags]);
      setCustomTags("");
    }
  };

  const removeUserTag = (tagToRemove: string) => {
    setUserTags(prev => prev.filter(tag => tag !== tagToRemove));
  };

  return (
    <div className="max-w-sm mx-auto mt-8 p-4">
      <Card className="bg-white rounded-lg shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-blue-600 text-white p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">WebCapture</h2>
            <Bookmark className="h-5 w-5 text-white/80" />
          </div>
        </div>

        {/* Content Preview */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-start space-x-3">
            <img 
              src={selectedContent.imageUrl}
              alt="Article preview" 
              className="w-16 h-12 rounded object-cover flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-medium text-gray-900 truncate">
                {selectedContent.title}
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                {selectedContent.url}
              </p>
            </div>
          </div>
        </div>

        {/* Selected Content Preview */}
        <div className="p-4 border-b border-gray-200">
          <label className="block text-xs font-medium text-gray-700 mb-2">
            Selected Content
          </label>
          <Textarea
            value={selectedContent.content}
            readOnly
            className="bg-gray-50 text-sm max-h-24 resize-none"
          />
        </div>

        {/* Tags Section */}
        <div className="p-4 border-b border-gray-200">
          <label className="block text-xs font-medium text-gray-700 mb-2">
            Tags
          </label>
          
          {/* Suggested Tags */}
          <div className="flex flex-wrap gap-2 mb-3">
            {selectedContent.suggestedTags.map((tag) => (
              <Badge key={tag} variant="secondary" className="bg-blue-100 text-blue-800">
                <Sparkles className="w-3 h-3 mr-1" />
                {tag}
              </Badge>
            ))}
          </div>

          {/* Tag Input */}
          <Input
            type="text"
            placeholder="Add custom tags (comma-separated)..."
            value={customTags}
            onChange={(e) => setCustomTags(e.target.value)}
            onKeyDown={handleAddCustomTag}
            className="mb-2"
          />

          {/* User Tags */}
          <div className="flex flex-wrap gap-2">
            {userTags.map((tag) => (
              <Badge key={tag} variant="outline" className="bg-gray-100">
                {tag}
                <button 
                  onClick={() => removeUserTag(tag)}
                  className="ml-1 text-gray-500 hover:text-red-500"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-4 space-y-2">
          <Button 
            onClick={handleSave}
            disabled={saveContentMutation.isPending}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            <Save className="w-4 h-4 mr-2" />
            {saveContentMutation.isPending ? "Saving..." : "Save to Collection"}
          </Button>
          <div className="flex space-x-2">
            <Button variant="outline" className="flex-1">
              Cancel
            </Button>
            <Button variant="outline" className="flex-1">
              <ExternalLink className="w-4 h-4 mr-1" />
              View All
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
