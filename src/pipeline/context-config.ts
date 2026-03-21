/**
 * context-config.ts — Per-article upstream context configuration.
 *
 * Overrides are stored as an artifact on each article: _config.json
 * Structure: { [stageActionName]: string[] }
 */

import type { Repository } from '../db/repository.js';

export const CONTEXT_CONFIG_ARTIFACT = '_config.json';

/** Per-action context configuration (primary artifact + optional upstream includes). */
export interface StageContextEntry {
  primary: string;
  include: string[];
}

/**
 * Default context config — smart defaults that balance quality vs token cost.
 *
 * NOTE: UI treats this as the source of truth for default upstream include lists.
 */
export const CONTEXT_CONFIG: Record<string, StageContextEntry> = {
  generatePrompt:   { primary: 'idea.md',               include: [] },
  composePanel:     { primary: 'discussion-prompt.md',  include: ['idea.md'] },
  runDiscussion:    { primary: 'discussion-prompt.md',  include: [] },  // panel-composition injected separately
  writeDraft:       { primary: 'discussion-summary.md', include: ['idea.md', 'editor-review.md', 'panel-factcheck.md'] },
  runEditor:        { primary: 'draft.md',              include: ['idea.md', 'discussion-summary.md'] },
  runPublisherPass: { primary: 'draft.md',              include: ['editor-review.md'] },
};

export type ArticleContextOverrides = Record<string, string[]>;

export function parseArticleContextOverrides(raw: string | null): ArticleContextOverrides | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) return null;

    const out: ArticleContextOverrides = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof k !== 'string') continue;
      if (!Array.isArray(v)) continue;
      const cleaned = v
        .filter(x => typeof x === 'string')
        .map(x => x.trim())
        .filter(Boolean);
      out[k] = cleaned;
    }
    return out;
  } catch {
    return null;
  }
}

export function getArticleContextOverrides(repo: Repository, articleId: string): ArticleContextOverrides | null {
  return parseArticleContextOverrides(repo.artifacts.get(articleId, CONTEXT_CONFIG_ARTIFACT));
}

export function saveArticleContextOverrides(repo: Repository, articleId: string, overrides: ArticleContextOverrides): void {
  repo.artifacts.put(articleId, CONTEXT_CONFIG_ARTIFACT, JSON.stringify(overrides, null, 2));
}

export function deleteArticleContextOverrides(repo: Repository, articleId: string): void {
  repo.artifacts.delete(articleId, CONTEXT_CONFIG_ARTIFACT);
}
