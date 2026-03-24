// Stage constants
export const VALID_STAGES = [1, 2, 3, 4, 5, 6, 7, 8] as const;
export type Stage = typeof VALID_STAGES[number];

export const STAGE_NAMES: Record<Stage, string> = {
  1: 'Idea Generation',
  2: 'Discussion Prompt',
  3: 'Panel Composition',
  4: 'Panel Discussion',
  5: 'Article Drafting',
  6: 'Editor Pass',
  7: 'Publisher Pass',
  8: 'Published',
};

export type ArticleStatus = 'proposed' | 'approved' | 'in_production' | 'in_discussion' | 'published' | 'archived' | 'revision' | 'needs_lead_review';
export type EditorVerdict = 'APPROVED' | 'REVISE' | 'REJECT';
export type RunStatus = 'started' | 'completed' | 'failed' | 'cancelled' | 'interrupted';
export type UsageEventType = 'planned' | 'started' | 'completed' | 'updated' | 'failed' | 'skipped' | 'stage_transition';
export type DepthLevel = 1 | 2 | 3 | 4;
export type DepthName = 'casual_fan' | 'the_beat' | 'deep_dive';

// Depth level 4 is a "Feature" in the dashboard UI, but maps to deep_dive for pipeline sizing/policy.
export const DEPTH_LEVEL_MAP: Record<DepthLevel, DepthName> = {
  1: 'casual_fan',
  2: 'the_beat',
  3: 'deep_dive',
  4: 'deep_dive',
};

export interface Article {
  id: string;
  title: string;
  subtitle: string | null;
  primary_team: string | null;
  teams: string | null;
  league: string;
  status: ArticleStatus;
  current_stage: Stage;
  discussion_path: string | null;
  article_path: string | null;
  substack_draft_url: string | null;
  substack_url: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  depth_level: DepthLevel;
  target_publish_date: string | null;
  publish_window: string | null;
  time_sensitive: number;
  expires_at: string | null;
}

export interface StageTransition {
  id: number;
  article_id: string;
  from_stage: Stage | null;
  to_stage: Stage;
  agent: string | null;
  notes: string | null;
  transitioned_at: string;
}

export interface EditorReview {
  id: number;
  article_id: string;
  verdict: EditorVerdict;
  error_count: number;
  suggestion_count: number;
  note_count: number;
  review_number: number;
  reviewed_at: string;
}

export interface PublisherPass {
  article_id: string;
  title_final: number;
  subtitle_final: number;
  body_clean: number;
  section_assigned: number;
  tags_set: number;
  url_slug_set: number;
  cover_image_set: number;
  paywall_set: number;
  publish_datetime: string | null;
  email_send: number;
  names_verified: number;
  numbers_current: number;
  no_stale_refs: number;
}

export interface ArticleRetrospective {
  id: number;
  article_id: string;
  completion_stage: number;
  revision_count: number;
  force_approved_after_max_revisions: number;
  participant_roles: string;
  overall_summary: string;
  artifact_name: string | null;
  generated_at: string;
  updated_at: string;
}

export interface ArticleRetrospectiveFinding {
  id: number;
  retrospective_id: number;
  article_id: string;
  role: string;
  finding_type: string;
  finding_text: string;
  source_iteration: number | null;
  priority: string | null;
}

export interface RetrospectiveDigestFindingRow {
  retrospective_id: number;
  finding_id: number;
  article_id: string;
  article_title: string;
  article_primary_team: string | null;
  article_league: string;
  completion_stage: number;
  revision_count: number;
  force_approved_after_max_revisions: number;
  participant_roles: string;
  overall_summary: string;
  artifact_name: string | null;
  generated_at: string;
  updated_at: string;
  role: string;
  finding_type: string;
  finding_text: string;
  source_iteration: number | null;
  priority: string | null;
}

export interface RetrospectiveDigestPriorityCounts {
  high: number;
  medium: number;
  low: number;
  unknown: number;
}

export interface RetrospectiveDigestArticleEvidence {
  articleId: string;
  title: string;
  generatedAt: string;
  revisionCount: number;
  priority: string | null;
  forceApprovedAfterMaxRevisions: boolean;
}

export interface RetrospectiveDigestCandidateEvidence {
  articleCount: number;
  findingCount: number;
  priorityCounts: RetrospectiveDigestPriorityCounts;
  forceApprovedArticleCount: number;
  latestGeneratedAt: string;
  sampleArticles: RetrospectiveDigestArticleEvidence[];
}

export type RetrospectiveDigestCandidateKind = 'process_improvement' | 'learning_update';

export interface RetrospectiveDigestCandidate {
  key: string;
  kind: RetrospectiveDigestCandidateKind;
  role: string;
  findingType: string;
  normalizedText: string;
  text: string;
  promotionReasons: string[];
  evidence: RetrospectiveDigestCandidateEvidence;
}

export interface RetrospectiveDigestCategory {
  role: string;
  findingType: string;
  items: RetrospectiveDigestCandidate[];
}

export interface RetrospectiveDigestReport {
  generatedAt: string;
  retrospectiveLimit: number;
  totals: {
    retrospectives: number;
    findings: number;
    groupedFindings: number;
    articles: number;
  };
  candidates: {
    processImprovements: RetrospectiveDigestCandidate[];
    learningUpdates: RetrospectiveDigestCandidate[];
  };
  categories: RetrospectiveDigestCategory[];
}

// ── Validation constant arrays ───────────────────────────────────────────────

export const VALID_STATUSES: readonly ArticleStatus[] = [
  'proposed', 'approved', 'in_production', 'in_discussion', 'published', 'archived', 'revision', 'needs_lead_review',
] as const;

export const VALID_VERDICTS: readonly EditorVerdict[] = [
  'APPROVED', 'REVISE', 'REJECT',
] as const;

export const VALID_RUN_STATUSES: readonly RunStatus[] = [
  'started', 'completed', 'failed', 'cancelled', 'interrupted',
] as const;

export const VALID_USAGE_EVENT_TYPES: readonly UsageEventType[] = [
  'planned', 'started', 'completed', 'updated', 'failed', 'skipped', 'stage_transition',
] as const;

export type NoteType = 'promotion' | 'follow_up' | 'standalone';
export const VALID_NOTE_TYPES: readonly NoteType[] = ['promotion', 'follow_up', 'standalone'] as const;

export type NoteTarget = 'prod' | 'stage';
export const VALID_NOTE_TARGETS: readonly NoteTarget[] = ['prod', 'stage'] as const;

// ── Row shapes (run/event/note) ──────────────────────────────────────────────

export interface ArticleRun {
  id: string;
  article_id: string;
  trigger: string | null;
  initiated_by: string | null;
  status: RunStatus;
  notes: string | null;
  started_at: string;
  completed_at: string | null;
}

export interface StageRun {
  id: string;
  run_id: string | null;
  article_id: string;
  stage: number;
  surface: string;
  actor: string | null;
  requested_model: string | null;
  requested_model_tier: string | null;
  precedence_rank: number | null;
  output_budget_tokens: number | null;
  status: RunStatus;
  notes: string | null;
  artifact_path: string | null;
  started_at: string;
  completed_at: string | null;
}

export interface UsageEvent {
  id: number;
  run_id: string | null;
  stage_run_id: string | null;
  article_id: string;
  stage: number | null;
  surface: string;
  provider: string | null;
  actor: string | null;
  event_type: UsageEventType;
  model_or_tool: string | null;
  model_tier: string | null;
  precedence_rank: number | null;
  request_count: number | null;
  quantity: number | null;
  unit: string | null;
  prompt_tokens: number | null;
  output_tokens: number | null;
  cached_tokens: number | null;
  premium_requests: number | null;
  image_count: number | null;
  cost_usd_estimate: number | null;
  metadata_json: string | null;
  created_at: string;
}

export interface Note {
  id: number;
  article_id: string | null;
  note_type: NoteType;
  content: string;
  image_path: string | null;
  substack_note_url: string | null;
  target: NoteTarget;
  created_by: string | null;
  created_at: string;
}

export type WriterFactCheckMode = 'fresh_draft' | 'revision';
export type WriterFactCheckSourceClass = 'local_runtime' | 'official_primary' | 'trusted_reference';
export type WriterFactCheckVolatileFactsRule = 'attribute_soften_or_omit';

export interface WriterFactCheckBudget {
  localDeterministicPasses: number;
  externalChecks: number;
  wallClockMinutes: number;
}

export interface WriterFactCheckPolicy {
  artifactName: string;
  riskyClaimsOnly: boolean;
  rawWebSearchAllowed: boolean;
  editorRemainsFinalAuthority: boolean;
  volatileFactsRule: WriterFactCheckVolatileFactsRule;
  approvedSourceOrder: WriterFactCheckSourceClass[];
  freshDraft: WriterFactCheckBudget;
  revision: WriterFactCheckBudget;
}

export type WriterFactCheckOutcomeStatus = 'verified' | 'attributed' | 'omitted';

export interface WriterFactCheckEntry {
  claim: string;
  status: WriterFactCheckOutcomeStatus;
  sourceClass: WriterFactCheckSourceClass | null;
  sourceLabel: string | null;
  sourceUrl: string | null;
  domain: string | null;
  note: string | null;
  proseTreatment: string | null;
  asOf: string | null;
}

export interface WriterFactCheckUsage {
  localDeterministicPassesUsed: number;
  externalChecksUsed: number;
  wallClockMs: number;
  domainsTouched: string[];
  remainingStatus: 'unspent' | 'available' | 'exhausted';
  claimCount: number;
  blockedSourceCount: number;
  fetchFailureCount: number;
}

export interface WriterFactCheckReport {
  verifiedFacts: WriterFactCheckEntry[];
  attributedFacts: WriterFactCheckEntry[];
  omittedClaims: WriterFactCheckEntry[];
  usage: WriterFactCheckUsage;
}

// ── Inference helpers ────────────────────────────────────────────────────────

export interface StageInference {
  stage: Stage;
  stage_name: string;
  next_action: string | null;
  editor_verdict: EditorVerdict | null;
  detail: string;
}

export interface ResolvedModel {
  selected_model: string;
  candidates: string[];
  tier: string | null;
  precedence_rank: number | null;
  task_family: string | null;
  stage_key: string | null;
  stage_model_key: string | null;
  output_budget_tokens: number | null;
  override_applied: boolean;
}
