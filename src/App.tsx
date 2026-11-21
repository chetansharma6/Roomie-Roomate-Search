import { lazy, Suspense } from 'react';
import { Link, Route, Routes, useSearchParams } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { DemoDiscover } from './demo/DemoDiscover';
import { Landing } from './pages/Landing';
import Discover from './pages/Discover';

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

export function App() {
  const [params] = useSearchParams();
  const embedded = params.get('preview') === '1' && window.self !== window.top;

  return (
    <>
      <Navbar embedded={embedded} />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/discover" element={<DemoDiscover embedded={embedded} />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/matches" element={
          <main className="min-h-screen bg-slate-50 text-slate-900" id="main-content">
            <Discover />
          </main>
        } />
        <Route path="*" element={<PageNotFound />} />
      </Routes>
      {!embedded && <footer className="site-footer"><div className="shell">Roomie · HackJam 2026</div></footer>}
    </>
  );
}
