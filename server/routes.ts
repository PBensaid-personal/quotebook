import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertContentItemSchema, insertUserSettingsSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Get current user (mock session)
  app.get("/api/user", async (req, res) => {
    const user = await storage.getUser(1); // Mock user ID
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  });

  // Update user Google integration
  app.patch("/api/user/google", async (req, res) => {
    const schema = z.object({
      googleEmail: z.string().email().optional(),
      googleRefreshToken: z.string().optional(),
      activeSheetId: z.string().optional(),
    });

    try {
      const data = schema.parse(req.body);
      const user = await storage.updateUser(1, data);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      res.status(400).json({ message: "Invalid request data" });
    }
  });

  // Get content items
  app.get("/api/content", async (req, res) => {
    const { search, tags } = req.query;
    const userId = 1; // Mock user ID

    try {
      let items;
      if (search || tags) {
        const searchQuery = typeof search === 'string' ? search : '';
        const tagArray = typeof tags === 'string' ? tags.split(',').filter(Boolean) : undefined;
        items = await storage.searchContentItems(userId, searchQuery, tagArray);
      } else {
        items = await storage.getContentItems(userId);
      }
      res.json(items);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch content items" });
    }
  });

  // Create content item
  app.post("/api/content", async (req, res) => {
    try {
      const data = insertContentItemSchema.parse({
        ...req.body,
        userId: 1, // Mock user ID
      });
      const item = await storage.createContentItem(data);
      res.status(201).json(item);
    } catch (error) {
      res.status(400).json({ message: "Invalid content item data" });
    }
  });

  // Update content item
  app.patch("/api/content/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const userId = 1; // Mock user ID

    try {
      const updates = req.body;
      const item = await storage.updateContentItem(id, userId, updates);
      if (!item) {
        return res.status(404).json({ message: "Content item not found" });
      }
      res.json(item);
    } catch (error) {
      res.status(400).json({ message: "Failed to update content item" });
    }
  });

  // Delete content item
  app.delete("/api/content/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const userId = 1; // Mock user ID

    const success = await storage.deleteContentItem(id, userId);
    if (!success) {
      return res.status(404).json({ message: "Content item not found" });
    }
    res.json({ message: "Content item deleted" });
  });

  // Get user settings
  app.get("/api/settings", async (req, res) => {
    const userId = 1; // Mock user ID
    const settings = await storage.getUserSettings(userId);
    if (!settings) {
      // Return default settings
      const defaultSettings = {
        autoDetectMetadata: true,
        suggestTags: true,
        autoSave: false,
        syncFrequency: "immediate",
        queueOffline: true,
      };
      res.json(defaultSettings);
    } else {
      res.json(settings);
    }
  });

  // Update user settings
  app.patch("/api/settings", async (req, res) => {
    const userId = 1; // Mock user ID

    try {
      const data = insertUserSettingsSchema.partial().parse(req.body);
      const settings = await storage.updateUserSettings(userId, data);
      res.json(settings);
    } catch (error) {
      res.status(400).json({ message: "Invalid settings data" });
    }
  });

  // Extract metadata from URL
  app.post("/api/extract-metadata", async (req, res) => {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ message: "URL is required" });
    }

    try {
      // Mock metadata extraction - in real implementation, this would fetch the URL
      // and extract metadata using libraries like cheerio or puppeteer
      const mockMetadata = {
        title: "The Future of Web Development",
        description: "Modern web development has evolved significantly with the introduction of new frameworks and tools...",
        siteName: "TechBlog",
        imageUrl: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=200",
        suggestedTags: ["web development", "technology", "programming"],
      };

      res.json(mockMetadata);
    } catch (error) {
      res.status(500).json({ message: "Failed to extract metadata" });
    }
  });

  // Get content statistics
  app.get("/api/stats", async (req, res) => {
    const userId = 1; // Mock user ID
    
    try {
      const items = await storage.getContentItems(userId);
      const now = new Date();
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      const stats = {
        totalItems: items.length,
        totalTags: [...new Set(items.flatMap(item => item.tags || []))].length,
        thisMonth: items.filter(item => item.createdAt && item.createdAt >= thisMonth).length,
        uniqueWebsites: [...new Set(items.map(item => new URL(item.url).hostname))].length,
      };

      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to get statistics" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
