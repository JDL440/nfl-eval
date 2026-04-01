const { DatabaseSync } = require("node:sqlite");
const path = require("path");
const os = require("os");

const dbPath = path.join(os.homedir(), ".nfl-lab", "pipeline.db");
const db = new DatabaseSync(dbPath);

const articleId = "jj-mccarthys-qb-struggles-and-the-case-for-jeffersons-resurg";

console.log("=== RAW DATABASE QUERY RESULTS ===\n");

const article = db.prepare(`
  SELECT id, title, llm_provider 
  FROM articles 
  WHERE id = ?
`).get(articleId);

console.log("1. ARTICLE DATA FROM articles TABLE:");
console.log(JSON.stringify(article, null, 2));

console.log("\n2. TRACES DATA FROM llm_traces TABLE:");
const traces = db.prepare(`
  SELECT id, stage, model, status, metadata_json, started_at, completed_at 
  FROM llm_traces 
  WHERE article_id = ?
  ORDER BY stage, started_at
`).all(articleId);

console.log(`Total traces: ${traces.length}\n`);

traces.forEach((trace, idx) => {
  console.log(`Trace #${idx + 1}:`);
  console.log(JSON.stringify({
    id: trace.id,
    stage: trace.stage,
    model: trace.model,
    status: trace.status,
    started_at: trace.started_at,
    completed_at: trace.completed_at,
    metadata: trace.metadata_json ? JSON.parse(trace.metadata_json) : null
  }, null, 2));
  console.log("");
});

db.close();
