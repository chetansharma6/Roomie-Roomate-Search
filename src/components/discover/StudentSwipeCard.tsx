import { useRef, useState } from 'react';
import { Heart, X } from 'lucide-react';
import { useSwipeGesture, type SwipeDecision } from '../../hooks/useSwipeGesture';
import { SCORE_DISCLAIMER, type MatchResponse, type MatchResult, type RoommateProfile } from '../../types/profile';
import { priceLabel } from './labels';
import { MatchInsights } from './MatchExplanation';
import { ProfileTags } from './ProfileTags';

const formatDate = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' });

export function StudentSwipeCard({ profile, match, ranking, sending, onDecision }: {
  profile: RoommateProfile;
  match?: MatchResult;
  ranking?: MatchResponse;
  sending: boolean;
  onDecision: (decision: SwipeDecision) => void;
}) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const details = useRef<HTMLDialogElement>(null);
  const { dragging, offset, handlers } = useSwipeGesture(onDecision, sending);
  const initials = profile.displayName.trim().split(/\s+/).slice(0, 2).map((word) => word[0]).join('');
  const date = new Date(profile.moveInDate);

  return (
    <>
      <div className="student-swipe-stage">
        <button className="swipe-choice swipe-choice-pass" type="button" aria-disabled={sending} onClick={() => onDecision('pass')}>
          <X size={18} aria-hidden="true" /><span>Pass</span>
        </button>
        <div className="student-swipe-card swipe-card" data-dragging={dragging}
          style={offset ? { transform: `translateX(${offset}px)` } : undefined} {...handlers}>
          <article className="student-profile">
            <div className="student-photo" aria-hidden="true">
              {profile.photoUrl && !photoFailed
                ? <img src={profile.photoUrl} alt="" referrerPolicy="no-referrer" draggable={false} onError={() => setPhotoFailed(true)} />
                : <span>{initials}</span>}
            </div>
            <div className="student-profile-copy">
              <h2>{profile.displayName}</h2>
              <p>{profile.housingStatus === 'has_room' ? 'Has a room' : 'Looking for a place'} · {profile.distanceFromCampusMiles} mi from campus</p>
              {match && <p className="student-score">{match.compatibilityScore}% compatibility · {ranking?.source === 'gemini' ? 'AI estimate' : 'baseline estimate'}</p>}
              <ProfileTags profile={profile} limit={3} />
              <button className="button student-more" type="button" aria-haspopup="dialog"
                onClick={() => details.current?.showModal()}>More info</button>
            </div>
          </article>
        </div>
        <button className="swipe-choice swipe-choice-interest" type="button" aria-disabled={sending} onClick={() => onDecision('interested')}>
          <Heart size={18} aria-hidden="true" /><span>Interested</span>
        </button>
      </div>

      <dialog className="student-details profile-dialog" ref={details} aria-labelledby="student-details-title">
        <div className="dialog-top">
          <h2 id="student-details-title">{profile.displayName}</h2>
          <form method="dialog">
            <button className="icon-button" type="submit" aria-label="Close profile details" autoFocus><X size={20} aria-hidden="true" /></button>
          </form>
        </div>
        <dl className="lifestyle-list">
          <div><dt>{profile.housingStatus === 'has_room' && profile.monthlyRent !== undefined ? 'Monthly rent' : 'Monthly budget'}</dt><dd>{priceLabel(profile)}</dd></div>
          <div><dt>Move-in date</dt><dd>{Number.isNaN(date.getTime()) ? profile.moveInDate : formatDate.format(date)}</dd></div>
          <div><dt>Campus distance</dt><dd>{profile.distanceFromCampusMiles} mi</dd></div>
        </dl>
        <p>{profile.bio || 'No bio provided.'}</p>
        <ProfileTags profile={profile} />
        {match && <MatchInsights match={match} source={ranking?.source ?? 'fallback'} model={ranking?.model}
          disclaimer={ranking?.disclaimer ?? SCORE_DISCLAIMER} />}
      </dialog>
    </>
  );
}
