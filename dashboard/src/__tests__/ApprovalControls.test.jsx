import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ApprovalControls from '../components/ApprovalControls';
import * as queueClient from '../api/queueClient';

jest.mock('../api/queueClient', () => ({
  publishArticle: jest.fn(),
}));

const makeJob = (overrides = {}) => ({
  id: 'job-1',
  status: 'drafted',
  data: {
    title: 'Test Article Title',
    summary: 'A test summary',
    body: 'Article body text',
    significance: 8.0,
  },
  ...overrides,
});

describe('ApprovalControls - Publish Flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('shows Publish button for approved articles', () => {
    render(<ApprovalControls job={makeJob({ status: 'approved' })} onApprove={jest.fn()} onReject={jest.fn()} onUnpublish={jest.fn()} />);
    expect(screen.getByText(/Publish to Substack/)).toBeInTheDocument();
  });

  test('does not show Publish button for drafted articles', () => {
    render(<ApprovalControls job={makeJob({ status: 'drafted' })} onApprove={jest.fn()} onReject={jest.fn()} onUnpublish={jest.fn()} />);
    expect(screen.queryByText(/Publish to Substack/)).not.toBeInTheDocument();
  });

  test('opens publish modal with preview on click', () => {
    render(<ApprovalControls job={makeJob({ status: 'approved' })} onApprove={jest.fn()} onReject={jest.fn()} onUnpublish={jest.fn()} />);
    fireEvent.click(screen.getByText(/Publish to Substack/));
    expect(screen.getByText('Ready to publish this article to Substack:')).toBeInTheDocument();
    expect(screen.getByText('Test Article Title')).toBeInTheDocument();
  });

  test('calls publishArticle on Confirm Publish', async () => {
    const url = 'https://seahawksbotblog.substack.com/p/test';
    queueClient.publishArticle.mockResolvedValue({ id: 'job-1', substackUrl: url });
    render(<ApprovalControls job={makeJob({ status: 'approved' })} onApprove={jest.fn()} onReject={jest.fn()} onUnpublish={jest.fn()} />);
    fireEvent.click(screen.getByText(/Publish to Substack/));
    fireEvent.click(screen.getByText('Confirm Publish'));
    await waitFor(() => {
      expect(queueClient.publishArticle).toHaveBeenCalledWith('job-1');
    });
  });

  test('approve transitions to publish-confirm modal', async () => {
    const onApprove = jest.fn().mockResolvedValue();
    render(<ApprovalControls job={makeJob({ status: 'drafted' })} onApprove={onApprove} onReject={jest.fn()} onUnpublish={jest.fn()} />);
    fireEvent.click(screen.getByText(/Approve/));
    expect(screen.getByText('Approve Article')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Confirm Approve'));
    await waitFor(() => {
      expect(onApprove).toHaveBeenCalledWith('job-1');
    });
    await waitFor(() => {
      expect(screen.getByText('Publish to Substack')).toBeInTheDocument();
    });
  });

  test('cancel closes publish modal', () => {
    render(<ApprovalControls job={makeJob({ status: 'approved' })} onApprove={jest.fn()} onReject={jest.fn()} onUnpublish={jest.fn()} />);
    fireEvent.click(screen.getByText(/Publish to Substack/));
    expect(screen.getByText('Ready to publish this article to Substack:')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByText('Ready to publish this article to Substack:')).not.toBeInTheDocument();
  });

  test('shows success URL after publish', async () => {
    const url = 'https://seahawksbotblog.substack.com/p/test-article';
    queueClient.publishArticle.mockResolvedValue({ id: 'job-1', substackUrl: url });
    render(<ApprovalControls job={makeJob({ status: 'approved' })} onApprove={jest.fn()} onReject={jest.fn()} onUnpublish={jest.fn()} />);
    fireEvent.click(screen.getByText(/Publish to Substack/));
    fireEvent.click(screen.getByText('Confirm Publish'));
    await waitFor(() => {
      expect(screen.getByText(url)).toBeInTheDocument();
    });
    expect(screen.getByText(/Successfully published/)).toBeInTheDocument();
  });

  test('shows error with retry on publish failure', async () => {
    queueClient.publishArticle.mockRejectedValue(new Error('API error'));
    render(<ApprovalControls job={makeJob({ status: 'approved' })} onApprove={jest.fn()} onReject={jest.fn()} onUnpublish={jest.fn()} />);
    fireEvent.click(screen.getByText(/Publish to Substack/));
    fireEvent.click(screen.getByText('Confirm Publish'));
    await waitFor(() => {
      expect(screen.getByText(/Publishing failed/)).toBeInTheDocument();
    });
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  test('calls onPublished after successful publish', async () => {
    const url = 'https://seahawksbotblog.substack.com/p/test';
    const result = { id: 'job-1', substackUrl: url };
    queueClient.publishArticle.mockResolvedValue(result);
    const onPublished = jest.fn();
    render(<ApprovalControls job={makeJob({ status: 'approved' })} onApprove={jest.fn()} onReject={jest.fn()} onUnpublish={jest.fn()} onPublished={onPublished} />);
    fireEvent.click(screen.getByText(/Publish to Substack/));
    fireEvent.click(screen.getByText('Confirm Publish'));
    await waitFor(() => {
      expect(onPublished).toHaveBeenCalledWith(result);
    });
  });
});

describe('ApprovalControls - M2 Regression', () => {
  test('approve modal works for drafted articles', () => {
    render(<ApprovalControls job={makeJob()} onApprove={jest.fn()} onReject={jest.fn()} onUnpublish={jest.fn()} />);
    fireEvent.click(screen.getByText(/Approve/));
    expect(screen.getByText('Approve Article')).toBeInTheDocument();
  });

  test('reject modal works with reason', () => {
    render(<ApprovalControls job={makeJob()} onApprove={jest.fn()} onReject={jest.fn()} onUnpublish={jest.fn()} />);
    fireEvent.click(screen.getByText(/Reject/));
    expect(screen.getByText('Reject Article')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter rejection reason...')).toBeInTheDocument();
  });

  test('unpublish modal works for published articles', () => {
    render(<ApprovalControls job={makeJob({ status: 'published' })} onApprove={jest.fn()} onReject={jest.fn()} onUnpublish={jest.fn()} />);
    fireEvent.click(screen.getByText(/Unpublish/));
    expect(screen.getByText('Unpublish Article')).toBeInTheDocument();
  });

  test('returns null when no job', () => {
    const { container } = render(<ApprovalControls job={null} onApprove={jest.fn()} onReject={jest.fn()} onUnpublish={jest.fn()} />);
    expect(container.innerHTML).toBe('');
  });
});
