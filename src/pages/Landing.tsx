import { ArrowDown, ArrowRight, BadgeCheck, House, SlidersHorizontal, UsersRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AppPreview } from '../components/AppPreview';

const steps = [
  { icon: BadgeCheck, title: 'Verify your university email', description: 'Sign up with your university email to confirm you own that address.' },
  { icon: SlidersHorizontal, title: 'Share what you’re looking for', description: 'Set your budget, move-in date, and preferences for everyday life.' },
  { icon: UsersRound, title: 'Meet potential roommates', description: 'Compare profiles and see where your housing plans and habits line up.' },
];

export function Landing() {
  return (
    <main id="main-content">
      <section className="shell hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <h1 id="hero-title">Find your place.<br /><span>Find your people.</span></h1>
          <p>Find college roommates who fit your budget, move-in plans, and the way you like to live.</p>
          <div className="hero-actions">
            <Link className="button button-primary" to="/discover">Explore roommates <ArrowRight size={18} aria-hidden="true" /></Link>
            <a className="button button-outline" href="#preview">Try the preview <ArrowDown size={17} aria-hidden="true" /></a>
          </div>
        </div>
        <div className="hero-visual">
          <img src="/moving-day.jpg" alt="Three friends smiling as they carry moving boxes" fetchPriority="high" />
        </div>
      </section>

      <section className="housing-paths" aria-label="What are you looking for?">
        <div className="shell housing-grid">
          <Link className="housing-path" to="/signup?housing=need_room">
            <span className="feature-icon"><UsersRound aria-hidden="true" size={23} /></span>
            <span><strong>Looking for a place</strong><span>Find others to look for housing with.</span></span>
            <ArrowRight size={20} aria-hidden="true" />
          </Link>
          <Link className="housing-path" to="/signup?housing=have_room">
            <span className="feature-icon feature-icon-peach"><House aria-hidden="true" size={23} /></span>
            <span><strong>Have a room</strong><span>Find a roommate for an available room.</span></span>
            <ArrowRight size={20} aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section id="how-it-works" className="shell steps" aria-labelledby="steps-title">
        <h2 id="steps-title">How Roomie works</h2>
        <div className="steps-grid">
          {steps.map(({ icon: Icon, title, description }) => (
            <div className="step" key={title}>
              <Icon size={25} aria-hidden="true" />
              <h3>{title}</h3>
              <p>{description}</p>
            </div>
          ))}
        </div>
      </section>

      <AppPreview />
    </main>
  );
}
