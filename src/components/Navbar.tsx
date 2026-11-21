import { ArrowUpRight, House } from 'lucide-react';
import { Link } from 'react-router-dom';

interface NavbarProps {
  embedded?: boolean;
}

export function Navbar({ embedded = false }: NavbarProps) {
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
          <a className="nav-how" href="/#how-it-works" target={target}>How it works</a>
          <Link className="button button-outline nav-action" to="/signup" target={target}>
            <span className="nav-action-long">Create a profile</span>
            <span className="nav-action-short">Join</span>
            <ArrowUpRight aria-hidden="true" size={16} />
          </Link>
        </nav>
      </header>
    </>
  );
}
