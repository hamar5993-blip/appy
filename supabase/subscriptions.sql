-- Waffo billing schema + signup repair (run the WHOLE file in the Supabase SQL
-- editor; it is idempotent and safe to run again at any time).
--
-- Fixes two problems:
--   • "Database error saving new user": GoTrue runs every user-created trigger
--     on auth.users inside the signup transaction, so one broken trigger aborts
--     every signup. We remove them all and install a working handle_new_user.
--   • Subscription state never appears in Supabase: the subscription columns on
--     public.profiles were missing. The webhook writes into these columns.

-- 1) Subscription columns on profiles ---------------------------------------

alter table public.profiles
  add column if not exists subscription_status text default 'trialing';
alter table public.profiles
  add column if not exists trial_ends_at timestamptz;
alter table public.profiles
  add column if not exists subscription_ends_at timestamptz;
alter table public.profiles
  add column if not exists waffo_order_id text;
alter table public.profiles
  add column if not exists updated_at timestamptz default now();

-- 2) Repair signup: replace every trigger on auth.users ---------------------

do $$
declare
  trg record;
begin
  for trg in
    select distinct t.tgname
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'auth'
      and c.relname = 'users'
      and not t.tgisinternal
  loop
    execute format('drop trigger if exists %I on auth.users', trg.tgname);
    raise notice 'removed trigger % on auth.users', trg.tgname;
  end loop;
end $$;

-- Create the profile row when Supabase Auth creates the user. Any failure is
-- logged but never aborts the signup transaction (the signed-up page also
-- upserts the profile as a backstop).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1), 'Student')
  )
  on conflict (id) do nothing;
  return new;
exception when others then
  raise warning 'handle_new_user: could not create profile for % (%)', new.id, sqlerrm;
  return new;
end;
$$;

drop trigger if exists handle_new_user on auth.users;
create trigger handle_new_user
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- 3) Trial trigger on profiles (covers client-side inserts as well) ---------

-- New users start their 1-day free trial automatically at signup.
create or replace function public.set_trial_on_signup()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.trial_ends_at is null then
    new.subscription_status := 'trialing';
    new.trial_ends_at := now() + interval '1 day';
  end if;
  return new;
end;
$$;

drop trigger if exists set_trial_trigger on public.profiles;
create trigger set_trial_trigger
  before insert on public.profiles
  for each row execute function public.set_trial_on_signup();

-- Give existing users their 1-day trial from when they joined (no lock-out).
update public.profiles
   set subscription_status = 'trialing',
       trial_ends_at = coalesce(trial_ends_at, created_at + interval '1 day')
 where trial_ends_at is null
    or subscription_status is null;

-- 4) RLS + indexes ----------------------------------------------------------

-- Client access is limited to the user's own profile row. Subscription fields
-- are written only by the webhook with the service role (which bypasses RLS),
-- so no UPDATE policy is created here.
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

-- Webhook lookups: by user id (primary) and email (fallback for old checkouts).
create index if not exists profiles_email_idx on public.profiles (email);
create index if not exists profiles_waffo_order_id_idx on public.profiles (waffo_order_id);
