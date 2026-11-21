-- Add every optional matching preference supported by src/lib/profileMapper.ts.
begin;

alter table public.profiles
  add column if not exists monthly_rent integer check (monthly_rent >= 0),
  add column if not exists room_type text check (room_type in ('private', 'shared', 'either')),
  add column if not exists study_environment text check (
    study_environment in ('silent', 'quiet', 'background_noise_ok', 'away_from_home')
  ),
  add column if not exists guest_frequency text check (
    guest_frequency in ('never', 'rarely', 'sometimes', 'often')
  ),
  add column if not exists smoking text check (smoking in ('smoke_free', 'outside_only', 'smoker')),
  add column if not exists dealbreakers text[] not null default '{}'
    check (dealbreakers <@ array['no_smoking', 'no_pets', 'no_frequent_guests']::text[]);

grant insert (monthly_rent, room_type, study_environment, guest_frequency, smoking, dealbreakers)
  on public.profiles to authenticated;
grant update (monthly_rent, room_type, study_environment, guest_frequency, smoking, dealbreakers)
  on public.profiles to authenticated;

commit;
