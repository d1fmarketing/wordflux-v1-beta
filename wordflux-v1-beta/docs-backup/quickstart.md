# Quickstart: Enterprise Dashboard Development

**Feature**: 003-enterprise-dashboard-development  
**Environment**: Local development  
**Prerequisites**: Node.js 18+, PostgreSQL, Redis (optional)

## Setup Instructions

### 1. Database Setup
```bash
# Ensure PostgreSQL is running
sudo systemctl start postgresql

# Create database if not exists
createdb wordflux

# Run existing migrations
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate
```

### 2. Environment Configuration
```bash
# Verify .env.local has required vars
cat .env.local | grep -E "DATABASE_URL|JWT_SECRET|OPENAI_API_KEY"

# Add new environment variables
echo "REDIS_URL=redis://localhost:6379" >> .env.local
echo "ENABLE_REALTIME=true" >> .env.local
echo "ENABLE_TIME_TRACKING=true" >> .env.local
```

### 3. Install Dependencies
```bash
# Core dependencies (if not installed)
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
npm install socket.io socket.io-client
npm install chart.js react-chartjs-2
npm install date-fns
npm install lucide-react
```

### 4. Start Development Server
```bash
# Terminal 1: Start Next.js
npm run dev

# Terminal 2: Start Redis (if using real-time)
redis-server

# Access at http://localhost:3000/dashboard
```

## Test Data Seeding

### Create Test Organization and Users
```javascript
// Run in Prisma Studio or as script
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seed() {
  // Create test organization
  const org = await prisma.organization.create({
    data: {
      name: 'Test Marketing Studio',
      slug: 'test-studio',
      owner: {
        create: {
          email: 'admin@test.com',
          passwordHash: '$2a$10$...', // bcrypt hash of 'password123'
          firstName: 'Admin',
          lastName: 'User',
          emailVerified: true
        }
      }
    }
  });

  // Create test board with columns
  const board = await prisma.board.create({
    data: {
      organizationId: org.id,
      name: 'Q1 Marketing Campaign',
      description: 'Planning and execution for Q1 campaigns',
      createdBy: org.ownerId,
      position: 0,
      columns: {
        create: [
          { name: 'Backlog', position: 0 },
          { name: 'To Do', position: 1, wipLimit: 5 },
          { name: 'In Progress', position: 2, wipLimit: 3 },
          { name: 'Review', position: 3, wipLimit: 2 },
          { name: 'Done', position: 4 }
        ]
      }
    }
  });

  // Create sample cards
  const columns = await prisma.column.findMany({ 
    where: { boardId: board.id },
    orderBy: { position: 'asc' }
  });

  const cards = [
    { title: 'Design social media templates', columnId: columns[0].id, priority: 'HIGH' },
    { title: 'Write blog post about product launch', columnId: columns[0].id, priority: 'MEDIUM' },
    { title: 'Create email campaign', columnId: columns[1].id, priority: 'HIGH' },
    { title: 'Review competitor analysis', columnId: columns[2].id, priority: 'LOW' },
    { title: 'Finalize Q1 budget', columnId: columns[3].id, priority: 'URGENT' }
  ];

  for (let i = 0; i < cards.length; i++) {
    await prisma.card.create({
      data: {
        ...cards[i],
        boardId: board.id,
        position: i,
        createdBy: org.ownerId,
        description: 'Sample task description',
        estimatedHours: Math.floor(Math.random() * 8) + 1
      }
    });
  }

  console.log('Test data seeded successfully');
}

seed().catch(console.error).finally(() => prisma.$disconnect());
```

## Feature Validation Checklist

### Phase 1: Board Display (Critical Path)
- [ ] Dashboard loads at `/dashboard`
- [ ] Board section displays (not 404/error)
- [ ] Columns are visible (Backlog, To Do, In Progress, etc.)
- [ ] Cards appear in correct columns
- [ ] Card details show (title, description, priority)

### Phase 2: Drag and Drop
- [ ] Cards can be picked up (drag initiated)
- [ ] Drag preview follows cursor
- [ ] Drop zones highlight on hover
- [ ] Card moves to new column on drop
- [ ] Position updates correctly within column
- [ ] Changes persist on page refresh

### Phase 3: Card Operations
- [ ] Click card opens detail view
- [ ] Can edit card title and description
- [ ] Can set/change priority (color changes)
- [ ] Can set due date (calendar picker works)
- [ ] Can assign users to card
- [ ] Can add labels/tags
- [ ] Changes save and reflect immediately

### Phase 4: Time Tracking
- [ ] Timer button appears on cards
- [ ] Click starts timer (shows elapsed time)
- [ ] Timer continues across page refreshes
- [ ] Stop timer saves time entry
- [ ] Can view time entries list
- [ ] Can manually add time entry
- [ ] Total time shows on card

### Phase 5: Real-time Collaboration
- [ ] Open dashboard in two browser tabs
- [ ] Move card in tab 1
- [ ] Card moves in tab 2 within 1 second
- [ ] Edit card in tab 1
- [ ] Changes appear in tab 2 immediately
- [ ] User presence indicators show
- [ ] No conflicts or data loss

### Phase 6: Analytics Dashboard
- [ ] Analytics view accessible from sidebar
- [ ] Shows total tasks metric
- [ ] Shows completed tasks metric
- [ ] Shows in-progress tasks metric
- [ ] Time tracking summary displays
- [ ] Charts render correctly
- [ ] Data exports to CSV

### Phase 7: Organization Features
- [ ] User menu shows current user
- [ ] Organization settings accessible
- [ ] Can invite team members
- [ ] Member list shows all users
- [ ] Role assignments work (Admin, Member, Viewer)
- [ ] Permissions enforced correctly

## Performance Benchmarks

Run these tests after implementation:

### Load Time Metrics
```javascript
// Measure initial dashboard load
performance.mark('dashboard-start');
// After dashboard renders
performance.mark('dashboard-end');
performance.measure('dashboard-load', 'dashboard-start', 'dashboard-end');

// Target: <3 seconds
```

### Board Operation Metrics
```javascript
// Measure card move operation
const startMove = performance.now();
// After card drop and save
const endMove = performance.now();
console.log(`Card move: ${endMove - startMove}ms`);

// Target: <200ms
```

### Real-time Sync Metrics
```javascript
// Measure sync latency
const syncStart = Date.now();
socket.emit('card:move', data);
socket.on('card:moved', () => {
  console.log(`Sync latency: ${Date.now() - syncStart}ms`);
});

// Target: <500ms
```

## Test Scenarios

### Scenario 1: Project Manager Daily Workflow
1. Login as project manager
2. View dashboard with 3 active boards
3. Check overdue tasks (should highlight in red)
4. Drag task from "To Do" to "In Progress"
5. Start timer on task
6. Add comment mentioning team member
7. Stop timer after 30 minutes
8. Move task to "Review"
9. Check time tracking report
10. Export weekly report as PDF

### Scenario 2: Team Collaboration
1. Login as User A in Browser 1
2. Login as User B in Browser 2
3. User A creates new card "Design Review"
4. User B should see card appear immediately
5. User A assigns User B to card
6. User B receives notification
7. User B moves card to "In Progress"
8. User A sees movement in real-time
9. Both users add comments
10. Comments appear for both without refresh

### Scenario 3: Sprint Planning
1. Create new board "Sprint 23"
2. Add columns: Backlog, Selected, In Progress, Done
3. Set WIP limit 5 on "In Progress"
4. Add 20 cards to Backlog
5. Drag cards to Selected for sprint
6. Assign team members to cards
7. Set due dates for all cards
8. Add time estimates
9. Try to exceed WIP limit (should warn)
10. Generate sprint capacity report

### Scenario 4: Time Tracking Accuracy
1. Start timer on Task A at 9:00 AM
2. Work for 15 minutes
3. Switch to Task B (timer auto-stops A)
4. Work on B for 30 minutes
5. Return to Task A (new timer entry)
6. Work for 45 minutes
7. View time entries for Task A (should show 2 entries: 15min + 45min)
8. Edit first entry to 20 minutes
9. Total should update to 65 minutes
10. Generate time report (should match)

### Scenario 5: Bulk Operations
1. Select multiple cards (checkbox mode)
2. Move 5 cards to different column
3. Assign same user to 3 cards
4. Add same label to 10 cards
5. Set same due date to selected cards
6. Archive completed cards (bulk)
7. Operations complete in <2 seconds
8. All changes persist
9. Activity log shows bulk operations
10. Can undo bulk operation

## Troubleshooting

### Common Issues

**Board not displaying:**
```bash
# Check API endpoint
curl http://localhost:3000/api/board/state

# Check database connection
npx prisma db push

# Verify board exists
npx prisma studio
# Check Board and Column tables
```

**Drag and drop not working:**
```bash
# Verify dependencies installed
npm list @dnd-kit/core

# Check browser console for errors
# Look for DndContext provider issues
```

**Real-time not syncing:**
```bash
# Check Redis connection
redis-cli ping

# Verify Socket.io connection
# Browser DevTools > Network > WS tab
```

**Time tracking not persisting:**
```bash
# Check TimeEntry table
npx prisma studio

# Verify API endpoints
curl -X POST http://localhost:3000/api/time/start \
  -H "Content-Type: application/json" \
  -d '{"cardId": "test-card-id"}'
```

## Success Criteria

The enterprise dashboard is considered successfully implemented when:

1. ✅ All 7 feature phases pass validation
2. ✅ Performance benchmarks met (<3s load, <200ms operations)
3. ✅ All 5 test scenarios complete without errors
4. ✅ No console errors in browser
5. ✅ Mobile responsive (works on tablet/phone)
6. ✅ Supports 10+ concurrent users
7. ✅ Data persists correctly
8. ✅ Exports work in all formats
9. ✅ Real-time sync works reliably
10. ✅ User feedback is positive

## Next Steps

After validation:
1. Run full test suite: `npm test`
2. Check test coverage: `npm run test:coverage`
3. Run lighthouse audit for performance
4. Deploy to staging environment
5. Conduct user acceptance testing
6. Document any issues found
7. Create production deployment plan

---
*Last updated: 2025-09-10*