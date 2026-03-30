# SQLite for Article Lifecycle Tracking — Research & Design Proposal

## Executive Summary

Yes — SQLite is the right call, and the timing is ideal. The article-lifecycle skill just formalized 8 explicit stages with defined gates and owners. That structure should exist as a schema, not just a markdown document. SQLite gives you: queryable state across all articles, a foundation for any visualization layer, a reliable audit trail of stage transitions, and a natural integration point for future automation. The git-based markdown approach that works for agent memory is wrong for article tracking — articles are operational objects that change state, not knowledge that accumulates. The right tool for stateful objects is a database.

## Current State Assessment

How articles are tracked today:

| Location | What tracked | Format | Problem |
|----------|-------------|--------|---------|
| content/article-ideas.md | Ideas, status, agents needed | Markdown table | Hand-edited, not queryable |
| content/articles/{slug}.md | The article itself | Markdown | No metadata attached |
| .squad/orchestration-log/ | Agent activity | Per-file markdown | No article-level view |

The gap: There is no single place that answers "what stage is article X in, who worked on it, when did it enter each stage, what are the blockers." That is what SQLite solves.

## Architecture Recommendation

SQLite is the right database because:
- Zero infrastructure — a single .db file in the repo
- Git-friendly — commit it, diff it, restore it
- Embeddable — agents write via shell commands
- Queryable — any visualization tool can read it
- Not overkill — Postgres is wrong at this scale

File location: content/pipeline.db
Add to .gitattributes: content/pipeline.db binary

## Schema Design

```sql
CREATE TABLE articles (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    subtitle    TEXT,
    team        TEXT,
    status      TEXT NOT NULL DEFAULT 'proposed',
    current_stage INTEGER DEFAULT 1,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL,
    published_at TEXT,
    substack_url TEXT,
    article_path TEXT
);

CREATE TABLE stage_transitions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id  TEXT NOT NULL REFERENCES articles(id),
    from_stage  INTEGER,
    to_stage    INTEGER NOT NULL,
    agent       TEXT,
    notes       TEXT,
    transitioned_at TEXT NOT NULL
);

CREATE TABLE article_panels (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id  TEXT NOT NULL REFERENCES articles(id),
    agent_name  TEXT NOT NULL,
    role        TEXT,
    question    TEXT,
    analysis_complete INTEGER DEFAULT 0,
    completed_at TEXT
);

CREATE TABLE discussion_prompts (
    article_id      TEXT PRIMARY KEY REFERENCES articles(id),
    central_question TEXT NOT NULL,
    tension         TEXT NOT NULL,
    why_worth_reading TEXT,
    scope_teams     TEXT,
    target_length   TEXT DEFAULT '2000-4000 words',
    publish_window  TEXT,
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
);

CREATE TABLE editor_reviews (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id  TEXT NOT NULL REFERENCES articles(id),
    verdict     TEXT NOT NULL,
    error_count INTEGER DEFAULT 0,
    suggestion_count INTEGER DEFAULT 0,
    note_count  INTEGER DEFAULT 0,
    reviewed_at TEXT NOT NULL,
    review_number INTEGER DEFAULT 1
);

CREATE TABLE publisher_pass (
    article_id  TEXT PRIMARY KEY REFERENCES articles(id),
    title_final INTEGER DEFAULT 0,
    subtitle_final INTEGER DEFAULT 0,
    body_clean INTEGER DEFAULT 0,
    section_assigned INTEGER DEFAULT 0,
    tags_set INTEGER DEFAULT 0,
    url_slug_set INTEGER DEFAULT 0,
    cover_image_set INTEGER DEFAULT 0,
    paywall_set INTEGER DEFAULT 0,
    publish_datetime TEXT,
    email_send INTEGER DEFAULT 1,
    names_verified INTEGER DEFAULT 0,
    numbers_current INTEGER DEFAULT 0,
    no_stale_refs INTEGER DEFAULT 0
);
```

## Visualization Options

1. Datasette (fastest): pip install datasette && datasette content/pipeline.db --open
   Instant web interface, zero config, browse all tables and views

2. Observable Notebook: export CSV from pipeline_board view, import for D3 charts

3. Static HTML dashboard: small API endpoint reads the DB, kanban view stages 1-8

4. GitHub Actions: generate SVG charts on commit, no hosting required

## Integration with Agents

Agents write via sqlite3 CLI (already available via powershell tool):

```bash
sqlite3 content/pipeline.db "
    UPDATE articles SET current_stage = 4, updated_at = datetime('now')
    WHERE id = 'seahawks-rb-situation-2026';
    INSERT INTO stage_transitions (article_id, from_stage, to_stage, agent, transitioned_at)
    VALUES ('seahawks-rb-situation-2026', 3, 4, 'Lead', datetime('now'));
"
```

## Relationship to article-ideas.md

Keep BOTH. They complement each other:

| File | Purpose | Owner |
|------|---------|-------|
| content/article-ideas.md | Editorial planning, calendar | Joe (human) |
| content/pipeline.db | Operational state, audit trail | Agents + automation |

Scribe syncs statuses between them at publish time.

## Migration Plan

Phase 1 (now): Create schema, add one test article
Phase 2 (next): Wire up Lead/Editor/Scribe to write to DB at each stage
Phase 3 (future Publisher agent): Publisher reads publisher_pass table, automates Stage 7

## Confidence Assessment

High confidence: SQLite is the right tier, schema covers all 8 stages, Datasette is fastest path to visualization, sqlite3 CLI works with existing agent tooling.

Medium confidence: GENERATED ALWAYS AS syntax requires SQLite 3.31+, verify version.
