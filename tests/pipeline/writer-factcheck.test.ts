import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  executeWriterFactCheckPass,
  fetchApprovedSource,
  resolveApprovedSource,
} from '../../src/pipeline/writer-factcheck.js';

describe('writer fact-check approved-source resolver', () => {
  it('treats official team primary pages as official_primary sources', () => {
    const resolved = resolveApprovedSource('https://www.seahawks.com/team/roster/');

    expect(resolved).toEqual({
      url: 'https://www.seahawks.com/team/roster/',
      domain: 'seahawks.com',
      sourceClass: 'official_primary',
      sourceLabel: 'Official team source',
    });
  });

  it('fetches official team primary pages through the approved-source helper', async () => {
    const fetchMock = vi.fn(async () => new Response(
      '<html><head><title>Seattle Seahawks Roster</title></head><body>Roster</body></html>',
      {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      },
    ));

    const result = await fetchApprovedSource('https://www.seahawks.com/team/roster/', {
      fetchImpl: fetchMock as typeof fetch,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(true);
    expect(result.candidate?.sourceClass).toBe('official_primary');
    expect(result.title).toBe('Seattle Seahawks Roster');
  });
});

describe('writer fact-check wall-clock budget', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reports wall-clock exhaustion when the remaining stage budget aborts an in-flight fetch', async () => {
    vi.useFakeTimers();

    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_, reject) => {
      const signal = init?.signal;
      if (!signal) {
        reject(new Error('missing signal'));
        return;
      }
      const rejectOnAbort = () => reject(Object.assign(new Error('timed out'), { name: 'AbortError' }));
      if (signal.aborted) {
        rejectOnAbort();
        return;
      }
      signal.addEventListener('abort', rejectOnAbort, { once: true });
    }));

    const resultPromise = fetchApprovedSource('https://www.seahawks.com/team/transactions/', {
      fetchImpl: fetchMock as typeof fetch,
      timeoutMs: 4_000,
      remainingWallClockMs: 500,
    });

    await vi.advanceTimersByTimeAsync(500);
    const result = await resultPromise;

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(false);
    expect(result.attemptedFetch).toBe(true);
    expect(result.error).toBe('wall_clock_exhausted');
    expect(result.wallClockLimited).toBe(true);
  });

  it('caps a slow fetch to the remaining wall-clock budget', async () => {
    vi.useFakeTimers();

    const start = new Date('2026-03-25T00:00:00.000Z');
    const nearBudgetEnd = new Date(start.getTime() + (5 * 60_000) - 500);
    const budgetEnd = new Date(start.getTime() + (5 * 60_000));
    const nowSequence = [start, nearBudgetEnd, budgetEnd, budgetEnd];
    let nowIndex = 0;

    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_, reject) => {
      const signal = init?.signal;
      if (!signal) {
        reject(new Error('missing signal'));
        return;
      }
      const rejectOnAbort = () => reject(Object.assign(new Error('timed out'), { name: 'AbortError' }));
      if (signal.aborted) {
        rejectOnAbort();
        return;
      }
      signal.addEventListener('abort', rejectOnAbort, { once: true });
    }));

    const passPromise = executeWriterFactCheckPass({
      articleTitle: 'Budget test',
      mode: 'fresh_draft',
      availableArtifacts: ['panel-factcheck.md'],
      urlEvidence: [
        {
          url: 'https://www.seahawks.com/team/transactions/',
          claim: 'Seattle roster move',
          artifactName: 'panel-factcheck.md',
        },
      ],
      fetchImpl: fetchMock as typeof fetch,
      now: () => nowSequence[Math.min(nowIndex++, nowSequence.length - 1)],
    });

    await vi.advanceTimersByTimeAsync(500);
    const report = await passPromise;

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(report.omittedClaims).toHaveLength(1);
    expect(report.omittedClaims[0]?.note).toContain('Wall-clock budget expired during approved-source fetch.');
    expect(report.usage.externalChecksUsed).toBe(1);
    expect(report.usage.wallClockMs).toBe(5 * 60_000);
    expect(report.usage.remainingStatus).toBe('exhausted');
  });
});
