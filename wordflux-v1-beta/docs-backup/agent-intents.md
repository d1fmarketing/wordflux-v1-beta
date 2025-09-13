# Agent Intents (WordFlux v3)

This document describes the JSON intents produced by the GPT‑5 agent and how the server applies them.

## Intent Envelope

The agent returns a JSON object with:

```jsonc
{
  "reply": "Human-friendly response (<= 60 words)",
  "actions": [ { /* action objects below */ } ],
  "needsClarification": false,
  "clarificationQuestion": null,
  "suggestions": ["next action 1", "next action 2"]
}
```

Notes
- Mirror the user language (Portuguese/English).
- Keep `reply` concise, accurate, and aligned with executed actions.
- If ambiguous, set `needsClarification = true` and provide `clarificationQuestion`.
- `clarificationQuestion` and `suggestions` may be omitted or null.

## Actions (Schemas)

Create
```json
{ "type": "create_card", "title": "string", "column": "string", "description": "optional string" }
```

Move
```json
{ "type": "move_card", "identifier": "#ID or title", "toColumn": "string" }
```

Update
```json
{ "type": "update_card", "identifier": "#ID or title", "updates": { "title": "optional", "description": "optional" } }
```

Delete
```json
{ "type": "delete_card", "identifier": "#ID or title" }
```

List (with filters)
```json
{ "type": "list_cards", "column": "optional string", "query": "optional string", "status": "all|active|done", "assignee": "optional username|me" }
```

Search (with filters)
```json
{ "type": "search_cards", "query": "string", "column": "optional string", "status": "all|active|done", "assignee": "optional username|me" }
```

Bulk Move
```json
{ "type": "bulk_move", "identifiers": ["#1", "#2"], "toColumn": "string" }
```

Add Comment
```json
{ "type": "add_comment", "identifier": "#ID or title", "comment": "string" }
```

Field semantics
- `identifier`: accepts `#ID`, exact title, or partial title.
- `column` / `toColumn`: must match visible column names (case‑insensitive).
- `status`: maps to Kanboard `is_active` (active=1, done=0).
- `assignee`: matches usernames. `me` is reserved for future auth (currently no‑op filter).
- Optional filter fields may be null or omitted.

## Examples

Create (PT)
```jsonc
{
  "reply": "Criei 'Página Inicial' em Backlog.",
  "actions": [
    { "type": "create_card", "title": "Página Inicial", "column": "Backlog", "description": "Especificar seções e CTA" }
  ],
  "needsClarification": false,
  "suggestions": ["Mover para Ready quando priorizado", "Adicionar critérios de aceite"]
}
```

Move by ID (EN)
```jsonc
{
  "reply": "Moved 'Fix login bug' to Done.",
  "actions": [ { "type": "move_card", "identifier": "#5", "toColumn": "Done" } ],
  "needsClarification": false
}
```

Ambiguous reference → Clarify
```jsonc
{
  "reply": "I found 2 cards with 'auth'.",
  "actions": [],
  "needsClarification": true,
  "clarificationQuestion": "Which one do you mean: #2 'Integrate auth' or #7 'Auth tests'?",
  "suggestions": ["Move #2 to WIP", "Open #7 details"]
}
```

List with filters
```jsonc
{
  "reply": "You have 2 active tasks in Ready containing 'auth'.",
  "actions": [
    { "type": "list_cards", "column": "Ready", "query": "auth", "status": "active", "assignee": "me" }
  ]
}
```

Search with filters
```jsonc
{
  "reply": "No done tasks in Ready matching 'auth'.",
  "actions": [ { "type": "search_cards", "query": "auth", "column": "Ready", "status": "done" } ]
}
```

Bulk move
```jsonc
{
  "reply": "Moved 3 cards to Done.",
  "actions": [ { "type": "bulk_move", "identifiers": ["#3", "#4", "#7"], "toColumn": "Done" } ]
}
```

Add comment
```jsonc
{
  "reply": "Comment added to #12.",
  "actions": [ { "type": "add_comment", "identifier": "#12", "comment": "Please add acceptance criteria." } ]
}
```

## Controller Behavior (Summary)
- Ambiguity: if multiple matches, interpreter should set `needsClarification = true` and not include actions.
- `list_cards`:
  - With `column`: returns tasks in that column after filters.
  - Without `column`: groups tasks by column.
- `search_cards`: searches titles/descriptions, then applies filters.
- After any change (create/move/update/delete), server refreshes board state and the UI revalidates.

## Special Text Commands
- `undo` and `redo` are handled by the controller (not as actions). `undo` replays a reverse action when available; `redo` is currently unimplemented.

## Language and Tone
- Mirror user language.
- Keep `reply` short, specific, and consistent with executed actions.
- Provide 2–3 helpful `suggestions` guiding next steps.

