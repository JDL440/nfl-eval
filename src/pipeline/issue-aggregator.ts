/**
 * issue-aggregator.ts — Collects all pre-publish issues from pipeline artifacts
 * and DB records into a unified list for the publish page issue tracker.
 */

import type { Repository } from '../db/repository.js';

// ── Types ───────────────────────────────────────────────────────────────────

export type IssueSeverity = 'error' | 'warning' | 'info';
export type IssueSource =
  | 'writer-preflight'
  | 'roster-validation'
  | 'fact-validation'
  | 'pipeline-history'
  | 'editor-review';

export interface PublishIssue {
  id: string;
  severity: IssueSeverity;
  source: IssueSource;
  category: string;
  message: string;
}

// ── Public API ──────────────────────────────────────────────────────────────

export function aggregatePublishIssues(repo: Repository, articleId: string): PublishIssue[] {
  const issues: PublishIssue[] = [];

  issues.push(...parsePreflightArtifact(repo, articleId));
  issues.push(...parseRosterValidation(repo, articleId));
  issues.push(...parseFactValidation(repo, articleId));
  issues.push(...getPipelineHistoryIssues(repo, articleId));

  return issues;
}

// ── Writer preflight advisory issues ────────────────────────────────────────

function parsePreflightArtifact(repo: Repository, articleId: string): PublishIssue[] {
  const content = repo.artifacts.get(articleId, 'writer-preflight.md');
  if (!content) return [];

  const issues: PublishIssue[] = [];
  const advisorySection = extractSection(content, 'Advisory Issues');
  if (advisorySection) {
    for (const line of advisorySection.split('\n')) {
      const match = line.match(/^- \[([^\]]+)\]\s*(.+)/);
      if (match) {
        issues.push({
          id: `preflight-${issues.length}`,
          severity: 'warning',
          source: 'writer-preflight',
          category: formatCode(match[1]!),
          message: match[2]!.trim(),
        });
      }
    }
  }

  const blockingSection = extractSection(content, 'Final Blocking Issues');
  if (blockingSection) {
    for (const line of blockingSection.split('\n')) {
      const match = line.match(/^- \[([^\]]+)\]\s*(.+)/);
      if (match) {
        issues.push({
          id: `preflight-block-${issues.length}`,
          severity: 'error',
          source: 'writer-preflight',
          category: formatCode(match[1]!),
          message: match[2]!.trim(),
        });
      }
    }
  }

  return issues;
}

// ── Roster validation ───────────────────────────────────────────────────────

function parseRosterValidation(repo: Repository, articleId: string): PublishIssue[] {
  const content = repo.artifacts.get(articleId, 'roster-validation.md');
  if (!content) return [];

  const issues: PublishIssue[] = [];
  for (const line of content.split('\n')) {
    const match = line.match(/^- (🔴|⚠️)\s*\*\*(.+?)\*\*:\s*(.+)/);
    if (match) {
      const severity: IssueSeverity = match[1] === '🔴' ? 'error' : 'warning';
      issues.push({
        id: `roster-${issues.length}`,
        severity,
        source: 'roster-validation',
        category: 'Player Mention',
        message: `${match[2]}: ${match[3]!.trim()}`,
      });
    }
  }
  return issues;
}

// ── Fact validation ─────────────────────────────────────────────────────────

function parseFactValidation(repo: Repository, articleId: string): PublishIssue[] {
  const content = repo.artifacts.get(articleId, 'fact-validation.md');
  if (!content) return [];

  const issues: PublishIssue[] = [];
  for (const line of content.split('\n')) {
    const match = line.match(/^- ❌\s*(.+)/);
    if (match) {
      issues.push({
        id: `fact-${issues.length}`,
        severity: 'warning',
        source: 'fact-validation',
        category: 'Fact Check',
        message: match[1]!.trim(),
      });
    }
  }
  return issues;
}

// ── Pipeline history ────────────────────────────────────────────────────────

function getPipelineHistoryIssues(repo: Repository, articleId: string): PublishIssue[] {
  const issues: PublishIssue[] = [];

  // Check for failed stage runs
  const stageRuns = repo.getStageRuns(articleId);
  const failedRuns = stageRuns.filter((r) => r.status === 'failed');
  if (failedRuns.length > 0) {
    issues.push({
      id: 'history-failed-runs',
      severity: 'info',
      source: 'pipeline-history',
      category: 'Pipeline',
      message: `${failedRuns.length} stage run(s) failed during production. Check traces for details.`,
    });
  }

  // Check for editor revision cycles
  const editorReviews = repo.getEditorReviews(articleId);
  const reviseCount = editorReviews.filter((r) => r.verdict === 'REVISE').length;
  if (reviseCount > 0) {
    issues.push({
      id: 'history-revisions',
      severity: reviseCount >= 3 ? 'warning' : 'info',
      source: 'editor-review',
      category: 'Editor Review',
      message: `Article went through ${reviseCount} editor revision cycle(s).`,
    });
  }

  // Check for force-approval
  const retros = repo.getArticleRetrospectives(articleId);
  const forceApproved = retros.some((r) => r.force_approved_after_max_revisions);
  if (forceApproved) {
    issues.push({
      id: 'history-force-approved',
      severity: 'warning',
      source: 'pipeline-history',
      category: 'Force Approved',
      message: 'Article was force-approved after reaching the maximum revision limit. Review editor feedback carefully.',
    });
  }

  return issues;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function extractSection(markdown: string, heading: string): string | null {
  const pattern = new RegExp(`^##\\s+${escapeRegex(heading)}[^\\n]*\\n`, 'im');
  const match = markdown.match(pattern);
  if (!match || match.index == null) return null;

  const start = match.index + match[0].length;
  const nextHeading = markdown.indexOf('\n## ', start);
  return nextHeading === -1 ? markdown.slice(start) : markdown.slice(start, nextHeading);
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function formatCode(code: string): string {
  return code.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
