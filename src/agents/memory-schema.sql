-- LEGACY — agent_memory schema is retained for a future redesign spike.
-- Runtime prompt injection is disabled in AgentRunner.run() (runner.ts step 3).
-- The table and indexes are created here to keep the storage layer intact and
-- ready to be re-activated without a migration. Do not drop without a spike decision.
CREATE TABLE IF NOT EXISTS agent_memory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_name TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('learning','decision','preference','domain_knowledge','error_pattern')),
  content TEXT NOT NULL,
  source_session TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT,
  relevance_score REAL NOT NULL DEFAULT 1.0,
  access_count INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_agent_memory_agent ON agent_memory(agent_name, category);
CREATE INDEX IF NOT EXISTS idx_agent_memory_relevance ON agent_memory(agent_name, relevance_score DESC);
CREATE INDEX IF NOT EXISTS idx_agent_memory_expires ON agent_memory(expires_at);

CREATE TABLE IF NOT EXISTS memory_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
