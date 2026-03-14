import { Component } from 'react';

const isDev = process.env.NODE_ENV !== 'production';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });

    if (isDev) {
      console.error('ErrorBoundary caught:', error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback({
          error: this.state.error,
          resetError: this.handleReset,
        });
      }

      return (
        <div className="error-fallback" role="alert">
          <div className="error-fallback-icon">⚠️</div>
          <h2>Something went wrong</h2>
          <p>
            The dashboard encountered an unexpected error. Please try refreshing
            the page or click the button below to reset.
          </p>
          <button className="btn btn-primary" onClick={this.handleReset}>
            Try Again
          </button>
          {isDev && this.state.error && (
            <div className="error-details">
              <strong>{this.state.error.toString()}</strong>
              {this.state.errorInfo?.componentStack && (
                <pre>{this.state.errorInfo.componentStack}</pre>
              )}
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
