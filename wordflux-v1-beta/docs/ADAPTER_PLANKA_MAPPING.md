AdapterPlanka Mapping Guide

Goal
- Replace placeholder endpoints in `app/lib/adapter/board-adapter.js` with the real Planka API routes and fields.

Assumptions
- Auth: Bearer token in `Authorization` header (PLANKA_TOKEN)
- Base URL: `PLANKA_BASE_URL` (e.g., http://localhost:3015)
- Board identifier: `PLANKA_BOARD_ID` (id or slug)

Endpoints to confirm

- Get board
  - Current placeholder: `GET /api/boards/:boardId`
  - Needs: metadata (name), lists (columns), cards
  - If lists/cards are separate collections, fetch both
  - Map list id to Column.id/name; attach cards under each list

- Lists (columns)
  - Placeholder list collection: `GET /api/boards/:boardId/lists`
  - Placeholder update WIP: `PATCH /api/lists/:listId { wipLimit }`
  - Confirm field names: `name`, optional WIP field

- Cards
  - Create: `POST /api/cards { title|name, description, listId, labels, assignees, dueDate, points }`
  - Update: `PATCH /api/cards/:cardId { title|name, description, labels, assignees, dueDate, points }`
  - Move:   `POST /api/cards/:cardId/move { listId, position }`
  - Delete: `DELETE /api/cards/:cardId`
  - Comments: `POST /api/cards/:cardId/comments { text, author }`
  - Confirm final payloads and shape of responses

Field mapping

- Columns
  - Normalization: column.id is set to the list name for a stable, human‑readable status (e.g., "Backlog").
  - Internal mapping is maintained from column name → listId and listId → name for API calls.
  - name: list.name or list.title

- Cards
  - id: card.id
  - title: card.title or card.name
  - desc: card.description
  - status: parent list id
  - labels: card.labels (array of strings?)
  - assignees: card.assignees (array of user names/emails?)
  - dueDate: ISO date string
  - points: number

Validation checklist

- [ ] Get board returns columns+cards in expected internal shape
- [ ] Create card adds to specified column and `getBoard` reflects it
- [ ] Move card updates list; position optional
- [ ] Column name passed to agent (e.g., toColumn: "Backlog") resolves to actual listId for Planka
- [ ] Update card supports title/description/labels/assignees/dueDate/points
- [ ] Delete card removes it from board
- [ ] Add comment appends to card.comments
- [ ] Set WIP limit updates list

Strict vs fallback

- During setup, keep `PLANKA_FALLBACK_INTERNAL=1` to avoid user-facing errors
- After mapping is verified, set `PLANKA_STRICT=1` to surface adapter errors
