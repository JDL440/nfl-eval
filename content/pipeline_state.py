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

import os
import sqlite3
from datetime import datetime, timezone

# ── Constants ────────────────────────────────────────────────────────────────

VALID_STAGES = range(1, 9)  # 1–8 inclusive
VALID_STATUSES = ("proposed", "approved", "in_production", "in_discussion", "published", "archived")
VALID_VERDICTS = ("APPROVED", "REVISE", "REJECT")

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


def _now_iso():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _validate_stage(stage, label="stage"):
    """Ensure stage is a numeric int in 1–8."""
    if not isinstance(stage, int) or stage not in VALID_STAGES:
        raise ValueError(f"{label} must be an integer 1–8, got {stage!r} (type={type(stage).__name__})")


class PipelineState:
    """Thread-unsafe, single-connection wrapper for pipeline.db writes."""

    def __init__(self, db_path=None):
        self.db_path = db_path or _DEFAULT_DB
        if not os.path.exists(self.db_path):
            raise FileNotFoundError(f"pipeline.db not found at {self.db_path}")
        self._conn = sqlite3.connect(self.db_path)
        self._conn.row_factory = sqlite3.Row

    def close(self):
        self._conn.close()

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.close()

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

    # ── Stage transitions ────────────────────────────────────────────────────

    def advance_stage(self, article_id, from_stage, to_stage, agent, notes=None, status=None):
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
            "title_final": 0, "subtitle_final": 0, "body_clean": 0,
            "section_assigned": 0, "tags_set": 0, "url_slug_set": 0,
            "cover_image_set": 0, "paywall_set": 0, "publish_datetime": None,
            "email_send": 1, "names_verified": 0, "numbers_current": 0,
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
            (article_id, defaults["title_final"], defaults["subtitle_final"],
             defaults["body_clean"], defaults["section_assigned"], defaults["tags_set"],
             defaults["url_slug_set"], defaults["cover_image_set"], defaults["paywall_set"],
             defaults["publish_datetime"], defaults["email_send"],
             defaults["names_verified"], defaults["numbers_current"], defaults["no_stale_refs"]),
        )
        self._conn.commit()

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
            (article_id, None, correct_numeric_stage, agent,
             f"Repaired string stage '{old_val}' → numeric {correct_numeric_stage}", now),
        )
        self._conn.execute(
            "UPDATE articles SET current_stage = ?, updated_at = ? WHERE id = ?",
            (correct_numeric_stage, now, article_id),
        )
        self._conn.commit()

    # ── Backfill: create missing articles rows ───────────────────────────────

    def backfill_article(self, article_id, title, stage=1, status="proposed", agent="pipeline_state",
                         discussion_path=None, article_path=None):
        """
        Create a missing articles row from artifact-discovered slug and inferred stage.
        
        Safe for backfilling when content exists on disk but DB row is missing.
        Derives artifact paths when possible; uses safe defaults for all fields.
        
        Parameters
        ----------
        article_id : str
            The slug (e.g. 'ari-2026-offseason')
        title : str
            Article title (derived from slug if unknown)
        stage : int
            Inferred stage from artifacts (default 1)
        status : str
            Article status (default 'proposed')
        agent : str
            Who created the row (default 'pipeline_state')
        discussion_path : str or None
            Canonical discussion path (auto-inferred if None and stage >= 4)
        article_path : str or None
            Canonical article path (auto-inferred if None and stage >= 5)
        """
        _validate_stage(stage, "stage")
        if status not in VALID_STATUSES:
            raise ValueError(f"Invalid status '{status}', expected one of {VALID_STATUSES}")
        
        # Check if already exists
        existing = self.get_article(article_id)
        if existing is not None:
            raise ValueError(f"Article '{article_id}' already exists in DB")
        
        now = _now_iso()
        
        # Safe defaults: minimal row that won't break anything
        self._conn.execute(
            """INSERT INTO articles 
               (id, title, status, current_stage, discussion_path, article_path, created_at, updated_at, depth_level, time_sensitive)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (article_id, title, status, stage, discussion_path, article_path, now, now, 2, 0),
        )
        
        # Log the backfill as a stage transition
        self._conn.execute(
            "INSERT INTO stage_transitions (article_id, from_stage, to_stage, agent, notes, transitioned_at) VALUES (?,?,?,?,?,?)",
            (article_id, None, stage, agent, f"Backfilled missing DB row at stage {stage}", now),
        )
        
        self._conn.commit()


# ── CLI entry point for quick checks ─────────────────────────────────────────

if __name__ == "__main__":
    import sys

    ps = PipelineState()
    if len(sys.argv) > 1 and sys.argv[1] == "check":
        articles = ps.get_all_articles()
        print(f"Total articles: {len(articles)}")
        issues = []
        for a in articles:
            if not isinstance(a["current_stage"], int):
                issues.append(f"  {a['id']}: stage={a['current_stage']!r} (type={type(a['current_stage']).__name__})")
        if issues:
            print(f"String-valued stages ({len(issues)}):")
            for i in issues:
                print(i)
        else:
            print("All stages are numeric ✓")
    else:
        print("Usage: python content/pipeline_state.py check")
    ps.close()
