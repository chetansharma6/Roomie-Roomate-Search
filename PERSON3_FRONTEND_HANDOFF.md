# Person 3 → Person 1: Gemini matching handoff

## A. Branch and PR information

- The matching system is **already merged into `main`** (PR #11, `feature/gemini-qa`; earlier PRs #5, #9). No unmerged Person 3 work remains. The local/remote `feature/gemini-qa` branch is stale — branch new work from `main`.
- Functional component: `src/pages/Discover.tsx` (default export `Discover`).
- Supporting UI: `src/components/discover/` (`FilterPanel`, `MatchCard`, `MatchResults`, `MatchExplanation`, `MatchingLoadingState`, `SourceBadge`, `labels.ts`).
- Client/logic: `src/lib/matchClient.ts`, `filters.ts`, `scoring.ts`, `profileMapper.ts`; server: `api/match.ts`, `api/_lib/*`.
- **Do not duplicate** any of the above. Person 1's `src/demo/DemoDiscover.tsx` (static swipe demo) is separate and untouched.

## B. How Person 1 integrates Discover

Current routes in `src/App.tsx` (already on `main`):

| Route | Renders |
| --- | --- |
| `/discover`, signed out | `DemoDiscover` (static swipe demo) |
| `/discover`, signed in with profile | `StudentDiscover` → wraps `Discover` with the real profile list + access token |
| `/matches` | `Discover` in demo mode (fictional profiles, no sign-in) |

`Discover` needs **no context providers, no auth hook, and no navbar**. All props are optional:

```tsx
import Discover from './pages/Discover';

<Discover />                                   // demo mode: fictional USF profiles
<Discover currentUser={me} profiles={rows} accessToken={session.access_token} demoMode={false} />
```

Props: `currentUser?: RoommateProfile`, `profiles?: RoommateProfile[]`, `accessToken?: string`, `demoMode?: boolean` (defaults to true only for the demo student without a token).

To show the Gemini experience on `/discover` for signed-out visitors, replace `<DemoDiscover embedded={embedded} />` in `DiscoveryRoute` with `<Discover />` (or keep the swipe demo and link to `/matches`). That edit is Person 1's call; nothing was changed here.

CSS: Discover uses Tailwind v4 utilities (`@tailwindcss/vite`, imported in `src/index.css`, already loaded by `main.tsx`). It needs no extra global CSS. The `/matches` wrapper is `<main className="min-h-screen bg-slate-50 text-slate-900">`; copy that wrapper if you embed it elsewhere.

**API call:** `matchClient.findMatches` POSTs `/api/match` with `{ filters, demoStudentId? }` and, if present, `Authorization: Bearer <accessToken>`. Responses (`source: 'gemini' | 'fallback'`, `matches[]` with score, summary, strengths, potentialConflicts, conversationStarters, plus public `profiles[]` cards) are rendered by `MatchResults`/`MatchExplanation`.

**Gemini failure:** the server falls back to deterministic baseline scoring (`source: 'fallback'`); the UI shows a source badge and a notice. Empty filters results return `matches: []` and the UI shows an empty state. API keys stay server-side only.

## C. Test demo matching

```bash
npm install
# Preserve existing .env.local values; add/update the settings shown below.
npm run dev          # plain Vite; a Vite plugin serves /api/match. No `vercel dev` needed.
# open http://localhost:5173/matches
```

Edit the existing ignored `.env.local` rather than replacing it:

```dotenv
ROOMIE_DEMO_MODE=true
GEMINI_MODEL=gemini-3.5-flash-lite
GEMINI_API_KEY=your_key_here
```

(`.env.local` may also hold the Supabase variables from `.env.example`; they are not needed for demo mode.) Demo mode is disabled automatically when `VERCEL_ENV=production` or `NODE_ENV=production` without Vercel.

Then: adjust the budget and distance filters → click **Find My AI Matches** → open a card for strengths, conflicts and conversation starters. A budget of $1 shows the empty state. Remove `GEMINI_API_KEY` to see the baseline fallback. Calls are limited to 10/min per caller and cached for 5 minutes.

## D. Test authenticated matching (UNVERIFIED end to end)

Prerequisites: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_ALLOWED_EMAIL_DOMAINS=usf.edu`, `ROOMIE_DEMO_MODE=false`, a confirmed supported university email, and an active profile with budget, distance, roommates wanted and move-in date. The three database migrations are applied to Roomie's hosted project; RLS is enabled and hosted policy checks passed. Matching uses the caller's JWT and publishable key; no Supabase secret/service-role key is required.

Person 2's reusable data-access functions are in `src/lib/profiles.ts` and `src/lib/roommateRequests.ts`, with validation, errors and usage examples documented in README. The legacy onboarding persistence helper delegates to the authenticated profile service. Use `rowToProfile` when converting raw database rows to matching profiles.

Flow: `useAuth` supplies `session.access_token` → `StudentDiscover` loads `profiles` rows via Supabase, maps them with `rowToProfile` and passes `accessToken` to `Discover` → `/api/match` verifies the bearer token and loads profiles server-side. Errors: 401 (missing/invalid token), 503 (auth not configured), 502 (profile store error); a user without a profile sees "Complete your profile" in `StudentDiscover`.

Verified: mocked token handling, demo-mode gating and profile mapping; hosted database migrations and transactional RLS checks; production API rejection of missing/invalid sessions. **Not verified end to end:** real student mailbox sign-in followed by matching real profiles. Policy fixtures and fictional Gemini tests do not establish that flow.

## E. Mobile testing

Open `/matches` in browser devtools at 375, 390, 768 and 1440 px. Filters are collapsed by default on small screens. For a desktop/mobile preview toggle, point the preview iframe at `/matches`. `/discover?preview=1` hides chrome only for `DemoDiscover` in an iframe, and is not needed for `/matches`.

## F. Known limitations

- The profile table, RLS and onboarding exist; real student sign-in and real-profile matching remain unverified end to end.
- `/discover` still shows the static demo to signed-out visitors until Person 1 chooses to swap it.
- Rate limit and cache are per serverless instance (in memory).
- Scores are estimates, not predictions; the UI shows a disclaimer.
