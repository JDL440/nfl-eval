import { useState } from 'react';
import queueClient from '../api/queueClient';

function Modal({ isOpen, title, children, onClose }) {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ApprovalControls({ job, onJobUpdated }) {
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showUnpublishModal, setShowUnpublishModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [loading, setLoading] = useState(false);

  if (!job) {
    return (
      <div className="card">
        <div className="card-header">
          <h2>Approval Controls</h2>
        </div>
        <div className="empty-state">
          <div className="empty-state-icon">🎮</div>
          <p>Select an article to show approval options</p>
        </div>
      </div>
    );
  }

  const canApprove = ['pending_approval', 'ready_for_review', 'drafted'].includes(job.status);
  const canReject = canApprove;
  const canUnpublish = ['approved', 'published'].includes(job.status);

  const handleApprove = async () => {
    if (!window.confirm('Are you sure you want to approve this article?')) return;
    setLoading(true);
    try {
      const updated = await queueClient.approveJob(job.id);
      onJobUpdated(updated);
    } catch (error) {
      alert('Failed to approve job: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    setLoading(true);
    try {
      const updated = await queueClient.rejectJob(job.id, rejectReason);
      onJobUpdated(updated);
      setShowRejectModal(false);
      setRejectReason('');
    } catch (error) {
      alert('Failed to reject job: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUnpublish = async () => {
    setLoading(true);
    try {
      const updated = await queueClient.unpublishJob(job.id);
      onJobUpdated(updated);
      setShowUnpublishModal(false);
    } catch (error) {
      alert('Failed to unpublish job: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <h2>Approval Controls</h2>
      </div>

      <p style={{ marginBottom: '16px', color: '#6b7280' }}>
        Job ID: <code style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: '4px' }}>{job.id}</code>
      </p>

      <div style={{ display: 'grid', gap: '12px' }}>
        {canApprove && (
          <button
            className="btn btn-success"
            onClick={handleApprove}
            disabled={loading}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            ✅ {loading ? 'Approving...' : 'Approve Article'}
          </button>
        )}

        {canReject && (
          <button
            className="btn btn-danger"
            onClick={() => setShowRejectModal(true)}
            disabled={loading}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            ❌ {loading ? 'Processing...' : 'Reject & Request Edits'}
          </button>
        )}

        {canUnpublish && (
          <button
            className="btn btn-warning"
            onClick={() => setShowUnpublishModal(true)}
            disabled={loading}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            ↩️ {loading ? 'Processing...' : 'Unpublish Article'}
          </button>
        )}

        {!canApprove && !canReject && !canUnpublish && (
          <p style={{ color: '#6b7280', fontStyle: 'italic', textAlign: 'center' }}>
            No actions available for this article status.
          </p>
        )}
      </div>

      {/* Reject Modal */}
      <Modal
        isOpen={showRejectModal}
        title="Reject Article"
        onClose={() => setShowRejectModal(false)}
      >
        <div className="modal-body">
          <p>
            This will return the article to drafted state and notify the author to make revisions.
          </p>
          <p style={{ marginTop: '12px', marginBottom: '12px', fontWeight: '500' }}>
            Please provide feedback:
          </p>
          <textarea
            placeholder="What changes need to be made?"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
        </div>
        <div className="modal-footer">
          <button
            className="btn btn-secondary"
            onClick={() => setShowRejectModal(false)}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            className="btn btn-danger"
            onClick={handleReject}
            disabled={loading}
          >
            {loading ? 'Rejecting...' : 'Reject'}
          </button>
        </div>
      </Modal>

      {/* Unpublish Modal */}
      <Modal
        isOpen={showUnpublishModal}
        title="Unpublish Article"
        onClose={() => setShowUnpublishModal(false)}
      >
        <div className="modal-body">
          <div className="modal-warning">
            <strong>⚠️ Warning</strong>
            <p>This will revert the published article to drafted state. The change will be visible immediately to subscribers.</p>
          </div>
          <p>
            Are you sure you want to unpublish this article?
          </p>
        </div>
        <div className="modal-footer">
          <button
            className="btn btn-secondary"
            onClick={() => setShowUnpublishModal(false)}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            className="btn btn-warning"
            onClick={handleUnpublish}
            disabled={loading}
          >
            {loading ? 'Unpublishing...' : 'Unpublish'}
          </button>
        </div>
      </Modal>
    </div>
  );
}

export default ApprovalControls;
