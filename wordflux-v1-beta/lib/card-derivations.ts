import type { DerivedCardMetadata, Priority } from './filter-spec';

const regex = {
  points: /\[(\d+)\s*pts\]/i,
  start: /\[start:\s*(\d{4}-\d{2}-\d{2})\]/i,
  delivery: /\[delivery:\s*(\d{4}-\d{2}-\d{2})\]/i,
  sla: /\[sla:\s*(\d+)\s*h\]/i,
  idle: /\[idle:\s*(\d+)\s*h\]/i,
  repeat: /\[repeat:\s*(daily|weekly|monthly)\]/i,
};

function stripToken(value: string, token: RegExp): { rest: string; match: string | null } {
  const match = value.match(token);
  if (!match) return { rest: value, match: null };
  const rest = value.replace(match[0], '').replace(/\s{2,}/g, ' ').trim();
  return { rest, match: match[1] ?? null };
}

function derivePriority(labels: string[]): Priority | null {
  const raw = labels.map(label => label.toLowerCase()).find(label => label.startsWith('priority-'));
  if (!raw) return null;
  const slug = raw.split('priority-')[1];
  if (slug === 'urgent' || slug === 'high' || slug === 'medium' || slug === 'low') {
    return slug;
  }
  return null;
}

export function parseDerivedMetadata(
  description: string | null | undefined,
  labels: string[] = [],
  assignees: Array<{ username?: string | null }> = [],
  options: {
    me?: string | null;
    dueDate?: string | null;
    createdAt?: string | null;
    lastActivityAt?: string | null;
    column?: string | null;
  } = {}
): DerivedCardMetadata {
  const text = (description ?? '').trim();
  let working = text;

  const pointsToken = stripToken(working, regex.points);
  working = pointsToken.rest;
  const points = pointsToken.match ? Number(pointsToken.match) : null;

  const startToken = stripToken(working, regex.start);
  working = startToken.rest;

  const deliveryToken = stripToken(working, regex.delivery);
  working = deliveryToken.rest;

  const slaToken = stripToken(working, regex.sla);
  working = slaToken.rest;

  const idleToken = stripToken(working, regex.idle);
  working = idleToken.rest;

  const repeatToken = stripToken(working, regex.repeat);
  working = repeatToken.rest;

  const followers = labels
    .filter(label => label.toLowerCase().startsWith('follower:'))
    .map(label => label.split(':')[1])
    .filter(Boolean);

  const createdByLabel = labels.find(label => label.toLowerCase().startsWith('created-by:'));
  const createdBy = createdByLabel ? createdByLabel.split(':')[1] ?? null : null;

  const openParts = (description?.match(/^- \[ \]/gim) || []).length;
  const completedParts = (description?.match(/^- \[x\]/gim) || []).length;
  const totalParts = openParts + completedParts;

  const dueDate = options.dueDate ? new Date(options.dueDate) : null;
  const now = new Date();
  const overdue = Boolean(dueDate && options.column !== 'Done' && dueDate.getTime() < now.getTime());

  const slaHours = slaToken.match ? Number(slaToken.match) : null;
  const createdAt = options.createdAt ? new Date(options.createdAt) : null;
  const slaOver = Boolean(
    slaHours && createdAt && (now.getTime() - createdAt.getTime()) / 3600000 > slaHours && options.column !== 'Done'
  );

  const idleHours = idleToken.match ? Number(idleToken.match) : null;
  const lastActivityAt = options.lastActivityAt ? new Date(options.lastActivityAt) : createdAt;
  const idleOver = Boolean(
    idleHours && lastActivityAt && (now.getTime() - lastActivityAt.getTime()) / 3600000 > idleHours && options.column !== 'Done'
  );

  const awaitingApproval = Boolean(
    options.column && /review/i.test(options.column) || labels.some(label => label === 'awaiting-approval')
  );

  const recurring = Boolean(repeatToken.match);
  const shared = labels.includes('shared');

  const assigneeUsernames = assignees.map(item => item?.username).filter(Boolean) as string[];
  const me = options.me?.toLowerCase().trim();
  const myOpenParts = Boolean(
    me && assigneeUsernames.some(username => username?.toLowerCase() === me) && openParts > 0
  );

  const priority = derivePriority(labels);
  const effortExceeded = Boolean(points && openParts > points);
  const allPartsDelivered = Boolean(totalParts > 0 && openParts === 0);

  return {
    points,
    priority,
    desiredStart: startToken.match,
    desiredDelivery: deliveryToken.match,
    slaHours,
    idleHours,
    repeatCadence: repeatToken.match as 'daily' | 'weekly' | 'monthly' | null,
    createdBy,
    followers,
    sanitizedDescription: working,
    openParts,
    totalParts,
    overdue,
    effortExceeded,
    slaOver,
    idleOver,
    awaitingApproval,
    recurring,
    shared,
    allPartsDelivered,
    myOpenParts,
  };
}
