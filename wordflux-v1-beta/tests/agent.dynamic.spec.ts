import { test, expect } from '@playwright/test';
import { randomUUID } from 'crypto';

test('PT-BR column works without canonical table', async ({ request }) => {
  const response = await request.post('/api/chat', {
    data: {
      message: 'mover "QA login bug patch" para Revisão',
      request_id: randomUUID()
    },
    headers: { 'content-type': 'application/json' }
  });
  expect(response.ok()).toBeTruthy();
  const body = await response.json();

  expect(body.ok).toBeTruthy();
  expect(body.actions?.[0]?.type).toBe('move_card');
  const target = String(body.actions?.[0]?.to || '');
  expect(target.length).toBeGreaterThan(0);
  expect(target.toLowerCase()).toContain('rev');
});

test('Bare "done" either acts or asks once', async ({ request }) => {
  const response = await request.post('/api/chat', {
    data: { message: 'done', request_id: randomUUID() },
    headers: { 'content-type': 'application/json' }
  });
  expect(response.ok()).toBeTruthy();
  const body = await response.json();

  expect(
    body.ok === true ||
      (body.needs_confirmation === true && Array.isArray(body.options) && body.options.length >= 1) ||
      body.error === 'rate_limited'
  ).toBeTruthy();
});
