---
name: Dashboard Mobile Patterns
domain: dashboard-ux
confidence: high
tools: [view, rg, styles.css, vitest]
---

# Dashboard Mobile Patterns

## When to Use

- Adding a new dashboard page and need mobile-responsive layout (e.g., list, form, detail views)
- Introducing a new table, sidebar, action button group, or modal to the dashboard
- Updating responsive behavior across the editorial workstation
- Fixing mobile overflow, tap-target sizing, or sidebar collapse issues

## Pattern Overview

The dashboard mobile system consists of five reusable layers:

1. **Shared Shell** (responsive header, sticky nav)
2. **Breakpoint Cascade** (320px, 480px, 768px, 1024px+)
3. **Mobile-First Components** (cards, buttons, sidebars, forms)
4. **Table-to-Card Transform** (operational data surfaces)
5. **Testing** (viewport assertions, tap-target verification)

---

## 1. Shared Shell (Header & Navigation)

### Problem
- Fixed 56px header with six buttons in one row is unreadable on phones
- No responsive breakpoint for `.header-nav` or `.btn-header`
- Navigation cannot be collapsed or rearranged for mobile

### Solution
- **Desktop (≥768px):** Full horizontal nav with all six buttons + logo + env badge
- **Tablet (480px–767px):** Condensed nav; consider text-only buttons
- **Phone (<480px):** Hamburger menu or stack; show only essential actions (logo, menu toggle, theme)

### Implementation

**HTML (layout.ts):**
```html
<header class="site-header">
  <div class="header-inner">
    <a href="/" class="logo">NFL Lab</a>
    <button id="nav-toggle" class="nav-toggle" aria-label="Toggle menu">☰</button>
    <nav class="header-nav" id="main-nav">
      <!-- six buttons here -->
    </nav>
  </div>
</header>
```

**CSS (styles.css):**
```css
/* Desktop: flex layout for nav */
.header-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 56px;
}

.header-nav {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

/* Tablet: ≥480px and <768px */
@media (max-width: 767px) {
  .header-nav {
    gap: 0.25rem;
  }
  .btn-header {
    padding: 4px 8px;
    font-size: 0.75rem;
  }
}

/* Phone: <480px */
@media (max-width: 479px) {
  .nav-toggle {
    display: block;
  }
  .header-nav {
    display: none;
    position: absolute;
    top: 56px;
    left: 0;
    right: 0;
    flex-direction: column;
    gap: 0;
    background: var(--color-primary);
    border-top: 1px solid var(--color-border);
    padding: 0.5rem 0;
    z-index: 99;
  }
  .header-nav.open {
    display: flex;
  }
  .btn-header {
    padding: 0.75rem 1rem;
    font-size: 0.9rem;
    width: 100%;
    text-align: left;
    border-radius: 0;
  }
}
```

**JS (in layout.ts or separate script tag):**
```javascript
document.getElementById('nav-toggle')?.addEventListener('click', () => {
  const nav = document.getElementById('main-nav');
  nav?.classList.toggle('open');
});
```

---

## 2. Breakpoint Cascade

### Problem
- Responsive rules are scattered across three separate media blocks in styles.css
- No consistent breakpoint strategy (768px, 640px, no 320px or 480px)
- Adding new components requires manual breakpoint review

### Solution
- **One consolidated media-query section** in styles.css with clearly labeled breakpoints
- **Consistent breakpoint values:** 320px (emergency), 480px (small phone), 768px (tablet), 1024px (desktop)
- **Pattern:** Define desktop styles first, then override with media queries (mobile-last) or define mobile first and layer desktop with `@media (min-width:...)`

### Implementation

**CSS (styles.css):**
```css
/* ── MOBILE BREAKPOINTS ──────────────────────────────────── */

/* Default: mobile-first (320px and up) */
.dashboard-grid { grid-template-columns: 1fr; }
.detail-grid { grid-template-columns: 1fr; }
.btn { min-height: 44px; min-width: 44px; padding: 12px 16px; }

/* Tablet: 480px and up */
@media (min-width: 480px) {
  .dashboard-grid { grid-template-columns: 1fr 1fr; }
  .btn { padding: 8px 12px; }
}

/* Desktop: 768px and up */
@media (min-width: 768px) {
  .dashboard-grid { grid-template-columns: 1fr 1fr; }
  .detail-grid { grid-template-columns: 2fr 1fr; }
  .btn { padding: 6px 14px; }
  .sidebar-mobile-collapsed { display: block; }
}

/* Large desktop: 1024px and up */
@media (min-width: 1024px) {
  .content { max-width: 1280px; }
}
```

---

## 3. Mobile-First Components

### `.btn-mobile` and Tap Targets
**Problem:** Buttons are 6px 14px padding (too small for phones)  
**Solution:** 44px minimum height/width on phones, scale down on desktop

```css
.btn {
  min-height: 44px;
  min-width: 44px;
  padding: 12px 16px;        /* mobile-first */
  font-size: 1rem;           /* mobile-first */
}

@media (min-width: 768px) {
  .btn {
    padding: 6px 14px;
    font-size: 0.8rem;
  }
}
```

### `.card` Layout for Responsive Data
**Problem:** Tables overflow horizontally on phones  
**Solution:** Transform table rows to cards on mobile using CSS Grid

```css
/* Phone: stack as cards */
.card-table {
  display: block;
}

.card-table tbody {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}

.card-table tr {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.5rem;
  padding: 1rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-surface);
}

.card-table td::before {
  content: attr(data-label);
  font-weight: 600;
  color: var(--color-text-muted);
}

/* Tablet+: revert to table */
@media (min-width: 768px) {
  .card-table {
    display: table;
    width: 100%;
  }
  .card-table tr {
    display: table-row;
  }
  .card-table td::before {
    display: none;
  }
}
```

**HTML usage (in runs.ts or any table):**
```html
<table class="card-table runs-table">
  <tbody>
    <tr>
      <td data-label="Time">2026-03-26 10:30</td>
      <td data-label="Article">Article Title</td>
      <td data-label="Status">✅ Success</td>
    </tr>
  </tbody>
</table>
```

### `.sidebar-mobile` Disclosure Pattern
**Problem:** Sidebars stack below main content and take full height on phones  
**Solution:** Collapse sidebar into disclosure/accordion on mobile

```css
/* Desktop: side-by-side */
.sidebar-mobile {
  display: block;
}

/* Phone: collapsible */
@media (max-width: 767px) {
  .sidebar-mobile {
    margin-top: 1.5rem;
    border-top: 1px solid var(--color-border);
    padding-top: 1rem;
  }
  
  .sidebar-mobile-section {
    margin-bottom: 1rem;
    border-bottom: 1px solid var(--color-border);
    padding-bottom: 1rem;
  }
  
  .sidebar-mobile-section summary {
    cursor: pointer;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  
  .sidebar-mobile-section[open] summary::after {
    content: '▼';
  }
  
  .sidebar-mobile-section:not([open]) summary::after {
    content: '▶';
  }
}
```

**HTML usage (in article.ts):**
```html
<aside class="sidebar-mobile">
  <details class="sidebar-mobile-section" open>
    <summary>Stage Runs</summary>
    <!-- content -->
  </details>
  <details class="sidebar-mobile-section">
    <summary>Advanced</summary>
    <!-- content -->
  </details>
</aside>
```

### Single-column detail pages
**Problem:** Some dashboard detail pages reuse `.detail-grid.mobile-detail-layout` even when they do not render a sidebar, which leaves an empty desktop column and makes the main editorial content feel narrower than the shell.  
**Solution:** Add a page-specific opt-out class and restore a single desktop column for that route instead of weakening the shared sidebar layout for pages that still need it.

```css
.detail-grid.article-detail-single {
  grid-template-columns: 1fr;
}
```

```html
<div class="detail-grid mobile-detail-layout article-detail-single">
  <div class="detail-main mobile-primary-column">...</div>
</div>
```

### `.action-group-mobile` Button Grouping
**Problem:** Multiple action buttons in a row overflow on phones  
**Solution:** Stack vertically on mobile, keep horizontal on desktop

```css
.action-group {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

@media (max-width: 479px) {
  .action-group {
    flex-direction: column;
  }
  .action-group .btn {
    width: 100%;
    justify-content: center;
  }
}
```

---

## 4. Table-to-Card Transform

### When to Use
- Rendering operational data tables (`<table>`) on dashboard pages
- Any table with >4 columns should become a card grid on phones

### Pattern

**CSS:**
```css
/* Generic table-to-card pattern */
.responsive-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}

@media (max-width: 767px) {
  .responsive-table {
    display: block;
    border: none;
  }
  
  .responsive-table thead {
    display: none;
  }
  
  .responsive-table tbody {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 1rem;
  }
  
  .responsive-table tr {
    display: grid;
    grid-template-columns: 1fr;
    padding: 1rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background: var(--color-surface);
    box-shadow: var(--shadow);
  }
  
  .responsive-table td {
    display: grid;
    grid-template-columns: 120px 1fr;
    gap: 0.5rem;
    padding: 0.5rem 0;
    border: none;
    border-bottom: none;
  }
  
  .responsive-table td::before {
    content: attr(data-label);
    font-weight: 600;
    color: var(--color-text-muted);
  }
}
```

**Example (runs.ts or memory.ts):**
```html
<table class="responsive-table runs-table">
  <thead>
    <tr><th>Time</th><th>Article</th><th>Stage</th>...</tr>
  </thead>
  <tbody>
    <tr>
      <td data-label="Time">2026-03-26 10:30</td>
      <td data-label="Article">Seahawks Cap</td>
      <td data-label="Stage">Stage 4</td>
      ...
    </tr>
  </tbody>
</table>
```

### Clamped card minimums inside padded detail shells

When a detail page already adds page/card padding, `minmax(280px, 1fr)` can still overflow a 320px phone because the grid track minimum ignores the reduced inner width. For gallery/card grids inside padded dashboard sections, clamp the minimum to the available width:

```css
.image-gallery {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr));
  gap: 0.75rem;
}
```

Use this when the issue is a specific card/grid minimum, not the whole page shell. Prefer this targeted clamp over global `overflow: hidden` or page-level horizontal-scroll masking.

---

## 5. Testing

### Mobile Viewport Assertions

**Test pattern (vitest):**
```javascript
describe('dashboard mobile', () => {
  it('renders header with hamburger on mobile', () => {
    // Simulate 320px viewport
    window.innerWidth = 320;
    window.dispatchEvent(new Event('resize'));
    
    const navToggle = document.querySelector('.nav-toggle');
    const nav = document.querySelector('.header-nav');
    
    expect(navToggle).toBeVisible();
    expect(nav).not.toBeVisible();
  });
  
  it('has button tap targets >= 44px on phone', () => {
    const buttons = document.querySelectorAll('.btn');
    buttons.forEach(btn => {
      const rect = btn.getBoundingClientRect();
      expect(rect.height).toBeGreaterThanOrEqual(44);
      expect(rect.width).toBeGreaterThanOrEqual(44);
    });
  });
  
  it('transforms table to cards on <480px', () => {
    window.innerWidth = 320;
    window.dispatchEvent(new Event('resize'));
    
    const table = document.querySelector('.responsive-table');
    const tbody = table.querySelector('tbody');
    const styles = window.getComputedStyle(tbody);
    
    expect(styles.display).toBe('grid');
  });
  
  it('has no horizontal overflow on mobile', () => {
    window.innerWidth = 320;
    window.dispatchEvent(new Event('resize'));
    
    const maxWidth = Math.max(
      document.documentElement.scrollWidth,
      document.body.scrollWidth
    );
    
    expect(maxWidth).toBeLessThanOrEqual(window.innerWidth + 1);
  });
});
```

### Mobile Test Coverage Checklist
- [ ] Header responds to `@media (max-width: 479px)`
- [ ] Nav toggle works and toggles `.open` class
- [ ] All buttons ≥44px on phones
- [ ] Tables transform to cards on <768px
- [ ] Sidebars collapse to disclosures on <768px
- [ ] Action groups stack vertically on <480px
- [ ] No horizontal overflow at 320px, 480px, 768px
- [ ] HTMX partial swaps preserve mobile layout

---

## Real-World Example

**File:** `src/dashboard/views/article.ts` (after mobile refactor)
- Sidebar becomes collapsible details on mobile
- Stage timeline scrolls horizontally on mobile (OK, intentional)
- Action panel uses full width on mobile

**File:** `src/dashboard/public/styles.css` (consolidated)
- One media-query section with 320px, 480px, 768px, 1024px breakpoints
- Generic table-to-card pattern defined once
- Button sizing scales with viewport

**File:** `tests/dashboard/wave2.test.ts` (updated)
- Add mobile viewport assertions
- Verify buttons and tap targets
- Verify tables and sidebars on mobile

---

## See Also

- `.squad/agents/ux/ux-dashboard-mobile-audit.md` — Full audit of mobile system
- `.squad/decisions/inbox/ux-dashboard-mobile-audit.md` — Team decision record
- `src/dashboard/views/layout.ts` — Shared shell (to be updated)
- `src/dashboard/public/styles.css` — Main stylesheet (to be refactored)

