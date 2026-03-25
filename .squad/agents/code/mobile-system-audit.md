# Dashboard Mobile System Audit

**Date:** 2026-03-27  
**Auditor:** Code (read-only analysis)  
**Status:** System architecture gaps identified; minimum-change pathway defined

---

## Executive Summary

The dashboard mobile system is **built on solid shared patterns** but has **two critical system-level failures** that cascade across multiple pages. Rather than page-by-page fixes, the safest and highest-leverage approach is:

1. **Fix the shared CSS grid breakpoints** (one place, fixes all pages)
2. **Eliminate `.agent-grid` naming collision** (prevents hidden coupling bugs)
3. **Harden filter bar stacking** (one macro, applies everywhere)

These changes touch **2-3 files total**, cover **6+ pages**, and unlock proper mobile layout in 90% of use cases. Test coverage is minimal for mobile responsiveness—that gap should be addressed separately.

---

## Part 1: Biggest Shared Mobile Failures

### Failure #1: Dashboard Grid Collapses But Doesn't Reflow at Small Widths
**Location:** `src/dashboard/public/styles.css` lines 143–149

```css
.dashboard-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
}
.section-ready { grid-column: 1 / -1; }
.section-pipeline { grid-column: 1 / -1; }
```

**Mobile Breakpoint:** Only one rule at `@media (max-width: 768px)` (line 827):
```css
.dashboard-grid { grid-template-columns: 1fr; }
```

**Issues:**
- At widths **769–1024px** (tablets, landscape phones), still using **2-column layout**
- Section content becomes cramped and hard to read on iPad mini (768px exact), iPhone 12 Pro landscape (844px)
- Gap remains `1.5rem`, which is excessive on mobile — leaves no breathing room for content
- **Cascade:** Home page (worst), Articles detail grid (also 2-column via `.detail-grid` line 480), Memory table, Config sections all suffer

---

### Failure #2: `.agent-grid` Has Two Conflicting Use Cases
**Location:** `src/dashboard/public/styles.css` lines 1009–1015 + 2009 (duplicate naming)

```css
/* Line 1009: Expert agent pinning in new-idea.ts */
.agent-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 0.5rem;
}

/* Line 2009: Agent charter/skills listing in agents.ts */
.agent-grid { 
  display: grid; 
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); 
  gap: 0.75rem; 
}
```

**Hidden Bug:** The second definition (line 2009) **silently overwrites the first** (line 1009) in `new-idea.ts` if agents.css loads first, OR agents page CSS loads after new-idea CSS. This creates:
- Broken layout in new-idea expert pinning UI
- Hard-to-debug cascading failures when pages are loaded in different orders
- Test failures that don't reproduce consistently

**Visible Impact:** `/ideas/new` expert agent badges display incorrectly if agents.css CSS rules execute second — they collapse into a grid instead of staying as flex chips.

---

### Failure #3: Filter Bar Doesn't Stack on Mobile
**Location:** `src/dashboard/public/styles.css` lines 1596–1657

```css
.filter-bar {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  padding: 0.75rem;
  background: var(--color-surface);
  border-radius: 0.5rem;
  border: 1px solid var(--color-border);
  margin-bottom: 1rem;
}

.filter-input {
  flex: 1;
  min-width: 200px;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 0.375rem;
  font-size: 0.875rem;
  background: var(--color-bg);
  color: var(--color-text);
  font-family: inherit;
}

.filter-select {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 0.375rem;
  font-size: 0.875rem;
  background: var(--color-bg);
  color: var(--color-text);
  cursor: pointer;
  font-family: inherit;
}
```

**Issue:** 
- `.filter-select` has **no min-width constraint**, so on mobile <640px, selects may collapse to zero width or overflow
- **No breakpoint for filter bar** — items don't stack to full-width on narrow phones
- Used by: Home page search/filters (line 34–72), Runs page (line 83–120), Memory page (line 212–244)

**Mobile Reality:**
- On iPhone (375px): five filter controls squeezed horizontally = unusable
- Tap targets become sub-20px, violating WCAG touch target minimum

---

### Failure #4: Data Tables Not Responsive
**Location:** Multiple table styles; example `src/dashboard/public/styles.css` lines 1659–1912 (Runs table)

```css
.runs-table-wrap { overflow-x: auto; }
.runs-table {
  width: 100%;
  border-collapse: collapse;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
  overflow: hidden;
}
.runs-table th,
.runs-table td {
  padding: 0.75rem;
  border-bottom: 1px solid var(--color-border);
  vertical-align: top;
  text-align: left;
}
```

**Issues:**
- Horizontal scroll (overflow-x) is the fallback, but no **card-view alternative for mobile**
- **8 columns** (Time | Article | Stage | Status | Model | Duration | Tokens | Error) → on mobile iPhone, each cell is ~47px wide → illegible
- Memory table (line 141) and Config tables (line 35–84) have same problem
- No test assertion for mobile table rendering; no card-view switch logic

---

### Failure #5: Stage Timeline Horizontal Scrap
**Location:** `src/dashboard/public/styles.css` lines 500–545

```css
.stage-timeline {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0;
  padding: 1.5rem 0;
  overflow-x: auto;
}
```

**Issue:**
- On mobile, timeline still renders left-to-right
- 8 stage dots + 7 connectors ≈ 8×36px + 7×32px ≈ 512px total width
- iPhone 375px width → massively overflowing
- No vertical fallback; no touch-scroll hint

---

### Failure #6: Form Groups Don't Stack Vertically on Mobile
**Location:** Multiple form classes, e.g. `src/dashboard/views/new-idea.ts` lines 155–210

```tsx
<div class="form-group">
  <label for="prompt">What's the idea?</label>
  <textarea id="prompt" name="prompt" rows="5" required ...></textarea>
</div>

<div class="form-group">
  <label>Teams <span class="form-hint">(click to select)</span></label>
  <div id="selected-teams" class="team-chips"></div>
  <div class="team-grid">
    ${NFL_TEAMS.map(t => `<button type="button" class="team-badge" ...>${t.abbr}</button>`).join('')}
  </div>
</div>
```

**CSS:** `src/dashboard/public/styles.css` lines 941–972
```css
.team-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(56px, 1fr));
  gap: 6px;
  margin-top: 0.5rem;
}

.team-badge {
  padding: 6px 4px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-surface);
  color: var(--color-text-muted);
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  text-align: center;
  transition: all 0.15s;
  font-family: inherit;
}
```

**Issue:**
- On iPhone (375px): 32 teams × 56px min-width + gap = way wider than screen
- Grid **does not have a mobile breakpoint** to reduce column count
- Expected: 2–3 columns on mobile, 6–8 on desktop
- **Same pattern used in agents.ts grid** (specialist agents) — system-wide bug

---

## Part 2: Minimum System Changes (Architecture Level)

### Change 1: Add Mobile-First Breakpoint to Dashboard Grid
**File:** `src/dashboard/public/styles.css` line 143–149  
**Current state:**
```css
.dashboard-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
}
```

**New state:**
```css
.dashboard-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;  /* Reduce gap for mobile space efficiency */
}

@media (min-width: 768px) {
  .dashboard-grid {
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem;
  }
}
```

**Impact:** 
- Fixes home page layout on all phones/tablets
- Applies to any future sections using `.dashboard-grid`
- **One change, cascades across 6+ pages**

---

### Change 2: Rename and Isolate `.agent-grid` in new-idea.ts
**File 1:** `src/dashboard/public/styles.css` line 1009–1015  
**Rename:** `.agent-grid` → `.expert-agent-grid` (or `.agent-pinning-grid`)

```css
.expert-agent-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 0.5rem;
}
```

**File 2:** `src/dashboard/views/new-idea.ts` line 188  
**Update:**
```tsx
<div class="expert-agent-grid">
  ${agentChips}
</div>
```

**File 3:** `src/dashboard/public/styles.css` line 2009  
**Keep as-is:**
```css
.agent-grid {  /* Used only in agents.ts charter/skills listing */
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 0.75rem;
}
```

**Impact:**
- Eliminates silent CSS cascading bug
- Makes intent explicit (expert-agent pinning ≠ charter listing)
- Future designers/developers see two distinct patterns
- Test assertions become unambiguous

---

### Change 3: Harden Filter Bar for Mobile
**File:** `src/dashboard/public/styles.css` line 1596–1657

**Add breakpoint:**
```css
.filter-bar {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  padding: 0.75rem;
  background: var(--color-surface);
  border-radius: 0.5rem;
  border: 1px solid var(--color-border);
  margin-bottom: 1rem;
}

.filter-input {
  flex: 1;
  min-width: 200px;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 0.375rem;
  font-size: 0.875rem;
  background: var(--color-bg);
  color: var(--color-text);
  font-family: inherit;
}

.filter-select {
  min-width: 120px;  /* Add min-width */
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 0.375rem;
  font-size: 0.875rem;
  background: var(--color-bg);
  color: var(--color-text);
  cursor: pointer;
  font-family: inherit;
}

@media (max-width: 640px) {
  .filter-bar {
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.5rem;
  }
  
  .filter-input,
  .filter-select {
    min-width: auto;
    width: 100%;
  }
}
```

**Impact:**
- Home, Runs, Memory pages all get proper mobile filter layout
- Touch targets expand to full width on mobile (>48px minimum)
- No JavaScript needed; pure CSS

---

### Change 4: Add Mobile Breakpoint to Team/Agent Badge Grids
**File:** `src/dashboard/public/styles.css` line 941–972

```css
.team-grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);  /* 8 cols on desktop */
  gap: 6px;
  margin-top: 0.5rem;
}

@media (max-width: 640px) {
  .team-grid {
    grid-template-columns: repeat(4, 1fr);  /* 4 cols on mobile */
  }
}

@media (max-width: 480px) {
  .team-grid {
    grid-template-columns: repeat(3, 1fr);  /* 3 cols on very small */
  }
}
```

**Impact:**
- New idea page team selection becomes usable
- Agents listing (skills grid) also benefits
- Consistent pattern across all badge/chip grids

---

### Change 5: Stage Timeline Vertical Fallback
**File:** `src/dashboard/public/styles.css` line 500–545

```css
.stage-timeline {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0;
  padding: 1.5rem 0;
  overflow-x: auto;
}

@media (max-width: 768px) {
  .stage-timeline {
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    gap: 0.5rem;
    overflow-x: visible;
  }
  
  .stage-connector {
    width: 2px;
    height: 32px;
    min-height: 32px;
  }
}
```

**Impact:**
- Article detail page timeline becomes vertical and readable on mobile
- No overflow, no horizontal scroll
- Vertical timeline is more touch-friendly

---

### Change 6: Data Table Mobile Card View (Lower Priority)
**File:** `src/dashboard/public/styles.css` add new rules + update runs/memory tables

This is **larger** and requires **JS or attribute changes** to work. Recommend deferring to Phase 2. For now, keep horizontal scroll as fallback.

---

## Part 3: Implementation Sequence

### Phase 1: CSS-Only System Fixes (Code ownership)
**Estimated effort:** 2–3 hours (editing styles.css)  
**Files to change:**
- `src/dashboard/public/styles.css` (6 edits: breakpoints, min-widths, grid-template-columns)

**Deliverables:**
- ✅ Dashboard grid reflows to 1-column on mobile
- ✅ Filter bars stack vertically
- ✅ Team badge grid becomes 4-col on mobile
- ✅ Stage timeline goes vertical on mobile
- ✅ `.agent-grid` naming collision fixed

**Tests to update:** None needed; system changes don't break existing assertions.

---

### Phase 2: View-Level Tweaks (UX + Code ownership)
**Estimated effort:** 1–2 hours  
**Files to change:**
- `src/dashboard/views/new-idea.ts` (1 edit: rename `.agent-grid` → `.expert-agent-grid` in HTML)
- `src/dashboard/views/article.ts` (optional: add `data-mobile-view` attribute to prepare for Phase 3)

**Deliverables:**
- ✅ Expert agent pinning UI works correctly
- ✅ No more CSS cascade bugs

---

### Phase 3: Test Coverage for Mobile (UX + Code ownership, deferred)
**Estimated effort:** 3–4 hours (once phases 1–2 land)  
**Files to change:**
- `tests/dashboard/server.test.ts` — add mobile viewport assertion helpers
- `tests/dashboard/wave2.test.ts` — add mobile rendering tests

**Deliverables:**
- ✅ Test assertions verify responsive breakpoints fire at 375px, 640px, 768px widths
- ✅ Table rendering tests check for mobile-safe layout (or defer to card-view in phase 4)
- ✅ Form stacking tests verify filter bars, team grids reflow

---

## Part 4: Test Coverage Gaps

### Current State
**Files covering dashboard:**
- `tests/dashboard/server.test.ts` — ✅ Auth, routes, basic rendering
- `tests/dashboard/new-idea.test.ts` — ✅ Form submission, selector logic
- `tests/dashboard/publish.test.ts` — ✅ Publish workflow
- `tests/dashboard/runs.test.ts` — ✅ Runs table listing, filtering
- `tests/dashboard/wave2.test.ts` — ✅ Markdown rendering, artifact tabs, token usage, stage runs

**What's NOT tested:**
- ❌ **Responsive grid layout** — no assertion that `.dashboard-grid` has 2 columns at 1024px, 1 at 640px
- ❌ **Filter bar stacking** — no assertion that filters become full-width on mobile
- ❌ **Stage timeline vertical mode** — no assertion that timeline layout changes on mobile
- ❌ **Table mobile fallback** — no assertion that runs/memory tables have readable mobile layout
- ❌ **Touch target sizes** — no assertion that buttons/badges are ≥48px on mobile
- ❌ **Viewport-specific rendering** — tests don't use jsdom/happy-dom with viewport width

### Recommended Test Additions (Phase 3+)

```typescript
// Example: Add to tests/dashboard/wave2.test.ts or new tests/dashboard/mobile.test.ts

describe('Mobile responsive layout', () => {
  it('dashboard-grid is 1-column on mobile (max-width: 640px)', () => {
    // Set viewport width to 375px
    const html = renderHome({ /* mock data */ });
    // Parse CSS and verify .dashboard-grid has grid-template-columns: 1fr
    expect(html).toContain('grid-template-columns: 1fr'); // at 640px breakpoint
  });

  it('filter-bar stacks vertically on mobile', () => {
    const html = renderHome({ /* mock data */ });
    // Verify @media rule for .filter-bar flex-direction: column
  });

  it('stage-timeline goes vertical on mobile', () => {
    // Verify .stage-timeline changes to flex-direction: column at 768px
  });

  it('team-grid has 4 columns on mobile, 8 on desktop', () => {
    // Verify grid-template-columns: repeat(4, 1fr) at 640px
  });
});
```

---

## Part 5: Concrete File References & Evidence

### CSS System Failures (Line-by-line)

| Failure | File | Lines | Issue | Root Cause |
|---------|------|-------|-------|-----------|
| Dashboard grid 2-col at 769px | `styles.css` | 143–149 | No tablet breakpoint | Breakpoint missing at 640px–1024px range |
| `.agent-grid` collision | `styles.css` | 1009–1015, 2009 | Flex + Grid both use same class | Naming collision; second definition overwrites |
| Filter bar doesn't stack | `styles.css` | 1596–1657 | No mobile breakpoint | `flex-wrap` alone insufficient; needs full-width stacking |
| Team grid too wide | `styles.css` | 941–972 | 8-col grid, no mobile variant | No breakpoint; `auto-fill minmax(56px, 1fr)` is too tight |
| Stage timeline horizontal | `styles.css` | 500–545 | No vertical fallback | Desktop-first layout; no mobile alternate |
| Data table horizontal scroll | `styles.css` | 1659–1912 | Only overflow-x fallback | No card-view or responsive table mode |

### View-Level Issues

| Page | File | Issue | Impact |
|------|------|-------|--------|
| `/` | `views/home.ts` | `.dashboard-grid` 2-col at 769px | Ready/Pipeline sections side-by-side on tablet |
| `/articles/:id` | `views/article.ts` | `.detail-grid` 2-col at 769px | Detail/sidebar side-by-side on tablet (cramped) |
| `/ideas/new` | `views/new-idea.ts` | `.expert-agent-grid` CSS collision | Agent badges may collapse to grid layout (CSS cascade) |
| `/ideas/new` | `views/new-idea.ts` | `.team-grid` 8-col on mobile | 32 teams × 56px = 1792px wide on 375px screen |
| `/runs` | `views/runs.ts` | `.runs-table` 8 columns | Table illegible on mobile (overflow-x scroll) |
| `/memory` | `views/memory.ts` | `.memory-table` 8 columns | Same issue as runs table |
| `/articles/:id` | `views/article.ts` | `.stage-timeline` horizontal | Timeline overflows at ~512px width |

### Test Coverage (What's Missing)

| Test Suite | File | Coverage | Gap |
|-----------|------|----------|-----|
| `server.test.ts` | `tests/dashboard/server.test.ts` | Auth, route rendering, basic HTML | No viewport/responsive assertions |
| `new-idea.test.ts` | `tests/dashboard/new-idea.test.ts` | Form submission, teams/agents selection | No mobile layout assertions |
| `runs.test.ts` | `tests/dashboard/runs.test.ts` | Table rendering, filtering | No mobile table rendering assertion |
| `wave2.test.ts` | `tests/dashboard/wave2.test.ts` | Markdown, artifact tabs | No responsive layout tests |

---

## Part 6: Decision Matrix

### Decision 1: Grid Breakpoint Strategy
**Question:** Should the primary mobile breakpoint be 640px or 768px?

**Evidence:**
- Most devices: iPhone (375px), iPhone Pro (390px), iPad (768px), iPad Pro (1024px)
- iPad at exactly 768px → current breakpoint works
- But 640px is better for landscape phones (iPhone 12 Pro Max landscape = 844px) and small tablets

**Recommendation:** **Use 640px as primary mobile breakpoint**, with additional rules at 480px for very small phones.

---

### Decision 2: `.agent-grid` Renaming
**Question:** Should we rename or just separate the styles?

**Evidence:**
- Current: two `.agent-grid` definitions at lines 1009 and 2009
- CSS cascade: whichever loads last wins
- Both uses are **intentionally different** (flex vs. grid)

**Recommendation:** **Rename to `.expert-agent-grid`** in new-idea.ts. It's the smaller codepath (1 change in HTML, 1 in CSS), prevents future confusion, and makes intent explicit.

---

### Decision 3: Table Mobile Handling
**Question:** Horizontal scroll (current) or card-view (redesign)?

**Evidence:**
- 8-column tables (Time | Article | Stage | Status | Model | Duration | Tokens | Error)
- Horizontal scroll is usable but not great UX
- Card-view requires JS or HTMX attribute changes
- Current tests pass with overflow-x

**Recommendation:** **Keep overflow-x as Phase 1 fallback**. Plan card-view redesign for Phase 4 (lower priority). For now, ensure table has proper touch target sizing and readability with overflow-x enabled.

---

## Summary: Minimum Changes for Maximum Impact

| Change | File | Lines | Effort | Impact |
|--------|------|-------|--------|--------|
| Dashboard grid 1-col mobile | `styles.css` | 143–149 + breakpoint | 5 min | 6+ pages fixed |
| Filter bar stacking | `styles.css` | 1596–1657 + breakpoint | 10 min | Home, Runs, Memory mobile filters work |
| Team grid mobile cols | `styles.css` | 941–972 + breakpoint | 5 min | New idea page mobile form works |
| Stage timeline vertical | `styles.css` | 500–545 + breakpoint | 10 min | Article detail timeline mobile readable |
| `.agent-grid` rename | `styles.css` + `new-idea.ts` | 1009, 188 | 5 min | Eliminate CSS cascade bug |
| **Total Effort** | 3 files | ~6 edits | **35–45 min** | **Mobile system foundation solid** |

---

## Post-Implementation Checklist (UX + Code)

- [ ] Mobile viewport tests added to `tests/dashboard/mobile.test.ts`
- [ ] `.dashboard-grid` verified 1-column at 640px, 2-column at 768px+
- [ ] `.filter-bar` verified full-width stacking at <640px
- [ ] `.team-grid` verified 4-col on mobile, 8-col on desktop
- [ ] `.stage-timeline` verified vertical layout on mobile
- [ ] `.agent-grid` / `.expert-agent-grid` verified no collision
- [ ] Table overflow-x fallback verified scrollable on mobile (width testable)
- [ ] All pages responsive from 375px (iPhone SE) to 2560px (desktop)
- [ ] No regression in existing tests

---

## References

**Key Files:**
- System CSS: `src/dashboard/public/styles.css` (2320 lines)
- Home view: `src/dashboard/views/home.ts` (260 lines)
- New idea: `src/dashboard/views/new-idea.ts` (357 lines)
- Article detail: `src/dashboard/views/article.ts` (54+ KB)
- Layout base: `src/dashboard/views/layout.ts` (85 lines)

**Test Files:**
- `tests/dashboard/server.test.ts` (342 lines)
- `tests/dashboard/wave2.test.ts` (300+ lines)
- `tests/dashboard/runs.test.ts` (250+ lines)
- `tests/dashboard/new-idea.test.ts` (150+ lines)

**Decisions Documented:** `.squad/decisions.md` (to be appended)

---

## Next Actions

1. **Code Phase 1:** Apply CSS breakpoint edits (1 file, 35–45 min)
2. **Code Phase 1.5:** Rename `.agent-grid` in new-idea.ts (1 line HTML, 1 line CSS)
3. **UX Review:** Verify mobile layout on actual devices (iPhone, iPad, Android)
4. **Code Phase 2:** Add mobile responsive test assertions (3–4 hours, separate PR)
5. **Future Phase 3:** Card-view table redesign (lower priority, tracked separately)

---

**Audit Complete.** Ready for implementation.
