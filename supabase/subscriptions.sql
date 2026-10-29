-- Subscription columns for profiles (Waffo, $4.99/month after a 1-day free trial).
-- Run once in the Supabase SQL editor.

alter table public.profiles
  add column if not exists subscription_status text default 'trialing';
alter table public.profiles
  add column if not exists trial_ends_at timestamptz;
alter table public.profiles
  add column if not exists subscription_ends_at timestamptz;
alter table public.profiles
  add column if not exists waffo_order_id text;

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

-- Optional: stall re-kick — no-op for rows already set.
alter table public.profiles enable row level security;
