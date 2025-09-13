# WordFlux Constitution

## Core Principles

### I. Minimal Mode Architecture
Every feature must operate in minimal mode first. Start with the simplest working implementation leveraging existing tools (Planka for boards, OpenAI for chat). Only add complexity when proven necessary through user feedback and measurable performance needs.

### II. Component-First Development  
New features begin as isolated React components or API routes. Components must be self-contained with clear props interfaces, independent state management via hooks/SWR, and comprehensive error boundaries. No global state pollution.

### III. Test-Driven Development (NON-NEGOTIABLE)
TDD is mandatory for all features:
- API tests written first using the test suite (test:api)
- UI tests via Playwright before implementation (test:ui)
- Red-Green-Refactor cycle strictly enforced
- Every PR must include passing tests

### IV. API Contract Integrity
All endpoints must follow consistent patterns:
- Success: `{ data, meta? }`
- Error: `{ error: string, details?: any }`
- Health checks required for all services
- OpenAPI/REST conventions for predictability

### V. Progressive Enhancement
Features ship behind feature flags or environment variables:
- Start with core functionality
- Add enhancements based on telemetry
- Maintain backward compatibility
- Document all feature toggles in CLAUDE.md

### VI. Observability & Debugging
Every component and service must be debuggable:
- Structured logging to PM2 logs
- Health endpoints with version info
- Error tracking with meaningful messages
- Performance metrics for critical paths

## Technical Constraints

### Stack Requirements
- **Framework**: Next.js 14+ with App Router
- **Language**: JavaScript/TypeScript  
- **Styling**: Tailwind CSS only
- **State**: SWR for server state, React hooks for local
- **Testing**: Playwright for E2E, API test suite for backend
- **Process**: PM2 for production, npm scripts for development

### Deployment Standards
- All changes must pass lint (npm run lint)
- Deploy via agents only (deploy-agent.cjs)
- Cloudflare tunnel for public access
- Environment variables documented in CLAUDE.md

## Development Workflow

### Feature Development
1. Create specification using /specify command
2. Generate implementation plan with /plan
3. Break down into tasks via /tasks
4. Implement following TDD principles
5. Deploy using automated agents

### Quality Gates
- Lint and format checks must pass
- All tests green (api, ui, e2e)
- Health check responds correctly
- No console errors in production
- Agent validation successful

### Code Review Requirements
- Follow existing patterns in codebase
- No new dependencies without justification
- Security: No exposed secrets/keys
- Performance: No blocking operations
- Documentation: Update CLAUDE.md if needed

## Governance

The Constitution supersedes all development practices. Any amendments require:
1. Documentation of the proposed change
2. Impact analysis on existing features
3. Migration plan if breaking changes
4. Team consensus before implementation

All code must comply with constitutional principles. Violations should be flagged in PR reviews. Use CLAUDE.md for day-to-day development guidance.

**Version**: 1.0.0 | **Ratified**: 2025-09-09 | **Last Amended**: 2025-09-09