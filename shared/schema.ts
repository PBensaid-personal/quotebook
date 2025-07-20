import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  googleEmail: text("google_email"),
  googleRefreshToken: text("google_refresh_token"),
  activeSheetId: text("active_sheet_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const contentItems = pgTable("content_items", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  content: text("content").notNull(),
  url: text("url").notNull(),
  siteName: text("site_name"),
  imageUrl: text("image_url"),
  tags: text("tags").array(),
  createdAt: timestamp("created_at").defaultNow(),
  sheetsRowId: text("sheets_row_id"),
});

export const userSettings = pgTable("user_settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  autoDetectMetadata: boolean("auto_detect_metadata").default(true),
  suggestTags: boolean("suggest_tags").default(true),
  autoSave: boolean("auto_save").default(false),
  syncFrequency: text("sync_frequency").default("immediate"),
  queueOffline: boolean("queue_offline").default(true),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertContentItemSchema = createInsertSchema(contentItems).omit({
  id: true,
  createdAt: true,
  sheetsRowId: true,
});

export const insertUserSettingsSchema = createInsertSchema(userSettings).omit({
  id: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type ContentItem = typeof contentItems.$inferSelect;
export type InsertContentItem = z.infer<typeof insertContentItemSchema>;
export type UserSettings = typeof userSettings.$inferSelect;
export type InsertUserSettings = z.infer<typeof insertUserSettingsSchema>;
