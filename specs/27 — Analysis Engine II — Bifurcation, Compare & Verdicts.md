# 27 — Analysis Engine II — Bifurcation, Compare & Verdicts

**Status:** BUILT 2026-07-27 (branch worktree-agent-a5bf005da02ccdd6a), NOT DEPLOYED. All twelve of §23's fixture tests green as 44 checks alongside specs 21-26's 291 (335/335); tests 13-14 are live-data and named as skips. See dashboard/STATE.md for the build record. Second spec of the Analysis Engine family (PLAN §5 — "each engine gets its own separate family of specifications"). Written in a fresh Opus chat per the working structure (PLAN §6), reading only the vault.

**Authority:** `PLAN.md` outranks this file; where PLAN §10's amendments touch anything below, the amendment wins. `specs/21 — Data-Layer Restructure.md` owns the canonical objects (`MatchedComparison` §7.10, `Piece` §7.2, `MetricObservation` §7.5, `FeedbackItem` §7.12) and this spec references them rather than declaring second versions. `specs/26 — Analysis Engine I — The Tracking Store.md` is the contract underneath: **this spec reads that store and never writes it.** `specs/23 — Content Engine I` owns the proposals path, the engine-runs log, the feedback path, and the model-layer pattern this spec follows for its one wording call.

**Scope in one line:** the reading surfaces of the Analysis app — bifurcation, scorecard, funnel, compare, goal tracking, the verdict cycle, the digest, the client publication, and the routed loop back into both the seed bank and strategy.

**Why this comes after spec 26:** a reading surface built on a store that cannot tell a gap from a slump would be a lying machine (spec 26 §2). The store now can. This spec is what reads it, and every surface below inherits that store's one obligation: always say which of the three it is — *this happened*, *this did not happen*, or *we were not looking*.

---

## 1. What this spec is, and is not

**It is:**

1. **The bifurcation view** — every posted piece sliced by ANY parameter it was born with: pillar, platform, format, hook type, angle, objective, audience stage, CTA, product intensity, channel, month, seed. No tagging chore, because the birth snapshot (S15) already carries all of it.
2. **The scorecard** — each pillar judged ONLY on its job's declared metrics, per that pillar's S16 declaration, with an explicit "too early to judge" state and a show-its-work line under every verdict.
3. **The funnel view** — observed platform funnel metrics only. Attributed business outcomes sit beside it, behind the S23 wall, labeled unknown without a declared attribution method.
4. **The compare surface** — the screen says **Compare**; the machinery builds a matched comparison (S5) resolved at equivalent ages (S6) through `resolveComparison`, which spec 21 already shipped. Deliberate experiments are marked as planned comparisons.
5. **The verdict cycle** — a 30-day verdict and a 2–3-month verdict per profile: which patterns and topics outperform, and whether working more on them is the right call. Numbers computed by code; words written by a model that may say nothing the numbers did not say.
6. **The digest** — monthly per profile right after month-end, the weekly owner pulse across profiles, and the always-live app view.
7. **The loop back** — costume recommendations surfaced inside the engine room, evidence-citing revisit proposals written into the seed bank's proposals path, and proposed strategy diffs (mix targets, pillar jobs) that she accepts or rejects, dated into the strategy's version history.
8. **The client publication** — the curated digest and readable performance behind `see:analysis`, drafted by the engine, approved or edited by her, never automatic.

**It is not:**

- **Any collection.** No sync route, no connector, no observation write, no link join. Spec 26 owns all of it, and this spec reads its tables through one read layer (§4.1).
- **A second register of posted work.** PLAN §3.11 is absolute: the stages are the truth. Bifurcation reads the pieces where they live in `work-log/creation`; it never copies a piece, and "everything posted, filtered" stays the posted stage of Creation's own views (§4.2).
- **A soft-signal engine.** DMs, inquiries, attribution answers, her observations, the client's remarks are recorded elsewhere and do not enter one calculation in this spec (PLAN §5.2, her correction).
- **The impact / brand-recall layer.** Named honestly as not achievable and not attempted (PLAN §5.2).
- **The drafting engine.** Costume recommendations are surfaced here as read-only evidence; the engine room that consumes them is Content Engine II.
- **Market research.** Deliberately open per PLAN §5.2 and law 4; nothing here defines its parameters.

---

## 2. The one job

*Answer, per profile, the one question PLAN §5.2 names: is the strategy doing its job, and what should change — and be able to show the working for every word of the answer.*

Three consequences run through every section below.

1. **The measuring stick is always THIS profile's `content-strategy/`.** Never generic metrics, never another account, never followers-for-their-own-sake (PLAN §5.2, her standing position).
2. **Code computes, the model only words.** Not a style preference: it is enforced by the number guard in §12.4, and a verdict whose words carry a number the code did not compute is rejected before she ever sees it.
3. **Silence is never a result.** Every surface renders coverage before it renders performance. Acceptance test 1 binds this across all eight surfaces at once.

---

## 3. What must be true before this builds

| Precondition | Where it comes from | If missing |
|---|---|---|
| Spec 21 built (path-scoped writes, declarations, switch registry, canonical objects) | spec 21, BUILD CLEARED (PLAN §11) | nothing here has an address |
| Spec 26 built (the store, sync-health, windows, links, the S16 gate, the S23 wall) | spec 26 | every surface reads an Instagram-shaped table and cannot name a gap |
| The 2026-07-12 collection stall fixed | STATE.md; spec 26 §14 step 0 | surfaces build and render, and honestly show a widening hole |
| S16 declarations on every switched-on pillar job and goal | spec 26 §9 | the scorecard and goal tracking stay blocked **per subject**, showing why (§7.5, §10.3) |
| Strategy locked for the profile | spec 22 §8.6 | migrated profiles are exempt and keep their legacy analytics view until they lock (spec 22 §13) |

This spec builds against fixtures without any of the live prerequisites. Its live-data acceptance tests (§23, tests 13–14) wait on her setup day, exactly as spec 26's do.

---

## 4. The reading contract — one computation layer, eight surfaces

Every surface in this spec is a window onto one computation layer, `lib/analysis/`. No screen queries Supabase directly, and no screen implements its own idea of what "typical" means. This is the one-truth rule (PLAN §5.2 rule 4) applied to arithmetic as well as to content.

### 4.1 Read the store, never write it

`lib/analysis/read.ts` is the only module that touches spec 26's tables, and it is read-only by construction: it exports queries, no writers. Spec 26 §4.1's declarations already say `work-log/analysis/study-own-data/*` is fed by `pipe:platform-metrics` alone. A write from `engine:analysis` to any observation path is refused at the write door, and acceptance test 3 proves it.

What this spec writes is its own conclusions, at its own addresses (§17.1). Conclusions are not observations.

### 4.2 Identity comes from the pieces, where they live

A row in any surface is assembled from three sources and nothing else:

| Part | Source | Rule |
|---|---|---|
| Identity — what this piece IS | `work-log/creation` piece, its `birth` snapshot (S15) | never copied; the row holds a `piece_id` and resolves it |
| Numbers — what it DID | spec 26 `post_observations`, joined via `post_links` | never re-typed, never hand-edited |
| Coverage — whether we were looking | spec 26 `sync_runs` + `detectCoverageGaps` | rendered before performance, always |

**No second register.** There is no analysis-side list of posted content. Clicking any row opens the piece on the board. If a piece is missing from a slice, the fix is on the piece, not in analysis. PLAN §3.11: "No feature may introduce a second copy of a content piece to display it somewhere else."

### 4.3 The birth snapshot is the truth about what a piece was

Every slice, every comparison, every pattern reads `piece.birth.costume` — not the piece's current fields. She may correct a piece next month; S15 says corrections append and the analytical birth record is never overwritten. Analysis reads the birth record.

Three rules follow:

- A piece with no `birth` snapshot (legacy, migrated with `seed_id: null`) is included in account-level totals and **excluded from costume-dimension slices**, labeled *"born before the engine"*. Not zero, not silently dropped: a named bucket with a count.
- A fetched post with no piece is an **unplanned post** (spec 26 §8). It counts in account totals, never carries a pillar, and appears in slices only through the AI reading layer's fallback tags, always labeled *unplanned*.
- **Regimes never mix.** A pillar whose job changed on a date splits into two regimes at that date, and a piece is judged under the job that existed at its birth. Spec 04's change-dating rule, kept and made structural.

### 4.4 Three states, everywhere

Every number this layer returns is one of:

| State | Means | Renders as |
|---|---|---|
| `value` | measured, above threshold | the number, with its n and its window |
| `too-early` | measured, below threshold or window not materialized | "too early to judge", with what is still owed (n more pieces, or the window's date) |
| `no-coverage` | we were not looking | the coverage gap, its dates, and its reason from `sync_runs` |
| `not-measurable` | no declared metric on this platform, fallback `none` | "not measured for this profile", with the declaration that says so |

Zero is never used for any of the last three. Spec 26 §6.4's sentence carries forward verbatim in behavior: no interpolation, no carry-forward, no last-known-value.

### 4.5 The computed vocabulary

Fixed definitions, used identically by every surface. All are computed by code and are the ONLY quantities the model may speak about (§12.4).

- **Typical** = the median across the pieces in the slice, at one window, for one metric id. Never the mean. Spec 05's outlier-resistance rule, made concrete: one viral piece does not promote its whole pillar.
- **Baseline** = the median of the same metric, same window, across ALL of this channel's pieces in the trailing 12 weeks, excluding pieces whose window falls inside a coverage gap. The account is compared only against itself; cross-account comparison does not exist in this system.
- **Lift** = (typical − baseline) / baseline, reported with its n. Undefined where baseline is zero or `no-coverage`; reported as `too-early` rather than as infinity.
- **Quantity vs mix target** = count of posted pieces in the period for a pillar, against that pillar's declared mix target.
- **Sufficiency** = `n_pieces >= thresholds.minPieces` AND every piece's exposure ≥ `thresholds.minExposure` on the platform's declared exposure metric. Thresholds come from spec 26 §7 (`DEFAULT_THRESHOLDS`, per-profile overridable, hers to finalize).
- **Verdict band** (scorecard and patterns): `earning` at lift ≥ +15%, `steady` between −15% and +15%, `dragging` at lift ≤ −15%, `too early to judge` below sufficiency. The 15% is a **suggested value she finalizes**, recorded the way switch defaults and thresholds are (§26).

### 4.6 The five refusals

These are refusals in the computation layer, not conventions in the UI. Each has an acceptance test.

1. **Refuse to rank below threshold.** A comparison or a pattern below sufficiency returns `not-enough-comparable-data`. Never a ranking, never "slightly ahead". (`resolveComparison` already does this and is not modified.)
2. **Refuse to compare across unequal ages.** Only rows with the same `window` enter a comparison, and the actual `age_hours` of each is carried into the words.
3. **Refuse to compare across metric definitions.** Two observations of one metric id with different `metric_definition_version` are flagged not-comparable by the store (spec 26 §5.4); this layer surfaces the flag and drops the pair from the pattern rather than averaging across a redefinition.
4. **Refuse to cross the S23 wall.** No code path divides an attributed outcome by an observed metric unless both `event_source` and `attribution_method` are declared. Spec 26 §10 enforces it at the store boundary; §8.3 below is what the screen does about it.
5. **Refuse to read a gap as a result.** Any period whose coverage is incomplete carries its gap into every number computed from it, and the surface renders the gap first.

---

## 5. The Analysis app — what she opens

One app inside a profile (PLAN §3.10), lightly skinned in the brand color, tabs on desktop and a bottom-sheet tab bar on mobile (PLAN §2 item 4).

| Tab | What it is | Switch |
|---|---|---|
| **Now** | the always-live view: this month so far, coverage first, the pillar strip, the last verdict, anything moving | `analysis.always_live` |
| **Slices** | bifurcation — pick a dimension, see the split | `analysis.bifurcation` |
| **Scorecard** | pillar by pillar, judged on its job | `analysis.scorecard` |
| **Funnel** | the platform funnel, and the outcomes panel beside it | `analysis.funnel` |
| **Compare** | pick pieces or a seed's variants; planned comparisons live here too | `analysis.compare` |
| **Goals** | targets vs actual, blocked goals with the reason | `analysis.goal_tracking` |
| **Verdicts** | the 30-day and quarter verdicts, and the monthly digest | `analysis.verdicts`, `analysis.digest_owner` |
| **Health** | sync health: runs, gaps, connection state, what is not being collected and why | `analysis.sync_health` |

A tab whose switch is not `active` is **not rendered** — not grayed out (PLAN §2 item 2). A tab at `history` renders read-only with a line saying since when.

**The Now tab's first block is always coverage.** Not a badge in a corner. If the pipe is stalled, that is the first thing on the screen, in her language: *"Not collecting since 12 July. 15 days missing. These numbers stop there."*

---

## 6. Bifurcation — slice by anything it was born with

PLAN §5.2 point 2: *"Every parameter a piece was born with is a filter… the birth-links make every slice possible without anyone tagging anything."*

### 6.1 The dimensions

Every dimension below comes from the birth snapshot or the piece's own identity. **Nothing here is a new field, and nothing asks her to tag.**

| Dimension | Source | Notes |
|---|---|---|
| pillar | `birth.costume.pillar_id` | resolves to the pillar's name and job |
| platform | `birth.costume.platform` | switched-off platforms appear only at `history` |
| format | `birth.costume.format` | formats come from inside their platform, always |
| hook type · angle · objective · audience stage · CTA · product intensity · length · voice | `birth.costume.*` | the costume dimensions, one resolved value each (S4) |
| seed | `piece.seed_id` | the "one seed's expressions" slice; also the entry point to Compare |
| month | `piece.created_month` and the post's `published_at` | posted month is the one used for performance |
| channel | `piece.channel_id` | account identity from the channel record (S17) |
| pillar job | `birth.pillar_job` | lets her ask "how is trust doing" across pillars whose names differ |
| reading-layer tags | spec 26 `post_readings` | topic type, close type, trending audio, face/no-face — **fallback only**, and always labeled as read, not planned |

Dimensions are generated from the profile's own declarations, so law 3 holds: add a fourth pillar, a new hook type, or a new platform, and the picker carries it the moment it exists, with nothing blank (acceptance test 5).

### 6.2 What a slice shows

For each value of the chosen dimension, at one selected window and one selected metric:

`n pieces · typical · baseline · lift · band · coverage`

plus, always, the three buckets that keep the arithmetic honest and visible:

- **born before the engine** — pieces with no birth snapshot;
- **unplanned** — fetched posts with no piece;
- **not comparable** — pieces whose window is `unavailable`, with the gap named.

A slice may be crossed with a second dimension (format × hook type). Crossing does not change any rule: sufficiency is checked per cell, and a cell below threshold says `too early`, never a smaller number rendered confidently.

### 6.3 What bifurcation is not allowed to do

- It does not rank values below sufficiency (refusal 1).
- It does not sum a `cumulative` metric across days (spec 26 §5.4's `kind` rule, enforced at the store boundary).
- It does not create a list of posted content that lives in analysis. Every row links back to the piece on the board (§4.2).

---

## 7. The scorecard — each pillar on its own job only

PLAN §5.2: *"The scorecard — each pillar judged ONLY on its job's metrics."* PLAN §5.3: *"Analysis judges each pillar only against its job — a promo pillar is never shamed for low reach."*

### 7.1 Where a pillar's metrics come from

From that pillar's S16 measurement declaration at `context/content-strategy/pillars/*/measurement` (spec 26 §9), and from nowhere else. Not from a table in this spec, not from a hard-coded job → metric map.

This is the named supersession of spec 04. Spec 04's map (reach → reach + shares; trust → saves + profile visits; convert → link taps + north star) survives as the **suggested default** the derivation surface offers when she writes a declaration. Once written, the declaration is the rule. The reason is the ResumeGuru taxonomy itself: its lanes carry jobs like *"reach to trust"* and *"soft convert"* — a fixed three-value map cannot judge them, and PLAN §5.1 confirms pillar names and jobs vary per client while the JOB is what the engine reads.

### 7.2 One pillar's card

```
[Pillar name]            job: [its job, in this profile's words]
"[the purpose line, her words]"

Quantity     7 posted this period · mix target 30% · actual 26%
Judged on    saves per view, 7d window        ← from the declaration
Typical      3.1%   Baseline 2.2%   Lift +41%   n=7
Verdict      EARNING
Coverage     complete for this period
Show my working ▸
```

**Show my working** expands to one plain sentence, spec 05's rule kept and extended with coverage:

> *Judged on saves per view because this pillar's job is Trust and that is what its measurement declaration names. Compared against this account's own median over the last 12 weeks. Based on 7 posted pieces at the 7-day window. All 7 had complete collection.*

### 7.3 The states a pillar card can be in

| State | When |
|---|---|
| `earning` / `steady` / `dragging` | sufficiency met, band per §4.5 |
| `too early to judge` | fewer pieces than threshold, or the window has not materialized. Names exactly what is owed: *"2 more posts, or 4 more days"* |
| `not measurable here` | the declaration's `platform_availability` says unavailable on every switched-on platform and its fallback is `proxy:` or `manual-checkin` — the proxy is shown and always labeled a proxy |
| `blocked` | the pillar's job has no valid S16 declaration. The card says so and links to the declaration panel. Collection is unaffected (spec 26 §9) |
| `coverage gap` | the period overlaps a gap. The gap and its reason render **instead of** a verdict, not beside it |

A new pillar starts at `too early to judge` and does not disturb any other pillar's verdict, because every verdict is against the account's own baseline (spec 04's rule, kept).

### 7.4 Planned-comparison pieces stay in the pillar's math

**Named supersession of spec 04.** Spec 04 excluded experiment posts from their pillar's verdict math to keep the pillar clean. PLAN §5.2 retired the separate experiments lane — experiments are "simply the compare feature used deliberately" — and under the one-truth rule a posted piece is a posted piece: excluding it would understate the pillar's quantity against its own mix target and hide real published work.

So: pieces in a planned comparison **count** in quantity and in performance, and the show-my-working line names them: *"2 of these 7 were part of a planned comparison."* Nothing is hidden in either direction.

### 7.5 The client's version

The scorecard is the readable face of analysis (PLAN §4). It reaches a client only through the publication gate in §14 — approved by her, never automatic — and the client's card carries the purpose line and the plain verdict, never the show-my-working internals, never the baseline arithmetic, never another profile.

---

## 8. The funnel — platform metrics only, with the wall beside it

### 8.1 What the funnel is

Month by month, for the profile's switched-on platforms, the observed attention chain:

`pieces posted → views → reach → profile visits → website / link taps`

Every step is an observed platform metric from spec 26's store, with its metric `kind` respected (spec 26 §5.4): `interval` metrics like profile visits sum across days; `cumulative` metrics never do, and a per-day figure is a difference of two observations or it is `unavailable`.

The funnel's shape comes from `context/content-strategy/funnel-shape/` and its last observed step from the profile's `ctas/` — a profile with no website link has no taps row, and the row is absent, not zero.

### 8.2 The brand-building signal, kept

Spec 05's one genuinely useful derived line survives, because it is a ratio of two observed metrics on the same side of the wall: **profile visits growing faster than reach** means content is making people curious about the person. It renders with its n, its window, and its coverage like everything else.

### 8.3 Attributed outcomes sit beside the funnel, never inside it

S23, and spec 26 §10. The outcomes panel reads `work-log/analysis/attributed-outcomes` and renders in a visually separate block under a heading that says what it is:

> **What happened in the business** — recorded by her, not measured by the platform.

| Outcome state | How it renders |
|---|---|
| `declared` (both `event_source` and `attribution_method` present) | the count, the source, the method, the period. A rate against an observed metric may be computed and is labeled with the method |
| `unknown` (either missing) | the count and the word **unknown**. It is never called a conversion, and no rate is offered — the button to compute one does not exist |

The honest sentence spec 26 wrote stands as the screen's own copy rule: "8 signups happened while 4,000 views happened" is what the data says until a method says more.

**Soft signals are not here.** DMs, inquiries, perception answers and her remarks live in `client-perception/` and `logs/observations/` and are read by her directly. No query in this spec reaches them (PLAN §5.2).

---

## 9. Compare — the thing the engine is actually built for

PLAN §5.2 point 3, and S5/S6. **The screen says Compare. The machinery builds a matched comparison.**

### 9.1 How she starts one

Three doors, all of them one tap from where she already is:

1. **From a seed** — "compare this seed's pieces". The seed is the held variable by construction; this is the format test and the hook test PLAN names.
2. **From a slice** — "compare these" on two or more rows of a bifurcation cell.
3. **From two pieces** — select on the board, compare.

She may compare **two or more** pieces. `MatchedComparison.piece_ids` is already a list (spec 21 §7.10), and `resolveComparison` already handles n sides.

### 9.2 What the machinery records without asking her for it

| Field | Filled from |
|---|---|
| `held_variables` | the costume dimensions that are identical across the selected pieces, computed |
| `changed_variable` | the single dimension that differs. **Two or more differing dimensions → the comparison is created but marked `confounded`**, and its verdict words say which dimensions moved together |
| `posting_windows` | each piece's `published_at` from its platform post |
| `account_baseline` | §4.5's baseline for the metric and window |
| `confounders` | any coverage gap overlapping any piece's window; any deleted post; any metric-definition change inside the span; a posting-date spread wider than 30 days |
| `window` | her pick of `first-24h` / `7d` / `30d` / `lifetime`, defaulting to the widest window materialized for every side |
| `hypothesis` | one line, hers, optional on an ad-hoc comparison and **required** on a planned one (§9.4) |

Only `hypothesis` is ever typed, and only sometimes. Everything else is a byproduct of work she already did — the 2026-07-10 design law, kept.

### 9.3 The verdict

`resolveComparison` (`lib/tree/metrics.ts`) is called as it stands. It is not modified, not wrapped in something cleverer, and not second-guessed:

- below sufficiency → `state: 'not-enough-comparable-data'`, **no ranking**, and the screen says what is missing;
- margin under 10% → `inconclusive`, "too close to call";
- otherwise → `favours`, phrased as directional evidence with the changed variable named, never causation.

The screen adds two honest lines the function already has the data for: the **actual ages** of the readings on each side (a 19h reading and a 31h reading are both "first-24h" and the screen says so), and the **confounders** list.

A confounded comparison still resolves, and its verdict text leads with the confound: *"Two things changed at once (format and hook type), so this points somewhere, it does not prove anything."*

### 9.4 Planned comparisons — deliberate experiments

PLAN §5.2: *"Experiments — now simply the compare feature used deliberately: a planned A/B is marked as one, so its pieces are judged as a test."*

A planned comparison is created **before the pieces post**, from the engine room or the board:

- `planned: true`, `hypothesis` required, the intended changed variable declared up front;
- the comparison sits `open` and shows a live countdown to the window that will decide it, and what is still owed;
- when both sides materialize the window, it resolves the same way an ad-hoc one does — same function, same thresholds, same refusals;
- a planned comparison whose declared changed variable is not the one the machinery computes is flagged: *"you planned to change the hook, but the format changed too."* No silent rescue.

Nothing about "planned" makes a verdict stronger. It makes the hypothesis older than the result, which is the only thing that ever made an experiment worth the name.

### 9.5 Storage

Comparisons are written to `work-log/analysis/comparisons` (declared by spec 21, switch `analysis.compare`, append-only, owner). Resolving a comparison appends; it never overwrites an earlier resolution, so a comparison resolved at 7d and again at 30d keeps both.

---

## 10. Goal tracking — targets vs actual, and blocked goals say why

### 10.1 Where the target comes from

From the goal's own S16 declaration at `context/content-strategy/goals/*/measurement` (spec 26 §9): the metric ids, direction, calculation, denominator, window, and **target — a value with a period, or the explicit token `direction-only`**. Blank is not allowed there, so a goal card never has to invent a target.

Nobody is ever asked to re-state a goal (PLAN §3.8).

### 10.2 One goal card

```
[Goal name]
Target       120 link taps this month        (or: direction only — up is better)
Actual       74            Window: month, running
Pace         behind by 22 at this point of the month
Coverage     complete
```

`Pace` is computed only where the target carries a period. For `direction-only` goals the card shows the trend against the account's own trailing baseline and no pace line — because there is nothing to be behind.

### 10.3 Blocked goals show why, and never guess

| Reason | What the card says |
|---|---|
| no S16 declaration | *"Not measured yet — this goal has no measurement declared."* Links to the declaration panel. `analysis.goal_tracking` stays blocked **for that goal only**, per spec 21 §8.9 and spec 26 §9 |
| declaration's fallback is `none` | *"Decided as not measurable here."* This is a decision, not a fault, and it reads like one |
| fallback is `manual-checkin` | the Journey check-in number she already logs, labeled *entered by hand*, never mixed into a computed rate |
| fallback is `proxy:<metric>` | the proxy value, labeled **proxy** every single time it appears, including inside digest words |
| platform unavailable | *"Instagram does not report this."* From `platform_availability`, so a later platform change reads visibly as a change |
| coverage gap in the period | the gap first, the number second, marked partial |

ResumeGuru's four goals sit in her sort queue awaiting exactly these declarations (spec 26 §14). Until she writes them, this tab is honest about being blocked, and collection keeps running underneath (spec 26 §9).

---

## 11. The verdict cycle — the call, not a dashboard

PLAN §5.2 point 4: *"After 30 days, and again at two or three months: one verdict — which patterns and topics outperform the others, and whether working on them more is the right call. Not a dashboard of numbers; a call."*

### 11.1 Two cycles, per profile

| Cycle | Runs | Covers |
|---|---|---|
| `30-day` | on the 1st of each month, after the month-end digest's numbers are computed | the trailing 30 days |
| `quarter` | every 90 days from the profile's first verdict | the trailing 90 days |

**90 days is the committed pick** for "two or three months": it is a clean quarter, it is the outer edge of her own range, and at the shorter end the second verdict would too often repeat the first. Recorded as a **suggestion she finalizes**, like the thresholds (§26).

### 11.2 What code computes, before any model is called

The verdict's whole input is computed and stored first. The model never sees a database.

```
VerdictInput {
  profile_id, cycle, period_start, period_end,
  coverage: { days_expected, days_covered, gaps[] },     ← first, always
  thresholds, baseline_by_metric_window,
  pillars[]:  { pillar_id, name, job, declaration, n, quantity_vs_mix,
                typical, baseline, lift, band, state }
  patterns[]: { dimension, value, window, metric_id, n,
                typical, baseline, lift, band,
                sufficient: bool, insufficient_reason? }
  seeds[]:    { seed_id, name, n_pieces, typical, baseline, lift, sufficient }
  comparisons[]: resolved MatchedComparisons closed in the period
  goals[]:    { goal_id, target, actual, pace, state }
  funnel:     the month-by-month chain
  cannot_say[]: every pattern that failed sufficiency, with what is owed
}
```

**Patterns are cross-cuts of the bifurcation dimensions**, computed exhaustively and then filtered by sufficiency: single dimensions (hook type), pairs (format × hook type), and seed-level. A pattern needs `n >= minPieces` on each side and every piece above `minExposure` or it lands in `cannot_say`, never in `patterns`.

### 11.3 What the verdict says

Three parts, in this order:

1. **Coverage.** What was collected and what was not, before anything else.
2. **What outperformed.** The sufficient patterns, in the dictionary's terms (§12.3), each with its numbers and its n.
3. **The call.** For the leading pattern: is doing more of this the right call — `yes`, `no`, or `cannot say yet`, with the reason in one plain paragraph. "Cannot say yet" is a real answer and is expected to be the honest one for the first cycles.

The call is the reason this is a verdict and not a report. It may be `no`: a pattern that outperforms on reach while the profile's convert lane is starving is not a reason to make more of it, and a sharp strategist would say so (PLAN §5.2's intelligence bar example says exactly that).

### 11.4 Where it lands

`work-log/analysis/verdicts` (law-4 addition, §25), append-only, owner audience. A verdict is never edited: a re-run appends a new one and the old one stays, because a verdict is a fact about what we believed on a date.

Every verdict run writes an `engine_run` entry (spec 23 §5.7) with `kind: "analysis_verdict"`.

---

## 12. The model layer — words only, and the guards that keep it that way

The intelligence bar applies here (PLAN §5.2: *"verdicts must read like a sharp strategist's conclusions… not a metrics dump"*), and so does the trust rule (*"every number is computed by code; AI only words and explains. It can never invent a metric"*). Those two pull in opposite directions unless the second is mechanical. This section makes it mechanical.

The pattern is spec 23 §5's, followed deliberately so there is one model-layer shape across both engines.

### 12.1 The model and the call

**`claude-opus-5`**, through `@anthropic-ai/sdk`, same as spec 23 §5.1, and for the same reason: turning a table of lifts into a strategist's paragraph is the intelligence-sensitive end of the system. The chat brain's `claude-haiku-4-5` routes messages into folders; it does not weigh whether a winning hook is worth doubling down on.

```
model:          claude-opus-5
max_tokens:     8000              (thinking + output share this)
output_config:  { effort: "high",
                  format: { type: "json_schema", schema: VERDICT_SCHEMA } }
thinking:       default (adaptive, on) — reasoning is not surfaced
system:         [ the verdict method block   (cache_control: ephemeral),
                  the profile's strategy vocabulary block (cache_control: ephemeral) ]
messages:       [ { role: "user", content: <the VerdictInput, as JSON> } ]
betas:          [ "server-side-fallback-2026-07-01" ]
fallbacks:      "default"
```

Same model rules spec 23 §5.1 names, unchanged: no `temperature` / `top_p` / `top_k`, no `budget_tokens`, no assistant prefill, `max_tokens` caps thinking plus output, `stop_reason` checked before `content`.

### 12.2 The packet — deliberately narrow

Unlike the Content Engine's packet, this one is **not** the context bundle. Understanding an idea needs the founder's beliefs; wording a verdict needs the numbers and the vocabulary. Sending the full bundle would invite the model to reason from beliefs into numbers, which is the exact failure the trust rule names.

| Block | Contents |
|---|---|
| **A — method, always whole, never trimmed** | the three-part verdict shape (§11.3); the four fixed rules: (1) every number in your words must appear in the input, verbatim as given; (2) never claim causation — evidence, not proof; (3) anything in `cannot_say` may only be described as not enough data yet; (4) speak in the dictionary's terms |
| **B — vocabulary** | this profile's pillar names and jobs, platform and format names, its costume vocabulary, its goal names, its CTA labels — labels only, from `content-strategy/` |
| **C — the input** | the `VerdictInput` object, whole, as JSON |

**Excluded, and why:** every soft signal (they are outside the math); the raw seeds and captures (the verdict speaks about pieces, not beliefs); any other profile, always; anything under `frozen/`; assets and proof binaries. Only `active` paths contribute to Block B — a switched-off platform's name never reaches the model, so the cascade holds here too (spec 23 §5.4's rule, same enforcement).

`context_version` and packet contents are logged per run (S12), exactly as spec 23 §5.7 defines.

### 12.3 What comes back

`VERDICT_SCHEMA`: `{ headline, coverage_note, patterns[]: { pattern_ref, words }, call: { pattern_ref, right_call, words }, cannot_say_note, one_suggestion }`.

`pattern_ref` points at a computed pattern by id. The model chooses which patterns matter and how to say it; it cannot invent a pattern that has no id.

### 12.4 The four guards, run before she sees a word

| # | Guard | On failure |
|---|---|---|
| 1 | **Schema valid** | guaranteed by structured output; malformed is a run error, no verdict shown |
| 2 | **The number guard** — every numeral in every string must match a value present in the `VerdictInput` (normalized for formatting: `3.1%`, `3.1 percent`, `0.031`) | **REJECT**, retry once naming the violation. On a second failure the verdict renders in its code-computed form with a plain line: *"The engine's numbers are here; its wording did not pass the check."* This is what makes "AI can never invent a metric" mechanical rather than a promise |
| 3 | **The causation guard** (S5) — no banned claim words: proves, caused, because of, guarantees, will | REJECT and retry once, same fallback |
| 4 | **The sufficiency guard** — no `pattern_ref` may point at anything in `cannot_say`, and no pattern below sufficiency may be spoken of as a result | REJECT and retry once, same fallback |

Guards 2–4 reject rather than badge, and the difference from spec 23 is deliberate: a badged proposal is still hers to judge, while a badged verdict has already made a claim.

**Then the real bar.** Every verdict carries **"Below the bar"**, exactly as spec 23 §5.6 defines it, writing a `profile-rule` feedback item with the run id and the packet version. The count of below-bar marks over time is the honest measure of whether the verdicts read like a strategist. If it is not falling, the loop is broken and we fix the loop.

### 12.5 Cost, honestly

Per verdict: input 3k–10k tokens (mostly the computed table), output 0.5k–1.5k. At $5/M in and $25/M out, **about 5–8 cents a verdict**. Two verdict cycles plus one digest per profile per month across five profiles is roughly **$1–2 a month** — an order of magnitude under the Content Engine's extraction spend. It draws on the same `ANTHROPIC_API_KEY`, so spec 23 §16's parked question about a shared monthly ceiling covers this spec too. Nothing here builds ceiling behavior ahead of her answer; `cost_estimate_usd` is written from run one.

**With no API key**, everything in this spec still works: every number, every band, every refusal, every comparison verdict is code-computed. Only the strategist's paragraph is missing, and the surface says so plainly. Acceptance test 12.

---

## 13. The digest — monthly, weekly, always-live

All three cadences are PLAN §5.2's and spec 07's, already hers. They are carried, not re-decided.

### 13.1 Monthly digest, per profile, right after month-end

Runs on the 1st, in the profile's own month boundary — the timezone of its primary connected channel, falling back to IST where no channel declares one (spec 26's timezone sort-queue item is the same question). Contents, in order:

1. coverage for the month;
2. what outperformed;
3. which pillar is earning **by its job**;
4. which combinations are winning;
5. what the funnel says;
6. **one** concrete suggestion;
7. what cannot be said yet, and what is owed before it can.

Short, plain words. Numbers code-computed, words model-written under §12's guards.

### 13.2 The weekly owner pulse, across all profiles

A few lines across every profile: anything moving, anything early, anything slipping — and, first, **any profile whose collection is broken**. Her eyes only.

**Where it lives, answered from the plan.** PLAN §5.3 says everything belongs to exactly one profile and the only thing between profiles is her shelf. So the pulse is **not** a cross-profile object: each profile writes its own weekly pulse entry into its own `work-log/analysis/digests` with `kind: 'weekly-pulse'`, and the shelf composes her one screen from them (PLAN §2 item 1: the shelf is where her single cross-profile window already lives). Nothing is stored between profiles, and a profile leaving the pulse (switch `analysis.pulse_owner → hidden`) removes exactly its own lines.

Suggested schedule: Monday 08:00 IST. Hers to finalize.

### 13.3 The always-live view

The Now tab. No waiting for month-end (spec 07's locked decision). It is the same computation layer with `period = month to date` and the same four states — which is why "always live" costs nothing extra and cannot drift from the digest: they are one calculation with two period arguments.

### 13.4 The four trust rules, as behavior

| Rule (PLAN §5.2) | Where it is enforced |
|---|---|
| **Trust** — code computes, AI only words | §12.4 guard 2, plus the model never touching a database |
| **Honesty** — below threshold, say not enough data; every suggestion cites its evidence | §4.6 refusal 1, §12.4 guard 4, and §15's write-door rule that a proposal without a cited verdict is refused |
| **Curation** — her digest displays automatically; anything a client sees is drafted then approved or edited by her | §14, the publication gate |
| **One truth** — analysis reads the pieces where they live | §4.2, and the absence of any register in this spec |

---

## 14. Client-facing — the publication gate

PLAN §4: the client sees *"the readable version of analysis (verdicts in plain words, her-curated)"*. PLAN §5.2 rule 3: *"anything a CLIENT sees is drafted by the engine and approved or edited by her first."*

**The committed pick: the client's analysis window renders the latest approved publication, never a live query.**

- A **publication** is an entry in `work-log/analysis/digests` with `kind: 'client-publication'`, holding the approved scorecard cards, the approved goal lines, the approved digest words, its period, and its coverage note.
- She reviews it in a draft state, edits any word, and approves. Approval is a deliberate act with a date and her name on it. Nothing publishes on a timer.
- Until she approves the first one, the client's Analysis window renders its empty state: *"Your first monthly summary will appear here once it is ready."* Not a half-built dashboard, not live numbers.
- Editing a published one creates the next version; the client sees the newest approved version and the older ones stay in the record.

**Why a publication and not a filtered live view.** Three reasons, all of them from the plan: it is the only shape where "never automatic" is structurally true; a live client view would show a client a coverage gap in real time with no words around it; and PLAN §4's "never the raw working notes" is a promise about what is finished, not about what is filtered.

**The resolver enforces it.** Spec 21's declarations mark `work-log/analysis`, `goal-tracking` and `digests` as `audience: both` with `client_door: see:analysis`. This spec adds one rule to the server-side resolver, in the direction CLAUDE.md rule 2 allows — only stronger:

> On any analysis path, a non-owner role receives entries marked `published: true` with an approval stamp, and nothing else.

The client never sees: comparisons, the compare surface, the funnel, the sync-health tab, the verdict internals, show-my-working, unplanned posts, baselines, another profile, or any draft. No switch, in any position, can grant any of it (PLAN §4, KRNL OS rule 1).

---

## 15. The loop back — conclusions routed, never piled

PLAN §5.2: *"conclusions are routed, never piled."* Four routes, three of which this spec builds and one it hands over.

### 15.1 "Make more of this" → a revisit proposal in the seed bank

One tap, on any sufficient pattern in a verdict or digest.

- Writes to `work-log/creation/topics/proposals` with `kind: 'revisit-seed'`, `fed_by: engine:analysis` — the path and behavior spec 23 §8.3 already reserved for exactly this.
- **It never creates a seed.** The seed already exists. The proposal references the existing locked seed plus the winning costume; picking it up opens the engine room on that seed with the costume pre-filled (Content Engine II's surface).
- **Evidence is required at the write door.** A revisit proposal with no `verdict_ref` is refused — not warned, refused. PLAN §5.2's honesty rule made structural, and spec 23 §8.3 rule 2 honored.
- It is **untouchable until she picks it up**: stamped ENGINE PROPOSED with the verdict's date, no editable field, one affordance (pick up) and one dismissal, which is preserved forever with her reason as a `seed`-scoped feedback item.

**One named correction to spec 23's switch registry.** Spec 23 §11.1 puts the proposals PATH under `creation.seed_extraction`, while §12 says that switch turning off "only stops the model call" and leaves the bank working. Both cannot be true, and a revisit proposal costs nothing — it is code-computed. The path's governing switch becomes **`creation.engine`** (the room, the bank, the captures, the proposals block), and `creation.seed_extraction` keeps what it actually owns: the model call. Nothing about either switch's position or default changes; those are hers.

### 15.2 Winning combinations → costume recommendations in the engine room

PLAN §5.2: *"this hook type is landing for this stage."*

Computed from `work-log/analysis/verdicts` at read time. **No new store**: a recommendation is a projection of sufficient patterns, and it dies when the verdict that carried it is superseded. It surfaces inside the Content Engine's room (Content Engine II renders it), it is read-only, it always carries its evidence — the pattern, its n, its window, its verdict date — and it never pre-selects anything. The engine serves and never rails (PLAN §3.10).

Switch: `analysis.costume_recommendations`.

### 15.3 Structural findings → proposed strategy diffs she accepts or rejects

Mix targets and pillar jobs, per PLAN §5.2.

- The engine writes a **feedback item** (spec 21 §7.12, at `work-log/logs/feedback`, declared by spec 23 §9.2) with scope `candidate-strategy-change`, carrying the proposed diff, the citing `verdict_ref`, and plain words for why.
- **The engine never writes strategy.** She accepts or rejects. On acceptance, her action writes the strategy parameter — version N+1, dated, with the cited reason (spec 22 §8.8), which is PLAN §3.4's "strategy changelog" and needs no separate folder.
- On rejection, the proposal and her decision both stay on the record (S13).
- A diff with no cited verdict is refused at the write door, same rule as §15.1.
- **Nothing updates strategy behind her back**, and a strategy change re-validates the switch configuration (spec 22 §8.8), so a diff that would create a contradiction is refused before it reaches her.

Switch: `analysis.strategy_diffs`.

### 15.4 Format findings → the platform's `rules/`

Handed over, not built here. Format feedback routes through the same `work-log/logs/feedback` path as a `profile-rule`-scoped item and lands in the platform's `rules/` through the feedback memory, which is Content Engine II's mechanism (PLAN §5.1). This spec writes the feedback item and stops there.

---

## 16. The health tab — sync health, drawn

Spec 26 §17 declared the owner-only sync-health surface and left it to be drawn here. It reads `work-log/analysis/study-own-data/sync-health` and shows, per channel:

- **collecting since** (`track_since`) and **last successful sync**;
- **connection state**, and for `error` the run's plain error text;
- **every coverage gap**, its dates, its width in days, and its reason in her language — `sync-stalled` reads *"the pipe stopped"*, `switched-off` reads *"you turned this off"*, `not-yet-tracked` reads *"before we started collecting"*, `platform-error` names the platform's complaint;
- **partial runs** and which posts they missed;
- **"Update now"** — the owner-triggered run that already exists (`analysis.backfill`), with the honest line beside it: *"This fetches today's totals. It cannot recover the days we missed."*

This tab is the reason the rest of the app is allowed to show numbers at all.

---

## 17. Addresses — every folder this spec reads and writes

Per PLAN §6 rule 3: no address, no build.

### 17.1 Written

| Path | What lands there | Fed by | Read by | Switch | History | Audience |
|---|---|---|---|---|---|---|
| `work-log/analysis/verdicts` | the 30-day and quarter verdicts, computed input and worded output together | `engine:analysis` | owner, `work-log/analysis/digests`, `work-log/creation/topics/proposals` | `analysis.verdicts` | `append_only` | owner |
| `work-log/analysis/comparisons` | matched comparisons, ad-hoc and planned, with their resolutions | `owner`, `engine:analysis` | owner | `analysis.compare` | `append_only` | owner |
| `work-log/analysis/digests` | monthly digests, weekly pulse entries, client publications | `engine:analysis`, `owner` (approval) | owner, `client` | `analysis.digest_owner` | `append_only` | both (`see:analysis`) |
| `work-log/analysis/goal-tracking` | computed target-vs-actual records per period | `engine:analysis`, `owner` | owner, `client` | `analysis.goal_tracking` | `append_only` | both (`see:analysis`) |
| `work-log/creation/topics/proposals` | revisit proposals, `kind: 'revisit-seed'`, evidence required | `engine:analysis` (also `engine:content`, spec 23) | owner | `creation.engine` (corrected, §15.1) | `append_only` | owner |
| `work-log/logs/feedback` | `candidate-strategy-change` and `profile-rule` items, and her decisions | `engine:analysis`, `owner` | owner, `context/content-strategy`, both engines | `logs.feedback` (fixed) | `append_only` | owner |
| `work-log/logs/engine-runs` | one entry per verdict, digest, or pulse run (S12) | `engine:analysis` | owner | `logs.engine_runs` (fixed) | `append_only` | owner |
| `context/content-strategy/*` | **only on her acceptance of a diff** — version N+1, dated, with the cited verdict | `owner` (the accept action); proposal provenance `engine:analysis` | everything in work-log | `strategy.fixed` | `versioned` | both (`see:strategy`) |

One path is new (`verdicts`) and goes to the control room for ratification (§25). Everything else is already declared by specs 21, 23 and 26.

### 17.2 Read, and never written

| Path | Why |
|---|---|
| `work-log/analysis/study-own-data/observations` | the numbers. Read-only, always (S3) |
| `work-log/analysis/study-own-data/sync-health` | coverage, runs, reasons — read before performance |
| `work-log/analysis/study-own-data/links` | which platform post is which piece |
| `work-log/analysis/attributed-outcomes` | the outcomes panel, behind the wall |
| `work-log/creation` | the canonical piece identity, its stage, its birth snapshot, its live link |
| `work-log/creation/channels` | account identity, timezone, ownership |
| `work-log/creation/topics` | seed names for the seed slice and for revisit proposals |
| `context/content-strategy/pillars/*` (+ `/measurement`) | the measuring stick for the scorecard |
| `context/content-strategy/goals/*` (+ `/measurement`) | the measuring stick for goal tracking |
| `context/content-strategy/platforms/*` (+ `/metrics`, `/formats`) | which metrics exist, which formats exist |
| `context/content-strategy/funnel-shape`, `ctas` | the funnel's shape and its last observed step |
| `context/content-strategy/voice`, `positioning` | vocabulary only, for the wording block |
| `context/content-strategy/toolset` | every switch position, before anything renders |
| `shelf/profiles` | lifecycle (S22), and which profiles enter the weekly pulse |

### 17.3 Not touched

`work-log/analysis/client-perception`, `work-log/logs/observations`, `work-log/analysis/market-research`, everything under `frozen/`, every other profile's anything. Soft signals are recorded and read by her; the engine concludes from numbers (PLAN §5.2).

---

## 18. Switches registered

Every feature registers its switch at birth (PLAN §3.4). Suggested defaults only — **she finalizes every position**.

### 18.1 Reused, unchanged

`analysis.tracking` · `analysis.scorecard` · `analysis.funnel` · `analysis.bifurcation` · `analysis.compare` · `analysis.goal_tracking` · `analysis.digest_owner` · `analysis.digest_client` · `analysis.ai_tagging_fallback` · `analysis.sync_health` · `analysis.backfill` · `analysis.attributed_outcomes` · `analysis.soft_signals` (governs only where soft signals are recorded; nothing here reads them) · `logs.engine_runs` · `logs.feedback` · `creation.engine` · `strategy.fixed` · `platforms.*` · `client_access.login`.

### 18.2 New

| Switch | Owns | Requires | Dependents | Audience | States | Suggested |
|---|---|---|---|---|---|---|
| `analysis.always_live` | the Now tab | `analysis.tracking` | — | owner | active · hidden | `active` |
| `analysis.verdicts` | `work-log/analysis/verdicts`, both cycles | `analysis.tracking`, `analysis.scorecard` | `analysis.revisit_proposals`, `analysis.strategy_diffs`, `analysis.costume_recommendations` | owner | active · history · hidden | `active` |
| `analysis.verdict_words` | the model call that words a verdict or digest | `analysis.verdicts` | — | owner | active · hidden | `active` |
| `analysis.pulse_owner` | this profile's weekly pulse entry and its lines on the shelf | `analysis.tracking` | — | owner | active · hidden | `active` |
| `analysis.revisit_proposals` | — (the "make more of this" write door into the proposals path) | `analysis.verdicts`, `creation.engine` | — | owner | active · hidden | `active` |
| `analysis.costume_recommendations` | — (the recommendations block inside the engine room) | `analysis.verdicts`, `creation.engine` | — | owner | active · hidden | `active` |
| `analysis.strategy_diffs` | — (engine-proposed diffs into `logs/feedback`) | `analysis.verdicts` | — | owner | active · hidden | `active` |
| `analysis.client_publication` | the draft-and-approve flow for a client publication | `analysis.digest_client` | — | owner | active · hidden | `hidden` |

Four carry `owns: []` and name what they govern in their note, following spec 22 §9.2's precedent: the governing switch of a PATH stays the one its declaration names, so nothing is re-pointed.

**`analysis.verdict_words` exists for one honest reason:** it turns the model off without turning analysis off. Every number, band, refusal and comparison verdict is still computed; only the strategist's paragraph goes away. That is the correct off-switch for a profile where she does not want API spend, and it is the same shape as spec 23's `creation.seed_extraction`.

### 18.3 The cascade, traced

Her canonical trace (PLAN §3.4), run through this spec: `platforms.linkedin → hidden` removes LinkedIn from every dimension picker, every scorecard platform split, the funnel's platform rows, the compare surface's selectable pieces, the verdict's patterns, and the vocabulary block sent to the model — on her side and the client's. Every past LinkedIn observation stays readable at `history`, and no verdict already written is altered. Acceptance test 6.

`analysis.tracking → history` leaves every surface readable and every number frozen at the last collected day, with the switched-off reason on the face of it. Nothing is deleted (S9).

### 18.4 Validation at strategy lock

Two checks added to `validateSwitchConfig` (spec 21 §5.3), extending spec 26 §9's:

- `analysis.verdicts` cannot be `active` on a profile whose `content-strategy` has never locked — a verdict against no declared measuring stick would be a number with no meaning.
- `analysis.client_publication` cannot be `active` while `analysis.digest_client` is `hidden` or client access is off.

---

## 19. Audiences and doors

- Every surface in this spec is `audience: owner` except the three that reach a client through the single existing door `see:analysis`: the client publication, and the scorecard and goal lines carried inside it.
- **No fifth door.** Nothing here is client-writable. A client cannot request a report, cannot filter, cannot query, cannot comment inside analysis. Their read-back on performance is the perception give-point at review (S19), which is a soft signal and does not enter this spec's math.
- The publication gate (§14) is enforced server-side in the resolver, not in the UI. Spec 12's 19 security checks re-run against it as part of acceptance (test 10).
- `verdicts`, `comparisons`, `sync-health`, `engine-runs`, `feedback`, and every internal of a digest are `audience: owner` and are stripped from every non-owner body by the declarations, the way spec 23's paths are.

---

## 20. Objects

Spec 21 owns the identities. This spec adds two, and extends nothing.

### 20.1 `Verdict` (new)

```
id, profile_id, cycle: '30-day' | 'quarter',
period_start, period_end,
input: VerdictInput,                    // §11.2, computed, stored whole
words?: { headline, coverage_note, patterns[], call, cannot_say_note,
          one_suggestion },             // absent when analysis.verdict_words is off
                                        // or when the guards rejected twice
guards: { rejected: n, reasons[] },
run_id, model, effort, packet_version, context_version,
state: 'computed' | 'worded' | 'words-withheld',
created_at
```

Append-only. Never edited. A re-run appends.

### 20.2 `Digest` (new)

```
id, profile_id,
kind: 'monthly' | 'weekly-pulse' | 'client-publication',
period_start, period_end,
sections[],                             // each carrying its computed values
coverage: { days_expected, days_covered, gaps[] },
verdict_ref?,
published: bool, approved_by?, approved_at?, supersedes?,
run_id, created_at
```

`published` is false until she approves, and only `kind: 'client-publication'` entries are ever served to a client (§14).

### 20.3 Used as they are, not redefined

`MatchedComparison` (spec 21 §7.10) — used exactly as shipped, including `state`, `verdict`, and `confounders`. This spec adds no field to it and no second version; `planned` and `hypothesis` are carried in the existing shape (`planned` as a member of `confounders`-adjacent metadata on the entry, not a new object).

`MetricObservation`, `CoverageGap`, `AttributedOutcome`, `Piece`, `BirthSnapshot`, `FeedbackItem`, `ContextPacket` — all read or written as their owning spec defines them.

---

## 21. Files

**New:**

- `lib/analysis/read.ts` — the only reader of spec 26's tables. Queries only, no writers.
- `lib/analysis/compute.ts` — typical, baseline, lift, sufficiency, bands, patterns, regimes. Pure functions over rows; no I/O, so every rule in §4 is unit-testable without a database.
- `lib/analysis/bifurcate.ts` — dimensions generated from the profile's declarations, slices and cross-cuts.
- `lib/analysis/scorecard.ts` · `funnel.ts` · `goals.ts` — one per surface, each thin over `compute.ts`.
- `lib/analysis/compare.ts` — builds a `MatchedComparison` from a selection, computes held/changed/confounders, calls `resolveComparison` **unmodified**.
- `lib/analysis/verdict.ts` — assembles `VerdictInput`.
- `lib/analysis/words.ts` — the model call, the packet, the four guards.
- `lib/analysis/digest.ts` — monthly, pulse, publication.
- `app/api/analysis/route.ts` — the owner read endpoint for every surface.
- `app/api/analysis/verdict/route.ts` — cron (monthly, quarterly) or owner-triggered.
- `app/api/analysis/digest/route.ts` — cron (monthly, weekly) or owner-triggered.
- `components/analysis/` — one component per tab, plus the shared `CoverageBanner`, `TooEarly`, and `ShowMyWorking`.

**Changed:**

- `lib/tree/declarations.ts` · `switches.ts` · `features.ts` — the new path, the eight new switches, the corrected proposals-path switch, the feature rows.
- `lib/access.ts` — the publication gate rule in the resolver (§14).
- `vercel.json` — the monthly and weekly cron entries, alongside spec 26's twice-daily collection.
- `components/AnalyticsView.tsx`, `app/client/[id]/analytics/`, `app/api/analytics/route.ts` — re-cut onto the new layer (§22).

**Untouched:** `lib/tree/metrics.ts`'s `resolveComparison`, `detectCoverageGaps` and thresholds (spec 26 owns them); `lib/igShortcode.ts`; every connector.

---

## 22. Migration — specs 03–07's machinery absorbed

PLAN §5.2: *"specs 03–06 (built, undeployed) and 07 (specced) already implement most of this for Instagram. At build time Opus re-cuts them to this map and the tree's addresses — absorbed, not re-invented."*

### 22.1 What is reused

| From | What survives, unchanged in substance |
|---|---|
| **03** | the link join and "her paste IS the trigger" — already absorbed by spec 26 §8; this spec consumes its output |
| **04** | pillar jobs as a first-class field; change-dating so analysis never mixes regimes (§4.3); goals as a multi-select list per profile; "a new pillar starts at too early to judge and disturbs nobody" |
| **05** | the three-layer shape (scorecard → comparison → funnel); the one-truth rule; show-its-work; the verdict words earning / steady / dragging / too early; outlier-resistant typical values; 8–12 week windows (taken as 12); never absolute numbers, never cross-account; the CTA alignment drift flag; "never-posted pieces never enter analysis" |
| **06** | AI tagging demoted to a fallback; sticky owner corrections; tags inform, never invent numbers. Spec 26 re-addressed the table as `post_readings`; this spec is the first thing to read it, and only for unplanned posts and for dimensions no birth snapshot carries |
| **07** | monthly digest right after month-end; weekly owner pulse; the always-live view; the trust, honesty and curation rules; digest language speaking the profile's own goal words |

### 22.2 What is superseded, and by what

| Superseded | By | Why |
|---|---|---|
| Spec 04's fixed job → metric map | the S16 declaration per pillar (spec 26 §9); the map becomes the suggested default the derivation surface offers | the ResumeGuru taxonomy's own lanes carry jobs a three-value map cannot express |
| Spec 04's `Topic` entity and `ContentCard.topicId` | the seed (`Seed`) and `Piece.seed_id` (S1, S24) | a topic is not content material; the engine never generates from one |
| Spec 04's Repurpose action as the topic-linking mechanism | a new resolved costume on the same locked seed | same workflow, correct object |
| Spec 04's `experiment { hypothesis }` and its separate analytics section | planned comparisons (§9.4); the field migrates into `MatchedComparison` with every other field `unknown`, exactly as spec 21 §7.10 ordered | PLAN §5.2 retired the separate experiments lane |
| Spec 04's exclusion of experiment posts from pillar math | §7.4: they count, and the show-my-working line names them | a posted piece is a posted piece; excluding it understates the pillar against its own mix target |
| Spec 05's "code-computed verdicts display to clients without approval" | the publication gate (§14) | PLAN §5.2 rule 3 and the brief are stricter, and the plan outranks the spec |
| Spec 05's flow-archetype "last mile" (DM/website/direct/audience) | the S16 declarations plus the S23 wall | the last mile was a cross-system conversion claim without a declared attribution method |
| Spec 05's topic-group comparison as its own layer | the compare surface, where a seed's expressions are one selection among three doors | one machinery, three entrances |
| Spec 07's "one-tap creation of content cards seeded by the winning combination" | the revisit proposal (§15.1): marked engine-proposed, untouchable until she picks it up, evidence required | PLAN §5.2's proposal law |
| The global `/analytics` page | already retired (her 07-13 decision); the shelf's weekly pulse is the only cross-profile analysis surface, and it composes per-profile entries | PLAN §2: the shelf shows status, never content |

### 22.3 Order of build

1. `lib/analysis/read.ts` + `compute.ts` against fixtures, with the four states and five refusals tested first. Nothing renders yet.
2. Bifurcation, then scorecard, then funnel, then goals — each on the same layer, each shipping its coverage banner.
3. Compare, ad-hoc then planned.
4. The verdict cycle, computed only (`analysis.verdict_words` off), so every number is proven before a word is generated.
5. The words layer and its four guards.
6. The digest: monthly, then pulse.
7. The loop back: revisit proposals, then strategy diffs, then costume recommendations (which Content Engine II renders).
8. The client publication last, per profile, on her approval.
9. Deploy on her explicit go, per DEPLOY.md and CLAUDE.md rule 6, with the drift check.

**Nothing is deleted.** The built 03–06 code is re-cut in place; `ig_*` stays read-only (spec 26 §13); every existing profile keeps rendering what it renders today until she walks it through (spec 22 §13's rule, kept).

---

## 23. Acceptance tests

Run with `npm test`, alongside spec 21's 70 checks and spec 26's 12. Tests 1–12 run on fixtures; 13–14 run against real data after her setup day.

1. **The gap test, in every surface.** With observations present through 2026-07-11 and absent after, **all eight surfaces** — Now, Slices, Scorecard, Funnel, Compare, Goals, Verdicts, Digest — render the stretch from 2026-07-12 as a coverage gap with reason `sync-stalled`, and **not one of them reports a drop, a decline, or a lower band** for the affected period. Asking "how did July go" returns a gap, never a slump. This is spec 21 test 8 and spec 26 test 1 carried up into the reading layer, and it is the test this whole spec exists to pass.
2. **Comparisons below thresholds refuse to rank.** Two pieces, one with exposure under `minExposure`: the comparison returns `not-enough-comparable-data`, has **no** ordering, no "leads", no percentage, and states what is missing. Raising the exposure above threshold makes it resolve — proving the threshold is what stopped it, not luck.
3. **Read-only against the store.** Any write from `engine:analysis` to any path under `study-own-data` is refused at the write door. Removing the declaration guard makes it succeed, proving the guard is what stops it.
4. **The birth snapshot is the truth.** A piece whose costume is edited after posting still appears under its ORIGINAL hook type in every slice, comparison and pattern. A piece with no birth snapshot lands in the "born before the engine" bucket with a count, never silently dropped.
5. **The growth test (law 3).** Add a fourth pillar, a new hook type, and a new platform with its formats. Each appears in the bifurcation picker, the scorecard, the compare selector and the verdict's pattern space with no code change and nothing blank. The new pillar reads `too early to judge` and no other pillar's verdict moves.
6. **The cascade test.** With `platforms.linkedin → hidden`: no LinkedIn dimension value, no LinkedIn scorecard split, no LinkedIn funnel row, no LinkedIn piece selectable in Compare, and no LinkedIn name anywhere in the packet sent to the model — on her side and the client's. Flip to `history` and every past LinkedIn number stays readable while nothing new computes.
7. **The scorecard judges by job only.** A pillar whose job is Convert, with a declaration naming link taps, reports `earning` on strong link taps while its reach sits below baseline — and its show-my-working sentence names the declaration. A pillar whose job has no declaration renders `blocked` with the reason, and collection is unaffected.
8. **The number guard.** A model response containing a numeral not present in the `VerdictInput` is rejected and retried once; a second violation withholds the words and renders the computed verdict with the plain explanation. No fabricated number ever reaches a rendered string.
9. **The causation and sufficiency guards.** A response containing "proves" or "caused" is rejected. A response referencing a pattern that sits in `cannot_say` is rejected. Both retry once, then withhold.
10. **No client leak, and no automatic publication.** A client login receives zero entries at `verdicts`, `comparisons`, `sync-health`, `engine-runs`, `feedback`, and zero unpublished digests. A newly computed monthly digest is **not visible to the client** until she approves it; the check FAILS when the publication gate is removed. (Re-runs spec 12's 19 security checks against the resolver.)
11. **Evidence at the write door.** A revisit proposal with no `verdict_ref` is refused. A strategy diff with no `verdict_ref` is refused. A written proposal is untouchable: every write to it other than pick-up or dismiss is refused, and a dismissed one still carries its original text.
12. **Keyless honesty.** With no `ANTHROPIC_API_KEY`, every surface renders, every number computes, every comparison resolves, and the verdict renders in computed form with a plain line saying the wording is unavailable. Nothing fabricates a sentence, and no run is logged as successful.
13. **The live gap test.** After the stall is fixed and the first successful run lands, the July hole is still exactly as wide as it was, in every surface, with no interpolated point anywhere in any rendered series.
14. **The one-truth test.** Every row in every surface resolves to a piece that exists on the board, and no surface holds a content field of its own. Grepping the analysis layer for a stored title, caption, or body finds nothing.

---

## 24. Deliberately out of scope

- **Collection, connectors, windows, links, the S16 gate machinery, the S23 store rule.** All spec 26's, all read here.
- **`resolveComparison` itself.** Shipped, correct, untouched.
- **The engine room's rendering of costume recommendations.** Computed here, drawn by Content Engine II.
- **Drafting, the internal brief, the seven gates, the format rules.** Content Engine II.
- **Market research.** Deliberately open per PLAN §5.2 and law 4; defined with her when a real need appears.
- **The impact / brand-recall layer.** Named honestly as not achievable (PLAN §5.2). Not attempted, not approximated, not proxied.
- **Soft signals as inputs.** Recorded elsewhere, read by her, never in this spec's math.
- **The GUI restructure.** This spec describes eight surfaces and what they need from the shell; the profile-first shell is its own spec.
- **The second connector.** A LinkedIn or YouTube surface arrives with its connector, by law 3, not by a deferral here.
- **The chat thread and the untagged inbox.** FROZEN, exactly as PLAN §11 ordered.
- **The deploy.** DEPLOY.md and CLAUDE.md rule 6 stand: her explicit go, every time, and the drift check against the deploy repo before anything moves.

---

## 25. Law-4 additions born in this spec

One new path, declaring its feeds and readers at birth, inside an existing spine folder (law 1 intact). For the control room to ratify into PLAN §3.8:

| Path | Why | Fed by | Read by | Switch |
|---|---|---|---|---|
| `work-log/analysis/verdicts` | PLAN §5.2 point 4 makes the verdict a first-class output on a cycle, distinct from the digest that delivers it. Revisit proposals and strategy diffs must cite a verdict by id at their write door, so the verdict needs an address to be citable. | `engine:analysis` | owner; `work-log/analysis/digests`; `work-log/creation/topics/proposals`; `work-log/logs/feedback` | `analysis.verdicts` |

**One correction to a shipped declaration**, for the control room's record: `work-log/creation/topics/proposals`'s governing switch moves from `creation.seed_extraction` to `creation.engine` (§15.1), resolving a contradiction inside spec 23 and letting a cost-free analysis proposal survive with the model call switched off. No switch position or default changes.

No new parameters, no new entry folders, no reshaping of anything.

---

## 26. Open questions

**None.** Six candidates came up and the plan answered all six. They are recorded so the control room can check the reasoning rather than take it on trust.

- *Where does the cross-profile weekly pulse live, when PLAN §5.3 says everything belongs to exactly one profile?* — Each profile writes its own pulse entry into its own `digests`; the shelf composes her one screen from them, which is where PLAN §2 already puts her single cross-profile window. Nothing is stored between profiles. §13.2.
- *Does the client see live numbers or a publication?* — A publication. PLAN §5.2 rule 3 says anything a client sees is drafted then approved or edited by her, and "never automatic" is only structurally true if publication is her act. This supersedes spec 05's automatic display of code-computed verdicts, and the plan outranks the spec. §14.
- *Do planned-comparison pieces count in their pillar's math?* — Yes. PLAN §5.2 retired the separate experiments lane, and the one-truth rule plus the mix target both need every posted piece counted. Spec 04's exclusion is named as superseded rather than quietly dropped. §7.4, §22.2.
- *Which metrics judge a pillar?* — Only the ones its S16 declaration names. Spec 04's job → metric map becomes a suggested default, because the ResumeGuru taxonomy's own lanes carry jobs like "reach to trust" that a fixed map cannot judge. §7.1.
- *Does the client see the funnel or the comparisons?* — No. PLAN §4 grants the client "the readable version of analysis (verdicts in plain words, her-curated)" and nothing else; spec 21's registry already sets `analysis.funnel` and `analysis.compare` to owner audience. §19.
- *Is there a separate register of posted work to bifurcate?* — No. PLAN §3.11 rejected it: the stages are the truth, and analysis reads the pieces where they live. §4.2.

**Three values are suggestions she finalizes**, handled the way switch defaults and spec 26's thresholds are — recorded as suggested, never silently applied, and blocking nothing:

1. **The verdict band cut-offs** (±15% lift for earning / dragging).
2. **The quarter verdict's length** (90 days, from her "two or three months").
3. **The weekly pulse's day and time** (Monday 08:00 IST).

They go to her sort queue with spec 26's three (thresholds, `track_since`, channel timezone) and the S16 declarations, so the collective phase gets one list, not six.

**One question stays parked where it already is:** spec 23 §16's monthly ceiling on engine model spend. This spec's wording calls draw on the same key and add roughly $1–2 per profile per month (§12.5). It is not re-opened here, and nothing in this spec builds ceiling behavior ahead of her answer.
