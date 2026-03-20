/**
 * engine.ts — Deterministic pipeline state machine.
 *
 * Governs article stage transitions with guard functions that enforce
 * prerequisite conditions before any advance is allowed.
 */

import type { Stage, PublisherPass } from '../types.js';
import { STAGE_NAMES } from '../types.js';
import type { Repository } from '../db/repository.js';
import type { ArtifactStore } from '../db/artifact-store.js';

// ── Guard result ────────────────────────────────────────────────────────────

export interface GuardResult {
  passed: boolean;
  reason: string;
}

// ── Transition definition ───────────────────────────────────────────────────

export interface TransitionDef {
  from: Stage;
  to: Stage;
  action: string;
  guard: (store: ArtifactStore, articleId: string, repo: Repository) => GuardResult;
}

// ── canAdvance result ───────────────────────────────────────────────────────

export interface AdvanceCheck {
  allowed: boolean;
  reason: string;
  nextStage: Stage;
}

// ── Validation report ───────────────────────────────────────────────────────

export interface ValidationItem {
  stage: Stage;
  action: string;
  result: GuardResult;
}

export interface ValidationReport {
  articleId: string;
  currentStage: Stage;
  items: ValidationItem[];
}

// ── Publisher pass boolean check fields ──────────────────────────────────────

const PUBLISHER_PASS_CHECKS: (keyof PublisherPass)[] = [
  'title_final',
  'subtitle_final',
  'body_clean',
  'section_assigned',
  'tags_set',
  'url_slug_set',
  'cover_image_set',
  'paywall_set',
  'email_send',
  'names_verified',
  'numbers_current',
  'no_stale_refs',
];

// ── Guard functions ─────────────────────────────────────────────────────────

export function requireIdea(store: ArtifactStore, articleId: string): GuardResult {
  if (!store.exists(articleId, 'idea.md')) {
    return { passed: false, reason: 'Idea has not been written yet' };
  }
  const content = store.get(articleId, 'idea.md');
  if (!content || content.trim().length === 0) {
    return { passed: false, reason: 'Idea is empty — add content before advancing' };
  }
  return { passed: true, reason: 'Idea exists and is non-empty' };
}

export function requirePrompt(store: ArtifactStore, articleId: string): GuardResult {
  if (!store.exists(articleId, 'discussion-prompt.md')) {
    return { passed: false, reason: 'Discussion prompt has not been generated yet' };
  }
  return { passed: true, reason: 'Discussion prompt ready' };
}

export function requirePanelComposition(store: ArtifactStore, articleId: string): GuardResult {
  if (!store.exists(articleId, 'panel-composition.md')) {
    return { passed: false, reason: 'Panel composition has not been generated yet' };
  }
  return { passed: true, reason: 'Panel composition ready' };
}

export function requireDiscussionSummary(store: ArtifactStore, articleId: string): GuardResult {
  if (!store.exists(articleId, 'discussion-summary.md')) {
    return { passed: false, reason: 'Discussion summary has not been generated yet' };
  }
  return { passed: true, reason: 'Discussion summary ready' };
}

const MIN_DRAFT_WORDS = 800;

export function requireDraft(store: ArtifactStore, articleId: string): GuardResult {
  if (!store.exists(articleId, 'draft.md')) {
    return { passed: false, reason: 'Article draft has not been written yet' };
  }
  const wordCount = store.wordCount(articleId, 'draft.md');
  if (wordCount < MIN_DRAFT_WORDS) {
    return {
      passed: false,
      reason: `Draft has ${wordCount} words (minimum ${MIN_DRAFT_WORDS})`,
    };
  }
  return { passed: true, reason: `Draft ready (${wordCount} words)` };
}

// ── Editor verdict helpers ──────────────────────────────────────────────────

function editorReviewSortKey(name: string): number {
  const m = name.match(/editor-review-(\d+)\.md$/);
  return m ? parseInt(m[1], 10) : 0;
}

const VERDICT_PATTERNS: RegExp[] = [
  /(?:##\s*)?(?:Final\s+)?Verdict[:\s]*[*_ 🟢🔴🟡✅❌]*\s*(APPROVED|REVISE|REJECT)/i,
  /(?:Overall|Final)\s+(?:Verdict|Assessment)[:\s]*[*_ 🟢🔴🟡✅❌]*\s*(APPROVED|REVISE|REJECT)/i,
  /###?\s*[🟢🔴🟡✅❌]+\s*(APPROVED|REVISE|REJECT)/i,
  /\*\*(APPROVED|REVISE|REJECT)\*\*/i,
  /(?:^|\n)\s*(?:✅|🟡|🔴)\s*(APPROVED|REVISE|REJECT)/i,
];

function extractVerdict(text: string): string | null {
  for (const pattern of VERDICT_PATTERNS) {
    const m = text.match(pattern);
    if (m) return m[1].toUpperCase();
  }
  return null;
}

export function requireEditorApproval(store: ArtifactStore, articleId: string): GuardResult {
  const artifacts = store.list(articleId);
  const reviewArtifacts = artifacts
    .filter(a => /^editor-review(-\d+)?\.md$/.test(a.name))
    .sort((a, b) => {
      const numA = editorReviewSortKey(a.name);
      const numB = editorReviewSortKey(b.name);
      return numB - numA;
    });

  if (reviewArtifacts.length === 0) {
    return { passed: false, reason: 'No editor review has been submitted yet' };
  }

  const latest = reviewArtifacts[0];
  const content = store.get(articleId, latest.name);
  if (!content) {
    return { passed: false, reason: 'Editor review content is empty' };
  }

  const verdict = extractVerdict(content);
  if (!verdict) {
    return { passed: false, reason: 'No verdict found in editor review' };
  }
  if (verdict !== 'APPROVED') {
    return { passed: false, reason: `Editor verdict is ${verdict}, not APPROVED` };
  }
  return { passed: true, reason: 'Editor approved' };
}

export function requirePublisherPass(
  repo: Repository,
  articleId: string,
): GuardResult {
  const pass = repo.getPublisherPass(articleId);
  if (pass == null) {
    return { passed: false, reason: 'No publisher pass record found' };
  }

  const failing: string[] = [];
  for (const field of PUBLISHER_PASS_CHECKS) {
    if ((pass as unknown as Record<string, unknown>)[field] !== 1) {
      failing.push(field);
    }
  }
  if (pass.publish_datetime == null) {
    failing.push('publish_datetime');
  }

  if (failing.length > 0) {
    return {
      passed: false,
      reason: `Publisher pass incomplete: ${failing.join(', ')}`,
    };
  }
  return { passed: true, reason: 'All publisher pass checks passed' };
}

export function requireSubstackUrl(
  repo: Repository,
  articleId: string,
): GuardResult {
  const article = repo.getArticle(articleId);
  if (article == null) {
    return { passed: false, reason: 'Article not found' };
  }
  if (!article.substack_url) {
    return { passed: false, reason: 'substack_url not set on article' };
  }
  return { passed: true, reason: 'substack_url is set' };
}

// ── Transition map ──────────────────────────────────────────────────────────

export const TRANSITION_MAP: TransitionDef[] = [
  {
    from: 1 as Stage,
    to: 2 as Stage,
    action: 'generatePrompt',
    guard: (store, id) => requireIdea(store, id),
  },
  {
    from: 2 as Stage,
    to: 3 as Stage,
    action: 'composePanel',
    guard: (store, id) => requirePrompt(store, id),
  },
  {
    from: 3 as Stage,
    to: 4 as Stage,
    action: 'runDiscussion',
    guard: (store, id) => requirePanelComposition(store, id),
  },
  {
    from: 4 as Stage,
    to: 5 as Stage,
    action: 'writeDraft',
    guard: (store, id) => requireDiscussionSummary(store, id),
  },
  {
    from: 5 as Stage,
    to: 6 as Stage,
    action: 'runEditor',
    guard: (store, id) => requireDraft(store, id),
  },
  {
    from: 6 as Stage,
    to: 7 as Stage,
    action: 'runPublisherPass',
    guard: (store, id) => requireEditorApproval(store, id),
  },
  {
    from: 7 as Stage,
    to: 8 as Stage,
    action: 'publish',
    guard: (_store, id, repo) => requirePublisherPass(repo, id),
  },
];

function getTransition(fromStage: Stage): TransitionDef | undefined {
  return TRANSITION_MAP.find((t) => t.from === fromStage);
}

// ── Pipeline Engine ─────────────────────────────────────────────────────────

export class PipelineEngine {
  private store: ArtifactStore;

  constructor(
    private repo: Repository,
  ) {
    this.store = repo.artifacts;
  }

  /**
   * Check whether an article can advance from the given stage.
   */
  canAdvance(articleId: string, fromStage: Stage): AdvanceCheck {
    const transition = getTransition(fromStage);
    if (!transition) {
      return {
        allowed: false,
        reason: `No transition defined from stage ${fromStage} (${STAGE_NAMES[fromStage]})`,
        nextStage: fromStage,
      };
    }

    const guardResult = transition.guard(this.store, articleId, this.repo);

    return {
      allowed: guardResult.passed,
      reason: guardResult.reason,
      nextStage: transition.to,
    };
  }

  /**
   * Validate the guard and advance the article to the next stage.
   * Throws if the guard fails or the transition is not allowed.
   */
  advance(articleId: string, fromStage: Stage, agent = 'pipeline-engine'): Stage {
    const check = this.canAdvance(articleId, fromStage);
    if (!check.allowed) {
      throw new Error(
        `Cannot advance '${articleId}' from stage ${fromStage}: ${check.reason}`,
      );
    }

    this.repo.advanceStage(articleId, fromStage, check.nextStage, agent);
    return check.nextStage;
  }

  /**
   * Regress an article to a previous stage.
   * Used when an editor or reviewer sends the article back for revisions.
   */
  regress(articleId: string, fromStage: Stage, toStage: Stage, agent: string, reason: string): void {
    if (toStage >= fromStage) {
      throw new Error(`Cannot regress from stage ${fromStage} to ${toStage}`);
    }
    this.repo.regressStage(articleId, fromStage, toStage, agent, reason);
  }

  /**
   * Return the list of transitions whose `from` matches the article's
   * current stage and whose guard passes.
   */
  getAvailableActions(articleId: string): TransitionDef[] {
    const article = this.repo.getArticle(articleId);
    if (article == null) return [];

    const currentStage = article.current_stage;

    return TRANSITION_MAP.filter((t) => {
      if (t.from !== currentStage) return false;
      return t.guard(this.store, articleId, this.repo).passed;
    });
  }

  /**
   * Run every guard relevant up to and including the article's current stage,
   * producing a full validation report.
   */
  validateArticle(articleId: string): ValidationReport {
    const article = this.repo.getArticle(articleId);
    if (article == null) {
      throw new Error(`Article '${articleId}' not found`);
    }

    const items: ValidationItem[] = [];

    for (const t of TRANSITION_MAP) {
      if (t.from > article.current_stage) break;
      items.push({
        stage: t.from,
        action: t.action,
        result: t.guard(this.store, articleId, this.repo),
      });
    }

    return {
      articleId,
      currentStage: article.current_stage,
      items,
    };
  }
}
