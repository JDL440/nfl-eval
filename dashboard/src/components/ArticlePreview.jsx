export function ArticlePreview({ job, onClose }) {
  if (!job) {
    return (
      <div className="card">
        <div className="card-header">
          <h2>Article Preview</h2>
        </div>
        <div className="empty-state">
          <div className="empty-state-icon">📄</div>
          <p>Select an article to preview</p>
        </div>
      </div>
    );
  }

  const formatCost = (cost) => {
    return `$${cost.toFixed(4)}`;
  };

  const getSignificanceColor = (score) => {
    if (score >= 8) return '#10b981';
    if (score >= 6) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <div className="card">
      <div className="card-header">
        <h2>Article Preview</h2>
        <button className="btn btn-secondary" onClick={onClose}>✕ Close</button>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h3>{job.data.title}</h3>
        <p style={{ color: '#6b7280', fontSize: '0.95rem', marginBottom: '12px' }}>
          {job.data.summary}
        </p>

        <div style={{
          display: 'flex',
          gap: '16px',
          alignItems: 'center',
          flexWrap: 'wrap',
          marginBottom: '16px',
          padding: '12px',
          background: '#f9fafb',
          borderRadius: '6px'
        }}>
          <div>
            <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>SIGNIFICANCE SCORE</span>
            <div style={{
              fontSize: '1.5rem',
              fontWeight: 'bold',
              color: getSignificanceColor(job.data.significance)
            }}>
              {job.data.significance.toFixed(1)}/10
            </div>
          </div>

          <div style={{ borderLeft: '1px solid #e5e7eb', paddingLeft: '16px' }}>
            <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>TOKEN COST</span>
            <div style={{
              fontSize: '1.5rem',
              fontWeight: 'bold',
              color: '#3b82f6'
            }}>
              {formatCost(job.token_usage.cost)}
            </div>
          </div>

          <div style={{ borderLeft: '1px solid #e5e7eb', paddingLeft: '16px' }}>
            <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>MODEL</span>
            <div style={{
              fontSize: '1rem',
              fontWeight: '600',
              color: '#111827'
            }}>
              {job.token_usage.model.toUpperCase()}
            </div>
          </div>
        </div>

        <div style={{
          background: '#f0f9ff',
          border: '1px solid #bfdbfe',
          borderRadius: '6px',
          padding: '12px'
        }}>
          <span style={{ fontSize: '0.75rem', color: '#0c4a6e' }}>ARTICLE BODY</span>
          <p style={{ color: '#111827', lineHeight: '1.7', marginTop: '8px' }}>
            {job.data.body}
          </p>
        </div>

        <div style={{ marginTop: '16px', fontSize: '0.875rem', color: '#6b7280' }}>
          <p>
            📝 Drafted: {new Date(job.created_at).toLocaleString()}
          </p>
          <p>
            💵 Model: {job.token_usage.model} | Input tokens: {job.token_usage.input} | Output tokens: {job.token_usage.output}
          </p>
        </div>
      </div>
    </div>
  );
}

export default ArticlePreview;
