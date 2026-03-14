import { render, screen, fireEvent } from '@testing-library/react';
import ErrorBoundary from '../components/ErrorBoundary';

// Component that intentionally throws
function BrokenComponent({ shouldThrow }) {
  if (shouldThrow) {
    throw new Error('Test crash: component exploded');
  }
  return <div>Working fine</div>;
}

// Suppress React error boundary console output in tests
const originalError = console.error;
beforeAll(() => {
  console.error = (...args) => {
    if (/React will try to recreate|ErrorBoundary caught|The above error/.test(args[0]?.toString?.())) {
      return;
    }
    originalError.call(console, ...args);
  };
});
afterAll(() => {
  console.error = originalError;
});

describe('ErrorBoundary', () => {
  test('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <div>Hello World</div>
      </ErrorBoundary>
    );

    expect(screen.getByText('Hello World')).toBeTruthy();
  });

  test('renders fallback UI when child throws', () => {
    render(
      <ErrorBoundary>
        <BrokenComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeTruthy();
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText('Try Again')).toBeTruthy();
  });

  test('resets error state when Try Again is clicked', () => {
    // Use a flag that can be changed before reset
    let shouldThrow = true;
    function ThrowableComponent() {
      if (shouldThrow) throw new Error('Test crash');
      return <div>Working fine</div>;
    }

    render(
      <ErrorBoundary>
        <ThrowableComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeTruthy();

    // Stop throwing before reset
    shouldThrow = false;
    fireEvent.click(screen.getByText('Try Again'));

    expect(screen.getByText('Working fine')).toBeTruthy();
  });

  test('renders custom fallback when provided', () => {
    const customFallback = ({ error, resetError }) => (
      <div>
        <span>Custom error: {error.message}</span>
        <button onClick={resetError}>Reset</button>
      </div>
    );

    render(
      <ErrorBoundary fallback={customFallback}>
        <BrokenComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText(/Custom error: Test crash/)).toBeTruthy();
  });
});
