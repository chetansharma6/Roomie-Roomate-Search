import { useEffect, useMemo, useRef, useState } from 'react';
import { House, SlidersHorizontal, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { SwipeDecision } from '../../hooks/useSwipeGesture';
import { filterCandidates } from '../../lib/filters';
import { describeFallback, findMatches, MatchClientError } from '../../lib/matchClient';
import { expressInterest } from '../../lib/messaging';
import { MatchDialog } from '../messages/MatchDialog';
import type { MatchResponse, ProfileFilters, RoommateProfile } from '../../types/profile';
import { FilterPanel } from './FilterPanel';
import { MatchingLoadingState } from './MatchingLoadingState';
import { StudentSwipeCard } from './StudentSwipeCard';

type RankingRequest = { filters: ProfileFilters; attempt: number };
type RankingResult = { request: RankingRequest; response: MatchResponse } | { request: RankingRequest; error: string };

export function StudentDeck({ currentUser, profiles, accessToken }: {
  currentUser: RoommateProfile;
  profiles: RoommateProfile[];
  accessToken: string;
}) {
  const [request, setRequest] = useState<RankingRequest>({ filters: {}, attempt: 0 });
  const [draft, setDraft] = useState<ProfileFilters>({});
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [result, setResult] = useState<RankingResult>();
  const [swiped, setSwiped] = useState<ReadonlySet<string>>(() => new Set());
  const [sending, setSending] = useState(false);
  const [interestError, setInterestError] = useState('');
  const [notice, setNotice] = useState('');
  const [matched, setMatched] = useState<{ name: string; conversationId: string }>();
  const interestInFlight = useRef(false);
  const stage = useRef<HTMLElement>(null);

  const eligible = useMemo(() => filterCandidates(profiles, request.filters, currentUser), [profiles, request.filters, currentUser]);
  const currentResult = result?.request === request ? result : undefined;
  const ranking = currentResult && 'response' in currentResult ? currentResult.response : undefined;
  const rankingError = currentResult && 'error' in currentResult ? currentResult.error : undefined;

  useEffect(() => {
    if (!eligible.length) return;
    let active = true;
    void findMatches({ requester: currentUser, candidates: profiles, filters: request.filters, accessToken })
      .then((response) => {
        if (active) setResult({ request, response });
      })
      .catch((error: unknown) => {
        if (active) setResult({
          request,
          error: error instanceof MatchClientError ? error.message : 'Could not rank roommate profiles. Please retry.',
        });
      });
    return () => { active = false; };
  }, [accessToken, currentUser, eligible.length, profiles, request]);

  const matches = new Map(ranking?.matches.map((match) => [match.profileId, match]));
  const remaining = eligible.filter(({ id }) => !swiped.has(id))
    .sort((a, b) => (matches.get(b.id)?.compatibilityScore ?? -1) - (matches.get(a.id)?.compatibilityScore ?? -1));
  const profile = remaining[0];

  function applyFilters() {
    if (interestInFlight.current) return;
    setFiltersOpen(false);
    setInterestError('');
    if (JSON.stringify(draft) !== JSON.stringify(request.filters)) {
      setRequest({ filters: draft, attempt: 0 });
    }
  }

  async function decide(decision: SwipeDecision) {
    if (!profile || interestInFlight.current) return;
    setInterestError('');
    if (decision === 'interested') {
      interestInFlight.current = true;
      setSending(true);
      try {
        // Atomic server-side: records interest and creates the match only if the other student already said yes.
        const result = await expressInterest(profile.id);
        if (result.matched_now && result.conversation_id) setMatched({ name: profile.displayName, conversationId: result.conversation_id });
      } catch {
        setInterestError('Could not send your interest. Please try again.');
        return;
      } finally {
        interestInFlight.current = false;
        setSending(false);
      }
    }

    stage.current?.focus({ preventScroll: true });
    setSwiped((previous) => new Set([...previous, profile.id]));
    setNotice(decision === 'interested' ? `Interest recorded for ${profile.displayName}.` : '');
  }

  return (
    <main className="student-discover" id="main-content">
      <header className="student-discover-header">
        <Link className="student-mobile-home icon-button" to="/" aria-label="Back to home"><House size={19} aria-hidden="true" /></Link>
        <h1>Discover roommates</h1>
        <Link className="student-account icon-button" to="/account" aria-label="Account"><UserRound size={19} aria-hidden="true" /></Link>
        <button className="student-filter-toggle icon-button" type="button" aria-expanded={filtersOpen} aria-controls="student-filters"
          onClick={() => setFiltersOpen((open) => !open)} aria-label="Filters">
          <SlidersHorizontal size={19} aria-hidden="true" />
        </button>
      </header>
      <div className="student-discover-layout">
        <aside id="student-filters" className="student-filters" data-open={filtersOpen} aria-label="Discover filters">
          <h2>Filters</h2>
          <FilterPanel filters={draft} onChange={setDraft} onReset={() => setDraft({})} />
          <button className="button button-primary" type="button" disabled={sending} onClick={applyFilters}>Apply filters</button>
        </aside>
        <section className="student-deck" aria-label="Roommate deck" ref={stage} tabIndex={-1}>
          <p className="sr-only" role="status">
            {ranking && profile ? `${profile.displayName}. ${remaining.length} profiles remaining.` : ''} {notice}
          </p>
          {!profile && (
            <div className="student-deck-message">
              <h2>{eligible.length ? 'You’ve seen all matching profiles' : 'No roommates match these filters'}</h2>
              <p>Adjust your filters to see if more roommates are available.</p>
            </div>
          )}
          {profile && !currentResult && <MatchingLoadingState />}
          {profile && rankingError && (
            <div className="student-deck-message" role="alert">
              <p>{rankingError}</p>
              <button className="button button-outline" type="button" onClick={() => setRequest((previous) => ({
                ...previous, attempt: previous.attempt + 1,
              }))}>Retry matching</button>
            </div>
          )}
          {profile && ranking && (
            <StudentSwipeCard key={profile.id} profile={profile} match={matches.get(profile.id)}
              ranking={ranking} sending={sending} onDecision={(decision) => void decide(decision)} />
          )}
          {profile && ranking?.source === 'fallback' && <p className="student-ranking-note">{describeFallback(ranking.fallbackReason)}</p>}
          {interestError && <p className="student-interest-error" role="alert">{interestError}</p>}
        </section>
      </div>
      {matched && <MatchDialog name={matched.name} conversationId={matched.conversationId} onClose={() => setMatched(undefined)} />}
    </main>
  );
}
