import Discover from './pages/Discover.js';

/**
 * Minimal shell so the discovery feature runs standalone.
 * Person 1: replace with the real router/layout and mount <Discover /> at /discover.
 */
export default function App() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Discover />
    </div>
  );
}
