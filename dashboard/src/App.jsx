import ErrorBoundary from './components/ErrorBoundary';
import OfflineBanner from './components/OfflineBanner';
import Dashboard from './pages/Dashboard';

export default function App() {
  return (
    <ErrorBoundary>
      <OfflineBanner />
      <Dashboard />
    </ErrorBoundary>
  );
}
