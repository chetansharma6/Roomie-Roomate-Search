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
cat > .env.local <<'EOF'
ROOMIE_DEMO_MODE=true
GEMINI_MODEL=gemini-3.5-flash-lite
GEMINI_API_KEY=your_key_here
EOF
npm run dev          # plain Vite; a Vite plugin serves /api/match. No `vercel dev` needed.
# open http://localhost:5173/matches
```

(`.env.local` may also hold the Supabase variables from `.env.example`; they are not needed for demo mode.) Demo mode is disabled automatically when `VERCEL_ENV=production` or `NODE_ENV=production` without Vercel.

Then: adjust the budget and distance filters → click **Find My AI Matches** → open a card for strengths, conflicts and conversation starters. A budget of $1 shows the empty state. Remove `GEMINI_API_KEY` to see the baseline fallback. Calls are limited to 10/min per caller and cached for 5 minutes.

## D. Test authenticated matching (UNVERIFIED end to end)

Prerequisites: Supabase project with the `profiles` table (Person 2), `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, server-side `SUPABASE_URL`/`SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` (or the `SUPABASE_SECRET_KEY` / `SUPABASE_JWKS_URL` set in `.env.example`), `ROOMIE_DEMO_MODE` unset/false, a confirmed university email, and an active profile with budget, distance, roommates wanted and move-in date.

Flow: `useAuth` supplies `session.access_token` → `StudentDiscover` loads `profiles` rows via Supabase, maps them with `rowToProfile` and passes `accessToken` to `Discover` → `/api/match` verifies the bearer token and loads profiles server-side. Errors: 401 (missing/invalid token), 503 (auth not configured), 502 (profile store error); a user without a profile sees "Complete your profile" in `StudentDiscover`.

Verified by unit tests (mocked): token handling, demo-mode gating, profile mapping. **Not verified** against a real Supabase project.

## E. Mobile testing

Open `/matches` in browser devtools at 375, 390, 768 and 1440 px. Filters are collapsed by default on small screens. For a desktop/mobile preview toggle, point the preview iframe at `/matches`. `/discover?preview=1` hides chrome only for `DemoDiscover` in an iframe, and is not needed for `/matches`.

## F. Known limitations

- Real authenticated matching needs Person 2's `profiles` table and onboarding; untested live.
- `/discover` still shows the static demo to signed-out visitors until Person 1 chooses to swap it.
- Rate limit and cache are per serverless instance (in memory).
- Scores are estimates, not predictions; the UI shows a disclaimer.
