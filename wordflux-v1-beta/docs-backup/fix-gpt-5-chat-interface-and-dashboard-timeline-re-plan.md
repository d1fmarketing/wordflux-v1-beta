# Implementation Plan: Fix GPT-5 Chat Interface and Dashboard Timeline Rendering

**Branch**: `feature/fix-gpt-5-chat-interface-and-dashboard-timeline-re` | **Date**: 2025-09-11 | **Spec**: [/home/ubuntu/wordflux-spec/fix-gpt-5-chat-interface-and-dashboard-timeline-re.md]
**Input**: Feature specification from `/home/ubuntu/wordflux-spec/fix-gpt-5-chat-interface-and-dashboard-timeline-re.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → SUCCESS: Spec loaded and analyzed
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → Project Type: web (Next.js frontend + Node.js backend)
   → Structure Decision: Option 2 (Web application)
3. Evaluate Constitution Check section below
   → Simplicity violations: Using existing Next.js patterns
   → Justification: Bug fix to existing system
   → Update Progress Tracking: Initial Constitution Check
4. Execute Phase 0 → research.md
   → Research existing implementation patterns
   → Document current bugs and root causes
5. Execute Phase 1 → contracts, data-model.md, quickstart.md, CLAUDE.md
   → Define chat API contract
   → Define timeline data model fixes
6. Re-evaluate Constitution Check section
   → No new violations introduced
   → Update Progress Tracking: Post-Design Constitution Check
7. Plan Phase 2 → Describe task generation approach
   → Tasks for chat interface creation
   → Tasks for timeline bug fixes
8. STOP - Ready for /tasks command
```

## Summary
Fix critical UI issues: restore GPT-5 chat interface that was removed due to SSR crashes, and fix dashboard timeline rendering that shows duplicated weekday labels in every calendar cell. Both issues are preventing normal application usage.

## Technical Context
**Language/Version**: TypeScript 5.x / Node.js 18+
**Primary Dependencies**: Next.js 14.2.5, React 18, OpenAI SDK, Socket.io
**Storage**: Kanboard (external), localStorage (client state)
**Testing**: Playwright (E2E), Jest (unit)
**Target Platform**: Ubuntu Linux server, modern web browsers
**Project Type**: web - Next.js application with API routes
**Performance Goals**: <5s chat response time, <200ms timeline render
**Constraints**: Must maintain SSR compatibility, preserve existing data
**Scale/Scope**: ~50 components, 20+ API endpoints, 3 main pages

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Simplicity**:
- Projects: 1 (wordflux-v3 monorepo)
- Using framework directly? YES (Next.js patterns)
- Single data model? YES (reusing existing models)
- Avoiding patterns? YES (no new abstractions)

**Architecture**:
- EVERY feature as library? N/A (bug fix to existing code)
- Libraries listed: OpenAI SDK, Socket.io client, date-fns
- CLI per library: N/A (web application)
- Library docs: Existing documentation maintained

**Testing (NON-NEGOTIABLE)**:
- RED-GREEN-Refactor cycle enforced? YES
- Git commits show tests before implementation? YES
- Order: Contract→Integration→E2E→Unit strictly followed? YES
- Real dependencies used? YES (real OpenAI API, Kanboard)
- Integration tests for: chat API, timeline rendering
- FORBIDDEN: Implementation before test ✓ Understood

**Observability**:
- Structured logging included? YES (existing console logs)
- Frontend logs → backend? YES (error reporting exists)
- Error context sufficient? YES (stack traces included)

**Versioning**:
- Version number assigned? 3.0.0 (existing)
- BUILD increments on every change? YES (PM2 restarts)
- Breaking changes handled? N/A (bug fix only)

## Project Structure

### Documentation (this feature)
```
/home/ubuntu/wordflux-spec/
├── fix-gpt-5-chat-interface-and-dashboard-timeline-re.md       # Feature spec
├── fix-gpt-5-chat-interface-and-dashboard-timeline-re-plan.md  # This file
├── research.md                                                  # Phase 0 output
├── data-model.md                                               # Phase 1 output
├── quickstart.md                                               # Phase 1 output
├── contracts/                                                  # Phase 1 output
└── tasks.md                                                    # Phase 2 output (/tasks command)
```

### Source Code (repository root)
```
/home/ubuntu/wordflux-v3/
├── app/
│   ├── page.tsx                 # Main page (needs chat restoration)
│   ├── chat/                    # New chat page directory
│   │   └── page.tsx            # Dedicated chat interface
│   ├── dashboard/
│   │   └── page.tsx            # Dashboard with timeline
│   ├── components/
│   │   ├── ChatPanel.tsx      # Chat component (needs SSR fix)
│   │   ├── board/
│   │   │   └── TimelineView.tsx # Timeline (needs rendering fix)
│   └── api/
│       ├── chat/               # Chat API endpoint
│       └── meta/               # New meta endpoint for verification
└── lib/
    └── agent-controller-v2.ts  # Chat backend logic
```

**Structure Decision**: Option 2 (Web application) - existing Next.js structure

## Phase 0: Outline & Research
1. **Extract unknowns from Technical Context**:
   - Current ChatPanel SSR crash root cause
   - Timeline calendar rendering logic issue
   - Socket.io SSR compatibility approach
   - GPT-5 model configuration location

2. **Generate and dispatch research agents**:
   ```
   Task: "Research Next.js 14 SSR-safe dynamic imports for ChatPanel"
   Task: "Find Calendar grid rendering pattern without text overflow"
   Task: "Best practices for Socket.io in Next.js App Router"
   Task: "OpenAI GPT-5 Pro model configuration"
   ```

3. **Consolidate findings** in `research.md`:
   - Decision: Use dynamic imports with ssr: false for ChatPanel
   - Rationale: Prevents window/localStorage SSR errors
   - Alternatives: Conditional rendering (more complex)

**Output**: research.md with implementation approach

## Phase 1: Design & Contracts
*Prerequisites: research.md complete*

1. **Extract entities from feature spec** → `data-model.md`:
   - ChatMessage: { role, content, timestamp }
   - TimelineEvent: { date, title, status }
   - CalendarCell: { day, events[] }

2. **Generate API contracts** from functional requirements:
   - POST /api/chat - Send message, receive response
   - GET /api/meta - Build verification endpoint
   - Output OpenAPI schema to `/contracts/chat-api.yaml`

3. **Generate contract tests** from contracts:
   - test-chat-api.spec.ts - Chat endpoint schema validation
   - test-timeline-render.spec.ts - Timeline DOM structure test

4. **Extract test scenarios** from user stories:
   - Chat loads without errors
   - Messages send and receive
   - Timeline renders correctly
   - Calendar shows proper structure

5. **Update CLAUDE.md incrementally**:
   - Add GPT-5 Pro configuration
   - Document chat/timeline fixes
   - Keep under 150 lines

**Output**: data-model.md, /contracts/*, failing tests, quickstart.md, CLAUDE.md

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Create /chat page with SSR-safe ChatPanel [P]
- Fix TimelineView weekday rendering [P]
- Add /api/meta endpoint [P]
- Update navigation with chat link
- Configure GPT-5 Pro model
- Fix Kanboard authentication
- Rebuild and restart PM2
- Update Nginx configuration

**Ordering Strategy**:
- Tests first (RED phase)
- Independent fixes in parallel [P]
- Configuration changes
- Deployment steps last

**Estimated Output**: 15-20 numbered, ordered tasks in tasks.md

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)
**Phase 4**: Implementation (execute tasks.md)
**Phase 5**: Validation (run tests, verify on public IP)

## Complexity Tracking
*No violations requiring justification - this is a bug fix to existing system*

## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - approach described)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documented (none)

---