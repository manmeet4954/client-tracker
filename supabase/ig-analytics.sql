-- Instagram performance analytics tables.
-- Run once in the Supabase SQL editor. Service role key bypasses RLS;
-- RLS stays enabled with no policies so the anon key can never read tokens.

create table if not exists ig_accounts (
  id text primary key,                    -- Instagram user id
  username text not null,
  access_token text not null,
  token_refreshed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists ig_posts (
  id text primary key,                    -- Instagram media id
  account_id text not null references ig_accounts(id),
  caption text,
  media_type text,
  media_product_type text,
  permalink text,
  posted_at timestamptz,
  first_seen_at timestamptz not null default now()
);

create table if not exists ig_daily_snapshots (
  post_id text not null references ig_posts(id),
  snapshot_date date not null,
  views int,
  reach int,
  likes int,
  comments int,
  saves int,
  shares int,
  total_interactions int,
  primary key (post_id, snapshot_date)
);

create table if not exists ig_account_snapshots (
  account_id text not null references ig_accounts(id),
  snapshot_date date not null,
  followers int,
  media_count int,
  primary key (account_id, snapshot_date)
);

alter table ig_accounts enable row level security;
alter table ig_posts enable row level security;
alter table ig_daily_snapshots enable row level security;
alter table ig_account_snapshots enable row level security;

create index if not exists ig_posts_account_posted on ig_posts (account_id, posted_at desc);
create index if not exists ig_snapshots_date on ig_daily_snapshots (snapshot_date);
