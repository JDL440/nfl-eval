-- NFL Lab Article Pipeline Database (v2)
-- Location: pipeline.db (or in-memory for tests)
-- Initialize: new Repository(dbPath) auto-runs this on open.

-- ─────────────────────────────────────────────
-- ARTICLES
-- Central ledger. One row per article.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS articles (
    id              TEXT PRIMARY KEY,           -- url-safe slug, e.g. witherspoon-extension-2026
    title           TEXT NOT NULL,
    subtitle        TEXT,
    primary_team    TEXT,                       -- main team (e.g. "seahawks")
    teams           TEXT,                       -- JSON array, e.g. '["seahawks"]' or '["seahawks","chiefs"]'
    league          TEXT NOT NULL DEFAULT 'nfl',-- multi-sport ready
    status          TEXT NOT NULL DEFAULT 'proposed',
    current_stage   INTEGER NOT NULL DEFAULT 1,
    discussion_path TEXT,                       -- relative path to discussion summary
    article_path    TEXT,                       -- relative path to final draft
    substack_draft_url TEXT,                    -- draft editor URL
    substack_url    TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
    published_at    TEXT,
    depth_level     INTEGER NOT NULL DEFAULT 2,  -- 1=Casual Fan, 2=The Beat, 3=Deep Dive
    target_publish_date TEXT,
    publish_window  TEXT,
    time_sensitive  INTEGER NOT NULL DEFAULT 0,
    expires_at      TEXT
);

-- ─────────────────────────────────────────────
-- STAGE TRANSITIONS
-- Full audit log of every stage change.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stage_transitions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id      TEXT NOT NULL REFERENCES articles(id),
    from_stage      INTEGER,
    to_stage        INTEGER NOT NULL,
    agent           TEXT,
    notes           TEXT,
    transitioned_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─────────────────────────────────────────────
-- ARTICLE RUNS
-- End-to-end execution records for article pipelines.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS article_runs (
    id              TEXT PRIMARY KEY,
    article_id      TEXT NOT NULL REFERENCES articles(id),
    trigger         TEXT,
    initiated_by    TEXT,
    status          TEXT NOT NULL DEFAULT 'started',
    notes           TEXT,
    started_at      TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at    TEXT
);

CREATE INDEX IF NOT EXISTS idx_article_runs_article_id
    ON article_runs(article_id, started_at DESC);

-- ─────────────────────────────────────────────
-- STAGE RUNS
-- One execution record per article stage / surface.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stage_runs (
    id                  TEXT PRIMARY KEY,
    run_id              TEXT REFERENCES article_runs(id),
    article_id          TEXT NOT NULL REFERENCES articles(id),
    stage               INTEGER NOT NULL,
    surface             TEXT NOT NULL,
    actor               TEXT,
    requested_model     TEXT,
    requested_model_tier TEXT,
    precedence_rank     INTEGER,
    output_budget_tokens INTEGER,
    status              TEXT NOT NULL DEFAULT 'started',
    notes               TEXT,
    artifact_path       TEXT,
    started_at          TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at        TEXT
);

CREATE INDEX IF NOT EXISTS idx_stage_runs_article_stage
    ON stage_runs(article_id, stage, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_stage_runs_run_id
    ON stage_runs(run_id, started_at DESC);

-- ─────────────────────────────────────────────
-- USAGE EVENTS
-- Fine-grained provider / tool / model attribution.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS usage_events (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id              TEXT REFERENCES article_runs(id),
    stage_run_id        TEXT REFERENCES stage_runs(id),
    article_id          TEXT NOT NULL REFERENCES articles(id),
    stage               INTEGER,
    surface             TEXT NOT NULL,
    provider            TEXT,
    actor               TEXT,
    event_type          TEXT NOT NULL DEFAULT 'completed',
    model_or_tool       TEXT,
    model_tier          TEXT,
    precedence_rank     INTEGER,
    request_count       INTEGER,
    quantity            INTEGER,
    unit                TEXT,
    prompt_tokens       INTEGER,
    output_tokens       INTEGER,
    cached_tokens       INTEGER,
    premium_requests    REAL,
    image_count         INTEGER,
    cost_usd_estimate   REAL,
    metadata_json       TEXT,
    created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_usage_events_article_stage
    ON usage_events(article_id, stage, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_usage_events_stage_run
    ON usage_events(stage_run_id, created_at DESC);

-- ─────────────────────────────────────────────
-- ARTICLE PANELS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS article_panels (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id      TEXT NOT NULL REFERENCES articles(id),
    agent_name      TEXT NOT NULL,
    role            TEXT,
    question        TEXT,
    analysis_complete INTEGER NOT NULL DEFAULT 0,
    completed_at    TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_article_panels_unique
  ON article_panels (article_id, agent_name);

-- ─────────────────────────────────────────────
-- DISCUSSION PROMPTS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS discussion_prompts (
    article_id          TEXT PRIMARY KEY REFERENCES articles(id),
    central_question    TEXT NOT NULL,
    tension             TEXT NOT NULL,
    why_worth_reading   TEXT,
    scope_teams         TEXT,
    target_length       TEXT DEFAULT '2000-4000 words',
    publish_window      TEXT,
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─────────────────────────────────────────────
-- EDITOR REVIEWS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS editor_reviews (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id      TEXT NOT NULL REFERENCES articles(id),
    verdict         TEXT NOT NULL,
    error_count     INTEGER NOT NULL DEFAULT 0,
    suggestion_count INTEGER NOT NULL DEFAULT 0,
    note_count      INTEGER NOT NULL DEFAULT 0,
    review_number   INTEGER NOT NULL DEFAULT 1,
    reviewed_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─────────────────────────────────────────────
-- PUBLISHER PASS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS publisher_pass (
    article_id          TEXT PRIMARY KEY REFERENCES articles(id),
    title_final         INTEGER NOT NULL DEFAULT 0,
    subtitle_final      INTEGER NOT NULL DEFAULT 0,
    body_clean          INTEGER NOT NULL DEFAULT 0,
    section_assigned    INTEGER NOT NULL DEFAULT 0,
    tags_set            INTEGER NOT NULL DEFAULT 0,
    url_slug_set        INTEGER NOT NULL DEFAULT 0,
    cover_image_set     INTEGER NOT NULL DEFAULT 0,
    paywall_set         INTEGER NOT NULL DEFAULT 0,
    publish_datetime    TEXT,
    email_send          INTEGER NOT NULL DEFAULT 1,
    names_verified      INTEGER NOT NULL DEFAULT 0,
    numbers_current     INTEGER NOT NULL DEFAULT 0,
    no_stale_refs       INTEGER NOT NULL DEFAULT 0
);

-- ─────────────────────────────────────────────
-- NOTES
-- Substack Notes linked to articles (post-publish) or standalone.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notes (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id      TEXT REFERENCES articles(id),
    note_type       TEXT NOT NULL DEFAULT 'promotion',
    content         TEXT NOT NULL,
    image_path      TEXT,
    substack_note_url TEXT,
    target          TEXT NOT NULL DEFAULT 'prod',
    created_by      TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─────────────────────────────────────────────
-- ARTIFACTS
-- Article file content stored in DB (source of truth).
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS artifacts (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id      TEXT NOT NULL REFERENCES articles(id),
    name            TEXT NOT NULL,              -- e.g. 'idea.md', 'draft.md'
    content         TEXT NOT NULL DEFAULT '',
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(article_id, name)
);

CREATE INDEX IF NOT EXISTS idx_artifacts_article
    ON artifacts(article_id, name);

-- ─────────────────────────────────────────────
-- CONVENIENCE VIEW: Pipeline Board
-- ─────────────────────────────────────────────
CREATE VIEW IF NOT EXISTS pipeline_board AS
SELECT
    a.id,
    a.title,
    a.primary_team,
    a.league,
    a.status,
    a.current_stage,
    CASE a.current_stage
        WHEN 1 THEN 'Idea Generation'
        WHEN 2 THEN 'Discussion Prompt'
        WHEN 3 THEN 'Panel Composition'
        WHEN 4 THEN 'Panel Discussion'
        WHEN 5 THEN 'Article Drafting'
        WHEN 6 THEN 'Editor Pass'
        WHEN 7 THEN 'Publisher Pass'
        WHEN 8 THEN 'Published'
        ELSE 'Unknown'
    END AS stage_name,
    a.discussion_path,
    a.article_path,
    a.depth_level,
    CASE a.depth_level
        WHEN 1 THEN 'Casual Fan'
        WHEN 2 THEN 'The Beat'
        WHEN 3 THEN 'Deep Dive'
        ELSE 'Unknown'
    END AS depth_name,
    a.target_publish_date,
    a.publish_window,
    a.time_sensitive,
    a.expires_at,
    a.published_at,
    a.updated_at
FROM articles a
ORDER BY
    CASE a.status
        WHEN 'in_production' THEN 1
        WHEN 'proposed'      THEN 2
        WHEN 'approved'      THEN 3
        WHEN 'published'     THEN 4
        WHEN 'archived'      THEN 5
        ELSE 6
    END,
    a.time_sensitive DESC,
    a.target_publish_date ASC NULLS LAST;
