import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', '.queue', 'jobs.db');

// Ensure .queue directory exists
const queueDir = path.dirname(dbPath);
if (!fs.existsSync(queueDir)) {
  fs.mkdirSync(queueDir, { recursive: true });
}

// Initialize database
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Schema: jobs
db.exec(`
  CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('article-draft', 'article-review', 'article-publish')),
    state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'processing', 'completed', 'failed')),
    data JSON,
    result JSON,
    token_usage JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    retry_count INTEGER DEFAULT 0,
    error_message TEXT
  );
  
  CREATE INDEX IF NOT EXISTS idx_jobs_type ON jobs(type);
  CREATE INDEX IF NOT EXISTS idx_jobs_state ON jobs(state);
  CREATE INDEX IF NOT EXISTS idx_jobs_created ON jobs(created_at);
`);

// Schema: token_usage
db.exec(`
  CREATE TABLE IF NOT EXISTS token_usage (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL,
    model TEXT NOT NULL,
    input_tokens INTEGER,
    output_tokens INTEGER,
    cost DECIMAL(10, 6),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
    UNIQUE(job_id, model)
  );
  
  CREATE INDEX IF NOT EXISTS idx_token_usage_job ON token_usage(job_id);
  CREATE INDEX IF NOT EXISTS idx_token_usage_model ON token_usage(model);
`);

// Schema: audit_log
db.exec(`
  CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL,
    action TEXT NOT NULL,
    actor TEXT DEFAULT 'system',
    details JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
  );
  
  CREATE INDEX IF NOT EXISTS idx_audit_job ON audit_log(job_id);
  CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);
  CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);
`);

// Schema: config (for tunable significance thresholds)
db.exec(`
  CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    category TEXT DEFAULT 'general',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  
  INSERT OR IGNORE INTO config (key, value, category) VALUES
    ('trade_value_threshold', '50000000', 'significance'),
    ('contract_ceiling_threshold', '300000000', 'significance'),
    ('injury_severity_threshold', 'season-ending', 'significance'),
    ('approval_required', 'true', 'workflow'),
    ('token_budget_daily_limit', '1.30', 'budget'),
    ('token_budget_alert_threshold', '0.70', 'budget');
`);

console.log('✅ SQLite schema initialized at:', dbPath);
export default db;
