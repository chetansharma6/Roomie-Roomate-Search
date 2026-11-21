import { ArrowUpRight, House } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useUnreadCount } from '../hooks/useMessaging';

interface NavbarProps {
  embedded?: boolean;
}

export function Navbar({ embedded = false }: NavbarProps) {
  const target = embedded ? '_top' : undefined;
  const { user } = useAuth();
  const unread = useUnreadCount(Boolean(user) && !embedded);

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
          <div className="nav-end">
            {user && (
              <Link className="nav-inbox" to="/inbox" target={target}>
                Inbox
                {unread > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-roomie-teal px-1.5 text-xs font-bold text-white"
                  aria-label={`${unread} unread messages`}>{unread > 99 ? '99+' : unread}</span>}
              </Link>
            )}
            <Link className={`button button-outline nav-action${user ? ' nav-action-signed-in' : ''}`} to="/signup" target={target}>
              <span className="nav-action-long">Create a profile</span>
              <span className="nav-action-short">Join</span>
              <ArrowUpRight aria-hidden="true" size={16} />
            </Link>
          </div>
        </nav>
      </header>
    </>
  );
}
