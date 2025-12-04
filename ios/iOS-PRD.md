# Quotebook iOS App - Technical Specification

**Version:** 1.0
**Date:** December 2, 2025

---

## 1. Core Assumptions

### 1.1 Authentication & Security
- **No account creation** - Users authenticate directly with Google
- **OAuth 2.0 via Google Sign-In SDK** for iOS
- **Keychain storage** for secure token persistence

### 1.2 Data Architecture
- **Google Sheets as source of truth**
- **Sheet structure:**
  - Column A: Title
  - Column B: Content
  - Column C: URL
  - Column D: Tags (comma-separated)
  - Column E: Timestamp (ISO 8601)
  - Column F: Image URLs (pipe-delimited: `|||`)
  - Column G: Price

### 1.3 Connectivity & Offline Support
- **Local-first architecture** - All operations work offline
- **SQLite local cache** - Full quote database cached on device
- **Background sync** - Automatic sync when connectivity available
- **Conflict resolution** - Last-write-wins with timestamp precedence

### 1.4 Multi-Collection Support
- **Tab-based collections** - Each Google Sheet tab = one collection
- **Collection switching** - Seamless navigation between collections
- **Collection management** - Create, rename, delete collections from app

---

## 2. Feature Requirements

### 2.1 Must-Have Features (MVP)

#### Authentication
- Google Sign-In button on launch screen
- OAuth 2.0 flow using Google Sign-In SDK
- Automatic spreadsheet detection (find existing "Quotebook Collection")
- Sheet creation if none exists
- Token persistence in iOS Keychain
- Auto-refresh on app launch

#### Quote Capture
- Manual text entry (primary input)
- Share extension (capture from Safari, Notes, any app)
- Universal clipboard detection (optional prompt)
- Source metadata: title, URL (optional), timestamp

#### Tag Management
- Autocomplete from existing tags
- Multi-tag selection
- Tag chips UI (removable)
- Most-used tags (top 10)
- Inline tag creation

#### Image Support
- Display images from URLs stored in Google Sheets
- Multiple images per quote (gallery carousel)
- Image gallery (swipeable full-screen viewer)
- Automatic image caching via Kingfisher library

#### Price Tracking
- Optional price field
- Currency-aware input
- Currency detection from locale
- Price totals per collection/tag filter

#### Quote Browsing & Search
- Masonry grid layout (Pinterest-style)
- Search bar (full-text: title, content, tags)
- Tag filtering (multi-select)
- Collection selector
- Sort: Recent (default), Alphabetical, By tag
- Infinite scroll with pagination

#### Quote Detail View
- Full content display
- Metadata: URL (tappable), timestamp (relative), tags (tappable), price
- Image gallery (swipeable)
- Actions: Edit, Delete (with confirmation), Share

#### Offline Support
- Full offline read (browse entire cached collection)
- Offline write (capture quotes without connectivity)
- Sync queue (pending changes stored locally)
- Background sync (auto-sync when online)
- Sync indicator (visual feedback)

#### Multi-Collection Management
- Collection list view (all sheet tabs)
- Create collection (add new sheet tab)
- Switch collection
- Collection stats (quote count)

### 2.2 Should-Have Features (P1)

#### Quote Editing
- Edit mode (modify existing quotes)
- Update: content, tags, price, image URLs
- Change tracking (mark as modified, update timestamp)

#### Batch Operations
- Multi-select mode
- Bulk delete
- Bulk tag (add tag to multiple quotes)
- Move to collection

---

## 3. Design System

### 3.1 Color Palette

```swift
// Primary
let primaryYellow = Color(hue: 48/360, saturation: 1.0, brightness: 0.53) // #FFD910
let primaryYellowHover = Color(hue: 48/360, saturation: 1.0, brightness: 0.48)

// Dark
let darkBlue = Color(hue: 220/360, saturation: 0.30, brightness: 0.18)
let darkBackground = Color(hue: 220/360, saturation: 0.04, brightness: 0.16)
let darkInput = Color(hue: 0, saturation: 0, brightness: 0.07) // #111111

// Text
let textDark = Color(hue: 20/360, saturation: 0.14, brightness: 0.04)
let textPrimary = Color(hue: 25/360, saturation: 0.05, brightness: 0.45)
let textLight = Color(hue: 210/360, saturation: 0.14, brightness: 0.83) // #cbd5e1

// Grays
let white = Color.white
let gray200 = Color(hue: 20/360, saturation: 0.06, brightness: 0.96) // #f6f6f6
let gray300 = Color(hue: 20/360, saturation: 0.06, brightness: 0.90)
let gray500 = Color(hue: 0, saturation: 0, brightness: 0.40) // #666666

// Utility
let successGreen = Color(hue: 142/360, saturation: 0.71, brightness: 0.45) // #22c55e
let dangerRed = Color(hue: 0, saturation: 0.72, brightness: 0.51) // #dc2626
```

### 3.2 Typography

```swift
// Primary Font: SF Pro (System)
let headlineFont = Font.system(size: 28, weight: .bold, design: .default)
let bodyFont = Font.system(size: 16, weight: .regular, design: .default)
let captionFont = Font.system(size: 13, weight: .regular, design: .default)
let buttonFont = Font.system(size: 16, weight: .semibold, design: .default)

// Secondary Font: Libre Baskerville (optional for quote content)
let quoteFont = Font.custom("LibreBaskerville-Regular", size: 17)
```

### 3.3 Spacing & Layout

```swift
let spacingXS: CGFloat = 4
let spacingSM: CGFloat = 8
let spacingMD: CGFloat = 12
let spacingLG: CGFloat = 16
let spacingXL: CGFloat = 20
let spacing2XL: CGFloat = 24

let radiusSM: CGFloat = 4
let radiusMD: CGFloat = 6
let radiusLG: CGFloat = 8
let radiusXL: CGFloat = 12
let radiusPill: CGFloat = 20
```

### 3.4 UI Components

#### Cards
- Border radius: 12pt
- Shadow: 0 2px 8px rgba(0,0,0,0.12)
- Padding: 16pt
- Background: White with subtle border

#### Buttons
- Primary: Yellow background, dark text, 12pt radius
- Secondary: White background, gray border, 12pt radius
- Icon buttons: 44x44pt touch target
- Height: 44pt minimum

#### Tag Chips
- Border radius: 20pt (pill)
- Padding: 6pt vertical, 12pt horizontal
- Background: Gray 200, hover = Yellow
- Font size: 14pt

### 3.5 Navigation

**Tab Bar (primary navigation):**
- Browse (home icon)
- Search (magnifying glass)
- Add Quote (plus icon)
- Collections (folder icon)
- Settings (gear icon)

**Navigation Bar (secondary):**
- Collection picker (dropdown)
- Search bar (collapsible)
- Filter button (tag icon)

---

## 4. Technical Architecture

### 4.1 Technology Stack

- **Swift 5.9+**
- **SwiftUI** (UI framework)
- **Combine** (reactive framework)
- **iOS 17.0+** (minimum deployment target)

**Key Dependencies:**
- Google Sign-In SDK for iOS
- Google Sheets API v4
- SQLite + GRDB.swift
- **Kingfisher** (async image loading with automatic disk/memory caching)

### 4.2 Local Database Schema (SQLite)

```sql
-- Quotes table
CREATE TABLE quotes (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    url TEXT,
    timestamp TEXT NOT NULL,
    price TEXT,
    collection_id TEXT NOT NULL,
    sync_status INTEGER DEFAULT 0, -- 0=synced, 1=pending_create, 2=pending_update, 3=pending_delete
    last_modified TEXT NOT NULL,
    sheet_row_index INTEGER,
    FOREIGN KEY (collection_id) REFERENCES collections(id)
);

-- Tags table
CREATE TABLE tags (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    usage_count INTEGER DEFAULT 0
);

CREATE TABLE quote_tags (
    quote_id TEXT NOT NULL,
    tag_id TEXT NOT NULL,
    PRIMARY KEY (quote_id, tag_id),
    FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

-- Images table
CREATE TABLE images (
    id TEXT PRIMARY KEY,
    quote_id TEXT NOT NULL,
    url TEXT NOT NULL,
    display_order INTEGER NOT NULL,
    FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE
);

-- Collections table
CREATE TABLE collections (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    sheet_id TEXT NOT NULL,
    quote_count INTEGER DEFAULT 0,
    last_synced TEXT
);

-- Sync queue
CREATE TABLE sync_queue (
    id TEXT PRIMARY KEY,
    quote_id TEXT NOT NULL,
    operation TEXT NOT NULL, -- CREATE, UPDATE, DELETE
    payload TEXT,
    created_at TEXT NOT NULL,
    retry_count INTEGER DEFAULT 0
);
```

### 4.3 Data Flow

**Quote Creation:**
1. User creates quote in UI
2. Save to SQLite with `sync_status = pending_create`
3. Add to sync_queue
4. If online: immediate background sync
5. If offline: queue for next sync
6. On successful sync: update `sync_status = synced`, remove from queue

**Quote Retrieval:**
1. App launch: load from SQLite cache
2. Background sync: fetch latest from Google Sheets
3. Merge changes (last-write-wins based on timestamp)
4. Update local cache
5. Refresh UI

### 4.4 Google Sheets Integration

**Authentication:**
```swift
// Request scopes
let scopes = ["https://www.googleapis.com/auth/spreadsheets"]

// Sign in
GIDSignIn.sharedInstance.signIn(withPresenting: viewController) { result, error in
    guard let user = result?.user else { return }
    let accessToken = user.accessToken.tokenString
    // Store in Keychain
}
```

**API Operations:**

```swift
// Search for existing spreadsheet
GET https://www.googleapis.com/drive/v3/files?q=name='Quotebook Collection' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false

// Create spreadsheet
POST https://sheets.googleapis.com/v4/spreadsheets
Body: {
  "properties": { "title": "Quotebook Collection" },
  "sheets": [{ "properties": { "title": "My quotes" } }]
}

// Read quotes
GET https://sheets.googleapis.com/v4/spreadsheets/{spreadsheetId}/values/'{sheetName}'!A2:G1000

// Create quote (append row)
POST https://sheets.googleapis.com/v4/spreadsheets/{spreadsheetId}/values/'{sheetName}'!A:G:append?valueInputOption=RAW
Body: {
  "values": [[title, content, url, tags, timestamp, images, price]]
}

// Update quote (append + delete old row)
POST https://sheets.googleapis.com/v4/spreadsheets/{spreadsheetId}:batchUpdate
Body: {
  "requests": [{
    "deleteDimension": {
      "range": { "sheetId": sheetId, "dimension": "ROWS", "startIndex": rowIndex, "endIndex": rowIndex+1 }
    }
  }]
}
```

### 4.5 Sync Strategy

**Full Sync (on app launch):**
1. Fetch all sheets metadata (list tabs)
2. For each collection: fetch all rows
3. Compare with local cache (by timestamp)
4. Update local database
5. Process sync queue (push pending changes)

**Incremental Sync (background):**
1. Triggered every 5 minutes when app active
2. Push pending changes from sync_queue
3. Fetch modified rows (or full sync if needed)
4. Update local cache

**Conflict Resolution:**
- Compare `last_modified` timestamps
- Server timestamp > local timestamp = server wins
- Update local copy and mark as synced

### 4.6 Background Sync Implementation

```swift
import BackgroundTasks

// Register task
BGTaskScheduler.shared.register(forTaskWithIdentifier: "com.quotebook.sync", using: nil) { task in
    handleBackgroundSync(task: task as! BGProcessingTask)
}

// Schedule sync
func scheduleBackgroundSync() {
    let request = BGProcessingTaskRequest(identifier: "com.quotebook.sync")
    request.earliestBeginDate = Date(timeIntervalSinceNow: 5 * 60)
    try? BGTaskScheduler.shared.submit(request)
}
```

### 4.7 Image Handling

**Storage Strategy:**
- **Remote:** Image URLs stored in Google Sheet (column F, pipe-delimited)
- **Local caching:** Kingfisher library handles all caching automatically
- **Cache configuration:**
  - Memory cache: 150MB limit (in-memory for fast access)
  - Disk cache: 500MB limit (persistent across sessions)
  - LRU eviction policy (least recently used removed first)

**Image Loading Flow:**
```swift
import Kingfisher

// Display image with automatic caching
KFImage(URL(string: imageURL))
    .placeholder { ProgressView() }
    .retry(maxCount: 3, interval: .seconds(2))
    .onSuccess { result in
        // Image loaded and cached
    }
    .onFailure { error in
        // Show placeholder or error state
    }
```

**Benefits:**
- Browser-like HTTP caching without manual implementation
- Automatic disk persistence (survives app restarts)
- Memory + disk caching for optimal performance
- Handles cache expiration based on HTTP headers
- Works offline after first load

**MVP Scope:**
- Display images from URLs only (no camera/photo library upload)
- Kingfisher handles all caching complexity
- No manual cache management needed

### 4.8 Performance

**Pagination:**
- Load 30 quotes per batch
- Infinite scroll with prefetch (load next page at 5 items from bottom)

**Image Loading:**
- Lazy load (only when visible)
- Kingfisher for async loading + caching
- Thumbnail generation (300x300px)

**Search:**
- SQLite FTS5 (Full-Text Search)
- Index on: title, content, tags
- Debounced search (300ms delay)

---

## 5. Screen Specifications

### 5.1 Welcome / Sign-In
- Logo (centered, 120x120pt)
- Tagline: "Save quotes from anywhere"
- Feature list (4 bullet points)
- "Sign in with Google" button (full width, 44pt height)

### 5.2 Quote Browser (Home)
- Nav bar: Collection picker, Settings button
- Search bar (collapsible)
- Tag filter bar (horizontal scroll, top 10 tags)
- Masonry grid (2 columns on iPhone)
- Tab bar (5 tabs)

**Quote Card:**
- Image (if present, top)
- Content preview (2-3 lines)
- Title (bold, 1 line)
- Tags (horizontal scroll)
- Metadata (domain, date, price)

### 5.3 Compose Quote
- Nav bar: Cancel, "New Quote", Save (yellow)
- Content text area (multi-line, auto-grow)
- Tag input (autocomplete)
- Tag chips (horizontal scroll)
- URL field (collapsible)
- Price field (collapsible)
- Image URL field (optional, for adding image links)
- Collection picker (dropdown)
- Save button (full width, sticky)

### 5.4 Quote Detail
- Nav bar: Back, Edit, Share, Delete
- Image gallery (full width, swipeable)
- Content text (full, serif font)
- Price badge (if set)
- Title, URL, Tags, Timestamp

### 5.5 Search
- Search bar (large, auto-focused)
- Recent searches (chips)
- Filter options:
  - Tags (multi-select)
  - Collections (multi-select)
  - Date range
  - Has price
  - Has images
- Results (masonry grid)

### 5.6 Collections
- Nav bar: "Collections", Add button
- Collection list (table view):
  - Name, Quote count, Chevron
  - Swipe: Edit, Delete
- Active collection: Checkmark

### 5.7 Settings
- Account: Email, "Open Google Sheet", "Sign Out"
- Sync: Status, "Sync Now", Last synced, "Clear Cache"
- About: Version, Privacy Policy, Terms, Contact, Rate

---

## 6. Development Phases

### Phase 1: MVP (6-8 weeks)

**Milestone 1: Auth & Data (Weeks 1-2)**
- Google Sign-In integration
- Spreadsheet discovery/creation
- SQLite database setup
- Basic sync engine (create, read)

**Milestone 2: Core UI (Weeks 3-4)**
- Quote browser (masonry grid)
- Compose screen (text + tags)
- Quote detail view
- Search (local, full-text)

**Milestone 3: Offline & Sync (Weeks 5-6)**
- Offline write support
- Background sync
- Conflict resolution
- Sync status indicators

**Milestone 4: Polish (Weeks 7-8)**
- Image display from URLs (Kingfisher integration)
- Image gallery viewer
- Price tracking
- Multi-collection support
- Beta testing

### Phase 2: Enhancement (4-6 weeks)

**Milestone 5: Share Extension (Weeks 9-10)**
- iOS share extension
- Text selection from Safari
- Clipboard integration

**Milestone 6: Advanced Features (Weeks 11-12)**
- Quote editing
- Batch operations
- Export functionality

---

## 7. Data Format Examples

**Quote in Google Sheet (row):**
```
| Title          | Content                    | URL                      | Tags          | Timestamp                | Image                              | Price   |
|----------------|----------------------------|--------------------------|---------------|--------------------------|-----------------------------------|---------|
| Product Review | "Amazing coat!"            | https://example.com/coat | shopping,warm | 2025-12-02T14:30:00.000Z | https://img.jpg|||https://img2.jpg | $129.99 |
```

**Quote in SQLite (JSON):**
```json
{
  "id": "uuid-1234",
  "title": "Product Review",
  "content": "Amazing coat!",
  "url": "https://example.com/coat",
  "tags": ["shopping", "warm"],
  "timestamp": "2025-12-02T14:30:00.000Z",
  "images": [
    {"url": "https://img.jpg", "order": 0},
    {"url": "https://img2.jpg", "order": 1}
  ],
  "price": "$129.99",
  "collection_id": "collection-uuid",
  "sync_status": 0,
  "last_modified": "2025-12-02T14:30:00.000Z",
  "sheet_row_index": 42
}
```

---

## 8. Error Handling

| Error | User Message | Action | Recovery |
|-------|--------------|--------|----------|
| Network timeout | "Connection lost. Your quote is saved offline." | Save locally | Auto-retry |
| Auth expired | "Please sign in again." | Show sign-in | Re-authenticate |
| Spreadsheet deleted | "Your Google Sheet was deleted. Create new?" | Prompt | Create new |
| Quota exceeded | "Too many requests. Try again in 1 minute." | Show banner | Exponential backoff |
| Sync conflict | "Quote updated on another device." | Merge | Last-write-wins |
| Image load failed | "Image unavailable." | Show placeholder | Kingfisher auto-retry (3x) |

---

## 9. Launch Criteria

**Technical:**
- 95%+ crash-free rate in TestFlight
- All P0 features implemented
- Sync success rate > 98%
- App size < 50MB

**Post-Launch (3 Months):**
- 500+ active users
- 60%+ 7-day retention
- 99%+ sync reliability
- 4.5+ star rating
