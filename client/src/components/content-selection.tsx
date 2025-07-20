import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bookmark, MousePointer, CheckCircle, X, Lightbulb } from "lucide-react";

export default function ContentSelection() {
  const [selectedText, setSelectedText] = useState("The rise of AI-powered development tools is revolutionizing how developers write code, debug applications, and optimize performance. These tools are not just changing workflows—they're fundamentally altering the skills developers need to succeed.");
  const [showSelectionBar, setShowSelectionBar] = useState(true);

  const handleCapture = () => {
    setShowSelectionBar(false);
    setTimeout(() => setShowSelectionBar(true), 3000);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Content Selection Interface</h1>
        <p className="text-gray-600">Simulation of how users would select content on web pages</p>
      </div>

      {/* Mock Webpage with Selection Overlay */}
      <Card className="overflow-hidden mb-8">
        {/* Mock Browser Bar */}
        <div className="bg-gray-100 px-4 py-3 border-b border-gray-200 flex items-center space-x-3">
          <div className="flex space-x-2">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          </div>
          <div className="flex-1 bg-white rounded px-3 py-1 text-sm text-gray-600">
            https://techblog.example.com/future-of-web-development
          </div>
          <div className="flex items-center space-x-2">
            <div className="bg-blue-600 text-white px-2 py-1 rounded text-xs font-medium">
              <Bookmark className="w-3 h-3 mr-1 inline" />
              WebCapture
            </div>
          </div>
        </div>

        {/* Mock Article Content */}
        <CardContent className="p-8 relative">
          {/* Selection Tooltip */}
          <div className="absolute top-4 right-4 bg-blue-600 text-white px-3 py-2 rounded-lg shadow-lg text-sm font-medium z-10 animate-pulse">
            <MousePointer className="w-4 h-4 mr-2 inline" />
            Select text to capture
          </div>

          {/* Article Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              The Future of Web Development: Trends to Watch in 2024
            </h1>
            <div className="flex items-center text-gray-600 text-sm space-x-4">
              <span>By Jane Developer</span>
              <span>•</span>
              <span>March 15, 2024</span>
              <span>•</span>
              <span>5 min read</span>
            </div>
          </div>

          {/* Featured Image */}
          <img
            src="https://images.unsplash.com/photo-1451187580459-43490279c0fa?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=400"
            alt="Future technology workspace"
            className="w-full h-64 object-cover rounded-lg mb-8"
          />

          {/* Article Content with Selection Highlighting */}
          <div className="prose prose-lg max-w-none">
            <p className="text-gray-700 mb-6">
              Web development continues to evolve at a rapid pace, with new technologies and methodologies emerging regularly. As we move through 2024, several key trends are shaping the future of how we build and interact with web applications.
            </p>

            <p className="text-gray-700 mb-6">
              <span className="bg-blue-100 px-1 rounded relative cursor-pointer border-2 border-blue-300">
                {selectedText}
                {/* Selection Indicator */}
                <div className="absolute -top-8 left-0 bg-blue-600 text-white px-2 py-1 rounded text-xs font-medium whitespace-nowrap">
                  <CheckCircle className="w-3 h-3 mr-1 inline" />
                  Selected for capture
                </div>
              </span>
            </p>

            <h2 className="text-2xl font-bold text-gray-900 mb-4">Key Trends Shaping Development</h2>

            <p className="text-gray-700 mb-6">
              Modern frameworks are becoming more sophisticated, offering better performance optimization out of the box. React, Vue, and Angular continue to evolve, while new players like Svelte and Solid.js are gaining traction for their innovative approaches to reactivity and rendering.
            </p>

            <blockquote className="border-l-4 border-blue-600 pl-4 italic text-gray-600 mb-6">
              "The future belongs to developers who can adapt quickly to new tools while maintaining a strong foundation in core web technologies."
            </blockquote>

            <p className="text-gray-700 mb-6">
              Edge computing is moving processing closer to users, reducing latency and improving user experience. This shift requires developers to think differently about architecture and deployment strategies.
            </p>
          </div>

          {/* Selection Action Bar */}
          {showSelectionBar && (
            <Card className="fixed bottom-4 right-4 max-w-sm animate-in slide-in-from-bottom-4">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-gray-900">Content Selected</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowSelectionBar(false)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                  {selectedText.slice(0, 100)}...
                </p>
                <div className="flex space-x-2">
                  <Button
                    onClick={handleCapture}
                    className="bg-blue-600 hover:bg-blue-700 flex-1"
                  >
                    <Bookmark className="w-4 h-4 mr-1" />
                    Capture
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowSelectionBar(false)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {/* Selection Instructions */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
            <Lightbulb className="text-blue-600 mr-2 h-5 w-5" />
            How Content Selection Works
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center mx-auto mb-3">
                1
              </div>
              <h4 className="font-medium text-gray-900 mb-2">Select Text</h4>
              <p className="text-sm text-gray-600">
                Highlight any text on a webpage using your mouse or touch
              </p>
            </div>
            <div className="text-center">
              <div className="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center mx-auto mb-3">
                2
              </div>
              <h4 className="font-medium text-gray-900 mb-2">Click Extension</h4>
              <p className="text-sm text-gray-600">
                Click the WebCapture icon in your browser toolbar
              </p>
            </div>
            <div className="text-center">
              <div className="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center mx-auto mb-3">
                3
              </div>
              <h4 className="font-medium text-gray-900 mb-2">Save & Tag</h4>
              <p className="text-sm text-gray-600">
                Review, add tags, and save to your Google Sheets collection
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
