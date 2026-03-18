"""
pipeline_state.py — Shared pipeline DB helper for the NFL Lab article pipeline.

Single source of truth for all pipeline.db writes. Every orchestration surface
(Lead, Ralph, heartbeat, publisher extension) should funnel DB mutations through
this module instead of writing ad-hoc SQL.

Usage from repo root:
    from content.pipeline_state import PipelineState
    ps = PipelineState()           # auto-discovers content/pipeline.db
    ps.advance_stage('ari-2026-offseason', from_stage=5, to_stage=6, agent='Editor')
    ps.record_editor_review('ari-2026-offseason', 'REVISE', errors=2, suggestions=3)
"""

from __future__ import annotations

import argparse
import json
import os
import sqlite3
import uuid
from datetime import datetime, timezone

# ── Constants ────────────────────────────────────────────────────────────────

VALID_STAGES = range(1, 9)  # 1–8 inclusive
VALID_STATUSES = ("proposed", "approved", "in_production", "in_discussion", "published", "archived")
VALID_VERDICTS = ("APPROVED", "REVISE", "REJECT")
VALID_RUN_STATUSES = ("started", "completed", "failed", "cancelled")
VALID_USAGE_EVENT_TYPES = ("planned", "started", "completed", "updated", "failed", "skipped", "stage_transition")

STAGE_NAMES = {
    1: "Idea Generation",
    2: "Discussion Prompt",
    3: "Panel Composition",
    4: "Panel Discussion",
    5: "Article Drafting",
    6: "Editor Pass",
    7: "Publisher Pass",
    8: "Approval / Publish",
}

# Default DB path relative to this file
_DEFAULT_DB = os.path.join(os.path.dirname(os.path.abspath(__file__)), "pipeline.db")

_RUNTIME_SCHEMA_STATEMENTS = (
    "ALTER TABLE articles ADD COLUMN substack_draft_url TEXT",
    """
    CREATE TABLE IF NOT EXISTS article_runs (
        id TEXT PRIMARY KEY,
        article_id TEXT NOT NULL REFERENCES articles(id),
        trigger TEXT,
        initiated_by TEXT,
        status TEXT NOT NULL DEFAULT 'started',
        notes TEXT,
        started_at TEXT NOT NULL DEFAULT (datetime('now')),
        completed_at TEXT
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS stage_runs (
        id TEXT PRIMARY KEY,
        run_id TEXT REFERENCES article_runs(id),
        article_id TEXT NOT NULL REFERENCES articles(id),
        stage INTEGER NOT NULL,
        surface TEXT NOT NULL,
        actor TEXT,
        requested_model TEXT,
        requested_model_tier TEXT,
        precedence_rank INTEGER,
        output_budget_tokens INTEGER,
        status TEXT NOT NULL DEFAULT 'started',
        notes TEXT,
        artifact_path TEXT,
        started_at TEXT NOT NULL DEFAULT (datetime('now')),
        completed_at TEXT
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS usage_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id TEXT REFERENCES article_runs(id),
        stage_run_id TEXT REFERENCES stage_runs(id),
        article_id TEXT NOT NULL REFERENCES articles(id),
        stage INTEGER,
        surface TEXT NOT NULL,
        provider TEXT,
        actor TEXT,
        event_type TEXT NOT NULL DEFAULT 'completed',
        model_or_tool TEXT,
        model_tier TEXT,
        precedence_rank INTEGER,
        request_count INTEGER,
        quantity INTEGER,
        unit TEXT,
        prompt_tokens INTEGER,
        output_tokens INTEGER,
        cached_tokens INTEGER,
        premium_requests REAL,
        image_count INTEGER,
        cost_usd_estimate REAL,
        metadata_json TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_article_runs_article_id ON article_runs(article_id, started_at DESC)",
    "CREATE INDEX IF NOT EXISTS idx_stage_runs_article_stage ON stage_runs(article_id, stage, started_at DESC)",
    "CREATE INDEX IF NOT EXISTS idx_stage_runs_run_id ON stage_runs(run_id, started_at DESC)",
    "CREATE INDEX IF NOT EXISTS idx_usage_events_article_stage ON usage_events(article_id, stage, created_at DESC)",
    "CREATE INDEX IF NOT EXISTS idx_usage_events_stage_run ON usage_events(stage_run_id, created_at DESC)",
)


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _new_run_id() -> str:
    return str(uuid.uuid4())


def _validate_stage(stage, label="stage"):
    """Ensure stage is a numeric int in 1–8."""
    if not isinstance(stage, int) or stage not in VALID_STAGES:
        raise ValueError(f"{label} must be an integer 1–8, got {stage!r} (type={type(stage).__name__})")


def _validate_status(value, allowed, label):
    if value not in allowed:
        raise ValueError(f"Invalid {label} '{value}', expected one of {allowed}")


def _normalize_metadata_json(metadata):
    if metadata is None:
        return None
    if isinstance(metadata, str):
        return metadata
    return json.dumps(metadata, sort_keys=True)


class PipelineState:
    """Thread-unsafe, single-connection wrapper for pipeline.db writes."""

    VALID_NOTE_TYPES = ("promotion", "follow_up", "standalone")
    VALID_NOTE_TARGETS = ("prod", "stage")

    def __init__(self, db_path=None):
        self.db_path = db_path or _DEFAULT_DB
        if not os.path.exists(self.db_path):
            raise FileNotFoundError(f"pipeline.db not found at {self.db_path}")
        self._conn = sqlite3.connect(self.db_path)
        self._conn.row_factory = sqlite3.Row
        self._ensure_runtime_schema()

    def close(self):
        self._conn.close()

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.close()

    # ── Runtime schema compatibility ─────────────────────────────────────────

    def _column_exists(self, table_name, column_name):
        rows = self._conn.execute(f"PRAGMA table_info({table_name})").fetchall()
        return any(row["name"] == column_name for row in rows)

    def _ensure_runtime_schema(self):
        statements = []
        if not self._column_exists("articles", "substack_draft_url"):
            statements.append(_RUNTIME_SCHEMA_STATEMENTS[0])
        statements.extend(_RUNTIME_SCHEMA_STATEMENTS[1:])
        for statement in statements:
            self._conn.execute(statement)
        self._conn.commit()

    # ── Reads ────────────────────────────────────────────────────────────────

    def get_article(self, article_id):
        """Return article row as dict, or None."""
        row = self._conn.execute(
            "SELECT * FROM articles WHERE id = ?", (article_id,)
        ).fetchone()
        return dict(row) if row else None

    def get_all_articles(self):
        """Return all article rows as list of dicts."""
        rows = self._conn.execute("SELECT * FROM articles ORDER BY current_stage DESC, updated_at DESC").fetchall()
        return [dict(r) for r in rows]

    def get_editor_reviews(self, article_id):
        """Return editor review rows for an article, newest first."""
        rows = self._conn.execute(
            "SELECT * FROM editor_reviews WHERE article_id = ? ORDER BY review_number DESC",
            (article_id,),
        ).fetchall()
        return [dict(r) for r in rows]

    def get_usage_events(self, article_id, limit=100):
        """Return usage events for an article, newest first."""
        rows = self._conn.execute(
            "SELECT * FROM usage_events WHERE article_id = ? ORDER BY created_at DESC LIMIT ?",
            (article_id, limit),
        ).fetchall()
        return [dict(r) for r in rows]

    def get_stage_runs(self, article_id, limit=100):
        rows = self._conn.execute(
            "SELECT * FROM stage_runs WHERE article_id = ? ORDER BY started_at DESC LIMIT ?",
            (article_id, limit),
        ).fetchall()
        return [dict(r) for r in rows]

    # ── Draft URL management ─────────────────────────────────────────────────

    def get_draft_url(self, article_id):
        """Return the stored Substack draft URL for an article, or None."""
        row = self._conn.execute(
            "SELECT substack_draft_url FROM articles WHERE id = ?", (article_id,)
        ).fetchone()
        return row["substack_draft_url"] if row else None

    def set_draft_url(self, article_id, draft_url):
        """
        Persist the Substack draft URL for an article.

        Raises if the article is already published (Stage 8 / status 'published')
        to prevent accidental overwrites of live articles.
        """
        self.assert_not_published(article_id)
        self._conn.execute(
            "UPDATE articles SET substack_draft_url = ?, updated_at = ? WHERE id = ?",
            (draft_url, _now_iso(), article_id),
        )
        self._conn.commit()

    def assert_not_published(self, article_id):
        """
        Hard guard: raise ValueError if the article is published (Stage 8 or status='published').

        Call this before any draft-update or re-publish operation to prevent
        accidentally overwriting a live Substack post.
        """
        article = self.get_article(article_id)
        if article is None:
            raise ValueError(f"Article '{article_id}' not found in pipeline.db")
        if article["current_stage"] == 8 or article.get("status") == "published":
            raise ValueError(
                f"Article '{article_id}' is already published "
                f"(stage={article['current_stage']}, status={article.get('status')}). "
                f"Cannot update a published article through the draft-update path. "
                f"This is a safety guard to prevent overwriting live content."
            )

    # ── Usage ledger helpers ─────────────────────────────────────────────────

    def start_article_run(self, article_id, trigger, initiated_by, notes=None, run_id=None, status="started"):
        article = self.get_article(article_id)
        if article is None:
            raise ValueError(f"Article '{article_id}' not found in pipeline.db")
        _validate_status(status, VALID_RUN_STATUSES, "article run status")

        run_id = run_id or _new_run_id()
        self._conn.execute(
            """INSERT INTO article_runs (id, article_id, trigger, initiated_by, status, notes, started_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (run_id, article_id, trigger, initiated_by, status, notes, _now_iso()),
        )
        self._conn.commit()
        return run_id

    def finish_article_run(self, run_id, status="completed", notes=None):
        _validate_status(status, VALID_RUN_STATUSES, "article run status")
        self._conn.execute(
            "UPDATE article_runs SET status = ?, notes = ?, completed_at = ? WHERE id = ?",
            (status, notes, _now_iso(), run_id),
        )
        self._conn.commit()

    def start_stage_run(
        self,
        article_id,
        stage,
        surface,
        actor,
        run_id=None,
        requested_model=None,
        requested_model_tier=None,
        precedence_rank=None,
        output_budget_tokens=None,
        notes=None,
        stage_run_id=None,
        status="started",
    ):
        article = self.get_article(article_id)
        if article is None:
            raise ValueError(f"Article '{article_id}' not found in pipeline.db")
        _validate_stage(stage)
        _validate_status(status, VALID_RUN_STATUSES, "stage run status")

        if run_id is not None:
            row = self._conn.execute("SELECT article_id FROM article_runs WHERE id = ?", (run_id,)).fetchone()
            if row is None:
                raise ValueError(f"Article run '{run_id}' not found")
            if row["article_id"] != article_id:
                raise ValueError(f"Article run '{run_id}' belongs to '{row['article_id']}', not '{article_id}'")

        stage_run_id = stage_run_id or _new_run_id()
        self._conn.execute(
            """INSERT INTO stage_runs
               (id, run_id, article_id, stage, surface, actor, requested_model,
                requested_model_tier, precedence_rank, output_budget_tokens, status,
                notes, started_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                stage_run_id,
                run_id,
                article_id,
                stage,
                surface,
                actor,
                requested_model,
                requested_model_tier,
                precedence_rank,
                output_budget_tokens,
                status,
                notes,
                _now_iso(),
            ),
        )
        self._conn.commit()
        return stage_run_id

    def finish_stage_run(self, stage_run_id, status="completed", notes=None, artifact_path=None):
        _validate_status(status, VALID_RUN_STATUSES, "stage run status")
        self._conn.execute(
            """UPDATE stage_runs
               SET status = ?, notes = ?, artifact_path = COALESCE(?, artifact_path), completed_at = ?
               WHERE id = ?""",
            (status, notes, artifact_path, _now_iso(), stage_run_id),
        )
        self._conn.commit()

    def _insert_usage_event(
        self,
        article_id,
        stage=None,
        surface=None,
        provider=None,
        actor=None,
        event_type="completed",
        model_or_tool=None,
        model_tier=None,
        precedence_rank=None,
        request_count=None,
        quantity=None,
        unit=None,
        prompt_tokens=None,
        output_tokens=None,
        cached_tokens=None,
        premium_requests=None,
        image_count=None,
        cost_usd_estimate=None,
        metadata_json=None,
        run_id=None,
        stage_run_id=None,
    ):
        if surface is None:
            raise ValueError("surface is required for usage events")
        if stage is not None:
            _validate_stage(stage)
        _validate_status(event_type, VALID_USAGE_EVENT_TYPES, "usage event type")

        self._conn.execute(
            """INSERT INTO usage_events
               (run_id, stage_run_id, article_id, stage, surface, provider, actor, event_type,
                model_or_tool, model_tier, precedence_rank, request_count, quantity, unit,
                prompt_tokens, output_tokens, cached_tokens, premium_requests, image_count,
                cost_usd_estimate, metadata_json, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                run_id,
                stage_run_id,
                article_id,
                stage,
                surface,
                provider,
                actor,
                event_type,
                model_or_tool,
                model_tier,
                precedence_rank,
                request_count,
                quantity,
                unit,
                prompt_tokens,
                output_tokens,
                cached_tokens,
                premium_requests,
                image_count,
                cost_usd_estimate,
                metadata_json,
                _now_iso(),
            ),
        )

    def record_usage_event(
        self,
        article_id,
        stage=None,
        surface=None,
        provider=None,
        actor=None,
        event_type="completed",
        model_or_tool=None,
        model_tier=None,
        precedence_rank=None,
        request_count=None,
        quantity=None,
        unit=None,
        prompt_tokens=None,
        output_tokens=None,
        cached_tokens=None,
        premium_requests=None,
        image_count=None,
        cost_usd_estimate=None,
        metadata=None,
        run_id=None,
        stage_run_id=None,
    ):
        article = self.get_article(article_id)
        if article is None:
            raise ValueError(f"Article '{article_id}' not found in pipeline.db")

        metadata_json = _normalize_metadata_json(metadata)
        self._insert_usage_event(
            article_id=article_id,
            stage=stage,
            surface=surface,
            provider=provider,
            actor=actor,
            event_type=event_type,
            model_or_tool=model_or_tool,
            model_tier=model_tier,
            precedence_rank=precedence_rank,
            request_count=request_count,
            quantity=quantity,
            unit=unit,
            prompt_tokens=prompt_tokens,
            output_tokens=output_tokens,
            cached_tokens=cached_tokens,
            premium_requests=premium_requests,
            image_count=image_count,
            cost_usd_estimate=cost_usd_estimate,
            metadata_json=metadata_json,
            run_id=run_id,
            stage_run_id=stage_run_id,
        )
        self._conn.commit()

    # ── Stage transitions ────────────────────────────────────────────────────

    def advance_stage(self, article_id, from_stage, to_stage, agent, notes=None, status=None, usage_event=None):
        """
        Advance an article's stage. Validates numeric semantics.

        Parameters
        ----------
        from_stage : int or None
            Current stage (None only for initial seed).
        to_stage : int
            Target stage, must be 1–8.
        agent : str
            Agent or person making the transition.
        status : str or None
            If provided, also update articles.status.
        usage_event : dict or None
            Optional usage-event payload inserted transactionally alongside the transition.
        """
        if from_stage is not None:
            _validate_stage(from_stage, "from_stage")
        _validate_stage(to_stage, "to_stage")

        article = self.get_article(article_id)
        if article is None:
            raise ValueError(f"Article '{article_id}' not found in pipeline.db")

        # Safety: fail loudly if from_stage is provided and doesn't match DB
        db_stage = article["current_stage"]
        if from_stage is not None and db_stage != from_stage:
            raise ValueError(
                f"Stage mismatch for '{article_id}': caller expects stage {from_stage}, "
                f"but DB has {db_stage!r} (type={type(db_stage).__name__}). "
                f"Refusing transition to avoid stale-stage corruption."
            )

        now = _now_iso()
        self._conn.execute(
            "INSERT INTO stage_transitions (article_id, from_stage, to_stage, agent, notes, transitioned_at) VALUES (?,?,?,?,?,?)",
            (article_id, from_stage, to_stage, agent, notes, now),
        )

        update_fields = ["current_stage = ?", "updated_at = ?"]
        update_params = [to_stage, now]
        if status:
            if status not in VALID_STATUSES:
                raise ValueError(f"Invalid status '{status}', expected one of {VALID_STATUSES}")
            update_fields.append("status = ?")
            update_params.append(status)

        update_params.append(article_id)
        self._conn.execute(
            f"UPDATE articles SET {', '.join(update_fields)} WHERE id = ?",
            update_params,
        )

        if usage_event is not None:
            payload = dict(usage_event)
            payload.setdefault("article_id", article_id)
            payload.setdefault("stage", to_stage)
            payload.setdefault("surface", "stage_transition")
            payload.setdefault("provider", "local")
            payload.setdefault("actor", agent)
            payload.setdefault("event_type", "stage_transition")
            payload["metadata_json"] = _normalize_metadata_json(payload.pop("metadata", None))
            self._insert_usage_event(**payload)

        self._conn.commit()

    # ── Artifact path updates ────────────────────────────────────────────────

    def set_discussion_path(self, article_id, path):
        """Set discussion_path on articles row."""
        self._conn.execute(
            "UPDATE articles SET discussion_path = ?, updated_at = ? WHERE id = ?",
            (path, _now_iso(), article_id),
        )
        self._conn.commit()

    def set_article_path(self, article_id, path):
        """Set article_path on articles row."""
        self._conn.execute(
            "UPDATE articles SET article_path = ?, updated_at = ? WHERE id = ?",
            (path, _now_iso(), article_id),
        )
        self._conn.commit()

    # ── Editor review ────────────────────────────────────────────────────────

    def record_editor_review(self, article_id, verdict, errors=0, suggestions=0, notes=0, review_number=None):
        """
        Insert an editor_reviews row.

        If review_number is None, auto-increments from existing reviews.
        """
        if verdict not in VALID_VERDICTS:
            raise ValueError(f"Invalid verdict '{verdict}', expected one of {VALID_VERDICTS}")

        if review_number is None:
            row = self._conn.execute(
                "SELECT MAX(review_number) FROM editor_reviews WHERE article_id = ?",
                (article_id,),
            ).fetchone()
            review_number = (row[0] or 0) + 1

        self._conn.execute(
            """INSERT INTO editor_reviews
               (article_id, verdict, error_count, suggestion_count, note_count, review_number, reviewed_at)
               VALUES (?,?,?,?,?,?,?)""",
            (article_id, verdict, errors, suggestions, notes, review_number, _now_iso()),
        )
        self._conn.commit()

    # ── Publisher pass ───────────────────────────────────────────────────────

    def record_publisher_pass(self, article_id, **checklist):
        """
        Insert or replace a publisher_pass row.
        Accepts keyword args matching publisher_pass columns.
        """
        defaults = {
            "title_final": 0,
            "subtitle_final": 0,
            "body_clean": 0,
            "section_assigned": 0,
            "tags_set": 0,
            "url_slug_set": 0,
            "cover_image_set": 0,
            "paywall_set": 0,
            "publish_datetime": None,
            "email_send": 1,
            "names_verified": 0,
            "numbers_current": 0,
            "no_stale_refs": 0,
        }
        defaults.update(checklist)
        self._conn.execute(
            """INSERT OR REPLACE INTO publisher_pass
               (article_id, title_final, subtitle_final, body_clean,
                section_assigned, tags_set, url_slug_set, cover_image_set,
                paywall_set, publish_datetime, email_send,
                names_verified, numbers_current, no_stale_refs)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                article_id,
                defaults["title_final"],
                defaults["subtitle_final"],
                defaults["body_clean"],
                defaults["section_assigned"],
                defaults["tags_set"],
                defaults["url_slug_set"],
                defaults["cover_image_set"],
                defaults["paywall_set"],
                defaults["publish_datetime"],
                defaults["email_send"],
                defaults["names_verified"],
                defaults["numbers_current"],
                defaults["no_stale_refs"],
            ),
        )
        self._conn.commit()

    # ── Notes ────────────────────────────────────────────────────────────────

    def record_note(self, article_id, note_type, content, note_url=None, target="prod", agent=None, image_path=None):
        """
        Insert a notes row for a published Substack Note.

        Parameters
        ----------
        article_id : str or None
            Linked article slug, or None for standalone Notes.
        note_type : str
            One of 'promotion', 'follow_up', 'standalone'.
        content : str
            Note body text.
        note_url : str or None
            URL of the published Note on Substack.
        target : str
            'prod' or 'stage'.
        agent : str or None
            Agent name or 'Joe'.
        image_path : str or None
            Local path if an image was attached.
        """
        if note_type not in self.VALID_NOTE_TYPES:
            raise ValueError(f"Invalid note_type '{note_type}', expected one of {self.VALID_NOTE_TYPES}")
        if target not in self.VALID_NOTE_TARGETS:
            raise ValueError(f"Invalid target '{target}', expected one of {self.VALID_NOTE_TARGETS}")
        if article_id is not None:
            article = self.get_article(article_id)
            if article is None:
                raise ValueError(f"Article '{article_id}' not found in pipeline.db")
        self._conn.execute(
            """INSERT INTO notes
               (article_id, note_type, content, substack_note_url, target, created_by, image_path)
               VALUES (?,?,?,?,?,?,?)""",
            (article_id, note_type, content, note_url, target, agent, image_path),
        )
        self._conn.commit()

    def get_notes_for_article(self, article_id):
        """Return all Notes linked to an article, newest first."""
        rows = self._conn.execute(
            "SELECT * FROM notes WHERE article_id = ? ORDER BY created_at DESC",
            (article_id,),
        ).fetchall()
        return [dict(r) for r in rows]

    def get_all_notes(self):
        """Return all Notes, newest first."""
        rows = self._conn.execute(
            "SELECT * FROM notes ORDER BY created_at DESC"
        ).fetchall()
        return [dict(r) for r in rows]

    # ── Publish confirmation ─────────────────────────────────────────────────

    def record_publish(self, article_id, substack_url, agent="Joe"):
        """
        Mark an article as published (Stage 8). Sets published_at, substack_url,
        status='published', current_stage=8.
        """
        article = self.get_article(article_id)
        if article is None:
            raise ValueError(f"Article '{article_id}' not found")

        from_stage = article["current_stage"] if isinstance(article["current_stage"], int) else None
        now = _now_iso()

        self._conn.execute(
            "INSERT INTO stage_transitions (article_id, from_stage, to_stage, agent, notes, transitioned_at) VALUES (?,?,?,?,?,?)",
            (article_id, from_stage, 8, agent, f"Published at {substack_url}", now),
        )
        self._conn.execute(
            """UPDATE articles SET current_stage = 8, status = 'published',
               substack_url = ?, published_at = ?, updated_at = ? WHERE id = ?""",
            (substack_url, now, now, article_id),
        )
        self._conn.commit()

    # ── Repair: coerce string stage to numeric ───────────────────────────────

    def repair_string_stage(self, article_id, correct_numeric_stage, agent="pipeline_state"):
        """
        Fix an article whose current_stage was written as a string.
        Logs the repair in stage_transitions.
        """
        _validate_stage(correct_numeric_stage, "correct_numeric_stage")
        article = self.get_article(article_id)
        if article is None:
            raise ValueError(f"Article '{article_id}' not found")

        old_val = article["current_stage"]
        now = _now_iso()

        self._conn.execute(
            "INSERT INTO stage_transitions (article_id, from_stage, to_stage, agent, notes, transitioned_at) VALUES (?,?,?,?,?,?)",
            (
                article_id,
                None,
                correct_numeric_stage,
                agent,
                f"Repaired string stage '{old_val}' → numeric {correct_numeric_stage}",
                now,
            ),
        )
        self._conn.execute(
            "UPDATE articles SET current_stage = ?, updated_at = ? WHERE id = ?",
            (correct_numeric_stage, now, article_id),
        )
        self._conn.commit()

    # ── Backfill: create missing articles rows ───────────────────────────────

    def backfill_article(self, article_id, title, stage=1, status="proposed", agent="pipeline_state", discussion_path=None, article_path=None):
        """
        Create a missing articles row from artifact-discovered slug and inferred stage.

        Safe for backfilling when content exists on disk but DB row is missing.
        Derives artifact paths when possible; uses safe defaults for all fields.
        """
        _validate_stage(stage, "stage")
        if status not in VALID_STATUSES:
            raise ValueError(f"Invalid status '{status}', expected one of {VALID_STATUSES}")

        existing = self.get_article(article_id)
        if existing is not None:
            raise ValueError(f"Article '{article_id}' already exists in DB")

        now = _now_iso()

        self._conn.execute(
            """INSERT INTO articles
               (id, title, status, current_stage, discussion_path, article_path, created_at, updated_at, depth_level, time_sensitive)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (article_id, title, status, stage, discussion_path, article_path, now, now, 2, 0),
        )

        self._conn.execute(
            "INSERT INTO stage_transitions (article_id, from_stage, to_stage, agent, notes, transitioned_at) VALUES (?,?,?,?,?,?)",
            (article_id, None, stage, agent, f"Backfilled missing DB row at stage {stage}", now),
        )

        self._conn.commit()


def _add_common_usage_event_args(parser):
    parser.add_argument("--article-id", required=True)
    parser.add_argument("--stage", type=int)
    parser.add_argument("--surface", required=True)
    parser.add_argument("--provider")
    parser.add_argument("--actor")
    parser.add_argument("--event-type", default="completed")
    parser.add_argument("--model-or-tool")
    parser.add_argument("--model-tier")
    parser.add_argument("--precedence-rank", type=int)
    parser.add_argument("--request-count", type=int)
    parser.add_argument("--quantity", type=int)
    parser.add_argument("--unit")
    parser.add_argument("--prompt-tokens", type=int)
    parser.add_argument("--output-tokens", type=int)
    parser.add_argument("--cached-tokens", type=int)
    parser.add_argument("--premium-requests", type=float)
    parser.add_argument("--image-count", type=int)
    parser.add_argument("--cost-usd-estimate", type=float)
    parser.add_argument("--run-id")
    parser.add_argument("--stage-run-id")
    parser.add_argument("--metadata-json")


def _build_cli_parser():
    parser = argparse.ArgumentParser(description="Pipeline DB helper and telemetry CLI")
    subparsers = parser.add_subparsers(dest="command")

    subparsers.add_parser("check", help="Validate numeric stage integrity")

    article_start = subparsers.add_parser("start-article-run", help="Create an article run record")
    article_start.add_argument("--article-id", required=True)
    article_start.add_argument("--trigger", required=True)
    article_start.add_argument("--initiated-by", required=True)
    article_start.add_argument("--notes")
    article_start.add_argument("--run-id")
    article_start.add_argument("--status", default="started")

    article_finish = subparsers.add_parser("finish-article-run", help="Complete an article run record")
    article_finish.add_argument("--run-id", required=True)
    article_finish.add_argument("--status", default="completed")
    article_finish.add_argument("--notes")

    stage_start = subparsers.add_parser("start-stage-run", help="Create a stage run record")
    stage_start.add_argument("--article-id", required=True)
    stage_start.add_argument("--stage", required=True, type=int)
    stage_start.add_argument("--surface", required=True)
    stage_start.add_argument("--actor", required=True)
    stage_start.add_argument("--run-id")
    stage_start.add_argument("--requested-model")
    stage_start.add_argument("--requested-model-tier")
    stage_start.add_argument("--precedence-rank", type=int)
    stage_start.add_argument("--output-budget-tokens", type=int)
    stage_start.add_argument("--notes")
    stage_start.add_argument("--stage-run-id")
    stage_start.add_argument("--status", default="started")

    stage_finish = subparsers.add_parser("finish-stage-run", help="Complete a stage run record")
    stage_finish.add_argument("--stage-run-id", required=True)
    stage_finish.add_argument("--status", default="completed")
    stage_finish.add_argument("--notes")
    stage_finish.add_argument("--artifact-path")

    usage = subparsers.add_parser("record-usage-event", help="Insert a usage event")
    _add_common_usage_event_args(usage)

    return parser


def _run_cli():
    parser = _build_cli_parser()
    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return 1

    with PipelineState() as ps:
        if args.command == "check":
            articles = ps.get_all_articles()
            issues = [a for a in articles if not isinstance(a["current_stage"], int)]
            print(f"Total articles: {len(articles)}")
            if issues:
                print(f"String-valued stages ({len(issues)}):")
                for issue in issues:
                    print(f"  {issue['id']}: stage={issue['current_stage']!r}")
                return 1
            print("All stages are numeric ✓")
            return 0

        if args.command == "start-article-run":
            run_id = ps.start_article_run(
                article_id=args.article_id,
                trigger=args.trigger,
                initiated_by=args.initiated_by,
                notes=args.notes,
                run_id=args.run_id,
                status=args.status,
            )
            print(run_id)
            return 0

        if args.command == "finish-article-run":
            ps.finish_article_run(args.run_id, status=args.status, notes=args.notes)
            print(args.run_id)
            return 0

        if args.command == "start-stage-run":
            stage_run_id = ps.start_stage_run(
                article_id=args.article_id,
                stage=args.stage,
                surface=args.surface,
                actor=args.actor,
                run_id=args.run_id,
                requested_model=args.requested_model,
                requested_model_tier=args.requested_model_tier,
                precedence_rank=args.precedence_rank,
                output_budget_tokens=args.output_budget_tokens,
                notes=args.notes,
                stage_run_id=args.stage_run_id,
                status=args.status,
            )
            print(stage_run_id)
            return 0

        if args.command == "finish-stage-run":
            ps.finish_stage_run(
                stage_run_id=args.stage_run_id,
                status=args.status,
                notes=args.notes,
                artifact_path=args.artifact_path,
            )
            print(args.stage_run_id)
            return 0

        if args.command == "record-usage-event":
            metadata = args.metadata_json
            if metadata is not None:
                json.loads(metadata)
            ps.record_usage_event(
                article_id=args.article_id,
                stage=args.stage,
                surface=args.surface,
                provider=args.provider,
                actor=args.actor,
                event_type=args.event_type,
                model_or_tool=args.model_or_tool,
                model_tier=args.model_tier,
                precedence_rank=args.precedence_rank,
                request_count=args.request_count,
                quantity=args.quantity,
                unit=args.unit,
                prompt_tokens=args.prompt_tokens,
                output_tokens=args.output_tokens,
                cached_tokens=args.cached_tokens,
                premium_requests=args.premium_requests,
                image_count=args.image_count,
                cost_usd_estimate=args.cost_usd_estimate,
                metadata=metadata,
                run_id=args.run_id,
                stage_run_id=args.stage_run_id,
            )
            print("ok")
            return 0

    return 1


if __name__ == "__main__":
    raise SystemExit(_run_cli())
