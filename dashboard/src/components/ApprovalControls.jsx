import { useState } from 'react';
import usePublishArticle from '../hooks/usePublishArticle';

export default function ApprovalControls({ job, onApprove, onReject, onUnpublish, onPublished }) {
  const [showModal, setShowModal] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const { publish, loading: publishLoading, error: publishError, substackUrl, reset: resetPublish } = usePublishArticle();

  if (!job) return null;

  const canApprove = ['drafted', 'ready_for_review'].includes(job.status);
  const canReject = ['drafted', 'ready_for_review', 'approved'].includes(job.status);
  const canUnpublish = job.status === 'published';
  const canPublish = job.status === 'approved';

  const handleApprove = async () => {
    await onApprove(job.id);
    setShowModal('publish-confirm');
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

  const handlePublish = async () => {
    const result = await publish(job.id);
    if (result && onPublished) {
      onPublished(result);
    }
  };

  const handleClosePublish = () => {
    resetPublish();
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
            {'\u2705'} Approve
          </button>
        )}
        {canPublish && (
          <button className="btn btn-primary" onClick={() => { resetPublish(); setShowModal('publish-confirm'); }}>
            {'\U0001f680'} Publish to Substack
          </button>
        )}
        {canReject && (
          <button className="btn btn-danger" onClick={() => setShowModal('reject')}>
            {'\u274c'} Reject
          </button>
        )}
        {canUnpublish && (
          <button className="btn btn-warning" onClick={() => setShowModal('unpublish')}>
            {'\u21a9\ufe0f'} Unpublish
          </button>
        )}
        {!canApprove && !canReject && !canUnpublish && !canPublish && (
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
                {'\u26a0\ufe0f'} Warning: This will remove the article from Substack and revert it to drafted status.
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

      {showModal === 'publish-confirm' && (
        <div className="modal-overlay" onClick={!publishLoading ? handleClosePublish : undefined}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Publish to Substack</h3>
            </div>
            <div className="modal-body">
              {!publishLoading && !substackUrl && !publishError && (
                <div className="publish-preview">
                  <p>Ready to publish this article to Substack:</p>
                  <p><strong>{job.data.title}</strong></p>
                  <p className="text-muted">{job.data.summary}</p>
                </div>
              )}
              {publishLoading && (
                <div className="publish-loading">
                  <div className="loader loader-large" />
                  <p>Publishing to Substack...</p>
                </div>
              )}
              {substackUrl && (
                <div className="publish-success">
                  <p>{'\u2705'} Successfully published!</p>
                  <a href={substackUrl} target="_blank" rel="noopener noreferrer" className="publish-url">
                    {substackUrl}
                  </a>
                </div>
              )}
              {publishError && (
                <div className="publish-error">
                  <p>{'\u274c'} Publishing failed</p>
                  <p className="text-muted">{publishError}</p>
                </div>
              )}
            </div>
            <div className="modal-footer">
              {!publishLoading && !substackUrl && !publishError && (
                <>
                  <button className="btn btn-secondary" onClick={handleClosePublish}>Cancel</button>
                  <button className="btn btn-primary" onClick={handlePublish}>Confirm Publish</button>
                </>
              )}
              {substackUrl && (
                <button className="btn btn-secondary" onClick={handleClosePublish}>Close</button>
              )}
              {publishError && (
                <>
                  <button className="btn btn-secondary" onClick={handleClosePublish}>Cancel</button>
                  <button className="btn btn-primary" onClick={handlePublish}>Retry</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
