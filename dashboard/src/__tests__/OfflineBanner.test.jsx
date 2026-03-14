import { render, screen, act } from '@testing-library/react';
import OfflineBanner from '../components/OfflineBanner';

describe('OfflineBanner', () => {
  let originalOnLine;

  beforeEach(() => {
    originalOnLine = navigator.onLine;
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'onLine', {
      value: originalOnLine,
      configurable: true,
      writable: true,
    });
  });

  test('does not show banner when online', () => {
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      configurable: true,
    });

    const { container } = render(<OfflineBanner />);
    expect(container.querySelector('.offline-banner')).toBeNull();
  });

  test('shows banner when offline', () => {
    Object.defineProperty(navigator, 'onLine', {
      value: false,
      configurable: true,
    });

    render(<OfflineBanner />);
    expect(screen.getByText(/currently offline/i)).toBeTruthy();
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  test('shows banner when going offline', () => {
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      configurable: true,
    });

    render(<OfflineBanner />);
    expect(screen.queryByText(/currently offline/i)).toBeNull();

    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    expect(screen.getByText(/currently offline/i)).toBeTruthy();
  });

  test('hides banner when coming back online', () => {
    Object.defineProperty(navigator, 'onLine', {
      value: false,
      configurable: true,
    });

    render(<OfflineBanner />);
    expect(screen.getByText(/currently offline/i)).toBeTruthy();

    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    expect(screen.queryByText(/currently offline/i)).toBeNull();
  });
});
