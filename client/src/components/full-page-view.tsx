import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, Calendar, Bookmark, Tags, Globe, Trash2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Masonry from "react-masonry-css";
import type { ContentItem } from "@shared/schema";

export default function FullPageView() {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState("");
  const [dateFilter, setDateFilter] = useState("");

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch content items with search and tag parameters
  const { data: items = [], isLoading } = useQuery<ContentItem[]>({
    queryKey: ["/api/content", debouncedSearchQuery, selectedTag],
    queryFn: () => {
      const params = new URLSearchParams();
      if (debouncedSearchQuery) params.set('search', debouncedSearchQuery);
      if (selectedTag && selectedTag !== 'all') params.set('tags', selectedTag);
      
      const url = `/api/content${params.toString() ? '?' + params.toString() : ''}`;
      return fetch(url).then(res => res.json());
    },
  });

  // Fetch statistics
  const { data: stats } = useQuery<{
    totalItems: number;
    totalTags: number;
    thisMonth: number;
    uniqueWebsites: number;
  }>({
    queryKey: ["/api/stats"],
  });

  // Get unique tags for filter dropdown
  const allTags = useMemo((): string[] => {
    return Array.from(new Set(items.flatMap(item => item.tags || [])));
  }, [items]);

  const formatDate = (date: string | Date | null) => {
    if (!date) return "Unknown";
    const d = new Date(date);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - d.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return "1 day ago";
    if (diffDays <= 7) return `${diffDays} days ago`;
    
    // Format as "Jan 16, 2024"
    return d.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const getHostname = (url: string) => {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <div className="h-48 bg-gray-200 rounded-t-lg"></div>
              <CardContent className="p-4">
                <div className="h-4 bg-gray-200 rounded mb-2"></div>
                <div className="h-3 bg-gray-200 rounded mb-3"></div>
                <div className="flex gap-2">
                  <div className="h-6 w-16 bg-gray-200 rounded-full"></div>
                  <div className="h-6 w-20 bg-gray-200 rounded-full"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">


      {/* Search and Filters */}
      <Card className="p-6 mb-8">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search Bar */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              type="text"
              placeholder="Search your collection..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          {/* Filter Dropdown */}
          <Select value={selectedTag || "all"} onValueChange={(value) => setSelectedTag(value === "all" ? "" : value)}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Tags" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tags</SelectItem>
              {allTags.map((tag) => (
                <SelectItem key={tag} value={tag}>{tag}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Date Filter */}
          <Input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="w-48"
          />
        </div>
      </Card>

      {/* Collection Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Bookmark className="h-8 w-8 text-primary mr-4" />
                <div>
                  <p className="text-sm font-medium text-gray-500">Total Items</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalItems}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Tags className="h-8 w-8 text-primary mr-4" />
                <div>
                  <p className="text-sm font-medium text-gray-500">Tags Used</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalTags}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Calendar className="h-8 w-8 text-primary mr-4" />
                <div>
                  <p className="text-sm font-medium text-gray-500">This Month</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.thisMonth}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Globe className="h-8 w-8 text-primary mr-4" />
                <div>
                  <p className="text-sm font-medium text-gray-500">Websites</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.uniqueWebsites}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Content Masonry Grid */}
      <Masonry
        breakpointCols={{
          default: 3,
          1024: 2,
          640: 1
        }}
        className="flex -ml-6 w-auto"
        columnClassName="pl-6 bg-clip-padding"
      >
        {items.map((item) => (
          <Card key={item.id} className="overflow-hidden hover:shadow-lg transition-shadow mb-6">
            {item.imageUrl && (
              <div className="aspect-video">
                <img
                  src={item.imageUrl}
                  alt="Article thumbnail"
                  className="w-full h-48 object-cover"
                />
              </div>
            )}
            <CardContent className="p-4">
              {/* Quote/Content - now larger, no truncation if short */}
              <p className={`text-lg text-gray-600 mb-3 font-medium ${item.content && item.content.split('\n').length <= 8 ? '' : 'line-clamp-3'}`}>
                {item.content}
              </p>
              
              {/* Title - now smaller and below quote, clickable link to source */}
              <a 
                href={item.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm text-gray-900 line-clamp-2 mb-3 block hover:text-primary transition-colors hover:underline"
              >
                {item.title}
              </a>
              
              {/* Tags - now clickable */}
              <div className="flex flex-wrap gap-1 mb-3">
                {item.tags?.slice(0, 3).map((tag) => (
                  <Badge 
                    key={tag} 
                    variant="secondary" 
                    className="text-xs cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                    onClick={() => setSelectedTag(tag)}
                  >
                    {tag}
                  </Badge>
                ))}
                {item.tags && item.tags.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{item.tags.length - 3}
                  </Badge>
                )}
              </div>
              
              {/* Date and Trash - moved together */}
              <div className="flex items-center justify-between text-xs text-gray-500">
                <a 
                  href={`https://${getHostname(item.url)}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="hover:text-primary transition-colors hover:underline"
                >
                  {getHostname(item.url)}
                </a>
                <div className="flex items-center gap-2">
                  <span>{formatDate(item.createdAt)}</span>
                  <Button variant="ghost" size="sm" className="text-gray-400 hover:text-red-500 h-6 w-6 p-0">
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </Masonry>

      {/* Load More Button */}
      <div className="text-center mt-8">
        <Button variant="outline" className="border-primary text-primary hover:bg-accent">
          Load More Items
        </Button>
      </div>
    </div>
  );
}
