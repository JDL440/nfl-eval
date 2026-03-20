"""
article_board.py — Artifact-first stage inference and reconciliation for the
NFL Lab article pipeline.

Scans content/articles/* directories, infers each article's true stage from
local artifacts, then optionally compares against pipeline.db to surface drift.

Usage from repo root:
    python content/article_board.py                  # dry-run reconciliation
    python content/article_board.py --json           # machine-readable output
    python content/article_board.py --repair          # actually fix DB drift
    python content/article_board.py notes-sweep       # report missing Notes
    python content/article_board.py notes-sweep --json # machine-readable notes report
"""

import json
import os
import re
import sqlite3
import sys
from datetime import datetime, timezone, timedelta

# Allow running from repo root: python content/article_board.py
_CONTENT_DIR = os.path.dirname(os.path.abspath(__file__))
_REPO_ROOT = os.path.dirname(_CONTENT_DIR)
_ARTICLES_DIR = os.path.join(_CONTENT_DIR, "articles")

sys.path.insert(0, _REPO_ROOT)

from content.pipeline_state import PipelineState, STAGE_NAMES

# ── Status / stage helpers ───────────────────────────────────────────────────

def _utcnow():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _expected_status_for_stage(stage):
    """
    Return the canonical status for a given numeric stage, or None if
    the current status is acceptable.  Conservative: only flags clear
    inconsistencies (e.g., "in_discussion" at stage 5+ or "proposed"
    at stage 2+).  "in_production" is valid at any active stage (2-7).
    """
    if stage == 1:
        return "proposed"
    if stage == 8:
        return "published"
    # Stages 2-7: "in_production" or "in_discussion" are valid for 2-4;
    # but stage 5+ must be "in_production" — discussion is over.
    if stage >= 5:
        return "in_production"
    # Stages 2-4: both "in_discussion" and "in_production" are acceptable
    return None

# ── Artifact detection helpers ───────────────────────────────────────────────

def _has_file(dirpath, name):
    return os.path.isfile(os.path.join(dirpath, name))


def _has_any_file(dirpath, patterns):
    """Check if any file matching a glob-like pattern exists."""
    files = set(os.listdir(dirpath)) if os.path.isdir(dirpath) else set()
    for p in patterns:
        for f in files:
            if re.match(p, f):
                return True
    return False


def _parse_editor_verdict(dirpath):
    """
    Parse the latest editor-review*.md for verdict and flag counts.
    Returns dict with keys: verdict, errors, suggestions, notes, review_file
    or None if no editor review found.
    """
    def _editor_review_sort_key(filename):
        """Return numeric key: editor-review.md → 0, editor-review-N.md → N."""
        m = re.match(r"editor-review(?:-(\d+))?\.md$", filename)
        return int(m.group(1)) if m and m.group(1) else 0

    files = sorted(
        [f for f in os.listdir(dirpath) if re.match(r"editor-review(-\d+)?\.md$", f)],
        key=_editor_review_sort_key,
        reverse=True,
    )
    if not files:
        return None

    latest = files[0]
    path = os.path.join(dirpath, latest)
    try:
        text = open(path, "r", encoding="utf-8").read(16000)
    except OSError:
        return None

    verdict = None
    for pattern in [
        r"(?:##\s*)?(?:Final\s+)?Verdict[:\s]*[*_ 🟢🔴🟡✅❌]*\s*(APPROVED|REVISE|REJECT)",
        r"(?:Overall|Final)\s+(?:Verdict|Assessment)[:\s]*[*_ 🟢🔴🟡✅❌]*\s*(APPROVED|REVISE|REJECT)",
        r"###?\s*[🟢🔴🟡✅❌]+\s*(APPROVED|REVISE|REJECT)",
        r"\*\*(APPROVED|REVISE|REJECT)\*\*",
        r"(?:^|\n)\s*(?:✅|🟡|🔴)\s*(APPROVED|REVISE|REJECT)",
    ]:
        m = re.search(pattern, text, re.MULTILINE | re.IGNORECASE)
        if m:
            verdict = m.group(1).upper()
            break

    errors = len(re.findall(r"🔴|RED|error", text, re.IGNORECASE))
    suggestions = len(re.findall(r"🟡|YELLOW|suggestion", text, re.IGNORECASE))
    notes = len(re.findall(r"🟢|GREEN|note", text, re.IGNORECASE))

    return {
        "verdict": verdict,
        "errors": errors,
        "suggestions": suggestions,
        "notes": notes,
        "review_file": latest,
    }


def _has_panel_outputs(dirpath):
    """Check if directory has at least 2 *-position.md files (panel ran)."""
    files = [f for f in os.listdir(dirpath) if f.endswith("-position.md")]
    return len(files) >= 2


def _has_publisher_pass(dirpath):
    return _has_file(dirpath, "publisher-pass.md")


def _has_discussion_summary(dirpath):
    return _has_file(dirpath, "discussion-summary.md") or _has_file(dirpath, "discussion-synthesis.md")


def _count_images(dirpath):
    """Count image files (png, jpg, webp) in the article dir or content/images/{slug}/."""
    count = 0
    # Check the article directory itself
    if os.path.isdir(dirpath):
        count += len([f for f in os.listdir(dirpath) if re.match(r".*\.(png|jpe?g|webp)$", f, re.IGNORECASE)])
    # Also check the canonical images directory: content/images/{slug}/
    slug = os.path.basename(dirpath)
    images_dir = os.path.join(_CONTENT_DIR, "images", slug)
    if os.path.isdir(images_dir) and os.path.normpath(images_dir) != os.path.normpath(dirpath):
        count += len([f for f in os.listdir(images_dir) if re.match(r".*\.(png|jpe?g|webp)$", f, re.IGNORECASE)])
    return count


def _infer_discussion_path(slug):
    """
    Infer canonical discussion_path from artifacts.
    
    Returns:
        - content/articles/{slug}/discussion-summary.md (preferred)
        - content/articles/{slug}/discussion-synthesis.md (alternate)
        - None if neither exists
    
    Conservative: we do NOT return prompt or panel-composition paths
    as canonical discussion artifacts.
    """
    base = os.path.join(_ARTICLES_DIR, slug)
    
    # Prefer summary, fallback to synthesis
    for filename in ("discussion-summary.md", "discussion-synthesis.md"):
        candidate = os.path.join(base, filename)
        if os.path.isfile(candidate):
            # Return as relative path from repo root
            return os.path.relpath(candidate, _REPO_ROOT).replace("\\", "/")
    
    return None


def _infer_article_path(slug):
    """
    Infer canonical article_path from artifacts.
    
    Returns:
        - content/articles/{slug}/draft.md (preferred for stage 5+)
        - content/articles/{slug}.md (legacy flat file for stage 8)
        - None if neither exists
    
    Conservative: we do NOT return temp/section drafts as canonical.
    """
    # First check for structured draft
    draft_path = os.path.join(_ARTICLES_DIR, slug, "draft.md")
    if os.path.isfile(draft_path):
        return os.path.relpath(draft_path, _REPO_ROOT).replace("\\", "/")
    
    # Fallback: legacy flat file (typically published articles)
    flat_path = os.path.join(_ARTICLES_DIR, f"{slug}.md")
    if os.path.isfile(flat_path):
        return os.path.relpath(flat_path, _REPO_ROOT).replace("\\", "/")
    
    return None


# ── Stage inference ──────────────────────────────────────────────────────────

def infer_stage(article_dir):
    """
    Infer an article's current stage from its local artifacts.

    Returns dict:
        stage: int (1-8)
        stage_name: str
        next_action: str or None
        editor_verdict: str or None
        detail: str
    """
    dirpath = article_dir
    if not os.path.isdir(dirpath):
        # Might be a flat .md file (legacy published articles)
        return {
            "stage": 8 if os.path.isfile(dirpath + ".md") else 1,
            "stage_name": STAGE_NAMES.get(8, "Unknown") if os.path.isfile(dirpath + ".md") else STAGE_NAMES[1],
            "next_action": None,
            "editor_verdict": None,
            "detail": "Flat file (legacy published)" if os.path.isfile(dirpath + ".md") else "No directory",
        }

    has_prompt = _has_file(dirpath, "discussion-prompt.md")
    has_panel = _has_panel_outputs(dirpath)
    has_summary = _has_discussion_summary(dirpath)
    has_draft = _has_file(dirpath, "draft.md")
    editor = _parse_editor_verdict(dirpath)
    has_publisher = _has_publisher_pass(dirpath)
    has_idea = _has_file(dirpath, "idea.md")
    has_composition = _has_file(dirpath, "panel-composition.md")
    image_count = _count_images(dirpath)

    # Precedence: highest artifact wins (per plan)
    # 8: published proof (we check DB for substack_url — artifacts alone can't confirm)
    # 7: publisher-pass.md exists
    if has_publisher:
        return {
            "stage": 7,
            "stage_name": STAGE_NAMES[7],
            "next_action": "Dashboard review / live publish",
            "editor_verdict": editor["verdict"] if editor else None,
            "detail": "Publisher pass artifact found",
        }

    # 6: editor-review.md exists
    if editor:
        if editor["verdict"] == "APPROVED":
            if image_count >= 2:
                next_act = "Publisher pass"
            else:
                next_act = f"Image generation ({image_count}/2 images found)"
            return {
                "stage": 6,
                "stage_name": STAGE_NAMES[6],
                "next_action": next_act,
                "editor_verdict": "APPROVED",
                "detail": f"Editor: APPROVED ({editor['review_file']})",
            }
        elif editor["verdict"] == "REVISE":
            return {
                "stage": 6,
                "stage_name": STAGE_NAMES[6],
                "next_action": "Revision lane → re-draft → re-review",
                "editor_verdict": "REVISE",
                "detail": f"Editor: REVISE — {editor['errors']} red flags ({editor['review_file']})",
            }
        elif editor["verdict"] == "REJECT":
            return {
                "stage": 6,
                "stage_name": STAGE_NAMES[6],
                "next_action": "Major revision required (REJECT)",
                "editor_verdict": "REJECT",
                "detail": f"Editor: REJECT ({editor['review_file']})",
            }
        else:
            # Editor review exists but verdict not parseable
            return {
                "stage": 6,
                "stage_name": STAGE_NAMES[6],
                "next_action": "Review editor-review.md — verdict unclear",
                "editor_verdict": None,
                "detail": f"Editor review present but verdict not parsed ({editor['review_file']})",
            }

    # 5: draft.md exists (no editor review yet)
    if has_draft:
        return {
            "stage": 5,
            "stage_name": STAGE_NAMES[5],
            "next_action": "Editor pass",
            "editor_verdict": None,
            "detail": "Draft present, awaiting editor",
        }

    # 4: discussion summary or panel outputs exist
    if has_summary:
        return {
            "stage": 4,
            "stage_name": STAGE_NAMES[4],
            "next_action": "Writer drafting",
            "editor_verdict": None,
            "detail": "Discussion summary present — ready for Writer",
        }

    if has_panel:
        return {
            "stage": 4,
            "stage_name": STAGE_NAMES[4],
            "next_action": "Synthesize panel → discussion summary",
            "editor_verdict": None,
            "detail": "Panel outputs present, summary needed",
        }

    # 3: panel-composition.md exists (panel composed but hasn't run yet)
    if has_composition:
        return {
            "stage": 3,
            "stage_name": STAGE_NAMES[3],
            "next_action": "Run panel discussion",
            "editor_verdict": None,
            "detail": "Panel composed, awaiting execution",
        }

    # 2: discussion-prompt.md exists
    if has_prompt:
        return {
            "stage": 2,
            "stage_name": STAGE_NAMES[2],
            "next_action": "Panel composition",
            "editor_verdict": None,
            "detail": "Discussion prompt written",
        }

    # 1: idea.md or just a directory
    if has_idea:
        return {
            "stage": 1,
            "stage_name": STAGE_NAMES[1],
            "next_action": "Discussion prompt",
            "editor_verdict": None,
            "detail": "Idea exists",
        }

    return {
        "stage": 1,
        "stage_name": STAGE_NAMES[1],
        "next_action": "Idea generation",
        "editor_verdict": None,
        "detail": "Empty or minimal directory",
    }


# ── Board scan ───────────────────────────────────────────────────────────────

def scan_articles():
    """
    Scan all article directories and infer stages.
    Returns list of dicts with keys: slug, dir_path, and all infer_stage keys.
    """
    results = []
    db_articles = {}
    if not os.path.isdir(_ARTICLES_DIR):
        return results

    try:
        with PipelineState() as ps:
            db_articles = {article["id"]: article for article in ps.get_all_articles()}
    except FileNotFoundError:
        db_articles = {}

    for entry in sorted(os.listdir(_ARTICLES_DIR)):
        full_path = os.path.join(_ARTICLES_DIR, entry)
        if os.path.isdir(full_path):
            info = infer_stage(full_path)
            info["slug"] = entry
            info["dir_path"] = full_path
            db_row = db_articles.get(entry)
            if db_row and (db_row.get("substack_url") or db_row.get("status") == "published" or db_row.get("current_stage") == 8):
                info["stage"] = 8
                info["stage_name"] = STAGE_NAMES[8]
                info["next_action"] = None
                info["detail"] = "Published URL recorded in pipeline.db"
            results.append(info)
        elif entry.endswith(".md"):
            # Legacy flat files
            slug = entry.replace(".md", "")
            info = infer_stage(full_path)
            info["slug"] = slug
            info["dir_path"] = full_path
            db_row = db_articles.get(slug)
            if db_row and (db_row.get("substack_url") or db_row.get("status") == "published" or db_row.get("current_stage") == 8):
                info["stage"] = 8
                info["stage_name"] = STAGE_NAMES[8]
                info["next_action"] = None
                info["detail"] = "Published URL recorded in pipeline.db"
            results.append(info)

    return results


# ── Reconciliation ───────────────────────────────────────────────────────────

def reconcile(dry_run=True):
    """
    Compare artifact-inferred stages against pipeline.db.

    Returns list of dicts describing each discrepancy:
        slug, artifact_stage, db_stage, db_stage_type, action, detail
    
    Now includes path reconciliation:
        - Checks discussion_path for stage 4+ articles with discussion artifacts
        - Checks article_path for stage 5+ articles with draft artifacts
        - Reports PATH_MISMATCH or PATH_MISSING discrepancies
        - In repair mode, fixes paths to canonical values
    """
    board = scan_articles()
    discrepancies = []

    try:
        ps = PipelineState()
    except FileNotFoundError:
        return [{"slug": "*", "artifact_stage": None, "db_stage": None,
                 "action": "ERROR", "detail": "pipeline.db not found"}]

    db_articles = {a["id"]: a for a in ps.get_all_articles()}

    for item in board:
        slug = item["slug"]
        artifact_stage = item["stage"]
        db_row = db_articles.get(slug)

        if db_row is None:
            discrepancies.append({
                "slug": slug,
                "artifact_stage": artifact_stage,
                "db_stage": None,
                "db_stage_type": None,
                "action": "MISSING_DB_ROW",
                "detail": f"Artifacts at stage {artifact_stage} but no DB row",
            })
            if not dry_run:
                # Backfill: create the missing row with canonical paths
                # Derive title from slug (best effort)
                title = slug.replace("-", " ").title()
                
                # Infer paths based on stage
                discussion_path = _infer_discussion_path(slug) if artifact_stage >= 4 else None
                article_path = _infer_article_path(slug) if artifact_stage >= 5 else None
                
                ps.backfill_article(
                    article_id=slug,
                    title=title,
                    stage=artifact_stage,
                    status="in_production" if artifact_stage > 1 else "proposed",
                    agent="article_board",
                    discussion_path=discussion_path,
                    article_path=article_path,
                )
            continue

        db_stage = db_row["current_stage"]
        db_type = type(db_stage).__name__

        # String-valued stage is always a discrepancy
        if not isinstance(db_stage, int):
            discrepancies.append({
                "slug": slug,
                "artifact_stage": artifact_stage,
                "db_stage": db_stage,
                "db_stage_type": db_type,
                "action": "STRING_STAGE",
                "detail": f"DB has string stage '{db_stage}', artifacts say {artifact_stage}",
            })
            if not dry_run:
                ps.repair_string_stage(slug, artifact_stage, agent="article_board")
            continue

        # Numeric but out of sync with artifacts
        if db_stage != artifact_stage:
            # Don't flag published articles that are at stage 8 in DB
            if db_stage == 8 and db_row.get("status") == "published":
                continue

            discrepancies.append({
                "slug": slug,
                "artifact_stage": artifact_stage,
                "db_stage": db_stage,
                "db_stage_type": db_type,
                "action": "STAGE_DRIFT",
                "detail": f"DB={db_stage}, artifacts={artifact_stage} ({item['detail']})",
            })
            if not dry_run:
                ps.advance_stage(
                    slug,
                    from_stage=db_stage if isinstance(db_stage, int) else None,
                    to_stage=artifact_stage,
                    agent="article_board",
                    notes=f"Reconciliation: artifacts show stage {artifact_stage}",
                )

        # Check editor_reviews table if we have an editor review artifact
        if artifact_stage >= 6 and item.get("editor_verdict"):
            reviews = ps.get_editor_reviews(slug)
            if not reviews and not dry_run:
                # Backfill from artifact
                editor_info = _parse_editor_verdict(os.path.join(_ARTICLES_DIR, slug))
                if editor_info and editor_info["verdict"]:
                    ps.record_editor_review(
                        slug, editor_info["verdict"],
                        errors=editor_info["errors"],
                        suggestions=editor_info["suggestions"],
                        notes=editor_info["notes"],
                    )
            elif not reviews:
                discrepancies.append({
                    "slug": slug,
                    "artifact_stage": artifact_stage,
                    "db_stage": db_stage,
                    "db_stage_type": db_type,
                    "action": "MISSING_EDITOR_REVIEW",
                    "detail": f"Editor review artifact exists (verdict={item['editor_verdict']}) but no DB row",
                })
        
        # ── Status reconciliation ────────────────────────────────────────────
        # Stage 5+ articles should be "in_production"; stage 2-4 → "in_discussion"
        db_status = db_row.get("status")
        if db_status not in ("published", "archived"):
            expected_status = _expected_status_for_stage(artifact_stage)
            if expected_status and db_status != expected_status:
                discrepancies.append({
                    "slug": slug,
                    "artifact_stage": artifact_stage,
                    "db_stage": db_stage,
                    "db_stage_type": db_type,
                    "action": "STATUS_DRIFT",
                    "detail": f"status: DB='{db_status}' → expected='{expected_status}' for stage {artifact_stage}",
                })
                if not dry_run:
                    ps._conn.execute(
                        "UPDATE articles SET status = ?, updated_at = ? WHERE id = ?",
                        (expected_status, _utcnow(), slug),
                    )
                    ps._conn.commit()

        # ── Path reconciliation ──────────────────────────────────────────────
        # Check discussion_path for stage 4+ articles with discussion artifacts
        if artifact_stage >= 4:
            canonical_discussion = _infer_discussion_path(slug)
            db_discussion = db_row.get("discussion_path")
            
            if canonical_discussion and db_discussion != canonical_discussion:
                # Mismatch: DB has wrong path or None
                discrepancies.append({
                    "slug": slug,
                    "artifact_stage": artifact_stage,
                    "db_stage": db_stage,
                    "db_stage_type": db_type,
                    "action": "PATH_MISMATCH" if db_discussion else "PATH_MISSING",
                    "detail": f"discussion_path: DB='{db_discussion}' → canonical='{canonical_discussion}'",
                })
                if not dry_run:
                    ps.set_discussion_path(slug, canonical_discussion)
        
        # Check article_path for stage 5+ articles with draft artifacts
        if artifact_stage >= 5:
            canonical_article = _infer_article_path(slug)
            db_article = db_row.get("article_path")
            
            if canonical_article and db_article != canonical_article:
                # Mismatch: DB has wrong path or None
                discrepancies.append({
                    "slug": slug,
                    "artifact_stage": artifact_stage,
                    "db_stage": db_stage,
                    "db_stage_type": db_type,
                    "action": "PATH_MISMATCH" if db_article else "PATH_MISSING",
                    "detail": f"article_path: DB='{db_article}' → canonical='{canonical_article}'",
                })
                if not dry_run:
                    ps.set_article_path(slug, canonical_article)

    # Articles in DB but no local directory
    for db_id, db_row in db_articles.items():
        has_dir = os.path.isdir(os.path.join(_ARTICLES_DIR, db_id))
        has_flat = os.path.isfile(os.path.join(_ARTICLES_DIR, db_id + ".md"))
        if not has_dir and not has_flat and db_row["current_stage"] != 1 and db_row["status"] != "proposed":
            discrepancies.append({
                "slug": db_id,
                "artifact_stage": None,
                "db_stage": db_row["current_stage"],
                "db_stage_type": type(db_row["current_stage"]).__name__,
                "action": "NO_ARTIFACTS",
                "detail": f"DB at stage {db_row['current_stage']} but no local artifacts",
            })

    ps.close()
    return discrepancies


# ── Next-action board ────────────────────────────────────────────────────────

def next_actions():
    """
    Return a prioritized list of unblocked next actions across all articles.
    Useful for Ralph-style sweep scheduling.
    """
    board = scan_articles()
    actions = []
    for item in board:
        if item["next_action"] and item["stage"] < 8:
            actions.append({
                "slug": item["slug"],
                "stage": item["stage"],
                "stage_name": item["stage_name"],
                "next_action": item["next_action"],
                "editor_verdict": item.get("editor_verdict"),
            })

    # Sort: highest stage first (finish what's started), then alphabetical
    actions.sort(key=lambda x: (-x["stage"], x["slug"]))
    return actions


# ── CLI ──────────────────────────────────────────────────────────────────────

def _safe_print(text):
    """Print with fallback for Windows cp1252 terminals."""
    try:
        print(text)
    except UnicodeEncodeError:
        print(text.encode("ascii", errors="replace").decode("ascii"))


def _cli_board():
    board = scan_articles()

    # Load note counts per article (informational only)
    note_counts = {}
    try:
        ps = PipelineState()
        for row in ps._conn.execute(
            "SELECT article_id, COUNT(*) AS cnt FROM notes WHERE article_id IS NOT NULL GROUP BY article_id"
        ).fetchall():
            note_counts[row["article_id"]] = row["cnt"]
        ps.close()
    except (sqlite3.OperationalError, FileNotFoundError):
        pass  # notes table may not exist yet; degrade gracefully

    _safe_print(f"{'SLUG':<45} {'STAGE':>5}  {'NAME':<20} {'NOTES':>5}  {'NEXT ACTION'}")
    _safe_print("-" * 120)
    for item in sorted(board, key=lambda x: (-x["stage"], x["slug"])):
        na = (item.get("next_action", "-") or "-").replace("\u2192", "->")
        nc = note_counts.get(item["slug"], 0)
        nc_str = str(nc) if nc else "-"
        _safe_print(f"{item['slug']:<45} {item['stage']:>5}  {item['stage_name']:<20} {nc_str:>5}  {na}")


def _cli_reconcile(repair=False):
    mode = "REPAIR" if repair else "DRY-RUN"
    _safe_print(f"=== Article Board Reconciliation ({mode}) ===\n")
    discreps = reconcile(dry_run=not repair)
    if not discreps:
        _safe_print("OK No discrepancies found -- DB matches artifacts.")
    else:
        for d in discreps:
            flag = "[FIX]" if repair else "[WARN]"
            _safe_print(f"  {flag} {d['slug']}: [{d['action']}] {d['detail']}")
        _safe_print(f"\nTotal: {len(discreps)} discrepancies {'repaired' if repair else 'found'}")

    # Notes summary (informational, never affects reconciliation logic)
    try:
        ps = PipelineState()
        all_notes = ps.get_all_notes()
        ps.close()
        _safe_print("")  # blank line before notes summary
        if all_notes:
            linked = sum(1 for n in all_notes if n.get("article_id"))
            standalone = len(all_notes) - linked
            _safe_print(f"Notes: {len(all_notes)} total ({linked} article-linked, {standalone} standalone)")
        else:
            _safe_print("Notes: 0")

        # Cross-reference: note gaps count
        gaps = notes_sweep()
        urgent = sum(1 for g in gaps if g.get("severity") == "urgent")
        if gaps:
            hint = f" ({urgent} urgent)" if urgent else ""
            _safe_print(f"Notes gaps: {len(gaps)}{hint} -- run 'notes-sweep' for details")
    except (sqlite3.OperationalError, FileNotFoundError):
        pass  # notes table may not exist yet; degrade gracefully


def _cli_actions():
    actions = next_actions()
    if not actions:
        _safe_print("No unblocked actions.")
        return
    _safe_print(f"{'SLUG':<45} {'STAGE':>5}  {'NEXT ACTION'}")
    _safe_print("-" * 85)
    for a in actions:
        verdict_tag = f" [Editor: {a['editor_verdict']}]" if a.get("editor_verdict") else ""
        na = a["next_action"].replace("\u2192", "->")
        _safe_print(f"{a['slug']:<45} {a['stage']:>5}  {na}{verdict_tag}")


# ── Notes sweep (report-only) ───────────────────────────────────────────────

_STALE_HOURS = 48  # published articles missing a promotion Note after this are flagged


def notes_sweep():
    """
    Detect articles that are missing expected Substack Notes.

    Rules:
      - Stage 8 (published) articles should have a promotion Note.
      - Published articles older than 48 hours without a promotion Note are stale.

    Note: Stage 7 teaser detection (MISSING_TEASER) was disabled per Joe's
    directive (2026-03-18). Teasers are deprioritized; the sweep now only
    tracks promotion Notes for published articles.

    Returns a list of gap dicts:
        slug, stage, status, gap_type, severity, detail
    where gap_type is one of:
        MISSING_PROMOTION — stage 8 published with no promotion Note
        STALE_PROMOTION   — published >48h with no promotion Note
    and severity is one of: warning, urgent
    """
    try:
        ps = PipelineState()
    except FileNotFoundError:
        return [{"slug": "*", "gap_type": "ERROR", "detail": "pipeline.db not found"}]

    articles = ps.get_all_articles()

    # Build a lookup of note types per article
    note_types_by_article = {}
    try:
        rows = ps._conn.execute(
            "SELECT article_id, note_type, target FROM notes WHERE article_id IS NOT NULL"
        ).fetchall()
        for r in rows:
            key = r["article_id"]
            note_types_by_article.setdefault(key, []).append(
                {"note_type": r["note_type"], "target": r["target"]}
            )
    except sqlite3.OperationalError:
        pass  # notes table may not exist

    now = datetime.now(timezone.utc)
    gaps = []

    for a in articles:
        slug = a["id"]
        stage = a["current_stage"]
        status = a.get("status", "")

        if not isinstance(stage, int):
            continue  # skip corrupt rows

        article_notes = note_types_by_article.get(slug, [])
        has_prod_promotion = any(
            n["note_type"] == "promotion" and n["target"] == "prod"
            for n in article_notes
        )

        # Stage 8 (published) without a prod promotion Note
        if stage == 8 and status == "published" and not has_prod_promotion:
            published_at = a.get("published_at")
            hours_since = None
            if published_at:
                try:
                    pub_dt = datetime.fromisoformat(
                        published_at.replace("Z", "+00:00")
                        if "T" in published_at
                        else published_at + "T00:00:00+00:00"
                    )
                    hours_since = (now - pub_dt).total_seconds() / 3600
                except (ValueError, TypeError):
                    pass

            if hours_since is not None and hours_since > _STALE_HOURS:
                gaps.append({
                    "slug": slug,
                    "stage": stage,
                    "status": status,
                    "gap_type": "STALE_PROMOTION",
                    "severity": "urgent",
                    "detail": (
                        f"Published {hours_since:.0f}h ago — still no prod promotion Note"
                    ),
                })
            else:
                gaps.append({
                    "slug": slug,
                    "stage": stage,
                    "status": status,
                    "gap_type": "MISSING_PROMOTION",
                    "severity": "warning",
                    "detail": (
                        f"Published but no prod promotion Note"
                        + (f" ({hours_since:.0f}h ago)" if hours_since else "")
                    ),
                })

    ps.close()

    # Sort: urgent first, then warning, then info
    severity_order = {"urgent": 0, "warning": 1, "info": 2}
    gaps.sort(key=lambda g: (severity_order.get(g["severity"], 9), g["slug"]))
    return gaps


def _cli_notes_sweep(as_json=False):
    """CLI output for the notes sweep report."""
    gaps = notes_sweep()

    if as_json:
        print(json.dumps(gaps, indent=2, default=str))
        return

    _safe_print("=== Notes Sweep Report ===\n")

    if not gaps:
        _safe_print("OK All Stage 7+ articles have expected Notes coverage.")
        return

    if gaps[0].get("gap_type") == "ERROR":
        _safe_print(f"  ERROR: {gaps[0]['detail']}")
        return

    severity_icons = {"urgent": "!!!", "warning": " ! ", "info": "   "}
    _safe_print(f"{'SEV':>3}  {'SLUG':<45} {'STG':>3}  {'GAP TYPE':<20} DETAIL")
    _safe_print("-" * 110)

    counts = {"urgent": 0, "warning": 0, "info": 0}
    for g in gaps:
        sev = g["severity"]
        counts[sev] = counts.get(sev, 0) + 1
        icon = severity_icons.get(sev, "   ")
        detail = g["detail"].replace("\u2192", "->")
        _safe_print(
            f"{icon}  {g['slug']:<45} {g['stage']:>3}  {g['gap_type']:<20} {detail}"
        )

    _safe_print("")
    parts = []
    if counts["urgent"]:
        parts.append(f"{counts['urgent']} urgent")
    if counts["warning"]:
        parts.append(f"{counts['warning']} warning")
    if counts["info"]:
        parts.append(f"{counts['info']} info")
    _safe_print(f"Total: {len(gaps)} gaps ({', '.join(parts)})")
    _safe_print("")
    _safe_print("Next steps:")
    if counts["urgent"]:
        _safe_print("  - STALE_PROMOTION: These published articles need a promotion Note ASAP.")
    if counts["warning"]:
        _safe_print("  - MISSING_PROMOTION: Create and post promotion Notes (requires Joe approval).")
    if counts["info"]:
        _safe_print("  - INFO: Review info-level gaps above.")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "board"
    json_flag = "--json" in sys.argv[2:] if len(sys.argv) > 2 else False

    if cmd == "board":
        _cli_board()
    elif cmd == "reconcile":
        _cli_reconcile(repair=False)
    elif cmd == "--repair":
        _cli_reconcile(repair=True)
    elif cmd == "actions":
        _cli_actions()
    elif cmd == "notes-sweep":
        _cli_notes_sweep(as_json=json_flag)
    elif cmd == "--json":
        print(json.dumps(scan_articles(), indent=2, default=str))
    else:
        print("Usage: python content/article_board.py [board|reconcile|--repair|actions|notes-sweep|--json]")
        print("  notes-sweep          Report articles missing expected Notes")
        print("  notes-sweep --json   Machine-readable notes gap report")
