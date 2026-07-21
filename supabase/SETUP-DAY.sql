-- SETUP DAY — all three analytics migrations in one paste.
--
-- This is a convenience copy of spec-03-link-join.sql,
-- spec-05-account-insights.sql and spec-06-post-tags.sql, in the order they
-- must run. Paste the whole file into the Supabase SQL editor and press Run.
--
-- Safe to run more than once: every statement is "if not exists". Nothing is
-- ever deleted or overwritten.
--
-- Assumes ig-analytics.sql already ran (it did — the daily Instagram
-- collection has been live since 2026-07-11).


-- ── Spec 03: the link join ──────────────────────────────────────────────────
-- Which dashboard client each Instagram account belongs to, and the match
-- between a content card's live link and the fetched Instagram post.

alter table ig_accounts add column if not exists client_id text;

create table if not exists ig_post_links (
  card_id text primary key,                          -- ContentCard id in the app state
  client_id text not null,                           -- dashboard client the card belongs to
  ig_media_id text not null references ig_posts(id), -- the fetched Instagram post
  matched_at timestamptz not null default now()
);

alter table ig_post_links enable row level security;

create index if not exists ig_post_links_client on ig_post_links (client_id);
create index if not exists ig_post_links_media on ig_post_links (ig_media_id);


-- ── Spec 05: funnel inputs ──────────────────────────────────────────────────
-- Daily profile visits and bio-link taps. Collected from the day this ships;
-- older days stay null and the UI says "collecting since" honestly.

alter table ig_account_snapshots add column if not exists profile_views int;
alter table ig_account_snapshots add column if not exists website_clicks int;


-- ── Spec 06: the reading layer ──────────────────────────────────────────────
-- AI tags per fetched post. `corrected` lists fields the owner fixed by hand;
-- re-runs never overwrite those.

create table if not exists ig_post_tags (
  ig_media_id text primary key references ig_posts(id),

  topic_type text,        -- how-to | story | myth-busting | fear-based | listicle | proof-win | trend | other
  hook_type text,         -- question | bold-claim | story-open | statistic | pain-point | other
  close_type text,        -- cta-close | punchline | summary | open-loop | other
  cta_type text,          -- comment | dm | link | save-share | follow | none
  caption_style text,     -- short | long | storytelling | list
  has_face boolean,       -- face visible in the visuals; null when not determinable
  trending_audio boolean, -- null unless determinable (audio is not fetchable today)

  transcript text,          -- carousel slide text read by the model; null for reels
  transcript_source text,   -- 'carousel-text' | 'no-transcript' (never a faked transcript)
  summary text,             -- one short line: what the post is about

  corrected jsonb not null default '[]'::jsonb,
  model text,
  tagged_at timestamptz not null default now()
);

alter table ig_post_tags enable row level security;
