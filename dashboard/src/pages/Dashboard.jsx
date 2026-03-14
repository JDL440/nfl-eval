import { useState, useEffect } from 'react';
import QueueStatus from '../components/QueueStatus';
import ArticlePreview from '../components/ArticlePreview';
import ApprovalControls from '../components/ApprovalControls';
import TokenCostDisplay from '../components/TokenCostDisplay';
import AuditLog from '../components/AuditLog';
import queueClient from '../api/queueClient';
import '../styles/responsive.css';

export function Dashboard() {
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('queue');

  useEffect(() => {
    // Keep selectedJobId in sync with the jobs list.
    if (jobs.length === 0) {
      if (selectedJobId !== null) {
        setSelectedJobId(null);
      }
      return;
    }

    const hasSelectedJob = jobs.some((j) => j.id === selectedJobId);
    if (!hasSelectedJob) {
      // Default to the first job when there is no valid selection.
      setSelectedJobId(jobs[0].id);
    }
  }, [jobs, selectedJobId]);

  useEffect(() => {
    fetchJobs();
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

  const selectedJob = selectedJobId ? jobs.find((j) => j.id === selectedJobId) : null;

  const handleJobUpdated = (updatedJob) => {
    const updatedJobs = jobs.map((j) => (j.id === updatedJob.id ? updatedJob : j));
    setJobs(updatedJobs);
  };

  useEffect(() => {
    // Initialize selection when jobs are first loaded and nothing is selected yet
    if (!selectedJobId && jobs.length > 0) {
      setSelectedJobId(jobs[0].id);
    }
  }, [jobs, selectedJobId]);

  const statuses = {
    pending: jobs.filter((j) => j.status === 'pending_approval').length,
    ready: jobs.filter((j) => j.status === 'ready_for_review').length,
    approved: jobs.filter((j) => j.status === 'approved').length,
    published: jobs.filter((j) => j.status === 'published').length
  };

  useEffect(() => {
    if (jobs.length === 0) {
      if (selectedJobId !== null) {
        setSelectedJobId(null);
      }
      return;
    }

    const hasSelectedJob = selectedJobId !== null && jobs.some((j) => j.id === selectedJobId);

    if (!hasSelectedJob) {
      setSelectedJobId(jobs[0].id);
    }
  }, [jobs, selectedJobId]);

  return (
    <div className="dashboard-container">
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1>📰 NFL Article Approval Dashboard</h1>
        <p style={{ color: '#6b7280', marginTop: '8px' }}>
          Review and approve articles for Substack publication
        </p>
      </div>

      {/* Token Cost Display */}
      <TokenCostDisplay jobs={jobs} />

      {/* Stats Cards */}
      <div className="dashboard-grid">
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: '700', color: '#ef4444', marginBottom: '4px' }}>
            {statuses.pending}
          </div>
          <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Pending Approval</div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: '700', color: '#f59e0b', marginBottom: '4px' }}>
            {statuses.ready}
          </div>
          <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Ready for Review</div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: '700', color: '#3b82f6', marginBottom: '4px' }}>
            {statuses.approved}
          </div>
          <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Approved</div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: '700', color: '#10b981', marginBottom: '4px' }}>
            {statuses.published}
          </div>
          <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Published</div>
        </div>
      </div>

      {/* Main Content */}
      <div className="dashboard-grid">
        {/* Queue List */}
        <div style={{ gridColumn: '1 / -1' }}>
          <QueueStatus jobs={jobs} selectedJobId={selectedJobId} onSelectJob={setSelectedJobId} />
        </div>

        {/* Article Preview */}
        <div>
          <ArticlePreview job={selectedJob} onClose={() => setSelectedJobId(null)} />
        </div>

        {/* Approval Controls */}
        <div>
          <ApprovalControls job={selectedJob} onJobUpdated={handleJobUpdated} />
        </div>

        {/* Audit Log */}
        <div style={{ gridColumn: '1 / -1' }}>
          <AuditLog job={selectedJob} />
        </div>
      </div>

      {/* Footer */}
      <div style={{
        marginTop: '40px',
        paddingTop: '20px',
        borderTop: '1px solid #e5e7eb',
        textAlign: 'center',
        color: '#6b7280',
        fontSize: '0.875rem'
      }}>
        <p>
          Last updated: {new Date().toLocaleString()}
        </p>
        <p style={{ marginTop: '8px' }}>
          Dashboard updates automatically every 2 seconds
        </p>
      </div>
    </div>
  );
}

export default Dashboard;
