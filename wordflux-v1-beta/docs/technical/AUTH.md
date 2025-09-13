# WordFlux Authentication System Documentation

## Overview

WordFlux implements a comprehensive JWT-based authentication system with support for user registration, login, email verification, password reset, and organization management. The system is built with security best practices including bcrypt password hashing, rate limiting, and account protection mechanisms.

## Architecture

### Token System

WordFlux uses a dual-token JWT architecture:

1. **Access Token** (15 minutes)
   - Short-lived token for API access
   - Contains user ID, email, and role
   - Sent in Authorization header: `Bearer <token>`
   - Signed with JWT_SECRET

2. **Refresh Token** (7 days)
   - Long-lived token for obtaining new access tokens
   - Stored in database for revocation control
   - Single-use with rotation on refresh
   - Signed with JWT_REFRESH_SECRET (or JWT_SECRET if not set)

### Database Schema

#### User Table
```prisma
model User {
  id                    String    @id @default(uuid())
  email                 String    @unique
  password              String
  firstName             String?
  lastName              String?
  emailVerified         Boolean   @default(false)
  emailVerificationToken String?
  resetPasswordToken    String?
  resetPasswordExpires  DateTime?
  failedLoginAttempts   Int       @default(0)
  accountLockedUntil    DateTime?
  twoFactorEnabled      Boolean   @default(false)
  twoFactorSecret       String?
  role                  UserRole  @default(USER)
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
}
```

#### Organization Tables
```prisma
model Organization {
  id          String   @id @default(uuid())
  name        String
  description String?
  settings    Json?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model UserOrganization {
  userId         String
  organizationId String
  role           String  // owner, admin, member
  joinedAt       DateTime @default(now())
}
```

#### RefreshToken Table
```prisma
model RefreshToken {
  id         String    @id @default(uuid())
  token      String    @unique
  userId     String
  expiresAt  DateTime
  revokedAt  DateTime?
  usedAt     DateTime?
  deviceInfo String?
  createdAt  DateTime  @default(now())
}
```

## Authentication Flows

### Registration Flow

1. **Input Validation**
   - Email format validation
   - Password strength requirements:
     - Minimum 8 characters
     - At least one uppercase letter
     - At least one lowercase letter
     - At least one number
     - At least one special character

2. **User Creation**
   ```javascript
   // Hash password with bcrypt (10 rounds)
   const hashedPassword = await bcrypt.hash(password, 10);
   
   // Create user in transaction
   const user = await prisma.user.create({
     data: {
       email,
       password: hashedPassword,
       firstName,
       lastName,
       emailVerificationToken: generateToken()
     }
   });
   ```

3. **Organization Creation** (if provided)
   ```javascript
   const org = await prisma.organization.create({
     data: { name: organizationName }
   });
   
   await prisma.userOrganization.create({
     data: {
       userId: user.id,
       organizationId: org.id,
       role: 'owner'
     }
   });
   ```

4. **Token Generation**
   ```javascript
   const accessToken = jwt.sign(
     { userId, email, role },
     JWT_SECRET,
     { expiresIn: '15m' }
   );
   
   const refreshToken = jwt.sign(
     { userId, tokenId },
     JWT_REFRESH_SECRET,
     { expiresIn: '7d' }
   );
   ```

5. **Email Verification** (async)
   - Send verification email with token
   - User can verify via `/api/auth/verify-email`

### Login Flow

1. **Credential Validation**
   ```javascript
   // Find user by email
   const user = await prisma.user.findUnique({
     where: { email }
   });
   
   // Check account lock
   if (user.accountLockedUntil > new Date()) {
     throw new Error('Account locked');
   }
   
   // Verify password
   const valid = await bcrypt.compare(password, user.password);
   ```

2. **Failed Login Handling**
   ```javascript
   if (!valid) {
     user.failedLoginAttempts++;
     if (user.failedLoginAttempts >= 5) {
       user.accountLockedUntil = new Date(Date.now() + 30 * 60 * 1000);
     }
     throw new Error('Invalid credentials');
   }
   ```

3. **Success Response**
   - Reset failed login attempts
   - Generate new token pair
   - Store refresh token in database
   - Return tokens and user data

### Token Refresh Flow

1. **Validate Refresh Token**
   ```javascript
   // Verify JWT signature
   const payload = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
   
   // Check database record
   const storedToken = await prisma.refreshToken.findUnique({
     where: { token: refreshToken }
   });
   
   // Ensure not expired or revoked
   if (storedToken.revokedAt || storedToken.expiresAt < new Date()) {
     throw new Error('Invalid refresh token');
   }
   ```

2. **Token Rotation**
   ```javascript
   // Mark old token as used
   await prisma.refreshToken.update({
     where: { id: storedToken.id },
     data: { usedAt: new Date() }
   });
   
   // Generate new token pair
   const newAccessToken = generateAccessToken(user);
   const newRefreshToken = generateRefreshToken(user);
   
   // Store new refresh token
   await prisma.refreshToken.create({
     data: {
       token: newRefreshToken,
       userId: user.id,
       expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
     }
   });
   ```

### Password Reset Flow

1. **Request Reset**
   ```javascript
   // Generate reset token
   const resetToken = crypto.randomBytes(32).toString('hex');
   const resetExpires = new Date(Date.now() + 3600000); // 1 hour
   
   // Save to user record
   await prisma.user.update({
     where: { email },
     data: { 
       resetPasswordToken: resetToken,
       resetPasswordExpires: resetExpires
     }
   });
   
   // Send email with reset link
   await sendResetEmail(email, resetToken);
   ```

2. **Reset Password**
   ```javascript
   // Validate token
   const user = await prisma.user.findFirst({
     where: {
       resetPasswordToken: token,
       resetPasswordExpires: { gt: new Date() }
     }
   });
   
   // Hash new password
   const hashedPassword = await bcrypt.hash(newPassword, 10);
   
   // Update user
   await prisma.user.update({
     where: { id: user.id },
     data: {
       password: hashedPassword,
       resetPasswordToken: null,
       resetPasswordExpires: null
     }
   });
   ```

## Security Features

### Rate Limiting

Implemented using in-memory Map with IP-based tracking:

```javascript
const rateLimitMap = new Map();

function checkRateLimit(ip, limit = 5, window = 60000) {
  const now = Date.now();
  const requests = rateLimitMap.get(ip) || [];
  
  // Filter requests within window
  const recentRequests = requests.filter(t => now - t < window);
  
  if (recentRequests.length >= limit) {
    throw new Error('Rate limit exceeded');
  }
  
  // Add current request
  recentRequests.push(now);
  rateLimitMap.set(ip, recentRequests);
}
```

**Limits by Endpoint:**
- Registration: 5 requests/minute
- Login: 10 requests/minute
- Password Reset: 3 requests/hour

**Bypass Conditions:**
- Localhost (127.0.0.1, ::1, ::ffff:127.0.0.1)
- NODE_ENV=test
- TEST_MODE=true

### Account Protection

1. **Failed Login Attempts**
   - Track failed attempts per account
   - Lock account after 5 failures
   - 30-minute lock duration
   - Reset counter on successful login

2. **Password Requirements**
   ```javascript
   function validatePassword(password) {
     const requirements = [
       { regex: /.{8,}/, message: 'At least 8 characters' },
       { regex: /[A-Z]/, message: 'One uppercase letter' },
       { regex: /[a-z]/, message: 'One lowercase letter' },
       { regex: /[0-9]/, message: 'One number' },
       { regex: /[!@#$%^&*]/, message: 'One special character' }
     ];
     
     for (const req of requirements) {
       if (!req.regex.test(password)) {
         throw new Error(req.message);
       }
     }
   }
   ```

3. **Token Security**
   - Separate secrets for access/refresh tokens
   - Token rotation on refresh
   - Database storage for revocation
   - Expiration enforcement

## API Endpoints

### Public Endpoints (No Auth Required)

#### POST /api/auth/register
```javascript
{
  email: "user@example.com",
  password: "SecurePass123!",
  firstName: "John",
  lastName: "Doe",
  organizationName: "Acme Corp" // optional
}
```

#### POST /api/auth/login
```javascript
{
  email: "user@example.com",
  password: "SecurePass123!"
}
```

#### POST /api/auth/refresh
```javascript
{
  refreshToken: "eyJ..."
}
```

#### POST /api/auth/verify-email
```javascript
{
  token: "verification_token"
}
```

#### POST /api/auth/forgot-password
```javascript
{
  email: "user@example.com"
}
```

#### POST /api/auth/reset-password
```javascript
{
  token: "reset_token",
  newPassword: "NewSecurePass123!"
}
```

### Protected Endpoints (Auth Required)

Include access token in header:
```
Authorization: Bearer <access_token>
```

#### GET /api/auth/me
Returns current user profile

#### PATCH /api/auth/me
```javascript
{
  firstName: "Jane",
  lastName: "Smith",
  phoneNumber: "+1234567890"
}
```

#### POST /api/auth/change-password
```javascript
{
  currentPassword: "OldPass123!",
  newPassword: "NewPass123!"
}
```

#### POST /api/auth/logout
```javascript
{
  refreshToken: "eyJ..."
}
```

#### POST /api/auth/logout-all
Logs out all sessions for current user

## Environment Configuration

### Required Variables
```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/wordflux"

# JWT Secrets (minimum 32 characters)
JWT_SECRET="your_secure_jwt_secret_at_least_32_chars"
JWT_REFRESH_SECRET="your_secure_refresh_secret_at_least_32_chars"
```

### Optional Variables
```bash
# Token Expiry
ACCESS_TOKEN_EXPIRY="15m"  # Default: 15 minutes
REFRESH_TOKEN_EXPIRY="7d"  # Default: 7 days

# Test Environment
TEST_MODE="true"  # Disables rate limiting
NODE_ENV="test"   # Test environment mode

# Email Configuration
SMTP_HOST="localhost"
SMTP_PORT="1025"
SMTP_USER="username"
SMTP_PASS="password"
EMAIL_FROM="noreply@wordflux.com"
```

## Testing

### Running Tests
```bash
# Run all authentication tests
npm run test:contract

# Run specific test
npm run test:contract -- tests/contract/auth/register.test.js

# Test with specific database
TEST_DATABASE_URL="postgresql://..." npm run test:contract
```

### Test Environment Setup
```bash
# Set test environment variables
export TEST_MODE=true
export DATABASE_URL="postgresql://wordflux:wordflux_dev_2024@localhost:5432/wordflux_test"
export JWT_SECRET="test_jwt_secret_32_chars_minimum_req"

# Run tests
npm run test:contract
```

### Rate Limit Testing
The rate limiter automatically bypasses in test mode:
- Clears rate limit map on each request
- Detects TEST_MODE=true or NODE_ENV=test
- Bypasses localhost and IPv6 localhost

## Error Handling

All authentication errors follow a consistent format:

```javascript
{
  error: "Human-readable error message",
  details: {
    field: "Additional context",
    code: "ERROR_CODE"
  }
}
```

### Common Error Codes
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (invalid credentials)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found (resource doesn't exist)
- `409` - Conflict (duplicate email)
- `423` - Locked (account locked)
- `429` - Too Many Requests (rate limited)
- `500` - Internal Server Error

## Migration Guide

### From v0.4.0-minimal to v1.0.0

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Setup Database**
   ```bash
   docker-compose up -d
   npx prisma migrate dev
   ```

3. **Configure Environment**
   ```bash
   cp .env.example .env.local
   # Add DATABASE_URL and JWT_SECRET
   ```

4. **Update API Calls**
   ```javascript
   // Add auth header to protected endpoints
   fetch('/api/chat', {
     headers: {
       'Authorization': `Bearer ${accessToken}`,
       'Content-Type': 'application/json'
     }
   });
   ```

5. **Implement Token Refresh**
   ```javascript
   async function refreshTokens(refreshToken) {
     const response = await fetch('/api/auth/refresh', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ refreshToken })
     });
     
     if (response.ok) {
       const { accessToken, refreshToken } = await response.json();
       // Store new tokens
       return { accessToken, refreshToken };
     }
     
     // Handle refresh failure (redirect to login)
   }
   ```

## Best Practices

1. **Token Storage**
   - Store access token in memory or sessionStorage
   - Store refresh token in httpOnly cookie or secure storage
   - Never store tokens in localStorage for production

2. **Token Refresh Strategy**
   - Refresh proactively before expiration
   - Implement retry logic with exponential backoff
   - Handle refresh failure by redirecting to login

3. **Security Headers**
   ```javascript
   // Add security headers to responses
   res.setHeader('X-Content-Type-Options', 'nosniff');
   res.setHeader('X-Frame-Options', 'DENY');
   res.setHeader('X-XSS-Protection', '1; mode=block');
   ```

4. **Password Handling**
   - Never log passwords
   - Clear password fields after submission
   - Implement password strength meter in UI

5. **Rate Limiting**
   - Implement progressive delays
   - Use CAPTCHA for repeated failures
   - Log suspicious activity

## Troubleshooting

### Common Issues

1. **"JWT_SECRET is required"**
   - Ensure JWT_SECRET is set in environment
   - Minimum 32 characters required

2. **"Rate limit exceeded" in tests**
   - Set TEST_MODE=true
   - Or use NODE_ENV=test
   - Check for IPv6 localhost (::ffff:127.0.0.1)

3. **"Account locked"**
   - Wait 30 minutes or manually unlock in database
   - Reset failedLoginAttempts to 0

4. **"Invalid refresh token"**
   - Token may be expired or revoked
   - Check RefreshToken table in database
   - Ensure using latest token (rotation)

5. **Database connection errors**
   - Verify DATABASE_URL is correct
   - Ensure PostgreSQL is running
   - Check firewall/network settings

---

*Last updated: September 9, 2025 - v1.0.0*