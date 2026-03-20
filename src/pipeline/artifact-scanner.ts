/**
 * artifact-scanner.ts — Artifact-first stage inference and reconciliation.
 *
 * Ported from content/article_board.py for the v2 replatform.
 * Scans article directories on disk, infers each article's true pipeline stage
 * from local artifacts, then optionally compares against the database to
 * detect drift.
 */

import {
  readdirSync,
  existsSync,
  readFileSync,
  statSync,
  openSync,
  readSync,
  closeSync,
} from 'node:fs';
import { join, basename, relative } from 'node:path';

import type {
  Stage,
  EditorVerdict,
  Article,
  StageInference,
} from '../types.js';
import { STAGE_NAMES } from '../types.js';

// ── Exported types ──────────────────────────────────────────────────────────

export interface EditorVerdictInfo {
  verdict: EditorVerdict | null;
  errors: number;
  suggestions: number;
  notes: number;
  reviewFile: string;
}

export interface ArticleScan extends StageInference {
  slug: string;
  dirPath: string;
}

export interface Discrepancy {
  slug: string;
  artifactStage: Stage;
  dbStage: Stage | null;
  dbStageType: string | null;
  action:
    | 'MISSING_DB_ROW'
    | 'STRING_STAGE'
    | 'STAGE_DRIFT'
    | 'STATUS_DRIFT'
    | 'PATH_MISMATCH'
    | 'PATH_MISSING'
    | 'MISSING_EDITOR_REVIEW'
    | 'NO_ARTIFACTS';
  detail: string;
}

/**
 * Minimal repository interface used by `reconcile`.
 * Matches the subset of methods needed so the full db/repository module
 * is not required at import time (and tests can supply a stub).
 */
export interface Repository {
  getAllArticles(): Article[];
  getEditorReviews(articleId: string): unknown[];
  advanceStage(
    articleId: string,
    fromStage: Stage | null,
    toStage: Stage,
    agent: string,
    notes?: string,
  ): void;
  repairStringStage(articleId: string, stage: Stage, agent: string): void;
  backfillArticle(opts: {
    articleId: string;
    title: string;
    stage: Stage;
    status: string;
    agent: string;
    discussionPath?: string | null;
    articlePath?: string | null;
  }): void;
  recordEditorReview(
    articleId: string,
    verdict: EditorVerdict,
    counts: { errors: number; suggestions: number; notes: number },
  ): void;
  setDiscussionPath(articleId: string, path: string): void;
  setArticlePath(articleId: string, path: string): void;
  setStatus(articleId: string, status: string): void;
}

// ── Verdict regex patterns (ported verbatim) ────────────────────────────────

const VERDICT_PATTERNS: RegExp[] = [
  /(?:##\s*)?(?:Final\s+)?Verdict[:\s]*[*_ 🟢🔴🟡✅❌]*\s*(APPROVED|REVISE|REJECT)/i,
  /(?:Overall|Final)\s+(?:Verdict|Assessment)[:\s]*[*_ 🟢🔴🟡✅❌]*\s*(APPROVED|REVISE|REJECT)/i,
  /###?\s*[🟢🔴🟡✅❌]+\s*(APPROVED|REVISE|REJECT)/i,
  /\*\*(APPROVED|REVISE|REJECT)\*\*/i,
  /(?:^|\n)\s*(?:✅|🟡|🔴)\s*(APPROVED|REVISE|REJECT)/i,
];

// ── Status / stage helpers ──────────────────────────────────────────────────

function expectedStatusForStage(stage: number): string | null {
  if (stage === 1) return 'proposed';
  if (stage === 8) return 'published';
  if (stage >= 5) return 'in_production';
  return null; // stages 2-4: both in_discussion and in_production are ok
}

// ── Artifact detection helpers ──────────────────────────────────────────────

export function hasFile(dirPath: string, name: string): boolean {
  try {
    return statSync(join(dirPath, name)).isFile();
  } catch {
    return false;
  }
}

export function hasAnyFile(dirPath: string, patterns: RegExp[]): boolean {
  let files: string[];
  try {
    files = readdirSync(dirPath);
  } catch {
    return false;
  }
  for (const p of patterns) {
    for (const f of files) {
      if (p.test(f)) return true;
    }
  }
  return false;
}

export function hasPanelOutputs(dirPath: string): boolean {
  let files: string[];
  try {
    files = readdirSync(dirPath);
  } catch {
    return false;
  }
  return files.filter((f) => f.endsWith('-position.md')).length >= 2;
}

export function hasPublisherPass(dirPath: string): boolean {
  return hasFile(dirPath, 'publisher-pass.md');
}

export function hasDiscussionSummary(dirPath: string): boolean {
  return (
    hasFile(dirPath, 'discussion-summary.md') ||
    hasFile(dirPath, 'discussion-synthesis.md')
  );
}

export function countImages(
  dirPath: string,
  imagesBaseDir?: string,
): number {
  const IMAGE_RE = /\.(png|jpe?g|webp)$/i;
  let count = 0;

  // Check the article directory itself
  try {
    if (statSync(dirPath).isDirectory()) {
      count += readdirSync(dirPath).filter((f) => IMAGE_RE.test(f)).length;
    }
  } catch {
    // directory doesn't exist — fine
  }

  // Also check {imagesBaseDir}/{slug}/ if provided
  if (imagesBaseDir) {
    const slug = basename(dirPath);
    const imgDir = join(imagesBaseDir, slug);
    try {
      if (
        statSync(imgDir).isDirectory() &&
        join(imgDir) !== join(dirPath) // avoid double-counting
      ) {
        count += readdirSync(imgDir).filter((f) => IMAGE_RE.test(f)).length;
      }
    } catch {
      // images dir doesn't exist — fine
    }
  }

  return count;
}

export function inferDiscussionPath(
  slug: string,
  articlesDir: string,
  repoRoot?: string,
): string | null {
  const baseDir = join(articlesDir, slug);

  for (const filename of [
    'discussion-summary.md',
    'discussion-synthesis.md',
  ]) {
    const candidate = join(baseDir, filename);
    if (existsSync(candidate)) {
      if (repoRoot) {
        return relative(repoRoot, candidate).replace(/\\/g, '/');
      }
      return candidate.replace(/\\/g, '/');
    }
  }
  return null;
}

export function inferArticlePath(
  slug: string,
  articlesDir: string,
  repoRoot?: string,
): string | null {
  // Structured draft
  const draftPath = join(articlesDir, slug, 'draft.md');
  if (existsSync(draftPath)) {
    if (repoRoot) {
      return relative(repoRoot, draftPath).replace(/\\/g, '/');
    }
    return draftPath.replace(/\\/g, '/');
  }

  // Legacy flat file
  const flatPath = join(articlesDir, `${slug}.md`);
  if (existsSync(flatPath)) {
    if (repoRoot) {
      return relative(repoRoot, flatPath).replace(/\\/g, '/');
    }
    return flatPath.replace(/\\/g, '/');
  }

  return null;
}

// ── Editor verdict parsing ──────────────────────────────────────────────────

function editorReviewSortKey(filename: string): number {
  const m = filename.match(/^editor-review(?:-(\d+))?\.md$/);
  return m?.[1] ? parseInt(m[1], 10) : 0;
}

export function parseEditorVerdict(
  dirPath: string,
): EditorVerdictInfo | null {
  let entries: string[];
  try {
    entries = readdirSync(dirPath);
  } catch {
    return null;
  }

  const reviewFiles = entries
    .filter((f) => /^editor-review(-\d+)?\.md$/.test(f))
    .sort((a, b) => editorReviewSortKey(b) - editorReviewSortKey(a));

  if (reviewFiles.length === 0) return null;

  const latest = reviewFiles[0];
  const filePath = join(dirPath, latest);

  let text: string;
  try {
    // Read up to 16 KB (same as Python)
    const buf = Buffer.alloc(16_000);
    const fd = openSync(filePath, 'r');
    const bytesRead = readSync(fd, buf, 0, 16_000, 0);
    closeSync(fd);
    text = buf.toString('utf-8', 0, bytesRead);
  } catch {
    return null;
  }

  let verdict: EditorVerdict | null = null;
  for (const pattern of VERDICT_PATTERNS) {
    const m = text.match(pattern);
    if (m) {
      verdict = m[1].toUpperCase() as EditorVerdict;
      break;
    }
  }

  const errors = (text.match(/🔴|RED|error/gi) ?? []).length;
  const suggestions = (text.match(/🟡|YELLOW|suggestion/gi) ?? []).length;
  const notes = (text.match(/🟢|GREEN|note/gi) ?? []).length;

  return {
    verdict,
    errors,
    suggestions,
    notes,
    reviewFile: latest,
  };
}

// ── Stage inference ─────────────────────────────────────────────────────────

export function inferStage(
  articleDir: string,
  imagesBaseDir?: string,
): StageInference {
  // If the directory doesn't exist, check for legacy flat file
  try {
    if (!statSync(articleDir).isDirectory()) {
      throw new Error('not a directory');
    }
  } catch {
    const flatFile = articleDir + '.md';
    const isLegacy = existsSync(flatFile);
    const stage: Stage = isLegacy ? 8 : 1;
    return {
      stage,
      stage_name: STAGE_NAMES[stage],
      next_action: null,
      editor_verdict: null,
      detail: isLegacy ? 'Flat file (legacy published)' : 'No directory',
    };
  }

  const dirPath = articleDir;
  const _hasPrompt = hasFile(dirPath, 'discussion-prompt.md');
  const _hasPanel = hasPanelOutputs(dirPath);
  const _hasSummary = hasDiscussionSummary(dirPath);
  const _hasDraft = hasFile(dirPath, 'draft.md');
  const editor = parseEditorVerdict(dirPath);
  const _hasPublisher = hasPublisherPass(dirPath);
  const _hasIdea = hasFile(dirPath, 'idea.md');
  const _hasComposition = hasFile(dirPath, 'panel-composition.md');
  const imageCount = countImages(dirPath, imagesBaseDir);

  // Precedence: highest artifact wins

  // 7: publisher-pass.md exists
  if (_hasPublisher) {
    return {
      stage: 7,
      stage_name: STAGE_NAMES[7],
      next_action: 'Dashboard review / live publish',
      editor_verdict: editor?.verdict ?? null,
      detail: 'Publisher pass artifact found',
    };
  }

  // 6: editor-review.md exists
  if (editor) {
    if (editor.verdict === 'APPROVED') {
      const nextAct =
        imageCount >= 2
          ? 'Publisher pass'
          : `Image generation (${imageCount}/2 images found)`;
      return {
        stage: 6,
        stage_name: STAGE_NAMES[6],
        next_action: nextAct,
        editor_verdict: 'APPROVED',
        detail: `Editor: APPROVED (${editor.reviewFile})`,
      };
    }
    if (editor.verdict === 'REVISE') {
      return {
        stage: 6,
        stage_name: STAGE_NAMES[6],
        next_action: 'Revision lane → re-draft → re-review',
        editor_verdict: 'REVISE',
        detail: `Editor: REVISE — ${editor.errors} red flags (${editor.reviewFile})`,
      };
    }
    if (editor.verdict === 'REJECT') {
      return {
        stage: 6,
        stage_name: STAGE_NAMES[6],
        next_action: 'Major revision required (REJECT)',
        editor_verdict: 'REJECT',
        detail: `Editor: REJECT (${editor.reviewFile})`,
      };
    }
    // Verdict not parseable
    return {
      stage: 6,
      stage_name: STAGE_NAMES[6],
      next_action: 'Review editor-review.md — verdict unclear',
      editor_verdict: null,
      detail: `Editor review present but verdict not parsed (${editor.reviewFile})`,
    };
  }

  // 5: draft.md exists (no editor review yet)
  if (_hasDraft) {
    return {
      stage: 5,
      stage_name: STAGE_NAMES[5],
      next_action: 'Editor pass',
      editor_verdict: null,
      detail: 'Draft present, awaiting editor',
    };
  }

  // 4: discussion summary or panel outputs exist
  if (_hasSummary) {
    return {
      stage: 4,
      stage_name: STAGE_NAMES[4],
      next_action: 'Writer drafting',
      editor_verdict: null,
      detail: 'Discussion summary present — ready for Writer',
    };
  }

  if (_hasPanel) {
    return {
      stage: 4,
      stage_name: STAGE_NAMES[4],
      next_action: 'Synthesize panel → discussion summary',
      editor_verdict: null,
      detail: 'Panel outputs present, summary needed',
    };
  }

  // 3: panel-composition.md exists
  if (_hasComposition) {
    return {
      stage: 3,
      stage_name: STAGE_NAMES[3],
      next_action: 'Run panel discussion',
      editor_verdict: null,
      detail: 'Panel composed, awaiting execution',
    };
  }

  // 2: discussion-prompt.md exists
  if (_hasPrompt) {
    return {
      stage: 2,
      stage_name: STAGE_NAMES[2],
      next_action: 'Panel composition',
      editor_verdict: null,
      detail: 'Discussion prompt written',
    };
  }

  // 1: idea.md or just a directory
  if (_hasIdea) {
    return {
      stage: 1,
      stage_name: STAGE_NAMES[1],
      next_action: 'Discussion prompt',
      editor_verdict: null,
      detail: 'Idea exists',
    };
  }

  return {
    stage: 1,
    stage_name: STAGE_NAMES[1],
    next_action: 'Idea generation',
    editor_verdict: null,
    detail: 'Empty or minimal directory',
  };
}

// ── Board scan ──────────────────────────────────────────────────────────────

export function scanArticles(
  articlesDir: string,
  dbArticles?: Map<string, Article>,
  imagesBaseDir?: string,
): ArticleScan[] {
  const results: ArticleScan[] = [];

  if (!existsSync(articlesDir)) return results;

  let entries: string[];
  try {
    entries = readdirSync(articlesDir).sort();
  } catch {
    return results;
  }

  for (const entry of entries) {
    const fullPath = join(articlesDir, entry);
    let slug: string;
    let isDir: boolean;

    try {
      isDir = statSync(fullPath).isDirectory();
    } catch {
      continue;
    }

    if (isDir) {
      slug = entry;
    } else if (entry.endsWith('.md')) {
      slug = entry.replace(/\.md$/, '');
    } else {
      continue;
    }

    const info = inferStage(isDir ? fullPath : join(articlesDir, slug), imagesBaseDir);

    // If DB says published, override local inference
    const dbRow = dbArticles?.get(slug);
    if (
      dbRow &&
      (dbRow.substack_url ||
        dbRow.status === 'published' ||
        dbRow.current_stage === 8)
    ) {
      results.push({
        slug,
        dirPath: fullPath,
        stage: 8,
        stage_name: STAGE_NAMES[8],
        next_action: null,
        editor_verdict: info.editor_verdict,
        detail: 'Published URL recorded in pipeline.db',
      });
    } else {
      results.push({
        slug,
        dirPath: fullPath,
        ...info,
      });
    }
  }

  return results;
}

// ── Reconciliation ──────────────────────────────────────────────────────────

export function reconcile(
  articlesDir: string,
  repo: Repository,
  opts: {
    dryRun?: boolean;
    imagesBaseDir?: string;
    repoRoot?: string;
  } = {},
): Discrepancy[] {
  const { dryRun = true, imagesBaseDir, repoRoot } = opts;
  const discrepancies: Discrepancy[] = [];

  const allArticles = repo.getAllArticles();
  const dbArticles = new Map(allArticles.map((a) => [a.id, a]));

  const board = scanArticles(articlesDir, dbArticles, imagesBaseDir);

  for (const item of board) {
    const { slug } = item;
    const artifactStage = item.stage;
    const dbRow = dbArticles.get(slug);

    // ── Missing DB row ────────────────────────────────────────────────────
    if (!dbRow) {
      discrepancies.push({
        slug,
        artifactStage,
        dbStage: null,
        dbStageType: null,
        action: 'MISSING_DB_ROW',
        detail: `Artifacts at stage ${artifactStage} but no DB row`,
      });
      if (!dryRun) {
        const title = slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
        const discussionPath =
          artifactStage >= 4
            ? inferDiscussionPath(slug, articlesDir, repoRoot)
            : null;
        const articlePath =
          artifactStage >= 5
            ? inferArticlePath(slug, articlesDir, repoRoot)
            : null;
        repo.backfillArticle({
          articleId: slug,
          title,
          stage: artifactStage,
          status: artifactStage > 1 ? 'in_production' : 'proposed',
          agent: 'artifact_scanner',
          discussionPath,
          articlePath,
        });
      }
      continue;
    }

    const dbStage = dbRow.current_stage;
    const dbType = typeof dbStage;

    // ── String-valued stage ───────────────────────────────────────────────
    if (typeof dbStage !== 'number') {
      discrepancies.push({
        slug,
        artifactStage,
        dbStage: dbStage as unknown as Stage,
        dbStageType: dbType,
        action: 'STRING_STAGE',
        detail: `DB has string stage '${dbStage}', artifacts say ${artifactStage}`,
      });
      if (!dryRun) {
        repo.repairStringStage(slug, artifactStage, 'artifact_scanner');
      }
      continue;
    }

    // ── Numeric stage drift ───────────────────────────────────────────────
    if (dbStage !== artifactStage) {
      // Don't flag published articles that are at stage 8 in DB
      if (dbStage === 8 && dbRow.status === 'published') {
        // skip — DB is authoritative for published
      } else {
        discrepancies.push({
          slug,
          artifactStage,
          dbStage,
          dbStageType: dbType,
          action: 'STAGE_DRIFT',
          detail: `DB=${dbStage}, artifacts=${artifactStage} (${item.detail})`,
        });
        if (!dryRun) {
          repo.advanceStage(
            slug,
            dbStage,
            artifactStage,
            'artifact_scanner',
            `Reconciliation: artifacts show stage ${artifactStage}`,
          );
        }
      }
    }

    // ── Missing editor review in DB ───────────────────────────────────────
    if (artifactStage >= 6 && item.editor_verdict) {
      const reviews = repo.getEditorReviews(slug);
      if (reviews.length === 0) {
        if (!dryRun) {
          const editorInfo = parseEditorVerdict(
            join(articlesDir, slug),
          );
          if (editorInfo?.verdict) {
            repo.recordEditorReview(slug, editorInfo.verdict, {
              errors: editorInfo.errors,
              suggestions: editorInfo.suggestions,
              notes: editorInfo.notes,
            });
          }
        } else {
          discrepancies.push({
            slug,
            artifactStage,
            dbStage,
            dbStageType: dbType,
            action: 'MISSING_EDITOR_REVIEW',
            detail: `Editor review artifact exists (verdict=${item.editor_verdict}) but no DB row`,
          });
        }
      }
    }

    // ── Status reconciliation ─────────────────────────────────────────────
    const dbStatus = dbRow.status;
    if (dbStatus !== 'published' && dbStatus !== 'archived') {
      const expected = expectedStatusForStage(artifactStage);
      if (expected && dbStatus !== expected) {
        discrepancies.push({
          slug,
          artifactStage,
          dbStage,
          dbStageType: dbType,
          action: 'STATUS_DRIFT',
          detail: `status: DB='${dbStatus}' → expected='${expected}' for stage ${artifactStage}`,
        });
        if (!dryRun) {
          repo.setStatus(slug, expected);
        }
      }
    }

    // ── Path reconciliation — discussion_path ─────────────────────────────
    if (artifactStage >= 4) {
      const canonical = inferDiscussionPath(slug, articlesDir, repoRoot);
      const dbDiscussion = dbRow.discussion_path;
      if (canonical && dbDiscussion !== canonical) {
        discrepancies.push({
          slug,
          artifactStage,
          dbStage,
          dbStageType: dbType,
          action: dbDiscussion ? 'PATH_MISMATCH' : 'PATH_MISSING',
          detail: `discussion_path: DB='${dbDiscussion}' → canonical='${canonical}'`,
        });
        if (!dryRun) {
          repo.setDiscussionPath(slug, canonical);
        }
      }
    }

    // ── Path reconciliation — article_path ────────────────────────────────
    if (artifactStage >= 5) {
      const canonical = inferArticlePath(slug, articlesDir, repoRoot);
      const dbArticle = dbRow.article_path;
      if (canonical && dbArticle !== canonical) {
        discrepancies.push({
          slug,
          artifactStage,
          dbStage,
          dbStageType: dbType,
          action: dbArticle ? 'PATH_MISMATCH' : 'PATH_MISSING',
          detail: `article_path: DB='${dbArticle}' → canonical='${canonical}'`,
        });
        if (!dryRun) {
          repo.setArticlePath(slug, canonical);
        }
      }
    }
  }

  // ── Articles in DB but no local artifacts ─────────────────────────────
  const scannedSlugs = new Set(board.map((b) => b.slug));
  for (const [dbId, dbRow] of dbArticles) {
    if (scannedSlugs.has(dbId)) continue;
    if (dbRow.current_stage === 1 && dbRow.status === 'proposed') continue;

    const hasDir = existsSync(join(articlesDir, dbId));
    const hasFlat = existsSync(join(articlesDir, `${dbId}.md`));
    if (!hasDir && !hasFlat) {
      discrepancies.push({
        slug: dbId,
        artifactStage: 1 as Stage,
        dbStage: dbRow.current_stage,
        dbStageType: typeof dbRow.current_stage,
        action: 'NO_ARTIFACTS',
        detail: `DB at stage ${dbRow.current_stage} but no local artifacts`,
      });
    }
  }

  return discrepancies;
}
