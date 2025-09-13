# Authentication API Contracts

## Base URL
```
Production: https://{cloudflare-tunnel-url}
Development: http://localhost:3000
```

## Authentication Endpoints

### POST /api/auth/login
Login with username and password.

**Request:**
```typescript
{
  username: string;  // Required, 3-50 characters
  password: string;  // Required, 8+ characters
}
```

**Response (200 OK):**
```typescript
{
  success: true,
  user: {
    id: string,
    username: string,
    role: "admin" | "user" | "readonly"
  },
  token: string,      // JWT token
  expiresIn: number   // Seconds until expiration
}
```

**Response (401 Unauthorized):**
```typescript
{
  success: false,
  error: "Invalid credentials"
}
```

**Response (429 Too Many Requests):**
```typescript
{
  success: false,
  error: "Too many login attempts. Please try again later.",
  retryAfter: number  // Seconds until retry allowed
}
```

### POST /api/auth/logout
Logout current user and invalidate session.

**Headers:**
```
Authorization: Bearer {token}
```

**Response (200 OK):**
```typescript
{
  success: true,
  message: "Logged out successfully"
}
```

### GET /api/auth/session
Get current user session information.

**Headers:**
```
Authorization: Bearer {token}
```

**Response (200 OK):**
```typescript
{
  authenticated: true,
  user: {
    id: string,
    username: string,
    role: "admin" | "user" | "readonly"
  },
  expiresAt: string  // ISO 8601 timestamp
}
```

**Response (401 Unauthorized):**
```typescript
{
  authenticated: false,
  error: "No valid session"
}
```

### POST /api/auth/refresh
Refresh authentication token.

**Request:**
```typescript
{
  refreshToken: string  // Required
}
```

**Response (200 OK):**
```typescript
{
  success: true,
  token: string,        // New JWT token
  refreshToken: string, // New refresh token
  expiresIn: number     // Seconds until expiration
}
```

**Response (401 Unauthorized):**
```typescript
{
  success: false,
  error: "Invalid refresh token"
}
```

## Protected Endpoints

All protected endpoints require authentication via JWT token.

### Headers Required
```
Authorization: Bearer {token}
Content-Type: application/json
```

### Protected Endpoints List
- `POST /api/chat` - Chat with AI assistant
- `GET /api/board/state` - Get board state
- `POST /api/board/create` - Create task
- `POST /api/board/move` - Move task
- `DELETE /api/board/task` - Delete task
- `POST /api/board/sync` - Sync board state

### Unauthorized Response (401)
All protected endpoints return this when no valid token is provided:
```typescript
{
  error: "Unauthorized",
  message: "Authentication required"
}
```

### Forbidden Response (403)
When authenticated but lacking permissions:
```typescript
{
  error: "Forbidden",
  message: "Insufficient permissions for this operation"
}
```

## Rate Limiting

### Limits
- Login attempts: 5 per minute per IP
- API calls: 60 per minute per user
- Chat API: 10 per minute per user

### Rate Limit Headers
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1694444444
```

### Rate Limit Exceeded Response (429)
```typescript
{
  error: "Too Many Requests",
  message: "Rate limit exceeded",
  retryAfter: 30  // Seconds
}
```

## Security Headers

All responses include these security headers:
```
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Content-Security-Policy: default-src 'self'
```

## CORS Configuration

Allowed origins:
- Production: https://{cloudflare-tunnel-url}
- Development: http://localhost:3000

Allowed methods:
- GET, POST, PUT, DELETE, OPTIONS

Allowed headers:
- Content-Type, Authorization

## WebSocket Authentication

For real-time features (if implemented):

### Connection
```javascript
const socket = io({
  auth: {
    token: "Bearer {jwt-token}"
  }
});
```

### Authentication Event
```typescript
socket.on('authenticated', (data) => {
  // { success: true, user: {...} }
});

socket.on('unauthorized', (error) => {
  // { message: "Authentication failed" }
});
```

---
*API contracts defined: 2025-09-12*