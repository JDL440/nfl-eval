# V3 Article Provider Choice — Architecture Analysis

## Executive Summary

Article-level provider choice (LLM gateway override) can be shown and edited in the V3 article detail view with **minimal backend seams**. The infrastructure already exists in the schema and repository layer. Only the UI and HTMX-driven form payload handling require implementation.

---

## Current State (What Already Exists)

### 1. Database Schema
- **Field:** `articles.provider` (TEXT, nullable)
- **Location:** `src/db/schema.sql` line 13
- **Behavior:** Stores preferred LLM provider override (optional, defaults to null)

### 2. Repository Read/Write
- **Read seam:** `Repository.getArticle(id)` returns `article.provider` as part of Article type
- **Write seam:** `Repository.updateArticle(id, updates: { provider?: string | null })`
  - Already implemented and validated in lines 496–500 of `src/db/repository.ts`
  - Strips whitespace, handles null correctly, persists atomically
- **Creation seam:** `Repository.createArticle(params)` accepts optional `provider` parameter
  - Currently used in `/api/articles` POST (line 1138 of `src/dashboard/server.ts`)
  - Not exposed in `/api/ideas` POST (Stage 1 ideation)

### 3. API Routing
- **PATCH `/api/articles/:id`** (lines 1078–1127 in `src/dashboard/server.ts`)
  - Already whitelists `provider` in the validation block (implicit: not in the if-checks)
  - **Gap:** No explicit `provider` field handling in request body validation
- **POST `/htmx/articles/:id/edit-meta`** (HTMX form submission)
  - Already uses `renderArticleMetaEditForm()` to generate form
  - **Gap:** Form does not render provider field; POST handler doesn't parse it

### 4. Types
- **Article type** in `src/types.ts` line 35: includes `provider: string | null`
- No validation or constants for provider enum/list (by design: extensible)

---

## What UX Needs (Missing Seams)

### 1. Form Field Display & Editing
**File:** `src/dashboard/views/article.ts` — `renderArticleMetaEditForm()` function (lines 195–254)
- **Current fields:** title, subtitle, depth_level, teams
- **Missing:** provider field (dropdown/select or text input)
- **Requirement:** 
  - Show current `article.provider` value (if set)
  - Allow clearing provider (set to null for default behavior)
  - Optional: dropdown with available providers or free-text input

### 2. HTMX Form Submission
**File:** `src/dashboard/server.ts` — `/htmx/articles/:id/edit-meta` POST handler (lines 1040–1070)
- **Current parsing:** title, subtitle, depth_level, teams from form body
- **Missing:** provider field parsing from form body
- **Requirement:** Extract `provider` from form, normalize/validate, pass to `repo.updateArticle()`

### 3. Display Panel Update
**File:** `src/dashboard/views/article.ts` — `renderArticleMetaDisplay()` function (lines 157–185)
- **Current display:** title, teams, workflow status
- **Optional enhancement:** Show current provider choice as metadata badge/indicator (cosmetic)
- **Not required for MVP:** Provider is a control input, not a display-critical metric like teams

### 4. JSON API Support (Optional)
**File:** `src/dashboard/server.ts` — `/api/articles/:id` PATCH handler (lines 1078–1127)
- **Current gaps:** 
  - No explicit handling for `provider` in the request body validation
  - The field is not rejected, but not explicitly whitelisted either
- **Recommendation:** Add explicit provider field validation (mirror HTMX handler)

---

## Test Coverage Recommendations

### Unit/Integration Tests to Add

1. **Metadata Edit Form (Form Rendering)**
   - File: `tests/dashboard/metadata-edit.test.ts`
   - Test: Provider field renders with current value
   - Test: Provider field can be submitted as part of form

2. **HTMX Provider Update**
   - File: `tests/dashboard/metadata-edit.test.ts` or new test
   - Test: POST `/htmx/articles/:id/edit-meta` with provider field updates DB
   - Test: Provider is persisted and readable via `repo.getArticle()`
   - Test: Clearing provider (empty/null) works correctly
   - Test: Form re-renders with updated provider value

3. **JSON API Provider Update**
   - File: `tests/dashboard/server.test.ts`
   - Test: PATCH `/api/articles/:id` with `{ provider: "anthropic" }` updates DB
   - Test: PATCH with `{ provider: null }` clears override
   - Test: Invalid provider values are handled gracefully (or left as-is for extensibility)

4. **Behavior Preservation**
   - File: `tests/dashboard/metadata-edit.test.ts`
   - Test: Updating provider doesn't affect teams, depth_level, or title
   - Test: Stage stage/status unchanged by provider edits

5. **Wave 2 Integration** (if applicable)
   - File: `tests/dashboard/wave2.test.ts`
   - Test: Stage Runs panel includes `requested_provider` from `stage_runs` table
   - Note: `stage_runs.requested_provider` is separate from article-level provider override

---

## Concrete File Paths & Route Details

### Backend Routes (Change Scope)

#### 1. Form Rendering
**File:** `src/dashboard/views/article.ts` (lines 195–254)
- Function: `renderArticleMetaEditForm(article: Article): string`
- **Change:** Add provider field input to the form HTML
- **Options:**
  - Text input (free-form: allows extensibility)
  - Select dropdown with hardcoded provider list (opinionated)
  - Recommend: text input + optional datalist for common providers

#### 2. HTMX Form Handler
**File:** `src/dashboard/server.ts` (lines 1040–1070)
- Route: `POST /htmx/articles/:id/edit-meta`
- Function: async (c) => { ... }
- **Change:** 
  - Extract `provider` from form body (URLSearchParams)
  - Validate/normalize (trim whitespace, null-check)
  - Call `repo.updateArticle(id, { provider })`
  - Return updated metadata display partial

#### 3. JSON API Handler (Optional but Recommended)
**File:** `src/dashboard/server.ts` (lines 1078–1127)
- Route: `PATCH /api/articles/:id`
- Function: async (c) => { ... }
- **Change:**
  - Add explicit provider field handling in request validation
  - Mirror HTMX validation logic (trim, null, store)

### Database (No Changes Needed)
- `src/db/schema.sql`: `articles.provider` already exists
- `src/db/repository.ts`:
  - `createArticle()` already accepts provider param
  - `updateArticle()` already handles provider updates
  - No migrations required

### Types (No Changes Needed)
- `src/types.ts` line 35: `Article` type already includes `provider: string | null`

---

## Behavioral Specification

### Provider Field Semantics

1. **Nullable:** `provider` is optional; `null` means "use system default"
2. **Article-level override:** Stored on article, consulted at runtime by pipeline
3. **No hard validation:** Provider value is a string; no enum enforcement (allows future extensibility)
4. **Immutability at publish:** Once article reaches Stage 8 (published), provider cannot be changed (same as other metadata immutability rules)

### When Provider is Applied

- **Runtime decision:** The pipeline code (e.g., `src/agents/runner.ts` or `src/llm/gateway.ts`) consults article.provider
- **This analysis scope:** UX only needs to show/edit; pipeline consumption is outside scope
- **Assumption:** Pipeline already respects article.provider if it's set (verify with Lead/Backend before implementation)

---

## Summary: Minimal Seams for Code

| Layer | File | What Exists | What UX Needs | Effort |
|-------|------|-------------|---------------|--------|
| **Schema** | `schema.sql` | ✅ `provider` column | — | None |
| **Repo Write** | `repository.ts` | ✅ `updateArticle()` handles provider | — | None |
| **Repo Read** | `repository.ts` | ✅ `getArticle().provider` | — | None |
| **Form Render** | `views/article.ts` | ❌ No field | Add provider input | Small |
| **HTMX Form Parse** | `server.ts` POST handler | ❌ No handler | Parse + update | Small |
| **JSON API** | `server.ts` PATCH handler | ⚠️ Partial (not explicit) | Explicit validation | Tiny |
| **Types** | `types.ts` | ✅ `provider: string \| null` | — | None |

**Effort estimate for Code:** ~2 hours (form render, HTMX handler, validation, test coverage)

---

## Decision Points for Lead

1. **Provider input type:** Free-text input or dropdown with hardcoded list?
   - Free-text = more extensible, less guidance
   - Dropdown = clearer UX, requires hardcoded list

2. **Display in article header:** Should provider badge appear in `renderArticleMetaDisplay()`?
   - Current: teams badges shown; provider could be shown similarly
   - Recommendation: optional, low priority (edit form is the primary UI)

3. **Pipeline consumption:** Does the pipeline already consult `article.provider`?
   - If not, this is a schema-first feature (needs pipeline implementation separately)
   - If yes, Code can proceed with confidence

4. **Validation/Immutability:** Should provider be editable after Stage 1? Or after Stage 5?
   - Current pattern: metadata editable at any stage except Stage 8 (published)
   - Recommendation: follow current pattern (editable until published)

---

## Next Steps

1. **Code:** Implement form field, HTMX handler, JSON API validation
2. **Code:** Add focused test coverage in metadata-edit.test.ts
3. **Code:** Verify pipeline respects article.provider at runtime
4. **Lead:** Confirm provider input type and display preference
5. **Lead:** Final review of test coverage
