export function normalizeColumnName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s#-]/g, '')
    .replace(/\b(move|put|send|drop|shift)\s+(the\s+)?/g, '')
    .replace(/\b(in|into|to)\s+(the\s+)?/g, '')
    .replace(/\b(the|a|an)\s+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function includesAny(haystack: string[], needles: string[]) {
  if (!needles.length) return true;
  const normalized = haystack.map(value => value.toLowerCase());
  return needles.some(needle => normalized.includes(needle.toLowerCase()));
}

export function includesAll(haystack: string[], needles: string[]) {
  if (!needles.length) return true;
  const normalized = haystack.map(value => value.toLowerCase());
  return needles.every(needle => normalized.includes(needle.toLowerCase()));
}

export function listHasPrefix(labels: string[], prefix: string, values?: string[]) {
  if (!values?.length) return true;
  const normalizedValues = values.map(value => value.toLowerCase());
  const normalizedLabels = labels.map(label => label.toLowerCase());
  const extracted = normalizedLabels
    .filter(label => label.startsWith(prefix))
    .map(label => label.slice(prefix.length));
  return normalizedValues.every(value => extracted.includes(value));
}

function parseDate(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function matchesDateRange(
  date: string | null | undefined,
  range?: { before?: string; after?: string; on?: string; overdue?: boolean; withinHrs?: number }
) {
  if (!range) return true;
  const target = parseDate(date);
  const now = new Date();
  if (range.overdue && !(target && target.getTime() < now.getTime())) {
    return false;
  }
  if (range.on && (!target || target.toISOString().slice(0, 10) !== range.on)) {
    return false;
  }
  if (range.before) {
    const before = parseDate(range.before);
    if (before && target && !(target.getTime() <= before.getTime())) return false;
  }
  if (range.after) {
    const after = parseDate(range.after);
    if (after && target && !(target.getTime() >= after.getTime())) return false;
  }
  if (range.withinHrs !== undefined) {
    if (!target) return false;
    const diffHours = (target.getTime() - now.getTime()) / 3600000;
    if (diffHours < 0 || diffHours > range.withinHrs) return false;
  }
  return true;
}

export function matchesPriority(actual: string | null, expected?: string | null) {
  if (!expected) return true;
  return actual === expected;
}

export function numericCompare(value: number | null, bounds?: { gte?: number; lte?: number }) {
  if (!bounds) return true;
  if (bounds.gte !== undefined && (value ?? -Infinity) < bounds.gte) return false;
  if (bounds.lte !== undefined && (value ?? Infinity) > bounds.lte) return false;
  return true;
}
