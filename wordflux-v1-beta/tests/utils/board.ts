import { APIRequestContext, expect } from '@playwright/test';

function normalizeTitle(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

function cardExists(state: any, title: string): boolean {
  const needle = normalizeTitle(title);
  const pools: any[] = [];
  if (Array.isArray(state?.cards)) pools.push(...state.cards);
  if (Array.isArray(state?.tasks)) pools.push(...state.tasks);
  for (const column of state?.columns ?? []) {
    if (Array.isArray(column?.cards)) pools.push(...column.cards);
    if (Array.isArray(column?.tasks)) pools.push(...column.tasks);
  }
  return pools.some((card) => normalizeTitle(card?.title) === needle);
}

export type ColumnInfo = {
  id?: string | number;
  name?: string;
  canonicalName?: string;
  displayName?: string;
  originalName?: string;
};

export function columnLabel(column: ColumnInfo): string {
  return String(column?.canonicalName || column?.displayName || column?.originalName || column?.name || '').trim();
}

export function columnSlug(column: ColumnInfo): string {
  return columnLabel(column).toLowerCase();
}

export async function getBoardState(request: APIRequestContext) {
  const res = await request.get('/api/board/state', {
    headers: { 'content-type': 'application/json' },
  });
  expect(res.ok(), 'Failed to fetch board state').toBeTruthy();
  return res.json();
}

export function pickTwoColumns(state: any): { from: ColumnInfo; to: ColumnInfo } {
  const columns: ColumnInfo[] = (state?.columns ?? []).map((column: any) => column).filter((column: any) => columnLabel(column));
  if (columns.length < 2) {
    throw new Error('Need at least two columns to move between');
  }

  const preferred = ['Backlog', 'Doing', 'In Progress', 'Review', 'Revisão', 'Ready', 'Done', 'Concluído'];
  const present = preferred
    .map(label => columns.find((column) => columnLabel(column).toLowerCase() === label.toLowerCase()))
    .filter((column): column is ColumnInfo => Boolean(column));

  const ordered = Array.from(new Set([...present, ...columns]));
  const from = ordered[0];
  const to = ordered.find((column) => column !== from);
  if (!to) {
    throw new Error('Unable to pick two distinct columns');
  }
  return { from, to };
}

export async function ensureCard(request: APIRequestContext, title: string, column: ColumnInfo): Promise<void> {
  const existing = await getBoardState(request);
  if (cardExists(existing, title)) return;

  const columnName = columnLabel(column);
  const createRes = await request.post('/api/board/create', {
    headers: { 'content-type': 'application/json' },
    data: { title, column: columnName },
  });
  if (createRes.ok()) {
    await waitForCard(request, title);
    return;
  }

  const chatRes = await request.post('/api/chat', {
    headers: { 'content-type': 'application/json' },
    data: { message: `criar tarefa "${title}" em ${columnName}`, request_id: uniqueId() },
  });
  expect(chatRes.ok(), 'Chat create failed').toBeTruthy();
  const body = await chatRes.json();
  expect(body?.ok ?? true).toBeTruthy();
  expect(body?.needs_confirmation ?? false, 'Chat create requested confirmation').toBeFalsy();
  await waitForCard(request, title);
}

export async function moveCard(request: APIRequestContext, title: string, toColumn: ColumnInfo): Promise<void> {
  const columnName = columnLabel(toColumn);
  const directRes = await request.post('/api/board/move', {
    headers: { 'content-type': 'application/json' },
    data: { title, column: columnName },
  });
  if (directRes.ok()) {
    return;
  }

  const chatRes = await request.post('/api/chat', {
    headers: { 'content-type': 'application/json' },
    data: { message: `mover "${title}" para ${columnName}`, request_id: uniqueId() },
  });
  expect(chatRes.ok(), 'Chat move failed').toBeTruthy();
  const body = await chatRes.json();
  expect(body?.ok ?? true).toBeTruthy();
  expect(body?.needs_confirmation ?? false, 'Chat move requested confirmation').toBeFalsy();
}

async function waitForCard(request: APIRequestContext, title: string, timeout = 10_000): Promise<void> {
  const expiry = Date.now() + timeout;
  while (Date.now() < expiry) {
    const state = await getBoardState(request);
    if (cardExists(state, title)) return;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`Card "${title}" not found after creation`);
}

type CryptoLike = { randomUUID?: () => string };

function uniqueId(): string {
  const globalCrypto = (globalThis as { crypto?: CryptoLike }).crypto;
  if (globalCrypto?.randomUUID) {
    return globalCrypto.randomUUID();
  }
  return `req_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}
