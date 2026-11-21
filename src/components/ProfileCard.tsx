import { useState } from 'react';
import { ArrowRight, BadgeCheck, CalendarDays, ChevronUp, MapPin, Users, Wallet } from 'lucide-react';
import type { RoommateProfile } from '../types/RoommateProfile';

interface ProfileCardProps {
  profile: RoommateProfile;
  matchScore?: number;
  showBio?: boolean;
  onViewProfile?: (profile: RoommateProfile) => void;
}

const dollars = new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 0,
});
const moveInFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
});

export const cleanlinessLabels: Record<RoommateProfile['cleanliness'], string> = {
  relaxed: 'Relaxed about tidiness', moderate: 'Moderately tidy', tidy: 'Very tidy',
};
export const sleepLabels: Record<RoommateProfile['sleepSchedule'], string> = {
  early: 'Early riser', night: 'Night owl', flexible: 'Flexible schedule',
};

export function ProfileCard({ profile, matchScore, showBio = true, onViewProfile }: ProfileCardProps) {
  const [failedPhoto, setFailedPhoto] = useState<string>();
  const initials = profile.name.trim().split(/\s+/).slice(0, 2).map((word) => word[0]).join('');
  const hasRoom = profile.housingStatus === 'have_room';

  return (
    <article className="profile-card">
      <div className={`profile-photo ${hasRoom ? 'profile-photo-peach' : ''}`} aria-hidden="true">
        {profile.photoUrl && profile.photoUrl !== failedPhoto ? (
          <img key={profile.photoUrl} src={profile.photoUrl} alt="" draggable={false}
            onError={() => setFailedPhoto(profile.photoUrl)} />
        ) : <span>{initials}</span>}
      </div>
      <header className="profile-header">
        <div>
          <h2 className="profile-name">{profile.name}</h2>
          <p className="profile-subtitle">{profile.major} · {profile.university}</p>
        </div>
      </header>
      <div className="profile-badges">
        <span className={`chip ${hasRoom ? 'chip-peach' : 'chip-green'}`}>
          {hasRoom ? 'Has a room' : 'Looking for a place'}
        </span>
        {profile.verified && (
          <span className="chip chip-outline"><BadgeCheck aria-hidden="true" size={15} /> University email verified</span>
        )}
        {typeof matchScore === 'number' && Number.isFinite(matchScore) && matchScore >= 0 && matchScore <= 100 && (
          <span className="chip chip-green">{Math.round(matchScore)}% match</span>
        )}
      </div>
      {showBio && <p className="profile-bio">{profile.bio}</p>}
      <ProfileFacts profile={profile} />
      {onViewProfile && (
        <button className="button button-outline profile-action discover-more" type="button" aria-haspopup="dialog" onClick={() => onViewProfile(profile)}>
          <span className="profile-action-desktop">View profile <ArrowRight size={16} aria-hidden="true" /></span>
          <span className="profile-action-mobile">More info <ChevronUp size={17} aria-hidden="true" /></span>
          <span className="sr-only"> for {profile.name}</span>
        </button>
      )}
    </article>
  );
}

export function ProfileFacts({ profile }: { profile: RoommateProfile }) {
  const moveIn = new Date(profile.moveInDate);
  const moveInLabel = Number.isNaN(moveIn.getTime()) ? 'Flexible' : moveInFormatter.format(moveIn);
  const hasRoom = profile.housingStatus === 'have_room';
  const monthlyRent = profile.budgetMin === profile.budgetMax
    ? dollars.format(profile.budgetMax)
    : `${dollars.format(profile.budgetMin)}–${dollars.format(profile.budgetMax)}`;

  return (
    <dl className="profile-facts">
      <div><dt><Wallet aria-hidden="true" /> {hasRoom ? 'Monthly rent' : 'Monthly budget'}</dt><dd>{monthlyRent}</dd></div>
      <div><dt><MapPin aria-hidden="true" /> Campus distance</dt><dd>{profile.distanceMiles} mi</dd></div>
      <div><dt><CalendarDays aria-hidden="true" /> Move-in</dt><dd>{moveInLabel}</dd></div>
      <div><dt><Users aria-hidden="true" /> Roommates wanted</dt><dd>{profile.roommatesWanted}</dd></div>
    </dl>
  );
}
