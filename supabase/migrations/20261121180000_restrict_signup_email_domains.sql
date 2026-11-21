-- Keep this table private. Supabase Auth reaches it only through the
-- security-definer hook below.
create table if not exists public.allowed_email_domains (
  domain text primary key,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint allowed_email_domains_normalized check (
    domain = lower(trim(domain))
    and domain <> ''
    and domain not like '%@%'
  )
);

alter table public.allowed_email_domains enable row level security;

-- Roomie's current fictional demo data uses the University of South Florida.
-- Add another explicit row before supporting another institution.
insert into public.allowed_email_domains (domain)
values ('usf.edu')
on conflict (domain) do update set active = true;

create or replace function public.hook_restrict_signup_by_email_domain(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  email_address text := lower(trim(coalesce(event->'user'->>'email', '')));
  email_domain text := split_part(email_address, '@', 2);
begin
  if email_domain <> '' and exists (
    select 1
    from public.allowed_email_domains
    where domain = email_domain and active
  ) then
    return '{}'::jsonb;
  end if;

  return jsonb_build_object(
    'error', jsonb_build_object(
      'http_code', 403,
      'message', 'Use an approved university email address.'
    )
  );
end;
$$;

revoke execute on function public.hook_restrict_signup_by_email_domain(jsonb)
from public, anon, authenticated;

grant execute on function public.hook_restrict_signup_by_email_domain(jsonb)
to supabase_auth_admin;
