alter table public.profiles add column photo_url text
  check (photo_url is null or (length(photo_url) <= 2048 and photo_url ~ '^https://[^/?#[:space:]@]+'));

grant insert (photo_url), update (photo_url) on public.profiles to authenticated;
