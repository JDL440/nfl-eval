"""
model_policy.py — Model selection and token-usage telemetry for the NFL Lab pipeline.

Reads authoritative model assignments from .squad/config/models.json.
Records usage events per stage/agent so we can track cost and token flow.

Usage:
    from content.model_policy import ModelPolicy
    mp = ModelPolicy()
    model = mp.model_for("writer")        # → "claude-opus-4.6"
    mp.record_usage("mia-2026", stage=5, agent="Writer", model="claude-opus-4.6",
                     prompt_tokens=4200, completion_tokens=3100, purpose="draft")
    mp.get_usage_summary("mia-2026")       # → dict with totals
"""

import json
import os
import sqlite3
from datetime import datetime, timezone

_SQUAD_ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
_MODELS_JSON = os.path.join(_SQUAD_ROOT, ".squad", "config", "models.json")
_DEFAULT_DB = os.path.join(os.path.dirname(os.path.abspath(__file__)), "pipeline.db")

# Telemetry DDL — added to pipeline.db on first use
_TELEMETRY_DDL = """
CREATE TABLE IF NOT EXISTS usage_events (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id      TEXT,                          -- nullable for non-article work
    stage           INTEGER,                       -- pipeline stage 1-8 or NULL
    agent           TEXT NOT NULL,                 -- agent name (Writer, Editor, Cap, etc.)
    model           TEXT NOT NULL,                 -- model used (claude-opus-4.6, gpt-5-mini, etc.)
    purpose         TEXT,                          -- free-text label: "draft", "panel_position", "editor_review", etc.
    prompt_tokens   INTEGER DEFAULT 0,
    completion_tokens INTEGER DEFAULT 0,
    total_tokens    INTEGER GENERATED ALWAYS AS (prompt_tokens + completion_tokens) STORED,
    wall_seconds    REAL,                          -- elapsed wall-clock time
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS stage_runs (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id      TEXT NOT NULL,
    stage           INTEGER NOT NULL,
    started_at      TEXT NOT NULL,
    completed_at    TEXT,
    status          TEXT NOT NULL DEFAULT 'running',   -- running | completed | failed
    agent           TEXT,
    model           TEXT,
    notes           TEXT
);
"""


def _now_iso():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


class ModelPolicy:
    """Reads model config and records usage telemetry."""

    def __init__(self, db_path=None, models_json=None):
        self.db_path = db_path or _DEFAULT_DB
        self.models_json = models_json or _MODELS_JSON
        self._config = self._load_config()
        self._conn = sqlite3.connect(self.db_path)
        self._conn.row_factory = sqlite3.Row
        self._ensure_tables()

    def _load_config(self):
        if not os.path.exists(self.models_json):
            return {"models": {}, "max_output_tokens": {}}
        with open(self.models_json, "r", encoding="utf-8") as f:
            return json.load(f)

    def _ensure_tables(self):
        self._conn.executescript(_TELEMETRY_DDL)

    def close(self):
        self._conn.close()

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.close()

    # ── Model selection ──────────────────────────────────────────────────

    def model_for(self, role):
        """Return the configured model for a pipeline role (writer, editor, lead, etc.)."""
        return self._config.get("models", {}).get(role)

    def max_tokens_for(self, role):
        """Return the max output token limit for a pipeline role."""
        return self._config.get("max_output_tokens", {}).get(role)

    def all_models(self):
        """Return the full model→role mapping."""
        return dict(self._config.get("models", {}))

    # ── Usage recording ──────────────────────────────────────────────────

    def record_usage(self, article_id, stage, agent, model, prompt_tokens=0,
                     completion_tokens=0, purpose=None, wall_seconds=None):
        """Record a single model invocation's token usage."""
        self._conn.execute(
            """INSERT INTO usage_events
               (article_id, stage, agent, model, purpose, prompt_tokens, completion_tokens, wall_seconds)
               VALUES (?,?,?,?,?,?,?,?)""",
            (article_id, stage, agent, model, purpose, prompt_tokens, completion_tokens, wall_seconds),
        )
        self._conn.commit()

    # ── Stage run tracking ───────────────────────────────────────────────

    def start_stage_run(self, article_id, stage, agent=None, model=None, notes=None):
        """Record the start of a pipeline stage run. Returns the stage_run id."""
        now = _now_iso()
        cur = self._conn.execute(
            """INSERT INTO stage_runs (article_id, stage, started_at, agent, model, notes)
               VALUES (?,?,?,?,?,?)""",
            (article_id, stage, now, agent, model, notes),
        )
        self._conn.commit()
        return cur.lastrowid

    def complete_stage_run(self, run_id, status="completed", notes=None):
        """Mark a stage run as completed or failed."""
        now = _now_iso()
        self._conn.execute(
            "UPDATE stage_runs SET completed_at = ?, status = ?, notes = COALESCE(?, notes) WHERE id = ?",
            (now, status, notes, run_id),
        )
        self._conn.commit()

    # ── Usage queries ────────────────────────────────────────────────────

    def get_usage_summary(self, article_id):
        """Return a dict summarizing token usage for an article."""
        rows = self._conn.execute(
            """SELECT stage, agent, model, purpose,
                      SUM(prompt_tokens) as total_prompt,
                      SUM(completion_tokens) as total_completion,
                      SUM(prompt_tokens + completion_tokens) as total_tokens,
                      COUNT(*) as call_count
               FROM usage_events
               WHERE article_id = ?
               GROUP BY stage, agent, model
               ORDER BY stage, agent""",
            (article_id,),
        ).fetchall()
        return [dict(r) for r in rows]

    def get_article_totals(self, article_id):
        """Return grand totals for an article."""
        row = self._conn.execute(
            """SELECT SUM(prompt_tokens) as prompt_total,
                      SUM(completion_tokens) as completion_total,
                      SUM(prompt_tokens + completion_tokens) as grand_total,
                      COUNT(*) as call_count,
                      COUNT(DISTINCT model) as model_count,
                      COUNT(DISTINCT agent) as agent_count
               FROM usage_events WHERE article_id = ?""",
            (article_id,),
        ).fetchone()
        return dict(row) if row else {}

    def get_stage_runs(self, article_id):
        """Return all stage runs for an article."""
        rows = self._conn.execute(
            "SELECT * FROM stage_runs WHERE article_id = ? ORDER BY stage, started_at",
            (article_id,),
        ).fetchall()
        return [dict(r) for r in rows]

    def get_all_usage(self):
        """Return all usage events, newest first."""
        rows = self._conn.execute(
            "SELECT * FROM usage_events ORDER BY created_at DESC"
        ).fetchall()
        return [dict(r) for r in rows]


# ── CLI ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import sys

    mp = ModelPolicy()

    if len(sys.argv) > 1:
        cmd = sys.argv[1]

        if cmd == "models":
            for role, model in mp.all_models().items():
                limit = mp.max_tokens_for(role) or "—"
                print(f"  {role:25s} → {model:25s} (max: {limit})")

        elif cmd == "usage" and len(sys.argv) > 2:
            article_id = sys.argv[2]
            summary = mp.get_usage_summary(article_id)
            totals = mp.get_article_totals(article_id)
            if not summary:
                print(f"No usage events for '{article_id}'")
            else:
                print(f"Usage for {article_id}:")
                for row in summary:
                    print(f"  Stage {row['stage']} | {row['agent']:12s} | {row['model']:25s} | "
                          f"prompt={row['total_prompt']:>6d} comp={row['total_completion']:>6d} "
                          f"total={row['total_tokens']:>6d} ({row['call_count']} calls)")
                print(f"\n  Grand total: {totals['grand_total'] or 0:,d} tokens "
                      f"({totals['call_count']} calls, {totals['model_count']} models, "
                      f"{totals['agent_count']} agents)")

        elif cmd == "stages" and len(sys.argv) > 2:
            article_id = sys.argv[2]
            runs = mp.get_stage_runs(article_id)
            if not runs:
                print(f"No stage runs for '{article_id}'")
            else:
                for r in runs:
                    dur = ""
                    if r.get("completed_at") and r.get("started_at"):
                        dur = f" ({r['completed_at']})"
                    print(f"  Stage {r['stage']} | {r['status']:9s} | {r['agent'] or '—':12s} | "
                          f"{r['model'] or '—':25s} | started {r['started_at']}{dur}")

        else:
            print("Usage: python content/model_policy.py [models|usage <article_id>|stages <article_id>]")
    else:
        print("Usage: python content/model_policy.py [models|usage <article_id>|stages <article_id>]")

    mp.close()
