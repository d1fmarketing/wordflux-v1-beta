# CHANGELOG - WordFlux v1-beta

All notable changes to this project will be documented in this file.

## [2025-09-17] - Delete Command Implementation & MCP Fixes

### Added
- **Delete/Remove Command Support**
  - Implemented remove/delete command parsing in `/lib/agent/parse.ts`
  - Supports multiple formats: `remove #123`, `delete task 456`, `apagar #789`
  - Added RemoveTask schema to `/lib/agent/action-schema.ts`
  - Connected remove operations to MCP in `/app/api/chat/deterministic-route.ts`

- **MCP Remove Operation**
  - Added remove_task case in deterministic route
  - Fixed MCP remove_card operation signature (was incorrectly passing projectId)
  - Successfully tested deletion of 22 test cards

### Fixed
- **MCP Integration**
  - Corrected removeTask signature in `/app/api/mcp/route.ts` (only needs taskId)
  - Fixed MCP operation flow for card deletion
  - Verified all MCP operations working correctly

### Identified Issues
- **UI Update Delays**
  - Board doesn't refresh immediately after MCP operations (4-second polling delay)
  - Missing 'board-refresh' event listener in Board2.tsx
  - Chat dispatches events but Board doesn't listen

- **Configuration Errors**
  - Invalid `export const revalidate = 0` in workspace/page.tsx causing PM2 crashes
  - Error: "Invalid revalidate value '[object Object]'"

- **CSS Variables**
  - Some --wf-* variables not properly loaded in production builds
  - ToastHost references variables that may be missing

### Architecture Clarification
- **Agent-First MCP Design**
  - System is designed for AGENT control through MCP
  - Chat interface commands the agent, not direct UI manipulation
  - Board is a read-only view of agent-controlled state
  - All state changes go through MCP protocol
  - Both drag-and-drop AND chat commands use same MCP backend

### Cleanup
- Removed 22 test cards from the board
- Created cleanup script at `/scripts/cleanup-test-cards.sh`

### Pending Fixes
1. Add 'board-refresh' event listener to Board2.tsx
2. Remove invalid revalidate export from workspace/page.tsx
3. Reduce polling interval from 4000ms to 500-1000ms
4. Ensure CSS variables properly loaded

---

## [2025-09-16] - Previous Updates

### Added
- Tidy board command implementation
- Agent lens highlights for filtered cards
- MCP undo functionality with optional Redis storage
- Centralized undo stack with persistence

### Fixed
- Board state normalization for column names/order server-side

---

## [2025-09-12] - Production Deployment

### Security
- Removed 9 publicly exposed Docker containers
- All containers now on localhost only

### Fixed
- Board state null checks for project ID in polling
- Backup script updated to use SQLite instead of PostgreSQL
- Nginx redirect from / to /workspace

### Added
- Automated health monitoring via cron (every 5 minutes)
- Auto Time Tracking for "Work in progress" tasks
- Smart Daily Summary command
- Task Templates for bug/deploy/meeting tasks

---

*Format: [YYYY-MM-DD] - Brief Description*