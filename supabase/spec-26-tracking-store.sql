-- Spec 26: the tracking store. The ig_* tables generalized from "Instagram" to
-- "any platform this profile publishes on".
--
-- Run once in the Supabase SQL editor (after ig-analytics.sql, spec-03, spec-05
-- and spec-06). RLS stays enabled with no policies on every table: only the
-- service role key (server side) can read or write them, never the browser.
-- Access tokens live in channel_connections and have no body counterpart, which
-- is the reason that record exists at all (§5.1).
--
-- NOTHING IS DROPPED. The ig_* tables stay in place, read-only, as the undo for
-- a one-way migration (spec 21 §9.1, §9.7). The old SQL files stay as history.
--
-- The one rule to read before anything else (§6.4): backfill can never
-- reconstruct the missing days. A backfilled row closes no gap. There is no
-- interpolation, no carry-forward and no last-known-value anywhere below.

-- ── channel_connections (replaces ig_accounts) ───────────────────────────────
-- The server-side half of a channel (S17). The body's channel entry carries
-- identity, ownership, timezone and permissions; the TOKEN lives only here.

create table if not exists channel_connections (
  channel_id text primary key,               -- the body entry's id: same channel, two halves
  profile_id text not null,
  platform text not null,
  platform_account_id text not null,
  account_handle text,
  access_token text,
  token_refreshed_at timestamptz,
  connection_status text not null default 'unknown',
  last_successful_sync timestamptz,
  consecutive_failures int not null default 0,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (platform, platform_account_id)
);

-- ── platform_posts (replaces ig_posts) ───────────────────────────────────────
-- One row per post the pipe has ever seen, on any platform. `format_hint` is
-- the platform's own word for the container: a hint, never the truth about
-- format — the piece's birth snapshot is that (S15).

create table if not exists platform_posts (
  platform_post_id text primary key,
  channel_id text not null references channel_connections(channel_id),
  platform text not null,
  published_at timestamptz,
  permalink text,
  post_ref text,                             -- the join key, from the connector (§8)
  media_kind text,
  format_hint text,
  caption text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  deleted_on_platform boolean not null default false
);

-- ── sync_runs (new, §5.5) ────────────────────────────────────────────────────
-- Without this, a missing day and a failed day look identical. With it, every
-- absence carries a reason.

create table if not exists sync_runs (
  run_id text primary key,
  channel_id text not null references channel_connections(channel_id),
  platform text not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  trigger text not null,                     -- cron | owner | retry | backfill
  connection_status text not null default 'unknown',
  posts_seen int not null default 0,
  posts_observed int not null default 0,
  completed boolean not null default false,
  attempt int not null default 1,
  error_summary jsonb not null default '[]'::jsonb,
  resume_cursor text,                        -- a partial run resumes from here (§6.6)
  missed_platform_post_ids jsonb not null default '[]'::jsonb
);

-- ── post_observations (replaces ig_daily_snapshots) ──────────────────────────
-- INSERT-ONLY, for real. ig_daily_snapshots was an UPSERT keyed on
-- (post_id, snapshot_date), so a second run the same day overwrote the first —
-- under S7 that is not a snapshot store, it is a whiteboard. This table has a
-- surrogate id, several rows per post per day are correct and cost nothing, and
-- a correction is a NEW row while the old row stays.

create table if not exists post_observations (
  id bigserial primary key,
  platform_post_id text not null references platform_posts(platform_post_id),
  channel_id text not null references channel_connections(channel_id),
  platform text not null,
  piece_id text,                             -- null until the link join runs (§8)
  kind_of_row text not null default 'lifetime',   -- lifetime | window
  window text not null default 'lifetime',        -- lifetime | first-24h | 7d | 30d
  window_state text,                              -- materialized | too-early | unavailable
  unavailable_reason text,                        -- names the gap. Never a zero.
  age_hours numeric not null,                     -- the ACTUAL age, never the nominal one
  metrics jsonb not null default '{}'::jsonb,
  metric_definition_version int not null default 0,
  account_timezone text,
  local_date date,                                -- the day in the CHANNEL's timezone
  fetched_at timestamptz not null default now(),  -- UTC, always exact
  fetch_time_precision text not null default 'exact',  -- exact | day
  connection_status text not null default 'ok',
  retry_state text not null default 'none',       -- none | retrying | backfilled
  last_successful_sync timestamptz,
  deleted_on_platform boolean not null default false,
  source_run_id text references sync_runs(run_id)
);

-- ── account_observations (replaces ig_account_snapshots) ─────────────────────
-- Same treatment. profile_views and website_clicks (spec 05) carry over as
-- `interval` metrics inside `metrics`, and stay absent before spec 05's ship
-- date — which is the honest "collecting since".

create table if not exists account_observations (
  id bigserial primary key,
  channel_id text not null references channel_connections(channel_id),
  platform text not null,
  metrics jsonb not null default '{}'::jsonb,
  metric_definition_version int not null default 0,
  account_timezone text,
  local_date date,
  fetched_at timestamptz not null default now(),
  fetch_time_precision text not null default 'exact',
  connection_status text not null default 'ok',
  retry_state text not null default 'none',
  source_run_id text references sync_runs(run_id)
);

-- ── post_links (replaces ig_post_links) ──────────────────────────────────────
-- Re-keyed to the canonical PIECE identity (S2). A profile not yet migrated
-- keeps id_kind 'legacy-card' against the old card id; neither kind is ever
-- guessed into the other. A time-window match is a SUGGESTION and is never
-- written here on its own (§8).

create table if not exists post_links (
  piece_id text not null,
  id_kind text not null default 'piece',     -- piece | legacy-card
  profile_id text not null,
  channel_id text,
  platform_post_id text not null references platform_posts(platform_post_id),
  post_ref text,
  matched_at timestamptz not null default now(),
  match_method text not null default 'url-ref',   -- url-ref | owner-confirmed
  confirmed_by text,
  primary key (piece_id, id_kind)
);

-- ── post_readings (replaces ig_post_tags) ────────────────────────────────────
-- Rename and re-address only. The tagging job's behavior does not change, and
-- `corrected` keeps its sticky semantics: a re-run NEVER overwrites a field the
-- owner has corrected by hand.

create table if not exists post_readings (
  platform_post_id text primary key references platform_posts(platform_post_id),
  platform text not null default 'instagram',

  topic_type text,
  hook_type text,
  close_type text,
  cta_type text,
  caption_style text,
  has_face boolean,
  trending_audio boolean,

  transcript text,
  transcript_source text,
  summary text,

  corrected jsonb not null default '[]'::jsonb,
  model text,
  tagged_at timestamptz not null default now()
);

-- ── RLS on, no policies (the existing pattern, unchanged) ────────────────────

alter table channel_connections enable row level security;
alter table platform_posts enable row level security;
alter table sync_runs enable row level security;
alter table post_observations enable row level security;
alter table account_observations enable row level security;
alter table post_links enable row level security;
alter table post_readings enable row level security;

-- ── Append-only, enforced by the database ────────────────────────────────────
-- Acceptance test 4: a direct UPDATE against post_observations is refused. The
-- store boundary in code refuses it too, but the table itself is where the
-- guarantee has to hold — an append-only store that only a library enforces is
-- one stray SQL statement from being a whiteboard again.

create or replace function refuse_observation_rewrite() returns trigger as $$
begin
  raise exception
    'post_observations is append-only (spec 26 §5.3): a correction is a new row, and the old row stays';
end;
$$ language plpgsql;

drop trigger if exists post_observations_append_only on post_observations;
create trigger post_observations_append_only
  before update or delete on post_observations
  for each row execute function refuse_observation_rewrite();

drop trigger if exists account_observations_append_only on account_observations;
create trigger account_observations_append_only
  before update or delete on account_observations
  for each row execute function refuse_observation_rewrite();

-- ── Indexes ──────────────────────────────────────────────────────────────────

create index if not exists platform_posts_channel_published
  on platform_posts (channel_id, published_at desc);
create index if not exists post_observations_post_fetched
  on post_observations (platform_post_id, fetched_at desc);
create index if not exists post_observations_local_date
  on post_observations (channel_id, local_date);
create index if not exists post_observations_window
  on post_observations (platform_post_id, window);
create index if not exists account_observations_local_date
  on account_observations (channel_id, local_date);
create index if not exists sync_runs_channel_started
  on sync_runs (channel_id, started_at desc);
create index if not exists post_links_profile on post_links (profile_id);
create index if not exists post_links_post on post_links (platform_post_id);
