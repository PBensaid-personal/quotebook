import { useState } from "react";
import ExtensionPopup from "@/components/extension-popup";
import FullPageView from "@/components/full-page-view";
import SettingsPage from "@/components/settings-page";
import ContentSelection from "@/components/content-selection";
import { cn } from "@/lib/utils";

const tabs = [
  { id: "popup", label: "Extension Popup" },
  { id: "fullpage", label: "Full Page View" },
  { id: "settings", label: "Settings & Setup" },
  { id: "selection", label: "Content Selection" },
];

export default function Home() {
  const [activeTab, setActiveTab] = useState("popup");

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Tabs */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8" aria-label="Extension Views">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors",
                  activeTab === tab.id
                    ? "border-primary text-primary"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                )}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === "popup" && <ExtensionPopup />}
        {activeTab === "fullpage" && <FullPageView />}
        {activeTab === "settings" && <SettingsPage />}
        {activeTab === "selection" && <ContentSelection />}
      </div>
    </div>
  );
}
