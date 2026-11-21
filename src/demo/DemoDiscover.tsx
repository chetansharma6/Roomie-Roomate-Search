import { ArrowLeft, Check, Heart, RotateCcw, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { cleanlinessLabels, ProfileCard, sleepLabels } from '../components/ProfileCard';
import type { RoommateProfile } from '../types/RoommateProfile';
import { SwipeTutorial, hasDismissedTutorial } from './SwipeTutorial';
import { demoProfiles } from './profiles';

type Decision = 'pass' | 'interested';
type Drag = { id: number; x: number; y: number; axis?: 'horizontal' | 'vertical' };

const exitDuration = 180;

export function DemoDiscover({ embedded }: { embedded: boolean }) {
  const [selected, setSelected] = useState<RoommateProfile | null>(null);
  const [decisions, setDecisions] = useState<Partial<Record<string, Decision>>>({});
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [exit, setExit] = useState<Decision | null>(null);
  const [tutorialOpen, setTutorialOpen] = useState(() => !embedded && !hasDismissedTutorial());
  const stage = useRef<HTMLDivElement>(null);
  const tutorialButton = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const drag = useRef<Drag | null>(null);
  const exitTimer = useRef<number | null>(null);
  const restartButton = useRef<HTMLButtonElement>(null);
  const passButton = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  const restoreTutorialFocus = useRef(false);

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
    setSelected(person);
    dialog.current?.showModal();
  }

  function resetDrag() {
    drag.current = null;
    setDragging(false);
    setOffset(0);
  }

  function decide(decision: Decision, keepFocus = false) {
    if (!profile || tutorialOpen || exitTimer.current !== null) return;
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

  function startDrag(event: PointerEvent<HTMLDivElement>) {
    if (tutorialOpen || !event.isPrimary || event.button !== 0 || exitTimer.current !== null) return;
    if ((event.target as Element).closest('button, a')) return;
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveDrag(event: PointerEvent<HTMLDivElement>) {
    const active = drag.current;
    if (!active || event.pointerId !== active.id) return;
    const x = event.clientX - active.x;
    const y = event.clientY - active.y;
    if (!active.axis && Math.max(Math.abs(x), Math.abs(y)) >= 10) {
      active.axis = Math.abs(x) > Math.abs(y) * 1.25 ? 'horizontal' : 'vertical';
    }
    if (active.axis === 'horizontal') {
      setDragging(true);
      setOffset(x);
    }
  }

  function endDrag(event: PointerEvent<HTMLDivElement>) {
    const active = drag.current;
    if (!active || event.pointerId !== active.id) return;
    const x = event.clientX - active.x;
    const threshold = Math.min(96, event.currentTarget.clientWidth * 0.25);
    if (active.axis === 'horizontal' && Math.abs(x) >= threshold) {
      decide(x > 0 ? 'interested' : 'pass');
    } else {
      resetDrag();
    }
  }

  function cancelDrag(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerId === drag.current?.id) resetDrag();
  }

  return (
    <main className="discovery" id="main-content">
      <nav className="discovery-nav" aria-label="Discover navigation">
        {!embedded && <Link className="discovery-back" to="/"><ArrowLeft size={17} aria-hidden="true" /> Back to home</Link>}
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
              onPointerDown={startDrag}
              onPointerMove={moveDrag}
              onPointerUp={endDrag}
              onPointerCancel={cancelDrag}
              onLostPointerCapture={cancelDrag}
            >
              <ProfileCard profile={profile} showBio={false} onViewProfile={showProfile} />
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

      <dialog className="profile-dialog" ref={dialog} aria-labelledby="profile-dialog-title" onClose={() => setSelected(null)}>
        <div className="dialog-top">
          <h2 id="profile-dialog-title">About {selected?.name}</h2>
          <form method="dialog">
            <button className="icon-button" type="submit" aria-label="Close profile"><X aria-hidden="true" size={20} /></button>
          </form>
        </div>
        {selected && (
          <>
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
