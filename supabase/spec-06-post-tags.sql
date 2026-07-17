-- Spec 06: the reading layer. AI tags for fetched Instagram posts.
-- Run once in the Supabase SQL editor (after ig-analytics.sql).
-- RLS stays enabled with no policies: only the service role key
-- (server-side) can read or write, never the browser.
--
-- One row per fetched post. Written by the tagging job (app/api/ig-tag),
-- read by the analytics layer. The `corrected` column lists field names the
-- owner has overridden by hand; re-runs of the tagging job NEVER overwrite
-- a corrected field (sticky corrections).

create table if not exists ig_post_tags (
  ig_media_id text primary key references ig_posts(id),

  -- the locked tag list (Manmeet, 2026-07-13)
  topic_type text,        -- how-to | story | myth-busting | fear-based | listicle | proof-win | trend | other
  hook_type text,         -- question | bold-claim | story-open | statistic | pain-point | other
  close_type text,        -- cta-close | punchline | summary | open-loop | other
  cta_type text,          -- comment | dm | link | save-share | follow | none
  caption_style text,     -- short | long | storytelling | list
  has_face boolean,       -- face visible in the visuals; null when not determinable
  trending_audio boolean, -- null unless determinable (audio is not fetchable today, so stays null)

  -- reading artifacts
  transcript text,          -- carousel slide text read by the model; null for reels (no transcription path)
  transcript_source text,   -- 'carousel-text' | 'no-transcript' (honesty marker: never a faked transcript)
  summary text,             -- one short line: what the post is about

  -- bookkeeping
  corrected jsonb not null default '[]'::jsonb, -- field names the owner corrected; sticky, never overwritten
  model text,                                   -- which Claude model produced the tags
  tagged_at timestamptz not null default now()
);

alter table ig_post_tags enable row level security;
