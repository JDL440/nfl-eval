import {
  ANALYTICS_MODE_LABELS,
  ARTICLE_FORM_LABELS,
  deriveContentProfileFromControls,
  deriveDepthLevelFromArticleForm,
  EDITORIAL_PRESET_ORDER,
  EDITORIAL_PRESETS,
  getPresetDefinition,
  PANEL_SHAPE_LABELS,
  READER_PROFILE_LABELS,
  resolveEditorialControls,
  type ArticleForm,
  type EditorialPresetId,
  type ReaderProfile,
} from '../../types.js';

const LEGACY_DEPTH_LABELS: Record<number, string> = {
  1: 'Casual Fan',
  2: 'The Beat',
  3: 'Deep Dive',
  4: 'Feature',
};

const CONTENT_PROFILE_LABELS: Record<string, string> = {
  accessible: 'Accessible',
  deep_dive: 'Deep Dive',
};

export interface EditorialUiState {
  preset_id: EditorialPresetId;
  reader_profile: ReaderProfile;
  article_form: ArticleForm;
  panel_shape: keyof typeof PANEL_SHAPE_LABELS;
  analytics_mode: keyof typeof ANALYTICS_MODE_LABELS;
  panel_constraints_json: string | null;
  legacy_depth_level: number;
  legacy_content_profile: keyof typeof CONTENT_PROFILE_LABELS;
}

export function buildEditorialUiState(input: {
  preset_id?: string | null;
  reader_profile?: string | null;
  article_form?: string | null;
  panel_shape?: string | null;
  analytics_mode?: string | null;
  panel_constraints_json?: string | null;
  depth_level?: number | null;
  content_profile?: 'accessible' | 'deep_dive' | null;
} = {}): EditorialUiState {
  const resolved = resolveEditorialControls(input);
  return {
    preset_id: resolved.preset_id,
    reader_profile: resolved.reader_profile,
    article_form: resolved.article_form,
    panel_shape: resolved.panel_shape,
    analytics_mode: resolved.analytics_mode,
    panel_constraints_json: resolved.panel_constraints_json,
    legacy_depth_level: resolved.legacy_depth_level,
    legacy_content_profile: resolved.legacy_content_profile,
  };
}

export function hasEditorialOverrides(state: EditorialUiState): boolean {
  const preset = getPresetDefinition(state.preset_id);
  return preset.reader_profile !== state.reader_profile
    || preset.article_form !== state.article_form
    || preset.panel_shape !== state.panel_shape
    || preset.analytics_mode !== state.analytics_mode
    || Boolean(state.panel_constraints_json);
}

export function renderPresetOptions(selectedPresetId: string): string {
  return EDITORIAL_PRESET_ORDER.map((presetId) => {
    const preset = EDITORIAL_PRESETS[presetId];
    return `<option value="${preset.id}"${preset.id === selectedPresetId ? ' selected' : ''}>${preset.label}</option>`;
  }).join('');
}

export function renderReaderProfileOptions(selected: string): string {
  return Object.entries(READER_PROFILE_LABELS)
    .map(([value, label]) => `<option value="${value}"${value === selected ? ' selected' : ''}>${label}</option>`)
    .join('');
}

export function renderArticleFormOptions(selected: string): string {
  return Object.entries(ARTICLE_FORM_LABELS)
    .map(([value, label]) => `<option value="${value}"${value === selected ? ' selected' : ''}>${label}</option>`)
    .join('');
}

export function renderPanelShapeOptions(selected: string): string {
  return Object.entries(PANEL_SHAPE_LABELS)
    .map(([value, label]) => `<option value="${value}"${value === selected ? ' selected' : ''}>${label}</option>`)
    .join('');
}

export function renderAnalyticsModeOptions(selected: string): string {
  return Object.entries(ANALYTICS_MODE_LABELS)
    .map(([value, label]) => `<option value="${value}"${value === selected ? ' selected' : ''}>${label}</option>`)
    .join('');
}

export function formatLegacyDepthLabel(depthLevel: number): string {
  return `${depthLevel} — ${LEGACY_DEPTH_LABELS[depthLevel] ?? `Depth ${depthLevel}`}`;
}

export function formatContentProfileLabel(contentProfile: string): string {
  return CONTENT_PROFILE_LABELS[contentProfile] ?? contentProfile;
}

export function buildLegacyFields(articleForm: string, readerProfile: string, analyticsMode: string): {
  depthLevel: number;
  contentProfile: 'accessible' | 'deep_dive';
} {
  return {
    depthLevel: deriveDepthLevelFromArticleForm(articleForm as ArticleForm),
    contentProfile: deriveContentProfileFromControls(
      readerProfile as ReaderProfile,
      analyticsMode as keyof typeof ANALYTICS_MODE_LABELS,
    ),
  };
}

export function formatEditorialSummary(state: EditorialUiState): string {
  const preset = getPresetDefinition(state.preset_id);
  return `${preset.label} · ${ARTICLE_FORM_LABELS[state.article_form]} · ${READER_PROFILE_LABELS[state.reader_profile]} · ${ANALYTICS_MODE_LABELS[state.analytics_mode]}`;
}

export function getPresetDescription(presetId: string): string {
  return getPresetDefinition(presetId).description;
}

export function serializePresetClientMap(): string {
  return JSON.stringify(
    EDITORIAL_PRESET_ORDER.reduce<Record<string, {
      readerProfile: string;
      articleForm: string;
      panelShape: string;
      analyticsMode: string;
      description: string;
    }>>((acc, presetId) => {
      const preset = EDITORIAL_PRESETS[presetId];
      acc[presetId] = {
        readerProfile: preset.reader_profile,
        articleForm: preset.article_form,
        panelShape: preset.panel_shape,
        analyticsMode: preset.analytics_mode,
        description: preset.description,
      };
      return acc;
    }, {}),
  );
}
