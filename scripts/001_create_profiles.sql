-- Create profiles table with user metadata
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  country text,
  occupation text, -- student, researcher, company_employee, other
  created_at timestamp default now(),
  updated_at timestamp default now()
);

-- Enable Row Level Security
alter table public.profiles enable row level security;

-- RLS Policies
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id);

create policy "profiles_delete_own"
  on public.profiles for delete
  using (auth.uid() = id);

-- Create logs table for tracking executions
create table if not exists public.execution_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  circuit_name text,
  execution_type text, -- 'auto', 'manual', 'template'
  backend text, -- 'quantum_inspired_gpu', 'hpc_gpu', 'quantum_qpu'
  status text, -- 'pending', 'running', 'completed', 'failed'
  success_rate numeric,
  runtime_ms numeric,
  qubits_used integer,
  shots integer,
  error_mitigation text,
  created_at timestamp default now(),
  completed_at timestamp
);

-- Enable RLS on logs
alter table public.execution_logs enable row level security;

-- RLS Policies for logs
create policy "logs_select_own"
  on public.execution_logs for select
  using (auth.uid() = user_id);

create policy "logs_insert_own"
  on public.execution_logs for insert
  with check (auth.uid() = user_id);

-- Create circuit templates table
create table if not exists public.circuit_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  qasm_code text,
  qubits integer,
  gates integer,
  created_at timestamp default now()
);

-- Enable RLS on templates
alter table public.circuit_templates enable row level security;

-- RLS Policies for templates
create policy "templates_select_own"
  on public.circuit_templates for select
  using (auth.uid() = user_id);

create policy "templates_insert_own"
  on public.circuit_templates for insert
  with check (auth.uid() = user_id);

create policy "templates_update_own"
  on public.circuit_templates for update
  using (auth.uid() = user_id);

create policy "templates_delete_own"
  on public.circuit_templates for delete
  using (auth.uid() = user_id);

-- Create auto-profile trigger
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (
    new.id,
    new.email
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
