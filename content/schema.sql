-- NFL Eval Article Pipeline Database
-- Location: content/pipeline.db
-- Initialize: sqlite3 content/pipeline.db < content/schema.sql
-- Visualize: pip install datasette && datasette content/pipeline.db --open

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
    status          TEXT NOT NULL DEFAULT 'proposed',
    current_stage   INTEGER NOT NULL DEFAULT 1,
    discussion_path TEXT,                       -- relative path to discussion summary, e.g. content/articles/{slug}/discussion-summary.md
    article_path    TEXT,                       -- relative path to final draft, e.g. content/articles/{slug}/draft.md
    substack_url    TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
    published_at    TEXT,
    depth_level     INTEGER NOT NULL DEFAULT 2,  -- 1=Casual Fan, 2=The Beat, 3=Deep Dive
    target_publish_date TEXT,                    -- specific target date e.g. '2026-03-17'
    publish_window  TEXT,                        -- calendar window: 'fa-wave-1','pre-draft','draft-week','may','camp-preview','preseason','regular-season','evergreen','backlog'
    time_sensitive  INTEGER NOT NULL DEFAULT 0,  -- 1 = has a hard expiry (draft week content, deadline coverage, etc.)
    expires_at      TEXT                         -- date after which the idea is stale / no longer publishable
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
    agent           TEXT,                       -- agent name or "Joe"
    notes           TEXT,
    transitioned_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─────────────────────────────────────────────
-- ARTICLE PANELS
-- Which agents were on a given article's panel.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS article_panels (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id      TEXT NOT NULL REFERENCES articles(id),
    agent_name      TEXT NOT NULL,
    role            TEXT,                       -- e.g. "Cap Analyst", "Team Specialist"
    question        TEXT,                       -- their specific angle for this article
    analysis_complete INTEGER NOT NULL DEFAULT 0,
    completed_at    TEXT
);

-- ─────────────────────────────────────────────
-- DISCUSSION PROMPTS
-- Stage 2 brief: the tension + central question.
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
-- Stage 6 verdict + issue counts.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS editor_reviews (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id      TEXT NOT NULL REFERENCES articles(id),
    verdict         TEXT NOT NULL,              -- APPROVED | REVISE | REJECT
    error_count     INTEGER NOT NULL DEFAULT 0, -- red items
    suggestion_count INTEGER NOT NULL DEFAULT 0,-- yellow items
    note_count      INTEGER NOT NULL DEFAULT 0, -- green items
    review_number   INTEGER NOT NULL DEFAULT 1,
    reviewed_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─────────────────────────────────────────────
-- PUBLISHER PASS
-- Stage 7 checklist as structured data.
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
-- CONVENIENCE VIEW: Pipeline Board
-- One row per article, all key status fields.
-- ─────────────────────────────────────────────
CREATE VIEW IF NOT EXISTS pipeline_board AS
SELECT
    a.id,
    a.title,
    a.primary_team,
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
        WHEN 8 THEN 'Approval / Publish'
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
