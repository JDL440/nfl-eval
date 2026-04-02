import { describe, it, expect } from 'vitest';
import { calcNextRunAt } from '../../src/services/recurring-scheduler.js';

describe('calcNextRunAt', () => {
  it('returns the correct next Tuesday when called on a Monday', () => {
    // Monday 2025-07-14 08:00:00 UTC
    const after = new Date('2025-07-14T08:00:00Z');
    const next = calcNextRunAt(2, '09:00', after); // weekday=2 = Tuesday
    expect(next.getUTCDay()).toBe(2);
    expect(next.getUTCHours()).toBe(9);
    expect(next.getUTCMinutes()).toBe(0);
    // Should be Tuesday July 15
    expect(next.toISOString().slice(0, 10)).toBe('2025-07-15');
  });

  it('returns the next week when called on Tuesday after the slot time', () => {
    // Tuesday 2025-07-15 10:00:00 UTC (after 09:00)
    const after = new Date('2025-07-15T10:00:00Z');
    const next = calcNextRunAt(2, '09:00', after); // weekday=2 = Tuesday
    expect(next.toISOString().slice(0, 10)).toBe('2025-07-22'); // next Tuesday
  });

  it('returns same-day slot when called before the slot time on that day', () => {
    // Tuesday 2025-07-15 08:00:00 UTC (before 09:00)
    const after = new Date('2025-07-15T08:00:00Z');
    const next = calcNextRunAt(2, '09:00', after);
    expect(next.toISOString().slice(0, 10)).toBe('2025-07-15');
    expect(next.getUTCHours()).toBe(9);
  });

  it('returns correct next Thursday from a Tuesday', () => {
    // Tuesday 2025-07-15 09:00:00 UTC
    const after = new Date('2025-07-15T09:00:00Z');
    const next = calcNextRunAt(4, '10:00', after); // weekday=4 = Thursday
    expect(next.toISOString().slice(0, 10)).toBe('2025-07-17');
    expect(next.getUTCDay()).toBe(4);
  });

  it('Tuesday accessible (depth 1) vs Thursday deep dive (depth 3) produce different next dates', () => {
    const after = new Date('2025-07-14T00:00:00Z'); // Monday
    const tuesdayNext = calcNextRunAt(2, '09:00', after);
    const thursdayNext = calcNextRunAt(4, '10:00', after);
    expect(tuesdayNext.getUTCDay()).toBe(2);
    expect(thursdayNext.getUTCDay()).toBe(4);
    expect(tuesdayNext < thursdayNext).toBe(true);
  });

  it('handles time string with leading zero', () => {
    const after = new Date('2025-07-14T08:00:00Z');
    const next = calcNextRunAt(2, '09:30', after);
    expect(next.getUTCHours()).toBe(9);
    expect(next.getUTCMinutes()).toBe(30);
  });

  it('handles midnight time', () => {
    const after = new Date('2025-07-14T08:00:00Z');
    const next = calcNextRunAt(2, '00:00', after);
    expect(next.getUTCHours()).toBe(0);
    expect(next.getUTCMinutes()).toBe(0);
  });
});
