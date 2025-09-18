import type { FilterSpec } from './filter-spec';
import { parseDerivedMetadata } from './card-derivations';
import { normalizeColumnName, matchesDateRange, matchesPriority, numericCompare, includesAny, includesAll, listHasPrefix } from './filter-utils';

type BoardCardWithColumn = {
  column: string;
  card: any;
};

export function filterCardsFromState(state: { columns: any[] }, spec: FilterSpec) {
  const matches: Array<{ columnId: string | number; cardId: string | number }> = [];

  const columns = (state.columns || []).map((column: any) => {
    const columnName = String(column.name || column.title || '');
    const cards = (column.cards || []).map((card: any) => {
      const derived = card.derived || parseDerivedMetadata(card.description, card.labels || card.tags || [], [], {
        dueDate: card.due_date ?? card.dueDate ?? null,
        createdAt: card.created_at ?? card.createdAt ?? null,
        column: columnName,
      });

      if (matchesSpec(card, derived, columnName, spec)) {
        matches.push({ columnId: column.id, cardId: card.id });
        return { ...card, derived, matched: true };
      }

      if (spec.includeSubtasks === false) {
        return null;
      }

      return { ...card, derived, matched: false };
    }).filter(Boolean);

    return { ...column, cards };
  });

  return { columns, matches };
}

function matchesSpec(card: any, derived: any, columnName: string, spec: FilterSpec) {
  const labels = (card.labels || card.tags || []).map((label: string) => label.toLowerCase());
  const text = `${card.title ?? ''} ${(card.description ?? '').toLowerCase()}`;

  if (spec.text && !text.includes(spec.text.toLowerCase())) return false;
  if (spec.ids && !spec.ids.some(id => String(id) === String(card.id))) return false;
  if (spec.columns && !spec.columns.includes(columnName as any)) return false;

  if (spec.assignees?.length) {
    const assignees = (card.assignees || []).map((value: string) => value.toLowerCase());
    const desired = spec.assignees.map(value => value.toLowerCase());
    if (!desired.every(value => assignees.some(name => name.includes(value.replace(/^@/, ''))))) return false;
  }

  if (spec.labelsAny && !includesAny(labels, spec.labelsAny)) return false;
  if (spec.labelsAll && !includesAll(labels, spec.labelsAll)) return false;

  if (!listHasPrefix(labels, 'client:', spec.clients)) return false;
  if (!listHasPrefix(labels, 'project:', spec.projects)) return false;
  if (!listHasPrefix(labels, 'team:', spec.teams)) return false;
  if (!listHasPrefix(labels, 'type:', spec.types)) return false;

  if (spec.createdBy?.length) {
    const value = derived.createdBy?.toLowerCase();
    if (!value || !spec.createdBy.some(entry => entry.toLowerCase() === value)) return false;
  }

  if (spec.followers?.length) {
    const followerSet = new Set((derived.followers || []).map((value: string) => value.toLowerCase()));
    if (!spec.followers.every(entry => followerSet.has(entry.toLowerCase()))) return false;
  }

  if (!matchesDateRange(card.due_date ?? card.dueDate ?? null, spec.due)) return false;
  if (!matchesDateRange(derived.desiredStart, spec.desiredStart)) return false;
  if (!matchesPriority(derived.priority, spec.priority)) return false;
  if (!numericCompare(derived.points, spec.points)) return false;

  if (spec.reopened && !labels.includes('reopened')) return false;
  if (spec.shared && !derived.shared) return false;
  if (spec.recurring && !derived.recurring) return false;
  if (spec.awaitingApproval && !derived.awaitingApproval) return false;
  if (spec.myOpenParts && !(derived.openParts > 0)) return false;
  if (spec.effortExceeded && !derived.effortExceeded) return false;
  if (spec.slaOver && !derived.slaOver) return false;
  if (spec.idleOver && !derived.idleOver) return false;

  return true;
}
