import { ArrowLeft, ArrowRight, Hand } from 'lucide-react';
import { useLayoutEffect, useRef, type RefObject } from 'react';

const storageKey = 'roomie:swipe-tutorial-dismissed';

export function hasDismissedTutorial() {
  try {
    return localStorage.getItem(storageKey) === '1';
  } catch {
    return false;
  }
}

export function SwipeTutorial({ stage, persist, onDismiss }: {
  stage: RefObject<HTMLDivElement | null>;
  persist: boolean;
  onDismiss: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const spotlight = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const modal = dialog.current;
    const card = stage.current;
    const highlight = spotlight.current;
    if (!modal || !card || !highlight) return;

    function positionHighlight() {
      if (!card || !highlight) return;
      const { x, y, width, height } = card.getBoundingClientRect();
      Object.assign(highlight.style, {
        left: `${x}px`,
        top: `${y}px`,
        width: `${width}px`,
        height: `${height}px`,
      });
      const edge = card.firstElementChild?.getBoundingClientRect();
      if (edge) highlight.style.setProperty('--swipe-hand-edge', `${edge.left - x + edge.width / 2}px`);
    }

    positionHighlight();
    if (!modal.open) modal.showModal();

    const observer = new ResizeObserver(positionHighlight);
    observer.observe(card);
    window.addEventListener('resize', positionHighlight);
    window.addEventListener('scroll', positionHighlight, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', positionHighlight);
      window.removeEventListener('scroll', positionHighlight);
    };
  }, [stage]);

  function dismiss() {
    try {
      if (persist) localStorage.setItem(storageKey, '1');
    } catch {
      // Keep dismissal working when the browser blocks storage.
    }
    onDismiss();
  }

  return (
    <dialog ref={dialog} className="swipe-tutorial" aria-labelledby="swipe-tutorial-title"
      aria-describedby="swipe-tutorial-description" onClose={dismiss}
      onKeyDown={(event) => {
        if (event.key === 'Tab') event.preventDefault();
      }}>
      <div ref={spotlight} className="swipe-spotlight" aria-hidden="true">
        <span className="swipe-hand swipe-hand-left"><Hand size={24} /></span>
        <span className="swipe-hand swipe-hand-right"><Hand size={24} /></span>
      </div>
      <div className="swipe-tutorial-panel">
        <h2 id="swipe-tutorial-title">How to swipe</h2>
        <p id="swipe-tutorial-description" className="sr-only">
          Swipe left to pass. Swipe right if you’re interested.
        </p>
        <div className="swipe-tutorial-steps" aria-hidden="true">
          <p><ArrowLeft size={19} /> Swipe left to pass.</p>
          <p><ArrowRight size={19} /> Swipe right if you’re interested.</p>
        </div>
        <form method="dialog">
          <button className="button button-primary" type="submit" autoFocus>Got it</button>
        </form>
      </div>
    </dialog>
  );
}
