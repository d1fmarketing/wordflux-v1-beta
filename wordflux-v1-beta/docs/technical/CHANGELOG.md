# Changelog

All notable changes to this project are documented here.

## v1.0.0 – Authentication System & Production Platform (September 2025)

### 🔐 Complete Authentication System
- **JWT-based Authentication**: Secure access/refresh token system with HS256 signing
- **User Registration**: Email-based registration with password strength validation
- **Organization Management**: Multi-tenant support with role-based permissions
- **Email Verification**: Token-based email verification with secure flow
- **Password Reset**: Complete forgot/reset password flow with email tokens
- **Session Management**: Refresh token rotation and logout all sessions
- **Rate Limiting**: Intelligent rate limiting with localhost/test bypass
- **Account Security**: Account locking after 5 failed login attempts
- **Two-Factor Ready**: Infrastructure prepared for 2FA implementation

### 🛡️ Security Enhancements
- **Password Hashing**: bcrypt with 10 rounds for secure storage
- **Token Security**: Separate secrets for access/refresh tokens
- **SQL Injection Protection**: Prisma ORM with parameterized queries
- **Input Validation**: Comprehensive email and password validation
- **CORS Configuration**: Restricted to allowed origins
- **Rate Limiting**: 5 requests/minute per IP (bypassed for localhost/tests)
- **Session Revocation**: Immediate token revocation on logout

### 🗄️ Database Architecture
- **PostgreSQL Database**: Production-grade database with Prisma ORM
- **Schema Design**: Users, Organizations, UserOrganizations, RefreshTokens
- **Migrations**: Automated database migrations with Prisma
- **Test Database**: Separate test database for isolated testing
- **Connection Pooling**: Optimized database connections

### 🎯 API Endpoints (11 Authentication Routes)
- `POST /api/auth/register` - User registration with organization
- `POST /api/auth/login` - User login with credentials
- `POST /api/auth/logout` - Logout and revoke refresh token
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/verify-email` - Verify email address
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password with token
- `POST /api/auth/change-password` - Change password (authenticated)
- `GET /api/auth/me` - Get current user profile
- `PATCH /api/auth/me` - Update user profile
- `POST /api/auth/logout-all` - Logout all sessions

### 🧪 Testing Infrastructure
- **Contract Tests**: Comprehensive API contract testing with Jest/Supertest
- **Test Environment**: Isolated test database with automatic cleanup
- **Rate Limit Testing**: Fixed in-memory rate limit clearing for tests
- **Coverage**: 100% coverage of authentication endpoints
- **Test Modes**: NODE_ENV=test and TEST_MODE=true support

### 🐛 Bug Fixes
- **Rate Limiting in Tests**: Fixed Map persistence causing 429 errors
- **IPv6 Localhost**: Added ::ffff:127.0.0.1 detection for Docker
- **Token Expiry**: Fixed token expiration calculation
- **Error Handling**: Consistent error envelopes across all endpoints
- **Database Cleanup**: Proper transaction rollback on errors

### 📚 Documentation Updates
- **README.md**: Complete rewrite with v1.0.0 features
- **API.md**: Comprehensive API documentation with examples
- **API_DOCS.md**: Updated with authentication endpoints
- **Migration Guide**: Step-by-step upgrade from v0.4.0-minimal
- **Security Notes**: Best practices and security considerations

### 🔧 Development Improvements
- **Environment Variables**: Clear configuration with defaults
- **Docker Support**: docker-compose.yml for PostgreSQL
- **PM2 Integration**: Process management for production
- **Seed Scripts**: Database seeding for development
- **Error Messages**: Clear, actionable error messages

### 💻 Technical Stack Updates
- **Prisma ORM**: v5.18.0 for database management
- **bcryptjs**: v2.4.3 for password hashing
- **jsonwebtoken**: v9.0.2 for JWT tokens
- **express-rate-limit**: v8.1.0 for rate limiting
- **PostgreSQL**: v14+ with full ACID compliance

### 🚀 Migration from v0.4.0-minimal
- Run database migrations: `npx prisma migrate dev`
- Add JWT_SECRET to environment (32+ characters)
- Configure DATABASE_URL for PostgreSQL
- Update API calls to include Authorization headers
- Implement token refresh logic in client

## v0.3.5 – Critical Stability Release (September 2025)

### Drag-and-Drop Stability Fixes
- **Fixed "cannot find draggable" errors**: Added required `style={provided.draggableProps.style}` binding to Card.jsx
- **Prevented mid-drag re-renders**: Implemented dragging state with SWR pause during drag operations
- **Fixed animation conflicts**: Gated hover animations when `snapshot.isDragging` to prevent transform conflicts
- **Clean drag lifecycle**: Added `onDragStart` and `finally` block in `handleDragEnd` to ensure state cleanup

### Conversational AI Improvements
- **Fixed "No actions needed" for greetings**: ChatPanel now falls back to `/api/chat` when AI returns no actions
- **Natural language responses**: "oi" and "hello" now return friendly conversational replies in Portuguese/English
- **Maintained action processing**: Action-generating prompts still work correctly with board updates

### Concurrency Control Implementation
- **Version tracking**: Added `ifVersion` parameter to all mutation operations
- **Idempotency**: Implemented `requestId` to prevent duplicate operations
- **Conflict resolution**: 409 conflicts trigger automatic board resync with toast notifications
- **Operations covered**: move_card, update_card, delete_card, create_card, bulk operations, column operations

### Error Handling Enhancements
- **Consistent error envelopes**: All routes wrapped with `withErrorHandling` utility
- **Standardized format**: `{ error: string, details?: any }` structure across all endpoints
- **Move-card hardening**: Added error wrapper to align with other endpoints

### CSRF Documentation
- **Added clarifying notes**: Documented that CSRF is disabled at route level due to Edge runtime limitations
- **Future-ready**: Kept implementation as reference for future per-route header checks

### MCP Server Integrations
- **GitHub MCP**: Connected for natural language git operations
- **Filesystem MCP**: Browse project files with context awareness
- **Memory MCP**: Persistent state storage between sessions
- **Playwright MCP**: Browser automation without writing test scripts
- **Removed unnecessary**: Slack, Brave Search, Fetch (redundant with built-in tools)

### Testing Infrastructure
- **New test scripts**: `test-dnd-fixes.cjs` for Dr. House prescription verification
- **MCP test suite**: Comprehensive testing of all connected MCP servers
- **Live validation**: Tests confirm all fixes working in production

## v0.3.4 – GPT-5 Integration Fixes & UX Improvements (September 2025)

### GPT-5 Fixes
- **Fixed SSL errors**: Changed internal API calls from HTTPS to HTTP (localhost:3000)
- **Fixed drag-and-drop glitch**: Cards no longer jump when dragged with filters active
  - Find cards by ID instead of filtered index
  - Map filtered indices to unfiltered positions correctly
  - Block same-column reordering when filters are active
- **Fixed version conflicts**: Proper board version tracking and conflict resolution
- **Fixed model configuration**: Using correct GPT-5 model names (gpt-5, gpt-5-mini, gpt-5-nano)
- **Fixed operations format**: Board operations now sent as arrays as expected by API

### Documentation
- **Created GPT5_SETUP.md**: Complete setup and troubleshooting guide for GPT-5
- **Updated all docs**: Corrected model information across README, API_DOCS, ARCHITECTURE

### UX Improvements Completed
- **Filter pills**: Active filters shown as dismissible pills with one-click clear
- **Quick priority chips**: Fast filtering with High/Medium/Low buttons
- **Select visible**: One-click to select all filtered cards for bulk operations
- **Keyboard navigation**: 
  - Tab to focus cards
  - Enter opens card inspector
  - Space toggles selection
  - Alt+Arrow moves cards between columns
  - Full ARIA support for screen readers
- **Undo system**: 5-second undo for delete/move operations with toast notifications
- **Visual polish**:
  - WIP badges with glow effect when at/over limit
  - Enhanced drop zone highlighting with gradient borders
  - Empty state messages with helpful prompts
  - Loading skeletons with smooth animations
  - Inline title editing on double-click
- **Saved views enhancement**:
  - View chips displayed as pills
  - One-click view deletion
  - Better visual organization
- **Performance optimizations**:
  - React.memo on Card and Column components
  - Optimized re-renders
  - Improved drag-and-drop performance

- v0.2.0 – First working GPT-5 MVP
  - Chat endpoint wired to OpenAI Chat Completions
  - Server-rendered board with sample columns/cards
  - Basic suggestion extraction (move/merge/wip)

- v0.2.1 – Board persistence (localStorage)
  - Load board from localStorage first, fallback to SSR/API
  - Auto-save to localStorage after card moves
  - Optimistic UI updates; no page reload on move

- v0.2.2 – Actionable GPT-5 suggestions
  - Parse assistant replies for actions (move, set WIP, merge)
  - Render inline “Apply” buttons after AI messages
  - Execute actions with optimistic updates and persistence

- v0.2.3 – Card quick edit (inline)
  - Double-click card title to edit inline
  - Enter or click outside saves; Escape cancels
  - Immediate localStorage save + server sync

- v0.2.4 – Export board to CSV
  - Added "Export CSV" button in header
  - CSV includes metadata rows and all cards
  - Filename: wordflux-board-YYYY-MM-DD-HHmm.csv

- v0.2.5 – Activity history (last 20)
  - Tracks moves, edits, AI applies, and exports
  - Stores in localStorage at `wf.history`
  - Collapsible history panel in chat sidebar

- v0.3.0 – GPT-5 Campaign Generator
  - Prominent "Generate Campaign" button + modal form
  - Sends structured prompt to GPT-5 and parses JSON plan
  - Auto-creates phase columns and task cards with deadlines, owners
  - Optimistic board updates + background API sync

- v0.3.1 – Multiple boards
  - Board selector with create-new and index display
  - Per-board storage keys and history
  - Export filenames include board name

- v0.3.2 – WhatsApp share
  - One-click share to WhatsApp with board summary
  - Includes last 3 recent activities
  - Works per selected board

- v0.3.3 – Production Release (From Demo to Product)
  - Inline card creation with "Add card" button in each column
  - Column management (create/rename/delete columns)
  - Tightened AI responses (≤60 words, JSON-only actions)
  - Saved filter views with localStorage persistence
  - Pro monetization with gated Voice & Image features
  - Toast notifications via react-hot-toast
  - Component extraction (Column.jsx) for modularity
  - Mobile responsive with collapsible chat sidebar
  - Enhanced API operations: create_card, create_column
  - Comprehensive Puppeteer test suite
  - Screenshots for desktop/tablet/mobile viewports
