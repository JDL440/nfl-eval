import { useState, useEffect } from 'react';
import queueClient from '../api/queueClient';

export function QueueStatus() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedJobId, setSelectedJobId] = useState(null);

  useEffect(() => {
    fetchJobs();
    // Poll for updates every 2 seconds
    const interval = setInterval(fetchJobs, 2000);
    return () => clearInterval(interval);
  }, []);

  const fetchJobs = async () => {
    try {
      const data = await queueClient.getJobs();
      setJobs(data);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch jobs:', error);
      setLoading(false);
    }
  };

  const statusClassMap = {
    pending_approval: 'pending',
    ready_for_review: 'ready',
    approved: 'approved',
    published: 'published',
    rejected: 'rejected',
    archived: 'archived',
    drafted: 'drafted'
  };

  const getStatusBadgeClass = (status) => {
    const cssSuffix = statusClassMap[status] || status;
    return `badge badge-${cssSuffix}`;
  };

  const statusColors = {
    pending_approval: '🔵',
    ready_for_review: '🟡',
    approved: '✅',
    published: '🟢',
    rejected: '❌',
    archived: '📦',
    drafted: '📝'
  };

  if (loading && jobs.length === 0) {
    return (
      <div className="card">
        <div className="card-header">
          <h2>Queue Status</h2>
        </div>
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <div className="loader"></div>
          <p style={{ marginTop: '12px' }}>Loading jobs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card dashboard-grid-full">
      <div className="card-header">
        <h2>Queue Status</h2>
        <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
          {jobs.length} article{jobs.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="queue-list">
        {jobs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <p>No articles in queue</p>
          </div>
        ) : (
          jobs.map((job) => (
            <div
              key={job.id}
              className="queue-item"
              onClick={() => setSelectedJobId(job.id)}
              style={{
                borderLeft: selectedJobId === job.id ? '4px solid #3b82f6' : '4px solid transparent'
              }}
            >
              <div className="queue-item-header">
                <div className="queue-item-title">{job.data.title}</div>
                <span className={getStatusBadgeClass(job.status)}>
                  {statusColors[job.status]} {job.status.replace(/_/g, ' ')}
                </span>
              </div>

              <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '8px' }}>
                {job.data.summary}
              </p>

              <div className="queue-item-meta">
                <span>📊 Significance: {job.data.significance.toFixed(1)}</span>
                <span>💰 Cost: ${job.token_usage.cost.toFixed(4)}</span>
                <span>🔤 Tokens: {job.token_usage.input + job.token_usage.output}</span>
                <span>🕐 {new Date(job.created_at).toLocaleString()}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default QueueStatus;
