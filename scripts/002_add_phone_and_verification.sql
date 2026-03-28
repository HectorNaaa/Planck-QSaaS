-- Add phone fields and verification codes table
alter table public.profiles add column if not exists phone_number text;
alter table public.profiles add column if not exists country_code text;
alter table public.profiles add column if not exists email_verified boolean default false;
alter table public.profiles add column if not exists phone_verified boolean default false;

-- Create verification codes table
create table if not exists public.verification_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  phone_number text,
  code text not null,
  code_type text not null, -- 'email' or 'sms'
  attempts integer default 0,
  max_attempts integer default 3,
  expires_at timestamp not null,
  verified_at timestamp,
  created_at timestamp default now()
);

-- Enable RLS on verification codes
alter table public.verification_codes enable row level security;

create policy "verification_codes_select_own"
  on public.verification_codes for select
  using (auth.uid() = user_id);

create policy "verification_codes_insert_own"
  on public.verification_codes for insert
  with check (auth.uid() = user_id);

create policy "verification_codes_update_own"
  on public.verification_codes for update
  using (auth.uid() = user_id);
