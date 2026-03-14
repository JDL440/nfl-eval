# NFL Article Approval Dashboard

A React-based real-time approval workflow dashboard for the NFL content intelligence platform. Editors can review, approve, reject, and unpublish articles before they're published to Substack.

## Features

### Core Functionality
- **Queue Status Display**: Real-time list of articles in all states (pending, drafted, ready for review, approved, published)
- **Article Preview**: Full article with headline, summary, body, and significance score
- **Approval Controls**: Approve, reject, or unpublish articles with confirmation modals
- **Token Cost Tracking**: Display token usage breakdown by model (Haiku vs Opus) with daily budget alerts at 70%
- **Audit Log**: Complete history of all actions (drafted, approved, rejected, published, unpublished) with timestamps and actor names
- **Responsive Design**: Works on desktop (2-column), tablet, and mobile (1-column) screens

### Safety Features
- ✅ **Manual Approval Only**: All articles require explicit human approval before publishing
- ⚠️ **Unpublish Warning**: Strong warning modal when unpublishing published articles
- 💭 **Rejection Feedback**: Reason for rejection is captured and stored in audit log
- 🔒 **No Auto-Actions**: All buttons require explicit user interaction

## Project Structure

```
dashboard/
├── src/
│   ├── components/           # React components
│   │   ├── QueueStatus.jsx       # Job queue list with status badges
│   │   ├── ArticlePreview.jsx    # Article headline, summary, body display
│   │   ├── ApprovalControls.jsx  # Approve, reject, unpublish buttons
│   │   ├── TokenCostDisplay.jsx  # Cost tracking and budget display
│   │   └── AuditLog.jsx          # Timeline of all article actions
│   ├── pages/
│   │   └── Dashboard.jsx     # Main dashboard page layout
│   ├── api/
│   │   ├── queueClient.js    # Abstraction for Backend queue API
│   │   └── mockQueue.js      # Mock data for development
│   ├── styles/
│   │   └── responsive.css    # Responsive design, typography, components
│   ├── __tests__/
│   │   ├── setup.js          # Jest test setup
│   │   └── QueueStatus.test.jsx
│   ├── App.jsx               # Root component
│   └── main.jsx              # Entry point
├── index.html                # HTML template
├── vite.config.js            # Vite configuration
├── jest.config.js            # Jest testing configuration
├── .babelrc                  # Babel configuration
└── package.json              # Dependencies and scripts
```

## Setup & Development

### Installation
```bash
cd dashboard
npm install
```

### Run Locally
```bash
npm run dev
```
Opens at `http://localhost:3000` with hot reload.

### Build for Production
```bash
npm run build
```
Outputs optimized files to `dist/`.

### Run Tests
```bash
npm test
```
Runs Jest test suite. Full integration tests will be added once Backend M1 is complete.

## Architecture

### State Management
- Uses React hooks (`useState`, `useEffect`) for simplicity during M2
- Fetches queue jobs every 2 seconds via polling (configurable)
- Mock API for development; swaps to real Backend API when M1 is complete

### Queue Client Abstraction (api/queueClient.js)
The `queueClient` provides a clean interface to the Backend queue API:
- `getJobs(filters)` — Fetch all jobs, optionally filtered by status
- `getJob(id)` — Fetch a single job
- `approveJob(id)` — Approve and publish article
- `rejectJob(id, reason)` — Reject article with feedback
- `unpublishJob(id)` — Revert published article to drafted state

**Toggle between mock and real API** via `REACT_APP_USE_MOCK_API` environment variable.

### Responsive Design
- **Desktop (>1024px)**: 2-column grid for queue + preview side-by-side
- **Tablet (768-1024px)**: 1-column stacked layout
- **Mobile (<768px)**: Full-width cards with optimized touch targets
- All typography scales responsively

### Component Responsibilities

| Component | Purpose |
|-----------|---------|
| **QueueStatus** | Displays job list with status badges, significance, cost, created time |
| **ArticlePreview** | Shows selected article with full body, token details, model used |
| **ApprovalControls** | Approve/reject/unpublish buttons with confirmation modals |
| **TokenCostDisplay** | Total cost, breakdown by model, daily budget tracking, % used |
| **AuditLog** | Timeline of all actions with actor, timestamp, reason (if any) |
| **Dashboard** | Main layout: stats cards, queue, preview, controls, audit log |

## Token Cost Tracking

### Pricing Model
- **Haiku**: Used for article drafts (~$0.0016/article)
- **Opus**: Used for article reviews (~$0.045/article)
- **Daily Budget**: $1.30 (GitHub Copilot Pro+)
- **Alert Threshold**: 70% of daily budget

### Display
The **TokenCostDisplay** component shows:
1. Total daily cost ($X.XXXX)
2. % of budget used (with warning color at 70%)
3. Breakdown by model (Haiku vs Opus) with progress bars
4. Daily remaining budget

## Integration with Backend M1

When Backend M1 is complete:
1. Environment variable: `REACT_APP_USE_MOCK_API=false`
2. Set `REACT_APP_API_URL` to Backend server URL (default: `http://localhost:3001/api`)
3. `queueClient` will automatically switch from mock to real API calls
4. Real-time updates continue via 2-second polling

## Design Patterns

### Modal Dialogs
- **Reject**: Free-text feedback field, confirm before rejecting
- **Unpublish**: Strong visual warning with confirmation

### Status Badges
- Colored badges match semantic meaning (red=pending, green=approved, etc.)
- Status text is capitalized with underscores removed

### Audit Trail
- Every action creates an audit log entry with timestamp, actor, reason
- Timeline displays chronologically, most recent first
- Emoji indicators for quick visual scanning

## Performance Targets

- ✅ Dashboard loads in <2 seconds (desktop), <3 seconds (mobile)
- ✅ Queue updates within 2 seconds via polling
- ✅ Approve action publishes article within 10 seconds (Backend dependent)
- ✅ No manual page refresh needed for live updates

## Future Enhancements (M3/M4)

- [ ] Git diff view for article edits before approval
- [ ] Real-time WebSocket updates (replace polling)
- [ ] Bulk approve/reject for multiple articles
- [ ] Advanced filtering by significance, model, date range
- [ ] Search across article titles and bodies
- [ ] Export audit logs to CSV
- [ ] Dark mode toggle
- [ ] User authentication and role-based access control

## Troubleshooting

### Port 3000 already in use
```bash
npm run dev -- --port 3001
```

### Module not found errors
```bash
rm -rf node_modules package-lock.json
npm install
```

### Tests not finding modules
Jest mocking for React components requires proper Babel setup. Full integration tests will work once Backend M1 provides real API endpoints.

## Notes for Integration

When M1 Backend is ready:
1. Backend will provide REST API at `/api/jobs`
2. Frontend will use real queue client instead of mock
3. Articles will flow: PROPOSED → DRAFTING → REVIEWING → APPROVED → PUBLISHED
4. All token costs will be real, tracked per article
5. Manual approval gate remains non-negotiable

---

**Status**: M2 Dashboard Scaffold Complete (March 14-15, 2026)  
**Next**: M1 Backend integration when queue is live
