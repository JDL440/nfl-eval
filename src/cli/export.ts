/**
 * export.ts — Export article artifacts to a local directory.
 */
import { resolve, join } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { Repository } from '../db/repository.js';
import { ARTIFACT_FILES } from '../dashboard/views/article.js';

export interface ExportOptions {
  articleId: string;
  outputDir: string;
  dbPath: string;
}

export function exportArticle(options: ExportOptions): { exported: string[]; skipped: string[] } {
  const { articleId, outputDir, dbPath } = options;

  const repo = new Repository(dbPath);
  try {
    const article = repo.getArticle(articleId);
    if (!article) throw new Error(`Article not found: ${articleId}`);

    const dir = resolve(outputDir);
    mkdirSync(dir, { recursive: true });

    // Export metadata
    const metadata = {
      id: article.id,
      title: article.title,
      subtitle: article.subtitle,
      primary_team: article.primary_team,
      teams: article.teams,
      current_stage: article.current_stage,
      status: article.status,
      depth_level: article.depth_level,
      created_at: article.created_at,
      updated_at: article.updated_at,
      published_at: article.published_at,
      substack_url: article.substack_url,
      substack_draft_url: article.substack_draft_url,
    };
    writeFileSync(join(dir, 'metadata.json'), JSON.stringify(metadata, null, 2));

    const exported: string[] = ['metadata.json'];
    const skipped: string[] = [];

    // Export each artifact
    for (const name of ARTIFACT_FILES) {
      const content = repo.artifacts.get(articleId, name);
      if (content != null) {
        writeFileSync(join(dir, name), content);
        exported.push(name);
      } else {
        skipped.push(name);
      }
    }

    // Export editor reviews
    const reviews = repo.getEditorReviews(articleId);
    if (reviews.length > 0) {
      writeFileSync(join(dir, 'editor-reviews.json'), JSON.stringify(reviews, null, 2));
      exported.push('editor-reviews.json');
    }

    // Export publisher pass
    const publisherPass = repo.getPublisherPass(articleId);
    if (publisherPass) {
      writeFileSync(join(dir, 'publisher-pass.json'), JSON.stringify(publisherPass, null, 2));
      exported.push('publisher-pass.json');
    }

    // Export stage transitions
    const transitions = repo.getStageTransitions(articleId);
    if (transitions.length > 0) {
      writeFileSync(join(dir, 'stage-transitions.json'), JSON.stringify(transitions, null, 2));
      exported.push('stage-transitions.json');
    }

    return { exported, skipped };
  } finally {
    repo.close();
  }
}
