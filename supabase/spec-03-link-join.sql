-- Spec 03: Analytics Foundation - the link join.
-- Run once in the Supabase SQL editor (after ig-analytics.sql).
-- RLS stays enabled with no policies: only the service role key
-- (server-side) can read or write these, never the browser.

-- Account join: which dashboard client each Instagram account belongs to.
alter table ig_accounts add column if not exists client_id text;

-- Post join: a content card's live link matched to a fetched Instagram post.
-- One row per card. Written by the nightly sync, read by the analytics layer.
create table if not exists ig_post_links (
  card_id text primary key,                          -- ContentCard id in the app state
  client_id text not null,                           -- dashboard client the card belongs to
  ig_media_id text not null references ig_posts(id), -- the fetched Instagram post
  matched_at timestamptz not null default now()
);

alter table ig_post_links enable row level security;

create index if not exists ig_post_links_client on ig_post_links (client_id);
create index if not exists ig_post_links_media on ig_post_links (ig_media_id);
