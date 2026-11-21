# Person 3 — Gemini Roommate Matching

## What was implemented

- Shared `RoommateProfile` type, 14 fictional USF demo profiles (incl. a strong match, a conflict match, a sparse profile, and a prompt-injection bio).
- Deterministic hard filters (university, budget, distance, housing status, roommates, move-in window, room type, dealbreakers).
- Weighted baseline compatibility score (0–100, adjustable weights) that also powers the fallback.
- `POST /api/match`: server-side Gemini analysis with a JSON schema, Zod validation, and automatic fallback.
- Discovery UI (`Discover` page + `FilterPanel`, `MatchCard`, `MatchResults`, `MatchExplanation`, `MatchingLoadingState`) with a **Find My AI Matches** button.
- Tests (Vitest, Gemini SDK mocked) and a dev-only live smoke script.

The repo was empty apart from the README, so a minimal Vite + React + TS + Tailwind v4 scaffold was added. **Person 1 should replace `src/App.tsx`, `src/main.tsx`, `index.html` and `src/index.css` with the team's versions** (keep the Tailwind import).

## Files

Created: `package.json`, `tsconfig.json`, `vite.config.ts`, `vercel.json`, `index.html`, `.gitignore`, `.env.example`, `PERSON3_SETUP.md`
`src/`: `main.tsx`, `App.tsx`, `index.css`, `types/profile.ts`, `data/demoProfiles.ts`, `lib/{filters,scoring,matchSchema,matchClient,profileRepository,profileMapper}.ts`, `pages/Discover.tsx`, `components/discover/*`
`api/`: `match.ts`, `_lib/{matchService,gemini,prompt,supabase}.ts`
`tests/`, `scripts/smoke-gemini.ts`. No pre-existing files were modified.

## Dependencies

Runtime: `@google/genai`, `zod`, `react`, `react-dom`. Dev: `vite`, `@vitejs/plugin-react`, `typescript`, `vitest`, `tailwindcss`, `@tailwindcss/vite`, `@vercel/node`, `tsx`, type packages.

## Environment variables

See `.env.example`. Put real values in `.env.local` (git-ignored).

| Variable | Where | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | server only | Never use a `VITE_` prefix |
| `GEMINI_MODEL` | server | Default `gemini-3.8-flash` (the model used in the current `@google/genai` docs) |
| `ROOMIE_DEMO_MODE` | server | `true` enables the fictional unauthenticated student. **Ignored when `VERCEL_ENV=production`** (or `NODE_ENV=production` off Vercel) |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | server | Real auth + profile loading when demo mode is off |

## Local development

```bash
npm install
cp .env.example .env.local   # then edit; set GEMINI_API_KEY
npm run dev                  # Vite also serves /api/match locally (no Vercel login needed)
npm test                     # automated tests (no network)
npm run build
npm run smoke:gemini         # DEV ONLY: one real Gemini call using GEMINI_API_KEY
npm run dev:vercel           # optional: run via `vercel dev` instead
```

Without a key the app still works: results come back labelled "Baseline match · not AI".

## Get a Gemini API key

Create one in [Google AI Studio](https://aistudio.google.com/apikey), put it in `.env.local` as `GEMINI_API_KEY`, then run `npm run smoke:gemini`. It prints per-candidate scores and never prints the key.

## Person 2 — connecting Supabase

1. Create a `profiles` table with `snake_case` columns; `src/lib/profileMapper.ts` (`rowToProfile`) documents the exact mapping (`university_id`, `display_name`, `budget_min`, `budget_max`, `distance_from_campus_miles`, `move_in_date`, `roommates_wanted`, `housing_status` (`has_room`/`need_room` accepted), `monthly_rent`, `cleanliness`, `verified_university_email`, …). Rows missing required fields are skipped. Email is never read.
2. Set the three `SUPABASE_*` variables and turn off `ROOMIE_DEMO_MODE`. `/api/match` then verifies the caller's bearer token with Supabase Auth and loads profiles via `api/_lib/supabase.ts`. The requester id always comes from the token, never the request body.
3. On the client pass `currentUser`, `profiles` and `accessToken={session.access_token}` to `<Discover />`.
4. Caveat: the Supabase code path follows the documented REST APIs but has **not been run against a live project**.

## Person 1 — using the discovery UI

Mount `src/pages/Discover.tsx` at `/discover`. Props: `currentUser`, `profiles`, `accessToken`, `demoMode`. Components in `src/components/discover/` are reusable and styled with Tailwind utility classes only.

## Deploy to Vercel

Import the repo; add `GEMINI_API_KEY` (and Supabase vars) in project settings. `api/match.ts` deploys as a Vercel Function (30 s max, see `vercel.json`). For a hackathon demo on a **preview** deployment you may set `ROOMIE_DEMO_MODE=true`; it is refused on Production.

## Behaviour notes

- Hard constraints are enforced in code before Gemini sees anything; Gemini can only rank the (max 10) candidates it is given, and any unknown/duplicate ID, bad score or invalid JSON causes fallback.
- Names, major, academic year and verification are never sent to Gemini or scored.
- Bios are treated as untrusted data (delimited, sanitised, covered by the system instruction).

## Known limitations

- Live Gemini behaviour has not been verified in this repo until `npm run smoke:gemini` is run with a real key.
- Rate limiting and the response cache are in-memory per serverless instance (best-effort). The client also caches unchanged requests.
- Gemini analyses the top 10 candidates by baseline score; in AI mode only those are shown.
- The profile fields for lifestyle and `monthly_rent` are my proposal; Person 2 must confirm the schema.
- No pagination, saved matches, or messaging.
