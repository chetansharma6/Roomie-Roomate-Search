# Messaging handoff: mutual matching, Inbox and chat

## Mutual-match rules
Roomie already had `roommate_requests` (one row per unordered pair, `pending → accepted/declined`). That is reused as the explicit two-sided approval; there is **no** extra "likes" table and no separate acceptance step on top of it.

| Event | Result |
|---|---|
| A taps **Interested** on B | `roommate_requests` A→B `pending`. No match, no conversation. |
| B taps **Interested** on A (A→B pending) | Request becomes `accepted`; one match + one conversation are created; B sees "It's a match!". |
| B taps **Accept** in the existing request inbox | Same result (database trigger on `accepted`). The notice links to `/inbox`. |
| Retries / repeats / reverse duplicates | Idempotent. `matched_now` is true only for the call that created the match, so the popup shows once. |
| Declined pair | Stays declined; no match. |

Gemini scores never create matches. Signed-out demo cards never call the database.

## Database (`supabase/migrations/20261122000000_mutual_matches_messaging.sql`)
- `matches(user_a < user_b)` with a unique `(user_a, user_b)` index: one match per unordered pair.
- `conversations(match_id unique)`: one conversation per match. `last_message_at` is maintained by a trigger.
- `messages(conversation_id, sender_id default auth.uid(), body 1..2000 chars, created_at, read_at)`.
- `roomie_private.create_match_for_request()` trigger: creates the match + conversation when a request becomes `accepted`, after checking both profiles are active and at the same verified university. Backfills already-accepted requests.
- `public.express_interest(target_id)`: atomic, idempotent RPC; identity from `auth.uid()`; takes a per-pair advisory lock so simultaneous A→B / B→A calls serialise.
- `public.get_inbox()`: `SECURITY INVOKER` (RLS applies); one row per conversation with last message and unread count.
- Adds `public.messages` to the `supabase_realtime` publication if that publication exists.

## RLS
- `matches`, `conversations`: participants can SELECT; **no client INSERT/UPDATE/DELETE grants**.
- `messages`: participants SELECT; INSERT only `(conversation_id, body)` with `sender_id = auth.uid()` enforced by policy; UPDATE only `read_at`, only by the *recipient*, only once, and a trigger stamps `now()` (client value ignored). Body/sender/conversation are immutable.
- `anon` has nothing.
- Blocking/reporting does not exist in the repo, so it is not enforced here.

## Code map
- Services: `src/lib/messaging.ts` (`expressInterest`, `getInbox`, `listMessages`, `sendMessage`, `markConversationRead`, `getUnreadCount`, `subscribeToMessages`, `getPeerProfiles`); pure helpers in `src/lib/messageState.ts`.
- Hooks: `src/hooks/useMessaging.ts` (`useInbox`, `useConversation`, `useUnreadCount`).
- UI: `src/pages/MessagesPage.tsx` (routes `/inbox`, `/messages/:conversationId`), `src/components/messages/*` (`ConversationList`, `ChatView`, `MatchDialog`, `Avatar`).
- Integration edits to existing files (small): `App.tsx` (2 routes), `Navbar.tsx` (Inbox link + unread badge, signed-in only), `StudentDeck.tsx` (`sendRoommateRequest` → `expressInterest`, `MatchDialog`), `RoommateRequestInbox.tsx` (match notice link), `types/database.ts`. `sendRoommateRequest`/`respondToRoommateRequest` are unchanged.

## Realtime
Subscribes to `postgres_changes` on `public.messages`; Supabase applies the RLS policies per subscriber. Duplicate events collapse by message id; channels are removed on unmount; a reconnect triggers a refetch. If the channel is not connected the UI polls every 15 s and shows "Live updates unavailable". **The migration adds the table to the publication; nothing was applied to the hosted project.** If your project manages publications in the dashboard, enable Realtime for `messages` there.

## Verification actually performed
- `npm test`, `npm run lint`, `npm run build`: pass (lint has 4 pre-existing-style warnings, 0 errors).
- `supabase/tests/messaging_rls.sql` (+ existing `roomie_rls.sql`) executed against a throwaway local Postgres 16 with **stubbed** Supabase auth (`auth.users`, `auth.uid()`, roles); all migrations applied in order. Also ran 40 simultaneous `express_interest` calls (20 pairs, both directions): exactly 20 matches, 20 conversations, no errors. This is not the hosted Supabase; run the SQL test there too.
- **Not verified:** live Realtime delivery, the browser UI with real sessions, and the 375/390/768/1440px layouts. No test accounts or hosted DB access were available, and there is no DOM test environment (vitest runs in `node`, so no component/hook render tests exist; layout uses a stacked mobile pane and a two-column `lg` layout, and is untested visually).

## Running locally / hosted
1. `npx supabase db push` (or `npm run supabase:db:push`) after review, then run `supabase/tests/messaging_rls.sql` in the SQL editor (it rolls back).
2. Vercel: no new env vars; only the existing `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`. No service-role key is used.
3. Two-account test: sign in as two confirmed same-university students in two browsers, both with active profiles. A: Discover → Interested on B (no popup). B: Interested on A (popup, "Send a message"). Both: `/inbox`, send messages, check live delivery, unread badge in the navbar, and that a third account sees nothing.

## Known limitations
- No roommate-profile page exists, so the chat header has no "view profile" link; compatibility score is not shown in the Inbox.
- The Discover deck only filters swiped cards locally, so after a refresh a user may see someone they already liked again; tapping again is a harmless no-op.
- Messages page loads the most recent 200 messages; no pagination or typing indicators.
- Read receipts are per-message and only set while the chat is open.
