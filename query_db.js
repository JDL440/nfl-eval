const { DatabaseSync } = require("node:sqlite");
const path = require("path");
const os = require("os");

const dbPath = path.join(os.homedir(), ".nfl-lab", "pipeline.db");

const db = new DatabaseSync(dbPath);

const articleId = "jj-mccarthys-qb-struggles-and-the-case-for-jeffersons-resurg";

console.log("=== ARTICLE ===");
const article = db.prepare(`
  SELECT id, title, llm_provider 
  FROM articles 
  WHERE id = ?
`).get(articleId);

console.log("ID:", article.id);
console.log("Title:", article.title);
console.log("LLM Provider:", article.llm_provider);

console.log("\n=== TRACES FOR ARTICLE ===");

const traces = db.prepare(`
  SELECT id, stage, model, status, metadata_json, started_at, completed_at 
  FROM llm_traces 
  WHERE article_id = ?
  ORDER BY stage, started_at
`).all(articleId);

console.log("Total traces:", traces.length);

traces.forEach((trace, idx) => {
  console.log(`\n--- Trace #${idx + 1} ---`);
  console.log("id:", trace.id);
  console.log("stage:", trace.stage);
  console.log("model:", trace.model);
  console.log("status:", trace.status);
  console.log("started_at:", trace.started_at);
  console.log("completed_at:", trace.completed_at);
  
  if (trace.metadata_json) {
    try {
      const meta = JSON.parse(trace.metadata_json);
      if (meta.toolCallCount !== undefined || meta.toolCallBudget !== undefined) {
        console.log("toolCallCount:", meta.toolCallCount);
        console.log("toolCallBudget:", meta.toolCallBudget);
        console.log("==> Tool calls used: " + meta.toolCallCount + " / " + meta.toolCallBudget);
      } else {
        console.log("(No tool call metadata)");
      }
    } catch (e) {
      console.log("metadata parse error:", e.message);
    }
  } else {
    console.log("metadata_json: NULL");
  }
});

db.close();
