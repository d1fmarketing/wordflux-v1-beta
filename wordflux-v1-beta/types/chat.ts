export type Action =
  | { type: 'create_card'; id?: string; title?: string; column?: string }
  | { type: 'move_card'; id?: string; title?: string; from?: string; to?: string }
  | { type: 'update_card'; id: string; patch: Record<string, unknown> }
  | { type: 'delete_card'; id?: string; title?: string }
  | ({ type: 'set_priority' | 'set_due' | 'set_points' | 'set_assignee' | 'set_label'; id: string } & Record<string, unknown>);

export type ChatEnvelope = {
  ok: boolean;
  reply?: string;
  actions?: Action[];
  needs_confirmation?: boolean;
  question?: string;
  options?: Array<{ id: string; title: string }>;
  deterministic?: boolean;
  tools?: string[];
};
