import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const response = NextResponse.next();
  
  // Security headers
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  // Content Security Policy
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' ", // Next.js requires these
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' http://localhost:* http://127.0.0.1:* http://52.4.68.118",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; ');
  
  response.headers.set('Content-Security-Policy', csp);
  
  // CORS headers for API routes
  const { pathname } = req.nextUrl;
  if (pathname.startsWith('/api/')) {
    const origin = req.headers.get('origin');
    const allowedOrigins = [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://52.4.68.118',
      'https://52.4.68.118'
    ];
    
    if (origin && allowedOrigins.includes(origin)) {
      response.headers.set('Access-Control-Allow-Origin', origin);
      response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      response.headers.set('Access-Control-Max-Age', '86400');
    }
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return new NextResponse(null, { status: 200, headers: response.headers });
    }
  }
  
  // Allow unauthenticated in public mode
  if (process.env.PUBLIC_MODE === 'true') return response;

  // Skip static & health
  if (pathname.startsWith('/_next') || pathname === '/favicon.ico' || pathname === '/api/health') {
    return response;
  }

  // Basic auth check
  const hdr = req.headers.get('authorization') || '';
  const challenge = { 
    status: 401, 
    headers: { 
      'WWW-Authenticate': 'Basic realm="WordFlux"',
      ...Object.fromEntries(response.headers.entries())
    } 
  };
  
  if (!hdr.startsWith('Basic ')) {
    return new NextResponse('Auth required', challenge);
  }

  const [u, p] = Buffer.from(hdr.slice(6), 'base64').toString().split(':');
  if (u !== process.env.BASIC_USER || p !== process.env.BASIC_PASS) {
    return new NextResponse('Unauthorized', challenge);
  }
  
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};