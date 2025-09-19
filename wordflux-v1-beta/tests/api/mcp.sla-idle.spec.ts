import { test, expect, request } from '@playwright/test';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const TOKEN = process.env.MCP_TOKEN || 'dev-token';

async function mcp(method: string, params: any) {
  const ctx = await request.newContext({
    extraHTTPHeaders: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json'
    }
  });
  const res = await ctx.post(`${BASE}/api/mcp`, {
    data: { jsonrpc: '2.0', id: 't', method, params }
  });
  expect(res.ok()).toBeTruthy();
  return res.json();
}

test('0h SLA and 0h idle breach immediately', async () => {
  const create = await mcp('create_card', {
    title: 'Gamma — zero-hour checks',
    column: 'Review',
    description: '[sla:0h] [idle:0h] Repro for zero-hour'
  });
  const id = create.result.id;

  const sla = await mcp('filter_cards', { where: { slaOver: true } });
  const slaIds = sla.result.matches.map((c: any) => c.id);
  expect(slaIds).toContain(id);

  const idle = await mcp('filter_cards', { where: { idleOver: { hours: 0 } } });
  const idleIds = idle.result.matches.map((c: any) => c.id);
  expect(idleIds).toContain(id);
});
