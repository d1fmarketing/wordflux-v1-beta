# Tasks: WordFlux Complete Reorganization & 100% Integration

**Feature**: Enterprise Dashboard - Full Integration & Minimalist UI  
**Date**: 2025-09-10  
**Branch**: `003-enterprise-dashboard-development`

## 🔴 CRITICAL ISSUES TO FIX
- 120 components built but NOT integrated into BoardPanel
- Mock user data everywhere (no real auth)
- Empty arrays as default props (no data connections)
- 18+ documentation files cluttering root
- Only LiveCursor using real hooks
- No AI integration controlling the board

## Execution Priority
1. **ORGANIZE** - Clean up the mess (Day 1)
2. **INTEGRATE** - Connect all 120 components (Day 2-3)
3. **SIMPLIFY** - Minimalist UI, remove clutter (Day 4)
4. **EMPOWER** - AI controls everything (Day 5)
5. **VALIDATE** - Test 100% functionality (Day 6)

---

## Phase 1: Project Organization & Cleanup (Day 1)

### T001: Create organized directory structure [P]
**File**: Create `/home/ubuntu/wordflux/docs/`, `/home/ubuntu/wordflux/backup/`
```bash
mkdir -p docs/{archive,api,technical,guides}
mkdir -p backup/{screenshots,logs,packages}
```
- Create clean folder structure for documentation
- Create backup folder for non-essential files
- Verify directory structure is logical

### T002: Move documentation files to docs/ [P]
**Files**: Move all *.md files from root
```bash
mv NORTH_STAR_MAP*.md docs/archive/
mv API.md API_DOCS.md docs/api/
mv ARCHITECTURE.md AUTH.md CHANGELOG.md docs/technical/
```
- Keep only README.md and CLAUDE.md in root
- Update any broken references

### T003: Archive non-essential files [P]
**Files**: Clean up root directory
```bash
mv *.log backup/logs/
mv *.png backup/screenshots/
mv *.deb *.tgz *.zip backup/packages/
```
- Move all clutter to backup folder
- Root should only have config files

### T004: Update all import paths
**Files**: Fix imports after reorganization
- Update documentation references
- Fix any broken imports
- Ensure build still works

---

## Phase 2: Fix Authentication & Connect Real Data (Day 2)

### T005: Replace ALL mock users with real auth
**File**: `/home/ubuntu/wordflux/app/dashboard/page.js`
```javascript
// DELETE: const user = { name: 'User' }
// ADD: const { user, loading } = useAuth()
```
- Remove every instance of mock user
- Use real JWT authentication
- Handle loading states properly

### T006: Create comprehensive useAuth hook
**File**: `/home/ubuntu/wordflux/app/hooks/useAuth.js`
```javascript
export function useAuth() {
  const { data: user, error, mutate } = useSWR('/api/auth/me')
  return { 
    user, 
    loading: !user && !error,
    error,
    logout: () => mutate(null)
  }
}
```

### T007: Connect BoardPanel to database [CRITICAL]
**File**: `/home/ubuntu/wordflux/app/components/board/BoardPanel.jsx`
```javascript
// DELETE: const mockCards = []
// ADD: const { data: cards } = useSWR('/api/cards')
```
- Remove ALL mock data
- Connect to real PostgreSQL via Prisma
- Ensure real-time updates work

### T008: Fix ALL empty default props
**Files**: Every component with `= []`
- TimeReportWidget: Connect to `/api/time/entries`
- MemberList: Connect to `/api/organization/members`
- OrganizationDashboard: Connect to `/api/organization/stats`
- NO MORE EMPTY ARRAYS!

---

## Phase 3: Integrate ALL 120 Components (Day 2-3)

### T009: Import Phase 1 components into BoardPanel
**File**: `/home/ubuntu/wordflux/app/components/board/BoardPanel.jsx`
```javascript
// Add to imports:
import CommentSection from './CommentSection'
import AssigneeSelector from './AssigneeSelector'
import DueDatePicker from './DueDatePicker'
import PrioritySelector from './PrioritySelector'
import LabelManager from './LabelManager'
import AttachmentList from './AttachmentList'

// Use in CardDetailsDrawer component
```

### T010: Import Phase 2 time tracking components
**File**: `/home/ubuntu/wordflux/app/dashboard/page.js`
```javascript
import TimeTracker from '@/app/components/time/TimeTracker'
import TimeEntryList from '@/app/components/time/TimeEntryList'
import ManualTimeEntry from '@/app/components/time/ManualTimeEntry'
import TimeReportWidget from '@/app/components/time/TimeReportWidget'
import ExportDialog from '@/app/components/time/ExportDialog'

// Add floating TimeTracker widget
<TimeTracker position="bottom-right" />
```

### T011: Import Phase 3 analytics components
**File**: `/home/ubuntu/wordflux/app/analytics/page.js`
```javascript
import MetricCard from '@/app/components/analytics/MetricCard'
import VelocityChart from '@/app/components/analytics/VelocityChart'
import BurndownChart from '@/app/components/analytics/BurndownChart'
import TeamPerformance from '@/app/components/analytics/TeamPerformance'
import ProjectHealth from '@/app/components/analytics/ProjectHealth'

// Connect to analytics.service.js for real data
```

### T012: Import Phase 4 real-time components [CRITICAL]
**File**: `/home/ubuntu/wordflux/app/components/board/BoardPanel.jsx`
```javascript
import PresenceAvatars from './PresenceAvatars'
import LiveCursor from './LiveCursor'
import ActivityFeed from './ActivityFeed'
import usePresence from '@/app/hooks/usePresence'

// Add to board layout:
<div className="relative">
  <PresenceAvatars boardId={boardId} />
  <LiveCursor boardId={boardId} containerRef={boardRef} />
  <ActivityFeed activities={realtimeActivities} />
</div>
```

### T013: Import Phase 5 organization components
**File**: Create `/home/ubuntu/wordflux/app/organization/page.js`
```javascript
'use client'
import MemberList from '@/app/components/organization/MemberList'
import InviteDialog from '@/app/components/organization/InviteDialog'
import OrganizationDashboard from '@/app/components/organization/OrganizationDashboard'
import RoleManager from '@/app/components/organization/RoleManager'

export default function OrganizationPage() {
  // Implement full organization management
}
```

---

## Phase 4: Minimalist UI Redesign (Day 4)

### T014: Remove ALL refresh buttons [CRITICAL]
**Files**: Every component with RefreshCw icon
```javascript
// DELETE: <button onClick={refresh}><RefreshCw /></button>
// ADD: useSWR with revalidateOnInterval: 30000
```
- Auto-refresh every 30 seconds
- No manual refresh buttons anywhere
- Show subtle loading states only

### T015: Simplify to single navigation bar
**File**: `/home/ubuntu/wordflux/app/dashboard/page.js`
```javascript
// Minimal header: 40px height
// Logo | Search | Avatar - that's it!
// Remove sidebar or auto-collapse
```

### T016: Implement auto-save everywhere
**Files**: All form components
```javascript
// Auto-save after 2 seconds of inactivity
const debouncedSave = debounce(saveData, 2000)
// Remove all save buttons
```

### T017: Create 3-color minimalist theme
**File**: `/home/ubuntu/wordflux/app/globals.css`
```css
:root {
  --primary: #6366f1;    /* Indigo - main actions */
  --secondary: #f3f4f6;  /* Gray - backgrounds */
  --accent: #10b981;     /* Green - success/active */
  /* DELETE all other color variables */
}
```

### T018: Add smooth micro-animations
**Files**: All interactive components
```javascript
// Add to all buttons/cards:
className="transition-all duration-200 hover:scale-[1.02]"
// Smooth, subtle, professional
```

---

## Phase 5: AI as Master Controller (Day 5)

### T019: Create AI command processor [CRITICAL]
**File**: `/home/ubuntu/wordflux/app/lib/services/ai-commands.js`
```javascript
export const AICommands = {
  // Card operations
  'create card': async (title) => {
    const card = await fetch('/api/cards', {
      method: 'POST',
      body: JSON.stringify({ title })
    })
    return card
  },
  'move card': async (cardId, columnId) => {
    await fetch(`/api/cards/${cardId}/move`, {
      method: 'PATCH',
      body: JSON.stringify({ columnId })
    })
  },
  'assign card': async (cardId, userId) => {
    await fetch(`/api/cards/${cardId}/assign`, {
      method: 'POST',
      body: JSON.stringify({ userId })
    })
  },
  // Board operations
  'show my tasks': () => filterByCurrentUser(),
  'archive completed': () => archiveCompletedCards(),
  'clear blockers': () => removeBlockedStatus(),
  // Time tracking
  'start timer': (cardId) => startTimer(cardId),
  'stop timer': () => stopTimer(),
  'show time report': () => generateTimeReport(),
  // Analytics
  'show velocity': () => displayVelocityChart(),
  'team performance': () => showTeamMetrics(),
  'sprint burndown': () => showBurndownChart()
}
```

### T020: Enhance ChatPanel with board control
**File**: `/home/ubuntu/wordflux/app/components/ChatPanel.jsx`
```javascript
import { AICommands } from '@/app/lib/services/ai-commands'

// Process natural language
const processCommand = async (message) => {
  const command = parseNaturalLanguage(message)
  const result = await AICommands[command.action](command.params)
  return formatResponse(result)
}
```

### T021: Implement natural language parser
**File**: `/home/ubuntu/wordflux/app/lib/services/nlp.js`
```javascript
export function parseNaturalLanguage(text) {
  // "Move authentication card to review"
  // → { action: 'move card', params: { card: 'authentication', column: 'review' }}
  
  // "Show me John's tasks"
  // → { action: 'filter', params: { user: 'John' }}
  
  // "Start timer on bug fix"
  // → { action: 'start timer', params: { card: 'bug fix' }}
}
```

### T022: Add proactive AI suggestions
**File**: `/home/ubuntu/wordflux/app/components/ChatPanel.jsx`
```javascript
const suggestions = [
  "3 cards are overdue. Would you like to see them?",
  "John has no tasks. Should I assign him something?",
  "Sprint velocity is down 20%. View report?",
  "5 cards have been in review for >3 days"
]
```

---

## Phase 6: Testing & 100% Validation (Day 6)

### T023: Test ALL 120 components render
**Manual Testing Checklist**:
```
□ CommentSection shows real comments
□ AssigneeSelector assigns real users
□ DueDatePicker saves to database
□ PrioritySelector updates card priority
□ LabelManager creates/applies labels
□ AttachmentList uploads files
□ TimeTracker starts/stops correctly
□ TimeEntryList shows real entries
□ ManualTimeEntry saves time
□ TimeReportWidget shows accurate data
□ ExportDialog exports PDF/CSV/Excel
□ MetricCard shows real metrics
□ VelocityChart renders with data
□ BurndownChart shows sprint progress
□ TeamPerformance displays team stats
□ ProjectHealth indicates real status
□ PresenceAvatars shows online users
□ LiveCursor tracks mouse positions
□ ActivityFeed updates in real-time
□ MemberList manages real members
□ InviteDialog sends invitations
□ OrganizationDashboard shows org data
□ RoleManager sets permissions
```

### T024: Fix ALL console errors [P]
```javascript
// ZERO errors allowed
// ZERO warnings allowed
// ZERO failed API calls
// ZERO WebSocket errors
```

### T025: Test real-time features work
**Multi-user testing**:
- Open 2 browser windows
- Move cursor in window 1 → See in window 2
- Type comment in window 1 → See in window 2
- Move card in window 1 → Updates in window 2
- ALL real-time features must work

### T026: Test all exports work [P]
- Export time report as PDF ✓
- Export time report as CSV ✓
- Export time report as Excel ✓
- Export board as JSON ✓
- Export analytics as PNG ✓

### T027: Mobile responsiveness test [P]
- iPhone SE (375px) ✓
- iPhone 12 (390px) ✓
- iPad (768px) ✓
- Desktop (1920px) ✓
- ALL features work on mobile

### T028: Performance validation
```javascript
// Targets:
// - Page load: < 2 seconds
// - API calls: < 200ms
// - Drag/drop: 60fps
// - Bundle size: < 500KB
// - Lighthouse: > 95 score
```

### T029: AI command validation
**Test every AI command**:
```
"Create a new card called login bug" → Card created ✓
"Move login bug to in progress" → Card moved ✓
"Assign it to John" → Card assigned ✓
"Start my timer" → Timer started ✓
"Show velocity chart" → Chart displayed ✓
"Archive completed cards" → Cards archived ✓
```

### T030: Final integration test
**Complete user journey**:
1. Login with real credentials
2. Create new board
3. Add 5 cards via AI
4. Drag cards between columns
5. Start timer on a card
6. Add comment with @mention
7. Upload attachment
8. View analytics dashboard
9. Export time report
10. See real-time cursor of other user

**ALL MUST WORK 100% - NOT 95%!**

---

## Parallel Execution Guide

### Day 1: Organization (4 tasks in parallel)
```bash
Task agent T001 &  # Create directories
Task agent T002 &  # Move docs
Task agent T003 &  # Archive files
wait
Task agent T004    # Fix imports
```

### Day 2-3: Integration (groups in parallel)
```bash
# Auth fixes
Task agent T005 & Task agent T006 &
wait

# Component integration (parallel by phase)
Task agent T009 &  # Phase 1
Task agent T010 &  # Phase 2
Task agent T011 &  # Phase 3
Task agent T012 &  # Phase 4
Task agent T013 &  # Phase 5
wait

# Data connections
Task agent T007 & Task agent T008
```

### Day 4: UI (all in parallel)
```bash
Task agent T014 &  # Remove refresh buttons
Task agent T015 &  # Simplify navigation
Task agent T016 &  # Auto-save
Task agent T017 &  # Color theme
Task agent T018    # Animations
```

### Day 5: AI (sequential)
```bash
Task agent T019    # Command processor
Task agent T020    # ChatPanel enhancement
Task agent T021    # NLP parser
Task agent T022    # Proactive suggestions
```

### Day 6: Testing (parallel groups)
```bash
# Component tests
Task agent T023 &

# Error fixes
Task agent T024 &

# Feature tests
Task agent T025 & Task agent T026 & Task agent T027 &

# Performance
Task agent T028 &

# AI validation
Task agent T029

# Final test (after all)
Task agent T030
```

---

## Success Metrics

✅ **ZERO mock data** - Everything uses real database  
✅ **ALL 120 components integrated** - Not 119, exactly 120  
✅ **ZERO refresh buttons** - Auto-refresh only  
✅ **AI controls EVERYTHING** - Natural language for all operations  
✅ **< 2 second load time** - Fast and snappy  
✅ **ZERO console errors** - Completely clean  
✅ **100% mobile responsive** - Every feature works on mobile  
✅ **ALL exports working** - PDF, CSV, Excel all functional  
✅ **Real-time actually real-time** - < 100ms latency  

## Dependencies

- **Critical Path**: Organization → Auth Fix → Integration → UI → AI → Testing
- **Blockers**: Must fix auth (T005-T006) before any data connections
- **Parallel Safe**: Different components can be worked on simultaneously
- **Sequential Required**: AI commands need working components first

## Notes

- **[P]** = Can run in parallel (different files, no conflicts)
- **[CRITICAL]** = Blocks other tasks if not completed
- **Day 1-6** = Aggressive timeline with parallel execution
- **100% means 100%** = No partial implementations accepted
- **Test everything** = Manual testing required for all features