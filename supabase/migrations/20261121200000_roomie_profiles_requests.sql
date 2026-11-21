-- Apply after 20261121180000_restrict_signup_email_domains.sql.
-- One-time, transactional migration. Never run with RLS disabled.
begin;

create table public.university_domains (
  domain text primary key check (domain = lower(trim(domain)) and domain <> '' and domain not like '%@%'),
  university_name text not null check (length(trim(university_name)) > 0),
  university_id text not null,
  is_active boolean not null default true
);
insert into public.university_domains (domain, university_name, university_id)
values ('usf.edu', 'University of South Florida', 'usf');

create schema if not exists roomie_private;
revoke all on schema roomie_private from public;
grant usage on schema roomie_private to authenticated;

-- Only returns a university identifier, never the email. Reads authoritative
-- Auth state on each statement, including confirmation and domain activation.
create function roomie_private.verified_university(user_id uuid)
returns text language sql stable security definer set search_path = ''
as $$
  select d.university_id
  from auth.users u
  join public.university_domains d
    on d.domain = lower(split_part(u.email, '@', 2))
  where u.id = user_id and u.email_confirmed_at is not null
    and d.is_active and (u.banned_until is null or u.banned_until <= now());
$$;
revoke all on function roomie_private.verified_university(uuid) from public;
grant execute on function roomie_private.verified_university(uuid) to authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (length(trim(display_name)) between 1 and 100),
  university text not null,
  university_id text not null,
  major text,
  academic_year text check (academic_year in ('freshman', 'sophomore', 'junior', 'senior', 'graduate')),
  bio text check (length(bio) <= 2000),
  budget_min integer not null check (budget_min >= 0),
  budget_max integer not null check (budget_max >= budget_min),
  distance_from_campus_miles numeric not null check (distance_from_campus_miles between 0 and 1000),
  roommates_wanted integer not null check (roommates_wanted between 1 and 20),
  move_in_date date,
  cleanliness text check (cleanliness in ('relaxed', 'moderate', 'tidy', 'very_tidy')),
  sleep_schedule text check (sleep_schedule in ('early_bird', 'flexible', 'night_owl')),
  noise_tolerance text check (noise_tolerance in ('quiet', 'moderate', 'lively')),
  pet_preference text check (pet_preference in ('no_pets', 'pets_ok', 'has_pets')),
  housing_status text not null check (housing_status in ('have_room', 'need_room')),
  interests text[] not null default '{}',
  is_active boolean not null default true,
  verified_university_email boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_discovery_idx on public.profiles (university_id) where is_active;

create function roomie_private.prepare_profile()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  verified_id text := roomie_private.verified_university(new.id);
begin
  if tg_op = 'UPDATE' and new.id is distinct from old.id then
    raise exception 'Profile ownership cannot change' using errcode = '42501';
  end if;
  if verified_id is null then
    raise exception 'A confirmed supported university email is required' using errcode = '42501';
  end if;
  new.university_id := verified_id;
  select d.university_name into new.university
    from public.university_domains d join auth.users u
      on d.domain = lower(split_part(u.email, '@', 2))
    where u.id = new.id and d.is_active;
  new.verified_university_email := true;
  if tg_op = 'UPDATE' then new.created_at := old.created_at;
  else new.created_at := now(); end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function roomie_private.prepare_profile() from public;
create trigger prepare_profile before insert or update on public.profiles
for each row execute function roomie_private.prepare_profile();

create table public.roommate_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  receiver_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  constraint no_self_requests check (sender_id <> receiver_id)
);
-- A pair can have only one request, including reversed sender/receiver order.
create unique index roommate_requests_pair_idx on public.roommate_requests
  (least(sender_id, receiver_id), greatest(sender_id, receiver_id));
create index roommate_requests_sender_idx on public.roommate_requests(sender_id);
create index roommate_requests_receiver_idx on public.roommate_requests(receiver_id);

create function roomie_private.guard_request_update()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.id is distinct from old.id or new.sender_id is distinct from old.sender_id
    or new.receiver_id is distinct from old.receiver_id or new.created_at is distinct from old.created_at then
    raise exception 'Request identity and ownership cannot change' using errcode = '42501';
  end if;
  if old.status <> 'pending' or new.status not in ('accepted', 'declined') then
    raise exception 'Only pending requests can be accepted or declined' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function roomie_private.guard_request_update() from public;
create trigger guard_request_update before update on public.roommate_requests
for each row execute function roomie_private.guard_request_update();

alter table public.profiles enable row level security;
alter table public.roommate_requests enable row level security;
alter table public.university_domains enable row level security;
revoke all on public.profiles, public.roommate_requests, public.university_domains from public, anon, authenticated;

grant select on public.university_domains to authenticated;
create policy active_domains_read on public.university_domains for select to authenticated
using (is_active);

grant select on public.profiles to authenticated;
-- No client write privileges for derived university, verification or timestamps.
grant insert (id, display_name, major, academic_year, bio, budget_min, budget_max,
  distance_from_campus_miles, roommates_wanted, move_in_date, cleanliness,
  sleep_schedule, noise_tolerance, pet_preference, housing_status, interests, is_active)
on public.profiles to authenticated;
grant update (display_name, major, academic_year, bio, budget_min, budget_max,
  distance_from_campus_miles, roommates_wanted, move_in_date, cleanliness,
  sleep_schedule, noise_tolerance, pet_preference, housing_status, interests, is_active)
on public.profiles to authenticated;

create policy profiles_read on public.profiles for select to authenticated
using (
  roomie_private.verified_university((select auth.uid())) is not null
  and (id = (select auth.uid()) or (
    is_active and university_id = roomie_private.verified_university((select auth.uid()))
    and university_id = roomie_private.verified_university(id)
  ))
);
create policy profiles_insert_own on public.profiles for insert to authenticated
with check (id = (select auth.uid())
  and university_id = roomie_private.verified_university((select auth.uid())));
create policy profiles_update_own on public.profiles for update to authenticated
using (id = (select auth.uid()) and roomie_private.verified_university((select auth.uid())) is not null)
with check (id = (select auth.uid())
  and university_id = roomie_private.verified_university((select auth.uid())));

grant select on public.roommate_requests to authenticated;
grant insert (sender_id, receiver_id) on public.roommate_requests to authenticated;
grant update (status) on public.roommate_requests to authenticated;
create policy requests_participants_read on public.roommate_requests for select to authenticated
using ((select auth.uid()) in (sender_id, receiver_id)
  and roomie_private.verified_university((select auth.uid())) is not null);
create policy requests_send_own on public.roommate_requests for insert to authenticated
with check (sender_id = (select auth.uid()) and status = 'pending'
  and exists (select 1 from public.profiles p where p.id = sender_id and p.is_active)
  and exists (select 1 from public.profiles p where p.id = receiver_id and p.is_active));
create policy requests_receiver_respond on public.roommate_requests for update to authenticated
using (receiver_id = (select auth.uid()) and status = 'pending'
  and roomie_private.verified_university((select auth.uid())) is not null)
with check (receiver_id = (select auth.uid()) and status in ('accepted', 'declined'));

-- Keep the existing configured Auth hook name; switch its source to the new table.
create or replace function public.hook_restrict_signup_by_email_domain(event jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
begin
  if exists (select 1 from public.university_domains d
    where d.domain = lower(split_part(coalesce(event->'user'->>'email', ''), '@', 2)) and d.is_active) then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('error', jsonb_build_object(
    'http_code', 403, 'message', 'Use an approved university email address.'));
end;
$$;
revoke all on function public.hook_restrict_signup_by_email_domain(jsonb) from public, anon, authenticated;
grant usage on schema public to supabase_auth_admin;
grant execute on function public.hook_restrict_signup_by_email_domain(jsonb) to supabase_auth_admin;
-- Retain the older table for migration history; it is no longer authoritative.
revoke all on public.allowed_email_domains from public, anon, authenticated;

commit;
