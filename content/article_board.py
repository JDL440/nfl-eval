"""
article_board.py — Artifact-first stage inference and reconciliation for the
NFL Lab article pipeline.

Scans content/articles/* directories, infers each article's true stage from
local artifacts, then optionally compares against pipeline.db to surface drift.

Usage from repo root:
    python content/article_board.py                  # dry-run reconciliation
    python content/article_board.py --json           # machine-readable output
    python content/article_board.py --repair          # actually fix DB drift
"""

import json
import os
import re
import sys

# Allow running from repo root: python content/article_board.py
_CONTENT_DIR = os.path.dirname(os.path.abspath(__file__))
_REPO_ROOT = os.path.dirname(_CONTENT_DIR)
_ARTICLES_DIR = os.path.join(_CONTENT_DIR, "articles")

sys.path.insert(0, _REPO_ROOT)

from content.pipeline_state import PipelineState, STAGE_NAMES

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
    files = sorted(
        [f for f in os.listdir(dirpath) if re.match(r"editor-review(-\d+)?\.md$", f)],
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
    """Count image files (png, jpg, webp) in the article directory."""
    if not os.path.isdir(dirpath):
        return 0
    return len([f for f in os.listdir(dirpath) if re.match(r".*\.(png|jpe?g|webp)$", f, re.IGNORECASE)])


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
            "next_action": "Publish confirmation (manual by Joe)",
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
    if not os.path.isdir(_ARTICLES_DIR):
        return results

    for entry in sorted(os.listdir(_ARTICLES_DIR)):
        full_path = os.path.join(_ARTICLES_DIR, entry)
        if os.path.isdir(full_path):
            info = infer_stage(full_path)
            info["slug"] = entry
            info["dir_path"] = full_path
            results.append(info)
        elif entry.endswith(".md"):
            # Legacy flat files
            slug = entry.replace(".md", "")
            info = infer_stage(full_path)
            info["slug"] = slug
            info["dir_path"] = full_path
            results.append(info)

    return results


# ── Reconciliation ───────────────────────────────────────────────────────────

def reconcile(dry_run=True):
    """
    Compare artifact-inferred stages against pipeline.db.

    Returns list of dicts describing each discrepancy:
        slug, artifact_stage, db_stage, db_stage_type, action, detail
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
    _safe_print(f"{'SLUG':<45} {'STAGE':>5}  {'NAME':<20} {'NEXT ACTION'}")
    _safe_print("-" * 110)
    for item in sorted(board, key=lambda x: (-x["stage"], x["slug"])):
        na = (item.get("next_action", "-") or "-").replace("\u2192", "->")
        _safe_print(f"{item['slug']:<45} {item['stage']:>5}  {item['stage_name']:<20} {na}")


def _cli_reconcile(repair=False):
    mode = "REPAIR" if repair else "DRY-RUN"
    _safe_print(f"=== Article Board Reconciliation ({mode}) ===\n")
    discreps = reconcile(dry_run=not repair)
    if not discreps:
        _safe_print("OK No discrepancies found -- DB matches artifacts.")
        return
    for d in discreps:
        flag = "[FIX]" if repair else "[WARN]"
        _safe_print(f"  {flag} {d['slug']}: [{d['action']}] {d['detail']}")
    _safe_print(f"\nTotal: {len(discreps)} discrepancies {'repaired' if repair else 'found'}")


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


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "board"
    if cmd == "board":
        _cli_board()
    elif cmd == "reconcile":
        _cli_reconcile(repair=False)
    elif cmd == "--repair":
        _cli_reconcile(repair=True)
    elif cmd == "actions":
        _cli_actions()
    elif cmd == "--json":
        print(json.dumps(scan_articles(), indent=2, default=str))
    else:
        print("Usage: python content/article_board.py [board|reconcile|--repair|actions|--json]")
