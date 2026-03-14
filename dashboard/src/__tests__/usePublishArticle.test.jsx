import { renderHook, act } from '@testing-library/react';
import usePublishArticle from '../hooks/usePublishArticle';
import * as queueClient from '../api/queueClient';

jest.mock('../api/queueClient', () => ({
  publishArticle: jest.fn(),
}));

describe('usePublishArticle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('initial state has no loading, error, or URL', () => {
    const { result } = renderHook(() => usePublishArticle());
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.substackUrl).toBeNull();
  });

  test('sets loading true during publish', async () => {
    let resolvePublish;
    queueClient.publishArticle.mockImplementation(() => new Promise(r => { resolvePublish = r; }));
    const { result } = renderHook(() => usePublishArticle());

    let publishPromise;
    act(() => {
      publishPromise = result.current.publish('job-1');
    });
    expect(result.current.loading).toBe(true);

    await act(async () => {
      resolvePublish({ id: 'job-1', substackUrl: 'https://example.substack.com/p/test' });
      await publishPromise;
    });
    expect(result.current.loading).toBe(false);
  });

  test('sets substackUrl on success', async () => {
    const url = 'https://seahawksbotblog.substack.com/p/test-article';
    queueClient.publishArticle.mockResolvedValue({ id: 'job-1', substackUrl: url });
    const { result } = renderHook(() => usePublishArticle());

    await act(async () => {
      await result.current.publish('job-1');
    });
    expect(result.current.substackUrl).toBe(url);
    expect(result.current.error).toBeNull();
  });

  test('sets error on failure', async () => {
    queueClient.publishArticle.mockRejectedValue(new Error('Substack API error'));
    const { result } = renderHook(() => usePublishArticle());

    await act(async () => {
      await result.current.publish('job-1');
    });
    expect(result.current.error).toBe('Substack API error');
    expect(result.current.substackUrl).toBeNull();
  });

  test('reset clears all state', async () => {
    const url = 'https://seahawksbotblog.substack.com/p/test';
    queueClient.publishArticle.mockResolvedValue({ id: 'job-1', substackUrl: url });
    const { result } = renderHook(() => usePublishArticle());

    await act(async () => { await result.current.publish('job-1'); });
    expect(result.current.substackUrl).toBe(url);

    act(() => { result.current.reset(); });
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.substackUrl).toBeNull();
  });

  test('retry after error works', async () => {
    queueClient.publishArticle.mockRejectedValueOnce(new Error('fail'));
    const { result } = renderHook(() => usePublishArticle());

    await act(async () => { await result.current.publish('job-1'); });
    expect(result.current.error).toBe('fail');

    const url = 'https://seahawksbotblog.substack.com/p/retry';
    queueClient.publishArticle.mockResolvedValueOnce({ id: 'job-1', substackUrl: url });
    await act(async () => { await result.current.publish('job-1'); });
    expect(result.current.substackUrl).toBe(url);
    expect(result.current.error).toBeNull();
  });
});
