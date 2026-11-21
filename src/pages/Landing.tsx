import { BadgeCheck, Check, House, SlidersHorizontal, UsersRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AppPreview } from '../components/AppPreview';

const steps = [
  { icon: BadgeCheck, title: 'Verify your university email', description: 'Sign up with your university email to confirm you own that address.' },
  { icon: SlidersHorizontal, title: 'Share what you’re looking for', description: 'Set your budget, move-in date, and preferences for everyday life.' },
  { icon: UsersRound, title: 'Meet potential roommates', description: 'Compare profiles and see where your housing plans and habits line up.' },
];

export function Landing() {
  return (
    <main id="main-content" className="landing-page">
      <section className="shell hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <span className="section-kicker"><span /> A better way to live together</span>
          <h1 id="hero-title">Find your place.<br /><span>Find your people.</span></h1>
          <p>Your next chapter starts with the right roommate. Meet students who share your budget, your plans, and your kind of everyday.</p>
          <div className="hero-actions">
            <Link className="button button-primary hero-discover" to="/discover">Find my roommate</Link>
            <a className="button button-outline" href="#preview">Take a look around</a>
          </div>
          <p className="hero-reassurance"><BadgeCheck size={17} aria-hidden="true" /> University email verification <span>·</span> Built around your lifestyle</p>
        </div>
        <div className="hero-visual">
          <img src="/moving-day.jpg" alt="Three friends smiling as they carry moving boxes" fetchPriority="high" />
          <div className="hero-photo-caption"><span className="caption-icon"><House size={20} aria-hidden="true" /></span><span><strong>More than a shared address.</strong><span>A place to feel at home.</span></span></div>
        </div>
      </section>

      <section className="housing-paths" aria-label="What are you looking for?">
        <div className="shell housing-grid">
          <Link className="housing-path" to="/signup?housing=need_room">
            <span className="feature-icon"><UsersRound aria-hidden="true" size={23} /></span>
            <span><strong>Looking for a place</strong><span>Find others to look for housing with.</span></span>
            <span className="path-action">Get started</span>
          </Link>
          <Link className="housing-path" to="/signup?housing=have_room">
            <span className="feature-icon feature-icon-peach"><House aria-hidden="true" size={23} /></span>
            <span><strong>Have a room</strong><span>Find a roommate for an available room.</span></span>
            <span className="path-action">Get started</span>
          </Link>
        </div>
      </section>

      <section id="how-it-works" className="shell steps" aria-labelledby="steps-title">
        <div className="section-intro"><span className="section-kicker">Less guesswork. More connection.</span><h2 id="steps-title">Good roommates start<br />with the little things.</h2><p>From quiet mornings to late-night study sessions, find someone who fits the way you live.</p></div>
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
      <section className="shell landing-invitation" aria-labelledby="invitation-title"><Check size={28} aria-hidden="true" /><h2 id="invitation-title">Make room for your next chapter.</h2><p>Your habits. Your priorities. Your people.</p><Link className="button button-primary" to="/signup">Create my profile</Link></section>
    </main>
  );
}
