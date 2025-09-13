# Implementation Plan Template

## Metadata
- **Input**: {{FEATURE_SPEC_PATH}}
- **Output**: Implementation artifacts in {{SPECS_DIR}}
- **Status**: NOT_STARTED

## Technical Context
{{ARGUMENTS}}

## Execution Flow (main)
1. Load feature specification from Input path
2. Validate specification completeness
3. Execute Phase 0: Research & Analysis
4. Gate: Check research completion
5. Execute Phase 1: Design & Architecture
6. Gate: Check design completion
7. Execute Phase 2: Implementation Planning
8. Gate: Check planning completion
9. Generate final artifacts
10. Update Progress Tracking

## Phase 0: Research & Analysis
### Objectives
- Analyze existing codebase for integration points
- Identify potential conflicts or breaking changes
- Research best practices for the technology stack

### Outputs
- `research.md`: Technical research findings and recommendations

### Gate Checks
- [ ] Existing code analyzed
- [ ] Dependencies identified
- [ ] Risk assessment complete

## Phase 1: Design & Architecture
### Objectives
- Design data models and schemas
- Define API contracts and interfaces
- Create user flow diagrams

### Outputs
- `data-model.md`: Database schemas and data structures
- `contracts/`: API specifications and interfaces
- `quickstart.md`: Developer setup guide

### Gate Checks
- [ ] Data models defined
- [ ] API contracts specified
- [ ] Integration points mapped

## Phase 2: Implementation Planning
### Objectives
- Break down work into discrete tasks
- Define testing strategies
- Establish success metrics

### Outputs
- `tasks.md`: Detailed task breakdown with estimates

### Gate Checks
- [ ] All tasks defined
- [ ] Dependencies sequenced
- [ ] Time estimates provided

## Error Handling
- If specification incomplete: REQUEST_CLARIFICATION
- If technical blocker found: ESCALATE_TO_ARCHITECT
- If timeline unrealistic: PROPOSE_PHASED_APPROACH

## Progress Tracking
- [ ] Phase 0: NOT_STARTED
- [ ] Phase 1: NOT_STARTED
- [ ] Phase 2: NOT_STARTED
- [ ] Final Review: NOT_STARTED

## Notes
{{IMPLEMENTATION_NOTES}}