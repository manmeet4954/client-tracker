# 21 — Data-Layer Restructure

**Status:** BUILT 2026-07-25, NOT DEPLOYED. First spec under the locked master
plan (`dashboard/PLAN.md`, including its section 10 Sol Amendments), cleared to
build by PLAN §11 with all five questions in §12 answered.

Built in the order below: the declaration contract and validator (§4, §5), then
path-scoped writes (§3.4), then ONE pilot profile migrated (§9) — ResumeGuru,
one of hers. Every acceptance test in §10 runs green (`npm test`, 70 checks
including spec 12's security re-run). Where the build had to decide something
the spec left open, it is recorded in STATE.md, not here. Deploy waits on her
explicit go per DEPLOY.md.

**Authority:** `PLAN.md` outranks this file. Where this spec and the plan
disagree, the plan wins. Where an amendment in plan section 10 touches
anything below, the amendment wins. This spec adds no concept of its own — it
is an ADDRESS LEDGER: it takes everything that exists in the dashboard today
and gives it its address in the plan's tree (plan §3), names the folders each
feature reads and writes, and names the switch each feature registers in
`context/content-strategy/toolset/`.

**Why this is spec 21 and not spec 30:** plan §8 step 6 puts the data-layer
restructure first, before intake, before either engine, before the client-side
regroup. Nothing else can be built correctly until every existing piece knows
where it lives. Plan §6 rule 3 rejects any spec without addresses and
switches; this spec is the file that makes those declarations possible for
every spec after it.

---

## 1. What this spec is, and is not

**It is:**

1. The **declaration contract** — the machine-checkable record every folder and
   every feature must carry (fed by, read by, switch, states, history,
   audience), plus the validator that enforces plan laws 3 and 4 and plan §6
   rule 3.
2. The **address map** — every state slice, table, route, component, and API
   endpoint alive in the dashboard today, mapped to a tree address, with its
   reads, its writes, its switch, and its disposition.
3. The **canonical-object contracts** — profile, seed, piece, channel, metric
   observation, curated parameter, intake round, review configuration, rights
   record, handoff record, matched comparison, context packet, feedback item,
   gate set. These are the identities the amendments require; they are declared
   here once so no later spec invents a second version.
4. The **switch registry** — every switch that exists after the restructure,
   with prerequisites, dependents, audience, allowed states, and a SUGGESTED
   default. Suggested only: she finalizes every position (plan §3.4).
5. The **migration plan** — how today's data moves into the addresses without
   losing anything, per profile, pilot first.

**It is not:**

- Any GUI work. The profile-first interface (plan §2, §3.10) is a later spec.
- Either engine. This spec builds the body the engines read and write
  (plan §1, §5). An engine detail that appears here appears only as an address.
- Any new feature. Nothing gains capability in this spec. Features move, get
  declared, get switched, or get frozen.
- A build. No code is written from this file until the control room clears it
  and the open questions in §12 are answered.

---

## 2. How this spec reads "folder" (S25)

Amendment S25 governs the whole spec: **"folder" is the canonical information
architecture and OWNERSHIP CONTRACT, not a literal storage instruction.**
Implementations may use typed entities, fields, relations, and indexed views,
provided the declared feeds, readers, inheritance, history, and switch
behavior stay intact.

So every address below (`context/content-strategy/pillars/`, for example) means
exactly this and nothing more:

- there is ONE owner of that kind of information;
- its declared writers are the only writers;
- its declared readers inherit access to everything added inside it (law 3);
- its history is kept per the amendment that covers it (S7, S9, S11, S15);
- its switch state is checked before anything renders (plan §3.4).

The tree is therefore a **path namespace over typed data**, not a filesystem.
Every declaration record carries its `path`, and code addresses data by path.
That is what makes law 4 enforceable: a path with no declaration is rejected.

---

## 3. The storage decision (recorded per CLAUDE.md rule 5)

CLAUDE.md rule 5 requires a recorded decision before any second storage
pattern. This spec introduces none. The decision, for the record:

1. **Body data stays in the one `AppState` blob** (`app/api/state/route.ts`,
   one Supabase row), reshaped into a versioned, path-addressed per-profile
   `body` object. Rule 5 holds; no new storage pattern.
2. **Metric observations stay in the `ig_*` tables** — the one existing
   exception named in rule 5, and exactly what S3 requires: BODY-owned,
   immutable observations that the Analysis Engine computes from but never
   owns. These tables gain the S7 fields (§7.5) and stay pipeline data.
3. **No third pattern.** A later spec may move per-profile bodies into their
   own rows; two triggers make that mandatory rather than optional:
   the stored blob passing ~5 MB, or more than one writer per profile
   (which arrives with client logins writing give-points).
4. **Write scoping is in scope for this spec's build.** Gotcha 2 (the save
   race: the whole blob is POSTed, last write wins) gets worse as the body
   grows and as clients write give-points. The restructure must therefore
   change `app/api/state` from "replace the blob" to "apply a path-scoped
   patch": a write declares the paths it touches, and only those paths merge.
   This is the one piece of plumbing the restructure may not defer — every
   amendment that says "append-only" or "never overwritten" (S7, S11, S15) is
   a lie under last-write-wins.

---

## 4. The declaration contract (laws 3 and 4, made checkable)

### 4.1 The folder declaration record

Every path in the tree carries one declaration. A path without one does not
exist as far as the app is concerned — reads and writes against it throw.

| Field | Meaning |
|---|---|
| `path` | The address, e.g. `work-log/creation/review`. Unique. |
| `kind` | `variable` (the shelf) · `entry` (the box) · `parameter` (the compartment). Law 2's three levels. |
| `entry_type` | What may live inside. Enforced. (`creation/topics` → `seed` only, per S24.) |
| `fed_by` | The declared writers: `owner`, `client`, `engine:content`, `engine:analysis`, `pipe:<name>`, or another path. Nothing else may write. |
| `read_by` | The declared readers: paths, features, or `client`. Inherited by everything added inside (law 3). |
| `switch` | The switch id that governs this path. Required. `fixed` for the always-on decision layer (plan §3.4: strategy is not a switch). |
| `states` | Allowed states, from S9: `active`, `history` (read-only, never deleted), `hidden` (not applicable for this profile). |
| `history` | `append_only` · `versioned` · `mutable_with_supersession` · `none`. Which amendment governs it. |
| `audience` | Who may ever see it: `owner`, `client`, `both`. The client-facing guarantee (plan §4, CLAUDE.md rule 1) is enforced here, not in the UI. |
| `client_door` | If `audience` includes `client`: which of the four give-points or see-points this is (S19). Anything else is rejected. |

### 4.2 The validator

Three checks run in CI and refuse the build, not just warn:

1. **No address, no build (law 4).** Every read/write in the codebase resolves
   to a declared path.
2. **No switch, no feature (plan §6 rule 3).** Every feature in the feature
   registry (§8) names a switch that exists in the switch registry.
3. **No fifth door (S19).** No path may carry `audience: client` without a
   `client_door` naming one of the four give-points or the declared see-points.
   A client write to anything else is rejected server side.

### 4.3 What the validator replaces

Today the equivalent knowledge lives in people's heads and in prose across
specs 13 and 20. The Connected Loop (spec 13) was the wiring diagram; the tree
(plan §3) is the floor plan; this contract is the electrical inspection.

---

## 5. The switch registry (S8, S9, and the cascade)

### 5.1 The switch record

| Field | Meaning |
|---|---|
| `id` | e.g. `creation.scheduling`. Namespaced by app. |
| `owns` | The paths and features this switch governs. |
| `requires` | Prerequisite switches. A switch cannot be `active` while a prerequisite is not (S8). |
| `dependents` | Switches and paths that turn off with it — the cascade set (plan §3.4). |
| `audience` | `owner`, `client`, or `both` — who is affected by the position. |
| `allowed_states` | Subset of `active` / `history` / `hidden` (S9). |
| `suggested_default` | Claude's proposal. She finalizes; the field records that it was a suggestion. |
| `set_at` | When she set it, and from which strategy version (plan §3.4: after intake → curation → strategy). |
| `derived_from` | The strategy decision it came out of (working-mode, posting ownership, deliverables). |

### 5.2 Cascade resolution

A switch resolves to its effective state as the MINIMUM of its own position and
every prerequisite's state, computed transitively. The plan's canonical trace
must hold as a test: `platforms.linkedin → hidden` removes LinkedIn's formats
from the seed picker, LinkedIn's strategy questions, the LinkedIn channel, and
the LinkedIn column in analysis — on her side and the client's (plan §3.4).

Two rules from S9 that the resolver must honor:

- `hidden` **never deletes**. History, metrics, decisions, and obligations
  survive at state `history` and stay readable.
- A path at `history` accepts no writes, from anyone, including the engines.

### 5.3 Validation at strategy lock (S8)

The full switch configuration validates when strategy locks. Contradictions
refuse activation — the strategy cannot lock with them present. Minimum checks:

- No `active` switch with a non-`active` prerequisite.
- No channel `active` on a `hidden` platform.
- No `client` audience switch active while client access is off (S22).
- No analysis switch active for a job or goal with no metric declaration (S16).
- No publishing switch active where posting ownership says the client posts
  (plan §3.4 working-mode) or where the channel lacks posting permission (S17).

### 5.4 Nothing "fixed" escapes the registry

Strategy is not a switch (plan §3.10), and the four give-points are structural
(S19). These still get records, with `allowed_states: [active]` and a `fixed`
marker, so the registry stays exhaustive per her law: **every feature
registers its switch at birth.**

---

## 6. Profile identity and lifecycle (S22, plan §2)

Today: `Client { id, name, color }` plus `clientData[id]`. Access is matched by
client NAME through `RESTRICTED_MATCHERS` in `lib/access.ts` — renaming a
client silently opens or cuts off a login (CLAUDE.md, how the data works).

After the restructure:

- A `Client` becomes a **profile**: identity, brand color, `owner_kind`
  (`client` | `hers` — this is what gates the Momentum and Money meters per
  plan §7), `lifecycle` (S22: `setup` · `active` · `paused` · `closing` ·
  `archived`), and its switch configuration.
- Each lifecycle state declares: switch behavior, client access, connector
  revocation (platform tokens), export package, retention, deletion authority.
  Values for retention and deletion authority are NOT set in this spec — see
  §12 Q5.
- Migration sets every existing profile to `active`; new profiles start at
  `setup` and cannot open creation until strategy locks (plan §3.4 order).
- **Access binds by profile id, never by name.** `RESTRICTED_MATCHERS` is
  deleted; a login carries explicit profile bindings. This closes a live
  security footgun and is a precondition for switch-audience filtering.
- `filterStateForRole` and `mergeRoleWrite` (`lib/access.ts`) are rewritten to
  derive from switch `audience` + `client_door` + lifecycle instead of
  hand-maintained per-role tab lists. CLAUDE.md rule 2 stands: filtering stays
  server side and only gets stronger. The 19-check security test from spec 12
  is re-run against the new resolver as part of acceptance.

---

## 7. The canonical objects

One identity each, declared once. Later specs reference these; none may define
a second version (plan §3.11: no feature may introduce a second copy of a
content piece).

### 7.1 Seed (S1, S24, plan §5.1, §5.3)

Lives permanently in `work-log/creation/topics/`. Never has a stage. Carries
the full seed template from plan §5.1, including the founder's RAW thought kept
verbatim forever and every piece of raw material it was born from. Status:
`draft` → `discussed` → `validated` → `locked`. Only `locked` seeds may mother
pieces. `entry_type` for the path is `seed`; loose subjects are seed-capture
INPUT only, never peer entries (S24).

### 7.2 Piece (S1, S2, S15, S17)

Born when a locked seed gets a **resolved** costume: exactly one platform, one
format, one objective, one primary audience stage, one angle, one hook type,
one CTA (S4). Multi-select in the engine room births SEPARATE candidate pieces.

- **One canonical identity, owned by `work-log/creation/`.** `making/`,
  `review/`, `scheduling/` are views and queues over it (S2). Verdicts,
  schedule data, live links, and metrics attach to the piece.
- **Stages** (plan §5.3): `idea` → `build` → `review` → `approved` →
  `scheduled` → `posted`. Stages belong to pieces only.
- **Birth snapshot at build/publication (S15):** resolved costume, pillar job,
  goal mapping, gate version, strategy version. Later corrections append dated
  amendments; the analytical birth record is never overwritten.
- **Platform/format resolution (S17):** one of each per piece; distribution
  records reference a channel.

### 7.3 Channel (S17)

An entry in `work-log/creation/channels/`, tied to exactly one platform entry.
Carries account identity, ownership, connection state, account timezone, and
posting permissions. The publishing switch reads posting permissions; the
metric pipe reads connection state and timezone.

### 7.4 Curated parameter (S11)

Every value inside `context/personal-details/` and
`context/business-details/` carries: source references (which answer or
transcript produced it), curator, timestamp, confidence state, and supersession
history. **Raw answers in `context/intake/answers/` are never altered** —
history `append_only`. Curated parameters are
`mutable_with_supersession`.

### 7.5 Metric observation (S3, S6, S7, S23)

BODY-owned, immutable, in `work-log/analysis/study-own-data/`, physically the
`ig_*` tables plus their generalization to future platforms.

- **Append-only snapshots** carrying: account timezone, fetch time, platform
  post id, metric-definition version, connection status, retry/backfill state,
  last successful sync, deletion markers (S7).
- **Stored by age since publication**, so comparisons only ever run across
  equivalent windows — first 24h / 7d / 30d — with minimum counts and exposure
  thresholds; below them an explicit "not enough comparable data" state (S6).
- **Coverage gaps stay visible** so missing data is never read as poor
  performance (S7). This is not theoretical: collection has been stalled since
  2026-07-12 and that stretch must render as a gap, never as a slump.
- **Observed platform metrics and attributed business outcomes stay separate**
  (S23). A cross-system conversion claim displays only with a declared event
  source and attribution method; otherwise it is labeled unknown.
- The engine computes from these and never owns them (S3).

### 7.6 Intake round (S10)

`context/intake/` holds VERSIONED rounds. A round records: which parameters it
asked for, delivery mode (dashboard questionnaire or recorded Finding
Session), status (`not sent` / `sent` / `answered` / `curated`), and curation
per parameter. Intake retires from navigation once curated, but she can reopen
a versioned round for selected parameters at any time (S10). Questions are
GENERATED from the detail folders' parameters, never authored inside intake
(plan §3.1).

### 7.7 Review configuration (S20)

Per profile, in `context/content-strategy/working-mode/`: allowed verdicts
(approve / in-scope revision / supply material / reject / scope change),
revision rounds, review-window deadline **with timezone**, reminders,
delegated approvers, and a silence rule. Out-of-scope asks auto-route to
`work-log/logs/changes/`. **Deadlines bind CLIENT windows only — never timers
on her** (S20 as adjusted).

### 7.8 Rights record (S21)

Every asset in `work-log/assets/sets/` and every item in
`context/content-strategy/proof-library/` carries: ownership, consent,
permitted platforms and uses, expiry, attribution, subject releases,
restriction status. **A gate blocks publication when a required right is
absent.**

### 7.9 Outside-tool handoff (S18)

`work-log/creation/making/` records, per handoff: immutable piece id, brief
version, destination tool, exported-at, expected deliverable, returned
asset/version, import status, supersession chain. The Canva Connect code
(`lib/canva.ts`, `app/api/canva/*`) is the existing precedent and becomes the
first implementation of this contract rather than a special case.

### 7.10 Matched comparison (S5, S6)

An analysis object, not a content object: hypothesis, held variables, changed
variable, posting windows, account baseline, confounders. Verdicts are phrased
as **directional evidence, never causation**. The screen may still say
Compare. Today's `ContentCard.experiment { hypothesis }` migrates into this
shape with every other field marked unknown.

### 7.11 Context packet (S12)

The context bundle is the source of truth; each model request receives an
assembled, VERSIONED packet (mandatory constraints + the relevant folders).
Model, packet contents, and context version are logged per output. Declared
here so both engines share one packet contract; the assembly rules belong to
the engine specs.

### 7.12 Feedback item (S13)

Classified by scope: piece · seed · profile rule · candidate strategy change.
Durable changes land as **proposed diffs requiring her acceptance**; the
original feedback and her decision are both preserved. Routing targets are the
ones plan §5.1 names: voice feedback → `voice/`, seed feedback → the seed,
format feedback → the platform's `rules/`, performance feedback → costume
recommendations.

### 7.13 Gate set (S14)

A versioned v1 gate set is derived from strategy and locked WITH strategy,
before creation opens. Five brand gates derived from `voice/` and
`positioning/` (never a separate questionnaire, per plan §5.1 item 3) plus the
two fixed operational gates (accuracy, format). Gate versions apply forward
only; old pass records are never rewritten.

---

## 8. The address map — every existing feature

Column meanings: **Today** = where it lives now. **Writes** = its address, the
folder it owns or feeds. **Reads** = folders it consumes. **Switch** = what it
registers. **State** = its disposition after the restructure, using S9's
vocabulary plus `frozen` (retained, read-only, not rendered, not migrated) and
`leaves` (plan §7 — exits the dashboard).

### 8.1 Profiles and access

| Today | Writes | Reads | Switch | State |
|---|---|---|---|---|
| `clients[]`, `app/clients` (client list home) | profile registry | every profile's status only | `shelf.profiles` (fixed) | active — becomes the shelf (plan §2) |
| `clientData{}` | per-profile `body` | — | n/a (container) | active |
| `lib/access.ts` role filtering | — | switch registry, lifecycle, `client_door` | `fixed` | rewritten (§6) |
| `RESTRICTED_MATCHERS` name regexes | — | — | — | deleted — replaced by profile-id bindings |
| `lib/auth.ts` passcode + cookie | — | profile bindings | `client_access.login` | active; per-profile revocation joins lifecycle (S22) |
| `app/me` My Day — client-task half | `work-log/logs/tasks/` (per profile) | every profile's `logs/tasks/` | `shelf.today_strip` | active — the one cross-profile window (plan §2) |
| `app/me` My Day — personal half, day tracking | — | — | — | **leaves** (plan §7) |

### 8.2 context/intake

| Today | Writes | Reads | Switch | State |
|---|---|---|---|---|
| `onboarding[]`, `OnboardingView`, `client/[id]/onboarding` | `context/intake/answers/` as **round 0** | `context/intake/questions/` | `intake.questionnaire` | active; legacy Q&A imported immutable (S11), questions marked legacy and flagged for regeneration from parameters (plan §3.1) |
| spec 08's 16-question sheet (never built) | `context/intake/questions/` | detail-folder parameters | `intake.questionnaire` | absorbed — the parameter inventory is owed by her vocabulary session (§12 Q4) |
| recorded meeting / Finding Session (no code today) | `context/intake/answers/`, recording → `work-log/assets/` | — | `intake.finding_session` | declared, unbuilt |
| — | versioned reopen of a round | — | `intake.rounds_reopen` | declared (S10) |

### 8.3 context/personal-details and business-details

| Today | Writes | Reads | Switch | State |
|---|---|---|---|---|
| her curation (no code today) | `personal-details/*`, `business-details/*` | `intake/answers/` | `fixed` (owner-only, always on) | to build; every value carries S11 provenance |
| `brand.services[]` (Brand tab) | `business-details/offers/` (one marked hero) | — | `fixed` | migrated |
| `brand.audience` | `business-details/audience-raw/` **and** `content-strategy/audience-decided/` | — | `fixed` | migrated with `confidence: legacy-unverified` — the raw/decided split does not exist in the old field |
| `coldCalls[]` response notes (market signal) | `business-details/market/` (read-only reference) | — | `logs.pipelines.cold_calls` | see §8.9 |

### 8.4 context/content-strategy

| Today | Writes | Reads | Switch | State |
|---|---|---|---|---|
| `pillars[]` (`ContentPillar`: name, color, `job`, `targetPct`, `purpose`, `jobChangedAt`) | `content-strategy/pillars/<pillar>/` — job · mix target · description · seed examples | — | `fixed` | migrated as entry folders (law 2). `jobChangedAt` becomes the job-regime version consumed by S15 snapshots |
| `platforms[]` (string list), `DEFAULT_PLATFORMS` | `content-strategy/platforms/<platform>/` — `how-it-works/` `formats/` `rules/` `connection/` | — | `platforms.<platform>` | migrated; **the cascade parents.** A format has no existence outside its platform (plan §3.4) |
| `DEFAULT_CONTENT_TYPES`, `ContentCard.contentType` | `platforms/<platform>/formats/` | — | inherits platform switch | migrated: the global format list is split per platform; a piece resolves ONE (S17) |
| `brandKit` (colors, fonts, logos), `BrandView` | `content-strategy/visual-branding/` | — | `strategy.visual_branding` (fixed) | migrated |
| `brand.tagline`, `brand.strategy` | `content-strategy/positioning/` | `personal-details/`, `business-details/` | `fixed` | migrated as legacy text pending derivation |
| `goals[]` (`ClientGoal`), `journey.northStar`, `targetValue`, `targetDate` | `content-strategy/goals/` | — | `fixed` | migrated. **Each goal must carry an S16 metric declaration** (metric ids, direction, calculation, denominator, window, target, platform availability, not-measurable fallback) before any analysis reads it |
| `postTarget` | `content-strategy/cadence/` | — | `fixed` | migrated |
| working mode / posting ownership (no code today) | `content-strategy/working-mode/` incl. the S20 review configuration | — | `fixed` | to build |
| — | `content-strategy/toolset/` — the switch registry | strategy folders | `fixed` | to build (§5) |
| — | `content-strategy/proof-library/`, `boundaries/`, `ctas/`, `funnel-shape/`, `voice/`, `obligations/` | `personal-details/`, `business-details/` | `fixed` | declared by the plan, no code today; addresses reserved so later specs cannot invent second homes |
| gate config (no code today) | `content-strategy/` gate set, versioned | `voice/`, `positioning/` | `fixed` (S14) | to build |
| `customFields[]` / `customValues{}` | — | — | — | **frozen.** Free-form per-client fields contradict law 2 (every variable is a folder). Existing values stay readable; new equivalents must be declared paths |

### 8.5 work-log/creation — seeds and pieces

| Today | Writes | Reads | Switch | State |
|---|---|---|---|---|
| `topics[]` (`Topic { id, name }`, spec 04) | **seed-capture input** to `creation/topics/` | — | `creation.engine` | migrated as INPUT, not as seeds (S24). Each becomes a `draft` seed shell requiring her narration before it can be locked |
| `evergreenIdeas[]`, `EvergreenView` (route already retired) | seed-capture input | — | `creation.engine` | same treatment; loose subjects are never peer entries |
| `contentCards[]` (`ContentCard`), `ContentView` Board/Pillars/Table, `CardEditor` | `creation/` — the canonical **piece** | `pillars/`, `platforms/`, `voice/`, `visual-branding/`, `assets/`, `references/` | `creation.board` | active. Stage mapping: `idea`→`idea`, `writing` (Making)→`build`, `ready`→`approved`, `scheduled`→`scheduled`, `posted`→`posted`. **`review` is a new stage with no legacy data** — mapping `ready` to `approved` is honest: today "ready" means she is done, no client verdict was ever recorded |
| `cards[]` (legacy `KanbanCard`), `KanbanView`, `client/[id]/kanban` | — | — | — | **frozen** — the dormant safety copy from the 2026-07-10 migration. Do not read, do not migrate twice (`lib/migrateContent.ts` already did it) |
| `pillarCards[]` (legacy `PillarCard`), `PillarsView`, `client/[id]/pillars` | — | — | — | **frozen**, same reason |
| `ContentCard.topicId` (Repurpose) | piece → seed reference | `creation/topics/` | `creation.engine` | migrated as the seed reference on the piece (S1: pieces reference seeds) |
| `ContentCard.experiment { hypothesis }` | `analysis/` matched comparison | — | `analysis.compare` | migrated to the S5 shape, unknown fields marked unknown (never inferred) |
| `ContentCard.role` (`brand`/`value`/`general`) | — | — | — | **frozen.** Pillar jobs superseded it (spec 04 → plan §5.3 "Job") |
| the Content Engine room (nothing built; spec 19 → plan §5.1) | `creation/topics/`, `creation/making/` | the whole context bundle (S12) | `creation.engine` | later spec family; address reserved |
| client bringing ideas (no code today) | `creation/topics/` seed-capture input | — | `creation.seed_input_client` (client door: give-point 1 extension via working-mode) | declared; default off |

### 8.6 work-log/creation — making, review, scheduling, distribution

| Today | Writes | Reads | Switch | State |
|---|---|---|---|---|
| draft body on the card (`content`, `hook`, `link`) | `creation/making/` as versions of the piece | `voice/`, `visual-branding/`, `assets/`, `references/` | `creation.making` | active; versions kept (today they are overwritten) |
| `lib/canva.ts`, `app/api/canva/*` (parked, needs an OAuth app) | `creation/making/` handoff record (S18) | the piece's brief | `creation.making_handoff` | declared; stays parked until the OAuth app exists |
| `StudioComposition[]`, `StudioView`, `StudioFreeform`, `StudioTemplates`, `client/[id]/studio` (tab already removed) | — | — | — | **frozen.** Plan §3.10: making expects the outside-tool round-trip; an in-dashboard design canvas is not the direction |
| `previewPosts[]`, `PreviewsView`, `InstagramPost`, `app/p/[shareId]`, `app/api/share` | `creation/review/` | the piece, `instagram` identity | `creation.review` (client door: give-point 3) · `creation.review_public_link` | active. **The public-link switch has NO suggested default — see §12 Q2** |
| client verdict (no structured capture today) | verdict on the piece; out-of-scope asks → `logs/changes/` | S20 review configuration | `creation.review` | to build |
| client perception note at review | `analysis/client-perception/` | — | `creation.review_perception` (client door: give-point 4) | to build |
| `ContentCard.scheduledDate`, calendar/My Day surfacing | `creation/scheduling/` | `cadence/`, `goals/` | `creation.scheduling` | active |
| spec 14B publish-from-dashboard (unbuilt) | `creation/scheduling/`, channel | channel posting permissions (S17) | `creation.publishing` | declared; validation refuses it where the client posts |
| `instagram` (`InstagramProfile`), `ig_accounts` identity, `ConnectionsView`, `app/api/ig-accounts` | `creation/channels/<channel>` (identity, ownership, timezone, posting permissions) **and** `platforms/instagram/connection/` (API status) | — | `creation.channels` · `platforms.instagram` | migrated — the one record splits into channel identity vs platform connection (S17) |
| `journey.channels[]` (`JourneyChannel { name, note }`) | `creation/channels/` notes | — | `creation.channels` | migrated |
| `leadAnswers[]`, `AnswersView`, `lib/divineLeadSeed.ts` | `creation/funnel/replies/` (law-4 addition, §11) | `ctas/`, `boundaries/`, `offers/` | `creation.funnel_replies` | active — the scripts the body holds (plan §1). Not analytics (S23) |
| funnel chaining (no code today) | `creation/funnel/` | `funnel-shape/`, `ctas/` | `creation.funnel` | declared |
| `lib/igShortcode.ts`, spec 14A auto-mark-posted matcher | `ig_post_links` → the piece's live link | `ig_posts` | `analysis.tracking` | active; the join that keeps ONE piece identity (S2) |

### 8.7 work-log/assets and references

| Today | Writes | Reads | Switch | State |
|---|---|---|---|---|
| `assetSets[]`, `assetItems[]`, `AssetsView`, `app/api/upload`, `upload/sign` | `assets/sets/` | — | `assets.library` · `assets.client_upload` (client door: give-point 2) | active; every item gains the S21 rights record |
| `driveFolderUrl` (Videos tile) | `assets/sets/` external reference | — | `assets.drive_videos` | active |
| `app/share-target` (Android share-to-save) | `assets/sets/` | — | `assets.share_target` | active; still Android-only (CLAUDE.md gotcha 4) |
| WhatsApp photo routing (`lib/whatsappInbox.ts`, parked) | `assets/sets/` "WhatsApp" set | — | `assets.whatsapp_intake` | parked (spec 18B) |
| `catalogueCategories[]`, `catalogueItems[]`, `CatalogueView`, PDF export | `assets/sets/` + a selection/export capability | `assets/sets/` | `assets.catalogue_export` | active — plan §7: the catalogue becomes an assets use-case behind a switch, it does not die |
| `references[]`, `ReferencesView` | `references/our-vision/` by default, `references/from-client/` where the source is known | — | `references.our_vision` · `references.from_client` (client door: give-point 2 lane) | active. Legacy rows carry no source signal, so they migrate to `our-vision/` marked `source: unknown` with a one-time sort queue — **never attributed to the client without evidence** |

### 8.8 work-log/logs

| Today | Writes | Reads | Switch | State |
|---|---|---|---|---|
| `monthData[month].agenda[]`, `DashboardView` | `logs/tasks/` | — | `logs.tasks` | active |
| `personalTasks` with `taskType: 'client-task'` + `linkedAgenda` (spec 01) | `logs/tasks/` (one truth, two views) | — | `logs.tasks` · `shelf.today_strip` | active — the sync stays, re-addressed |
| `personalTasks` with `taskType: 'content'` + `linkedCards` | the piece's stage | `creation/` | `logs.tasks` | active — the task reads the piece, never copies it (S2) |
| `personalTasks` with `taskType: 'personal'` | — | — | — | **leaves** (plan §7); frozen export bundle to the vault |
| chat/WhatsApp `#client #task` routing | `logs/tasks/` | — | `logs.tasks` | active where the capture route is on |
| decisions (no structured home today) | `logs/decisions/` | — | `logs.decisions` | to build |
| special demands / non-standing asks | `logs/requests/` | — | `logs.requests` | to build; S19 — these arrive through the four doors or through her, never a fifth workflow |
| standing-agreement changes; out-of-scope review asks (S20) | `logs/changes/` | — | `logs.changes` | to build |
| `lists[]`, `listRows[]`, `ListsView`, spec 12 sharing (`sharedWith`/`sharedFrom`) | `logs/pipelines/<pipeline>/` (law-4 addition, §11) | — | `logs.pipelines.lists` | active; the cross-profile share window keeps its server-side verification |
| `coldCalls[]`, `ColdCallsView` | `logs/pipelines/cold-calls/` | — | `logs.pipelines.cold_calls` | active |
| `orders[]`, `OrdersView` (Sonia) | `logs/pipelines/orders/` | — | `logs.pipelines.orders` | active |
| `momentum` (`MomentumData`, spec 11), `MomentumMeter`, `app/api/momentum-read` | `logs/effort/` (law-4 addition, §11) | posted pieces (auto-count) | `logs.effort_meter` | active **only where `owner_kind: hers`** (plan §7) |
| `momentum.monthlyValue`, `extraValue` (spec 16 Money meter) | `logs/effort/` | `logs/effort/` | `logs.effort_money` (requires `logs.effort_meter`) | same restriction |
| `observations[]`, `ObservationsView` — entries WITH a client tag | `logs/observations/` (law-4 addition, §11); owner audience only | — | `logs.observations` | active per profile |
| `observations[]` — entries with NO client tag | — | — | — | **unresolved — §12 Q1.** No migration until answered |

### 8.9 work-log/analysis

| Today | Writes | Reads | Switch | State |
|---|---|---|---|---|
| `app/api/ig-sync`, `vercel.json` cron (9:00 IST) | `analysis/study-own-data/` observations (`ig_posts`, `ig_daily_snapshots`, `ig_account_snapshots`) | channel connection + timezone | `analysis.tracking` | active; gains every S7 field. **Recording is the engine's first duty (plan reconciliation) — this does not wait for the restructure, and the 2026-07-12 stall is fixed before it** |
| `ig_post_links` (spec 03) | piece ↔ platform post join | `creation/` | `analysis.tracking` | active |
| `ig_post_tags`, `app/api/ig-tag` (spec 06 AI tagging) | reading-layer tags | `ig_posts` | `analysis.ai_tagging_fallback` | active as FALLBACK only — the piece's own pillar/costume is the primary tag source (plan §5.2) |
| `app/api/ig-metrics`, `app/api/analytics`, `AnalyticsView`, `client/[id]/analytics` (specs 03–06) | — | observations, `pillars/`, `goals/` | `analysis.scorecard` · `analysis.funnel` · `analysis.bifurcation` | active; re-cut to these addresses by the Analysis Engine spec family (plan §5.2) |
| `journey.checkIns[]`, `JourneyView` goal card | `analysis/goal-tracking/` | `content-strategy/goals/` | `analysis.goal_tracking` | migrated; blocked per goal until that goal has its S16 declaration |
| `journey.nextSteps` (plain text) | — | — | — | **frozen.** Already rejected once ("she wants data, not text sections") |
| content mix vs pillar targets (computed) | — | `pillars/`, pieces | `analysis.scorecard` | active — each pillar judged only on its job's metrics |
| compare / A-B (nothing built) | `analysis/` matched comparisons | observations by age window | `analysis.compare` | declared — plan §5.2 calls this the engine's actual purpose |
| spec 07 monthly digest (specced, unbuilt) | digest records | everything in `analysis/` | `analysis.digest_owner` · `analysis.digest_client` | declared; the client digest is drafted then approved or edited by her (curation rule, CLAUDE.md rule 1) |
| client perception (no structured home today) | `analysis/client-perception/` | — | `creation.review_perception` | to build; recorded, never fed into verdict math (plan §5.2) |
| DMs, inquiries, attribution counts, her remarks | `analysis/client-perception/`, `logs/observations/` | — | `analysis.soft_signals` | soft signals: recorded lightly, outside the engine's math |
| market research (nothing) | `analysis/market-research/` | `business-details/market/` | `analysis.market_research` | declared, parameters deliberately open (plan §5.2, law 4) |

### 8.10 Capture routes and owner-level surfaces

| Today | Writes | Reads | Switch | State |
|---|---|---|---|---|
| `ChatWidget`, `chatLog[]`, `app/api/chat-brain` (v4 built, undeployed) | routes into `logs/tasks/`, `creation/` pieces, `logs/observations/` | clients, topics, unposted pieces | `owner.chat` | active as a ROUTE; the thread's own home is **unresolved — §12 Q1** |
| `app/api/whatsapp`, `lib/whatsappInbox.ts`, `app/api/inbox-topic` (spec 18B) | same targets as the chat | — | `owner.whatsapp_inbox` | parked, unchanged (registration dead-ended at Meta's PIN step) |
| `brainDump`, `BrainDumpView`, `app/brain` | — | — | — | **leaves** (plan §7) — the vault already holds thinking |
| `containerMap`, `ContainerMapView`, `app/map`, `lib/containerSeed.ts` | — | — | — | **leaves** (plan §7) |
| `app/api/state` | the path-scoped patch door | declarations | `fixed` | rewritten (§3.4) |
| `app/api/debug-preview` | — | — | — | frozen / removed at build time |

### 8.11 The orphan check

Every slice of `AppState` and `ClientData`, every component, every route, and
every `ig_*` table appears exactly once above. That is the test this section
has to pass, and it is re-run by the validator: an undeclared slice fails the
build (law 4). Three dispositions carry no address on purpose — `leaves`
(plan §7), `frozen` (retained read-only), and the two rows marked unresolved
in §12 — and each is named explicitly rather than left silent.

---

## 9. Migration

Ordered, versioned, and boring on purpose.

1. **Back up first.** Export the current blob and every `ig_*` table before the
   first write. The restructure is one-way; the backup is the undo.
2. **Declarations before data.** Ship the declaration registry, the switch
   registry, and the validator with an empty tree. Nothing migrates until the
   validator passes on the declarations alone.
3. **Path-scoped writes** (§3.4) land before any profile is migrated. Doing this
   after would corrupt the append-only guarantees mid-flight.
4. **One profile at a time, pilot first** (plan §8 step 8). The pilot is one of
   her own profiles (`owner_kind: hers`) — a client profile is never the
   experiment.
5. **Per profile:** create the body at `body_version: 21`; migrate in tree
   order (context, then work-log); write a migration report listing every value
   moved, every value marked `confidence: legacy-unverified`, and every value
   that needs her sort (the references source queue, the seed-capture shells).
6. **Switches are NOT auto-set.** Migration derives SUGGESTED positions from
   what the profile actually has (a profile with only Instagram content gets
   `platforms.linkedin: hidden` suggested) and leaves them unset until she sets
   them, per the plan's order: intake → curation → strategy → switches →
   creation. A migrated profile keeps rendering what it renders today until she
   sets its switches.
7. **Nothing is deleted.** `frozen` slices stay in the blob at state `history`.
   `leaves` slices are exported to the vault and then, only on her word,
   removed.
8. **Verification per profile:** the acceptance tests in §10 run against that
   profile's real data before the next one starts.

---

## 10. Acceptance tests

1. **The proof walk (plan §3.9).** One seed → piece → making → review →
   scheduling → posted → analysis → loop-back, on real data, with **zero
   repeated typing**. If any station asks for something already known, the
   restructure failed.
2. **The growth test (law 3).** Add a fourth pillar and a new platform with its
   formats. Both appear immediately in the seed picker, the mix math, the
   scorecard, scheduling, and channels — with no code change and nothing blank.
3. **The cascade test (plan §3.4).** `platforms.linkedin → hidden` removes
   LinkedIn's formats, strategy questions, channel, and analysis column on both
   sides; flipping it to `history` keeps every past LinkedIn piece and its
   metrics readable. Reverse the trace with Instagram and it must behave
   identically.
4. **The no-address test (law 4).** A read or write against an undeclared path
   fails the build.
5. **The no-switch test (plan §6 rule 3).** A feature with no registered switch
   fails the build.
6. **The no-fifth-door test (S19).** A client write to anything outside the four
   give-points is refused server side. Re-run spec 12's 19-check security test
   against the new resolver.
7. **The one-truth test (S2, plan §3.11).** No second copy of a piece exists
   anywhere; every stage view resolves to the same identity.
8. **The honesty test (S6, S7).** The 2026-07-12 → present collection gap
   renders as a coverage gap, and comparisons below the thresholds say "not
   enough comparable data" instead of ranking.
9. **The append-only test (S11, S15).** A curated parameter edit supersedes and
   keeps history; a piece's birth snapshot cannot be overwritten; a raw intake
   answer cannot be altered at all.
10. **The save-race test.** Two concurrent writes to different paths both
    survive.

---

## 11. Law-4 additions born in this spec

New folders, each declaring its feeds and readers at birth (law 4). They live
INSIDE existing spine folders, so law 1 is intact. Listed here for the control
room to ratify into PLAN §3:

| Path | Why | Fed by | Read by | Switch |
|---|---|---|---|---|
| `work-log/creation/funnel/replies/` | The reply scripts the body holds (plan §1) — Divine's Lead Answers today | her | whoever answers DMs; the funnel view | `creation.funnel_replies` |
| `work-log/logs/pipelines/` | Per-profile operational pipelines with their own stages: Lists (spec 12, incl. sharing), Cold Calls, Orders. Plan §7: everything else live today gets an address, not a verdict | her; client roles where shared | her day view; the profile's pipeline views | `logs.pipelines.*` |
| `work-log/logs/effort/` | Her effort/money meter (specs 11, 16), which plan §7 keeps only in her own profiles | her daily log; posted pieces (auto-count) | the meter, her eyes only | `logs.effort_meter`, `logs.effort_money` |
| `work-log/logs/observations/` | Her per-profile private notes (spec 18A) — plan §5.2 names her observations as soft signals kept in `logs/` | her; the chat/WhatsApp capture routes | her, directly; never the engine's math | `logs.observations` |

---

## 12. Open questions — the plan cannot answer these

Per the working structure (plan §6), a question a fresh spec chat cannot answer
from the vault is a HOLE in the plan, not something to guess. These are written
into `STATE.md` for the control room. **This spec leaves the affected fields
unset; no build proceeds on the affected paths until they are answered.**

**Q1 — Where do owner-level, cross-profile objects live?** Plan §5.3 says
everything belongs to exactly one profile and the only thing between profiles
is her shelf (whose one cross-profile window is the today strip). But two live
features are cross-profile by design: the floating owner chat thread
(`chatLog`, on every screen per plan §2 item 4) and untagged Observations. They
have no address in the tree, and inventing an owner-level store outside the
frozen spine would be a plan change — her gate. Affects: §8.8 last row, §8.10
first row.

**Q2 — Do public, unauthenticated preview links survive?** Review is a
give-point inside the client's profile (plan §4), and S19 says the four doors
are the only client doors. Today review happens through anonymous links
(`app/p/[shareId]`). Is a public link an allowed DELIVERY route into the review
door, or must review happen only inside a client login? Affects:
`creation.review_public_link`, whose suggested default is deliberately blank.

**Q3 — How do people bind to a profile?** The plan says a client login opens
its own profile only, but never says how many client users a profile may have.
S20 requires "delegated approvers", which implies more than one. Does a
delegated approver get their own login, and may one person hold logins to two
profiles? Affects: §6, and the shape of the profile bindings that replace the
name-regex matchers.

**Q4 — The parameter inventory.** Intake questions are generated FROM the
detail folders' parameters (plan §3.1), and the plan records that her
vocabulary session for the finite word lists is still owed. This spec ships the
declaration CONTRACT for parameters; the inventory itself cannot be written
without her. Confirm the split: spec 21 = contract, intake spec = inventory,
after the vocabulary session.

**Q5 — Retention and deletion authority (S22).** Profile lifecycle declares
retention and deletion authority per state. Those values are hers (and adjacent
to her money/external-accounts gate: connector revocation). This spec declares
the fields with no defaults. What are the retention windows, and who may delete
a profile's data?

---

## 13. Deliberately untouched

- The GUI. No screen changes in this spec (plan §2's redesign is its own spec).
- Both engines. Addresses reserved, mechanisms out of scope (plan §5).
- Spec 18B WhatsApp. Parked, unchanged.
- The deploy path. DEPLOY.md and CLAUDE.md rule 6 stand: her explicit go, every
  time.
- The setup day and the IG collection stall. These do NOT wait for the
  restructure — recording is the engine's first duty and every day not recorded
  is gone.
