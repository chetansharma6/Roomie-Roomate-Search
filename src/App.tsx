import { lazy, Suspense, useLayoutEffect } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useSearchParams } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { DemoDiscover } from './demo/DemoDiscover';
import { Landing } from './pages/Landing';
import Discover from './pages/Discover';
import { useAuth } from './hooks/useAuth';
import { StudentDiscover } from './pages/AuthenticatedRoutes';
import { Onboarding } from './pages/Onboarding';
import { ProfileEditor } from './pages/ProfileEditor';
import { MessagesPage } from './pages/MessagesPage';

const SignIn = lazy(() => import('./pages/SignIn'));
function Signup({ redirectAfterSignIn = true }: { redirectAfterSignIn?: boolean }) {
  return (
    <Suspense fallback={<main className="shell route-notice" id="main-content" role="status">Loading sign-in…</main>}>
      <SignIn redirectAfterSignIn={redirectAfterSignIn} />
    </Suspense>
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

function DiscoveryRoute({ embedded, demo }: { embedded: boolean; demo: boolean }) {
  const { user, loading, destination, error } = useAuth();
  if (demo) return <DemoDiscover embedded={embedded} />;
  if (loading && !user) return <main className="shell route-notice" role="status">Restoring session…</main>;
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
  const demo = embedded || params.get('demo') === '1';
  const showSiteChrome = !discovering || (!demo && Boolean(user));

  const chromeClass = discovering && !demo && user ? 'student-desktop-chrome' : undefined;

  useLayoutEffect(() => {
    if (discovering) window.scrollTo(0, 0);
  }, [discovering]);

  return (
    <>
      {showSiteChrome && <div className={chromeClass}><Navbar /></div>}
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/discover" element={<DiscoveryRoute embedded={embedded} demo={demo} />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/auth" element={<Navigate to="/signup" replace />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/profile" element={<ProfileEditor />} />
        <Route path="/account" element={<Signup redirectAfterSignIn={false} />} />
        <Route path="/inbox" element={<MessagesPage />} />
        <Route path="/messages/:conversationId" element={<MessagesPage />} />
        <Route path="/matches" element={
          <main className="min-h-screen bg-slate-50 text-slate-900" id="main-content">
            <Discover />
          </main>
        } />
        <Route path="*" element={<PageNotFound />} />
      </Routes>
      {showSiteChrome && <footer className={`site-footer ${chromeClass ?? ''}`}><div className="shell">Roomie · HackJam 2026</div></footer>}
    </>
  );
}
