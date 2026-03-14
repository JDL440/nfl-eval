import { useState, useEffect, useCallback } from 'react';
import QueueStatus from '../components/QueueStatus';
import ArticlePreview from '../components/ArticlePreview';
import ApprovalControls from '../components/ApprovalControls';
import TokenCostDisplay from '../components/TokenCostDisplay';
import AuditLog from '../components/AuditLog';
import useApi from '../hooks/useApi';
import { getJobs, approveJob, rejectJob, unpublishJob } from '../api/queueClient';

export default function Dashboard() {
  const [selectedJob, setSelectedJob] = useState(null);
  const { data: jobs, loading, error, execute: fetchJobs } = useApi(getJobs, { immediate: true });

  // Poll for updates every 2 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchJobs().catch(() => {});
    }, 2000);
    return () => clearInterval(interval);
  }, [fetchJobs]);

  const handleApprove = useCallback(async (id) => {
    await approveJob(id);
    const updated = await fetchJobs();
    setSelectedJob(updated.find((j) => j.id === id) || null);
  }, [fetchJobs]);

  const handleReject = useCallback(async (id, reason) => {
    await rejectJob(id, reason);
    const updated = await fetchJobs();
    setSelectedJob(updated.find((j) => j.id === id) || null);
  }, [fetchJobs]);

  const handleUnpublish = useCallback(async (id) => {
    await unpublishJob(id);
    const updated = await fetchJobs();
    setSelectedJob(updated.find((j) => j.id === id) || null);
  }, [fetchJobs]);

  if (loading && !jobs) {
    return (
      <div className="dashboard-container">
        <h1>NFL Article Approval Dashboard</h1>
        <div className="loading-container">
          <div className="loader loader-large" />
          <p>Loading queue data...</p>
        </div>
      </div>
    );
  }

  if (error && !jobs) {
    return (
      <div className="dashboard-container">
        <h1>NFL Article Approval Dashboard</h1>
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <h3 style={{ color: '#dc2626' }}>Failed to load queue data</h3>
          <p style={{ color: '#6b7280' }}>{error.message}</p>
          <button className="btn btn-primary" onClick={() => fetchJobs()} style={{ marginTop: '16px' }}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const jobList = jobs || [];

  return (
    <div className="dashboard-container">
      <h1>NFL Article Approval Dashboard</h1>

      <QueueStatus
        jobs={jobList}
        selectedJob={selectedJob}
        onSelectJob={setSelectedJob}
      />

      <div className="dashboard-grid">
        <ArticlePreview job={selectedJob} />
        <div>
          <ApprovalControls
            job={selectedJob}
            onApprove={handleApprove}
            onReject={handleReject}
            onUnpublish={handleUnpublish}
          />
          <div style={{ marginTop: '24px' }}>
            <TokenCostDisplay jobs={jobList} />
          </div>
        </div>
      </div>

      <AuditLog jobs={jobList} />
    </div>
  );
}
