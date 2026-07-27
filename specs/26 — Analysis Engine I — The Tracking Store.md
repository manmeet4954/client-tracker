# 26 — Analysis Engine I — The Tracking Store

**Status:** BUILT 2026-07-27, NOT DEPLOYED. All 12 acceptance tests in §15 are
implemented and green; 238/238 with specs 21–24's checks. The live-data halves of
tests 11 and 12 wait on her setup day and are present as named skips. Build
record and the three resolutions the build had to make: `STATE.md`. First spec of
the Analysis Engine family (PLAN §5 — "each engine gets its own separate family
of specifications"). Written in a fresh Opus chat per the working structure
(PLAN §6), reading only the vault.

**Authority:** `PLAN.md` outranks this file; where PLAN §10's amendments touch
anything below, the amendment wins. `specs/21 — Data-Layer Restructure.md` is the
contract this spec builds ON: the canonical Metric Observation (§7.5) and Channel
(§7.3) objects are spec 21's, and this spec extends them rather than declaring
second versions. Spec 03's link join is generalized here, not reinvented.

**Scope in one line:** the body-owned store that records what every connected
account does, forever, honestly — collection, storage, and the honesty machinery
around both. **No reading surface.** Bifurcation, compare, scorecard, funnel,
verdicts and the digest are spec 27's; nothing in this file renders a screen for
her or a client beyond the owner-only plumbing named in §11.

**Why this comes before spec 27:** PLAN §5.2, her correction — *"track and keep
everything… every day not recorded is gone, so recording is the engine's first
duty."* A reading surface built on a store that cannot tell a gap from a slump
would be a lying machine. This spec is the store and the honesty. Spec 27 reads it.

---

## 1. What this spec is, and is not

**It is:**

1. **The body-owned metric-observation store (S3)** — the `ig_*` mechanism
   generalized from "Instagram" to "any platform this profile publishes on",
   still owned by the BODY, still computed-from-never-owned-by the engine.
2. **The collector** — one daily-and-forever pipe per connected channel, with the
   full S7 sync-health machinery: account timezone, fetch time, platform post id,
   metric-definition version, connection status, retry/backfill state, last
   successful sync, deletion markers, and coverage gaps that stay visible.
3. **The age-window machinery (S6)** — every metric stored by age since
   publication, with the 24h / 7d / 30d windows and their minimum thresholds, so
   nothing is ever compared at unequal ages.
4. **The channel record (S17)** — identity, ownership, timezone, permissions, and
   the split between what lives in the body (identity) and what lives server-side
   only (the token).
5. **The link join, re-addressed** — spec 03's shortcode match, generalized to a
   per-connector post reference, and re-pointed from the legacy content card to
   the canonical PIECE identity (S2).
6. **The measuring-stick gate (S16)** — a goal or a pillar job that has not
   declared its metric ids, direction, calculation, denominator, window, target,
   platform availability and not-measurable fallback does not get analysis. The
   gate is enforced at strategy lock, not at render time.
7. **The S23 wall** — observed platform funnel metrics and attributed business
   outcomes live in two separate addresses and no code path may quietly divide
   one by the other.

**It is not:**

- **Any reading surface.** No scorecard, no funnel screen, no bifurcation UI, no
  compare screen, no verdicts, no digest. Spec 27.
- **Any AI.** The reading layer's AI tagging (spec 06 / `ig_post_tags`) is
  re-addressed and migrated here with **zero behavior change**; its use as a
  fallback tag source belongs to spec 27.
- **A new storage pattern.** See §3.
- **A new client door.** Nothing in this spec is client-writable or
  client-readable. Every path it touches is `audience: owner` (§12).
- **The setup day.** SQL runs, tokens, tester invites and the ANTHROPIC_API_KEY
  are hers and already owed (STATE.md). This spec's build does not wait on them;
  its live-data acceptance tests do.

---

## 2. The one job

*Record what every connected account did, every day, forever — and never let a
silence be read as a result.*

Two facts make that the whole job:

1. **Platform APIs report lifetime totals as of today.** A day not recorded is
   gone; no backfill recovers its curve. This is already written into the live
   code's header comment and into PLAN §5.2.
2. **Collection has been stalled since 2026-07-12** (STATE.md, spec 21 §7.5).
   That stretch is not weak content. It is a hole in the pipe, and it must render
   as a hole in every surface that ever touches it — spec 21 acceptance test 8
   already binds this, and this spec is where the machinery to satisfy it lives.

So the store's design test is not "can it answer questions." It is: **can it
always say which of the three it is** — *this happened*, *this did not happen*,
or *we were not looking*.

---

## 3. The storage decision (recorded per CLAUDE.md rule 5)

Rule 5 requires a recorded decision before any second storage pattern. **This
spec introduces none.** For the record:

1. **Metric observations stay in Supabase pipeline tables** — the one existing
   exception named in rule 5 and re-affirmed by spec 21 §3.2. RLS on, no
   policies, service-role key only, never reachable from the browser. What
   changes is that the tables stop being Instagram-shaped.
2. **The tables are generalized, not multiplied.** A `linkedin_*` family
   alongside `ig_*` would be a second pattern by another name and would make
   every cross-platform read a union. Instead one platform-neutral family, with
   `platform` as a column and the per-platform difference pushed into a code-level
   connector (§6.1). Committed pick, not a menu.
3. **No analytics data enters the AppState blob** (spec 03's rule, kept). The
   body's `work-log/analysis/study-own-data/*` addresses are the OWNERSHIP
   contract over these tables — exactly S25's reading of "folder": the path
   namespace says who owns, who writes, who reads, how it remembers, and which
   switch governs it. The bytes live in Postgres.
4. **The one thing that does live in the blob:** the S16 measurement
   declarations (§9) and the attributed-outcome records (§10). Both are her
   decisions and her hand-entered numbers, not fetched observations, and both are
   small. They go through the path-scoped write door (spec 21 §3.4) like
   everything else.
5. **Secrets never enter the blob.** Access tokens stay in
   `channel_connections`, service-role only, exactly where `ig_accounts` keeps
   them today. The body's channel entry carries identity, ownership, timezone and
   permissions — and no token. This is the split spec 21 §8.6 already ordered.

---

## 4. Addresses — every folder this spec reads and writes

Per PLAN §6 rule 3: no address, no build.

### 4.1 Written

| Path | What lands there | Fed by | Read by | Switch | History | Audience |
|---|---|---|---|---|---|---|
| `work-log/analysis/study-own-data/observations` | the append-only metric observations, per piece and per account | `pipe:platform-metrics` | `engine:analysis`, `work-log/analysis` | `analysis.tracking` | `append_only` | owner |
| `work-log/analysis/study-own-data/sync-health` | sync runs, connection status, last successful sync, retry/backfill state, coverage gaps | `pipe:platform-metrics` | owner, `engine:analysis` | `analysis.sync_health` | `append_only` | owner |
| `work-log/analysis/study-own-data/links` | the piece ↔ platform-post join (spec 03, generalized) | `pipe:platform-metrics`, `owner` | `engine:analysis`, `work-log/creation` | `analysis.tracking` | `append_only` | owner |
| `work-log/analysis/attributed-outcomes` | business outcomes with a declared event source and attribution method (S23) | `owner`, `pipe:<declared source>` | owner | `analysis.attributed_outcomes` | `append_only` | owner |
| `context/content-strategy/goals/*/measurement` | the S16 declaration for one goal | `owner` | `work-log/analysis`, `engine:analysis` | `strategy.fixed` | `versioned` | owner |
| `context/content-strategy/pillars/*/measurement` | the S16 declaration for one pillar job | `owner` | `work-log/analysis`, `engine:analysis` | `strategy.fixed` | `versioned` | owner |
| `context/content-strategy/platforms/*/metrics` | which metrics this platform reports for this profile, plus per-profile overrides | `owner` | `work-log/analysis`, `pipe:platform-metrics` | `platforms.*` | `versioned` | owner |
| `work-log/creation/channels` | the channel record's sync-relevant fields (timezone, connection, track-since) | `owner`, `pipe:platform-metrics` | `work-log/analysis/study-own-data` | `creation.channels` | `mutable_with_supersession` | owner |

Four of these are new paths and go to the control room for ratification (§16).
`work-log/creation/channels` and the two strategy entry-folders already exist;
this spec adds parameters INSIDE them (law 2's third level), which is growth
inside the spine, not a reshaping of it (law 1).

**One contract clarification the validator must carry:** a child path may declare
an audience MORE restrictive than its parent, never less. `goals/` is
`audience: both, client_door: see:strategy`; `goals/*/measurement` is
`audience: owner`. Law 3 inherits connections downward; it must not force
visibility downward. Without this rule the S16 declarations would leak into the
client's strategy summary, which is workshop material (CLAUDE.md rule 1).

### 4.2 Read

| Path | Why this spec reads it |
|---|---|
| `work-log/creation` | the canonical piece identity, its live link, its birth snapshot (S15) — the join target |
| `work-log/creation/channels` | which accounts to collect from, their timezone, ownership and connection state |
| `context/content-strategy/platforms/*` | which platforms are switched on for this profile; `connection/` for API status |
| `context/content-strategy/platforms/*/formats` | metric availability differs by format (a static has no watch time) |
| `context/content-strategy/pillars/*/job` | the subject of a measurement declaration |
| `context/content-strategy/goals` | the subject of a measurement declaration |
| `context/content-strategy/toolset` | every switch position, before anything collects or renders |
| `shelf/profiles` | profile lifecycle (S22): whether connectors are revoked |

### 4.3 Not touched

`work-log/analysis/client-perception`, `work-log/logs/observations`,
`work-log/analysis/comparisons`, `work-log/analysis/digests`. Perception notes,
DM counts, inquiries and her remarks are **soft signals** — recorded elsewhere,
never fed into this store's math (PLAN §5.2, her correction). Comparisons and
digests are spec 27's, and they READ this store; they do not write it.

---

## 5. The objects

Spec 21 §7 declared the identities. This spec fills in the fields the collector
needs and adds the five objects spec 21 named but did not shape.

### 5.1 Channel connection — the server-side half of a channel (S17)

The body's `Channel` (spec 21 §7.3) already carries `platform`,
`account_handle`, `ownership`, `connection`, `timezone`, `posting_permission`.
This spec adds two body fields and one server-side record.

Body additions to the channel entry:

- `track_since` — the earliest publication date this channel collects from. Today
  this is a hard-coded `TRACK_SINCE = '2026-05-01'` in `ig-sync`; it becomes a
  per-channel value, defaulting to the connection date and settable by her. It is
  what makes an honest "collecting since" line possible instead of a fake zero.
- `metrics_permission` — `granted` | `not-granted` | `unknown`. Reading a
  client-owned account's numbers is a permission distinct from posting to it
  (S17 lists posting permission only). Collection refuses on `not-granted`;
  `unknown` collects and raises a sort-queue item for her.

Server-side `channel_connections` (replaces `ig_accounts`): `channel_id` (the
body entry's id — the two halves are the same channel), `profile_id`, `platform`,
`platform_account_id`, `access_token`, `token_refreshed_at`,
`connection_status`, `last_successful_sync`, `consecutive_failures`,
`revoked_at`. The token is the only field that has no body counterpart, and it
is the reason this record exists at all.

### 5.2 Platform post

One row per post the pipe has ever seen, on any platform (replaces `ig_posts`):
`platform_post_id`, `channel_id`, `platform`, `published_at`, `permalink`,
`post_ref` (the join key — see §8), `media_kind`, `format_hint`, `caption`,
`first_seen_at`, `last_seen_at`, `deleted_on_platform`.

`format_hint` is the platform's own word for the container (reel, carousel,
image). It is a hint, never the truth: **the piece's birth snapshot is the truth
about format** (S15). Where a fetched post has no piece, the hint is all there
is, and anything computed from it is labeled unplanned.

### 5.3 Metric observation — extended from spec 21 §7.5

Spec 21's `MetricObservation` shape stands. This spec adds four fields and one
rule.

Added fields:

- `kind_of_row` — `lifetime` (what the pipe actually fetched) or `window` (a
  materialized 24h / 7d / 30d reading, §7). Both are observations; only one is a
  fetch.
- `local_date` — the calendar date in the CHANNEL's timezone. `fetched_at` is
  UTC and always exact; `local_date` is what a human means by "that day" and is
  meaningless without the account timezone, which is why S7 makes the timezone a
  required carried field.
- `fetch_time_precision` — `exact` | `day`. Migrated history has only a snapshot
  date, so it is `day`, and nothing computed from it may claim hourly age.
- `source_run_id` — the sync run that produced it (§5.5). This is what turns "no
  data" into a reason.

The rule: **the store is append-only, for real.** Today `ig_daily_snapshots` is
an UPSERT keyed on `(post_id, snapshot_date)`, so a second run the same day
overwrites the first. Under S7 that is not a snapshot store, it is a whiteboard.
`post_observations` gets a surrogate id and is INSERT-only. Several observations
per post per day are correct and cost nothing; a correction is a new row, and
the old row stays.

### 5.4 Metric definition — and why the version matters

A metric is not its name. Instagram has already renamed and redefined its
reach/impressions family once; a chart that graphs across that boundary is
drawing a fiction.

The catalogue lives in **code** (`lib/platforms/<platform>/metrics.ts`), because
it describes the platform, not the client — the universal-engine layer of PLAN
§5.1. Each entry: `metric_id`, `platform`, `api_field`, `kind`, `unit`,
`available_for` (formats), `introduced_at`, `superseded_by`,
`definition_version`.

`kind` is the field that prevents the most common silent lie:

| `kind` | Meaning | The rule it forces |
|---|---|---|
| `cumulative` | a lifetime running total (post views, reach, saves, shares, likes, comments, total interactions) | never sum across days; a per-day figure is a DIFFERENCE of two observations, and only where both exist |
| `interval` | a count for one day (profile visits, website taps) | never treat as a level; summing is correct, differencing is not |
| `level` | a stock as of that moment (followers, media count) | never sum; growth is a difference |

Every observation stamps the catalogue's `definition_version`. **Two observations
with different versions for the same metric id are not comparable**, and the
store marks them so; what a surface does about it is spec 27's problem, but the
flag is this spec's duty.

Per-profile availability and overrides live at
`context/content-strategy/platforms/*/metrics` — the same override rule as format
rules (PLAN §5.1: override beats universal, always). Code catalogue = the shelf;
the profile's parameter = what this account actually reports.

### 5.5 Sync run — the record that makes a gap explainable

One row per channel per run: `run_id`, `channel_id`, `started_at`, `ended_at`,
`trigger` (`cron` | `owner` | `retry` | `backfill`), `connection_status`,
`posts_seen`, `posts_observed`, `completed` (bool), `attempt`, `error_summary`,
`resume_cursor`.

Without this, a missing day and a failed day look identical. With it, every
absence carries a reason.

### 5.6 Coverage gap — derived, never stored by hand

Spec 21 shipped `CoverageGap` and `detectCoverageGaps` in `lib/tree/metrics.ts`.
This spec keeps them and does two things:

- **Reason comes from the runs, not a guess.** The reason for a gap is read off
  `sync_runs` and `channel_connections` for that stretch. The type gains two
  members: `switched-off` (the platform or tracking switch was at `history` —
  a decision, not a fault) and `not-yet-tracked` (before `track_since`). A stall
  and a deliberate stop must never render the same; one is a hole, the other is a
  boundary.
- **Partial runs count as partial coverage.** A run with `completed: false`
  covers only the posts it observed. The gap detector reports gaps per channel
  AND names the posts a partial run missed, rather than declaring the day whole.

Gaps are computed from observations plus runs. They are never a table someone can
edit — a hand-editable gap list is a place for a gap to quietly disappear.

### 5.7 Window observation

See §7. Shape: an observation with `kind_of_row: 'window'`, `window` one of
`first-24h` / `7d` / `30d`, `age_hours` = the ACTUAL age of the underlying
reading (not the nominal boundary), plus `window_state`:
`materialized` | `too-early` | `unavailable`, and `unavailable_reason` pointing
at the gap that caused it.

### 5.8 Post link

`piece_id`, `id_kind` (`piece` | `legacy-card`), `profile_id`, `channel_id`,
`platform_post_id`, `post_ref`, `matched_at`, `match_method`, `confirmed_by`.
See §8.

### 5.9 Measurement declaration (S16)

See §9.

### 5.10 Attributed outcome (S23)

Spec 21 shipped `AttributedOutcome` (`outcome`, `count`, `event_source`,
`attribution_method`, `status`). This spec gives it an address
(`work-log/analysis/attributed-outcomes`), a period (`period_start`,
`period_end`), and an optional `channel_id` — and the wall in §10.

---

## 6. The collector

### 6.1 The connector contract — generalize, do not reinvent

One interface, one file per platform under `lib/platforms/<platform>/`:

```
id, display_name
refreshToken(token)            → token, refreshed_at            | error
listPosts(token, since)        → platform posts (id, published_at, permalink,
                                  post_ref, media_kind, format_hint, caption)
postMetrics(token, post)       → { metric_id: number }
accountMetrics(token)          → { metric_id: number }
extractPostRef(url)            → string | null
metrics                        → the catalogue (§5.4)
```

**Instagram is the first implementation and it is the existing code MOVED, not
rewritten.** `app/api/ig-sync/route.ts` already contains every part of this:
weekly token refresh against the 60-day expiry, the account snapshot with its
best-effort `profile_views` / `website_clicks` call, media paging until the
tracking window is passed, batched insights with the three-set fallback
(`views,reach,likes,comments,saved,shares,total_interactions` →
`reach,saved,shares` → `reach`), and per-account error isolation. All of it
becomes `lib/platforms/instagram/`. `lib/igShortcode.ts` becomes that connector's
`extractPostRef` **unchanged** — one function, both sides of the join, exactly as
its own header comment already says.

`app/api/ig-sync/route.ts` becomes `app/api/metrics-sync/route.ts`: the same
route, the same auth (cron secret OR an owner session — the "Update now" button
keeps working), looping over connectors instead of over Instagram accounts.
`/api/ig-sync` stays as a thin redirect for one release so the live cron entry
cannot break mid-cutover.

**A connector may not add a metric that is not in its catalogue.** An unknown API
field is dropped and named in `error_summary`, never written under a guessed id.

### 6.2 One run, step by step

Per channel, in order, with every step's failure isolated so one bad token never
blocks another account (today's behavior, kept):

1. Open a `sync_runs` row. `trigger`, `attempt`, `started_at`.
2. Check the switches: `platforms.<platform>` and `analysis.tracking.<platform>`
   must both resolve `active` (cascade minimum, spec 21 §5.2). Not active → close
   the run as `switched-off` and stop. No writes.
3. Check lifecycle (S22): `closing` or `archived` → connectors revoked, close the
   run as `not-connected`, stop.
4. Check `metrics_permission`. `not-granted` → stop, reason recorded.
5. Refresh the token if it is over 7 days old; on failure record it and continue
   with the old token (it may still work — today's behavior).
6. Account metrics → one `account_observations` row with `local_date` computed in
   the channel's timezone.
7. List posts published since `track_since`; upsert into `platform_posts`;
   set `last_seen_at`.
8. Post metrics in batches of 5 (today's batching, kept for the 60s limit) →
   `post_observations` rows, INSERT-only, each stamped with `age_hours` from
   `published_at`, the definition version, the channel timezone, the connection
   status, and `source_run_id`.
9. Materialize any window readings that just became eligible (§7).
10. Run the link join (§8).
11. Mark deletions (§6.5).
12. Close the run: `posts_seen`, `posts_observed`, `completed`, `ended_at`; on a
    fully successful run set `channel_connections.last_successful_sync` and reset
    `consecutive_failures`.

### 6.3 Schedule and the day boundary

- The cron runs **twice daily**, at 09:00 and 21:00 IST. Today it is once. The
  reason is S6: a once-daily pipe measures a "first 24 hours" anywhere between 1
  and 25 hours after publication, which makes the most important window the least
  trustworthy one. Two runs halve that error. Because the store is append-only
  and every row carries its own age, a second run adds information and
  double-counts nothing.
- **Every observation is stamped in the channel's own timezone.** A channel with
  `timezone: null` still collects — data now beats data never — but its rows
  carry `account_timezone: null`, its `local_date` falls back to UTC and is
  labeled as such, and a sort-queue item goes to her: *"@handle — which timezone
  does this account live in?"* (The ResumeGuru migration already put exactly this
  question in her queue; spec 21's pilot report names it.)

### 6.4 Failure, retry, backfill — and the one thing backfill can never do

- **Retry:** a failed channel is retried on the next tick with
  `attempt = n + 1`, `trigger: retry`, up to 3 attempts before it is left for the
  next day and `connection_status` flips to `error`. Observations from a retry
  carry `retry_state: 'retrying'`.
- **Backfill** means exactly one thing: *fetch the current lifetime totals for
  posts we missed while the pipe was down, and record them at today's age.* Rows
  are stamped `retry_state: 'backfilled'`.
- **Backfill can never reconstruct the missing days, and the store must never
  pretend otherwise.** The curve between 2026-07-12 and the first successful run
  does not exist and will not exist. A backfilled row closes no gap; the gap
  stays exactly as wide as it was. No interpolation, no carry-forward, no
  "last known value" filling a chart. This is the single most important sentence
  in this spec.
- A post first discovered during a gap gets its `first_seen_at` then; its
  `first-24h` and possibly `7d` windows are `unavailable` with the gap named. Not
  zero. Not omitted. Unavailable, with a reason.

### 6.5 Deletion markers

A post previously seen and absent from **two consecutive completed** runs on its
channel is marked `deleted_on_platform: true` with `last_seen_at` kept. Two, not
one, so a paging hiccup never buries a live post.

Its observations stay forever — the history is real and was collected honestly.
Downstream, a deleted post is excluded from comparisons by default (its metrics
stopped accruing at an unknown moment) and the exclusion is stated, never silent.
A piece whose post is deleted keeps its live link and its birth record; the piece
is not touched, per the one-truth rule.

### 6.6 Partial runs

The route's 60-second ceiling is real and gets worse with every account. A run
that runs out of time writes `completed: false` and a `resume_cursor`; the next
tick resumes from it with `trigger: retry`. A truncated run that reported success
would manufacture a gap that looks like a stall — which is precisely the failure
mode this whole spec exists to prevent.

### 6.7 Off-states — when collection stops, and how the stop reads (S9)

| Situation | Does collection run? | How the stretch reads |
|---|---|---|
| `platforms.<platform>` → `hidden` or `history` | no | `switched-off` — a decision |
| `analysis.tracking.<platform>` → `history` | no | `switched-off` |
| Profile lifecycle `paused` | **yes** | normal coverage. `analysis.tracking` is an owner-audience switch and PLAN's `paused` policy revokes no connectors; her data keeps accruing while the client's doors are shut |
| Lifecycle `closing` / `archived` | no | `not-connected`; connectors revoked per S22 |
| Token expired / revoked at the platform | no | `platform-error`, with the run's error text |
| Before `track_since` | no | `not-yet-tracked` — a boundary, not a hole |

S9's two rules hold throughout: `hidden` never deletes, and a path at `history`
accepts no writes — including from the pipe. Every past observation stays
readable in all five situations.

---

## 7. Age windows and thresholds (S6)

**What the pipe fetches is always a `lifetime` reading.** Windows are derived
from lifetime readings and materialized once, then never recomputed — a window is
a fact about a moment, and recomputing it later would silently change history.

A window materializes when a qualifying lifetime observation exists inside its
tolerance:

| Window | Nominal age | Qualifying reading | If none qualifies |
|---|---|---|---|
| `first-24h` | 24h | a lifetime reading aged 12h–36h | `unavailable` |
| `7d` | 168h | aged 6d–8d | `unavailable` |
| `30d` | 720h | aged 28d–33d | `unavailable` |

- The materialized row stores the **actual** `age_hours`, not the nominal one.
  Two pieces measured at 19h and 31h are both "first-24h" and a comparison
  between them may say so.
- Below the nominal age with no qualifying reading yet: `too-early`. Past it with
  no qualifying reading: `unavailable`, with `unavailable_reason` naming the
  coverage gap. **Never interpolated, never carried forward, never zero.**
- `lifetime` readings continue forever after 30d. The three windows are for
  comparison; lifetime is for "how did this piece do in the end."

**Thresholds.** Spec 21 already shipped `DEFAULT_THRESHOLDS` in
`lib/tree/metrics.ts` (`minPieces: 1`, `minExposure: 300`, exposure metric
`views`). This spec adopts them as the v1 values, makes the exposure metric come
from the platform's catalogue rather than the string `'views'`, and makes all
three **per-profile overridable** — recorded the same way switch defaults are
(`suggested`, hers to finalize). Below the thresholds the store's answer is the
one S6 mandates: **not enough comparable data**. Never a ranking.

`resolveComparison` in `lib/tree/metrics.ts` already implements this and already
phrases its verdict as directional evidence. It stays exactly as it is; spec 27
calls it. This spec only guarantees the rows it reads are honest.

---

## 8. The link join, re-addressed

Spec 03's mechanism is right and stays: *she pastes the live link, and that paste
IS the trigger.* Nothing new to type, ever. Three things change.

1. **The key generalizes.** `extractPostRef(url)` comes from the connector, so
   Instagram keeps its shortcode regex (`lib/igShortcode.ts`, untouched) and a
   future platform brings its own. No per-platform regex is ever written outside
   a connector.
2. **The target is the PIECE, not the card** (S2, spec 21 §7.2). `post_links` is
   keyed on `piece_id` with `id_kind: 'piece'`. Profiles not yet migrated keep
   `id_kind: 'legacy-card'` against the old `card_id`, and the profile's
   migration report is what converts them. Both kinds coexist during the
   changeover, and neither is guessed into the other.
3. **Match methods are explicit.** `url-ref` (she pasted a link that resolves) and
   `owner-confirmed` (she confirmed a suggestion) are matched.
   `time-window-suggested` — a posted piece and an unlinked platform post on the
   same channel within a few hours — is a **suggestion only**. It never attaches
   on its own. Guessing which post a piece is would poison every downstream
   number with no visible trace.

**Conflicts and orphans, both kept visible:**

- Two pieces claiming one platform post: neither attaches, the conflict is
  recorded, and a sort-queue item goes to her.
- A piece whose pasted link resolves to nothing yet: unmatched, retried on every
  run (spec 03's "link pasted before the pipe fetched the post" case, kept).
- A fetched post with no piece: an **unplanned post**. Kept forever, counted in
  account-level totals, and never judged by pillar — it has no birth record, and
  under the reading-layer rule (PLAN §5.2) the piece's own pillar and costume are
  the primary tag source. AI tags are a fallback for exactly this population, and
  spec 27 decides what to do with them.

The join runs at the end of every sync run (as today) and on piece save (spec
03's card-save hook, re-pointed at the piece).

---

## 9. The measuring sticks (S16) — the gate before analysis turns on

*"Before analysis enables for a job or goal, it must declare metric ids,
direction, calculation, denominator, observation window, target, platform
availability, and not-measurable fallback."*

The declaration lives **with its subject**, as a parameter inside the goal's or
pillar's own entry folder — because the measuring stick IS the strategy (PLAN
§5.2: "the measuring stick is always THIS profile's content-strategy"). A
separate measurements folder would be a second home for a strategy decision, and
law 2 says every variable is a folder, not that every idea gets a new one.

One declaration record:

| Field | Rule |
|---|---|
| `subject` | `goal:<id>` or `pillar-job:<pillar id>` |
| `metric_ids` | one or more ids from the platform catalogue; an id no connected platform reports is rejected at lock time |
| `direction` | `up-is-better` \| `down-is-better`. No metric may be declared without one |
| `calculation` | `count` \| `rate` \| `difference` — and it must be legal for the metric's `kind` (§5.4). A rate over a `level` metric is refused |
| `denominator` | required when `calculation: rate`; must itself be a catalogue metric (e.g. saves per view) |
| `window` | one of `first-24h` \| `7d` \| `30d` \| `lifetime` |
| `target` | a value plus a period, **or** the explicit token `direction-only`. Blank is not allowed; "no target" must be a decision, not an omission |
| `platform_availability` | per switched-on platform: `available` \| `unavailable`. Computed from the catalogue, stored so a later platform change is visibly a change |
| `not_measurable_fallback` | `not-measurable-on-this-platform` \| `proxy:<metric id>` (always labeled a proxy where it appears) \| `manual-checkin` (her Journey check-in numbers) \| `none` — and `none` means analysis stays OFF for that subject |

**Enforcement, and where:** at strategy lock, inside spec 21's
`validateSwitchConfig`. The check already exists for goals
(`goalsWithMetricDeclaration`); this spec (a) makes the declaration a real
validated object rather than a boolean, and (b) extends the same check to pillar
jobs, since PLAN §5.2's scorecard judges each pillar only on its job's metrics.

Consequences, stated plainly:

- `analysis.goal_tracking` cannot go `active` while any goal lacks a valid
  declaration. Per-goal blocking, not all-or-nothing — spec 21 §8.9 already says
  "blocked per goal."
- `analysis.scorecard` cannot go `active` while any switched-on pillar's job
  lacks one.
- **The store keeps collecting regardless.** A missing declaration blocks
  ANALYSIS, never COLLECTION. Recording is the first duty and does not wait for a
  decision.
- ResumeGuru's four goals already sit in her sort queue needing exactly this
  (spec 21 pilot report). This spec is what those queue items are waiting for.

---

## 10. The wall between funnel metrics and business outcomes (S23)

Two stores, two addresses, and no bridge that anyone can build by accident.

| | Observed platform funnel | Attributed business outcome |
|---|---|---|
| Address | `work-log/analysis/study-own-data/observations` | `work-log/analysis/attributed-outcomes` |
| Examples | views, reach, saves, shares, comments, profile visits, website taps | signups, calls booked, orders, paid clients |
| Source | the pipe, from the platform's own API | a declared event source, or her hand |
| Requires | a connected channel | `event_source` **and** `attribution_method`, both declared |
| Without that | n/a | `status: 'unknown'` — it displays as unknown, and is never called a conversion |

The enforceable rule: **no code path may divide an attributed outcome by an
observed metric unless both `event_source` and `attribution_method` are
declared.** Where they are not, the computed field is withheld and the label says
unknown. This is a store-level refusal, not a UI convention, because the honest
version of the sentence "8 signups from 4,000 views" is usually "8 signups
happened while 4,000 views happened," and only a declared attribution method
makes it more than that.

This also draws the other line PLAN §5.2 drew: **DMs, inquiries, her
observations and the client's remarks are soft signals** — they live in
`client-perception/` and `logs/observations/`, are read by her directly, and no
query in this store reaches them. The engine concludes from numbers. She reads the
rest herself.

---

## 11. Switches registered (PLAN §6 rule 3)

Reused, unchanged: `analysis.tracking`, `analysis.ai_tagging_fallback`,
`analysis.goal_tracking`, `strategy.fixed`, `creation.channels`, `platforms.*`.

New:

| Switch | Owns | Requires | Dependents | Audience | Allowed states | Suggested default |
|---|---|---|---|---|---|---|
| `analysis.tracking.<platform>` (one per platform entry, generated like `platforms.<platform>`) | the collector for that platform | `platforms.<platform>`, `analysis.tracking`, `creation.channels` | — | owner | active · history | `active` where a channel on that platform is connected; otherwise `hidden` |
| `analysis.sync_health` | `work-log/analysis/study-own-data/sync-health` | `analysis.tracking` | — | owner | active · history · hidden | `active` |
| `analysis.backfill` | the owner-triggered retry/backfill action | `analysis.tracking` | — | owner | active · hidden | `active` |
| `analysis.attributed_outcomes` | `work-log/analysis/attributed-outcomes` | — | — | owner | active · history · hidden | `hidden` — nothing is declared yet, and an empty outcomes surface invites guessing |

**Cascade refinement.** Today `platforms.<platform>` lists `analysis.tracking`
among its dependents, which is coarse: turning LinkedIn off would drag the whole
tracking switch. With `analysis.tracking.<platform>` in place, the platform switch
depends on ITS platform's tracking switch only. Her canonical trace then runs
correctly at this level too: LinkedIn → `hidden` stops LinkedIn collection,
removes the LinkedIn column, and leaves every past LinkedIn observation readable
at `history`. Flip it with Instagram and it behaves identically.

**Nothing here is client-facing.** All four are `audience: owner`, so none of them
can open a fifth door (S19). The client's eventual view of analysis arrives
through `analysis.digest_client` and `see:analysis`, both of which already exist
and both of which are spec 27's to feed.

---

## 12. Audiences and doors

- Every path this spec writes is `audience: owner`. No `client_door` is declared,
  because none is needed: this spec collects and stores; it shows nothing.
- The two strategy parameters (`goals/*/measurement`, `pillars/*/measurement`)
  are `audience: owner` inside `audience: both` parents — the narrowing rule in
  §4.1. The client's strategy summary is curated by her (PLAN §4); raw metric
  declarations are workshop material (CLAUDE.md rule 1).
- Server-side enforcement only. `filterStateForRole` and `mergeRoleWrite` (as
  rewritten by spec 21 §6) strip these paths for every non-owner role, and spec
  12's 19-check security test re-runs against the resolver as part of acceptance.
  CLAUDE.md rule 2 stands: filtering never weakens to solve a UI problem.
- Tokens are visible to nobody. `channel_connections` is service-role only, and
  the existing `/api/ig-accounts` rule — *this route NEVER returns a token* —
  carries over verbatim to its generalized replacement.

---

## 13. Tables, files, and what happens to the old ones

**New SQL** — `supabase/spec-26-tracking-store.sql`, one file, run once, RLS
enabled with no policies on every table (the existing pattern, unchanged):

| New table | Replaces | Note |
|---|---|---|
| `channel_connections` | `ig_accounts` | + `profile_id`, `platform`, `connection_status`, `last_successful_sync`, `consecutive_failures`, `revoked_at` |
| `platform_posts` | `ig_posts` | + `platform`, `post_ref`, `format_hint`, `last_seen_at`, `deleted_on_platform` |
| `post_observations` | `ig_daily_snapshots` | **insert-only**, surrogate id, `age_hours`, `window`, `kind_of_row`, all S7 fields |
| `account_observations` | `ig_account_snapshots` | same treatment; keeps `profile_views` / `website_clicks` from spec 05 |
| `sync_runs` | — | new (§5.5) |
| `post_links` | `ig_post_links` | re-keyed to `piece_id` + `id_kind` |
| `post_readings` | `ig_post_tags` | rename and re-address only; the tagging job's behavior does not change |

**Code:**

- `lib/platforms/index.ts` — the connector registry.
- `lib/platforms/instagram/` — the existing `ig-sync` logic moved: token refresh,
  account insights, media paging, the three-set insights fallback, batching.
- `lib/platforms/instagram/metrics.ts` — the catalogue: post metrics
  (`views`, `reach`, `likes`, `comments`, `saved`, `shares`,
  `total_interactions` — all `cumulative`), account metrics (`followers`,
  `media_count` — `level`; `profile_views`, `website_clicks` — `interval`).
- `lib/igShortcode.ts` — unchanged, wired in as Instagram's `extractPostRef`.
- `lib/tree/metrics.ts` — extended: window materialization, the two new gap
  reasons, catalogue-driven exposure metric, per-profile thresholds.
- `lib/tree/objects.ts` — the added fields on `MetricObservation` and `Channel`,
  plus `MeasurementDeclaration`, `SyncRun`, `MetricDefinition`.
- `lib/tree/declarations.ts`, `switches.ts`, `features.ts` — the four new paths,
  the four new switches, and the feature rows for the collector.
- `app/api/metrics-sync/route.ts` — the generalized route.
  `app/api/ig-sync/route.ts` → a redirect for one release.
- `vercel.json` — the second daily cron entry.
- `app/api/ig-metrics/route.ts` — repointed at `post_observations` /
  `account_observations`. Its existing comment about lifetime counters not being
  summable becomes an enforced rule via metric `kind`.

**Old tables are not dropped.** `ig_*` stays in place, read-only, as the undo for
a one-way migration (spec 21 §9.1 and §9.7 — nothing is deleted). The old SQL
files stay in `supabase/` as history.

---

## 14. Migration of the existing `ig_*` history

Ordered, boring, and reversible up to the cutover.

0. **Fix the stall first.** The collection stall from 2026-07-12 is fixed and
   collection restored **before** any of this — every day of delay is a day gone
   forever (PLAN §5.2; spec 21 §13). It needs her "Update now" tap and the error
   it reports. This does not wait for the restructure and does not wait for this
   spec's build.
1. **Back up.** Export every `ig_*` table before the first write.
2. **Create the new tables.** Empty, validated, nothing reading them.
3. **Copy, with counts.** One idempotent copy pass per table, verified by row
   count parity before and after:
   - `ig_accounts` → `channel_connections`. One row today (@resumeguru.ai).
     `profile_id` from `ig_accounts.client_id`; `platform: 'instagram'`;
     `connection_status: 'unknown'` (there is no run history to prove otherwise);
     `last_successful_sync: 2026-07-12`.
   - `ig_posts` → `platform_posts`. `post_ref` computed by running
     `extractIgShortcode` over each permalink — the same function that made the
     link in the first place, so the values agree by construction.
   - `ig_daily_snapshots` → `post_observations`. One row each,
     `kind_of_row: 'lifetime'`, `fetched_at` = `snapshot_date` at 09:00 IST with
     **`fetch_time_precision: 'day'`**, `age_hours` computed from
     `platform_posts.published_at` and flagged approximate,
     `metric_definition_version: 0` (pre-registry — migrated rows never claim to
     have been measured under today's definitions), `account_timezone:
     'Asia/Kolkata'` (the account is hers and the pipe has always run on IST),
     `source_run_id: null`.
   - `ig_account_snapshots` → `account_observations`, same treatment;
     `profile_views` / `website_clicks` carry over as `interval` metrics and stay
     null before spec 05's ship date, which is the honest "collecting since."
   - `ig_post_links` → `post_links` with `id_kind: 'legacy-card'`. ResumeGuru is
     already migrated (spec 21 pilot), so its rows convert to `id_kind: 'piece'`
     using that profile's migration report; every other profile converts when it
     migrates.
   - `ig_post_tags` → `post_readings`, one-to-one, `corrected` semantics
     unchanged (sticky owner corrections are never overwritten).
4. **Windows are materialized from migrated history where — and only where — a
   qualifying reading exists.** Most 2026-05/06 posts will materialize `7d` and
   `30d`; `first-24h` will often be `unavailable` because the pipe ran once a day.
   That is the true state of the record, and it is what the store must say.
5. **No run records are invented.** `sync_runs` starts empty. Gaps before the
   cutover derive from observation absence with `reason: 'unknown'` — the type
   already carries that member for exactly this reason. Manufacturing plausible
   run history would be the same lie as interpolating a chart.
6. **The 2026-07-12 → first-successful-run stretch is not backfilled.** The first
   successful run records current lifetime totals stamped `backfilled`, and the
   gap stays exactly as wide as it is. Rendering it as a gap is acceptance test 1.
7. **Cutover.** The collector writes both old and new tables for seven days
   (dual-write), then reads move to the new tables, then `ig_*` goes read-only.
   Dual-write is safe because both sides are idempotent per run.
8. **Per profile, pilot first.** ResumeGuru — one of hers; a client profile is
   never the experiment (spec 21 §9.4). Its migration report gains the tracking
   section: channels found, observations copied, windows materialized, windows
   unavailable and why, gaps detected with reasons, links converted, and every
   question the migration refused to guess.

**Questions this migration will put in her sort queue, not answer:**
@resumeguru.ai's timezone, ownership and whether we post or they do (already
queued by spec 21); each channel's `track_since` (the 2026-05-01 pivot was her
call and becomes a stored value); the v1 threshold numbers; and for every goal
and pillar job, its S16 declaration.

---

## 15. Acceptance tests

Run with `npm test` alongside spec 21's 70 checks. Tests 1–10 run on fixtures;
11 and 12 run against real data after her setup day.

1. **The gap test (S7, spec 21 test 8).** With observations present through
   2026-07-11 and absent after, the store reports a coverage gap from 2026-07-12
   with reason `sync-stalled` — and reports no drop in any metric. A surface
   asking "how did we do in July" gets a gap, never a slump.
2. **The switched-off test.** With `platforms.linkedin → history`, the same
   absence reports reason `switched-off`, not `sync-stalled`. A decision and a
   fault never render alike.
3. **The backfill honesty test.** A backfill after a 10-day outage writes
   observations stamped `backfilled` and the 10-day gap is still 10 days wide.
   No interpolated point exists anywhere in the returned series.
4. **The append-only test.** Two runs on the same day produce two observation
   rows; neither overwrites the other; the earlier row is byte-identical before
   and after. A direct UPDATE against `post_observations` is refused.
5. **The window test (S6).** A piece with readings at 19h and 41h materializes
   `first-24h` from the 19h reading with `age_hours: 19`; a piece with readings at
   only 41h and 65h materializes `first-24h` as `unavailable` with the gap named
   — not as zero, not as the 41h value.
6. **The counter-kind test.** Summing a `cumulative` metric across days is
   refused at the store boundary; a per-day figure is produced only as a
   difference of two existing observations, and returns `unavailable` when either
   is missing.
7. **The definition-version test.** Two observations of the same metric id with
   different `metric_definition_version` values are flagged not-comparable when
   requested together.
8. **The deletion test.** A post absent from one completed run is untouched;
   absent from two, it is marked deleted with `last_seen_at` intact and all its
   observations still readable.
9. **The measuring-stick gate (S16).** Strategy refuses to lock with
   `analysis.goal_tracking: active` and a goal missing its declaration; refuses
   with `analysis.scorecard: active` and a switched-on pillar whose job has none;
   a declaration with `calculation: rate` and no denominator is rejected; and with
   the gate blocking, **collection still runs**.
10. **The S23 wall.** An attributed outcome with no `event_source` or no
    `attribution_method` returns `status: 'unknown'`; any attempt to compute a
    rate from an outcome and an observed metric without both declared is refused
    at the store boundary, not at the UI.
11. **The migration parity test.** Row counts match table for table; a sampled
    100 observations carry identical metric values before and after; every
    migrated row carries `metric_definition_version: 0` and
    `fetch_time_precision: 'day'`.
12. **The join test.** She pastes a live link on a piece; within one run the piece
    carries its platform post and its numbers, with **zero** other typing. Two
    pieces claiming one post attach to neither and produce one sort-queue item.
    A fetched post with no piece survives as an unplanned post and is never
    assigned a pillar.

Plus, unchanged from spec 21 and re-run here: the no-address test, the no-switch
test, the no-fifth-door test (with spec 12's 19 security checks), and the
save-race test.

---

## 16. Law-4 additions born in this spec

New paths, each declaring its feeds and readers at birth, all inside existing
spine folders (law 1 intact). For the control room to ratify into PLAN §3.8:

| Path | Why | Fed by | Read by | Switch |
|---|---|---|---|---|
| `work-log/analysis/study-own-data/observations` | the append-only observations themselves; S3 needs them addressed, not implied | `pipe:platform-metrics` | `engine:analysis`, `work-log/analysis` | `analysis.tracking` |
| `work-log/analysis/study-own-data/sync-health` | runs, connection status, retry/backfill, gaps — the record that makes an absence explainable (S7) | `pipe:platform-metrics` | owner, `engine:analysis` | `analysis.sync_health` |
| `work-log/analysis/study-own-data/links` | the piece ↔ post join; spec 03's join finally has an address | `pipe:platform-metrics`, owner | `engine:analysis`, `work-log/creation` | `analysis.tracking` |
| `work-log/analysis/attributed-outcomes` | S23's wall made structural: business outcomes cannot sit in the same folder as observed metrics | owner, declared event sources | owner | `analysis.attributed_outcomes` |

Parameters added inside existing entry folders (law 2, level three — not new
folders): `context/content-strategy/goals/*/measurement`,
`context/content-strategy/pillars/*/measurement`,
`context/content-strategy/platforms/*/metrics`.

---

## 17. Deliberately out of scope

- **Every reading surface** — scorecard, funnel, bifurcation, compare, verdicts,
  digests, the always-live Analysis app. Spec 27.
- **The comparison verdict logic.** `resolveComparison` already exists and is
  untouched here; this spec only guarantees honest rows beneath it.
- **AI anything.** `post_readings` is renamed and re-addressed with no behavior
  change; the model layer and the intelligence bar belong to the engine specs
  that produce words.
- **The second connector.** The contract ships with Instagram implemented. A
  LinkedIn or YouTube connector ships when a profile switches that platform on —
  which is law 3 working as designed, not a deferral.
- **The GUI.** Nothing renders. The owner-only sync-health surface that spec 27
  will want is declared here and drawn there.
- **The deploy.** DEPLOY.md and CLAUDE.md rule 6 stand: her explicit go, every
  time, and the drift check against the deploy repo before anything moves.

---

## 18. Open questions

**None.** Four candidates came up and the plan answered all four; they are
recorded here so the control room can check the reasoning rather than take it on
trust.

- *Does collection continue when a profile is paused?* — Yes. PLAN §10 S22's
  `paused` policy revokes no connectors, and `analysis.tracking` is an
  owner-audience switch, so it does not drop with the client's doors. §6.7.
- *What happens to a switched-off platform's history?* — S9: `hidden` never
  deletes, `history` accepts no writes. Collection stops, the stretch reads
  `switched-off`, every past observation stays readable. §6.7.
- *Where do the S16 declarations live?* — With their subject, inside the goal's
  and pillar's own entry folders. PLAN §5.2 makes the strategy the measuring
  stick; a separate folder would be a second home for a strategy decision. §9.
- *May a client-owned account be tracked?* — Yes, on the terms spec 03 already
  locked ("all accounts she controls"), with the channel carrying
  `metrics_permission` and lifecycle `closing` revoking the connector per S22.
  §5.1, §6.7.

Three values are **suggestions she finalizes**, handled the way switch defaults
are handled — recorded as suggested, never silently applied: the comparison
thresholds (`minPieces`, `minExposure`), each channel's `track_since`, and each
channel's timezone. They go to her sort queue at migration; they block nothing,
because collection never waits on a decision.
