export default function AuditLog({ jobs }) {
  const allEntries = jobs
    .flatMap((job) =>
      job.audit_log.map((entry) => ({
        ...entry,
        jobId: job.id,
        jobTitle: job.data.title,
      }))
    )
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  return (
    <div className="card dashboard-grid-full">
      <div className="card-header">
        <h2>Audit Log</h2>
        <span className="badge badge-drafted">{allEntries.length} actions</span>
      </div>

      {allEntries.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📜</div>
          <p>No audit entries yet</p>
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '8px', borderBottom: '2px solid #e5e7eb' }}>Timestamp</th>
              <th style={{ textAlign: 'left', padding: '8px', borderBottom: '2px solid #e5e7eb' }}>Action</th>
              <th style={{ textAlign: 'left', padding: '8px', borderBottom: '2px solid #e5e7eb' }}>User</th>
              <th style={{ textAlign: 'left', padding: '8px', borderBottom: '2px solid #e5e7eb' }}>Article</th>
            </tr>
          </thead>
          <tbody>
            {allEntries.map((entry, i) => (
              <tr key={`${entry.jobId}-${i}`} className="audit-item" style={{ display: 'table-row' }}>
                <td className="audit-time" style={{ padding: '8px' }}>
                  {new Date(entry.timestamp).toLocaleString()}
                </td>
                <td className="audit-action" style={{ padding: '8px', textTransform: 'capitalize' }}>
                  {entry.action}
                </td>
                <td className="audit-actor" style={{ padding: '8px' }}>
                  {entry.actor}
                </td>
                <td style={{ padding: '8px', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {entry.jobTitle}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
