/**
 * index.ts — Public API re-exports for programmatic use.
 *
 * Import from 'nfl-eval' (or the dist entry point) to access
 * all v2 pipeline components without reaching into submodules.
 */

// Config
export { loadConfig, initDataDir } from './config/index.js';
export type { AppConfig, LeagueConfig } from './config/index.js';

// Types
export {
  VALID_STAGES,
  STAGE_NAMES,
  VALID_STATUSES,
  VALID_VERDICTS,
  VALID_RUN_STATUSES,
  VALID_USAGE_EVENT_TYPES,
  VALID_NOTE_TYPES,
  VALID_NOTE_TARGETS,
  DEPTH_LEVEL_MAP,
} from './types.js';
export type {
  Stage,
  Article,
  ArticleStatus,
  StageTransition,
  EditorReview,
  EditorVerdict,
  PublisherPass,
  ArticleRun,
  StageRun,
  UsageEvent,
  RunStatus,
  UsageEventType,
  DepthLevel,
  DepthName,
  Note,
  NoteType,
  NoteTarget,
  StageInference,
  ResolvedModel,
} from './types.js';

// Database
export { Repository } from './db/repository.js';

// Pipeline
export { PipelineEngine, TRANSITION_MAP } from './pipeline/engine.js';
export type { GuardResult, TransitionDef, AdvanceCheck, ValidationReport } from './pipeline/engine.js';
export { PipelineScheduler } from './pipeline/scheduler.js';
export type { SchedulerConfig, PendingAction, BatchResult } from './pipeline/scheduler.js';

// Dashboard
export { createApp, startServer } from './dashboard/server.js';

// MCP
export { createMCPServer, startMCPServer } from './mcp/server.js';

// Migration
export { migrate } from './migration/migrate.js';
export type { MigrationOptions, MigrationReport } from './migration/migrate.js';

// CLI
export { run, printUsage, handleExport } from './cli.js';

// CLI Export
export { exportArticle } from './cli/export.js';
export type { ExportOptions } from './cli/export.js';
