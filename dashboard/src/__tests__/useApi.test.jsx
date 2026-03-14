import { renderHook, act } from '@testing-library/react';
import useApi from '../hooks/useApi';

describe('useApi', () => {
  test('initial state has no data, not loading, no error', () => {
    const mockFn = jest.fn();
    const { result } = renderHook(() => useApi(mockFn));

    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  test('loading state transitions correctly on success', async () => {
    const mockData = [{ id: 1, name: 'test' }];
    const mockFn = jest.fn().mockResolvedValue(mockData);

    const { result } = renderHook(() => useApi(mockFn));

    let promise;
    act(() => {
      promise = result.current.execute();
    });

    // Should be loading
    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBeNull();

    await act(async () => {
      await promise;
    });

    // After resolve
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toEqual(mockData);
    expect(result.current.error).toBeNull();
  });

  test('error state transitions correctly on failure', async () => {
    const mockError = new Error('Network error');
    const mockFn = jest.fn().mockRejectedValue(mockError);

    const { result } = renderHook(() => useApi(mockFn));

    let promise;
    act(() => {
      promise = result.current.execute().catch(() => {});
    });

    await act(async () => {
      await promise;
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBe(mockError);
  });

  test('immediate option triggers fetch on mount', async () => {
    const mockData = { status: 'ok' };
    const mockFn = jest.fn().mockResolvedValue(mockData);

    let hookResult;
    await act(async () => {
      const { result } = renderHook(() => useApi(mockFn, { immediate: true }));
      hookResult = result;
    });

    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(hookResult.current.data).toEqual(mockData);
  });

  test('reset clears all state', async () => {
    const mockFn = jest.fn().mockResolvedValue({ id: 1 });

    const { result } = renderHook(() => useApi(mockFn));

    await act(async () => {
      await result.current.execute();
    });

    expect(result.current.data).toEqual({ id: 1 });

    act(() => {
      result.current.reset();
    });

    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  test('passes arguments through to api function', async () => {
    const mockFn = jest.fn().mockResolvedValue('ok');

    const { result } = renderHook(() => useApi(mockFn));

    await act(async () => {
      await result.current.execute('arg1', 'arg2');
    });

    expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2');
  });

  test('calls onSuccess callback', async () => {
    const onSuccess = jest.fn();
    const mockFn = jest.fn().mockResolvedValue('data');

    const { result } = renderHook(() => useApi(mockFn, { onSuccess }));

    await act(async () => {
      await result.current.execute();
    });

    expect(onSuccess).toHaveBeenCalledWith('data');
  });

  test('calls onError callback', async () => {
    const onError = jest.fn();
    const err = new Error('fail');
    const mockFn = jest.fn().mockRejectedValue(err);

    const { result } = renderHook(() => useApi(mockFn, { onError }));

    await act(async () => {
      await result.current.execute().catch(() => {});
    });

    expect(onError).toHaveBeenCalledWith(err);
  });
});
