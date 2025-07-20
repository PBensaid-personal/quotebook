# Quote Collector - Content Saving Application

## Overview

This is a full-stack web application that simulates a Chrome extension for capturing and organizing web content. Quote Collector provides a comprehensive interface for saving, managing, and syncing content items with Google Sheets integration.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized builds
- **Styling**: Tailwind CSS with shadcn/ui component library
- **State Management**: TanStack Query (React Query) for server state management
- **Routing**: Wouter for client-side routing
- **UI Components**: Radix UI primitives with custom styling

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **API Pattern**: RESTful API design
- **Development**: tsx for TypeScript execution in development

### Database & ORM
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Database Provider**: Neon Database (serverless PostgreSQL)
- **Schema Management**: Drizzle Kit for migrations and schema management
- **Storage Abstraction**: Interface-based storage layer with in-memory implementation for development

## Key Components

### Database Schema
- **Users**: Authentication and Google integration settings
- **Content Items**: Saved web content with metadata (title, content, URL, tags, etc.)
- **User Settings**: Application preferences and sync configurations

### Core Features
1. **Content Capture**: Simulated browser extension popup for saving web content
2. **Content Management**: Full-page view for browsing and searching saved items
3. **Google Sheets Integration**: Sync content to Google Sheets
4. **Settings Management**: User preferences and integration configuration
5. **Content Selection**: Interface for selecting text content on web pages

### API Endpoints
- `GET /api/user` - Retrieve current user information
- `PATCH /api/user/google` - Update Google integration settings
- `GET /api/content` - Fetch content items with search/filter support
- `POST /api/content` - Create new content item
- `PATCH /api/content/:id` - Update existing content item
- `DELETE /api/content/:id` - Delete content item
- `GET /api/settings` - Fetch user settings
- `PATCH /api/settings` - Update user settings
- `GET /api/stats` - Retrieve usage statistics

## Data Flow

1. **Content Capture**: User selects content on a webpage → Extension popup captures metadata → API saves to database
2. **Content Management**: Frontend fetches content via React Query → API retrieves from database → UI displays with search/filter capabilities
3. **Google Sheets Sync**: Content changes trigger sync → API formats data → Google Sheets API integration updates spreadsheet
4. **Settings Management**: User modifies preferences → API updates settings → Application behavior adapts

## External Dependencies

### Production Dependencies
- **UI Framework**: React, Radix UI components, Tailwind CSS
- **Data Fetching**: TanStack React Query
- **Database**: Drizzle ORM, Neon Database serverless driver
- **Validation**: Zod for schema validation
- **Authentication**: Express sessions with PostgreSQL store
- **Utilities**: date-fns, clsx, class-variance-authority

### Development Dependencies
- **Build Tools**: Vite, esbuild for production builds
- **TypeScript**: Full TypeScript support across frontend and backend
- **Development Server**: Hot module replacement with Vite dev server

### External Integrations
- **Google Sheets API**: For content synchronization (mock implementation included)
- **Neon Database**: Serverless PostgreSQL hosting
- **Replit**: Development environment integration with cartographer plugin

## Deployment Strategy

### Development
- Frontend served by Vite dev server with HMR
- Backend runs with tsx for TypeScript execution
- Database migrations managed with Drizzle Kit
- Environment variables for database connection

### Production
- Frontend built with Vite and served as static files
- Backend bundled with esbuild as ESM module
- Single Node.js process serves both API and static files
- Database schema deployed via Drizzle migrations

### Build Process
1. `npm run build` - Builds frontend with Vite and bundles backend with esbuild
2. `npm run start` - Runs production server serving both API and static files
3. `npm run db:push` - Deploys database schema changes

### Environment Requirements
- Node.js with ES modules support
- PostgreSQL database (Neon serverless)
- Environment variable `DATABASE_URL` for database connection

The application is designed as a monorepo with shared TypeScript types and schemas between frontend and backend, ensuring type safety across the full stack.

## Recent Changes

### Chrome Extension Simplification (January 2025)
- Simplified from complex web app to straightforward Chrome extension
- Direct Google Sheets integration using chrome.identity API
- No backend server required - pure client-side operation
- Users authenticate once and data saves directly to their own Google Sheets
- Text selection on any webpage with visual feedback
- Auto-generates spreadsheet with proper headers
- Simple popup interface for quick saving
- User owns all data in their Google Drive

### Extension Package Cleanup (January 2025)
- Removed incomplete extension/ folder (missing manifest.json)
- Consolidated to single chrome-extension-package/ folder
- Contains complete extension with real Google Client ID
- Ready for unpacked testing and Chrome Web Store submission
- All user-provided PNG icons properly integrated

### Project Rebranding to Quote Collector (January 2025)
- Updated project name from WebCapture to Quote Collector
- Created proper Chrome Extension OAuth client in Google Cloud Console
- Generated stable extension key for consistent Extension ID: igokaadmgmnmbmclnbanjalaakhmghgb
- Ready for OAuth authentication testing with Google Sheets integration