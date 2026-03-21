import { describe, it, expect, vi, afterEach } from 'vitest';
import { formatDate } from '../../src/dashboard/views/layout.js';

describe('formatDate', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('returns — for null', () => {
    expect(formatDate(null)).toBe('—');
  });

  it('handles SQLite datetime format (space separator, no Z)', () => {
    // SQLite datetime('now') produces 'YYYY-MM-DD HH:MM:SS' in UTC
    vi.useFakeTimers({ now: new Date('2026-03-21T12:00:00Z') });
    const result = formatDate('2026-03-21 10:00:00');
    expect(result).toBe('2h ago');
  });

  it('handles ISO 8601 format with T and Z', () => {
    vi.useFakeTimers({ now: new Date('2026-03-21T12:00:00Z') });
    expect(formatDate('2026-03-21T11:30:00Z')).toBe('30m ago');
  });

  it('shows "just now" for very recent timestamps', () => {
    vi.useFakeTimers({ now: new Date('2026-03-21T12:00:30Z') });
    expect(formatDate('2026-03-21 12:00:00')).toBe('just now');
  });

  it('shows days ago for older timestamps', () => {
    vi.useFakeTimers({ now: new Date('2026-03-25T12:00:00Z') });
    expect(formatDate('2026-03-21 12:00:00')).toBe('4d ago');
  });
});
