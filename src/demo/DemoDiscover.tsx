import { ArrowLeft, Check, Heart, RotateCcw, X } from 'lucide-react';
import { closeDiscoverDetails } from '../components/discover/closeDiscoverDetails';
import { Link } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { cleanlinessLabels, ProfileCard, ProfileFacts, sleepLabels } from '../components/ProfileCard';
import type { RoommateProfile } from '../types/RoommateProfile';
import { SwipeTutorial, hasDismissedTutorial } from './SwipeTutorial';
import { useSwipeGesture, type SwipeDecision } from '../hooks/useSwipeGesture';
import { demoProfiles } from './profiles';
import { demoMatchFor } from './demoScoring';
import { CompatibilityBadge } from '../components/discover/CompatibilityBadge';
import { compatibilityBadgeModel } from '../lib/compatibilityBadge';

const exitDuration = 180;
// Deterministic baseline vs. the fictional demo student; computed once, keyed by profile id.
const demoMatches = new Map(demoProfiles.map((card) => [card.id, demoMatchFor(card)]));

export function DemoDiscover({ embedded }: { embedded: boolean }) {
  const [selected, setSelected] = useState<RoommateProfile | null>(null);
  const [decisions, setDecisions] = useState<Partial<Record<string, SwipeDecision>>>({});
  const [exit, setExit] = useState<SwipeDecision | null>(null);
  const [tutorialOpen, setTutorialOpen] = useState(() => !embedded && !hasDismissedTutorial());
  const stage = useRef<HTMLDivElement>(null);
  const tutorialButton = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const exitTimer = useRef<number | null>(null);
  const restartButton = useRef<HTMLButtonElement>(null);
  const passButton = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  const restoreTutorialFocus = useRef(false);

  const { dragging, offset, resetDrag, handlers } = useSwipeGesture(decide, tutorialOpen || Boolean(exit) || Boolean(selected));
  const profile = demoProfiles.find(({ id }) => !decisions[id]);

  useEffect(() => () => {
    if (exitTimer.current !== null) window.clearTimeout(exitTimer.current);
  }, []);

  useEffect(() => {
    if (!restoreFocus.current) return;
    (profile ? passButton.current : restartButton.current)?.focus({ preventScroll: true });
    restoreFocus.current = false;
  }, [profile]);

  useEffect(() => {
    if (tutorialOpen || !restoreTutorialFocus.current) return;
    tutorialButton.current?.focus({ preventScroll: true });
    restoreTutorialFocus.current = false;
  }, [tutorialOpen]);

  function showProfile(person: RoommateProfile) {
    if (exitTimer.current !== null) return;
    resetDrag();
    setSelected(person);
    dialog.current?.showModal();
  }

  function decide(decision: SwipeDecision, keepFocus = false) {
    if (!profile || tutorialOpen || selected || exitTimer.current !== null) return;
    const id = profile.id;
    resetDrag();

    function advance() {
      exitTimer.current = null;
      restoreFocus.current = keepFocus && Object.keys(decisions).length === demoProfiles.length - 1;
      setDecisions((previous) => ({ ...previous, [id]: decision }));
      setExit(null);
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      advance();
      return;
    }

    setExit(decision);
    exitTimer.current = window.setTimeout(advance, exitDuration);
  }

  return (
    <main className="discovery demo-discovery" id="main-content">
      <nav className="discovery-nav" aria-label="Discover navigation">
        {!embedded && <Link className="discovery-back" to="/"><ArrowLeft size={17} aria-hidden="true" /> <span>Back to home</span></Link>}
        {profile && (
          <button ref={tutorialButton} className="swipe-help" type="button" aria-haspopup="dialog"
            hidden={tutorialOpen} aria-disabled={Boolean(exit)} onClick={() => {
              if (exitTimer.current !== null) return;
              resetDrag();
              setTutorialOpen(true);
            }}>
            How to swipe
          </button>
        )}
      </nav>
      <header className="discovery-heading">
        <h1>Discover roommates</h1>
        <p className="discovery-caption">Demo · Fictional profiles. Decisions stay in this demo.</p>
      </header>

      <div className="swipe-deck">
        <p className="sr-only" role="status">
          {profile ? `Profile ${Object.keys(decisions).length + 1} of ${demoProfiles.length}: ${profile.name}` : 'You’ve seen all available profiles'}
        </p>
        {profile ? (
          <div className="swipe-stage" ref={stage}>
            <button ref={passButton} className="swipe-choice swipe-choice-pass" type="button" aria-disabled={Boolean(exit)}
              onClick={(event) => decide('pass', event.detail === 0)}>
              <span className="swipe-choice-icon"><X size={18} aria-hidden="true" /></span>
              <span>Pass</span>
            </button>
            <div
              key={profile.id}
              className="swipe-card"
              data-dragging={dragging}
              data-exit={exit ?? undefined}
              style={{ transform: exit ? undefined : `translateX(${offset}px) rotate(${Math.max(-12, Math.min(12, offset / 15))}deg)` }}
              {...handlers}
            >
              <ProfileCard profile={profile} showBio={false} onViewProfile={showProfile}
                badge={<CompatibilityBadge model={compatibilityBadgeModel({ profileId: profile.id, match: demoMatches.get(profile.id), demo: true })} />} />
            </div>
            <button className="swipe-choice swipe-choice-interest" type="button" aria-disabled={Boolean(exit)}
              onClick={(event) => decide('interested', event.detail === 0)}>
              <span className="swipe-choice-icon"><Heart size={18} aria-hidden="true" /></span>
              <span>Interested</span>
            </button>
          </div>
        ) : (
          <div className="swipe-complete">
            <span className="feature-icon" aria-hidden="true"><Check size={24} /></span>
            <h2>You’ve seen all available profiles</h2>
            <button ref={restartButton} className="button button-outline" type="button" onClick={(event) => {
              restoreFocus.current = event.detail === 0;
              setDecisions({});
            }}>
              <RotateCcw size={18} aria-hidden="true" /> Restart demo
            </button>
          </div>
        )}
        {!embedded && <Link className="text-link" to="/matches">Try roommate matching</Link>}
      </div>

      {profile && tutorialOpen && (
        <SwipeTutorial stage={stage} persist={!embedded} onDismiss={() => {
          restoreTutorialFocus.current = true;
          setTutorialOpen(false);
        }} />
      )}

      <dialog className="profile-dialog discover-details" ref={dialog} aria-labelledby="profile-dialog-title" onSubmit={closeDiscoverDetails} onCancel={closeDiscoverDetails}
        onClose={() => setSelected(null)}>
        <div className="dialog-top">
          <h2 id="profile-dialog-title">About {selected?.name}</h2>
          <form method="dialog">
            <button className="icon-button" type="submit" aria-label="Close profile"><X aria-hidden="true" size={20} /><span className="discover-close-label">Close</span></button>
          </form>
        </div>
        {selected && (
          <>
            <div className="demo-sheet-facts"><ProfileFacts profile={selected} /></div>
            <p>{selected.bio}</p>
            <dl className="lifestyle-list">
              <div><dt>Cleanliness</dt><dd>{cleanlinessLabels[selected.cleanliness]}</dd></div>
              <div><dt>Sleep schedule</dt><dd>{sleepLabels[selected.sleepSchedule]}</dd></div>
            </dl>
          </>
        )}
      </dialog>
    </main>
  );
}
