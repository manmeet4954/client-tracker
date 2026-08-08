# Desk chat — the READ tools (spec 30 §3.1)

Branch: `claude/spec-21-data-layer-6d04af` (worktree), merged from `claude/restructure-phase-2`.

Files I own and wrote:

- `dashboard/lib/desk/read.ts` — every read tool
- `dashboard/lib/desk/status.ts` — the arithmetic behind `profile_status`
- `dashboard/tests/desk.read.test.ts` — 49 tests

Nothing else was touched. `types/index.ts`, `lib/access.ts`, `lib/tree/*`,
`lib/shell/desk.ts`, `lib/shell/shelf.ts`, `tests/run.ts`, `contexts/` and
`app/` are all untouched.

**Status:** `./node_modules/.bin/tsc --noEmit` clean. My 49 tests pass. The
existing suite still passes at 593/593 (my file is not wired into `tests/run.ts`
— that file is the integrator's).

---

## The tools, with their exact signatures

All of them live in `lib/desk/read.ts`. All are pure: state in, values out. No
fetch, no clock, no randomness. Every one that needs a date takes it as an
argument.

```ts
findProfile(state: AppState, name: string): FindProfileResult

profileStatus(state: AppState, profileId: string, today: string): ProfileStatusResult

findPieces(state: AppState, profileId: string, filter?: PieceFilter): FindPiecesResult | Refusal

findTasks(state: AppState, profileId: string | null, when: TaskWhen): FindTasksResult | Refusal

findSeeds(state: AppState, profileId: string, status?: SeedStatus): FindSeedsResult | Refusal

acrossProfiles(state: AppState, today: string): AcrossProfilesResult | Refusal
```

`today` is `'YYYY-MM-DD'` everywhere, except `profileStatus`, which also accepts
`'YYYY-MM'` when the question is about a month rather than a day.

`TaskWhen` is where `today` is injected for the task tool, so the arity stays the
three the spec names:

```ts
interface TaskWhen {
  today: string;
  scope?: 'due' | 'week' | 'open' | 'all';   // default 'due'
}
```

### What each returns

**`findProfile`** — one of three, and never a guess:

```ts
| { ok: true;  match: 'exact' | 'prefix' | 'contains' | 'only-one'; profile: ProfileRef }
| { ok: false; reason: 'ambiguous'; typed: string; candidates: ProfileRef[] }
| { ok: false; reason: 'no-match';  typed: string; known: ProfileRef[] }
```

Four tiers are tried in order — profile id, exact name, name-starts-with,
name-contains — and the **first tier with any hit decides**. One hit is the
answer. Two or more at that tier is `ambiguous`, with both candidates returned
for her to pick. It never falls through to a looser tier to break a tie, and it
never picks the first. `ProfileRef` is `{ id, name, lifecycle, owner_kind, href }`.

**`profileStatus`** — `{ ok: true } & ProfileStatusShape`, or a `Refusal`:

```ts
profile: ProfileRef
today: string
month: string                 // the window every month-scoped number is over
has_body: boolean             // false = never migrated; nothing below is countable
strategy_locked: boolean
frozen_at: string | null      // a paused profile's counts stop here
counts: {
  posted_this_month, posted_all_time, posted_undated,
  scheduled, review, approved, build, ideas, on_board   // all numbers
}
cadence: {
  target: number | null       // null = never set. NOT zero.
  not_set: boolean
  source: 'strategy' | 'legacy' | 'none'
  posted: number
  remaining: number | null    // final. the model never subtracts.
  over_by: number | null
}
pillars: {
  declared: number
  counted: number             // posted in the window that carry a pillar
  unassigned: number
  no_basis: boolean           // true when nothing was posted to share out
  shares: {
    pillar_id, name,
    job: string | null,       // reach / trust / convert; null = she has not said
    target_pct: number | null,
    posted: number,
    actual_pct: number | null, // null when there is no basis, never a fake 0
    gap_pct: number | null     // actual - target, computed
  }[]
}
last_posted: { piece_id, title, date, days_ago } | null   // null = never posted
```

**`findPieces`** — `{ ok, profile_id, filter, count, total_on_board, pieces[], truncated }`.
Filter fields: `stage` (one or an array), `pillar_id`, `platform`, `format`,
`month` (`YYYY-MM`), `from` / `to` (`YYYY-MM-DD`, inclusive), `undated`, `limit`
(default 50). `count` is the **whole** match count even when `limit` cuts the
rows; `truncated` says the list was cut. Platform and format match
case-insensitively. Rows carry `pillar_name` resolved from the pillar folder.

**`findTasks`** — overdue kept apart from due today, as separate arrays with
separate counts, plus `later`, `undated`, `done`, a `counts` block, `profiles`,
and `skipped`. `days_late` is computed on overdue rows only (null otherwise).
Across all profiles it does **not** refuse the whole question when one profile is
shut: that profile is skipped and named in `skipped` with a reason. Asked about
one profile that is shut, it refuses.

**`findSeeds`** — `{ ok, profile_id, status, count, by_status, total,
without_raw_thought, seeds[] }`. `by_status` and `total` are over the whole bank
whatever the filter asked for; `count` is the filtered rows. `has_raw_thought`
per row is the S24 distinction: a migrated subject is not yet a seed.

**`acrossProfiles`** — `{ ok, today, answers: { today, review, locks, quiet,
week } }`, each `{ key, count, flagged, flag, profiles, rows }`. It **calls**
`answerToday`, `answerReview`, `answerLocks`, `answerQuiet` and `answerWeek` in
`lib/shell/desk.ts`. Nothing is reimplemented.

### Refusals

A refusal is a reason code, not a sentence:

```ts
{ ok: false, reason: 'no-such-profile' | 'no-body' | 'switched-off' | 'bad-filter',
  profile_id, switch_id?, path?, field? }
```

`switched-off` always names the switch and the path it wanted. This is law one at
the read edge: a closed folder is refused, not read around, and never reported as
a board of zeros.

---

## What I tested (49 tests, `tests/desk.read.test.ts`)

The fixture builds on `tests/fixtures.ts`: ResumeGuru migrated and locked with a
month that has real shape (three posted in July, one in June, one posted with no
date at all, a fourth pillar with no job and no mix target), Divine migrated and
unlocked, Career Bubble migrated and empty with `postTarget: 0`, and a Fresh Co
that was never migrated.

**Law two — the arithmetic.** Every board count is re-derived in the test from
the raw `work-log/creation` array and compared. `posted_all_time` is asserted
equal to `stageCounts(...).posted`. `last_posted.date` is asserted equal to
`pieceClock(...).last_posted`. `cadence.remaining` is asserted equal to
`target - posted` and every `gap_pct` to `actual - target`, so the payload the
model words is already final. One test walks every read result and fails on any
string that looks like a composed sentence, outside the named fields that carry
her own words.

**Not set vs zero.** Career Bubble's missing target returns `target: null`,
`not_set: true`, `remaining: null` — and its `posted_this_month: 0` stays a real
zero. A tree cadence entry that really says `0` is honoured as a set zero; the
legacy `postTarget: 0` is read as never set. A pillar with no job reports
`job: null` and `gap_pct: null` while `posted: 0`. With nothing posted at all,
every `actual_pct` is `null` and `no_basis` is true.

**Law one — refusals.** A switched-off `creation.board`, a switched-off
`logs.tasks`, a switched-off `creation.engine`, an unmigrated profile, a profile
that does not exist, a month that is not a month, a date that is not a date.
Each refuses with its reason and names its switch or field.

**Ambiguity.** With "Career Bubble" and "Career Bubble Media" both present,
`"career"` returns both candidates and no profile; `"Career Bubble"` resolves,
because the exact tier decides before the prefix tier.

**No second counter.** `findTasks(state, null, { today })`'s overdue plus
due-today set is asserted identical to `composeTodayStrip(state, today)`, ids and
lateness both. `acrossProfiles`' five counts are asserted equal to
`answer*(state).rows.length`, and its review rows asserted identical objects.

---

## What I did NOT do, and where I made a judgement call

Read these before wiring anything up.

1. **`acrossProfiles` rows still carry `desk.ts`'s wording.** I dropped the
   desk's composed headline (`text`) and its `note`, and a test asserts they do
   not travel. But a `DeskRow`'s own `title` and `when` are composed English from
   `desk.ts` — "3 pieces in review", "waiting on a yes", "Strategy is not
   locked". I was told to call those functions and not rewrite them, so that
   wording comes along. If the harness must hand the model nothing pre-worded at
   all, the rows need reshaping and that is a change to `desk.ts`, which I do not
   own.

2. **The task walk is my own reader of `work-log/logs/tasks`.** `composeTodayStrip`
   cannot answer "what has no date" or "what is due next week", so `read.ts` has
   its own walk, including its own copy of the amendment-aware done rule. It is
   pinned to the strip by a test, but it is literally a second reader of that
   path. If someone changes the done rule in `shelf.ts` and not here, the test
   catches it — that is the whole reason the test exists.

3. **Pillars and cadence are read with no switch check.** They sit under
   `context/content-strategy`, governed by `strategy.fixed`, which is declared
   `fixed: true` with `allowed_states: ['active']` — it can never be off. The
   board switch (`creation.board`) gates `profileStatus` as a whole.

4. **`profileStatus` on an unmigrated profile answers rather than refuses.** It
   returns `ok: true` with `has_body: false` and zeros, because "she has not set
   this one up yet" is a better answer than silence and the flag makes it
   unmistakable. Every other read tool refuses `no-body`. If you want that
   consistent, change `profileStatus`, not the others.

5. **Only cadence falls back to a legacy slice.** Pieces, tasks, seeds and
   pillars are read from the body and nowhere else, which is what the desk itself
   does. So an unmigrated profile shows an empty board rather than its legacy
   `contentCards`. Cadence is the one exception (`data.postTarget`), reported as
   `source: 'legacy'`, because the migration only wrote the cadence entry when
   the old target was above zero.

6. **Paused profiles freeze piece counts but not task counts.** `frozenAt`
   mirrors `composeCard`'s rule for pieces, so my counts and the shelf card agree.
   Tasks are not frozen — `composeTodayStrip` does not freeze them either, so
   this matches, but nobody has decided it on purpose.

7. **Everything resolves as role `owner`.** Spec 30 §5 says the chat is hers and
   appears for no other role. Nothing here weakens `filterStateForRole`: it reads
   the state it was handed, which the server has already filtered.

8. **The "no English sentence" test is a heuristic**, not a proof. It flags any
   string of three or more lowercase words outside a named list of content
   fields. A one-word or two-word composed label would slip past it.

9. **Not built, because they are not in my half:** every write tool,
   `make_preview`, the tool loop and its ceilings, the JSON schemas the model is
   given, and the wiring in `tests/run.ts` and `app/`. No filter by seed id on
   `findPieces` — nothing asked for one.

10. **Nothing was run against her real data.** This machine has no database
    access. Every number above is from the fixture.
