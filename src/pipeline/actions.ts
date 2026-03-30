/**
 * actions.ts — Stage transition actions.
 *
 * Each action executes the actual work for a stage transition:
 * loading input artifacts, calling the appropriate agent, and writing output.
 */

import type { Stage } from '../types.js';
import { STAGE_NAMES } from '../types.js';
import type { Repository } from '../db/repository.js';
import type { PipelineEngine } from './engine.js';
import type { AgentRunner, AgentRunParams, AgentRunResult } from '../agents/runner.js';
import type { PipelineAuditor } from './audit.js';
import type { AppConfig } from '../config/index.js';
import { extractVerdict, inspectDraftStructure, MIN_DRAFT_WORDS } from './engine.js';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ensureRosterContext, validatePlayerMentions } from './roster-context.js';
import { extractClaims, totalClaimCount } from './claim-extractor.js';
import { ensureFactCheckContext } from './fact-check-context.js';
import {
  buildWriterFactCheckArtifact,
  executeWriterFactCheckPass,
  extractUrlEvidence,
  WRITER_FACTCHECK_ARTIFACT_NAME,
  WRITER_FACTCHECK_SKILL_NAME,
} from './writer-factcheck.js';
import {
  buildWriterPreflightArtifact,
  buildWriterPreflightChecklist,
  runWriterPreflight,
  WRITER_PREFLIGHT_ARTIFACT_NAME,
  type WriterPreflightState,
  type WriterPreflightSourceArtifact,
} from './writer-preflight.js';
import { validateStatClaims, validateDraftClaims, buildValidationReport } from './validators.js';
import { estimateCost } from '../llm/pricing.js';
import {
  addConversationTurn,
  findConsecutiveRepeatedRevisionBlocker,
  getArticleConversation,
  addRevisionSummary,
  getRevisionHistory,
  getRevisionCount,
  buildRevisionSummaryContext,
  buildEditorPreviousReviews,
  MAX_EDITOR_PREVIOUS_REVIEWS,
} from './conversation.js';
import type { RevisionBlockerMetadata, RevisionBlockerSignature } from './conversation.js';

// ── Types ───────────────────────────────────────────────────────────────────

export interface ActionContext {
  repo: Repository;
  engine: PipelineEngine;
  runner: AgentRunner;
  auditor: PipelineAuditor;
  config: AppConfig;
  currentStageRunId?: string | null;
}

export interface ActionResult {
  success: boolean;
  artifactPath?: string;
  error?: string;
  duration: number;
  outcome?: 'APPROVED' | 'REVISE' | 'REJECT';
}

export type StageAction = (articleId: string, ctx: ActionContext) => Promise<ActionResult>;

interface DraftValidationState {
  wordCount: number;
  structure: ReturnType<typeof inspectDraftStructure>;
  preflight: WriterPreflightState;
}

// ── Types (panel) ───────────────────────────────────────────────────────────

export interface PanelMember {
  agentName: string;
  role: string;
}

interface RetrospectiveIssueSummary {
  text: string;
  count: number;
  firstIteration: number;
}

export interface ArticleEscalationStatus {
  articleId: string;
  title: string;
  currentStage: number;
  status: string;
  escalationReason: 'repeated_blocker';
  leadReviewArtifactName: 'lead-review.md';
  leadReviewArtifactPresent: boolean;
  leadReviewContent: string | null;
  blockerSignature: RevisionBlockerSignature | null;
  repeatedIterations: { previous: number; current: number } | null;
  latestFeedbackSummary: string | null;
}

export interface EscalatedArticlesFilter {
  blockerType?: string;
}

interface RetrospectiveFindingDraft {
  role: 'writer' | 'editor' | 'lead';
  findingType: 'churn_cause' | 'repeated_issue' | 'next_time_action' | 'process_improvement';
  findingText: string;
  sourceIteration?: number | null;
  priority?: 'high' | 'medium' | 'low' | null;
}

const EDITOR_REVISE_BLOCKER_TAG_GUIDANCE = 'If you choose REVISE, include one or more blocking items tagged EXACTLY as [BLOCKER type:id] using only letters, numbers, underscores, or hyphens for both `type` and `id`. Example: `- [BLOCKER structure:missing-tldr] Restore the required TLDR block before another pass.`';
const EDITOR_REVISE_BLOCKER_TAG_ERROR = 'Editor requested revisions without valid structured [BLOCKER type:id] tags.';

export interface RepeatedBlockerEscalationReadModel {
  repeatedBlockerDetected: boolean;
  needsLeadReview: boolean;
  hasLeadReviewHandoff: boolean;
  isEscalated: boolean;
  repeatedBlocker: {
    previousIteration: number;
    currentIteration: number;
    blockerType: string | null;
    blockerIds: string[];
    fingerprint: string;
    latestFeedbackSummary: string | null;
  } | null;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Generate article-contract.md after discussion summary.
 * This is a Stage 4 artifact that both Writer and Editor must honor.
 */
async function generateArticleContract(
  articleId: string,
  ctx: ActionContext,
  options: {
    surface?: string;
    discussionSummary?: string | null;
    stage?: Stage;
  } = {},
): Promise<void> {
  const existing = ctx.repo.artifacts.get(articleId, 'article-contract.md');
  if (existing && existing.trim().length > 0) {
    return;
  }

  const article = ctx.repo.getArticle(articleId);
  if (!article) throw new Error(`Article '${articleId}' not found`);

  const discussionSummary = options.discussionSummary ?? ctx.repo.artifacts.get(articleId, 'discussion-summary.md');
  if (!discussionSummary) {
    console.warn(`[generateArticleContract] No discussion-summary.md found for '${articleId}'`);
    return;
  }

  const ideaArtifact = ctx.repo.artifacts.get(articleId, 'idea.md') || '';
  const promptArtifact = ctx.repo.artifacts.get(articleId, 'discussion-prompt.md') || '';
  const panelArtifact = ctx.repo.artifacts.get(articleId, 'panel-composition.md') || '';

  const contractContext = [
    '## Article Idea',
    ideaArtifact,
    '',
    '## Discussion Prompt',
    promptArtifact,
    '',
    '## Panel Composition',
    panelArtifact,
    '',
    '## Discussion Summary',
    discussionSummary,
  ].join('\n');

  const stage = options.stage ?? article.current_stage;
  const surface = options.surface ?? 'runDiscussion-contract';
  const contractResult = await runAgent(ctx, articleId, stage, surface, {
    agentName: 'lead',
    task: `Based on the discussion context and synthesis, create a compact article contract that both Writer and Editor must honor.

The contract should capture:
- The thesis or core question this article must answer
- Key tensions or disagreements that must be preserved (not smoothed over)
- Required evidence anchors (specific stats, comps, or data points the article must reference)
- Mandatory article structure expectations (sections, flow, or framing)
- Open cautions (gaps, uncertainties, or temporal limits the article must acknowledge)

Keep it compact — 200-400 words. This is a specification, not a draft.`,
    skills: ['article-discussion'],
    articleContext: {
      slug: articleId,
      title: article.title,
      stage,
      content: contractContext,
    },
  });

  writeAgentResult(ctx.repo, articleId, 'article-contract.md', contractResult);
  recordAgentUsage(ctx, articleId, stage, surface, contractResult);
}

function readArtifact(repo: Repository, articleId: string, filename: string): string {
  const content = repo.artifacts.get(articleId, filename);
  if (content == null) {
    throw new Error(`Required artifact not found: ${filename}`);
  }
  return content;
}

function writeArtifact(repo: Repository, articleId: string, filename: string, content: string): void {
  repo.artifacts.put(articleId, filename, content);
}

function buildLeadReviewHandoff(
  repo: Repository,
  articleId: string,
  repeatedBlocker: ReturnType<typeof findConsecutiveRepeatedRevisionBlocker>,
): string {
  if (!repeatedBlocker) {
    throw new Error('Repeated blocker handoff requested without a repeated blocker');
  }

  const article = repo.getArticle(articleId);
  const latestEditorReview = repo.artifacts.get(articleId, 'editor-review.md');
  const latestFeedback = summarizeMarkdownLine(repeatedBlocker.current.feedback_summary, 300)
    ?? 'See the latest editor review below.';
  const blockerType = repeatedBlocker.signature.blockerType ?? 'unclassified';
  const blockerIds = repeatedBlocker.signature.blockerIds.length > 0
    ? repeatedBlocker.signature.blockerIds.join(', ')
    : '(none)';

  return [
    '# Lead Review Handoff',
    '',
    `Article: ${article?.title ?? articleId}`,
    `Slug: ${articleId}`,
    `Stage: 6 (${STAGE_NAMES[6]})`,
    '',
    '## Escalation Reason',
    'The editor returned consecutive REVISE summaries with the same structured blocker signature, so the pipeline stopped the normal auto-regress / force-approve loop and escalated for Lead review.',
    '',
    '## Repeated Blocker Fingerprint',
    `- Iterations: ${repeatedBlocker.previous.iteration} → ${repeatedBlocker.current.iteration}`,
    `- blocker_type: ${blockerType}`,
    `- blocker_ids: ${blockerIds}`,
    `- fingerprint: ${repeatedBlocker.signature.fingerprint}`,
    '',
    '## Latest Editor Feedback Summary',
    latestFeedback,
    '',
    '## Lead Next Actions',
    '- `REFRAME` — send the article back to Stage 4 / `revision` with new framing or sourcing direction.',
    '- `WAIT` / `PAUSE` — keep the article at Stage 6 / `needs_lead_review` until external input lands.',
    '- `ABANDON` — archive the article if the blocker should not be pursued.',
    '',
    '## Latest Editor Review',
    latestEditorReview?.trim() || '_editor-review.md not found_',
  ].join('\n');
}

export function getRepeatedBlockerEscalationReadModel(
  repo: Repository,
  articleId: string,
): RepeatedBlockerEscalationReadModel {
  const article = repo.getArticle(articleId);
  const repeatedBlocker = findConsecutiveRepeatedRevisionBlocker(getRevisionHistory(repo, articleId));
  const needsLeadReview = article?.status === 'needs_lead_review';
  const hasLeadReviewHandoff = repo.artifacts.get(articleId, 'lead-review.md') != null;

  return {
    repeatedBlockerDetected: repeatedBlocker != null,
    needsLeadReview,
    hasLeadReviewHandoff,
    isEscalated: needsLeadReview || hasLeadReviewHandoff,
    repeatedBlocker: repeatedBlocker == null
      ? null
      : {
          previousIteration: repeatedBlocker.previous.iteration,
          currentIteration: repeatedBlocker.current.iteration,
          blockerType: repeatedBlocker.signature.blockerType,
          blockerIds: repeatedBlocker.signature.blockerIds,
          fingerprint: repeatedBlocker.signature.fingerprint,
          latestFeedbackSummary: summarizeMarkdownLine(repeatedBlocker.current.feedback_summary, 300),
        },
  };
}

export function hasActiveRepeatedBlockerEscalation(repo: Repository, articleId: string): boolean {
  return getRepeatedBlockerEscalationReadModel(repo, articleId).isEscalated;
}

function maybeEscalateRepeatedRevisionBlocker(
  repo: Repository,
  articleId: string,
): { action: string } | null {
  const repeatedBlocker = findConsecutiveRepeatedRevisionBlocker(getRevisionHistory(repo, articleId));
  if (!repeatedBlocker) return null;

  repo.artifacts.put(articleId, 'lead-review.md', buildLeadReviewHandoff(repo, articleId, repeatedBlocker));
  repo.updateArticleStatus(articleId, 'needs_lead_review');

  const blockerLabel = repeatedBlocker.signature.blockerIds.length > 0
    ? repeatedBlocker.signature.blockerIds.join(', ')
    : repeatedBlocker.signature.blockerType ?? 'unclassified blocker';

  return {
    action: `Escalated to Lead review — repeated blocker signature detected (${blockerLabel})`,
  };
}

function buildArticleEscalationStatus(
  repo: Repository,
  articleId: string,
  repeatedBlocker: ReturnType<typeof findConsecutiveRepeatedRevisionBlocker>,
): ArticleEscalationStatus | null {
  const article = repo.getArticle(articleId);
  if (!article) return null;

  const leadReviewContent = repo.artifacts.get(articleId, 'lead-review.md');
  const isEscalated = article.status === 'needs_lead_review' || leadReviewContent != null;
  if (!isEscalated) return null;

  return {
    articleId: article.id,
    title: article.title,
    currentStage: article.current_stage,
    status: article.status,
    escalationReason: 'repeated_blocker',
    leadReviewArtifactName: 'lead-review.md',
    leadReviewArtifactPresent: leadReviewContent != null,
    leadReviewContent,
    blockerSignature: repeatedBlocker?.signature ?? null,
    repeatedIterations: repeatedBlocker
      ? {
          previous: repeatedBlocker.previous.iteration,
          current: repeatedBlocker.current.iteration,
        }
      : null,
    latestFeedbackSummary: repeatedBlocker?.current.feedback_summary ?? null,
  };
}

export function getArticleEscalationStatus(
  repo: Repository,
  articleId: string,
): ArticleEscalationStatus | null {
  return buildArticleEscalationStatus(
    repo,
    articleId,
    findConsecutiveRepeatedRevisionBlocker(getRevisionHistory(repo, articleId)),
  );
}

export function getEscalatedArticles(
  repo: Repository,
  filter?: EscalatedArticlesFilter,
): ArticleEscalationStatus[] {
  const normalizedBlockerType = typeof filter?.blockerType === 'string'
    ? filter.blockerType.trim().toLowerCase()
    : null;

  return repo.getAllArticles()
    .map((article) => getArticleEscalationStatus(repo, article.id))
    .filter((status): status is ArticleEscalationStatus => status != null)
    .filter((status) => {
      if (!normalizedBlockerType) return true;
      return status.blockerSignature?.blockerType === normalizedBlockerType;
    });
}

function extractRevisionBlockerMetadata(reviewContent: string): RevisionBlockerMetadata | null {
  const matches = [...reviewContent.matchAll(/\[BLOCKER\s+([a-z0-9_-]+):([a-z0-9_-]+)\]/gi)];
  if (matches.length === 0) return null;

  const blockerTypes = [...new Set(matches.map((match) => match[1]!.trim().toLowerCase()).filter(Boolean))];
  const blockerIds = [...new Set(matches.map((match) => match[2]!.trim().toLowerCase()).filter(Boolean))];
  if (blockerIds.length === 0) return null;

  return {
    blockerType: blockerTypes.length === 1 ? blockerTypes[0] : 'mixed',
    blockerIds,
  };
}

function summarizeMarkdownLine(text: string | null | undefined, maxLength = 180): string | null {
  if (!text) return null;
  const normalized = text
    .replace(/\r\n/g, '\n')
    .replace(/^#+\s+/gm, '')
    .replace(/^\s*[-*]\s+/gm, '')
    .replace(/\n{2,}/g, '\n')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) return null;
  if (normalized.length <= maxLength) return normalized;
  return normalized.slice(0, maxLength).trimEnd() + '…';
}

function parseRevisionIssues(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      : [];
  } catch {
    return [];
  }
}

function normalizeIssueKey(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function collectRevisionIssues(
  revisions: ReturnType<typeof getRevisionHistory>,
): RetrospectiveIssueSummary[] {
  const issues = new Map<string, RetrospectiveIssueSummary>();

  for (const revision of revisions) {
    const candidates = [
      ...parseRevisionIssues(revision.key_issues),
      summarizeMarkdownLine(revision.feedback_summary, 160),
    ].filter((item): item is string => typeof item === 'string' && item.trim().length > 0);

    for (const candidate of candidates) {
      const key = normalizeIssueKey(candidate);
      if (!key) continue;
      const existing = issues.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        issues.set(key, {
          text: candidate,
          count: 1,
          firstIteration: revision.iteration,
        });
      }
    }
  }

  return [...issues.values()].sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.firstIteration - b.firstIteration;
  });
}

function detectForceApprovedAfterMaxRevisions(repo: Repository, articleId: string): boolean {
  const editorReview = repo.artifacts.get(articleId, 'editor-review.md') ?? '';
  return /Auto-approved after \d+ revision cycles/i.test(editorReview);
}

function buildPostRevisionRetrospective(
  repo: Repository,
  articleId: string,
): {
  artifactName: string;
  artifactContent: string;
  overallSummary: string;
  revisionCount: number;
  completionStage: number;
  forceApprovedAfterMaxRevisions: boolean;
  participantRoles: Array<'writer' | 'editor' | 'lead'>;
  findings: RetrospectiveFindingDraft[];
} | null {
  const article = repo.getArticle(articleId);
  if (!article) return null;

  const revisions = getRevisionHistory(repo, articleId);
  if (revisions.length === 0) return null;

  const revisionCount = revisions.length;
  const completionStage = 7;
  const forceApprovedAfterMaxRevisions = detectForceApprovedAfterMaxRevisions(repo, articleId);
  const issueSummaries = collectRevisionIssues(revisions);
  const primaryIssue = issueSummaries[0]?.text ?? 'editor feedback landed late in the loop';
  const repeatedIssues = issueSummaries.filter((issue) => issue.count > 1);
  const repeatedIssueSummary = repeatedIssues.length > 0
    ? repeatedIssues.map((issue) => issue.text).join('; ')
    : primaryIssue;
  const latestRevision = revisions[revisions.length - 1];

  const findings: RetrospectiveFindingDraft[] = [
    {
      role: 'writer',
      findingType: 'churn_cause',
      findingText: `The draft needed ${revisionCount} revision cycle(s) because the first pass did not fully address ${primaryIssue}.`,
      sourceIteration: issueSummaries[0]?.firstIteration ?? latestRevision.iteration,
      priority: revisionCount > 1 ? 'high' : 'medium',
    },
    {
      role: 'writer',
      findingType: 'next_time_action',
      findingText: `Before handing the draft to the editor, run a writer self-check that explicitly verifies ${primaryIssue}.`,
      sourceIteration: latestRevision.iteration,
      priority: 'medium',
    },
    {
      role: 'editor',
      findingType: 'repeated_issue',
      findingText: repeatedIssues.length > 0
        ? `The same concerns repeated across iterations: ${repeatedIssueSummary}.`
        : `The revision loop concentrated on one dominant concern: ${repeatedIssueSummary}.`,
      sourceIteration: repeatedIssues[0]?.firstIteration ?? latestRevision.iteration,
      priority: repeatedIssues.length > 0 ? 'high' : 'medium',
    },
    {
      role: 'editor',
      findingType: 'next_time_action',
      findingText: `Future editor passes should convert must-fix items into a tighter first-pass checklist so ${primaryIssue} is surfaced sooner.`,
      sourceIteration: latestRevision.iteration,
      priority: 'medium',
    },
    {
      role: 'lead',
      findingType: 'churn_cause',
      findingText: forceApprovedAfterMaxRevisions
        ? `The article hit the revision cap and was force-approved, which signals unresolved churn around ${primaryIssue}.`
        : `The workflow reached Stage 7 only after ${revisionCount} revision cycle(s), showing that ${primaryIssue} was not closed early enough.`,
      sourceIteration: latestRevision.iteration,
      priority: forceApprovedAfterMaxRevisions ? 'high' : 'medium',
    },
    {
      role: 'lead',
      findingType: 'process_improvement',
      findingText: `Add a bounded pre-editor checkpoint for ${primaryIssue} and reuse the revision summary history before the next similar article enters Stage 6.`,
      sourceIteration: issueSummaries[0]?.firstIteration ?? latestRevision.iteration,
      priority: 'medium',
    },
  ];

  const overallSummary = forceApprovedAfterMaxRevisions
    ? `Article completed the Stage 7 publisher handoff after ${revisionCount} revision cycle(s). The main churn centered on ${primaryIssue}, and the final handoff required a force-approval after the max revision limit.`
    : `Article completed the Stage 7 publisher handoff after ${revisionCount} revision cycle(s). The main churn centered on ${primaryIssue}, with repeated fixes focused on ${repeatedIssueSummary}.`;

  const artifactName = `revision-retrospective-r${revisionCount}.md`;
  const evidence = revisions.map((revision) => {
    const issueList = parseRevisionIssues(revision.key_issues);
    const detail = issueList.length > 0
      ? issueList.join('; ')
      : summarizeMarkdownLine(revision.feedback_summary, 180) ?? 'No structured issue text recorded.';
    return `- Iteration ${revision.iteration}: ${detail}`;
  }).join('\n');

  const artifactContent = [
    '# Post-Revision Retrospective',
    '',
    `- **Article:** ${article.title} (\`${articleId}\`)`,
    `- **Completion stage:** Stage ${completionStage} — ${STAGE_NAMES[completionStage as Stage]}`,
    `- **Revision count:** ${revisionCount}`,
    `- **Force-approved after max revisions:** ${forceApprovedAfterMaxRevisions ? 'Yes' : 'No'}`,
    '',
    '## Overall Summary',
    overallSummary,
    '',
    '## Writer Perspective (synthesized from revision summaries and final artifacts)',
    `- **Why churn happened:** ${findings[0].findingText}`,
    `- **Next time:** ${findings[1].findingText}`,
    '',
    '## Editor Perspective (synthesized from revision summaries and final artifacts)',
    `- **What repeated:** ${findings[2].findingText}`,
    `- **Next time:** ${findings[3].findingText}`,
    '',
    '## Lead Perspective (synthesized from revision summaries and final artifacts)',
    `- **Why churn persisted:** ${findings[4].findingText}`,
    `- **Process improvement:** ${findings[5].findingText}`,
    '',
    '## Revision Evidence',
    evidence,
  ].join('\n');

  return {
    artifactName,
    artifactContent,
    overallSummary,
    revisionCount,
    completionStage,
    forceApprovedAfterMaxRevisions,
    participantRoles: ['writer', 'editor', 'lead'],
    findings,
  };
}

export function recordPostRevisionRetrospectiveIfEligible(
  repo: Repository,
  articleId: string,
): boolean {
  const retrospective = buildPostRevisionRetrospective(repo, articleId);
  if (!retrospective) return false;

  repo.artifacts.put(articleId, retrospective.artifactName, retrospective.artifactContent);
  repo.saveArticleRetrospective({
    articleId,
    completionStage: retrospective.completionStage,
    revisionCount: retrospective.revisionCount,
    forceApprovedAfterMaxRevisions: retrospective.forceApprovedAfterMaxRevisions,
    participantRoles: retrospective.participantRoles,
    overallSummary: retrospective.overallSummary,
    artifactName: retrospective.artifactName,
    findings: retrospective.findings.map((finding) => ({
      role: finding.role,
      findingType: finding.findingType,
      findingText: finding.findingText,
      sourceIteration: finding.sourceIteration ?? null,
      priority: finding.priority ?? null,
    })),
  });

  return true;
}

function needsDraftRepair(state: DraftValidationState): boolean {
  return state.wordCount < MIN_DRAFT_WORDS
    || !state.structure.passed
    || state.preflight.blockingIssues.length > 0;
}

function buildDraftRepairInstruction(state: DraftValidationState): string {
  const fixes: string[] = [];
  if (state.wordCount < MIN_DRAFT_WORDS) {
    fixes.push(`Your previous draft was only ${state.wordCount} words. The minimum is ${MIN_DRAFT_WORDS}, and the practical target is 800+ words.`);
  }
  if (!state.structure.passed) {
    fixes.push(
      `${state.structure.reason}. Rebuild the top of the article to follow the canonical substack-article skill exactly: headline, italic subtitle, optional cover image markdown, then a > **📋 TLDR** block near the top with 4 bullet points before the author line or first section heading.`,
    );
  }
  if (state.preflight.blockingIssues.length > 0) {
    fixes.push(
      'Your previous draft failed the writer preflight on hard factual issues. Repair these before you return the article:\n'
      + state.preflight.blockingIssues.map((issue) => `- ${issue.message}`).join('\n'),
    );
  }
  if (state.preflight.warnings.length > 0) {
    fixes.push(
      'Before you finish, also tighten these editor-facing checks where possible:\n'
      + state.preflight.warnings.map((issue) => `- ${issue.message}`).join('\n'),
    );
  }
  fixes.push('Output the complete revised article markdown, not notes or an outline.');
  return fixes.join(' ');
}

const WRITER_EDITOR_PREFLIGHT_CHECKLIST = buildWriterPreflightChecklist();

function buildWriterTask(isRevision: boolean): string {
  const modeInstruction = isRevision
    ? 'You are REVISING an existing draft — NOT writing from scratch. Your previous draft and the current editor review are both provided. Read the editor review carefully, then make ONLY the changes the editor requested. Keep everything the editor praised.'
    : 'Write an analytical article draft based on the panel discussion.';
  return `${modeInstruction} Use the bounded writer fact-check contract only for specific risky claims; do not turn Stage 5 into open-ended research.\n\n${WRITER_EDITOR_PREFLIGHT_CHECKLIST}\n\nOutput the complete article markdown.`;
}

function validateDraftOutput(
  sourceArtifacts: WriterPreflightSourceArtifact[],
  content: string,
): DraftValidationState {
  return {
    wordCount: content.split(/\s+/).filter(Boolean).length,
    structure: inspectDraftStructure(content),
    preflight: runWriterPreflight({ draft: content, sourceArtifacts }),
  };
}

function buildWriterSendBackReview(reason: string): string {
  return [
    '# Writer Structure Send-Back',
    '',
    '## 🔴 ERRORS (Must Fix Before Publish)',
    `- ${reason}`,
    '- Revise the existing draft instead of starting over. Preserve the strong analysis, but repair the required top-of-article TLDR structure from the canonical substack-article skill before editor review.',
    '',
    '## 🟡 SUGGESTIONS (Strong Recommendations)',
    '- Keep the headline, subtitle, and body analysis that already work.',
    '- Insert a four-bullet TLDR block near the top before the author line or first section heading.',
    '',
    '## 🟢 NOTES (Minor / Optional)',
    '- Reuse the previous draft as source material for the revision.',
    '',
    '## Verdict',
    'REVISE',
  ].join('\n');
}

/** Save agent result: main artifact + separate thinking trace if present. */
export function writeAgentResult(
  repo: Repository,
  articleId: string,
  filename: string,
  result: { content: string; thinking: string | null; model: string; agentName: string },
): void {
  writeArtifact(repo, articleId, filename, result.content);
  if (result.thinking) {
    const thinkingName = filename.replace(/\.md$/, '.thinking.md');
    const header = `# Thinking Trace\n\n**Agent:** ${result.agentName}  \n**Model:** ${result.model}  \n**Artifact:** ${filename}\n\n---\n\n`;
    writeArtifact(repo, articleId, thinkingName, header + result.thinking);
  }
}

function buildAgentTraceContext(
  ctx: ActionContext,
  articleId: string,
  stage: number,
  surface: string,
): NonNullable<AgentRunParams['trace']> {
  return {
    repo: ctx.repo,
    articleId,
    stage,
    surface,
    stageRunId: ctx.currentStageRunId ?? null,
  };
}

const DEFAULT_STAGE_REQUESTED_TOOLS = [
  'pipeline-read',
  'nflverse-data',
  'prediction-markets',
  'web_search',
] as const;

function buildStageRequestedTools(
  surface: string,
  explicitRequestedTools?: string[],
): string[] {
  const requested = new Set<string>(DEFAULT_STAGE_REQUESTED_TOOLS);
  if (surface === 'runPublisherPass') {
    requested.add('article');
  }
  for (const tool of explicitRequestedTools ?? []) {
    if (tool) requested.add(tool);
  }
  return [...requested];
}

function runAgent(
  ctx: ActionContext,
  articleId: string,
  stage: number,
  surface: string,
  params: Omit<AgentRunParams, 'trace'>,
): Promise<AgentRunResult> {
  const articleProvider = ctx.repo.getArticle(articleId)?.llm_provider ?? undefined;
  return ctx.runner.run({
    ...params,
    provider: params.provider ?? articleProvider,
    trace: buildAgentTraceContext(ctx, articleId, stage, surface),
    toolCalling: {
      enabled: true,
      includeLocalExtensions: params.toolCalling?.includeLocalExtensions ?? true,
      includePipelineTools: params.toolCalling?.includePipelineTools ?? true,
      includeWebSearch: params.toolCalling?.includeWebSearch ?? true,
      allowWriteTools: params.toolCalling?.allowWriteTools ?? false,
      maxToolCalls: params.toolCalling?.maxToolCalls ?? 50,
      requestedTools: buildStageRequestedTools(surface, params.toolCalling?.requestedTools),
      context: {
        repo: ctx.repo,
        engine: ctx.engine,
        config: ctx.config,
        actionContext: ctx,
        articleId,
        stage,
        surface,
        agentName: params.agentName,
      },
    },
  });
}

/** Record token usage from an agent run if usage data is present. */
export function recordAgentUsage(
  ctx: ActionContext,
  articleId: string,
  stage: number,
  surface: string,
  result: AgentRunResult,
): void {
  if (result.tokensUsed) {
    const cost = estimateCost(
      result.model,
      result.tokensUsed.prompt,
      result.tokensUsed.completion,
    );
    ctx.repo.recordUsageEvent({
      articleId,
      stage,
      surface,
      stageRunId: ctx.currentStageRunId ?? null,
      provider: result.provider,
      modelOrTool: result.model,
      eventType: 'completed',
      promptTokens: result.tokensUsed.prompt,
      outputTokens: result.tokensUsed.completion,
      costUsdEstimate: cost > 0 ? cost : null,
      metadata: result.traceId ? { traceId: result.traceId } : null,
    });
  }
}

function recordWriterFactCheckUsage(
  ctx: ActionContext,
  articleId: string,
  stage: number,
  report: Awaited<ReturnType<typeof executeWriterFactCheckPass>>,
): void {
  const usage = report.usage;
  if (
    usage.localDeterministicPassesUsed === 0 &&
    usage.externalChecksUsed === 0 &&
    usage.claimCount === 0 &&
    usage.blockedSourceCount === 0 &&
    usage.fetchFailureCount === 0
  ) {
    return;
  }

  ctx.repo.recordUsageEvent({
    articleId,
    stage,
    surface: 'writeDraft-writer-factcheck',
    stageRunId: ctx.currentStageRunId ?? null,
    provider: 'pipeline',
    actor: 'writer-factcheck',
    eventType: 'completed',
    modelOrTool: 'writer-factcheck',
    requestCount: usage.externalChecksUsed,
    quantity: usage.claimCount,
    unit: 'claim',
    metadata: {
      localDeterministicPassesUsed: usage.localDeterministicPassesUsed,
      externalChecksUsed: usage.externalChecksUsed,
      domainsTouched: usage.domainsTouched,
      remainingStatus: usage.remainingStatus,
      verifiedCount: report.verifiedFacts.length,
      attributedCount: report.attributedFacts.length,
      omittedCount: report.omittedClaims.length,
      blockedSourceCount: usage.blockedSourceCount,
      fetchFailureCount: usage.fetchFailureCount,
      wallClockMs: usage.wallClockMs,
    },
  });
}

/**
 * Parse panel-composition.md into structured PanelMember array.
 * Expected format from the panel-composition skill:
 *   ## Panel
 *   - **SEA** — Seahawks team context: roster gaps, competitive window, cap position
 *   - **Cap** — Salary cap analysis: market comps, contract structure, cap impact
 *
 * Also handles simpler formats:
 *   - **sea** — role description
 *   - **Cap**: role description
 */
export function parsePanelComposition(content: string): PanelMember[] {
  const members: PanelMember[] = [];
  const lines = content.split('\n');
  const seen = new Set<string>();

  for (const line of lines) {
    let agentName: string | null = null;
    let role = '';

    // Pattern 1: - **AgentName** — role  (original)
    const m1 = line.match(/^[-*]\s+\*\*([^*]+)\*\*\s*(?:—|--|:|-)\s*(.+)$/);
    if (m1) { agentName = m1[1]; role = m1[2]; }

    // Pattern 2: Numbered list — 1. **AgentName** — role
    if (!agentName) {
      const m2 = line.match(/^\d+[.)]\s+\*\*([^*]+)\*\*\s*(?:—|--|:|-)\s*(.+)$/);
      if (m2) { agentName = m2[1]; role = m2[2]; }
    }

    // Pattern 3: Non-bold — - AgentName — role  or  - AgentName: role
    if (!agentName) {
      const m3 = line.match(/^[-*]\s+([A-Za-z][\w-]+)\s*(?:—|--|:)\s*(.+)$/);
      if (m3) { agentName = m3[1]; role = m3[2]; }
    }

    // Pattern 4: Numbered non-bold — 1. AgentName — role
    if (!agentName) {
      const m4 = line.match(/^\d+[.)]\s+([A-Za-z][\w-]+)\s*(?:—|--|:)\s*(.+)$/);
      if (m4) { agentName = m4[1]; role = m4[2]; }
    }

    // Pattern 5: Backtick-wrapped — - `agent-name` — role
    if (!agentName) {
      const m5 = line.match(/^[-*\d.)\s]+`([^`]+)`\s*(?:—|--|:|-)\s*(.+)$/);
      if (m5) { agentName = m5[1]; role = m5[2]; }
    }

    if (agentName) {
      const normalized = agentName.trim().toLowerCase().replace(/\s+/g, '-');
      if (normalized && role.trim() && !seen.has(normalized)) {
        seen.add(normalized);
        members.push({ agentName: normalized, role: role.trim() });
      }
    }
  }

  return members;
}

// ── Configurable upstream context ───────────────────────────────────────────

import {
  CONTEXT_CONFIG as DEFAULT_STAGE_CONTEXT,
  getContextConfigDefaults,
  getArticleContextOverrides,
  type StageContextEntry,
} from './context-config.js';

let _contextOverrides: Record<string, StageContextEntry> | undefined;

/** Load context config overrides from dataDir/config/pipeline-context.json if present. */
function loadContextConfig(config: AppConfig): Record<string, StageContextEntry> {
  if (_contextOverrides !== undefined) return _contextOverrides;

  const configPath = join(config.dataDir, 'config', 'pipeline-context.json');
  if (existsSync(configPath)) {
    try {
      const raw = readFileSync(configPath, 'utf-8');
      _contextOverrides = JSON.parse(raw) as Record<string, StageContextEntry>;
    } catch {
      _contextOverrides = {};
    }
  } else {
    _contextOverrides = {};
  }
  return _contextOverrides;
}

/** Reset cached overrides (for testing). */
export function resetContextConfigCache(): void {
  _contextOverrides = undefined;
}

/** Resolve the context config for an action, merging defaults with overrides. */
function getContextConfig(actionName: string, config: AppConfig): StageContextEntry {
  const overrides = loadContextConfig(config);
  const defaults = getContextConfigDefaults(config.contextPreset);
  return overrides[actionName] ?? defaults[actionName] ?? DEFAULT_STAGE_CONTEXT[actionName] ?? { primary: '', include: [] };
}

/**
 * Gather upstream context for an agent. Returns the primary artifact content
 * with any configured upstream artifacts prepended as labeled sections.
 */
function gatherContext(
  repo: Repository,
  articleId: string,
  actionName: string,
  config: AppConfig,
): string {
  const ctx = getContextConfig(actionName, config);
  const articleOverrides = getArticleContextOverrides(repo, articleId);
  const parts: string[] = [];

  // Resolve included artifacts (per-article overrides take precedence)
  let includeList = articleOverrides?.[actionName] ?? ctx.include;
  if (includeList.includes('*')) {
    // Include all existing artifacts except the primary
    const all = repo.artifacts.list(articleId);
    includeList = all
      .map(a => a.name)
      .filter(name => name !== ctx.primary);
  }

  for (const name of includeList) {
    const content = repo.artifacts.get(articleId, name);
    if (content) {
      parts.push(`## Upstream Context: ${name}\n${content}`);
    }
  }

  // Primary artifact last (most important, freshest context)
  const primary = readArtifact(repo, articleId, ctx.primary);
  if (parts.length > 0) {
    parts.push(`## Primary Input: ${ctx.primary}\n${primary}`);
    return parts.join('\n\n---\n\n');
  }

  return primary;
}

/** Exported for tests and dashboard UX. */
export function gatherUpstreamContextForAction(
  repo: Repository,
  articleId: string,
  actionName: string,
  config: AppConfig,
): string {
  return gatherContext(repo, articleId, actionName, config);
}

// ── Roster helpers ──────────────────────────────────────────────────────────

const PRODUCTION_AGENTS = new Set([
  'lead', 'writer', 'editor', 'scribe', 'coordinator', 'panel-moderator', 'publisher',
]);

const TEAM_ABBRS = new Set([
  'ari','atl','bal','buf','car','chi','cin','cle','dal','den','det','gb',
  'hou','ind','jax','kc','lac','lar','lv','mia','min','ne','no','nyg',
  'nyj','phi','pit','sea','sf','tb','ten','wsh',
]);

/** Build a categorized roster string from available agent charters. */
function buildAgentRoster(runner: AgentRunner): string {
  const agents = runner.listAgents();
  const specialists: string[] = [];
  const teamAgents: string[] = [];

  for (const name of agents) {
    if (PRODUCTION_AGENTS.has(name)) continue;

    const charter = runner.loadCharter(name);
    const identity = charter?.identity ?? '';
    const summary = identity.split('\n')[0]?.slice(0, 120) || name;

    if (TEAM_ABBRS.has(name)) {
      teamAgents.push(`- **${name.toUpperCase()}**: ${summary}`);
    } else {
      specialists.push(`- **${name}**: ${summary}`);
    }
  }

  return [
    '### Specialists',
    ...specialists,
    '',
    '### Team Agents',
    ...teamAgents,
  ].join('\n');
}

// ── Action implementations ──────────────────────────────────────────────────

/** Stage 1→2: Generate discussion prompt from idea. */
async function generatePrompt(articleId: string, ctx: ActionContext): Promise<ActionResult> {
  const start = Date.now();
  try {
    const article = ctx.repo.getArticle(articleId);
    if (!article) throw new Error(`Article '${articleId}' not found`);

    const team = article.primary_team;
    if (team) {
      ensureRosterContext(ctx.repo, articleId, team);
    }

    const ideaWithRoster = gatherContext(ctx.repo, articleId, 'generatePrompt', ctx.config);

    const result = await runAgent(ctx, articleId, article.current_stage, 'generatePrompt', {
      agentName: 'lead',
      task: 'Generate a discussion prompt from the following idea. Cross-reference player names and team assignments against the roster context provided. If the roster data shows a player on a different team, correct the premise. If a player is simply not found in the roster data, note it as a caveat — roster data updates daily and may lag behind very recent transactions.',
      skills: ['discussion-prompt'],
      articleContext: {
        slug: articleId,
        title: article.title,
        stage: article.current_stage,
        content: ideaWithRoster,
      },
    });

    writeAgentResult(ctx.repo, articleId, 'discussion-prompt.md', result);
    recordAgentUsage(ctx, articleId, article.current_stage, 'generatePrompt', result);
    return { success: true, duration: Date.now() - start };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
      duration: Date.now() - start,
    };
  }
}

/** Stage 2→3: Compose panel of analysts. */
async function composePanel(articleId: string, ctx: ActionContext): Promise<ActionResult> {
  const start = Date.now();
  try {
    const article = ctx.repo.getArticle(articleId);
    if (!article) throw new Error(`Article '${articleId}' not found`);

    const promptContent = gatherContext(ctx.repo, articleId, 'composePanel', ctx.config);

    const roster = buildAgentRoster(ctx.runner);
    const depthLevel = article.depth_level ?? 2;

    // Check for pinned agents
    const pinnedAgents = ctx.repo.getPinnedAgents(articleId);
    const pinnedSection = pinnedAgents.length > 0
      ? [
          '',
          '## Required Agents (must be included)',
          'The following agents have been pinned by the user and MUST appear on the panel:',
          ...pinnedAgents.map(a => `- **${a.agent_name}**${a.role ? ` — ${a.role}` : ''}`),
          '',
          'Include these agents first, then fill remaining slots from the roster.',
        ].join('\n')
      : '';

    const task = [
      'Select a panel of analysts for this discussion from the available roster.',
      '',
      `Depth Level: ${depthLevel} (${depthLevel === 1 ? '2 agents max' : depthLevel === 2 ? '3-4 agents' : '4-5 agents'})`,
      pinnedSection,
      '',
      '## Available Agents',
      roster,
      '',
      'Rules:',
      '- Always include the relevant team agent for the primary team',
      '- Always include at least one specialist',
      pinnedAgents.length > 0 ? '- Always include the required/pinned agents listed above' : '',
      '- Select agents whose expertise matches the article topic',
      '- Panel size must respect the depth level limits',
      '- Each panelist should have a distinct analytical lane',
      '',
      '⚠️ CRITICAL OUTPUT FORMAT: List each panelist as a markdown bullet with bold agent name, em-dash, and role. Example:',
      '- **sea** — Seattle Seahawks team analyst providing cap and roster context',
      '- **cap** — Salary cap specialist analyzing contract structures',
      'Use exactly this format. Do not use numbered lists or other formats.',
    ].filter(Boolean).join('\n');

    const result = await runAgent(ctx, articleId, article.current_stage, 'composePanel', {
      agentName: 'lead',
      task,
      skills: ['panel-composition'],
      articleContext: {
        slug: articleId,
        title: article.title,
        stage: article.current_stage,
        content: promptContent,
      },
    });

    writeAgentResult(ctx.repo, articleId, 'panel-composition.md', result);
    recordAgentUsage(ctx, articleId, article.current_stage, 'composePanel', result);
    return { success: true, duration: Date.now() - start };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
      duration: Date.now() - start,
    };
  }
}

/** Stage 3→4: Run panel discussion with parallel panelist execution. */
async function runDiscussion(articleId: string, ctx: ActionContext): Promise<ActionResult> {
  const start = Date.now();
  try {
    const article = ctx.repo.getArticle(articleId);
    if (!article) throw new Error(`Article '${articleId}' not found`);

    const prompt = readArtifact(ctx.repo, articleId, 'discussion-prompt.md');
    const panel = readArtifact(ctx.repo, articleId, 'panel-composition.md');

    // Inject roster context for panel discussion accuracy
    const rosterCtx = article.primary_team
      ? ensureRosterContext(ctx.repo, articleId, article.primary_team)
      : null;
    const discussionContext = gatherContext(ctx.repo, articleId, 'runDiscussion', ctx.config);

    // Try to parse individual panelists for parallel execution
    const panelists = parsePanelComposition(panel);

    if (panelists.length === 0) {
      // Fallback: single-moderator approach when composition can't be parsed
      console.warn(`[runDiscussion] Could not parse panel-composition.md for '${articleId}', falling back to single-moderator`);

      const result = await runAgent(ctx, articleId, article.current_stage, 'runDiscussion', {
        agentName: 'panel-moderator',
        task: 'Moderate the panel discussion and produce a summary.',
        skills: ['article-discussion'],
        rosterContext: rosterCtx ?? undefined,
        articleContext: {
          slug: articleId,
          title: article.title,
          stage: article.current_stage,
          content: discussionContext,
        },
      });

      writeAgentResult(ctx.repo, articleId, 'discussion-summary.md', result);
      recordAgentUsage(ctx, articleId, article.current_stage, 'runDiscussion', result);

      await generateArticleContract(articleId, ctx, {
        surface: 'runDiscussion-contract',
        discussionSummary: result.content,
      });

      return { success: true, duration: Date.now() - start };
    }

    // Run each panelist in parallel — each gets roster context in system prompt
    const panelResults = await Promise.all(
      panelists.map(async (panelist) => {
        try {
          const result = await runAgent(ctx, articleId, article.current_stage, `panel-${panelist.agentName}`, {
            agentName: panelist.agentName,
            task: `You are participating in a panel discussion.\n\nYour assigned lane: ${panelist.role}\n\nDiscussion context:\n${discussionContext}\n\nProvide your expert analysis from your specific perspective. Be direct, cite specific data points, and don't hedge. If you disagree with conventional wisdom, say so.`,
            rosterContext: rosterCtx ?? undefined,
            articleContext: {
              title: article.title,
              slug: articleId,
              stage: article.current_stage,
            },
          });
          return { panelist, result, error: null };
        } catch (err) {
          console.warn(`[runDiscussion] Panelist '${panelist.agentName}' failed: ${err instanceof Error ? err.message : String(err)}`);
          return { panelist, result: null, error: err };
        }
      })
    );

    // Collect successful results
    const successfulResults = panelResults.filter(r => r.result !== null);

    if (successfulResults.length === 0) {
      // All individual panelists failed (e.g., no charter files for LLM-generated names).
      // Fall back to single-moderator with the full panel context instead of throwing.
      console.warn(`[runDiscussion] All ${panelists.length} panelists failed for '${articleId}', falling back to single-moderator`);

      const fallbackResult = await runAgent(ctx, articleId, article.current_stage, 'runDiscussion-fallback', {
        agentName: 'panel-moderator',
        task: 'Moderate the panel discussion and produce a summary. Play each analyst role yourself and provide a comprehensive multi-perspective analysis.',
        skills: ['article-discussion'],
        rosterContext: rosterCtx ?? undefined,
        articleContext: {
          slug: articleId,
          title: article.title,
          stage: article.current_stage,
          content: discussionContext,
        },
      });

      writeAgentResult(ctx.repo, articleId, 'discussion-summary.md', fallbackResult);
      recordAgentUsage(ctx, articleId, article.current_stage, 'runDiscussion-fallback', fallbackResult);

      await generateArticleContract(articleId, ctx, {
        surface: 'runDiscussion-fallback-contract',
        discussionSummary: fallbackResult.content,
      });

      return { success: true, duration: Date.now() - start };
    }

    // Save individual panelist artifacts and record usage
    for (const { panelist, result } of successfulResults) {
      const artifactName = `panel-${panelist.agentName}.md`;
      writeAgentResult(ctx.repo, articleId, artifactName, result!);
      recordAgentUsage(ctx, articleId, article.current_stage, `panel-${panelist.agentName}`, result!);
    }

    // Build synthesis input from individual contributions
    const individualContributions = successfulResults
      .map(({ panelist, result }) =>
        `## ${panelist.agentName.toUpperCase()} — ${panelist.role}\n\n${result!.content}`)
      .join('\n\n---\n\n');

    // Synthesize via moderator
    const synthesisResult = await runAgent(ctx, articleId, article.current_stage, 'runDiscussion-synthesis', {
      agentName: 'panel-moderator',
      task: `Synthesize these panel contributions into a coherent discussion summary. Preserve disagreements and tension — don't smooth over conflicts.\n\n${individualContributions}`,
      skills: ['article-discussion'],
        rosterContext: rosterCtx ?? undefined,
        articleContext: {
          title: article.title,
          slug: articleId,
          stage: article.current_stage,
          content: discussionContext,
        },
      });

    writeAgentResult(ctx.repo, articleId, 'discussion-summary.md', synthesisResult);
    recordAgentUsage(ctx, articleId, article.current_stage, 'runDiscussion-synthesis', synthesisResult);

    await generateArticleContract(articleId, ctx, {
      surface: 'runDiscussion-contract',
      discussionSummary: synthesisResult.content,
    });

    return { success: true, duration: Date.now() - start };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
      duration: Date.now() - start,
    };
  }
}

/** Stage 4→5: Write article draft. */
async function writeDraft(articleId: string, ctx: ActionContext): Promise<ActionResult> {
  const start = Date.now();
  try {
    const article = ctx.repo.getArticle(articleId);
    if (!article) throw new Error(`Article '${articleId}' not found`);

    // Recovery path only: normal runs should already have a Stage 4 contract.
    const discussionSummary = ctx.repo.artifacts.get(articleId, 'discussion-summary.md');
    if (discussionSummary && !ctx.repo.artifacts.get(articleId, 'article-contract.md')) {
      console.warn(`[writeDraft] article-contract.md missing for '${articleId}' — generating as recovery`);
      await generateArticleContract(articleId, ctx, {
        surface: 'writeDraft-contract-recovery',
        discussionSummary,
        stage: 4 as Stage,
      });
    }

    // Ensure roster context is available for factcheck and writer
    const team = article.primary_team;
    let rosterCtx: string | null = null;
    if (team) {
      rosterCtx = ensureRosterContext(ctx.repo, articleId, team);
    }

    // Run lightweight fact-check on panel discussion output (if available)
    const discussionArtifact = ctx.repo.artifacts.get(articleId, 'discussion-summary.md');
    let factCheckCtxArtifact: string | null = ctx.repo.artifacts.get(articleId, 'fact-check-context.md');
    let contractClaims: string[] = [];
    const panelSourceArtifacts: WriterPreflightSourceArtifact[] = [];
    if (discussionArtifact) {
      // Extract verifiable claims and build nflverse fact-check context
      const panelTexts = [discussionArtifact];
      panelSourceArtifacts.push({ name: 'discussion-summary.md', content: discussionArtifact });
      // Also gather individual panel outputs for broader claim extraction
      const allArtifacts = ctx.repo.artifacts.list(articleId);
      for (const a of allArtifacts) {
        if (a.name.startsWith('panel-') && a.name !== 'panel-factcheck.md' && a.name !== 'panel-composition.md') {
          const content = ctx.repo.artifacts.get(articleId, a.name);
          if (content) {
            panelTexts.push(content);
            panelSourceArtifacts.push({ name: a.name, content });
          }
        }
      }
      const combinedPanelText = panelTexts.join('\n\n');
      const claims = extractClaims(combinedPanelText);
      contractClaims = claims.contractClaims.map(claim => claim.raw);

      // Build enriched fact-check context from nflverse if claims found
      if (totalClaimCount(claims) > 0) {
        const fctx = ensureFactCheckContext(ctx.repo, articleId, claims);
        if (fctx) factCheckCtxArtifact = fctx.raw;
      }

      const factcheckParts = [discussionArtifact];
      if (rosterCtx) factcheckParts.push(rosterCtx);
      if (factCheckCtxArtifact) factcheckParts.push(factCheckCtxArtifact);
      const factcheckContent = factcheckParts.join('\n\n---\n\n');

      const factCheckResult = await runAgent(ctx, articleId, article.current_stage, 'writeDraft-factcheck', {
        agentName: 'lead',
        task: 'Run a lightweight preflight fact-check on the panel discussion output. Focus on high-risk claims: contract figures, statistics, injury timelines, draft facts, and direct quotes. Flag contradictions between panelists. Cross-reference player-team assignments against the roster data provided. Use the nflverse verification data (if included below) to compare claimed statistics against actual data — flag any discrepancies. If a player is mentioned but not found in the roster, flag as ⚠️ CAUTION (the data updates daily — very recent transactions may not be reflected yet). Only flag as 🔴 ERROR if a player is clearly on a different team in the roster data or if statistics are provably wrong per nflverse data.',
        skills: ['fact-checking'],
        articleContext: {
          slug: articleId,
          title: article.title,
          stage: article.current_stage,
          content: factcheckContent,
        },
      });
      writeAgentResult(ctx.repo, articleId, 'panel-factcheck.md', factCheckResult);
      recordAgentUsage(ctx, articleId, article.current_stage, 'writeDraft-factcheck', factCheckResult);
      panelSourceArtifacts.push({ name: 'panel-factcheck.md', content: factCheckResult.content });
    }

    const editorReview = ctx.repo.artifacts.get(articleId, 'editor-review.md');
    const previousDraft = ctx.repo.artifacts.get(articleId, 'draft.md');
    const isRevision = editorReview != null;
    const existingWriterFactCheck = ctx.repo.artifacts.get(articleId, WRITER_FACTCHECK_ARTIFACT_NAME);
    const writerFactCheckReport = await executeWriterFactCheckPass({
      articleTitle: article.title,
      mode: isRevision ? 'revision' : 'fresh_draft',
      availableArtifacts: ctx.repo.artifacts.list(articleId).map((artifact) => artifact.name),
      existingArtifact: existingWriterFactCheck,
      factCheckContext: factCheckCtxArtifact,
      contractClaims,
      urlEvidence: extractUrlEvidence([
        { name: 'discussion-summary.md', content: discussionArtifact },
        { name: 'panel-factcheck.md', content: ctx.repo.artifacts.get(articleId, 'panel-factcheck.md') },
        { name: 'fact-check-context.md', content: factCheckCtxArtifact },
      ]),
    });
    ctx.repo.artifacts.put(
      articleId,
      WRITER_FACTCHECK_ARTIFACT_NAME,
      buildWriterFactCheckArtifact({
        articleTitle: article.title,
        mode: isRevision ? 'revision' : 'fresh_draft',
        availableArtifacts: ctx.repo.artifacts.list(articleId).map((artifact) => artifact.name),
        existingArtifact: existingWriterFactCheck,
        report: writerFactCheckReport,
      }),
    );
    recordWriterFactCheckUsage(ctx, articleId, article.current_stage, writerFactCheckReport);
    const writerFactCheckArtifact = ctx.repo.artifacts.get(articleId, WRITER_FACTCHECK_ARTIFACT_NAME);
    const writerPreflightSources: WriterPreflightSourceArtifact[] = [
      ...panelSourceArtifacts,
      { name: 'fact-check-context.md', content: factCheckCtxArtifact },
      { name: 'roster-context.md', content: rosterCtx },
      { name: WRITER_FACTCHECK_ARTIFACT_NAME, content: writerFactCheckArtifact },
    ];

    let content = gatherContext(ctx.repo, articleId, 'writeDraft', ctx.config);

    // On revision: inject the previous draft so the writer REVISES it rather than
    // rewriting from scratch. Without this, the writer only sees the panel discussion
    // and editor feedback but not its own prior output, causing identical rewrites.
    if (isRevision && previousDraft) {
      content = content + '\n\n## Previous Draft (REVISE this — do not start over)\n' + previousDraft;
    }

    // Shared handoff stays summary-only so the writer does not inherit raw cross-role transcript.
    const revisions = getRevisionHistory(ctx.repo, articleId);
    const conversationCtx = buildRevisionSummaryContext(revisions);

    // Keep the shared handoff compact, but always give the writer the latest full
    // editor-review artifact so revisions act on exact feedback instead of only the
    // summarized revision history. Guard against duplication when upstream context
    // already included editor-review.md.
    if (isRevision && editorReview && !content.includes(editorReview)) {
      content = content + '\n\n## Latest Editor Feedback (apply this directly)\n' + editorReview;
    }

    // If this is a revision and editor feedback exists, record it as a conversation turn
    // (only if not already recorded — check by looking for recent editor turns)
    if (isRevision && editorReview) {
      const recentEditorTurns = getArticleConversation(ctx.repo, articleId, {
        agentName: 'editor',
        limit: 1,
        newestFirst: true,
      });
      const lastEditorContent = recentEditorTurns.length > 0 ? recentEditorTurns[recentEditorTurns.length - 1].content : null;
      if (lastEditorContent !== editorReview) {
        addConversationTurn(ctx.repo, articleId, 6, 'editor', 'assistant', editorReview);
      }
    }

    const task = buildWriterTask(isRevision);

    const result = await runAgent(ctx, articleId, article.current_stage, 'writeDraft', {
      agentName: 'writer',
      task,
      skills: ['substack-article', WRITER_FACTCHECK_SKILL_NAME],
      conversationContext: conversationCtx || undefined,
      articleContext: {
        slug: articleId,
        title: article.title,
        stage: article.current_stage,
        content,
      },
    });

    writeAgentResult(ctx.repo, articleId, 'draft.md', result);
    recordAgentUsage(ctx, articleId, article.current_stage, 'writeDraft', result);

    // Record writer output as a conversation turn
    addConversationTurn(ctx.repo, articleId, article.current_stage, 'writer', 'assistant', result.content);

    let finalResult = result;
    let validation = validateDraftOutput(writerPreflightSources, finalResult.content ?? '');
    const initialPreflight = validation.preflight;

    // Self-heal: retry once when the writer misses the minimum draft contract.
    if (needsDraftRepair(validation)) {
      const repairReason = validation.wordCount < MIN_DRAFT_WORDS
        ? `draft only ${validation.wordCount} words`
        : !validation.structure.passed
          ? validation.structure.reason
          : validation.preflight.blockingIssues[0]?.message ?? 'writer preflight issue';
      console.warn(`[writeDraft] Draft validation failed for '${articleId}' (${repairReason}), retrying with targeted repair instruction`);
      const retryResult = await runAgent(ctx, articleId, article.current_stage, 'writeDraft-retry', {
        agentName: 'writer',
        task: buildDraftRepairInstruction(validation),
        skills: ['substack-article', WRITER_FACTCHECK_SKILL_NAME],
        conversationContext: conversationCtx || undefined,
        articleContext: {
          slug: articleId,
          title: article.title,
          stage: article.current_stage,
          content,
        },
      });
      writeAgentResult(ctx.repo, articleId, 'draft.md', retryResult);
      recordAgentUsage(ctx, articleId, article.current_stage, 'writeDraft-retry', retryResult);
      addConversationTurn(ctx.repo, articleId, article.current_stage, 'writer', 'assistant', retryResult.content);
      finalResult = retryResult;
      validation = validateDraftOutput(writerPreflightSources, finalResult.content ?? '');
    }

    writeArtifact(
      ctx.repo,
      articleId,
      WRITER_PREFLIGHT_ARTIFACT_NAME,
      buildWriterPreflightArtifact({
        initialState: initialPreflight,
        finalState: validation.preflight,
        repairTriggered: finalResult !== result,
      }),
    );

    if (needsDraftRepair(validation)) {
      return {
        success: false,
        error: `Writer draft failed validation after self-heal: ${
          validation.wordCount < MIN_DRAFT_WORDS
            ? `Draft has ${validation.wordCount} words (minimum ${MIN_DRAFT_WORDS})`
            : !validation.structure.passed
              ? validation.structure.reason
              : validation.preflight.blockingIssues[0]?.message ?? 'Writer preflight detected a blocking issue'
        }`,
        duration: Date.now() - start,
      };
    }

    return { success: true, duration: Date.now() - start };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
      duration: Date.now() - start,
    };
  }
}

/** Stage 5→6: Run editor review. */
async function runEditor(articleId: string, ctx: ActionContext): Promise<ActionResult> {
  const start = Date.now();
  try {
    const article = ctx.repo.getArticle(articleId);
    if (!article) throw new Error(`Article '${articleId}' not found`);

    let content = gatherContext(ctx.repo, articleId, 'runEditor', ctx.config);

    // Inject current roster data for fact-checking player-team assignments
    const team = article.primary_team;
    if (team) {
      const rosterCtx = ensureRosterContext(ctx.repo, articleId, team);
      if (rosterCtx) {
        content = content + '\n\n---\n\n' + rosterCtx;
      }
    }

    // Inject fact-check context if available (built during writeDraft stage)
    const factCheckArtifact = ctx.repo.artifacts.get(articleId, 'fact-check-context.md');
    if (factCheckArtifact) {
      content = content + '\n\n---\n\n' + factCheckArtifact;
    }

    // Editor gets compact shared handoff plus its own prior reviews, not the raw cross-role transcript.
    const revisions = getRevisionHistory(ctx.repo, articleId);
    const conversationCtx = buildRevisionSummaryContext(revisions);
    const editorTurns = getArticleConversation(ctx.repo, articleId, {
      agentName: 'editor',
      limit: MAX_EDITOR_PREVIOUS_REVIEWS,
      newestFirst: true,
    });
    const editorPreviousReviews = buildEditorPreviousReviews(editorTurns);
    const fullConversationCtx = [conversationCtx, editorPreviousReviews].filter(Boolean).join('\n\n---\n\n') || undefined;

    const result = await runAgent(ctx, articleId, article.current_stage, 'runEditor', {
      agentName: 'editor',
      task: `Review the article draft against the article contract and provide editorial feedback. The article contract defines the required thesis, tensions, evidence anchors, and structure expectations — use it as your evaluation rubric. Use the current roster context to verify player names and team assignments. If a player is listed on a DIFFERENT team in the roster data, flag as 🔴 ERROR. If a player is simply not found in the roster, flag as ⚠️ CAUTION — roster data updates daily and may lag behind reported transactions by 24-48 hours. Do not REJECT or REVISE solely because a recently reported signing/trade is not yet in the data. If \`writer-factcheck.md\` is present, treat it as an advisory Stage 5 ledger: reuse its verified/attributed/omitted claim notes, scrutinize anything it left unresolved, and do not treat it as final approval.\n\n⚠️ CRITICAL OUTPUT FORMAT: Your review MUST end with a ## Verdict section containing EXACTLY one of these words on its own line: APPROVED, REVISE, or REJECT. No other format is accepted. Example:\n\n## Verdict\nAPPROVED\n\n${EDITOR_REVISE_BLOCKER_TAG_GUIDANCE}`,
      skills: ['editor-review'],
      conversationContext: fullConversationCtx,
      articleContext: {
        slug: articleId,
        title: article.title,
        stage: article.current_stage,
        content,
      },
    });

    writeAgentResult(ctx.repo, articleId, 'editor-review.md', result);
    recordAgentUsage(ctx, articleId, article.current_stage, 'runEditor', result);

    // Record editor review as a conversation turn
    addConversationTurn(ctx.repo, articleId, article.current_stage, 'editor', 'assistant', result.content);

    // Extract semantic verdict from the editor review content
    let finalReviewContent = result.content;
    let verdict = extractVerdict(finalReviewContent);

    // Self-heal: if verdict is unparseable, retry once with stricter format instruction.
    // This prevents the pipeline from getting stuck at the 6→7 guard.
    if (!verdict) {
      console.warn(`[runEditor] No verdict found for '${articleId}', retrying with strict format`);
      const retryResult = await runAgent(ctx, articleId, article.current_stage, 'runEditor-retry', {
        agentName: 'editor',
        task: `Your previous review did not contain a parseable verdict. Based on the draft quality, respond with ONLY a verdict section. Do not re-review. Just provide:\n\n## Verdict\nAPPROVED\n\nor\n\n## Verdict\nREVISE\n\nChoose one based on the draft quality. If in doubt, choose APPROVED.`,
        skills: ['editor-review'],
        articleContext: {
          slug: articleId,
          title: article.title,
          stage: article.current_stage,
          content: finalReviewContent,
        },
      });
      // Append retry verdict to the existing review
      const combined = result.content + '\n\n---\n\n' + retryResult.content;
      writeAgentResult(ctx.repo, articleId, 'editor-review.md', { ...result, content: combined });
      recordAgentUsage(ctx, articleId, article.current_stage, 'runEditor-retry', retryResult);
      finalReviewContent = combined;
      verdict = extractVerdict(finalReviewContent);
    }

    // If editor returns REVISE, create a revision summary
    if (verdict === 'REVISE') {
      const blockerMetadata = extractRevisionBlockerMetadata(finalReviewContent);
      if (!blockerMetadata) {
        return {
          success: false,
          error: EDITOR_REVISE_BLOCKER_TAG_ERROR,
          duration: Date.now() - start,
        };
      }
      const iteration = getRevisionCount(ctx.repo, articleId) + 1;
      const feedbackPreview = finalReviewContent.slice(0, 300);
      addRevisionSummary(
        ctx.repo, articleId, iteration,
        article.current_stage, 4,  // editor → writer
        'editor', 'REVISE', null, feedbackPreview,
        blockerMetadata,
      );
    }

    return {
      success: true,
      duration: Date.now() - start,
      outcome: verdict ? verdict as ActionResult['outcome'] : undefined,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
      duration: Date.now() - start,
    };
  }
}

/** Stage 6→7: Run publisher pass. */
async function runPublisherPass(articleId: string, ctx: ActionContext): Promise<ActionResult> {
  const start = Date.now();
  try {
    const article = ctx.repo.getArticle(articleId);
    if (!article) throw new Error(`Article '${articleId}' not found`);

    const content = gatherContext(ctx.repo, articleId, 'runPublisherPass', ctx.config);

    // Inject roster context for publisher agent
    const rosterCtx = article.primary_team
      ? ensureRosterContext(ctx.repo, articleId, article.primary_team)
      : null;

    // Publisher only needs the shared handoff, not the raw editorial transcript.
    const revisions = getRevisionHistory(ctx.repo, articleId);
    const conversationCtx = buildRevisionSummaryContext(revisions) || undefined;

    const result = await runAgent(ctx, articleId, article.current_stage, 'runPublisherPass', {
      agentName: 'publisher',
      task: 'Run the publisher pass to prepare the article for publication.',
      skills: ['publisher'],
      rosterContext: rosterCtx ?? undefined,
      conversationContext: conversationCtx,
      articleContext: {
        slug: articleId,
        title: article.title,
        stage: article.current_stage,
        content,
      },
    });

    // Run deterministic pre-publish player mention validation
    if (article.primary_team) {
      const draftContent = ctx.repo.artifacts.get(articleId, 'draft.md');
      if (draftContent) {
        const mentions = validatePlayerMentions(draftContent, article.primary_team);
        const issues = mentions.filter(m => m.status !== 'confirmed');
        if (issues.length > 0) {
          const warnings = issues.map(m => {
            const icon = m.status === 'wrong_team' ? '🔴' : '⚠️';
            return `- ${icon} **${m.name}**: ${m.detail ?? m.status}`;
          }).join('\n');
          const validationArtifact = `## Pre-Publish Roster Validation\n\n${warnings}\n\n*${mentions.filter(m => m.status === 'confirmed').length} player names confirmed on roster.*`;
          ctx.repo.artifacts.put(articleId, 'roster-validation.md', validationArtifact);
        }

        // Run deterministic stat and draft claim validation
        const claims = extractClaims(draftContent);
        if (totalClaimCount(claims) > 0) {
          const statResults = validateStatClaims(claims);
          const draftResults = validateDraftClaims(claims);
          const report = buildValidationReport(statResults, draftResults);
          ctx.repo.artifacts.put(articleId, 'fact-validation.md', report);
        }
      }
    }

    writeAgentResult(ctx.repo, articleId, 'publisher-pass.md', result);
    recordAgentUsage(ctx, articleId, article.current_stage, 'runPublisherPass', result);

    // Record publisher output as a conversation turn
    addConversationTurn(ctx.repo, articleId, article.current_stage, 'publisher', 'assistant', result.content);

    // Ensure publisher_pass DB row exists for the interactive checklist UI.
    // The LLM's review goes into the artifact; the human ticks off checks.
    if (!ctx.repo.getPublisherPass(articleId)) {
      ctx.repo.recordPublisherPass(articleId);
    }

    return { success: true, duration: Date.now() - start };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
      duration: Date.now() - start,
    };
  }
}

/** Stage 7→8: Publish (no agent needed — handled externally). */
async function publish(articleId: string, ctx: ActionContext): Promise<ActionResult> {
  const start = Date.now();
  try {
    const article = ctx.repo.getArticle(articleId);
    if (!article) throw new Error(`Article '${articleId}' not found`);

    if (!article.substack_url) {
      return {
        success: false,
        error: 'substack_url not set — publish via dashboard first',
        duration: Date.now() - start,
      };
    }

    return { success: true, duration: Date.now() - start };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
      duration: Date.now() - start,
    };
  }
}

// ── Action registry ─────────────────────────────────────────────────────────

export const STAGE_ACTIONS: Record<string, StageAction> = {
  generatePrompt,
  composePanel,
  runDiscussion,
  writeDraft,
  runEditor,
  runPublisherPass,
  publish,
};

// ── Transition map (stage → action name) ────────────────────────────────────

const STAGE_ACTION_MAP: Partial<Record<Stage, string>> = {
  1: 'generatePrompt',
  2: 'composePanel',
  3: 'runDiscussion',
  4: 'writeDraft',
  5: 'runEditor',
  6: 'runPublisherPass',
  7: 'publish',
};

// ── Execute a full transition ───────────────────────────────────────────────

export async function executeTransition(
  articleId: string,
  fromStage: Stage,
  ctx: ActionContext,
): Promise<ActionResult> {
  const start = Date.now();
  const actionName = STAGE_ACTION_MAP[fromStage];

  if (!actionName) {
    return {
      success: false,
      error: `No action defined for stage ${fromStage} (${STAGE_NAMES[fromStage]})`,
      duration: Date.now() - start,
    };
  }

  const action = STAGE_ACTIONS[actionName];
  if (!action) {
    return {
      success: false,
      error: `Action '${actionName}' not found in STAGE_ACTIONS`,
      duration: Date.now() - start,
    };
  }

  // 1. Check guard
  const check = ctx.engine.canAdvance(articleId, fromStage);
  if (!check.allowed) {
    const result: ActionResult = {
      success: false,
      error: `Guard failed: ${check.reason}`,
      duration: Date.now() - start,
    };

    ctx.auditor.log({
      articleId,
      action: 'guard_check',
      fromStage,
      toStage: check.nextStage,
      trigger: 'auto',
      success: false,
      error: check.reason,
      duration: result.duration,
    });

    return result;
  }

  // 1b. Record stage run start
  let stageRunId: string | undefined;
  try {
    stageRunId = ctx.repo.startStageRun({
      articleId,
      stage: fromStage,
      surface: actionName,
      actor: actionName,
    });
  } catch {
    // Non-fatal — don't block the action if stage_run recording fails
  }

  // 2. Run the action
  const actionResult = await action(articleId, {
    ...ctx,
    currentStageRunId: stageRunId ?? null,
  });

  // 2b. Finish stage run
  if (stageRunId) {
    try {
      ctx.repo.finishStageRun(
        stageRunId,
        actionResult.success ? 'completed' : 'failed',
        actionResult.error ?? null,
        actionResult.artifactPath ?? null,
      );
    } catch {
      // Non-fatal
    }
  }

  if (!actionResult.success) {
    ctx.auditor.log({
      articleId,
      action: 'advance',
      fromStage,
      toStage: check.nextStage,
      trigger: 'auto',
      agent: actionName,
      success: false,
      error: actionResult.error,
      duration: actionResult.duration,
    });

    return actionResult;
  }

  // 3. Advance the stage
  try {
    ctx.engine.advance(articleId, fromStage, actionName);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: `Action succeeded but advance failed: ${msg}`,
      duration: Date.now() - start,
    };
  }

  // 4. Audit
  ctx.auditor.log({
    articleId,
    action: 'advance',
    fromStage,
    toStage: check.nextStage,
    trigger: 'auto',
    agent: actionName,
    success: true,
    duration: actionResult.duration,
    metadata: actionResult.artifactPath
      ? { artifactPath: actionResult.artifactPath }
      : undefined,
  });

  return actionResult;
}

// ── Auto-advance types ──────────────────────────────────────────────────────

export interface AutoAdvanceOptions {
  maxStage?: number;        // Default 7 (stop before publish)
  maxRevisions?: number;    // Default 3
  onStep?: (step: AutoAdvanceStep) => void;  // Callback for SSE events
  generateImages?: (articleId: string) => Promise<void>;  // Image gen hook
  repo?: Repository;        // Required when ctx is null (lightweight mode)
  engine?: PipelineEngine;  // Required when ctx is null (lightweight mode)
}

export interface AutoAdvanceStep {
  type: 'advance' | 'regress' | 'error' | 'working';
  from: number;
  to: number;
  action: string;
  duration?: number;
  error?: string;
}

export interface AutoAdvanceResult {
  steps: AutoAdvanceStep[];
  finalStage: number;
  error?: string;
  revisionCount: number;
}

// ── Auto-advance engine ─────────────────────────────────────────────────────

/**
 * Advance an article through the pipeline as far as possible.
 *
 * When an ActionContext is provided, runs the full agent-powered pipeline
 * (execute transition → write artifact → advance). Detects REVISE outcomes
 * via the `outcome` field on ActionResult and regresses to stage 4 for
 * re-drafting, up to `maxRevisions` times.
 *
 * When no ActionContext is provided (lightweight mode), only checks guards
 * and advances — no agent execution.
 */
export async function autoAdvanceArticle(
  articleId: string,
  ctx: ActionContext | null,
  options?: AutoAdvanceOptions,
): Promise<AutoAdvanceResult> {
  const maxStage = options?.maxStage ?? 7;
  const maxRevisions = options?.maxRevisions ?? 3;
  const onStep = options?.onStep;
  const generateImages = options?.generateImages;

  const repo = ctx?.repo ?? options?.repo ?? null;
  const engine = ctx?.engine ?? options?.engine ?? null;

  // We need at least a repo and engine; for lightweight mode they come from ctx or are passed in.
  // In lightweight mode (ctx === null), caller should use the overload that passes engine separately.
  if (!repo || !engine) {
    return { steps: [], finalStage: 0, error: 'No repository or engine available', revisionCount: 0 };
  }

  let revisionCount = 0;
  const steps: AutoAdvanceStep[] = [];
  let lastError: string | undefined;

  let current = repo.getArticle(articleId);
  if (!current) {
    return { steps: [], finalStage: 0, error: `Article '${articleId}' not found`, revisionCount: 0 };
  }

  while (current.current_stage < maxStage) {
    if (current.current_stage === 6 && current.status === 'needs_lead_review') {
      break;
    }

    if (ctx) {
      // Emit working status — use the action name for what's actually happening
      const actionLabel = STAGE_ACTION_MAP[current.current_stage as Stage] ?? 'processing';
      const nextStage = current.current_stage + 1;
      const nextStageName = STAGE_NAMES[nextStage as Stage] ?? `Stage ${nextStage}`;
      onStep?.({
        type: 'working',
        from: current.current_stage,
        to: nextStage,
        action: actionLabel,
      });

      // Full execution: run agent → write artifact → advance
      const result = await executeTransition(articleId, current.current_stage as Stage, ctx);
      if (!result.success) {
        lastError = result.error;

        onStep?.({
          type: 'error',
          from: current.current_stage,
          to: current.current_stage,
          action: `Stage ${current.current_stage} failed`,
          error: result.error,
          duration: result.duration,
        });

        // Handle REVISE/PIVOT: use semantic outcome field first, fall back to regex on error
        const isRevise =
          result.outcome === 'REVISE' ||
          ((current.current_stage === 5 || current.current_stage === 6) &&
            /REVISE|PIVOT|not APPROVED/i.test(result.error ?? ''));
        const isWriterStructureSendBack =
          current.current_stage === 5 &&
          /Draft structure:/i.test(result.error ?? '');

        if (current.current_stage === 6 && current.status === 'needs_lead_review') {
          break;
        }

        if (isRevise || isWriterStructureSendBack) {
          revisionCount++;
          if (revisionCount <= maxRevisions) {
            try {
              // Preserve editor feedback so the writer can address it on re-draft
              const editorFeedback = isWriterStructureSendBack
                ? buildWriterSendBackReview((result.error ?? '').replace(/^Guard failed:\s*/i, ''))
                : repo.artifacts.get(articleId, 'editor-review.md');
              const previousDraft = repo.artifacts.get(articleId, 'draft.md');

              engine.regress(articleId, current.current_stage as Stage, 4 as Stage, 'auto-advance', `Editor requested revisions (attempt ${revisionCount}/${maxRevisions})`);
              repo.clearArtifactsAfterStage(articleId, 4);

              // Restore editor review — writeDraft context includes editor-review.md
              if (editorFeedback) {
                repo.artifacts.put(articleId, 'editor-review.md', editorFeedback);
              }
              if (previousDraft) {
                repo.artifacts.put(articleId, 'draft.md', previousDraft);
              }

              const regressStep: AutoAdvanceStep = {
                type: 'regress',
                from: current.current_stage,
                to: 4,
                action: isWriterStructureSendBack
                  ? `Sent back to Stage 4 — Writer must repair required structure (attempt ${revisionCount}/${maxRevisions})`
                  : `Sent back to Stage 4 — Editor requested revisions (attempt ${revisionCount}/${maxRevisions})`,
                duration: result.duration,
              };
              steps.push(regressStep);
              onStep?.(regressStep);

              current = repo.getArticle(articleId)!;
              lastError = undefined; // Clear stale error — regression succeeded, retrying
              continue; // Retry from stage 4
            } catch { /* ignore regression failure, fall through to break */ }
          } else {
            // Max revisions exhausted — force-approve by overwriting editor review
            // so the pipeline can continue. The draft has been revised multiple times.
            const forceNote = `## Editor Review\n\n**Auto-approved after ${revisionCount} revision cycles.** The editor requested further changes, but the maximum revision limit has been reached. The draft has been iteratively improved and is being moved forward.\n\n## Verdict\nAPPROVED`;
            repo.artifacts.put(articleId, 'editor-review.md', forceNote);
            // Don't break — let the loop continue to advance through remaining stages
          }
        }
        break;
      }

      const updated = repo.getArticle(articleId)!;
      const advanceStep: AutoAdvanceStep = {
        type: 'advance',
        from: current.current_stage,
        to: updated.current_stage,
        action: `Advanced to Stage ${updated.current_stage} — ${STAGE_NAMES[updated.current_stage as Stage] ?? 'Unknown'}`,
        duration: result.duration,
      };
      steps.push(advanceStep);
      onStep?.(advanceStep);

      current = updated;

      // Handle REVISE outcome from a successful action (e.g., editor returned
      // REVISE but the action itself succeeded). Regress immediately instead of
      // letting the next stage's guard catch it.
      if (result.outcome === 'REVISE') {
        const escalation = maybeEscalateRepeatedRevisionBlocker(repo, articleId);
        if (escalation) {
          const leadReviewStep: AutoAdvanceStep = {
            type: 'working',
            from: current.current_stage,
            to: current.current_stage,
            action: escalation.action,
            duration: result.duration,
          };
          steps.push(leadReviewStep);
          onStep?.(leadReviewStep);
          current = repo.getArticle(articleId)!;
          break;
        }

        revisionCount++;
        if (revisionCount <= maxRevisions) {
          try {
            // Preserve editor feedback so the writer can address it on re-draft
            const editorFeedback = repo.artifacts.get(articleId, 'editor-review.md');
            const previousDraft = repo.artifacts.get(articleId, 'draft.md');

            engine.regress(articleId, current.current_stage as Stage, 4 as Stage, 'auto-advance', `Editor requested revisions (attempt ${revisionCount}/${maxRevisions})`);
            repo.clearArtifactsAfterStage(articleId, 4);

            // Restore editor review — writeDraft context includes editor-review.md
            if (editorFeedback) {
              repo.artifacts.put(articleId, 'editor-review.md', editorFeedback);
            }
            if (previousDraft) {
              repo.artifacts.put(articleId, 'draft.md', previousDraft);
            }

            const regressStep: AutoAdvanceStep = {
              type: 'regress',
              from: current.current_stage,
              to: 4,
              action: `Sent back to Stage 4 — Editor requested revisions (attempt ${revisionCount}/${maxRevisions})`,
              duration: result.duration,
            };
            steps.push(regressStep);
            onStep?.(regressStep);

            current = repo.getArticle(articleId)!;
            continue;
          } catch { /* fall through to normal loop */ }
        } else {
          // Max revisions exhausted — force-approve by overwriting editor review
          const forceNote = `## Editor Review\n\n**Auto-approved after ${revisionCount} revision cycles.** The editor requested further changes, but the maximum revision limit has been reached. The draft has been iteratively improved and is being moved forward.\n\n## Verdict\nAPPROVED`;
          repo.artifacts.put(articleId, 'editor-review.md', forceNote);
          // Continue the loop — next iteration will see APPROVED and advance normally
        }
      }

      // Auto-generate images after editor approves (stage 6+)
      // Placed here instead of stage 5 to avoid regenerating on every revision cycle.
      // Also fires at stage 7 as a safety net if images are missing (e.g. after restart).
      if (current.current_stage >= 6 && generateImages) {
        const hasImages = repo.artifacts.get(articleId, 'images.json');
        if (current.current_stage === 6 || !hasImages) {
          await generateImages(articleId);
        }
      }
    } else {
      // Lightweight mode (no agents): just check guards and advance
      const check = engine.canAdvance(articleId, current.current_stage as Stage);
      if (!check.allowed) {
        lastError = check.reason;
        break;
      }

      try {
        const newStage = engine.advance(articleId, current.current_stage as Stage, 'auto-advance');
        const advanceStep: AutoAdvanceStep = {
          type: 'advance',
          from: current.current_stage,
          to: newStage,
          action: `Advanced to Stage ${newStage} — ${STAGE_NAMES[newStage]}`,
        };
        steps.push(advanceStep);
        onStep?.(advanceStep);

        current = repo.getArticle(articleId)!;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        break;
      }
    }
  }

  current = repo.getArticle(articleId)!;
  if (current.current_stage >= 7) {
    recordPostRevisionRetrospectiveIfEligible(repo, articleId);
  }
  return {
    steps,
    finalStage: current.current_stage,
    error: lastError,
    revisionCount,
  };
}
