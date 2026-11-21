import { lazy, Suspense, useLayoutEffect } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useSearchParams } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { DemoDiscover } from './demo/DemoDiscover';
import { Landing } from './pages/Landing';
import Discover from './pages/Discover';
import { useAuth } from './hooks/useAuth';
import { Onboarding, StudentDiscover } from './pages/AuthenticatedRoutes';

const SignIn = lazy(() => import('./pages/SignIn'));
const hasSupabase = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
);

function Signup() {
  return hasSupabase ? (
    <Suspense fallback={<main className="shell route-notice" id="main-content" role="status">Loading sign-in…</main>}>
      <SignIn />
    </Suspense>
  ) : <SignupPlaceholder />;
}

function SignupPlaceholder() {
  const [params] = useSearchParams();
  const housing = params.get('housing');
  const titles = {
    need_room: 'Looking for a place?',
    have_room: 'Have a room to fill?',
  };

  return (
    <main className="shell route-notice" id="main-content">
      <h1>{housing === 'need_room' || housing === 'have_room' ? titles[housing] : 'Create a profile'}</h1>
      <p>University email sign-up is coming soon. You can explore the example roommate profiles in the meantime.</p>
      <Link className="button button-primary" to="/discover">Explore demo profiles</Link>
    </main>
  );
}

function PageNotFound() {
  return (
    <main className="shell route-notice" id="main-content">
      <h1>Page not found</h1>
      <Link className="button button-primary" to="/">Back to Roomie</Link>
    </main>
  );
}

function DiscoveryRoute({ embedded }: { embedded: boolean }) {
  const { user, loading, destination, error } = useAuth();
  if (embedded) return <DemoDiscover embedded />;
  if (loading) return <main className="shell route-notice" role="status">Restoring session…</main>;
  if (error) return <Navigate to="/signup" replace />;
  if (!user) return <DemoDiscover embedded={embedded} />;
  if (destination === '/onboarding') return <Navigate to="/onboarding" replace />;
  return <StudentDiscover />;
}

export function App() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const discovering = useLocation().pathname.replace(/\/+$/, '').toLowerCase() === '/discover';
  const embedded = discovering && params.get('preview') === '1' && window.self !== window.top;
  const showSiteChrome = !discovering || (!embedded && Boolean(user));

  useLayoutEffect(() => {
    if (discovering) window.scrollTo(0, 0);
  }, [discovering]);

  return (
    <>
      {showSiteChrome && <Navbar />}
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/discover" element={<DiscoveryRoute embedded={embedded} />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/auth" element={<Navigate to="/signup" replace />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/account" element={hasSupabase ? <Suspense fallback={<main role="status">Loading account…</main>}><SignIn redirectAfterSignIn={false} /></Suspense> : <SignupPlaceholder />} />
        <Route path="/matches" element={
          <main className="min-h-screen bg-slate-50 text-slate-900" id="main-content">
            <Discover />
          </main>
        } />
        <Route path="*" element={<PageNotFound />} />
      </Routes>
      {showSiteChrome && <footer className="site-footer"><div className="shell">Roomie · HackJam 2026</div></footer>}
    </>
  );
}
