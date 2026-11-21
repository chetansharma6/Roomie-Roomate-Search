-- Hosted policy smoke test. Synthetic .invalid identities, no email delivery.
-- All fixture records and temporary objects roll back, even on disconnection.
begin;
select set_config('roomie.test_a', gen_random_uuid()::text, true);
select set_config('roomie.test_b', gen_random_uuid()::text, true);
select set_config('roomie.test_c', gen_random_uuid()::text, true);
select set_config('roomie.test_d', gen_random_uuid()::text, true);
insert into public.university_domains(domain,university_name,university_id)
values ('roomie-test.invalid','Synthetic policy fixtures','roomie-test'),
       ('roomie-other.invalid','Other synthetic fixtures','roomie-other');
insert into auth.users(id,email,email_confirmed_at)
values (current_setting('roomie.test_a')::uuid,'a@roomie-test.invalid',now()),
       (current_setting('roomie.test_b')::uuid,'b@roomie-test.invalid',now()),
       (current_setting('roomie.test_c')::uuid,'c@roomie-test.invalid',null),
       (current_setting('roomie.test_d')::uuid,'d@roomie-other.invalid',now());

do $$ begin
  if not has_column_privilege('authenticated','public.profiles','photo_url','INSERT')
    or not has_column_privilege('authenticated','public.profiles','photo_url','UPDATE') then
    raise exception 'Authenticated photo_url write grants are missing';
  end if;
  if has_column_privilege('anon','public.profiles','photo_url','INSERT')
    or has_column_privilege('anon','public.profiles','photo_url','UPDATE') then
    raise exception 'Anonymous photo_url write grants are present';
  end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('roomie.test_a'), true);
insert into public.profiles(id,display_name,budget_min,budget_max,distance_from_campus_miles,roommates_wanted,housing_status,move_in_date)
values (auth.uid(),'Fixture A',500,900,3,2,'need_room','2027-08-01');
select set_config('request.jwt.claim.sub', current_setting('roomie.test_b'), true);
insert into public.profiles(id,display_name,budget_min,budget_max,distance_from_campus_miles,roommates_wanted,housing_status,move_in_date)
values (auth.uid(),'Fixture B',500,900,3,2,'have_room','2027-08-01');
select set_config('request.jwt.claim.sub', current_setting('roomie.test_d'), true);
insert into public.profiles(id,display_name,budget_min,budget_max,distance_from_campus_miles,roommates_wanted,housing_status)
values (auth.uid(),'Fixture D',500,900,3,2,'need_room');
select set_config('request.jwt.claim.sub', current_setting('roomie.test_a'), true);
do $$
declare affected integer;
begin
  if (select count(*) from public.profiles) <> 2 then raise exception 'Same-university visibility failed'; end if;
  if not (select verified_university_email from public.profiles where id=auth.uid()) then raise exception 'Derived verification failed'; end if;
  update public.profiles set bio='forbidden' where id=current_setting('roomie.test_b')::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Cross-owner update allowed'; end if;
  begin
    update public.profiles set verified_university_email=false where id=auth.uid();
    raise exception 'Client verified flag allowed';
  exception when insufficient_privilege then null; end;
  insert into public.roommate_requests(sender_id,receiver_id)
    values(auth.uid(),current_setting('roomie.test_b')::uuid);
  begin
    insert into public.roommate_requests(sender_id,receiver_id) values(auth.uid(),auth.uid());
    raise exception 'Self request allowed';
  exception when check_violation then null; end;
  begin
    insert into public.roommate_requests(sender_id,receiver_id) values(auth.uid(),current_setting('roomie.test_b')::uuid);
    raise exception 'Duplicate allowed';
  exception when unique_violation then null; end;
  update public.roommate_requests set status='accepted';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Sender accepted request'; end if;
end $$;

select set_config('request.jwt.claim.sub', current_setting('roomie.test_b'), true);
do $$
declare affected integer;
begin
  begin
    insert into public.roommate_requests(sender_id,receiver_id) values(auth.uid(),current_setting('roomie.test_a')::uuid);
    raise exception 'Reverse duplicate allowed';
  exception when unique_violation then null; end;
  begin
    update public.roommate_requests set sender_id=auth.uid();
    raise exception 'Ownership edit allowed';
  exception when insufficient_privilege then null; end;
  update public.roommate_requests set status='accepted';
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Receiver could not accept'; end if;
  update public.roommate_requests set status='declined';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Final decision modified'; end if;
  update public.profiles set is_active=false where id=auth.uid();
end $$;
select set_config('request.jwt.claim.sub', current_setting('roomie.test_a'), true);
do $$ begin
  if (select count(*) from public.profiles) <> 1 then raise exception 'Inactive profile visible'; end if;
end $$;
select set_config('request.jwt.claim.sub', current_setting('roomie.test_d'), true);
do $$ begin
  if (select count(*) from public.roommate_requests) <> 0 then raise exception 'Unrelated student sees request'; end if;
end $$;
select set_config('request.jwt.claim.sub', current_setting('roomie.test_c'), true);
do $$ begin
  if (select count(*) from public.profiles) <> 0 then raise exception 'Unconfirmed user sees profiles'; end if;
  begin
    insert into public.profiles(id,display_name,budget_min,budget_max,distance_from_campus_miles,roommates_wanted,housing_status)
    values(auth.uid(),'Unconfirmed',500,900,3,2,'need_room');
    raise exception 'Unconfirmed profile creation allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role anon;
do $$ begin
  begin
    perform 1 from public.profiles;
    raise exception 'Anonymous profile read allowed';
  exception when insufficient_privilege then null; end;
  begin
    update public.profiles set bio='anonymous write' where id=current_setting('roomie.test_a')::uuid;
    raise exception 'Anonymous profile update allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'PASS: hosted policy smoke test; all synthetic fixtures rolled back' as result;
