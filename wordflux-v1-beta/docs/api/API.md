# WordFlux API Documentation

## Version: 1.0.0
Last Updated: September 2025

Base URL: `http://localhost:3000` (development) or your production domain

All endpoints return JSON. Errors include `{ error: string, details?: any }` with appropriate HTTP status codes.

## Authentication

Most endpoints require JWT authentication. Include the access token in the Authorization header:

```
Authorization: Bearer <access_token>
```

## API Endpoints

### 🔐 Authentication

#### POST /api/auth/register
Register a new user account with optional organization creation.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe",
  "organizationName": "Acme Corp" // optional
}
```

**Response (201):**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "emailVerified": false,
    "twoFactorEnabled": false,
    "role": "USER",
    "createdAt": "2025-09-09T00:00:00Z",
    "organizations": [
      {
        "id": "uuid",
        "name": "Acme Corp",
        "role": "owner"
      }
    ]
  },
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "expiresIn": 900
}
```

**Errors:**
- `400` - Invalid input (weak password, invalid email)
- `409` - Email already exists
- `429` - Too many requests (rate limited)

**Password Requirements:**
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

---

#### POST /api/auth/login
Authenticate user and receive JWT tokens.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response (200):**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "USER",
    "emailVerified": true
  },
  "accessToken": "eyJ...",
  "refreshToken": "eyJ..."
}
```

**Errors:**
- `401` - Invalid credentials
- `423` - Account locked (too many failed attempts)

---

#### POST /api/auth/logout
Logout user and revoke refresh token.

**Request:**
```json
{
  "refreshToken": "eyJ..."
}
```

**Response (200):**
```json
{
  "success": true
}
```

---

#### POST /api/auth/refresh
Exchange refresh token for new access/refresh token pair.

**Request:**
```json
{
  "refreshToken": "eyJ..."
}
```

**Response (200):**
```json
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ..."
}
```

**Errors:**
- `401` - Invalid or expired refresh token

---

#### POST /api/auth/verify-email
Verify email address with token from email.

**Request:**
```json
{
  "token": "verification_token_from_email"
}
```

**Response (200):**
```json
{
  "success": true,
  "email": "user@example.com"
}
```

**Errors:**
- `400` - Invalid or expired token

---

#### POST /api/auth/forgot-password
Request password reset email.

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response (200):**
```json
{
  "success": true
}
```

Note: Always returns success to prevent email enumeration.

---

#### POST /api/auth/reset-password
Reset password with token from email.

**Request:**
```json
{
  "token": "reset_token_from_email",
  "newPassword": "NewSecurePass123!"
}
```

**Response (200):**
```json
{
  "success": true
}
```

**Errors:**
- `400` - Invalid token or weak password
- `404` - Token expired

---

#### POST /api/auth/change-password
Change password for authenticated user.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request:**
```json
{
  "currentPassword": "OldPass123!",
  "newPassword": "NewPass123!"
}
```

**Response (200):**
```json
{
  "success": true
}
```

**Errors:**
- `401` - Unauthorized or incorrect current password
- `400` - Weak new password

---

#### GET /api/auth/me
Get current user profile.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200):**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "emailVerified": true,
  "twoFactorEnabled": false,
  "role": "USER",
  "organizations": [
    {
      "id": "uuid",
      "name": "Acme Corp",
      "role": "owner"
    }
  ],
  "createdAt": "2025-09-09T00:00:00Z",
  "updatedAt": "2025-09-09T00:00:00Z"
}
```

**Errors:**
- `401` - Unauthorized

---

#### PATCH /api/auth/me
Update current user profile.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request:**
```json
{
  "firstName": "Jane",
  "lastName": "Smith",
  "phoneNumber": "+1234567890"
}
```

**Response (200):**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "firstName": "Jane",
  "lastName": "Smith",
  "phoneNumber": "+1234567890",
  "updatedAt": "2025-09-09T00:00:00Z"
}
```

**Errors:**
- `401` - Unauthorized
- `400` - Invalid input

---

#### POST /api/auth/logout-all
Logout all sessions for current user.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200):**
```json
{
  "success": true
}
```

**Errors:**
- `401` - Unauthorized

---

### 🤖 AI Chat

#### POST /api/chat
Send message to AI assistant.

**Headers:**
```
Authorization: Bearer <access_token>  // Optional, provides user context
```

**Request:**
```json
{
  "message": "Create a new task for code review",
  "board": { /* optional board state */ }
}
```

**Response (200):**
```json
{
  "response": "I'll create a new code review task for you.",
  "suggestions": ["add_to_review", "assign_reviewer"],
  "model": "gpt-5-mini"
}
```

**Errors:**
- `400` - Invalid request
- `500` - OpenAI API error

---

### 🏥 Health & Status

#### GET /api/health
Health check endpoint.

**Response (200):**
```json
{
  "ok": true,
  "status": "healthy",
  "version": "1.0.0",
  "features": ["auth", "chat", "planka-embed"],
  "timestamp": "2025-09-09T00:00:00Z"
}
```

---

### 🔗 Planka Proxy

#### /planka/[[...path]]
Proxy to Planka instance for HTTPS-safe iframe embedding.

- Forwards all headers
- Rewrites Set-Cookie headers for security
- Rewrites Location headers for redirects
- Updates HTML base URLs for proper asset loading
- Timeout: configurable via `PLANKA_PROXY_TIMEOUT_MS` (default 10000ms)

**Example:**
```
GET /planka/login
→ Proxies to PLANKA_BASE_URL/login
```

---

## Rate Limiting

Rate limiting is applied to authentication endpoints to prevent abuse:

- **Registration**: 5 requests per minute per IP
- **Login**: 10 requests per minute per IP
- **Password Reset**: 3 requests per hour per IP

Rate limiting is automatically disabled for:
- Localhost connections (127.0.0.1, ::1)
- Test environment (TEST_MODE=true)
- Development environment (NODE_ENV=test)

---

## Error Responses

All errors follow a consistent format:

```json
{
  "error": "Human-readable error message",
  "details": {
    "field": "Additional context",
    "code": "ERROR_CODE"
  }
}
```

Common HTTP status codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `429` - Too Many Requests
- `500` - Internal Server Error

---

## Environment Variables

### Required
```bash
DATABASE_URL="postgresql://..."
JWT_SECRET="minimum_32_characters"
OPENAI_API_KEY="sk-..."
```

### Optional
```bash
JWT_REFRESH_SECRET="separate_secret"
ACCESS_TOKEN_EXPIRY="15m"
REFRESH_TOKEN_EXPIRY="7d"
TEST_MODE="true"  # Disable rate limiting
PLANKA_BASE_URL="http://localhost:3015"
PLANKA_PROXY_TIMEOUT_MS="10000"
```

---

## Testing

Use the test environment configuration:

```bash
# Set test environment
export TEST_MODE=true
export DATABASE_URL="postgresql://wordflux:wordflux_dev_2024@localhost:5432/wordflux_test"
export JWT_SECRET="test_jwt_secret_32_chars_minimum_req"

# Run tests
npm run test:contract
```

Example test request:
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPass123!",
    "firstName": "Test",
    "lastName": "User"
  }'
```

---

## Security Notes

1. **JWT Tokens**: Access tokens expire in 15 minutes, refresh tokens in 7 days
2. **Password Storage**: Passwords are hashed with bcrypt (10 rounds)
3. **Rate Limiting**: Prevents brute force attacks
4. **Account Locking**: Accounts lock after 5 failed login attempts
5. **Token Rotation**: Refresh tokens are single-use and rotated on each refresh
6. **CORS**: Configure allowed origins in production
7. **HTTPS**: Always use HTTPS in production

---

## Migration Guide

### From v0.4.0-minimal to v1.0.0

1. **Database Setup**: Run migrations to create auth tables
   ```bash
   npx prisma migrate dev
   ```

2. **Environment Variables**: Add JWT and database configuration
   ```bash
   JWT_SECRET="your_secure_secret"
   DATABASE_URL="postgresql://..."
   ```

3. **Update API Calls**: Add Authorization headers to protected endpoints
   ```javascript
   fetch('/api/chat', {
     headers: {
       'Authorization': `Bearer ${accessToken}`,
       'Content-Type': 'application/json'
     },
     // ...
   })
   ```

4. **Handle Token Refresh**: Implement token refresh logic in client
   ```javascript
   // When access token expires (401 response)
   const { accessToken, refreshToken } = await refreshTokens(refreshToken);
   ```