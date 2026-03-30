/** Scope for settings and profiles */
export type SettingsScope = 'workspace' | 'user';

export interface ProviderScope {
  scopeType: SettingsScope;
  scopeUserId?: string | null;
}

/** Known workspace setting namespaces and keys */
export type WorkspaceNamespace =
  | 'llm'
  | 'publishing'
  | 'images'
  | 'dashboard_auth'
  | 'ui'
  | 'pipeline';

/** Known provider IDs */
export type KnownProviderId = 'copilot-cli' | 'copilot-api' | 'lmstudio' | 'mock';

/** Provider profile config schemas per provider */
export interface CopilotCliProfileConfig {
  defaultModel?: string;
  toolAccessMode?: string;
  enableWebFetch?: boolean;
  enableRepoMcp?: boolean;
  mcpConfigPath?: string;
  enableSessionReuse?: boolean;
  workingDirectory?: string;
  extraFlags?: string[];
}

export interface CopilotApiProfileConfig {
  defaultModel?: string;
}

export interface LMStudioProfileConfig {
  baseUrl?: string;
  defaultModel?: string;
}

export interface MockProfileConfig {
  // no required config
}

export type ProviderProfileConfig =
  | CopilotCliProfileConfig
  | CopilotApiProfileConfig
  | LMStudioProfileConfig
  | MockProfileConfig;

/** Resolved configuration types returned by the resolver */
export interface ResolvedDashboardAuth {
  mode: string;
  sessionCookieName: string;
  sessionTtlHours: number;
  secureCookies: boolean;
  username?: string;
}

export interface ResolvedProviderProfile {
  id: string;
  providerId: string;
  label: string;
  isDefault: boolean;
  enabled: boolean;
  config: ProviderProfileConfig;
}

export interface ResolvedProviderProfileSet {
  profiles: ResolvedProviderProfile[];
  defaultProfile: ResolvedProviderProfile | null;
}

export interface ProviderProfileResolution {
  profile: ResolvedProviderProfile | null;
  source: 'article' | 'user' | 'workspace' | 'env' | 'default';
  warning?: string;
}

export interface ResolvedPublishingConfig {
  substackPublicationUrl: string | null;
  substackStageUrl: string | null;
  notesEndpointPath: string | null;
  defaultAudience: string;
  enablePublishAll: boolean;
  enableNotes: boolean;
  enableTwitter: boolean;
  substackTokenConfigured: boolean;
  twitterCredentialsConfigured: boolean;
}

export interface ResolvedTwitterConfig {
  apiKey: string | null;
  apiSecret: string | null;
  accessToken: string | null;
  accessTokenSecret: string | null;
  configured: boolean;
}

export interface ResolvedImageConfig {
  provider: string;
  defaultEnabled: boolean;
  geminiKeyConfigured: boolean;
}

export interface ResolvedUiPreferences {
  defaultTraceView: string;
  defaultArticleTab: string;
}

export type SettingSource = 'article' | 'user' | 'workspace' | 'env' | 'default';

export interface DiagnosticEntry {
  key: string;
  effectiveValue: string | null;
  redacted: boolean;
  source: SettingSource;
  warning?: string;
}

export interface SettingsDiagnosticsSnapshot {
  entries: DiagnosticEntry[];
  serviceReadiness: Record<string, { ready: boolean; detail: string }>;
}
