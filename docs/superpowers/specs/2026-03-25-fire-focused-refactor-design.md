# Loonie Finance: FIRE-Focused App Refactor

## Problem

Loonie Finance tries to be a general personal finance tool and a FIRE tool simultaneously, diluting both. The app has pages (Dashboard, Projections, Tax, Accounts) that don't directly answer the core question: **"Where am I in my FIRE journey?"**

## Solution

Strip the app down to a single-purpose FIRE journey tracker. One page, no sidebar, accounts in a drawer, AI onboarding as the front door.

## App Structure

### Pages

| Page | Action |
|------|--------|
| Dashboard | **Delete** |
| Accounts | **Delete** (absorbed into drawer) |
| AccountDetail | **Delete** (absorbed into drawer) |
| Projections | **Delete** (chart absorbed into FIRE dashboard) |
| Tax | **Delete** (engine stays, page goes) |
| AI Advisor | **Delete** |
| FIRE | **Becomes `/` home** |
| Onboarding | **Keep** (first-visit entry point) |
| Settings | **Keep** (accessible from top bar) |
| Import/Export | **Keep** (accessible from top bar) |

### User Flow

1. First visit → AI Onboarding (full screen, no top bar)
2. After setup → FIRE Dashboard at `/`
3. Returning users → straight to FIRE Dashboard at `/`

### Navigation: Top Bar (replaces sidebar)

No sidebar. Full-width layout. Top bar contains:

- **Left**: "Loonie Finance" app name/logo
- **Center**: Net worth display (prominent)
- **Right**: Accounts drawer button, Settings gear icon, Import/Export icon

### FIRE Dashboard Sections (top to bottom)

1. **Status Strip** — Net worth, monthly savings rate, savings rate %, years to FIRE. Single compact row of stats.

2. **Next Milestone Hero** — Closest FIRE milestone with progress bar, target, gap, estimated age. Already built as `NextMilestone.tsx`.

3. **All FIRE Milestones** — 5 color-coded cards (Coast, Lean, Barista, Regular, Fat). Already built as `ProgressGauge.tsx`. Includes couples toggle (My Progress / Partner / Household).

4. **Milestone Timeline** — Horizontal age-based visualization. Already built as `MilestoneTimeline.tsx`.

5. **Projection Chart** — Interactive net worth projection chart with Monte Carlo bands and account breakdown toggle. Absorbed from the old Projections page. Uses existing `projectNetWorthWithEvents()` and Monte Carlo engine.

6. **Withdrawal Strategy** — Tax-optimal withdrawal plan visualization + year-by-year table. Already built as `WithdrawalPlanView.tsx`.

7. **Government Benefits** — CPP/OAS recommendations, RRSP meltdown strategy. Already exists in current Fire.tsx.

8. **Life Events** — Expandable section showing all life events as cards with Add Event / Add with AI buttons. Already built the card design.

9. **FIRE Settings** — Collapsible panel with all input parameters (target age, expenses, savings, return rate, etc.). Already exists as collapsible in current Fire.tsx.

### Accounts Drawer

Slides in from the right edge. Contains:

- Accounts grouped by type: Registered (TFSA, RRSP, FHSA), Non-Registered, Debt
- Inline balance editing (click to edit)
- Return rate display/edit per account
- Contribution room for registered accounts
- Add/remove account buttons
- Total net worth at top

### Files to Delete

- `src/pages/Dashboard.tsx`
- `src/pages/Projections.tsx`
- `src/pages/Tax.tsx`
- `src/pages/Advisor.tsx`
- `src/pages/Accounts.tsx`
- `src/pages/AccountDetail.tsx`
- `src/components/layout/Sidebar.tsx`

### Files to Create

- `src/components/layout/TopBar.tsx` — new top bar navigation
- `src/components/layout/AccountsDrawer.tsx` — slide-out accounts panel
- `src/components/fire/StatusStrip.tsx` — compact stats row
- `src/components/fire/ProjectionChart.tsx` — projection chart absorbed from Projections page
- `src/components/fire/LifeEventsSection.tsx` — expandable life events management

### Files to Modify

- `src/App.tsx` — remove deleted routes, change `/` to FIRE dashboard, remove sidebar layout
- `src/pages/Fire.tsx` — add status strip, projection chart, life events section
- `src/components/layout/Layout.tsx` or equivalent — replace sidebar layout with top bar layout

### What Stays (Engine Layer)

All engine code stays untouched:
- `src/engine/tax/` — powers withdrawal calculations
- `src/engine/projection/` — powers the projection chart
- `src/engine/retirement/` — powers FIRE calculations
- `src/engine/accounts/` — powers contribution room
- `src/engine/constants/` — all constants

### Verification

1. `npm run build` — clean compilation
2. `npm test` — all 164 tests still pass (engine unchanged)
3. Manual: First visit shows AI onboarding
4. Manual: After setup, lands on FIRE dashboard at `/`
5. Manual: All dashboard sections render correctly
6. Manual: Accounts drawer opens/closes, inline editing works
7. Manual: No dead links or references to deleted pages
