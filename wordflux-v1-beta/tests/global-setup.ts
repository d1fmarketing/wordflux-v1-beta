import { mkdir, writeFile } from 'node:fs/promises';
import { encode } from 'next-auth/jwt';

export default async function globalSetup() {
  const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000';
  const email = process.env.AUTH_TEST_EMAIL || 'admin@wordflux.local';
  const secret = process.env.NEXTAUTH_SECRET || 'wordflux-secret-key-2025-production';
  const host = new URL(baseURL).hostname;

  const maxAge = 60 * 60 * 12; // 12 hours

  const sessionToken = await encode({
    secret,
    token: {
      name: 'Admin',
      email,
      sub: '1',
    },
    maxAge,
  });

  const now = Math.floor(Date.now() / 1000);
  const exp = now + maxAge;

  const state = {
    cookies: [
      {
        name: 'next-auth.session-token',
        value: sessionToken,
        domain: host,
        path: '/',
        httpOnly: true,
        secure: false,
        sameSite: 'Lax' as const,
        expires: exp,
      },
      {
        name: 'next-auth.csrf-token',
        value: `${sessionToken}|${sessionToken}`,
        domain: host,
        path: '/',
        httpOnly: true,
        secure: false,
        sameSite: 'Lax' as const,
        expires: exp,
      },
      {
        name: 'next-auth.callback-url',
        value: encodeURIComponent(`${baseURL}/workspace`),
        domain: host,
        path: '/',
        httpOnly: true,
        secure: false,
        sameSite: 'Lax' as const,
        expires: exp,
      },
    ],
    origins: [] as any[],
  };

  await mkdir('.auth', { recursive: true });
  await writeFile('.auth/admin.json', JSON.stringify(state, null, 2));
}
