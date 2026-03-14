import { useState } from 'react';

export default function ApprovalControls({ job, onApprove, onReject, onUnpublish }) {
  const [showModal, setShowModal] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  if (!job) return null;

  const canApprove = ['drafted', 'ready_for_review'].includes(job.status);
  const canReject = ['drafted', 'ready_for_review', 'approved'].includes(job.status);
  const canUnpublish = job.status === 'published';

  const handleApprove = () => {
    onApprove(job.id);
    setShowModal(null);
  };

  const handleReject = () => {
    onReject(job.id, rejectReason);
    setShowModal(null);
    setRejectReason('');
  };

  const handleUnpublish = () => {
    onUnpublish(job.id);
    setShowModal(null);
  };

  return (
    <div className="card">
      <div className="card-header">
        <h2>Approval Controls</h2>
      </div>

      <div className="btn-group">
        {canApprove && (
          <button className="btn btn-success" onClick={() => setShowModal('approve')}>
            ✅ Approve
          </button>
        )}
        {canReject && (
          <button className="btn btn-danger" onClick={() => setShowModal('reject')}>
            ❌ Reject
          </button>
        )}
        {canUnpublish && (
          <button className="btn btn-warning" onClick={() => setShowModal('unpublish')}>
            ↩️ Unpublish
          </button>
        )}
        {!canApprove && !canReject && !canUnpublish && (
          <p style={{ color: '#6b7280' }}>No actions available for this article</p>
        )}
      </div>

      {showModal === 'approve' && (
        <div className="modal-overlay" onClick={() => setShowModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Approve Article</h3>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to approve this article?</p>
              <p><strong>{job.data.title}</strong></p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(null)}>Cancel</button>
              <button className="btn btn-success" onClick={handleApprove}>Confirm Approve</button>
            </div>
          </div>
        </div>
      )}

      {showModal === 'reject' && (
        <div className="modal-overlay" onClick={() => setShowModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Reject Article</h3>
            </div>
            <div className="modal-body">
              <p>Please provide a reason for rejecting this article:</p>
              <p><strong>{job.data.title}</strong></p>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Enter rejection reason..."
              />
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleReject}>Confirm Reject</button>
            </div>
          </div>
        </div>
      )}

      {showModal === 'unpublish' && (
        <div className="modal-overlay" onClick={() => setShowModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Unpublish Article</h3>
            </div>
            <div className="modal-body">
              <div className="modal-warning">
                ⚠️ Warning: This will remove the article from Substack and revert it to drafted status.
              </div>
              <p><strong>{job.data.title}</strong></p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(null)}>Cancel</button>
              <button className="btn btn-warning" onClick={handleUnpublish}>Confirm Unpublish</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
