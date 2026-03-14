export default function ArticlePreview({ job }) {
  if (!job) {
    return (
      <div className="card">
        <h2>Article Preview</h2>
        <div className="empty-state">
          <div className="empty-state-icon">📄</div>
          <p>Select an article from the queue to preview</p>
        </div>
      </div>
    );
  }

  const { data } = job;

  return (
    <div className="card">
      <div className="card-header">
        <h2>Article Preview</h2>
        <span className="badge badge-drafted">
          Score: {data.significance.toFixed(1)}
        </span>
      </div>

      <h3 style={{ marginBottom: '12px' }}>{data.title}</h3>

      {data.summary && (
        <p style={{ fontStyle: 'italic', color: '#6b7280', marginBottom: '16px' }}>
          {data.summary}
        </p>
      )}

      {data.body ? (
        <div style={{ lineHeight: '1.8', whiteSpace: 'pre-line' }}>
          {data.body}
        </div>
      ) : (
        <div className="empty-state">
          <div className="loader" />
          <p>Article content is being generated...</p>
        </div>
      )}

      {data.sourceTransaction && data.sourceTransaction.value > 0 && (
        <div style={{ marginTop: '16px', padding: '8px', background: '#f9fafb', borderRadius: '6px' }}>
          <small style={{ color: '#6b7280' }}>
            Source Transaction: ${(data.sourceTransaction.value / 1_000_000).toFixed(1)}M
          </small>
        </div>
      )}
    </div>
  );
}
