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
export type ReaderProfile = 'casual' | 'engaged' | 'hardcore';
export type ArticleForm = 'brief' | 'standard' | 'deep' | 'feature';
export type PanelShape =
  | 'auto'
  | 'news_reaction'
  | 'contract_eval'
  | 'trade_eval'
  | 'draft_eval'
  | 'scheme_breakdown'
  | 'cohort_rank'
  | 'market_map';
export type AnalyticsMode = 'explain_only' | 'normal' | 'metrics_forward';
export type EditorialPresetId =
  | 'casual_explainer'
  | 'beat_analysis'
  | 'technical_deep_dive'
  | 'narrative_feature';
export type ScopeMode = 'single_team' | 'multi_team' | 'cohort';
export type ArticleScheduleContentProfile = 'accessible' | 'deep_dive';

export interface PanelConstraints {
  min_agents?: number;
  max_agents?: number;
  required_agents?: string[];
  excluded_agents?: string[];
  allow_team_agent_omission?: boolean;
  scope_mode?: ScopeMode;
}

export interface EditorialPresetDefinition {
  id: EditorialPresetId;
  label: string;
  description: string;
  reader_profile: ReaderProfile;
  article_form: ArticleForm;
  panel_shape: PanelShape;
  analytics_mode: AnalyticsMode;
}

export interface EditorialControls {
  preset_id: EditorialPresetId;
  reader_profile: ReaderProfile;
  article_form: ArticleForm;
  panel_shape: PanelShape;
  analytics_mode: AnalyticsMode;
  panel_constraints_json: string | null;
}

export interface ResolvedEditorialControls extends EditorialControls {
  panel_constraints: PanelConstraints | null;
  legacy_depth_level: DepthLevel;
  legacy_content_profile: ArticleScheduleContentProfile;
}

// Depth level 4 is a "Feature" in the dashboard UI, but maps to deep_dive for pipeline sizing/policy.
export const DEPTH_LEVEL_MAP: Record<DepthLevel, DepthName> = {
  1: 'casual_fan',
  2: 'the_beat',
  3: 'deep_dive',
  4: 'deep_dive',
};

export const EDITORIAL_PRESET_ORDER: EditorialPresetId[] = [
  'casual_explainer',
  'beat_analysis',
  'technical_deep_dive',
  'narrative_feature',
];

export const EDITORIAL_PRESETS: Record<EditorialPresetId, EditorialPresetDefinition> = {
  casual_explainer: {
    id: 'casual_explainer',
    label: 'Casual Explainer',
    description: 'Approachable fan-facing article with light jargon and clean framing.',
    reader_profile: 'casual',
    article_form: 'brief',
    panel_shape: 'news_reaction',
    analytics_mode: 'explain_only',
  },
  beat_analysis: {
    id: 'beat_analysis',
    label: 'Beat Analysis',
    description: 'Default single-team analysis for engaged readers.',
    reader_profile: 'engaged',
    article_form: 'standard',
    panel_shape: 'auto',
    analytics_mode: 'normal',
  },
  technical_deep_dive: {
    id: 'technical_deep_dive',
    label: 'Technical Deep Dive',
    description: 'Deeper evidence-heavy analysis for highly engaged readers.',
    reader_profile: 'hardcore',
    article_form: 'deep',
    panel_shape: 'auto',
    analytics_mode: 'metrics_forward',
  },
  narrative_feature: {
    id: 'narrative_feature',
    label: 'Narrative Feature',
    description: 'Longer-form storytelling with strong reporting structure, not necessarily metrics-heavy.',
    reader_profile: 'engaged',
    article_form: 'feature',
    panel_shape: 'auto',
    analytics_mode: 'normal',
  },
};

export const PANEL_SHAPE_LABELS: Record<PanelShape, string> = {
  auto: 'Auto',
  news_reaction: 'News reaction',
  contract_eval: 'Contract evaluation',
  trade_eval: 'Trade evaluation',
  draft_eval: 'Draft evaluation',
  scheme_breakdown: 'Scheme breakdown',
  cohort_rank: 'Cohort / comparison',
  market_map: 'Market map',
};

export const ANALYTICS_MODE_LABELS: Record<AnalyticsMode, string> = {
  explain_only: 'Explain-only',
  normal: 'Normal',
  metrics_forward: 'Metrics-forward',
};

export const READER_PROFILE_LABELS: Record<ReaderProfile, string> = {
  casual: 'Casual',
  engaged: 'Engaged',
  hardcore: 'Hardcore',
};

export const ARTICLE_FORM_LABELS: Record<ArticleForm, string> = {
  brief: 'Brief',
  standard: 'Standard',
  deep: 'Deep',
  feature: 'Feature',
};

export function parsePanelConstraintsJson(value: string | null | undefined): PanelConstraints | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('panel_constraints_json must decode to an object');
    }
    return parsed as PanelConstraints;
  } catch (err) {
    throw new Error(
      `Invalid panel_constraints_json: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export function stringifyPanelConstraints(value: PanelConstraints | null | undefined): string | null {
  if (!value) return null;
  const cleaned: PanelConstraints = {};
  if (value.min_agents != null) cleaned.min_agents = value.min_agents;
  if (value.max_agents != null) cleaned.max_agents = value.max_agents;
  if (value.required_agents && value.required_agents.length > 0) cleaned.required_agents = value.required_agents;
  if (value.excluded_agents && value.excluded_agents.length > 0) cleaned.excluded_agents = value.excluded_agents;
  if (value.allow_team_agent_omission != null) cleaned.allow_team_agent_omission = value.allow_team_agent_omission;
  if (value.scope_mode) cleaned.scope_mode = value.scope_mode;
  return Object.keys(cleaned).length > 0 ? JSON.stringify(cleaned) : null;
}

export function deriveDepthLevelFromArticleForm(articleForm: ArticleForm): DepthLevel {
  switch (articleForm) {
    case 'brief':
      return 1;
    case 'standard':
      return 2;
    case 'deep':
      return 3;
    case 'feature':
      return 4;
  }
}

export function deriveContentProfileFromControls(
  readerProfile: ReaderProfile,
  analyticsMode: AnalyticsMode,
): ArticleScheduleContentProfile {
  return readerProfile === 'casual' || analyticsMode === 'explain_only'
    ? 'accessible'
    : 'deep_dive';
}

function presetFromLegacy(depthLevel: DepthLevel, contentProfile?: ArticleScheduleContentProfile | null): EditorialPresetId {
  if (depthLevel === 4) return 'narrative_feature';
  if (depthLevel >= 3) return contentProfile === 'accessible' ? 'beat_analysis' : 'technical_deep_dive';
  if (depthLevel === 1) return 'casual_explainer';
  return contentProfile === 'deep_dive' ? 'technical_deep_dive' : 'beat_analysis';
}

export function resolveEditorialControls(input: {
  preset_id?: string | null;
  reader_profile?: string | null;
  article_form?: string | null;
  panel_shape?: string | null;
  analytics_mode?: string | null;
  panel_constraints_json?: string | null;
  depth_level?: number | null;
  content_profile?: ArticleScheduleContentProfile | null;
} = {}): ResolvedEditorialControls {
  const legacyDepthProvided = ([1, 2, 3, 4] as const).includes(input.depth_level as DepthLevel);
  const legacyDepth = legacyDepthProvided
    ? (input.depth_level as DepthLevel)
    : 2;
  const legacyContentProfileProvided = input.content_profile === 'accessible' || input.content_profile === 'deep_dive';
  const hasExplicitCanonicalInput =
    input.preset_id != null
    || input.reader_profile != null
    || input.article_form != null
    || input.analytics_mode != null;
  const presetId = (input.preset_id && input.preset_id in EDITORIAL_PRESETS
    ? input.preset_id
    : presetFromLegacy(legacyDepth, input.content_profile)) as EditorialPresetId;
  const preset = EDITORIAL_PRESETS[presetId];
  const readerProfile = (input.reader_profile && input.reader_profile in READER_PROFILE_LABELS
    ? input.reader_profile
    : preset.reader_profile) as ReaderProfile;
  const articleForm = (input.article_form && input.article_form in ARTICLE_FORM_LABELS
    ? input.article_form
    : preset.article_form) as ArticleForm;
  const panelShape = (input.panel_shape && input.panel_shape in PANEL_SHAPE_LABELS
    ? input.panel_shape
    : preset.panel_shape) as PanelShape;
  const analyticsMode = (input.analytics_mode && input.analytics_mode in ANALYTICS_MODE_LABELS
    ? input.analytics_mode
    : preset.analytics_mode) as AnalyticsMode;
  const panelConstraintsJson = input.panel_constraints_json?.trim() || null;
  const panelConstraints = parsePanelConstraintsJson(panelConstraintsJson);
  const resolvedDepth = hasExplicitCanonicalInput || !legacyDepthProvided
    ? deriveDepthLevelFromArticleForm(articleForm)
    : legacyDepth;
  const resolvedContentProfile = hasExplicitCanonicalInput || !legacyContentProfileProvided
    ? deriveContentProfileFromControls(readerProfile, analyticsMode)
    : input.content_profile;
  return {
    preset_id: presetId,
    reader_profile: readerProfile,
    article_form: articleForm,
    panel_shape: panelShape,
    analytics_mode: analyticsMode,
    panel_constraints_json: panelConstraintsJson,
    panel_constraints: panelConstraints,
    legacy_depth_level: resolvedDepth,
    legacy_content_profile: resolvedContentProfile as ArticleScheduleContentProfile,
  };
}

export function getPresetDefinition(presetId: string | null | undefined): EditorialPresetDefinition {
  const id = presetId && presetId in EDITORIAL_PRESETS
    ? presetId as EditorialPresetId
    : 'beat_analysis';
  return EDITORIAL_PRESETS[id];
}

export function formatPresetLabel(presetId: string | null | undefined): string {
  return getPresetDefinition(presetId).label;
}

export function getPanelSizeGuidance(controls: Pick<ResolvedEditorialControls, 'panel_shape' | 'article_form' | 'panel_constraints'>): { min: number; max: number } {
  if (controls.panel_constraints?.min_agents != null || controls.panel_constraints?.max_agents != null) {
    const min = controls.panel_constraints.min_agents ?? controls.panel_constraints.max_agents ?? 2;
    const max = controls.panel_constraints.max_agents ?? controls.panel_constraints.min_agents ?? Math.max(min, 2);
    return { min, max: Math.max(min, max) };
  }
  switch (controls.panel_shape) {
    case 'news_reaction':
      return { min: 2, max: 2 };
    case 'contract_eval':
    case 'draft_eval':
    case 'scheme_breakdown':
      return { min: 3, max: 4 };
    case 'trade_eval':
    case 'cohort_rank':
    case 'market_map':
      return { min: 4, max: 5 };
    case 'auto':
      switch (controls.article_form) {
        case 'brief':
          return { min: 2, max: 2 };
        case 'standard':
          return { min: 3, max: 4 };
        case 'feature':
          return { min: 3, max: 4 };
        case 'deep':
          return { min: 4, max: 5 };
      }
  }
}

export interface Article {
  id: string;
  title: string;
  subtitle: string | null;
  llm_provider: string | null;
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
  preset_id: EditorialPresetId;
  reader_profile: ReaderProfile;
  article_form: ArticleForm;
  panel_shape: PanelShape;
  analytics_mode: AnalyticsMode;
  panel_constraints_json: string | null;
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

export interface StageRunDetail extends StageRun {
  trace_count: number;
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

export type ArticleScheduleProviderMode = 'default' | 'override';
export type ArticleScheduleRunStatus = 'claimed' | 'created_article' | 'completed' | 'failed' | 'skipped';

export interface ArticleSchedule {
  id: string;
  name: string;
  enabled: number;
  team_abbr: string;
  prompt: string;
  weekday_utc: number;
  time_of_day_utc: string;
  content_profile: ArticleScheduleContentProfile;
  depth_level: DepthLevel;
  preset_id: EditorialPresetId;
  reader_profile: ReaderProfile;
  article_form: ArticleForm;
  panel_shape: PanelShape;
  analytics_mode: AnalyticsMode;
  panel_constraints_json: string | null;
  provider_mode: ArticleScheduleProviderMode;
  provider_id: string | null;
  last_run_at: string | null;
  next_run_at: string;
  created_at: string;
  updated_at: string;
}

export interface ArticleScheduleRun {
  id: string;
  schedule_id: string;
  scheduled_for: string;
  status: ArticleScheduleRunStatus;
  discovery_json: string | null;
  selected_story_json: string | null;
  article_id: string | null;
  error_text: string | null;
  started_at: string;
  completed_at: string | null;
}

export type LlmTraceStatus = 'started' | 'completed' | 'failed';

export interface LlmTrace {
  id: string;
  run_id: string | null;
  stage_run_id: string | null;
  article_id: string | null;
  stage: number | null;
  surface: string | null;
  agent_name: string;
  provider: string | null;
  model: string | null;
  requested_model: string | null;
  stage_key: string | null;
  task_family: string | null;
  temperature: number | null;
  max_tokens: number | null;
  response_format: string | null;
  status: LlmTraceStatus;
  system_prompt: string | null;
  user_message: string | null;
  messages_json: string | null;
  context_parts_json: string | null;
  skills_json: string | null;
  memories_json: string | null;
  article_context_json: string | null;
  conversation_context: string | null;
  roster_context: string | null;
  metadata_json: string | null;
  provider_mode: string | null;
  provider_session_id: string | null;
  working_directory: string | null;
  incremental_prompt: string | null;
  provider_request_json: string | null;
  provider_response_json: string | null;
  output_text: string | null;
  thinking_text: string | null;
  finish_reason: string | null;
  error_message: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  latency_ms: number | null;
  started_at: string;
  completed_at: string | null;
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

// ── Artifact editing + feedback ──────────────────────────────────────────────

export type FeedbackPacketStatus = 'pending' | 'consumed' | 'superseded';

export const VALID_FEEDBACK_PACKET_STATUSES: readonly FeedbackPacketStatus[] = [
  'pending', 'consumed', 'superseded',
] as const;

export interface ArtifactEditSnapshot {
  id: number;
  article_id: string;
  artifact_name: string;
  previous_content: string;
  new_content: string;
  edited_by: string;
  edit_source: string;
  created_at: string;
}

export interface FeedbackPacket {
  id: number;
  article_id: string;
  target_artifact: string | null;
  target_stage: number | null;
  instructions: string;
  edited_content: string | null;
  status: FeedbackPacketStatus;
  created_by: string;
  consumed_by: string | null;
  consumed_at: string | null;
  created_at: string;
}

/** Names of artifacts that dashboard users may edit directly. */
export const EDITABLE_ARTIFACT_NAMES: readonly string[] = [
  'idea.md',
  'discussion-prompt.md',
  'panel-composition.md',
  'discussion-summary.md',
  'article-contract.md',
  'draft.md',
  'editor-review.md',
  'lead-review.md',
] as const;

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
