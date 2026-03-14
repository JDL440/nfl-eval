import { useState, useEffect } from 'react';

export function TokenCostDisplay({ jobs }) {
  const [totalCost, setTotalCost] = useState(0);
  const [breakdown, setBreakdown] = useState({ haiku: 0, opus: 0 });

  useEffect(() => {
    if (!jobs || jobs.length === 0) {
      setTotalCost(0);
      setBreakdown({ haiku: 0, opus: 0 });
      return;
    }

    let total = 0;
    let haiku = 0;
    let opus = 0;

    jobs.forEach((job) => {
      const cost = job.token_usage.cost;
      total += cost;
      if (job.token_usage.model === 'haiku') {
        haiku += cost;
      } else if (job.token_usage.model === 'opus') {
        opus += cost;
      }
    });

    setTotalCost(total);
    setBreakdown({ haiku, opus });
  }, [jobs]);

  const dailyBudget = 1.30; // GitHub Copilot Pro+ budget per day
  const percentUsed = (totalCost / dailyBudget) * 100;
  const budgetWarning = percentUsed >= 70;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
      {/* Total Cost Card */}
      <div className="cost-display">
        <div className="cost-amount">${totalCost.toFixed(4)}</div>
        <div className="cost-label">Total Daily Cost</div>
      </div>

      {/* Budget Status Card */}
      <div className="card" style={{ background: budgetWarning ? '#fef3c7' : '#f0fdf4' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontSize: '1.5rem',
            fontWeight: '700',
            color: budgetWarning ? '#92400e' : '#166534',
            marginBottom: '8px'
          }}>
            {percentUsed.toFixed(1)}% of Budget
          </div>
          <div style={{ fontSize: '0.875rem', color: budgetWarning ? '#92400e' : '#166534' }}>
            ${dailyBudget.toFixed(2)} daily limit
          </div>
          {budgetWarning && (
            <div style={{ marginTop: '8px', fontSize: '0.875rem', fontWeight: '500', color: '#92400e' }}>
              ⚠️ Budget alert at 70%
            </div>
          )}
        </div>
      </div>

      {/* Model Breakdown */}
      <div className="card">
        <h3 style={{ marginBottom: '12px' }}>Cost Breakdown</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: '500' }}>Haiku (drafts)</span>
              <span style={{ fontWeight: '600' }}>${breakdown.haiku.toFixed(4)}</span>
            </div>
            <div style={{
              height: '8px',
              background: '#e5e7eb',
              borderRadius: '4px',
              overflow: 'hidden'
            }}>
              <div style={{
                height: '100%',
                background: '#3b82f6',
                width: `${Math.min((breakdown.haiku / totalCost) * 100, 100)}%`,
                transition: 'width 0.3s ease'
              }} />
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: '500' }}>Opus (reviews)</span>
              <span style={{ fontWeight: '600' }}>${breakdown.opus.toFixed(4)}</span>
            </div>
            <div style={{
              height: '8px',
              background: '#e5e7eb',
              borderRadius: '4px',
              overflow: 'hidden'
            }}>
              <div style={{
                height: '100%',
                background: '#10b981',
                width: `${Math.min((breakdown.opus / totalCost) * 100, 100)}%`,
                transition: 'width 0.3s ease'
              }} />
            </div>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="card">
        <h3 style={{ marginBottom: '12px' }}>Daily Remaining</h3>
        <div style={{
          fontSize: '2rem',
          fontWeight: '700',
          color: '#10b981',
          marginBottom: '8px'
        }}>
          ${(dailyBudget - totalCost).toFixed(4)}
        </div>
        <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
          Budget resets daily at midnight EST
        </div>
      </div>
    </div>
  );
}

export default TokenCostDisplay;
