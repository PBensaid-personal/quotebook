import { users, contentItems, userSettings, type User, type InsertUser, type ContentItem, type InsertContentItem, type UserSettings, type InsertUserSettings } from "@shared/schema";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, updates: Partial<User>): Promise<User | undefined>;

  // Content operations
  getContentItems(userId: number): Promise<ContentItem[]>;
  getContentItem(id: number, userId: number): Promise<ContentItem | undefined>;
  createContentItem(item: InsertContentItem): Promise<ContentItem>;
  updateContentItem(id: number, userId: number, updates: Partial<ContentItem>): Promise<ContentItem | undefined>;
  deleteContentItem(id: number, userId: number): Promise<boolean>;
  searchContentItems(userId: number, query: string, tags?: string[]): Promise<ContentItem[]>;

  // Settings operations
  getUserSettings(userId: number): Promise<UserSettings | undefined>;
  updateUserSettings(userId: number, settings: Partial<UserSettings>): Promise<UserSettings>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private contentItems: Map<number, ContentItem>;
  private userSettings: Map<number, UserSettings>;
  private currentUserId: number;
  private currentContentId: number;
  private currentSettingsId: number;

  constructor() {
    this.users = new Map();
    this.contentItems = new Map();
    this.userSettings = new Map();
    this.currentUserId = 1;
    this.currentContentId = 1;
    this.currentSettingsId = 1;

    // Add a demo user with sample data
    const demoUser: User = {
      id: 1,
      username: "demo",
      password: "demo123",
      googleEmail: "john.doe@gmail.com",
      googleRefreshToken: "mock_refresh_token",
      activeSheetId: "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
      createdAt: new Date(),
    };
    this.users.set(1, demoUser);
    this.currentUserId = 2;

    // Add sample content items
    const sampleItems: ContentItem[] = [
      {
        id: 1,
        userId: 1,
        title: "Future of Remote Work: Trends and Predictions",
        content: "The pandemic has fundamentally changed how we work, and remote work is here to stay. This comprehensive analysis explores the key trends shaping the future of distributed teams and the technologies enabling this transformation.",
        url: "https://forbes.com/remote-work-future",
        siteName: "Forbes",
        imageUrl: "https://images.unsplash.com/photo-1497366216548-37526070297c?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=200",
        tags: ["remote work", "trends", "future"],
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        sheetsRowId: "2",
      },
      {
        id: 2,
        userId: 1,
        title: "10 Essential JavaScript ES2024 Features",
        content: "JavaScript continues to evolve with new features that make development more efficient and enjoyable. Here are the top features every developer should know about in the latest ECMAScript specification.",
        url: "https://medium.com/javascript-es2024",
        siteName: "Medium",
        imageUrl: "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=200",
        tags: ["javascript", "es2024", "programming"],
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        sheetsRowId: "3",
      },
      {
        id: 3,
        userId: 1,
        title: "Design Systems: Building Consistency at Scale",
        content: "Learn how to create and maintain design systems that ensure consistency across large product teams and multiple platforms. This guide covers everything from component libraries to documentation.",
        url: "https://designsystem.guide/consistency",
        siteName: "Design System Guide",
        imageUrl: "https://images.unsplash.com/photo-1581291518857-4e27b48ff24e?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=200",
        tags: ["design", "ui/ux", "systems"],
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        sheetsRowId: "4",
      },
    ];

    sampleItems.forEach(item => this.contentItems.set(item.id, item));
    this.currentContentId = 4;

    // Add default settings
    const defaultSettings: UserSettings = {
      id: 1,
      userId: 1,
      autoDetectMetadata: true,
      suggestTags: true,
      autoSave: false,
      syncFrequency: "immediate",
      queueOffline: true,
    };
    this.userSettings.set(1, defaultSettings);
    this.currentSettingsId = 2;
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { 
      ...insertUser, 
      id,
      googleEmail: null,
      googleRefreshToken: null,
      activeSheetId: null,
      createdAt: new Date(),
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: number, updates: Partial<User>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser = { ...user, ...updates };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async getContentItems(userId: number): Promise<ContentItem[]> {
    return Array.from(this.contentItems.values())
      .filter(item => item.userId === userId)
      .sort((a, b) => b.createdAt!.getTime() - a.createdAt!.getTime());
  }

  async getContentItem(id: number, userId: number): Promise<ContentItem | undefined> {
    const item = this.contentItems.get(id);
    return item && item.userId === userId ? item : undefined;
  }

  async createContentItem(insertItem: InsertContentItem): Promise<ContentItem> {
    const id = this.currentContentId++;
    const item: ContentItem = {
      ...insertItem,
      id,
      createdAt: new Date(),
      sheetsRowId: null,
      tags: insertItem.tags || null,
      siteName: insertItem.siteName || null,
      imageUrl: insertItem.imageUrl || null,
    };
    this.contentItems.set(id, item);
    return item;
  }

  async updateContentItem(id: number, userId: number, updates: Partial<ContentItem>): Promise<ContentItem | undefined> {
    const item = this.contentItems.get(id);
    if (!item || item.userId !== userId) return undefined;
    
    const updatedItem = { ...item, ...updates };
    this.contentItems.set(id, updatedItem);
    return updatedItem;
  }

  async deleteContentItem(id: number, userId: number): Promise<boolean> {
    const item = this.contentItems.get(id);
    if (!item || item.userId !== userId) return false;
    
    return this.contentItems.delete(id);
  }

  async searchContentItems(userId: number, query: string, tags?: string[]): Promise<ContentItem[]> {
    const items = await this.getContentItems(userId);
    const lowerQuery = query.toLowerCase();
    
    return items.filter(item => {
      const matchesQuery = !query || 
        item.title.toLowerCase().includes(lowerQuery) ||
        item.content.toLowerCase().includes(lowerQuery) ||
        item.url.toLowerCase().includes(lowerQuery);
      
      const matchesTags = !tags || tags.length === 0 ||
        tags.some(tag => item.tags?.includes(tag));
      
      return matchesQuery && matchesTags;
    });
  }

  async getUserSettings(userId: number): Promise<UserSettings | undefined> {
    return Array.from(this.userSettings.values()).find(settings => settings.userId === userId);
  }

  async updateUserSettings(userId: number, settingsUpdate: Partial<UserSettings>): Promise<UserSettings> {
    let settings = await this.getUserSettings(userId);
    
    if (!settings) {
      const id = this.currentSettingsId++;
      settings = {
        id,
        userId,
        autoDetectMetadata: true,
        suggestTags: true,
        autoSave: false,
        syncFrequency: "immediate",
        queueOffline: true,
        ...settingsUpdate,
      };
      this.userSettings.set(id, settings);
    } else {
      const updatedSettings = { ...settings, ...settingsUpdate };
      this.userSettings.set(settings.id, updatedSettings);
      settings = updatedSettings;
    }
    
    return settings;
  }
}

export const storage = new MemStorage();
