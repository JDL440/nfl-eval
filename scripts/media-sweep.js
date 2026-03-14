import fs from 'fs';
import path from 'path';
import { v4 as uuid } from 'uuid';
import { fileURLToPath } from 'url';
import db from '../src/db.js';
import { articleDraftQueue } from '../src/queue.js';
import { isSignificant, evaluateSignificance } from '../config/significance.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function readMediaSweep(filePath = null) {
  const defaultPath = filePath || path.join(__dirname, '..', '.squad', 'agents', 'Media', 'media-sweep.json');

  if (!fs.existsSync(defaultPath)) {
    throw new Error(`Media sweep file not found: ${defaultPath}`);
  }

  const content = fs.readFileSync(defaultPath, 'utf-8');
  return JSON.parse(content);
}

export function createJobFromTransaction(transaction, sweepId) {
  const jobId = `job-${uuid()}`;
  const significance = evaluateSignificance(transaction);

  return {
    id: jobId,
    type: 'article-draft',
    state: 'pending',
    data: JSON.stringify({
      transaction_id: transaction.id,
      sweep_id: sweepId,
      player: transaction.player,
      position: transaction.position,
      from_team: transaction.from_team,
      to_team: transaction.to_team,
      deal: transaction.deal,
      transaction_type: transaction.type,
      sources: transaction.sources,
      confidence: transaction.confidence,
      notes: transaction.notes,
      significance_score: significance,
    }),
    token_usage: JSON.stringify({}),
    retry_count: 0,
  };
}

export async function enqueueJobs(sweep) {
  const sweepId = sweep.sweep_id;
  const jobsToEnqueue = [];
  const enqueueErrors = [];
  const auditEvents = [];

  // Filter transactions by significance
  const significantTransactions = sweep.transactions.filter((tx) => isSignificant(tx));

  console.log(`📊 Media sweep ${sweepId}: ${sweep.transactions.length} transactions, ${significantTransactions.length} significant`);

  for (const transaction of significantTransactions) {
    try {
      const job = createJobFromTransaction(transaction, sweepId);

      // Insert into SQLite
      const insertStmt = db.prepare(`
        INSERT INTO jobs (id, type, state, data, token_usage, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `);

      insertStmt.run(job.id, job.type, job.state, job.data, job.token_usage);

      // Enqueue to BullMQ
      await articleDraftQueue.add(job.type, job, { jobId: job.id });

      jobsToEnqueue.push(job.id);

      // Audit log entry
      const auditId = `audit-${uuid()}`;
      const auditStmt = db.prepare(`
        INSERT INTO audit_log (id, job_id, action, actor, details, created_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `);

      auditStmt.run(
        auditId,
        job.id,
        'enqueued',
        'media-sweep',
        JSON.stringify({
          transaction_id: transaction.id,
          significance_score: evaluateSignificance(transaction),
          sweep_id: sweepId,
        })
      );

      auditEvents.push({ jobId: job.id, action: 'enqueued' });
    } catch (err) {
      console.error(`❌ Failed to enqueue job for transaction ${transaction.id}:`, err.message);
      enqueueErrors.push({ transactionId: transaction.id, error: err.message });
    }
  }

  console.log(`✅ Enqueued ${jobsToEnqueue.length} jobs`);

  if (enqueueErrors.length > 0) {
    console.warn(`⚠️  ${enqueueErrors.length} enqueue errors:`, enqueueErrors);
  }

  return { jobsEnqueued: jobsToEnqueue, errors: enqueueErrors, auditEvents };
}

export async function runMediaSweep(filePath = null) {
  try {
    console.log('🔄 Running media sweep job enqueuer...');

    const sweep = await readMediaSweep(filePath);
    const result = await enqueueJobs(sweep);

    console.log(`\n📋 Summary:`);
    console.log(`  Sweep ID: ${sweep.sweep_id}`);
    console.log(`  Period: ${sweep.period.start} to ${sweep.period.end}`);
    console.log(`  Total transactions: ${sweep.transactions.length}`);
    console.log(`  Jobs enqueued: ${result.jobsEnqueued.length}`);
    console.log(`  Errors: ${result.errors.length}`);

    return result;
  } catch (err) {
    console.error('❌ Media sweep failed:', err.message);
    throw err;
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  runMediaSweep().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

export default { readMediaSweep, enqueueJobs, runMediaSweep };
