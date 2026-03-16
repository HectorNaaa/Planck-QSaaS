-- Fix: create/replace the handle_new_user trigger that auto-inserts a profile
-- row when a user registers. Uses SECURITY DEFINER so it runs with the
-- function owner's privileges (bypasses RLS — no active session needed).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    email,
    name,
    country,
    country_code,
    phone_number,
    occupation,
    organization,
    email_verified
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'country', ''),
    coalesce(new.raw_user_meta_data ->> 'country_code', ''),
    coalesce(new.raw_user_meta_data ->> 'phone_number', ''),
    coalesce(new.raw_user_meta_data ->> 'occupation', ''),
    coalesce(new.raw_user_meta_data ->> 'organization', ''),
    false
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- Drop existing trigger if present, then recreate
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
