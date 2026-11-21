# Roomie backend integration handoff

This note connects Person 1's app integration with Person 3's Discover/matching work and Person 2's Supabase backend. It records local checks separately from hosted checks; mocked tests do not prove production behavior.

## Contracts for Person 1 and Person 3

- Auth is handled by `AuthProvider` and `src/lib/auth.ts`. It restores the Supabase session, checks that the user is confirmed and from an allowed exact email domain, then routes a missing profile to `/onboarding` and a completed profile to `/discover`.
- Person 1 should keep the browser allowlist and the Supabase Before User Created hook aligned. The database hook and RLS, not browser validation, are the security boundary.
- Person 3's canonical type is `RoommateProfile` in `src/types/profile.ts`. `rowToProfile` maps stored `have_room` / `need_room` values to `has_room` / `needs_room`. Discovery loads active same-university rows using the caller's session; `filterCandidates` applies budget, distance, housing, roommate-count, move-in, and lifestyle filters.
- **Interested** creates a pending `roommate_requests` row. Incoming requests appear on authenticated Discover; only their recipient can accept or decline them. The database RLS policy remains authoritative.
- AI Insights sends only a target profile UUID from the browser. `roommate-insights` requires a user JWT, reads through the caller's RLS-scoped client, sends minimized profile data to Gemini, and validates structured output before returning it.
- Edge Function CORS accepts configured exact origins plus `https://roomie-*.vercel.app` for Roomie's Vercel preview hosts; it does not authorize a caller, which must still have a valid user JWT.
- Vercel rewrites include the SPA routes, including `/profile`; the app's `/api/match` Gemini key is server-only. The Edge Function has its own Supabase secret configuration.

## Environment variable names

Set values in the named service settings or ignored local env files. Never put secrets in `VITE_` variables, commits, browser responses, or handoff documents.

| Scope | Required names |
| --- | --- |
| Browser and Vercel build | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_ALLOWED_EMAIL_DOMAINS` |
| Vercel `/api/match` | `GEMINI_API_KEY`; `GEMINI_MODEL` is optional and defaults in code |
| Supabase Edge Function `roommate-insights` | `GEMINI_API_KEY`, `GEMINI_MODEL`, `ROOMIE_ALLOWED_ORIGINS` |
| Nonproduction fixture seeding only | `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `ROOMIE_DEMO_SEED_PROJECT_REF`, `ROOMIE_ALLOW_DEMO_SEED` in ignored `.env.demo.local` |

The browser never needs a database secret/service-role key. Supabase supplies its platform variables to deployed Edge Functions.

## Local verification performed

- `npm run typecheck`: passed.
- `npm test`: 16 files, 212 tests passed.
- `npm run lint`: no errors; three existing Fast Refresh warnings remain in `ProfileCard.tsx` and `SwipeTutorial.tsx`.
- `npm run build`: passed. Rollup printed dependency annotation warnings from Zod.
- Browser bundle and source scan found no key-shaped API-key literals; local env files are not tracked.
- Existing tests cover auth/domain validation, profile and request services, matching filters, and sanitized errors. New tests cover missing `photo_url` compatibility and missing/malformed/invalid Gemini output.
- `supabase/tests/roomie_rls.sql` was run against the hosted project and passed; all synthetic fixtures were rolled back. It covers anonymous profile updates and authenticated-only `photo_url` column grants.

## Hosted checks still needed

- Remote history was checked before mutation: migrations 1–3 were applied and only `20261121220000_profile_photos.sql` was pending. After authorization, `npm run supabase:db:push -- --yes` applied that migration; a follow-up list showed all four applied in order.
- A read-only anon-key query selecting `photo_url` returned `42501` (expected RLS denial), not `42703`. Catalog privilege checks confirmed authenticated insert/update grants for `photo_url` and no anon insert/update grants.
- Auth redirects and custom SMTP are hosted Auth settings and remain unverified. The exact Codespaces URL is `https://fuzzy-eureka-wv7gjp5x77pph9prp-5173.app.github.dev/signup`; also allow `http://localhost:5173/signup` and the deployed Vercel `/signup` callback. Email confirmation is enabled. SMTP status still needs checking.
- A count-only hosted query returned **1 active verified USF profile**. It does not establish that there is another distinct candidate available.
- Real email delivery/session restoration, saving and reloading a real profile, same-university discovery, live filters, sender/recipient request actions, and authenticated Gemini generation were not exercised. They need a real confirmed USF account; two distinct active profiles are needed for discovery/requests/targeted insights. Do not use the secret key to test RLS.
- Anonymous Edge Function POST was live-tested and returned `401`; Codespaces browser preflight was live-tested and returned `200` with the exact origin. The function has `verify_jwt = true`, deployed Gemini secret names, and configured CORS origins. A Vercel preview/production deployment of this worktree was not verified.

## Safe handoff sequence

1. Person 1 verifies the hosted Auth redirects, Before User Created hook, SMTP status, Vercel environment names, and current deployed commit. Confirm localhost and the exact Codespaces `/signup` callback are allowlisted.
2. A second confirmed USF user creates an active profile; the current hosted count is one and no test profile was inserted by this task.
3. The real user walkthrough should verify email delivery/session restoration, profile save and reload, budget/roommate filters, discovery, requests, and authenticated Gemini insights.
4. Use a second confirmed USF account to send interest, then accept and decline requests as the receiver. Use separate synthetic accounts in the SQL test for policy checks.
5. Invoke `roommate-insights` with an authenticated user JWT and another active same-university profile. Confirm the structured response, then invoke without a user JWT and expect rejection. Never log or paste the JWT or Gemini key.
6. After reviewed code is deployed to Vercel, directly open and refresh `/signup`, `/onboarding`, `/profile`, `/discover`, and `/account` on its preview URL. No Vercel preview was deployed from this worktree.
