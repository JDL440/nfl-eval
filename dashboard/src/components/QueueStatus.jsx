import { useState } from 'react';

const statusBadge = (status) => {
  const map = {
    pending: 'badge-pending',
    drafted: 'badge-drafted',
    ready_for_review: 'badge-ready',
    approved: 'badge-approved',
    published: 'badge-published',
    rejected: 'badge-rejected',
    archived: 'badge-archived',
  };
  return map[status] || 'badge-pending';
};

export default function QueueStatus({ jobs, selectedJob, onSelectJob }) {
  const [filter, setFilter] = useState('all');

  const filtered = filter === 'all'
    ? jobs
    : jobs.filter((j) => j.status === filter);

  const statusLabel = (s) => s.replace(/_/g, ' ');

  return (
    <div className="card">
      <div className="card-header">
        <h2>Queue Status</h2>
        <span className="badge badge-drafted">{jobs.length} jobs</span>
      </div>

      <div className="tabs">
        {['all', 'pending', 'drafted', 'ready_for_review', 'approved', 'published', 'rejected'].map((t) => (
          <button
            key={t}
            className={`tab-button ${filter === t ? 'active' : ''}`}
            onClick={() => setFilter(t)}
          >
            {t === 'all' ? 'All' : statusLabel(t)}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📋</div>
          <p>No jobs with status "{statusLabel(filter)}"</p>
        </div>
      ) : (
        <div className="queue-list">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '8px' }}>Title</th>
                <th style={{ textAlign: 'left', padding: '8px' }}>Status</th>
                <th style={{ textAlign: 'left', padding: '8px' }}>Significance</th>
                <th style={{ textAlign: 'left', padding: '8px' }}>Created</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((job) => (
                <tr
                  key={job.id}
                  className="queue-item"
                  onClick={() => onSelectJob(job)}
                  style={{
                    cursor: 'pointer',
                    background: selectedJob?.id === job.id ? '#eff6ff' : undefined,
                  }}
                >
                  <td style={{ padding: '8px' }}>{job.data.title}</td>
                  <td style={{ padding: '8px' }}>
                    <span className={`badge ${statusBadge(job.status)}`}>
                      {statusLabel(job.status)}
                    </span>
                  </td>
                  <td style={{ padding: '8px' }}>{job.data.significance.toFixed(1)}</td>
                  <td style={{ padding: '8px' }}>
                    {new Date(job.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
