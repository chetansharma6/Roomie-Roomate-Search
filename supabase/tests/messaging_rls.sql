-- Mutual matching + messaging policy test. Synthetic .invalid identities.
-- Everything rolls back, even on disconnection. Run after the messaging migration.
begin;
select set_config('roomie.a', gen_random_uuid()::text, true);
select set_config('roomie.b', gen_random_uuid()::text, true);
select set_config('roomie.c', gen_random_uuid()::text, true);
select set_config('roomie.d', gen_random_uuid()::text, true);
insert into public.university_domains(domain,university_name,university_id)
values ('msg-test.invalid','Synthetic fixtures','msg-test'),('msg-other.invalid','Other fixtures','msg-other');
insert into auth.users(id,email,email_confirmed_at) values
  (current_setting('roomie.a')::uuid,'a@msg-test.invalid',now()),
  (current_setting('roomie.b')::uuid,'b@msg-test.invalid',now()),
  (current_setting('roomie.c')::uuid,'c@msg-test.invalid',now()),
  (current_setting('roomie.d')::uuid,'d@msg-other.invalid',now());

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('roomie.a'), true);
insert into public.profiles(id,display_name,budget_min,budget_max,distance_from_campus_miles,roommates_wanted,housing_status)
values (auth.uid(),'Fixture A',500,900,3,2,'need_room');
select set_config('request.jwt.claim.sub', current_setting('roomie.b'), true);
insert into public.profiles(id,display_name,budget_min,budget_max,distance_from_campus_miles,roommates_wanted,housing_status)
values (auth.uid(),'Fixture B',500,900,3,2,'need_room');
select set_config('request.jwt.claim.sub', current_setting('roomie.c'), true);
insert into public.profiles(id,display_name,budget_min,budget_max,distance_from_campus_miles,roommates_wanted,housing_status)
values (auth.uid(),'Fixture C',500,900,3,2,'need_room');
select set_config('request.jwt.claim.sub', current_setting('roomie.d'), true);
insert into public.profiles(id,display_name,budget_min,budget_max,distance_from_campus_miles,roommates_wanted,housing_status)
values (auth.uid(),'Fixture D',500,900,3,2,'need_room');

-- A likes B: one-sided interest creates no match or conversation.
select set_config('request.jwt.claim.sub', current_setting('roomie.a'), true);
do $$
declare r jsonb;
begin
  r := public.express_interest(current_setting('roomie.b')::uuid);
  if r->>'status' <> 'pending' or (r->>'matched_now')::boolean or r->>'conversation_id' is not null then
    raise exception 'One-sided interest must stay pending: %', r; end if;
  r := public.express_interest(current_setting('roomie.b')::uuid); -- retry is idempotent
  if r->>'status' <> 'pending' or (r->>'matched_now')::boolean then raise exception 'Retry not idempotent: %', r; end if;
  if (select count(*) from public.matches) <> 0 or (select count(*) from public.conversations) <> 0 then
    raise exception 'Match created too early'; end if;
  begin perform public.express_interest(auth.uid()); raise exception 'Self interest allowed';
  exception when check_violation then null; end;
  begin perform public.express_interest(current_setting('roomie.d')::uuid); raise exception 'Cross-university allowed';
  exception when insufficient_privilege then null; end;
  begin insert into public.matches(user_a,user_b) values (least(auth.uid(),current_setting('roomie.c')::uuid),greatest(auth.uid(),current_setting('roomie.c')::uuid));
    raise exception 'Client match insert allowed';
  exception when insufficient_privilege then null; end;
  begin insert into public.conversations(match_id) values (gen_random_uuid());
    raise exception 'Client conversation insert allowed';
  exception when insufficient_privilege then null; end;
end $$;

-- B likes A back: exactly one match and one conversation, matched_now only once.
select set_config('request.jwt.claim.sub', current_setting('roomie.b'), true);
do $$
declare r jsonb;
begin
  r := public.express_interest(current_setting('roomie.a')::uuid);
  if r->>'status' <> 'accepted' or not (r->>'matched_now')::boolean or r->>'conversation_id' is null then
    raise exception 'Reciprocal interest must match: %', r; end if;
  perform set_config('roomie.conv', r->>'conversation_id', true);
  r := public.express_interest(current_setting('roomie.a')::uuid); -- retry: no second popup, same conversation
  if (r->>'matched_now')::boolean or r->>'conversation_id' <> current_setting('roomie.conv') then
    raise exception 'Retry created or re-announced a match: %', r; end if;
  if (select count(*) from public.matches) <> 1 or (select count(*) from public.conversations) <> 1 then
    raise exception 'Duplicate match/conversation'; end if;
  begin update public.conversations set last_message_at = now(); if found then raise exception 'Client conversation update allowed'; end if;
  exception when insufficient_privilege then null; end;
end $$;

-- Messaging between participants.
do $$
declare m uuid; affected int;
begin
  insert into public.messages(conversation_id, body) values (current_setting('roomie.conv')::uuid, 'hello from B') returning id into m;
  perform set_config('roomie.msg', m::text, true);
  if (select sender_id from public.messages where id = m) <> auth.uid() then raise exception 'Sender not attributed to caller'; end if;
  begin insert into public.messages(conversation_id, sender_id, body) values (current_setting('roomie.conv')::uuid, current_setting('roomie.a')::uuid, 'forged');
    raise exception 'Client sender_id insert allowed';
  exception when insufficient_privilege then null; end;
  begin insert into public.messages(conversation_id, body) values (current_setting('roomie.conv')::uuid, '   ');
    raise exception 'Blank message allowed';
  exception when check_violation then null; end;
  begin insert into public.messages(conversation_id, body) values (current_setting('roomie.conv')::uuid, repeat('x', 2001));
    raise exception 'Oversized message allowed';
  exception when check_violation then null; end;
  update public.messages set read_at = now() where id = m; -- sender cannot mark own message read
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Sender forged read receipt'; end if;
  begin update public.messages set body = 'edited' where id = m; raise exception 'Body edit allowed';
  exception when insufficient_privilege then null; end;
  begin update public.messages set sender_id = auth.uid() where id = m; raise exception 'sender_id edit allowed';
  exception when insufficient_privilege then null; end;
  if (select last_message_at from public.conversations) < (select created_at from public.conversations) then
    raise exception 'last_message_at not maintained'; end if;
  if (select unread_count from public.get_inbox()) <> 0 then raise exception 'Own message counted unread'; end if;
end $$;

-- A: unread count, mark read exactly once.
select set_config('request.jwt.claim.sub', current_setting('roomie.a'), true);
do $$
declare affected int;
begin
  if (select unread_count from public.get_inbox()) <> 1 then raise exception 'Unread count wrong'; end if;
  if (select last_message_body from public.get_inbox()) <> 'hello from B' then raise exception 'Inbox preview wrong'; end if;
  insert into public.messages(conversation_id, body) values (current_setting('roomie.conv')::uuid, 'hi from A');
  update public.messages set read_at = now() - interval '5 years' where id = current_setting('roomie.msg')::uuid;
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Recipient could not mark read'; end if;
  if (select read_at from public.messages where id = current_setting('roomie.msg')::uuid) < now() - interval '1 minute' then
    raise exception 'Client-chosen read time accepted'; end if;
  if (select unread_count from public.get_inbox()) <> 0 then raise exception 'Unread not cleared'; end if;
end $$;

-- Non-participants (same university, different university) see and send nothing.
select set_config('request.jwt.claim.sub', current_setting('roomie.c'), true);
do $$ begin
  if (select count(*) from public.messages) <> 0 or (select count(*) from public.conversations) <> 0
    or (select count(*) from public.matches) <> 0 or (select count(*) from public.get_inbox()) <> 0 then
    raise exception 'Non-participant can read private data'; end if;
  begin insert into public.messages(conversation_id, body) values (current_setting('roomie.conv')::uuid, 'intruder');
    raise exception 'Non-participant sent a message';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub', current_setting('roomie.d'), true);
do $$ begin
  if (select count(*) from public.messages) <> 0 then raise exception 'Other-university user reads messages'; end if;
end $$;

-- Concurrent-style reverse request: C likes A; A likes C -> one match (serialised by advisory lock + unique index).
select set_config('request.jwt.claim.sub', current_setting('roomie.c'), true);
do $$ begin perform public.express_interest(current_setting('roomie.a')::uuid); end $$;
select set_config('request.jwt.claim.sub', current_setting('roomie.a'), true);
do $$ begin
  perform public.express_interest(current_setting('roomie.c')::uuid);
  if (select count(*) from public.matches) <> 2 or (select count(*) from public.conversations) <> 2 then
    raise exception 'Second pair did not produce exactly one match'; end if;
end $$;

-- Anonymous users have no access.
reset role;
set local role anon;
do $$ begin
  begin perform 1 from public.messages; raise exception 'Anon message read allowed';
  exception when insufficient_privilege then null; end;
  begin perform public.express_interest(gen_random_uuid()); raise exception 'Anon express_interest allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'PASS: messaging policy test; all synthetic fixtures rolled back' as result;
