import { request } from '@playwright/test';

export default async () => {
  const base = process.env.BASE_URL || 'http://localhost:3000';
  const ctx = await request.newContext();
  try {
    const res = await ctx.get(`${base}/api/board/sync`);
    if (!res.ok()) {
      console.warn(`[globalSetup] Warm-up call failed: ${res.status()} ${res.statusText()}`);
    }
  } catch (error) {
    console.warn('[globalSetup] Warm-up request threw an error:', error);
  } finally {
    await ctx.dispose();
  }
};
