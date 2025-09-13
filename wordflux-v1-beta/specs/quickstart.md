# Quick Start Guide: HTTPS & Authentication Setup

## Prerequisites
- Access to AWS EC2 instance (ubuntu@52.4.68.118)
- Cloudflare account (free tier)
- Node.js 18+ installed
- PM2 running WordFlux application

## Phase 1: Cloudflare Tunnel Setup (30 minutes)

### Step 1: Install Cloudflared
```bash
# SSH into server
ssh ubuntu@52.4.68.118

# Download and install cloudflared
wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb

# Verify installation
cloudflared --version
```

### Step 2: Quick Tunnel (Temporary URL)
```bash
# Start tunnel to get immediate HTTPS
cloudflared tunnel --url http://localhost:3000

# You'll see output like:
# https://random-name-here.trycloudflare.com
# Save this URL for testing
```

### Step 3: Permanent Tunnel (Optional)
```bash
# Login to Cloudflare
cloudflared tunnel login

# Create named tunnel
cloudflared tunnel create wordflux

# Get tunnel credentials
cloudflared tunnel list

# Create config file
cat > ~/.cloudflared/config.yml << EOF
tunnel: YOUR_TUNNEL_ID
credentials-file: /home/ubuntu/.cloudflared/YOUR_TUNNEL_ID.json

ingress:
  - hostname: wordflux.yourdomain.com
    service: http://localhost:3000
  - service: http_status:404
EOF

# Run as service
sudo cloudflared service install
sudo systemctl start cloudflared
sudo systemctl enable cloudflared
```

## Phase 2: Authentication Implementation (1 hour)

### Step 1: Install Dependencies
```bash
cd /home/ubuntu/wordflux-v1-beta

# Install auth packages
npm install next-auth@latest bcryptjs jsonwebtoken
npm install --save-dev @types/bcryptjs @types/jsonwebtoken

# Create auth directories
mkdir -p app/api/auth/[...nextauth]
mkdir -p app/login
mkdir -p lib/auth
```

### Step 2: Configure Environment
```bash
# Generate secret
openssl rand -base64 32

# Add to .env.local
cat >> .env.local << EOF

# Authentication
NEXTAUTH_URL=https://your-tunnel-url.trycloudflare.com
NEXTAUTH_SECRET=your-generated-secret-here
ADMIN_USER=admin
ADMIN_PASSWORD=changeme123!
EOF
```

### Step 3: Create Auth Configuration
```bash
# Create NextAuth config
cat > app/api/auth/[...nextauth]/route.ts << 'EOF'
import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          return null
        }
        
        // For MVP, use environment variables
        if (credentials.username === process.env.ADMIN_USER) {
          const passwordMatch = credentials.password === process.env.ADMIN_PASSWORD
          if (passwordMatch) {
            return {
              id: '1',
              name: credentials.username,
              email: 'admin@wordflux.local'
            }
          }
        }
        return null
      }
    })
  ],
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  }
})

export { handler as GET, handler as POST }
EOF
```

### Step 4: Create Middleware
```bash
# Create middleware for protection
cat > middleware.ts << 'EOF'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request })
  const isAuthPage = request.nextUrl.pathname.startsWith('/login')
  const isApiRoute = request.nextUrl.pathname.startsWith('/api')
  const isProtectedRoute = request.nextUrl.pathname.startsWith('/workspace')
  
  // Allow auth endpoints
  if (request.nextUrl.pathname.startsWith('/api/auth')) {
    return NextResponse.next()
  }
  
  // Protect API routes
  if (isApiRoute && !token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  // Protect workspace
  if (isProtectedRoute && !token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  
  // Redirect authenticated users away from login
  if (isAuthPage && token) {
    return NextResponse.redirect(new URL('/workspace', request.url))
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: ['/api/:path*', '/workspace/:path*', '/login']
}
EOF
```

### Step 5: Create Login Page
```bash
# Create login page
cat > app/login/page.tsx << 'EOF'
'use client'
import { signIn } from 'next-auth/react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [error, setError] = useState('')
  
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    
    const result = await signIn('credentials', {
      username: formData.get('username'),
      password: formData.get('password'),
      redirect: false
    })
    
    if (result?.ok) {
      router.push('/workspace')
    } else {
      setError('Invalid credentials')
    }
  }
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <h2 className="text-3xl font-bold text-center">Sign in to WordFlux</h2>
        {error && (
          <div className="bg-red-100 text-red-700 p-3 rounded">{error}</div>
        )}
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <input
            name="username"
            type="text"
            required
            className="w-full px-3 py-2 border rounded"
            placeholder="Username"
          />
          <input
            name="password"
            type="password"
            required
            className="w-full px-3 py-2 border rounded"
            placeholder="Password"
          />
          <button
            type="submit"
            className="w-full py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Sign in
          </button>
        </form>
      </div>
    </div>
  )
}
EOF
```

### Step 6: Build and Deploy
```bash
# Build application
npm run build

# Restart PM2
pm2 restart wf-v1-beta --update-env

# Check logs
pm2 logs wf-v1-beta --lines 50
```

## Testing Checklist

### HTTPS Testing
- [ ] Access https://your-tunnel-url.trycloudflare.com
- [ ] Verify SSL certificate is valid
- [ ] Check redirect from HTTP works
- [ ] Confirm no mixed content warnings

### Authentication Testing
- [ ] Access /workspace redirects to /login
- [ ] Login with correct credentials works
- [ ] Login with wrong credentials fails
- [ ] API endpoints return 401 without auth
- [ ] API endpoints work with valid token
- [ ] Logout functionality works
- [ ] Session persists across page refresh

## Troubleshooting

### Cloudflare Tunnel Issues
```bash
# Check tunnel status
sudo systemctl status cloudflared

# View tunnel logs
sudo journalctl -u cloudflared -f

# Restart tunnel
sudo systemctl restart cloudflared
```

### Authentication Issues
```bash
# Check environment variables
grep NEXTAUTH .env.local

# Verify middleware is loaded
cat middleware.ts

# Check PM2 logs for errors
pm2 logs wf-v1-beta --err
```

### Quick Rollback
```bash
# Disable authentication temporarily
mv middleware.ts middleware.ts.bak
pm2 restart wf-v1-beta

# Stop Cloudflare tunnel
sudo systemctl stop cloudflared
```

## Security Hardening (After MVP)

1. **Use bcrypt for passwords:**
```javascript
const hashedPassword = await bcrypt.hash(password, 10)
const isValid = await bcrypt.compare(password, hashedPassword)
```

2. **Add rate limiting:**
```bash
npm install express-rate-limit
```

3. **Enable security headers:**
```javascript
// next.config.js
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-XSS-Protection', value: '1; mode=block' }
]
```

4. **Set up monitoring:**
```bash
# Add to health check
curl -H "Authorization: Bearer YOUR_TOKEN" https://your-url/api/health
```

---
*Quick start guide created: 2025-09-12*