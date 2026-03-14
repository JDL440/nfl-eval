export default function TokenCostDisplay({ jobs }) {
  const DAILY_BUDGET = 1.30;

  const totalCost = jobs.reduce((sum, j) => sum + (j.token_usage?.cost || 0), 0);
  const totalInput = jobs.reduce((sum, j) => sum + (j.token_usage?.input || 0), 0);
  const totalOutput = jobs.reduce((sum, j) => sum + (j.token_usage?.output || 0), 0);
  const budgetPct = (totalCost / DAILY_BUDGET) * 100;

  return (
    <div className="card">
      <div className="card-header">
        <h2>Token Cost</h2>
      </div>

      <div className="cost-display" style={{ marginBottom: '16px' }}>
        <div className="cost-amount">${totalCost.toFixed(4)}</div>
        <div className="cost-label">
          Budget: ${totalCost.toFixed(4)} / ${DAILY_BUDGET.toFixed(2)} ({budgetPct.toFixed(1)}%)
        </div>
      </div>

      <div style={{ marginBottom: '8px' }}>
        <div style={{
          height: '8px',
          background: '#e5e7eb',
          borderRadius: '4px',
          overflow: 'hidden',
        }}>
          <div style={{
            width: `${Math.min(budgetPct, 100)}%`,
            height: '100%',
            background: budgetPct > 90 ? '#ef4444' : budgetPct > 70 ? '#f59e0b' : '#10b981',
            transition: 'width 0.3s ease',
          }} />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: '#6b7280' }}>
        <span>Input tokens: {totalInput.toLocaleString()}</span>
        <span>Output tokens: {totalOutput.toLocaleString()}</span>
      </div>

      <div style={{ marginTop: '16px' }}>
        <h4 style={{ fontSize: '0.875rem', marginBottom: '8px' }}>Per-Article Breakdown</h4>
        {jobs.filter(j => j.token_usage?.cost > 0).map((job) => (
          <div key={job.id} style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '4px 0',
            fontSize: '0.8rem',
            borderBottom: '1px solid #f3f4f6',
          }}>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {job.data.title}
            </span>
            <span style={{ marginLeft: '8px', color: '#6b7280' }}>
              ${job.token_usage.cost.toFixed(4)} ({job.token_usage.model})
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
