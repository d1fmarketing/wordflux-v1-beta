# WordFlux Architecture

## Overview
WordFlux is a comprehensive workflow management platform built with Next.js App Router that combines a Kanban board interface with an AI-powered chat assistant and a complete authentication system. The platform features secure JWT-based authentication, multi-tenant organization management, and AI-driven task guidance powered by GPT-5.

## Core Architecture Components

### Authentication System
- **JWT Token System**: Dual token architecture with access (15m) and refresh (7d) tokens
- **Auth Service**: Centralized authentication logic in `app/lib/services/auth.service.js`
- **Auth Routes**: 11 authentication endpoints under `app/api/auth/*`
- **Database Layer**: PostgreSQL with Prisma ORM for user and organization management
- **Session Management**: Refresh token rotation with database-backed revocation
- **Rate Limiting**: IP-based rate limiting with intelligent bypass for tests/localhost

### Application Components
- **Next.js App Router**: Modern App Router under `app/` with API routes at `app/api/.../route.js`
- **Board Management**: Planka integration via iframe with HTTPS proxy for secure embedding
- **AI Integration**: Chat endpoint at `app/api/chat/route.js` using GPT-5 models
- **Database**: PostgreSQL with Prisma ORM, migrations in `prisma/migrations/`
- **State Management**: SWR for data fetching with proper cache invalidation

## Authentication Architecture

### Token System
WordFlux implements a dual-token JWT architecture for secure authentication:

1. **Access Token** (15 minutes)
   - Short-lived token for API access
   - Contains user ID, email, role
   - Signed with JWT_SECRET
   - Sent in Authorization header: `Bearer <token>`

2. **Refresh Token** (7 days)
   - Long-lived token for obtaining new access tokens
   - Stored in database for revocation control
   - Rotated on each refresh (single use)
   - Signed with JWT_REFRESH_SECRET or JWT_SECRET

### Authentication Flow

#### Registration Flow
1. User submits registration form with email, password, name, optional organization
2. Server validates input:
   - Email format validation
   - Password strength (8+ chars, uppercase, lowercase, number, special)
   - Check for existing email
3. Password hashed with bcrypt (10 rounds)
4. Database transaction:
   - Create User record
   - Create Organization if provided
   - Create UserOrganization link with 'owner' role
5. Generate JWT tokens (access + refresh)
6. Store refresh token in database
7. Return user data + tokens to client
8. Send verification email asynchronously

#### Login Flow
1. User submits email and password
2. Server validates credentials:
   - Find user by email
   - Check account lock status (5 failed attempts = locked)
   - Verify password with bcrypt
3. On success:
   - Reset failed login attempts
   - Generate new token pair
   - Store refresh token in database
4. On failure:
   - Increment failed attempts
   - Lock account if threshold reached
   - Return 401 Unauthorized

#### Token Refresh Flow
1. Client sends refresh token to `/api/auth/refresh`
2. Server validates:
   - Verify JWT signature
   - Check token exists in database
   - Ensure not expired
3. Generate new token pair
4. Revoke old refresh token (mark as used)
5. Store new refresh token
6. Return new tokens to client

### Rate Limiting Architecture

The platform implements intelligent rate limiting to prevent abuse:

1. **In-Memory Store**: Uses Map for tracking request counts
2. **IP Detection**: Extracts IP from x-forwarded-for or x-real-ip headers
3. **Localhost Bypass**: Automatically bypasses for:
   - 127.0.0.1, ::1, localhost
   - ::ffff:127.0.0.1 (IPv6-mapped IPv4)
   - NODE_ENV=test
   - TEST_MODE=true
4. **Limits by Endpoint**:
   - Registration: 5 requests/minute
   - Login: 10 requests/minute  
   - Password Reset: 3 requests/hour
5. **Test Environment**: Map cleared on each request in test mode

## Runtime Flow

### Authentication API Flow
1. Client sends request to `/api/auth/*` endpoint
2. Rate limiter checks request count
3. Route handler processes request:
   - Validates input with auth.service
   - Performs database operations via Prisma
   - Generates/validates JWT tokens
   - Returns standardized response
4. Error handling with consistent envelope: `{ error, details }`

### Protected Route Flow
1. Client includes access token in Authorization header
2. Middleware validates token:
   - Verify JWT signature
   - Check expiration
   - Extract user context
3. Route handler has access to authenticated user
4. Operations performed with user context
5. Response returned to client

### AI Chat Flow
1. User types a prompt in ChatPanel component
2. Browser posts to `POST /api/chat` with `{ message }` and optional auth token
3. Server handler (`app/api/chat/route.js`):
   - Validates authentication if token provided
   - Reads OPENAI_API_KEY and model configuration
   - Sends request to OpenAI API with system prompt
   - Parses response and returns to client
4. Response returns JSON: `{ response, suggestions, model }`

### Board Mutation APIs
- `POST /api/board/move-card`: Minimal endpoint to move a card between columns.
- `POST /api/board/apply`: Generalized mutations (set WIP limits, add/update/delete/duplicate cards, add/rename/delete columns, move columns, move cards).
- `POST /api/board/seed`: Seeds the default board (useful for local or empty tables).
- `GET /api/board/get`: Returns the current board.

## Database Schema

### Core Tables
- **User**: User accounts with authentication data
  - id, email, password, firstName, lastName
  - emailVerified, emailVerificationToken
  - resetPasswordToken, resetPasswordExpires
  - failedLoginAttempts, accountLockedUntil
  - twoFactorEnabled, twoFactorSecret
  - role (USER/ADMIN), timestamps

- **Organization**: Multi-tenant organizations
  - id, name, description
  - settings (JSON), timestamps

- **UserOrganization**: Many-to-many with roles
  - userId, organizationId
  - role (owner/admin/member)
  - joinedAt

- **RefreshToken**: Stored refresh tokens
  - id, token, userId
  - expiresAt, revokedAt, usedAt
  - deviceInfo, timestamps

## Files of Interest

### Authentication Files
- `app/api/auth/*/route.js`: Authentication route handlers (11 endpoints)
- `app/lib/services/auth.service.js`: Core authentication business logic
- `app/lib/services/email.service.js`: Email sending for verification/reset
- `app/lib/prisma.js`: Database client singleton
- `prisma/schema.prisma`: Database schema definition

### Application Files
- `app/page.js`: Main application page with board and chat
- `app/components/ChatPanel.jsx`: AI chat interface component
- `app/components/Board.jsx`: Kanban board component
- `app/api/chat/route.js`: GPT-5 chat integration
- `app/api/health/route.js`: Health check endpoint
- `app/api/planka/[[...path]]/route.js`: Planka proxy for HTTPS

### Testing Files
- `tests/contract/auth/*.test.js`: Authentication contract tests
- `jest.config.contract.js`: Jest configuration for contract tests
- `tests/e2e/*.spec.js`: Playwright end-to-end tests

## Environment Variables

### Required Variables
```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/wordflux"

# Authentication
JWT_SECRET="minimum_32_character_secret_key_required"  # Required

# OpenAI
OPENAI_API_KEY="sk-..."  # Required for AI features
```

### Optional Variables
```bash
# JWT Configuration
JWT_REFRESH_SECRET="separate_refresh_secret"  # Defaults to JWT_SECRET
ACCESS_TOKEN_EXPIRY="15m"  # Default: 15 minutes
REFRESH_TOKEN_EXPIRY="7d"  # Default: 7 days

# OpenAI Configuration
OPENAI_MODEL="gpt-5-mini"  # Options: gpt-5, gpt-5-mini, gpt-5-nano

# Test Environment
TEST_MODE="true"  # Disables rate limiting
NODE_ENV="test"   # Test environment mode
TEST_DATABASE_URL="postgresql://user:password@localhost:5432/wordflux_test"

# Email Configuration
SMTP_HOST="localhost"
SMTP_PORT="1025"
SMTP_USER="username"
SMTP_PASS="password"
EMAIL_FROM="noreply@wordflux.com"

# Planka Integration
PLANKA_BASE_URL="http://localhost:3015"  # For proxy mode
NEXT_PUBLIC_PLANKA_BASE_URL="/planka"    # Public URL
PLANKA_PROXY_TIMEOUT_MS="10000"          # Proxy timeout
```

## Security Architecture

### Password Security
- **Hashing**: bcrypt with 10 rounds (configurable)
- **Validation**: Minimum 8 characters with complexity requirements
- **Reset Flow**: Time-limited tokens with secure random generation
- **Account Protection**: Lock after 5 failed attempts

### Token Security
- **JWT Signing**: HS256 with separate secrets
- **Token Storage**: Refresh tokens in database for revocation
- **Token Rotation**: Single-use refresh tokens
- **Expiration**: Configurable expiry times

### Rate Limiting
- **Implementation**: In-memory Map with request counting
- **Bypass Logic**: Automatic for localhost and test environments
- **Cleanup**: Periodic cleanup of expired entries
- **Response**: 429 Too Many Requests with retry-after header

## Error Handling & Resilience
- **Consistent Format**: All errors return `{ error, details }` structure
- **HTTP Status Codes**: Proper REST status codes (400, 401, 403, 404, 409, 429, 500)
- **Database Transactions**: Automatic rollback on errors
- **Graceful Degradation**: Fallback behaviors for external service failures

## Local Development
- `npm run dev` starts Next.js on `:3000`
- `npm run test:contract` runs authentication tests
- `npm run db:migrate` runs database migrations
- `npm run db:studio` opens Prisma Studio for database inspection
- `docker-compose up -d` starts PostgreSQL database

## v0.3.3 Production Release Updates

### New Component Architecture
- **Board.jsx**: Main board container with SWR for data fetching
- **Column.jsx**: Column component with inline AddCardInline for card creation
- **Card.jsx**: Card component with edit and delete operations
- **FilterBar.jsx**: Filters with SavedViews dropdown for persistence
- **ChatPanel.jsx**: AI chat interface with length modes
- **UpgradePrompt.jsx**: Pro feature monetization modal with useProStatus hook

### GPT-5 Integration Details
- **Model Configuration**: Uses `gpt-5-mini` for optimal cost/performance balance
- **Internal API Calls**: Fixed to use `http://localhost:3000` to avoid SSL errors
- **Version Tracking**: Board operations include version for conflict detection
- **Error Handling**: Graceful handling of version conflicts with retry logic
- **Action DSL**: Supports create_card, update_card, move_card, delete_card, comment operations
- **Card Queries**: Flexible targeting via ID or search queries ("title:foo priority:high")
- **See [GPT5_SETUP.md](./GPT5_SETUP.md)** for detailed troubleshooting guide

### Enhanced API Endpoints
- **POST /api/ai**: GPT-5 powered assistant (≤60 words, JSON-only actions)
- **POST /api/board/apply**: New operations: create_card, create_column, rename_column, delete_column
- **POST /api/views/save**: Save filter configurations
- **GET /api/views/get**: Retrieve saved views
- **POST /api/billing/checkout**: Stripe integration for Pro upgrade

### Completed Features (v0.3.3)
- ✅ Inline card creation with "Add card" buttons in column footers
- ✅ Dynamic column management (create/rename/delete)
- ✅ Tightened AI responses (≤60 words, JSON-only for board modifications)
- ✅ Saved filter views with localStorage persistence
- ✅ Pro monetization with Voice & Image feature gating
- ✅ Toast notifications via react-hot-toast for user feedback
- ✅ Mobile responsive design with collapsible chat sidebar
- ✅ Component extraction for improved modularity

### Upcoming Features (Roadmap)
- Realtime Voice with function-calling for hands-free operation
- Usage metering (100 free actions, Pro = unlimited)

## v0.3.5 Critical Stability Improvements

### Drag-and-Drop Architecture
- **Style Binding**: Card components properly bind `provided.draggableProps.style` for @hello-pangea/dnd
- **Dragging State Management**: Board maintains `dragging` state to pause SWR during drag operations
- **Animation Gating**: Framer Motion animations disabled when `snapshot.isDragging` to prevent conflicts
- **Clean Lifecycle**: `onDragStart` sets dragging flag, `handleDragEnd` clears in `finally` block

### Concurrency Control System
- **Version Tracking**: All board mutations accept `ifVersion` parameter for optimistic concurrency control
- **Idempotency**: Operations support `requestId` to prevent duplicate processing
- **Conflict Resolution**: 409 responses trigger automatic board resync with user notification
- **Coverage**: Applied to 8 operations including move_card, update_card, delete_card, create_card, bulk operations

### Error Handling Patterns
- **Unified Wrapper**: `withErrorHandling` utility in `app/lib/api-utils.js`
- **Consistent Envelope**: All errors return `{ error: string, details?: any }` structure
- **HTTP Status Codes**: 400 (bad request), 404 (not found), 409 (conflict), 500 (server error)
- **Client Recovery**: Automatic retry logic for version conflicts

### Conversational AI Flow
- **ChatPanel Logic**: 
  1. Calls `/api/ai` in action mode
  2. If no actions returned, falls back to `/api/chat`
  3. Displays conversational response for greetings
- **AI Route Behavior**: Returns empty actions array for non-actionable inputs
- **Chat Route**: Provides natural language responses in Portuguese/English

### MCP Server Integration
- **GitHub MCP**: Natural language git operations via stdio server
- **Filesystem MCP**: Context-aware file browsing with 228 JS files
- **Memory MCP**: Persistent state storage between development sessions
- **Playwright MCP**: Browser automation without manual script writing
- **Architecture**: MCP servers connect via stdio or SSE transports, enabling 10x development speed
- Multi-board sharing with permissions
- PostgreSQL database with Prisma ORM
- Socket.io for real-time collaboration
- NextAuth.js for authentication

## v1.0.0 Authentication System Release

### Complete Authentication Implementation
- **JWT Architecture**: Dual-token system with access (15m) and refresh (7d) tokens
- **11 Auth Endpoints**: Complete auth flow from registration to session management
- **Organization Management**: Multi-tenant support with role-based permissions
- **Email Verification**: Token-based email verification system
- **Password Reset**: Secure forgot/reset password flow
- **Session Management**: Refresh token rotation and logout all sessions
- **Rate Limiting**: Intelligent IP-based rate limiting with test bypass
- **Account Security**: Account locking after failed attempts

### Database Architecture
- **PostgreSQL**: Production-grade relational database
- **Prisma ORM**: Type-safe database access with migrations
- **Schema Design**: Users, Organizations, UserOrganizations, RefreshTokens
- **Transaction Support**: ACID compliance with automatic rollback

### Security Features
- **bcrypt**: Password hashing with 10 rounds
- **JWT Tokens**: Signed with HS256, separate secrets
- **Input Validation**: Email format and password strength
- **SQL Injection Protection**: Parameterized queries via Prisma
- **CORS Configuration**: Restricted to allowed origins
- **Rate Limiting**: Per-endpoint limits with automatic bypass for tests

### Testing Infrastructure
- **Contract Tests**: Complete API contract testing suite
- **Test Database**: Isolated testing environment
- **Rate Limit Fix**: In-memory Map clearing for tests
- **Environment Support**: NODE_ENV and TEST_MODE detection

### Migration from v0.4.0-minimal
The platform evolved from a minimal Planka embed to a full-featured authentication system:
- Added complete JWT-based authentication
- Implemented PostgreSQL database with Prisma
- Created comprehensive test suite
- Enhanced security with rate limiting
- Added organization management

