import type { RoommateProfile } from '../../types/profile';
import { getProfileTags } from '../../lib/profileTags';

export function ProfileTags({ profile, limit }: { profile: RoommateProfile; limit?: number }) {
  const tags = getProfileTags(profile).slice(0, limit);

  if (tags.length === 0) return null;
  return <ul className="student-tags" aria-label="Roommate preferences">
    {tags.map((tag) => <li key={tag}>{tag}</li>)}
  </ul>;
}
