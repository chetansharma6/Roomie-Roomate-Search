import { X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useRef, useState } from 'react';
import { cleanlinessLabels, ProfileCard, sleepLabels } from '../components/ProfileCard';
import type { RoommateProfile } from '../types/RoommateProfile';
import { demoProfiles } from './profiles';

export function DemoDiscover({ embedded }: { embedded: boolean }) {
  const [selected, setSelected] = useState<RoommateProfile | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  function showProfile(profile: RoommateProfile) {
    setSelected(profile);
    dialog.current?.showModal();
  }

  return (
    <main className="shell discovery" id="main-content">
      <h1>Discover roommates</h1>
      <p className="discovery-caption">Explore fictional profiles in this demo.</p>
      {!embedded && <Link className="text-link" to="/matches">Try roommate matching</Link>}
      <div className="profiles-grid">
        {demoProfiles.map((profile) => <ProfileCard key={profile.id} profile={profile} onViewProfile={showProfile} />)}
      </div>

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
