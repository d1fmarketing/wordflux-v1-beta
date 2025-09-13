# Data Model: Authentication System

## User Model

### Schema
```typescript
interface User {
  id: string;           // UUID or auto-increment
  username: string;     // Unique identifier for login
  email?: string;       // Optional email for notifications
  passwordHash: string; // Bcrypt hashed password
  role: UserRole;       // Admin, User, ReadOnly
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
  isActive: boolean;
}

enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
  READONLY = 'readonly'
}
```

### Storage Options

#### Option 1: SQLite (Recommended for MVP)
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  email TEXT,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'user',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login_at DATETIME,
  is_active BOOLEAN DEFAULT 1
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
```

#### Option 2: In-Memory (Development/Testing)
```typescript
class InMemoryUserStore {
  private users: Map<string, User> = new Map();
  
  constructor() {
    // Seed with default admin user
    this.users.set('admin', {
      id: '1',
      username: 'admin',
      passwordHash: '$2a$10$...', // bcrypt hash of default password
      role: UserRole.ADMIN,
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true
    });
  }
  
  async findByUsername(username: string): Promise<User | null> {
    return this.users.get(username) || null;
  }
  
  async create(user: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    const newUser = {
      ...user,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.users.set(newUser.username, newUser);
    return newUser;
  }
}
```

## Session Model

### JWT Token Payload
```typescript
interface JWTPayload {
  sub: string;        // User ID
  username: string;
  role: UserRole;
  iat: number;        // Issued at
  exp: number;        // Expiration
  jti?: string;       // JWT ID for revocation
}
```

### Session Storage
```typescript
interface Session {
  id: string;         // Session ID
  userId: string;     // Reference to User
  token: string;      // JWT token
  refreshToken?: string;
  ipAddress?: string;
  userAgent?: string;
  expiresAt: Date;
  createdAt: Date;
  lastActivityAt: Date;
}
```

### Session Table (if using database sessions)
```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  token TEXT NOT NULL,
  refresh_token TEXT,
  ip_address TEXT,
  user_agent TEXT,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_activity_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
```

## Audit Log Model

### Schema
```typescript
interface AuditLog {
  id: string;
  userId?: string;      // Null for anonymous actions
  action: AuditAction;
  resource?: string;    // What was accessed/modified
  details?: any;        // JSON details of the action
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  timestamp: Date;
}

enum AuditAction {
  LOGIN_ATTEMPT = 'login_attempt',
  LOGIN_SUCCESS = 'login_success',
  LOGIN_FAILURE = 'login_failure',
  LOGOUT = 'logout',
  API_ACCESS = 'api_access',
  TASK_CREATE = 'task_create',
  TASK_UPDATE = 'task_update',
  TASK_DELETE = 'task_delete',
  UNAUTHORIZED_ACCESS = 'unauthorized_access'
}
```

### Audit Table
```sql
CREATE TABLE audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  action TEXT NOT NULL,
  resource TEXT,
  details TEXT, -- JSON string
  ip_address TEXT,
  user_agent TEXT,
  success BOOLEAN DEFAULT 1,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);
```

## Rate Limiting Model

### Schema
```typescript
interface RateLimitEntry {
  key: string;         // IP or userId
  endpoint: string;    // API endpoint
  count: number;       // Request count
  windowStart: Date;   // Window start time
  blocked: boolean;    // Is currently blocked
}
```

### Redis Storage (if available)
```typescript
// Key format: ratelimit:{key}:{endpoint}
// Value: count
// TTL: window duration (e.g., 60 seconds)

class RedisRateLimiter {
  async increment(key: string, endpoint: string): Promise<number> {
    const redisKey = `ratelimit:${key}:${endpoint}`;
    const count = await redis.incr(redisKey);
    if (count === 1) {
      await redis.expire(redisKey, 60); // 60 second window
    }
    return count;
  }
}
```

### In-Memory Storage (fallback)
```typescript
class InMemoryRateLimiter {
  private limits = new Map<string, RateLimitEntry>();
  
  increment(key: string, endpoint: string): number {
    const limitKey = `${key}:${endpoint}`;
    const now = new Date();
    const entry = this.limits.get(limitKey);
    
    if (!entry || now.getTime() - entry.windowStart.getTime() > 60000) {
      // New window
      this.limits.set(limitKey, {
        key,
        endpoint,
        count: 1,
        windowStart: now,
        blocked: false
      });
      return 1;
    }
    
    entry.count++;
    return entry.count;
  }
}
```

## Configuration Model

### Environment Variables
```typescript
interface AuthConfig {
  jwtSecret: string;
  jwtExpiresIn: string;       // e.g., '1h', '7d'
  refreshTokenExpiresIn: string;
  bcryptRounds: number;        // Default: 10
  maxLoginAttempts: number;    // Default: 5
  lockoutDuration: number;     // Minutes, default: 15
  sessionTimeout: number;      // Minutes, default: 30
  requireStrongPassword: boolean;
  allowRegistration: boolean;
  defaultUserRole: UserRole;
}
```

### Database Migrations
```typescript
interface Migration {
  version: number;
  name: string;
  up: string;    // SQL to apply
  down: string;  // SQL to rollback
  appliedAt?: Date;
}

const migrations: Migration[] = [
  {
    version: 1,
    name: 'create_users_table',
    up: `CREATE TABLE users ...`,
    down: `DROP TABLE users`
  },
  {
    version: 2,
    name: 'create_sessions_table',
    up: `CREATE TABLE sessions ...`,
    down: `DROP TABLE sessions`
  },
  {
    version: 3,
    name: 'create_audit_logs_table',
    up: `CREATE TABLE audit_logs ...`,
    down: `DROP TABLE audit_logs`
  }
];
```

## API Response Models

### Login Response
```typescript
interface LoginResponse {
  success: boolean;
  user?: {
    id: string;
    username: string;
    role: UserRole;
  };
  token?: string;
  refreshToken?: string;
  expiresIn?: number;
  error?: string;
}
```

### Auth Check Response
```typescript
interface AuthCheckResponse {
  authenticated: boolean;
  user?: {
    id: string;
    username: string;
    role: UserRole;
  };
  permissions?: string[];
}
```

---
*Data model defined: 2025-09-12*