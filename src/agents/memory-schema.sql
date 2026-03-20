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
