import type { NextRequest } from 'next/server';
import { securityMiddleware } from './lib/security-middleware';

export async function middleware(request: NextRequest) {
  return securityMiddleware(request);
}

export const config = {
  matcher: '/api/:path*'
};
