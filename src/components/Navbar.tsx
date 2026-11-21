import { House } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

interface NavbarProps {
  embedded?: boolean;
}

export function Navbar({ embedded = false }: NavbarProps) {
  const { user, destination } = useAuth();
  const target = embedded ? '_top' : undefined;

  return (
    <>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <header className="site-header">
        <nav className="shell navbar" aria-label="Main navigation">
          <Link className="wordmark" to="/" target={target}>
            <span className="brand-icon"><House aria-hidden="true" size={21} strokeWidth={2.5} /></span>
            Roomie<span className="brand-dot">.</span>
          </Link>
          <div className="nav-links">
            <a className="nav-how" href="/#how-it-works" target={target}>How it works</a>
            <NavLink to="/discover" target={target}>Discover</NavLink>
            {user && <NavLink to="/account" target={target}>Account</NavLink>}
          </div>
          <Link className="button button-outline nav-action" to={user ? (destination === '/onboarding' ? '/onboarding' : '/profile') : '/signup'} target={target}>
            <span className="nav-action-long">{user ? 'My profile' : 'Create a profile'}</span>
            <span className="nav-action-short">{user ? 'Profile' : 'Join'}</span>
          </Link>
        </nav>
      </header>
    </>
  );
}
