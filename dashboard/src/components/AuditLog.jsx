export function AuditLog({ job }) {
  if (!job || !job.audit_log) {
    return (
      <div className="card">
        <div className="card-header">
          <h2>Audit Log</h2>
        </div>
        <div className="empty-state">
          <div className="empty-state-icon">📋</div>
          <p>Select an article to view its audit log</p>
        </div>
      </div>
    );
  }

  const actionEmojis = {
    drafted: '✍️',
    approved: '✅',
    rejected: '❌',
    published: '🚀',
    unpublished: '↩️',
    edited: '📝'
  };

  const actionColors = {
    drafted: '#3b82f6',
    approved: '#10b981',
    rejected: '#ef4444',
    published: '#06b6d4',
    unpublished: '#f59e0b',
    edited: '#8b5cf6'
  };

  return (
    <div className="card dashboard-grid-full">
      <div className="card-header">
        <h2>Audit Log</h2>
        <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
          {job.audit_log.length} action{job.audit_log.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="audit-log">
        {job.audit_log.length === 0 ? (
          <div className="empty-state" style={{ padding: '20px' }}>
            <p>No actions recorded</p>
          </div>
        ) : (
          job.audit_log.map((entry, index) => {
            const timestamp = new Date(entry.timestamp);
            const formattedTime = timestamp.toLocaleString();
            const emoji = actionEmojis[entry.action] || '📌';
            const color = actionColors[entry.action] || '#6b7280';

            return (
              <div key={index} className="audit-item">
                <div style={{
                  minWidth: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.2rem'
                }}>
                  {emoji}
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span
                      className="badge"
                      style={{
                        background: color,
                        color: 'white',
                        textTransform: 'capitalize',
                        border: 'none'
                      }}
                    >
                      {entry.action}
                    </span>
                    <span className="audit-time">
                      {formattedTime}
                    </span>
                  </div>

                  {entry.actor && (
                    <div className="audit-actor">
                      By: {entry.actor}
                    </div>
                  )}

                  {entry.reason && (
                    <div style={{
                      marginTop: '6px',
                      padding: '8px',
                      background: '#f9fafb',
                      borderRadius: '4px',
                      fontSize: '0.875rem',
                      color: '#374151',
                      fontStyle: 'italic',
                      borderLeft: `3px solid ${color}`
                    }}>
                      💭 {entry.reason}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e5e7eb' }}>
        <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
          📊 Job ID: <code style={{ background: '#f3f4f6', padding: '2px 6px' }}>{job.id}</code>
        </p>
        <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '4px' }}>
          🕐 Created: {new Date(job.created_at).toLocaleString()}
        </p>
      </div>
    </div>
  );
}

export default AuditLog;
