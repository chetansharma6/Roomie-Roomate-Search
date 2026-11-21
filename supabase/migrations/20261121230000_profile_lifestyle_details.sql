alter table public.profiles add column lifestyle_details jsonb;

alter table public.profiles add constraint profiles_lifestyle_details_check check (
  lifestyle_details is null or case when jsonb_typeof(lifestyle_details) = 'object' then (
    lifestyle_details - array['temperature', 'bedtime', 'guests', 'chores', 'priorities'] = '{}'::jsonb
    and lifestyle_details->>'temperature' in ('cool', 'moderate', 'warm', 'flexible')
    and lifestyle_details->>'bedtime' in ('before_10', '10_to_midnight', 'after_midnight', 'varies')
    and lifestyle_details->>'guests' in ('rarely', 'monthly', 'weekly', 'several_weekly')
    and lifestyle_details->>'chores' in ('rotate', 'divide', 'as_needed')
    and case when jsonb_typeof(lifestyle_details->'priorities') = 'array' then
      jsonb_array_length(lifestyle_details->'priorities') <= 2
      and lifestyle_details->'priorities' <@ '["temperature","cleanliness","bedtime","guests","quiet","chores","pets"]'::jsonb
      and (jsonb_array_length(lifestyle_details->'priorities') < 2 or lifestyle_details->'priorities'->0 <> lifestyle_details->'priorities'->1)
    else false end
  ) is true else false end
);

grant insert (lifestyle_details), update (lifestyle_details) on public.profiles to authenticated;
