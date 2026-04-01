const { DatabaseSync } = require("node:sqlite");
const path = require("path");
const os = require("os");

const dbPath = path.join(os.homedir(), ".nfl-lab", "pipeline.db");
const db = new DatabaseSync(dbPath);

const articleId = "jj-mccarthys-qb-struggles-and-the-case-for-jeffersons-resurg";

console.log("=== EXAMPLE TRACE WITH METADATA ===\n");

const trace = db.prepare(`
  SELECT id, stage, model, status, metadata_json, started_at, completed_at 
  FROM llm_traces 
  WHERE article_id = ? AND stage = 4
  ORDER BY stage, started_at
  LIMIT 1
`).get(articleId);

console.log("Trace ID:", trace.id);
console.log("Stage:", trace.stage);
console.log("Model:", trace.model);
console.log("Status:", trace.status);
console.log("Started At:", trace.started_at);
console.log("Completed At:", trace.completed_at);
console.log("\nMetadata JSON (raw string):");
console.log(trace.metadata_json);
console.log("\nMetadata JSON (parsed):");
if (trace.metadata_json) {
  const meta = JSON.parse(trace.metadata_json);
  console.log(JSON.stringify(meta, null, 2));
}

db.close();
