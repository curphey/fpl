-- Create notification_preferences table
create table public.notification_preferences (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null unique,

  -- Email preferences
  email_enabled boolean default false not null,
  email_address text,
  email_deadline_reminder boolean default true not null,
  email_deadline_hours integer default 24 not null,
  email_weekly_summary boolean default true not null,
  email_transfer_recommendations boolean default true not null,

  -- Push notification preferences
  push_enabled boolean default false not null,
  push_subscription jsonb, -- Web push subscription object
  push_deadline_reminder boolean default true not null,
  push_deadline_hours integer default 1 not null,
  push_price_changes boolean default true not null,
  push_injury_news boolean default true not null,
  push_league_updates boolean default true not null,

  -- General settings
  quiet_hours_start integer, -- Hour of day (0-23) to stop notifications
  quiet_hours_end integer, -- Hour of day (0-23) to resume notifications
  timezone text default 'Europe/London' not null,

  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Index for looking up preferences by user
create index idx_notification_preferences_user_id on public.notification_preferences (user_id);

-- Enable Row Level Security
alter table public.notification_preferences enable row level security;

-- RLS policies: users can only access their own preferences
create policy "Users can view own notification preferences"
  on public.notification_preferences for select
  using (auth.uid() = user_id);

create policy "Users can insert own notification preferences"
  on public.notification_preferences for insert
  with check (auth.uid() = user_id);

create policy "Users can update own notification preferences"
  on public.notification_preferences for update
  using (auth.uid() = user_id);

-- Create notification_history table
create table public.notification_history (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,

  notification_type text not null, -- 'deadline', 'price_change', 'injury', 'transfer_rec', 'league_update'
  channel text not null, -- 'email', 'push'
  title text not null,
  body text not null,
  data jsonb, -- Additional metadata

  sent_at timestamptz default now() not null,
  read_at timestamptz,
  clicked_at timestamptz
);

-- Index for querying user's notification history
create index idx_notification_history_user_id on public.notification_history (user_id, sent_at desc);

-- Enable Row Level Security
alter table public.notification_history enable row level security;

-- RLS policies for notification history
create policy "Users can view own notification history"
  on public.notification_history for select
  using (auth.uid() = user_id);

create policy "Users can update own notification history"
  on public.notification_history for update
  using (auth.uid() = user_id);

-- Function to auto-create notification preferences on user signup
create or replace function public.handle_new_user_notifications()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.notification_preferences (user_id, email_address)
  values (
    new.id,
    new.email
  );
  return new;
end;
$$;

-- Trigger on auth.users insert
create trigger on_auth_user_created_notifications
  after insert on auth.users
  for each row execute function public.handle_new_user_notifications();

-- Function to update updated_at timestamp
create or replace function public.update_notification_preferences_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Trigger to auto-update updated_at
create trigger update_notification_preferences_timestamp
  before update on public.notification_preferences
  for each row execute function public.update_notification_preferences_updated_at();
