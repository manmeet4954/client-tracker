# 24 — Content Engine II — Costume, Briefs & Format Rules

**Status:** BUILT, NOT DEPLOYED (2026-07-27). Built in §14.6's order; all 19 acceptance tests in §15 green alongside specs 21, 22 and 23's 132 (207/207), typecheck clean, production build green. Build record in `dashboard/STATE.md`. The one input this spec waits on (§17, her spend ceiling) is untouched by the build, as the spec says: `cost_estimate_usd` is written from run one and nothing throttles anything. Second spec of the Content Engine family (PLAN §5 — "each engine gets its own separate family of specifications"). Written in a fresh chat per PLAN §6's working structure, from the vault only: `PLAN.md` (including section 10, the Sol Amendments), `specs/21 — Data-Layer Restructure.md`, `specs/22 — Intake & Context.md`, `specs/23 — Content Engine I — Seed Bank & the Engine Room.md`, and `raw/ResumeGuru Seed Taxonomy (Sol).md` as the living example.

**Authority:** `PLAN.md` outranks this file. Where this spec and the plan disagree, the plan wins. Where an amendment in plan section 10 touches anything below, the amendment wins. Spec 21 is the data-layer contract underneath: its canonical `Piece`, `ResolvedCostume`, `BirthSnapshot`, `HandoffRecord`, `RightsRecord`, `GateSet`, `FeedbackItem` and `MatchedComparison` objects, its declaration contract, its switch registry, and its path-scoped write door are used exactly as they are. **This spec invents no second version of anything spec 21 declared.** The additions it genuinely needs are listed in §5.5 and nowhere else, each with its reason.

**Where it starts and where it stops.** Spec 23 ends at a locked seed with a **Make a piece from this** button and the `canMotherPieces` guard behind it. This spec is what is behind that button. It ends at a **piece existing in build state, carrying its brief and its materials**. Drafting the copy itself and the seven quality gates are **spec 25**.

**What it delivers, in one line:** a locked seed gets dressed, every combination she sends to build becomes one candidate piece with a birth record that can never be rewritten, and the engine writes the brief before a single line of copy exists.

---

## 1. What this spec is, and is not

**It is:**

1. **The costume surface** — the request layer of the Engine Room (PLAN §5.1 layer 3): pickers for pillar, objective, audience stage, angle, hook type, platform, format, length, product intensity, CTA, voice, and proof. Multi-select everywhere, because she is exploring, not filling a form.
2. **S4 resolution** — the step that turns an exploration into work: each combination she sends to build becomes ONE candidate piece with exactly one value per dimension, and every piece takes its S15 birth snapshot at that moment.
3. **The internal brief** — the small brief PLAN §5.1 puts BEFORE any copy: the one point, the tension, the realization, the takeaway, product's role, tone, ending, what to leave out. A real model call, grounded per S12, logged to `engine-runs` per output.
4. **Format rules** — universal per format, stored in the universal engine, with per-profile overrides in that platform's `rules/` folder. Override beats universal, always, field by field.
5. **Build state** — materials attached to the piece by reference, and the outside-tool round-trip under S18's handoff contract, with Canva as the named precedent.
6. **The rights hook** — S21 at the moment a rights-carrying asset or proof item is attached to a piece.

**It is not:**

- **Drafting.** No copy is written by this spec. The brief is not copy and §6.6 has a mechanism that keeps it from becoming copy.
- **The seven gates.** Spec 25. The gate SET is read here so the brief is written toward the gates it will have to pass, but no gate is run and no pass record is written.
- **Publication blocking.** S21's publication block lives with the gates in spec 25. This spec attaches rights-carrying material and records honestly whether it clears; it decides nothing about shipping.
- **The seed bank or seed extraction.** Spec 23.
- **The Analysis Engine.** Its costume recommendations get an address here (§10) so it cannot invent a second home later. Its mechanism is its own family (specs 26, 27).
- **The board, scheduling, review, or distribution.** Those are the body's, already addressed by spec 21. This spec hands a piece to them; it does not run them.
- **The GUI restructure.** This spec describes one surface inside the Creation app and states what it needs from the shell.

---

## 2. Where this sits, and what it needs first

### 2.1 Order

PLAN §8 step 6: data-layer restructure → intake → Content Engine → Analysis Engine → client-side regroup. Inside the Content Engine family: spec 23 (the seed bank and the room), then this spec, then spec 25 (drafting and gates). **This spec builds after spec 23**, because it consumes `canMotherPieces`, `resolveSeed`, the `engine-runs` path, the `feedback` path, and `ProfileBody.context_version`, all of which spec 23 ships.

### 2.2 What must be true before this builds

| Precondition | Comes from | If missing |
|---|---|---|
| Spec 21 deployed, path-scoped writes live | done (deploy `a65079a`) | blocked — S15's "never overwritten" is a lie under last-write-wins |
| Spec 23 built: `canMotherPieces`, `resolveSeed`, `engine-runs`, `feedback`, `context_version` | spec 23 §14.3 | blocked — this spec writes no second version of any of them |
| At least one **locked** seed on the profile | spec 23 §6.5 | the surface opens on nothing. The **Make a piece from this** door is already disabled with its reason |
| The profile's strategy LOCKED (`strategy_version` non-null) | spec 22 §8.6 | **the costume surface cannot write.** Spec 22 §8.7 refuses any write under `work-log/creation` on a profile that has never locked. See §2.4 |
| A gate set at v1 | spec 22 §8.4 (S14) | the brief has no gates to write toward; it runs with that block absent and says so in the run log |
| `ANTHROPIC_API_KEY` set in Vercel | set (verified 2026-07-26) | the surface resolves pieces normally, she writes the brief by hand, the brief button is disabled with a plain reason. Nothing fabricates a brief (§15 test 10) |

### 2.3 What a profile's lifecycle grants

Per S22 and spec 21 §6: `setup` — the costume surface is **not rendered** (creation cannot open until strategy locks). `active` — everything in this spec works. `paused`, `closing`, `archived` — the surface opens read-only: existing pieces, briefs, and handoffs browse; nothing resolves, no brief runs, no material attaches.

### 2.4 The consequence nobody should be surprised by

ResumeGuru is migrated but has never locked a strategy. Spec 22 §8.7 exempts migrated profiles' **legacy** slices, not new writes through the tree. So **the costume surface does not open on ResumeGuru until she walks it through curation → derivation → switches → lock.** That is PLAN §3.4's order (intake → curation → strategy → switches → creation) working exactly as written, and it is why the birth snapshot can promise a real `gate_version` and `strategy_version` instead of two nulls. It is stated here, plainly, because it is the one thing about this spec that will feel like a wall.

---

## 3. The costume surface — the request layer of the Engine Room

### 3.1 The law it is built against

PLAN §3.10, on record and binding: *"the engine is not a form that pushes you to the next step. It is a separate, powerful space to brainstorm in — you sit with the topic, you see the pillars fitted inside the platforms, the formats, and you SELECT; only then does the entry go into build state."* And PLAN §5.1 item 1: *"The costume pickers must allow selecting MULTIPLE values."*

So: **no wizard, no step counter, no next chain, no required field until the resolve step.** She can open the surface, move eight pickers, look at the grid, and leave without writing anything. She can pick one value in one dimension and send one piece to build. She can also ignore this surface entirely and make a card by hand on the board — that path is spec 21's and this spec does not close it.

### 3.2 Where it opens

From spec 23 §7.3's **Make a piece from this**, on a locked seed. Route: `creation/engine/costume/<seed id>` inside the profile. The seed sits at the top, read-only, showing its raw thought, core message, and reframe — because the whole point of the costume is that the understanding is already done and nothing is re-explained.

Desktop: the seed on the left, the dimensions as a column of multi-select rows in the middle, the variant grid (§5.1) on the right, updating live. Mobile: seed collapsed to one line, dimensions stacked, the grid as a bottom sheet.

### 3.3 The twelve dimensions, and where each one reads from

Every list is either a finite universal list stored in the universal engine (§4) or a folder in this profile's `content-strategy/`. Nothing is hard-coded per client — PLAN §1's one sentence, applied.

| # | Dimension | Reads from | Multi-select | Resolves to |
|---|---|---|---|---|
| 1 | **Pillar** | `context/content-strategy/pillars/` (active entries) | yes | exactly one |
| 2 | **Objective** | universal list (§4.1) | yes | exactly one |
| 3 | **Audience stage** | universal list (§4.1) | yes | exactly one **primary** (S4's word) |
| 4 | **Angle** | universal list (§4.1) | yes | exactly one |
| 5 | **Hook type** | universal list (§4.1) | yes | exactly one |
| 6 | **Platform** | `context/content-strategy/platforms/` — `active` entries only | yes | exactly one (S17) |
| 7 | **Format** | THAT platform's `platforms/<p>/formats/` — nothing else | yes | exactly one (S17) |
| 8 | **Length** | the resolved format rule's declared length bands (§7.1) | yes | exactly one |
| 9 | **Product intensity** | universal list (§4.1) | yes | exactly one |
| 10 | **CTA** | `context/content-strategy/ctas/` | yes | exactly one (S4) |
| 11 | **Voice** | `context/content-strategy/voice/` | yes | exactly one |
| 12 | **Proof** | `context/content-strategy/proof-library/` | yes | **stays a set** — see §5.3 |

**Format lives inside its platform, and the surface makes that structural, not a convention.** Until a platform is picked, the format picker is empty and says so: *"Pick a platform first. Formats live inside platforms."* Pick two platforms and the format picker shows two groups, each holding only its own platform's formats, and a format can never be selected under the wrong platform. This is PLAN §3.4's law rendered rather than remembered.

**Voice, when a profile has one.** Most profiles declare one decided voice. The picker then shows one option and resolves it automatically. It is still a dimension, it is still snapshotted, and the day she declares a second register it appears here with no code change — law 3.

**Length is not a universal list.** A reel's length is seconds and a carousel's is slides; there is no single vocabulary. Length options come from the resolved FORMAT RULE (§7.1), which is universal and per-profile overridable. This is exactly PLAN §5.1's own override example — *"ResumeGuru carousels run shorter, bite-size slides"* — so the plan already decided where length lives; this spec just says it out loud.

### 3.4 What the surface shows without being asked

Hints, never rails. Each is a line she can ignore, each cites where it came from.

- **The seed's own suggestions.** `possible_pillars` and `possible_angles` from the seed (spec 23 §6.1) are marked in the pillar and angle pickers as *"this seed suggests"*. This is the ResumeGuru taxonomy's seed-to-expression matrix made live: a seed whose primary lane is Career OS with the AI Lane secondary shows exactly that, from the seed's own fields, with no second document.
- **The mix.** When she hovers a pillar, one line: this month's actual share against that pillar's `mix-target`. The taxonomy's 40 / 25 / 20 / 15 guardrail is a `mix-target` value, not a rule in code.
- **Proof this seed needs.** If the seed carries `proof_required[]`, those items are pre-marked in the proof picker. If the seed needs proof that `proof-library/` does not hold, the surface says which is missing, in words, and lets her proceed — the accuracy gate in spec 25 is where a missing proof stops a piece, not here.
- **Costume recommendations from analysis** — §10, address reserved, mechanism not built.

### 3.5 What the surface refuses, and why

Refusals name their reason. Nothing is silently unavailable.

1. **A seed that is not locked.** The door was already closed by spec 23's `canMotherPieces`; the surface never opens on a `draft`, `discussed`, or `validated` seed.
2. **A platform at `history` or `hidden`.** It does not appear at all — PLAN §2: whatever the switches turn off is NOT rendered. Existing pieces on it stay readable.
3. **A format that is not in the chosen platform's `formats/` folder.** Refused at the write door as well as the picker (§15 test 5).
4. **A combination a format rule forbids.** The ResumeGuru rule *"never use carousel as the convert format"* is a real per-profile rule, and it removes a real square from the grid. Such a row renders **refused, with the rule quoted**, not hidden — she needs to know why. She may override it once, for that one piece, with a reason; the override is recorded in the birth snapshot (§5.5) so analysis can see that this piece broke its own rule on purpose. **This spec's ruling, stated rather than smuggled:** a format rule is not a switch, so a rule-forbidden combination is shown-and-explained rather than un-rendered, and the engine serves rather than rails, so she can pass it with a reason on the record.
5. **A write on a profile with `strategy_version == null`** — spec 22 §8.7, server side.

---

## 4. The universal engine — where the costume lists live

PLAN §5.1: *"finite lists, stored in the universal engine."* Following spec 22 §3.3's precedent exactly — the registries are code beside the tree registries; what lives at the paths is data:

```
lib/engine/costume.ts   ← the finite costume lists (§4.1)
lib/engine/formats.ts   ← the universal format library + resolveFormatRule (§7)
lib/engine/resolve.ts   ← S4 resolution, the guards, the birth snapshot (§5)
lib/engine/brief.ts     ← the brief call, its packet, its checks (§6)
lib/engine/handoff.ts   ← the S18 handoff contract (§8)
```

This is what lets the validator check the costume lists against the tree at build time, and it is why a client's costume vocabulary is identical to every other client's while their pillars, CTAs, voices, proof, platforms and formats differ completely. Customization is fuel, not machinery.

### 4.1 The lists, shipped FULL (PLAN §5.1 item 1, Sol's drafts adopted as v1)

| List | Values |
|---|---|
| **Objective** | reach · engagement · trust · education · lead generation · conversion · retention |
| **Audience stage** | unaware · problem-aware · solution-aware · product-aware · existing customer |
| **Angle** | question · contrarian · mistake · founder observation · framework · case study · personal story · before-and-after · tutorial · product demo · myth · warning · prediction |
| **Hook type** | direct claim · question · pain recognition · curiosity · specific result · disagreement · confession · story opening |
| **Product intensity** | none · light mention · natural connection · product-led · direct promotion |

**The vocabulary rule, from PLAN §5.1 item 1, binding:** *"No shortlisting now… Sol's lists stand as shipped options; Claude may add; only she removes, and removal happens through use, not upfront."* So: no list is trimmed in this spec, no list ships with a "recommended" subset, and nothing prunes itself. Removal is a per-profile act — a value she stops using can be hidden for that profile from the surface itself, which writes a `profile-rule` feedback item requiring her acceptance (§7.4), never an edit to the universal list.

Every list ships with a free-text lane. A finite list that cannot be escaped produces false answers (spec 22 §4.7's rule, and it holds here for the same reason). A free-text value resolves like any other and is snapshotted verbatim; it never silently joins the universal list.

### 4.2 The four dimensions that read profile folders

Pillar, CTA, voice and proof are NOT universal lists — they are folders, and law 3 does the rest. Add a fourth pillar, a new CTA, a second voice register, or a new proof item today and it appears in these pickers the moment it exists, with no code change and nothing blank. That is acceptance test 5 and it is the whole reason these are folders rather than fields.

---

## 5. S4 resolution — from exploring to candidate pieces

S4, verbatim and binding: *"Multi-select explores and requests variants; every built piece resolves to exactly one platform, format, objective, primary audience stage, angle, hook type, and CTA. Multiple selections create separate candidate pieces."*

### 5.1 The variant grid

The moment more than one value is selected in any dimension, the grid appears on the right: **every combination, enumerated, one row each.** Each row shows its full costume in plain words and its format rule's headline (*"Carousel, 8 to 10 slides, cover is one hook"*). Above the grid, one count: *"12 pieces."*

Three things make the grid the safety mechanism rather than a display:

1. **Nothing is written until she confirms.** The grid is a proposal. Cancel writes nothing, logs nothing, spends nothing.
2. **Every row can be unchecked.** She explores wide and ships three of the twelve. This is the point of multi-select.
3. **A runaway product is visible before it exists.** Two platforms by three angles by four hooks is twenty-four rows on screen with a count above them. No cap is invented here — the enumeration is the guard, and twenty-four pieces is her call to make with her eyes open.

**The batch-production case, from the living example.** The ResumeGuru taxonomy's batch rule — *"for one seed, record three reels: one reach hook, one trust hook, and one soft-convert hook, keep the same core reframe and payoff"* — is exactly one dimension multi-selected with everything else held. That is not a coincidence; it is what PLAN §5.2 means by *"the costume system is what makes these tests controlled — change ONE variable, hold the rest — and this is the deepest reason the seed/costume structure exists."* See §5.6.

### 5.2 What "send to build" does, per row

For each checked row, in one transaction:

1. `canMotherPieces(seed)` is re-checked at the write door (spec 23 §9.1). A seed unlocked between opening the surface and confirming refuses the whole batch.
2. `assertResolved(costume)` runs — exactly one value in each of the eleven single-value dimensions, and the format present in that platform's `formats/` folder.
3. One `piece` entry is written to `work-log/creation` — **the one canonical identity, owned by `creation/`** (S2). Not to `making/`, not to a queue, not to a second store.
4. Stage: **`build`**. PLAN §2 item 3: the room ends *"in one action: into build state."* No new stage is invented; `idea` remains what it always was, the stage of a card she jots on the board without the engine.
5. The birth snapshot is taken (§5.4).
6. `seed_id` is set to the seed. `batch_id` is set to one id shared by every piece in the batch.

Nothing else happens. No brief runs, no model is called, no money is spent. The brief is a separate press (§6.8) because refinement item 4 is law: *"she triggers, the engine proposes, she picks."*

### 5.3 The one dimension that stays a set

**Proof.** Spec 21 types `ResolvedCostume.proof` as `string[]`, and S4's list of dimensions-that-resolve-to-one does not name proof. Both readings agree, and they agree for a real reason: a single piece may honestly need two proof items (a number and a quote), and proof is evidence rather than an expressive choice, so varying it does not produce a different post the way a different hook does. Proof therefore stays a set at resolution and does not multiply the grid.

The consequence for testing, stated so the Analysis family does not trip on it: **proof is not a controlled comparison variable.** A batch that differs only in proof is not offered as a matched comparison (§5.6).

### 5.4 The birth snapshot (S15)

S15: *"At build/publication the piece snapshots its resolved costume, pillar job, goal mapping, gate version, and strategy version. Later corrections append dated amendments; the analytical birth record is never overwritten."*

Written at resolve, in `Piece.birth`, using spec 21's `BirthSnapshot` as it stands:

| Field | Source at resolve |
|---|---|
| `at` | now |
| `costume` | the resolved costume, all eleven single values plus the proof set |
| `pillar_job` | `content-strategy/pillars/<pillar>/job` — read now, not looked up later |
| `goal_mapping` | the goals this piece is meant to move. Suggested from the goals whose S16 measurement declaration names this pillar job or objective; **an empty mapping is allowed and is never invented** |
| `gate_version` | the profile's locked `GateSet.version` |
| `strategy_version` | the profile's current `strategy_version` |

**It is never rewritten.** `work-log/creation` is `append_only`; the write door refuses any second write to `birth` on an existing entry, from anyone, including both engines. A correction lands as a dated `Amendment` and the original stays byte-identical (§15 tests 4 and 16). This is what lets analysis, two years later, read a piece against the strategy that existed when it was born rather than against today's — which is the only reason the snapshot exists at all.

### 5.5 The only additions to spec 21's canonical objects

Four, each with its reason. **No later spec may add a fifth without the same justification; nothing else about `Piece` or `BirthSnapshot` changes.**

| Addition | Why |
|---|---|
| `Piece.materials?: MaterialRef[]` | Materials belong to the piece, and the piece is the one identity (S2). Anywhere else would be a second copy of the association. `MaterialRef = { kind: 'asset' \| 'reference' \| 'proof', id, path, attached_at, by, rights_state }` — a REFERENCE, never a copy of the file |
| `Piece.batch_id?: string` | S4 births separate pieces from one exploration. Without a batch id, "these three came from one selection" is unrecoverable, and S5's held and changed variables could then only be inferred — which the migration already refused to do, correctly |
| `BirthSnapshot.rule_overrides?: { rule_id, field, reason, by, at }[]` | §3.5 item 4. A piece that deliberately broke its own format rule must say so in the record analysis reads, or the rule looks like it was never there |
| `BirthSnapshot.taken_late?: { reason: string }` | §14.3. A migrated piece already sitting at `build` with no birth gets its snapshot when she completes its costume, which is not its birth. Analysis must be able to tell the difference |

Plus one new canonical object, declared here once for the whole engine family so no later spec invents a second: **`InternalBrief`** (§6.5).

`Piece.costume` stays typed `Partial<ResolvedCostume>`. That is not laziness: legacy pieces genuinely carry a partial costume and pretending otherwise would be a lie in the type system. Completeness is enforced by `assertResolved` at the write door for engine-born pieces, which is where it belongs.

### 5.6 Where a matched comparison is born (S5)

S5 requires a comparison to record its hypothesis, held variables, changed variable, posting windows, baseline and confounders. **The held and changed variables are knowable only at resolve.** Spec 21's migration proved the point by refusing to infer them for the legacy experiment flag, and spec 26 leaves comparisons alone because a collector cannot know them either. So this is the moment, and this spec is the only place it can happen honestly.

The offer, and its limits:

- It appears only when the batch changes **exactly one** dimension and holds every other. Two changed dimensions, no offer — that is not a controlled test and calling it one would be the causation claim S5 forbids.
- It appears only when `analysis.compare` resolves to `active`, which requires `analysis.tracking`. **You cannot run a controlled test on an account nobody is collecting from**, and the honest thing is not to offer one.
- It requires a one-line hypothesis from her. No hypothesis, no comparison — the batch is just a batch, which is fine.
- On accept it writes one `matched_comparison` at `work-log/analysis/comparisons` with `piece_ids`, `held_variables` and `changed_variable` taken **from the costumes, never inferred**, and `state: 'open'`.

**Everything after birth is the Analysis family's.** Windows, thresholds, baselines, confounders, and the verdict are spec 26's store and spec 27's reading. This spec writes the four fields only it can know and stops.

---

## 6. The internal brief — a real model call, before any copy

PLAN §5.1's flow puts it between the costume and creation: *"Internal brief → engine writes a small brief BEFORE copy: the one point, the tension, the realization, the takeaway, product's role, tone, ending, what to leave out."*

### 6.1 Why the brief is where the intelligence bar is won

PLAN §5.1's law: *"the recommendations and drafts that come out must MATCH the quality she gets from talking directly to a frontier LLM with full context… A cheap model that saves money but misses the bar fails the spec."*

The brief is the specific place that is decided. A piece with a sharp brief and average copy is a good piece; a piece with beautiful copy and no point is the thing she has been getting from generic tools. Everything the plan built — the seed template, the context bundle, the boundaries, the proof library — exists to make one small structured answer come out right, and this is that answer. So this call gets the same treatment spec 23 gave extraction, for the same reason.

### 6.2 The model

**`claude-opus-5`**, through the official SDK already in `package.json` (`@anthropic-ai/sdk`), exactly as spec 23 §5.1 established. The rules that come with the model are the same and they are 400 errors, not preferences: no `temperature` / `top_p` / `top_k`, no `budget_tokens` (thinking is on by default; depth is `output_config.effort`), no assistant-turn prefill, and `max_tokens` caps thinking plus output.

### 6.3 The call

```
model:          claude-opus-5
max_tokens:     12000            (non-streaming; thinking + output share this)
output_config:  { effort: "high",
                  format: { type: "json_schema", schema: BRIEF_SCHEMA } }
thinking:       default (adaptive, on) — display "omitted"; reasoning is not surfaced
system:         [ universal engine block   (cache_control: ephemeral) ,
                  context packet block     (cache_control: ephemeral) ]
messages:       [ { role: "user", content: <the seed in full, the resolved
                                            costume, the merged format rule,
                                            and the ask> } ]
betas:          [ "server-side-fallback-2026-07-01" ]
fallbacks:      "default"
```

**Effort stays `high`, and there is no cheap mode.** Spec 23 settled this and this spec does not reopen it: the switch in §12 is on or off, not cheap or expensive, because a cheap-but-present engine is precisely the failure the bar names. Off means she writes the brief herself, which is a real and honest option.

**Caching pays more here than anywhere.** The two system blocks — the universal engine method and the profile's context packet — are identical across every brief in a working session, and a batch of six variants is six calls against one packet. One cold read, five cache reads at about a tenth of the price. `stop_reason` is checked before `content` is read; a refusal renders as *"The model declined this one. Nothing was saved — your costume is still here."* and the run is logged with its refusal category.

### 6.4 The context packet (S12) — what enters, and what changed from extraction

Assembled fresh from the body on every run, versioned by `ProfileBody.context_version` (spec 23 §5.7), logged. Only `active` paths enter; a path at `history` or `hidden` is excluded, so a retired platform never shapes a brief (S9 plus the cascade).

**Block A — mandatory constraints. Always first, always whole, never trimmed.**

| Source | Why it is mandatory |
|---|---|
| `context/content-strategy/boundaries` | prohibited claims, never-promises, the unwanted audience |
| `context/content-strategy/voice` — the resolved voice in full, including never-words | the brief sets the tone; the tone cannot break the voice |
| `context/content-strategy/positioning` | what this brand actually is |
| `context/content-strategy/gates` — the seven gate questions | the brief is written TOWARD the gates it will be judged by. They are not run here |
| The seed's `prohibited_interpretation` and `nuance` | the two fields that exist to stop a good idea being flattened |
| Four fixed operational rules | (1) this is a brief, not copy — no headlines, no slide text, no script; (2) any field the material does not support comes back `null`, never invented; (3) nothing is claimed that the named proof cannot back; (4) the ending IS the resolved CTA, not a new one |

**Block B — relevant folders.**

| Path | What is sent |
|---|---|
| The seed | **in full**, every field, via `resolveSeed` — including the raw thought verbatim |
| The resolved costume | all eleven values plus the proof set, in words |
| `platforms/<p>/rules` merged with the universal format rule | **the merged rule, with each field marked universal or override** (§7.2). This is what spec 23 deliberately withheld from extraction: *"format RULES belong to drafting, not to understanding an idea"* |
| `platforms/<p>/how-it-works` | the platform's logic and rhythms |
| `content-strategy/pillars/<pillar>` | name, job, description, what belongs and what does not |
| `content-strategy/ctas/<cta>` | the CTA's actual words |
| `content-strategy/proof-library/<ids>` | the selected proof items: title, kind, and what each one evidences. Never the binaries |
| `context/personal-details/voice-of-the-person` · `journey` | how she actually sounds, and the story underneath |
| `context/business-details/offers` (hero marked) · `buying-route` · `pains` | so product's role can be honest |
| `content-strategy/audience-decided` | including the stage lens, for the resolved stage |

**Deliberately excluded, and the reason:**

- **Other seeds and other pieces.** A brief is written from one understood idea, not from the bank.
- **Metrics, verdicts, and digests.** Performance shapes the costume through recommendations (§10); it does not sit inside the brief's packet.
- **Past accepted briefs as style anchors.** That is the taste layer (spec 10) and it is not built. Naming it here so nobody quietly adds it.
- **Every other profile. Always.** A packet is built from exactly one profile's `context/`.
- **Everything under `frozen/`** — the chat thread and the untagged inbox, exactly as PLAN §11 ordered.
- **Asset and proof binaries.** Titles and what they evidence, nothing more.

**Packet size guard**, unchanged from spec 23: if Block A plus Block B exceeds 60% of the context window, Block B trims from the bottom of the table upward, Block A never trims, the trim is recorded in the run log and shown to her. No silent truncation, ever.

### 6.5 What comes back — `BRIEF_SCHEMA` and the `InternalBrief` object

The eight fields PLAN §5.1 names, and nothing else pretending to be one of them:

| Field | What it holds |
|---|---|
| `one_point` | the single thing this piece says |
| `tension` | what makes it worth watching — the friction the audience feels |
| `realization` | the turn: what they see differently by the end |
| `takeaway` | what they leave with even if they never buy |
| `product_role` | where the product honestly fits at this product intensity, or `null` at intensity `none` |
| `tone` | how it should sound, in the profile's voice, at this angle |
| `ending` | how it lands, ending on the resolved CTA |
| `leave_out[]` | what must not be in this piece: the nuance that would be lost, the claim that has no proof, the boundary nearby |

Plus the machine fields that make it traceable and make S18 possible:

```
InternalBrief {
  id, piece_id, brief_version,
  one_point, tension, realization, takeaway,
  product_role, tone, ending, leave_out[],
  cta_id,                 // must equal the resolved CTA
  proof_used[],           // proof-library ids; each must resolve
  derived_from[],         // seed field names this brief drew on
  format_rule: { rule_id, version, overridden_fields[] },
  origin: 'engine' | 'hers',
  field_sources?: Record<string, 'engine' | 'her'>,
  run_id?, packet_id?, context_version?,
  written_at, by
}
```

`origin` and `field_sources` follow spec 23 §6.4's pattern exactly: every field the engine wrote carries a marker, and her edit clears it. The "clearly marked" law, applied at field level.

### 6.6 The mechanism that stops the brief becoming copy

**Every prose field carries a hard `maxLength` in the schema.** The model cannot smuggle a draft into `one_point` because the schema will not let a paragraph through, and structured outputs make that a constraint rather than an instruction. This is the whole guard, and it is a good one: it is mechanical, it is not a matter of the model behaving, and it means the brief stays the thing you can read in twenty seconds and argue with.

### 6.7 The checks that run before she sees it

Five machine checks. They do not judge taste — she does. They catch the failures that would make the bar unmeasurable.

| # | Check | On failure |
|---|---|---|
| 1 | **Schema valid** | guaranteed by structured outputs; a malformed response is a run error and no brief is shown |
| 2 | **CTA fidelity** — `cta_id` equals the resolved CTA | **rejected**, run retried once with the violation named. The costume is the request; a brief that answers a different request is not a brief |
| 3 | **Proof resolves** — every id in `proof_used[]` exists in `proof-library/` and is permitted for the resolved platform | **rejected**, retried once. Inventing evidence is the one failure that must never reach a draft |
| 4 | **Boundary check** — no field contains a phrase from `boundaries/`'s never-promise list, and no field contains a `voice/` never-word | shown, badged **"crosses a boundary"**, with the boundary named |
| 5 | **Seed fidelity** — `derived_from[]` names at least one seed field that is actually non-empty on the seed | shown, badged **"check this against the seed"** |

Checks 2 and 3 reject. Checks 4 and 5 badge and never hide — hiding a flawed brief would teach her the engine is smarter than it is (spec 23 §5.6's rule, and it holds for the same reason).

**Then the real bar.** Every brief carries **"Below the bar"**, exactly as spec 23's proposals do. Pressing it writes a `feedback_item` scoped `profile-rule` into `work-log/logs/feedback`, carrying the run id, the packet version, the resolved costume, and her one-line reason. Two things follow: the brief is traceable to what it was given, and the count of below-bar marks over time is the honest measure of whether the engine holds the bar. If that count is not falling, the loop is broken and we fix the loop.

### 6.8 Nothing spends money without a press

- Resolving twelve pieces makes **zero** model calls.
- Each piece has one **Write the brief** action.
- A batch has one **Brief them all** action which states the count and the estimated cost in dollars before it runs, and runs nothing until she confirms.
- **Write it myself** opens an empty brief sheet with `origin: 'hers'`, no run, no cost. The engine serves and never rails, which here means she must always be able to bypass it.

**Cost, plainly.** Input at $5 per million, output at $25 per million, cache reads at about a tenth of input.

| Part | Size | Cost |
|---|---|---|
| Context packet, first brief of a session | 10k–24k tokens | $0.05–$0.12 |
| Context packet, every brief after it | same | $0.005–$0.012 |
| Seed + costume + merged format rule | 1k–3k tokens | ~$0.01 |
| The brief out | 0.6k–1.5k tokens | $0.02–$0.04 |

**About 8–16 cents for the first brief in a session and 3–6 cents for each one after it.** A batch of six is roughly 30–45 cents. Spec 23 §16 parked one question for her — whether there is a monthly ceiling on engine model spend, and what happens when it is reached. **That question is not reopened here; her answer binds this call too, and this spec builds nothing that spends past it.** `cost_estimate_usd` is written from run one either way, so whichever shape she picks has real numbers to work from.

### 6.9 Versions, and who wins

- The first accepted brief is `brief_version: 1`.
- Her edit creates version 2. A re-run creates version 2. Either way the old version stays readable and is never rewritten — the path is `versioned`, handled exactly as spec 22 handles gate sets.
- **Where she has written a field, a re-run never overwrites it.** A re-run that touches a field she wrote shows both, side by side, and she chooses. This is spec 23 §4.2's deepen rule, applied to briefs for the same reason.
- **S18 makes the brief the thing that leaves.** `HandoffRecord.brief_version` is required, so a piece cannot be handed to an outside tool without a brief. She can write one by hand in thirty seconds, but she cannot skip it, and that is correct: a design tool cannot be handed a piece with no point.

---

## 7. Format rules — universal, with per-profile overrides

PLAN §5.1, exactly: *"Format rules — universal per format… stored in the universal engine — with per-client overrides stored in that profile's platform `rules/`. Override beats universal, always."*

### 7.1 The universal library

`lib/engine/formats.ts`. One rule per format, each carrying:

| Field | Meaning |
|---|---|
| `id` | the format key, and the platform it belongs to where the platform changes the rule |
| `structure[]` | the ordered shape of the piece |
| `length_bands[]` | the finite length options this format offers, in that format's own unit (seconds, slides, words) |
| `carries_depth` | where the depth lives — in the piece, or in the caption |
| `never[]` | what this format must not be used for |
| `format_gate_criteria[]` | what "behaves properly on its platform" means for this format — **read by spec 25's operational format gate; not run here** |

The v1 rules are PLAN §5.1's own drafts (carousel: one point per slide, caption carries depth; reel: hook immediately, spoken language, one argument, payoff; LinkedIn: strong claim, more reasoning; newsletter: scene, full argument, framework), taken as the universal baseline.

**Lookup order**, deterministic: the profile's override → the universal rule for `<platform>:<format>` → the universal rule for `<format>` → **none**. A format with no rule at all is not given an invented one; the surface and the brief both say plainly that this format has no rule yet, and the brief runs without that block. Honesty over a plausible default.

### 7.2 Resolution — override beats universal, field by field

`resolveFormatRule(profile, platform, format)` merges the universal rule with the profile's `platforms/<p>/rules` entry **per field**, override winning, and returns the merged rule plus `overridden_fields[]`.

Field-by-field is the important part, and the plan's own example is why. ResumeGuru's carousels differ from the universal rule in `length_bands` (shorter, bite-size slides) and in `never` (never the convert format), and in nothing else. A whole-record override would have thrown away the universal structure for no reason. So the profile's `rules/` entry is a patch, not a replacement, and the merged rule always reports which fields came from where — which is what lets the brief cite its source and what lets §15 test 7 pass.

The ResumeGuru taxonomy is the living proof of the shape: reel, carousel, single post, LinkedIn post, newsletter, and blog each with a structure, a use, and a prohibition. Those are per-profile rules sitting on top of the universal ones, and the file already reads exactly like the merge output.

### 7.3 Who may write an override

`context/content-strategy/platforms/*/rules` is already declared `fed_by: ['owner', 'engine:content']` with the note *"Per-client overrides beat the universal format rules, always."* No declaration edit is needed. She writes overrides directly on the strategy surface; the engine may only **propose** one, as a diff (§7.4).

### 7.4 How an override is born from use (S13, the feedback memory)

PLAN §5.1: *"format feedback updates platform `rules/`."* The mechanism, and it is the same one everywhere in this family:

Format feedback — on a brief, on a draft in spec 25, or from an analysis finding — writes a `feedback_item` at `work-log/logs/feedback` with scope `profile-rule` and a `proposed_diff` targeting `context/content-strategy/platforms/<p>/rules`. **It is never applied automatically.** She accepts or rejects; the original feedback and her decision are both preserved (S13). An accepted diff writes the override and dates it.

This is also how a costume value gets pruned per profile (§4.1): the same proposed-diff shape, requiring her acceptance, so *"only she removes, and removal happens through use"* is a mechanism rather than a promise.

---

## 8. Build state — materials, and the outside-tool round trip

PLAN §3.10, her working reality on record: *"the creative work often happens OUTSIDE the dashboard — design software, video editors, Canva (the Canva API link has worked before and is the precedent). The making step must expect the round-trip: the entry leaves as a brief, the piece comes back and attaches to the same entry."*

### 8.1 What a piece at `build` holds

- Its resolved costume and its birth snapshot (§5.4), neither of which will ever be rewritten.
- Its brief, at some version (§6).
- Its materials: assets, references, and proof items, **attached by reference** (§8.2).
- Zero copy. Copy is spec 25's.

### 8.2 Materials

`Piece.materials[]` (§5.5) holds references into `work-log/assets/sets`, `work-log/references/`, and `context/content-strategy/proof-library/`. **References, never copies** — PLAN §3.11: no feature may introduce a second copy of a content piece, and the same discipline applies to what a piece points at. Detaching removes the reference and touches nothing at the source. Attaching runs the rights check (§9).

### 8.3 The handoff contract (S18)

S18 lists the fields and spec 21 §7.9 declares `HandoffRecord`. This spec is its first implementation, and it uses the object as it stands:

| Field | Filled at |
|---|---|
| `piece_id` | export. **Immutable** — this is what makes the round-trip land on the same identity |
| `brief_version` | export. The version that left; a later brief version does not retroactively change what the tool was given |
| `destination_tool` | export (`canva`, or a free-text tool name for the manual route) |
| `exported_at` | export |
| `expected_deliverable` | export — what should come back, in her words (*"one 8-slide carousel, 1080x1350"*) |
| `returned_asset` | import: `{ url, version, at }`, pointing at the item in `work-log/assets/sets` |
| `import_status` | `pending` → `imported` / `failed` / `abandoned` |
| `supersedes` | set when a re-export replaces an earlier handoff. The chain is never broken and never rewritten |

**The manual route ships first, and it is not a lesser route.** Export produces the brief plus the materials list in a form she can paste into any tool, and Import is a file drop that lands the asset in `assets/sets` and attaches it to the piece. This works for Figma, for a video editor, for a designer on WhatsApp — every tool that does not have an API.

**Canva is the named precedent and stays parked.** `lib/canva.ts` and `app/api/canva/*` exist; the OAuth app does not (CLAUDE.md's rejected list: *"Canva Connect import without an OAuth app: parked, needs a proper OAuth app first"*). So Canva becomes the first API implementation of this contract rather than a special case, behind `creation.making_handoff`, and it ships when the OAuth app exists. Nothing about the contract changes when it does — that is the whole point of writing the contract first.

### 8.4 What returning does, and does not do

- The returned asset is written to `work-log/assets/sets` with its rights record (S21), like every other asset.
- It is attached to the piece as a `MaterialRef` of kind `asset`.
- The handoff moves to `import_status: 'imported'`.
- **No second piece is created. Ever.** The piece that left is the piece that came back. Its id, its seed, its costume, and its birth snapshot are untouched by the round trip (§15 test 12).
- The piece stays at `build`. Moving it to `review` is spec 25's, after the gates.

### 8.5 Draft versions

`work-log/creation/making` (entry type `draft_version`, append-only) already exists and already holds versions. This spec writes nothing there — drafting is spec 25's. It is named here only so nobody puts a brief or a handoff record inside it: both get their own child paths (§11.3), because the path's `entry_type` is enforced and a handoff is not a draft version.

---

## 9. Rights (S21) — what this spec does, and what it leaves to spec 25

S21: *"Assets and proof carry rights: ownership, consent, permitted platforms/uses, expiry, attribution, subject releases, restriction status. Gates block publication when required rights are absent."*

**The split, stated once so it is not blurred:** the publication block lives with the gates, in spec 25. **The attachment of rights-carrying material is here**, because attachment is where a specific asset first meets a specific platform, and that is the first moment the question can even be asked.

### 9.1 The check at attachment

`rightsCleared(rights, piece.costume.platform)` — spec 21's function, used as it is — runs against the piece's **resolved** platform. Three outcomes:

1. **Clears.** The material attaches with `rights_state: 'cleared'`. Nothing else happens.
2. **Does not clear** (consent not given, platform not permitted, expired, or no rights record at all). The material **attaches**, carrying `rights_state: 'blocked'` and the specific missing right in words: *"No consent recorded for this photo."* The piece carries a visible rights block. She is often mid-clearance and being unable to build until a form comes back would be the tool getting in her way. Publication is what waits, and that is spec 25's.
3. **`restriction: 'blocked'`** — **refused at the write door.** This spec's ruling, with its reasoning: a restriction is not an absence of a right, it is an explicit prohibition already recorded by someone. The plan draws exactly this distinction elsewhere, between boundaries (what the brand must never claim) and voice's never-words (language). An absent right is a gap to fill; a restriction is an instruction to obey, and quietly attaching it so a gate can catch it later is not honest.

### 9.2 Proof carries rights too

Every item in `proof-library/` carries a rights record (spec 21 §7.8, and the declaration's own note). So selecting proof in the costume runs the same three-outcome check against the resolved platform. A case study a client permitted on LinkedIn but not on Instagram is a real situation and the costume is where it surfaces.

### 9.3 Rights are re-checked later, on purpose

Rights expire. The state recorded at attachment is a record of what was true then, not a permanent pass, and spec 25's publication gate re-runs the check at the moment of shipping. Nothing here is treated as a clearance that carries forward.

---

## 10. The loop back — where analysis's costume recommendations land

PLAN §5.2: *"winning combinations → costume recommendations inside the engine room ('this hook type is landing for this stage')."*

Addressed now so the Analysis family cannot get it wrong later, with two rules and no mechanism:

1. **A recommendation is a hint on a picker, never a pre-selection.** It renders beside the dimension it concerns, marked engine-proposed, and it selects nothing. She is exploring; the engine does not put its thumb on the scale.
2. **It carries its evidence or it is refused.** A recommendation with no cited verdict from `work-log/analysis/comparisons` or a digest is refused at the write door — PLAN §5.2's honesty rule, *"every suggestion cites its evidence"*, and the same guard spec 23 §8.3 put on revisit proposals.

Spec 23 also reserved `kind: 'revisit-seed'` proposals, whose pick-up *"opens the engine room on that seed with the winning costume pre-filled — which is Content Engine II's surface."* That is this surface: picking up a revisit proposal opens the costume surface on the named locked seed with the cited costume pre-selected and its evidence shown. Pre-selected, and still nothing is written until she confirms the grid.

---

## 11. Addresses — every folder this spec reads and writes

Per PLAN §6 rule 3: no address, no build.

### 11.1 Paths WRITTEN

| Path | New? | Entry type | Fed by | Read by | Switch | History | Audience |
|---|---|---|---|---|---|---|---|
| `work-log/creation` | existing (spec 21) | `piece` | `owner`, `engine:content` | making, review, scheduling, analysis, shelf, client (stage-scoped, §13.2) | `creation.board` | `append_only` | both (`see:upcoming`) |
| `work-log/creation/making/briefs` | **new (law 4)** | `internal_brief` | `owner`, `engine:content` | `owner`, `engine:content`, `work-log/creation/making` | `creation.brief` | `versioned` | owner |
| `work-log/creation/making/handoffs` | **new (law 4)** | `handoff_record` | `owner`, `pipe:canva` | `owner`, `work-log/creation` | `creation.making_handoff` | `append_only` | owner |
| `context/content-strategy/platforms/*/rules` | existing (spec 21) | `platform_parameter` | `owner`, `engine:content` | `work-log/creation`, `work-log/analysis` | `platforms.*` | `versioned` | both (`see:strategy`) |
| `work-log/logs/engine-runs` | existing (spec 23) | `engine_run` | `engine:content`, `engine:analysis` | `owner` | `logs.engine_runs` | `append_only` | owner |
| `work-log/logs/feedback` | existing (spec 23) | `feedback_item` | `owner` | `owner`, engines, `context/content-strategy` | `logs.feedback` | `append_only` | owner |
| `work-log/analysis/comparisons` | existing (spec 21) | `matched_comparison` | `owner`, `engine:analysis` | `engine:analysis`, `owner` | `analysis.compare` | `append_only` | owner |
| `work-log/assets/sets` | existing (spec 21) | `asset` | `owner`, `client`, pipes | making, assets | `assets.library` | `append_only` | both (`give:assets`) |

Two declaration edits, named in §13.3: `work-log/analysis/comparisons` gains `owner` as a writer (spec 21 declared it for the engine only, and §5.6 is an owner act); `work-log/creation` gains `engine:content` in `read_by` for the seed detail's piece list, which spec 23 already needs.

### 11.2 Paths READ (and never written)

`context/content-strategy/pillars/*` (name, job, description, mix-target) · `platforms/*` (active only) · `platforms/*/formats` · `platforms/*/how-it-works` · `ctas` · `voice` · `proof-library` · `boundaries` · `positioning` · `goals` (and each goal's S16 measurement declaration, for `goal_mapping`) · `gates` · `toolset` — and `context/personal-details/voice-of-the-person` · `journey` · `context/business-details/offers` · `buying-route` · `pains` · `audience-decided`. Also `work-log/creation/topics` (the seed, in full, through `resolveSeed`) · `work-log/references/*` · `work-log/creation/channels` (to know a resolved platform has an account, per §5.2 note).

**Read but never written** is load-bearing and it is PLAN §1's boundary: the Content Engine is a tool inside the body. It does not curate Context, does not derive strategy, does not lock gates, does not schedule, does not publish. A proposed change to strategy or to a format rule leaves as a feedback item requiring her acceptance, and nothing else.

### 11.3 Law-4 additions for the control room to ratify into PLAN §3

| Path | Why | Fed by | Read by | Switch |
|---|---|---|---|---|
| `work-log/creation/making/briefs/` | The internal brief PLAN §5.1 puts before any copy. It needs its own address because `making/`'s entry type is `draft_version` and a brief is not a draft, and because S18's `brief_version` must point at something versioned and permanent | her; `engine:content` | her; the drafting step; the handoff | `creation.brief` |
| `work-log/creation/making/handoffs/` | S18's contract: immutable piece id, brief version, destination tool, exported-at, expected deliverable, returned asset, import status, supersession chain. Spec 21 §7.9 says handoffs live in `making/`; the entry-type rule means they need their own child path | her; `pipe:canva` | her; the piece | `creation.making_handoff` |

Both live INSIDE an existing spine folder, so law 1 is intact, and both declare their feeds and readers at birth, so law 4 is satisfied.

---

## 12. Switches registered

Every feature registers its switch at birth (PLAN §3.4, her law). Defaults are **suggestions only** — she finalizes every position, after intake → curation → strategy.

### 12.1 Reused, unchanged

`creation.board` · `creation.engine` · `creation.making` · `creation.making_handoff` · `creation.channels` · `platforms.*` · `strategy.fixed` · `assets.library` · `analysis.compare` · `logs.engine_runs` · `logs.feedback`.

### 12.2 New

| Switch | Owns | Requires | Dependents | Audience | States | Suggested |
|---|---|---|---|---|---|---|
| `creation.costume` | the costume surface and the resolve step | `creation.engine`, `creation.board` | `creation.brief` | owner | active · history · hidden | active |
| `creation.brief` | `work-log/creation/making/briefs` and the model call behind it | `creation.costume` | — | owner | active · hidden | active |
| `creation.format_overrides` | — (the per-profile format-rule editor; the PATH stays governed by `platforms.*`) | `strategy.fixed` | — | owner | active · hidden | active |
| `creation.materials` | — (attaching assets, references and proof to a piece) | `creation.board`, `assets.library` | — | owner | active · hidden | active |

`creation.format_overrides` and `creation.materials` carry `owns: []` and name what they govern in their note, following spec 22 §9.2's precedent: the governing switch of a PATH stays the one its declaration names, so nothing is re-pointed.

**The cascade, traced.**

- `creation.costume → hidden` removes the costume surface and the resolve step. Spec 23's **Make a piece from this** button disappears with it. Every existing piece, brief, handoff and comparison stays readable at `history`; nothing is deleted (S9).
- `creation.brief → hidden` alone leaves the whole costume surface working and stops only the model call. She writes briefs by hand. This is the honest off-switch for a profile where she does not want API spend, and it mirrors `creation.seed_extraction` exactly.
- `platforms.linkedin → hidden` removes LinkedIn from the platform picker, removes every LinkedIn format from the format picker (because formats live inside platforms), removes LinkedIn rows from the variant grid, and removes LinkedIn from every packet — on her side, and the client never had it. Past LinkedIn pieces stay readable. Flip it with Instagram and it behaves identically. This is her canonical trace, and §15 test 6 is it.

**Validation at strategy lock** (S8, spec 21 §5.3) gains two checks:

- `creation.brief` cannot be `active` on a profile with no locked gate set — a brief written toward gates that do not exist misses the bar by construction.
- `creation.costume` cannot be `active` on a profile whose `content-strategy` has never locked. This is the switch-level expression of §2.4, and it is the same shape as spec 22's `strategy.lock → creation.board` dependency.

---

## 13. Audiences, and two corrections to spec 21's shipped code

### 13.1 The table

| Surface | Owner | Client | Door |
|---|---|---|---|
| The costume surface, the variant grid, the resolve step | yes | **never** | — |
| The internal brief, at any version | yes | **never** | — |
| Handoff records, exports, imports | yes | **never** | — |
| Format rules, universal and overridden | yes | the merged rule is workshop material; the client sees `platforms/` at the strategy summary level only, which spec 22 §11.3 already scoped | `see:strategy` (parent only) |
| Engine runs, costs, packets | yes | **never** | — |
| Materials attached to a piece | yes | **never** | — |
| A piece at `idea` or `build` | yes | **never** — PLAN §4: "drafts before review" | — |
| A piece at `review` and later | yes | yes, with engine internals stripped (§13.2) | `give:review`, `see:upcoming` |

**The workshop rule, restated because it is absolute:** no switch, in any position, can grant a client sight of the costume surface, a brief, a handoff, a run log, a format rule override, or a piece before review. PLAN §4, and KRNL OS rule 1.

### 13.2 Correction 1 — the piece stage gate (a real leak, found the same way spec 21's was)

**The bug.** `filterBodyForNonOwner` in `lib/access.ts` filters at PATH level only: a path either reaches a non-owner login whole, or not at all. `work-log/creation` is declared `audience: 'both', client_door: 'see:upcoming'`. So today every piece at that path, at every stage, would reach a client login.

**Why it has not bitten yet.** Nothing creates pieces at `build` through the tree. **This spec is what starts creating them**, in volume, twelve at a time, with their briefs and their costumes attached. So it must close it.

**The fix.** Entry-level narrowing at `work-log/creation`, server side, in the resolver:

- A non-owner login receives pieces at `review`, `approved`, `scheduled`, `posted` only. Pieces at `idea` and `build` are stripped entirely.
- The pieces they do receive are **field-filtered**: `costume`, `birth`, `batch_id`, `materials`, and `notes` are removed. `title`, `hook`, `stage`, `scheduled_date`, `live_link`, and `channel_id` remain. The costume and the birth snapshot are the engine's internals and PLAN §4 excludes them by name.

This generalizes the rule spec 26 §4.1 already needed in the other direction: **a child or an entry may be more restrictive than its parent, never less.** Law 3 inherits connections downward; it must not force visibility downward. CLAUDE.md rule 2 stands — the filtering only gets stronger, and §15 test 14 verifies it FAILS when the guard is removed.

### 13.3 Correction 2 — two declaration edits

| Path | Edit | Why |
|---|---|---|
| `work-log/analysis/comparisons` | add `owner` to `fed_by` | §5.6. Spec 21 declared the engine as the writer, but held and changed variables are known only at resolve, and resolve is her act |
| `work-log/creation` | add `engine:content` to `read_by` | Spec 23 §7.3's seed detail already lists a seed's pieces; the declaration never granted it. Read-only, no new door |

Both run through spec 21's validator; neither creates a client door; neither touches the frozen spine.

---

## 14. Migration — the legacy ResumeGuru pieces

Boring on purpose. **Nothing about this spec's build changes existing data**, and the rule underneath every line below is one sentence: **a reconstructed birth snapshot is never overwritten.**

### 14.1 What spec 21's migration actually wrote

Per `lib/tree/migrate.ts`, for each legacy content card:

- One `piece` at `work-log/creation` carrying `seed_id` where the card's `topicId` matched a migrated shell and `null` otherwise, and a **partial** costume: `pillar_id`, `platform`, `format` only.
- A `birth` snapshot **only** where the card was `posted` or `scheduled`, holding that partial costume, the pillar's job, `goal_mapping: []`, `gate_version: null`, `strategy_version: null` — plus an `unverified` note saying, in the migration's own words, *"the birth snapshot was reconstructed from the card, not recorded at build time — gate and strategy versions are unknown."*
- `birth: null` for everything at `idea`, `build` (the old "writing"), or `approved` (the old "ready").

The working figure is **22 pieces** on ResumeGuru, from the migration report. The rules below hold whatever the real `apply: true` run produces.

### 14.2 Completing a legacy costume

A legacy piece can be opened in the costume surface to fill in the nine missing dimensions. Doing so:

- writes an **`Amendment`** on the piece carrying the completed costume and a `costume_completed_at` marker;
- **does not touch `birth`.** Where a reconstructed snapshot exists, it stays byte-identical. The current costume and the birth costume then differ, and that difference is the truth: this is what the piece was born as, and this is what we later understood it to be;
- **does not invent a `seed_id`.** Spec 23 §14.1 already ruled it: the engine never guesses which seed an old post belonged to. She attaches by hand from the seed detail, and that attachment is an amendment too.

### 14.3 The pieces migrated at `build` with no birth

These are the old "writing" cards. They sit at `build` with `birth: null`. Completing their costume through this surface does write a birth snapshot — because they are entering the engine's build state now — and that snapshot carries `taken_late: { reason }` (§5.5) saying so in words: *"this record was made when the costume was completed, not when the piece was made."*

Analysis must be able to tell a late snapshot from a real one, or the honesty rule is broken at the source. That is the entire reason the field exists.

### 14.4 Legacy formats that no platform owns

Spec 21 split the global `DEFAULT_CONTENT_TYPES` list per platform. A legacy piece may carry a format that is not in its platform's `formats/` folder. Rule: the legacy piece **renders normally and is never rewritten**; it goes to the profile's sort queue with the question; and the costume surface refuses to resolve a **new** piece on that format until the format exists in the platform's folder. Old records stay honest, new records stay valid.

### 14.5 The three capture-input subjects

Untouched. They are `draft` seed shells with empty `raw_thought` (spec 23 §4.3), they cannot be locked, and `canMotherPieces` therefore refuses them here. A legacy piece pointing at one still appears under it in the seed detail, which is exactly the prompt she needs.

### 14.6 Order of build

1. The two new declarations, the four new switches, and the two declaration edits. Validator green with an empty tree.
2. `lib/engine/costume.ts` and `lib/engine/formats.ts` — the lists and `resolveFormatRule`, with tests, nothing on screen.
3. The costume surface and the variant grid, read-only: it enumerates, it writes nothing.
4. `lib/engine/resolve.ts` — the guards, the write, the birth snapshot. **This is a shippable stopping point**, and the correct one if the API key is ever unset: pieces resolve, she writes briefs by hand.
5. The brief: the packet, the call, the checks, the run log.
6. Materials and the rights check.
7. The handoff contract, manual route only. Canva stays parked.
8. The matched-comparison offer.
9. The §13.2 and §13.3 corrections land with step 1, not at the end.

One profile at a time, pilot first, hers (never a client's) — and per §2.4, that profile has to have locked its strategy.

---

## 15. Acceptance tests

Plain Node, no dependencies, no build step, in `tests/`, run by `npm test` alongside spec 21's 70 checks and the sibling specs' suites, all of which must stay green.

1. **One value per dimension (S4, S17).** A piece written with two platforms, two formats, two objectives, two audience stages, two angles, two hook types, or two CTAs is refused at the write door with the dimension named. `proof` as a set is accepted, and is the only such case.
2. **Multi-select births separate pieces.** Two hook types by three angles enumerates six rows; confirming writes six pieces, each with a distinct id, the same `seed_id` and the same `batch_id`; cancelling writes nothing; unchecking two rows writes four.
3. **Only locked seeds mother pieces.** Resolving on a `validated` seed is refused at the write door. Removing spec 23's `canMotherPieces` guard makes the write succeed — proving the guard is what stops it, not luck.
4. **The birth snapshot is taken, and never overwritten.** A resolve writes `costume`, `pillar_job`, `goal_mapping`, `gate_version`, `strategy_version`. Any second write to `birth` throws. A dated amendment correcting the costume leaves the birth record byte-identical.
5. **The growth test (law 3).** Add a fourth pillar, a new CTA, a second voice register, and a new proof item. All four appear in their pickers and in the brief packet, with no code change and nothing blank.
6. **Format lives inside its platform, and the cascade reaches the costume.** A write naming a format that is not in the resolved platform's `formats/` folder is refused. With `platforms.linkedin → hidden`, no LinkedIn platform, format, or grid row exists and no LinkedIn name enters any packet; flipped to `history` it still does not enter, while every past LinkedIn piece stays readable. The reverse trace with Instagram behaves identically.
7. **Override beats universal, field by field.** A profile override on carousel `length_bands` and `never` wins; every other field still comes from the universal rule; `overridden_fields[]` names exactly those two. Removing the override restores the universal rule whole. A format with neither reports "no rule" and invents nothing.
8. **A rule-forbidden combination is refused with its rule.** With ResumeGuru's *"never the convert format"* override on carousel, a carousel plus objective `conversion` row renders refused with the rule quoted; passing it with a reason writes the piece and records `rule_overrides` in the birth snapshot.
9. **The brief is grounded and logged (S12).** Every brief run — success, refusal, or error — writes exactly one `engine_run` carrying model, effort, packet folder list, `context_version`, token counts, cost estimate, and outcome. A run with no packet record fails the test.
10. **The brief's checks bite.** A brief whose `cta_id` is not the resolved CTA is rejected and retried once. A brief citing a proof id that does not resolve is rejected. A brief containing a never-promise phrase or a never-word is badged, not hidden. Every prose field is within its schema cap, so a draft cannot be smuggled into a brief field.
11. **Keyless honesty.** With no `ANTHROPIC_API_KEY`: the costume surface resolves pieces, "Write it myself" works, and the brief button is disabled with a plain reason. Nothing fabricates a brief and no run is logged.
12. **Nothing spends without a press.** Resolving six variants makes zero model calls. "Brief them all" states the count and the estimate and makes six calls only after confirmation.
13. **The handoff round-trip (S18).** A brief leaves carrying an immutable `piece_id` and its `brief_version`; the returned asset lands in `assets/sets` and attaches to the SAME piece; no second piece is created; the piece's id, `seed_id`, costume and birth are unchanged; a re-export sets `supersedes` and the chain is unbroken.
14. **No client, no leak.** A client login and an intern login both receive: zero briefs, zero handoffs, zero engine runs, zero format-rule overrides, zero materials, and **no piece at stage `idea` or `build`**. Pieces at `review` and later arrive with `costume`, `birth`, `batch_id`, `materials` and `notes` stripped. Each check FAILS when its guard is removed. (Re-runs spec 12's security suite against the resolver.)
15. **Rights at attachment (S21).** An asset with `restriction: 'blocked'` is refused. An asset whose rights do not clear the piece's resolved platform attaches with `rights_state: 'blocked'` and the missing right named; the piece carries the block; nothing about publication is decided. A proof item permitted on LinkedIn but not Instagram behaves identically against each resolved platform.
16. **The matched comparison is born honest (S5).** A batch changing exactly one dimension offers a comparison; recording it writes `held_variables` and `changed_variable` from the costumes, never inferred. A batch changing two dimensions offers nothing. A batch differing only in proof offers nothing. With `analysis.tracking` off, the offer is not rendered at all.
17. **The append-only test.** Twenty amendments on one piece resolve in order to the expected current state, and the birth record is byte-identical to what was first written.
18. **Legacy pieces.** Completing a legacy piece's costume writes an amendment and leaves its reconstructed birth snapshot untouched. A migrated piece at `build` with no birth gets one carrying `taken_late` and its reason. No legacy piece is re-parented to a seed automatically. A legacy format absent from its platform's folder still renders and still refuses a new resolve.
19. **The save-race test, extended.** A brief write and a materials attach on the same piece, concurrently, both survive.

---

## 16. Deliberately untouched

- **Drafting the copy, and the seven gates.** Spec 25. The gate SET is read into the brief's packet as constraints; no gate is run and no pass record is written here.
- **Publication blocking on rights.** S21's block sits with the gates, in spec 25. This spec attaches and records; it decides nothing about shipping.
- **Review, scheduling, distribution, and the board.** The body's, already addressed by spec 21. This spec hands a piece to them.
- **The Analysis Engine.** Its recommendation surface is addressed in §10 and its comparison's birth fields are written in §5.6. Everything else — windows, thresholds, baselines, verdicts, digests — is specs 26 and 27.
- **The taste layer.** Spec 10's territory: past accepted briefs as style anchors is named in §6.4 as deliberately excluded so nobody adds it quietly.
- **The chat thread and the untagged inbox.** FROZEN, exactly as PLAN §11 ordered. The chat is not the mouth of this engine and does not become one here.
- **Canva's OAuth app.** Parked (CLAUDE.md's rejected list). The contract ships; the API implementation follows the app.
- **The GUI restructure.** This spec describes one surface inside the Creation app and states what it needs from the shell.
- **The deploy path.** DEPLOY.md and CLAUDE.md rule 6 stand: her explicit go, every time, with the drift check first.
- **The setup day and the IG collection stall.** These do not wait for the engine. Recording is the Analysis Engine's first duty and every day not recorded is gone.

---

## 17. Open questions

**None.** Per PLAN §6, a question a fresh spec chat cannot answer from the vault is a hole in the plan. Seven candidates came up; each was checked twice and the plan answered all seven. They are recorded so the control room can check the reasoning rather than take the claim on trust.

1. **What stage is a candidate piece born at?** PLAN §2 item 3: the room ends *"in one action: into build state."* `build`, and no new stage is invented — the dictionary (PLAN §5.3) lists six and only six.
2. **Does proof resolve to one value, like the other dimensions?** No. S4 names seven dimensions that must resolve to one and proof is not among them, and spec 21 types `ResolvedCostume.proof` as `string[]`. Both readings agree. §5.3.
3. **Where do length options come from, since the plan names no list?** From the format rule. PLAN §5.1 stores format rules in the universal engine with per-profile overrides, and its own override example is a length change (*"ResumeGuru carousels run shorter, bite-size slides"*). The plan therefore already put length inside the format rule. §3.3, §7.1.
4. **What does the voice dimension mean when a profile has one voice?** Law 3 answers it: the picker reads `content-strategy/voice/`, resolves automatically when there is one entry, and grows the day a second register exists. §3.3.
5. **Who writes a matched comparison, since spec 26 does not?** S5 requires held and changed variables recorded, PLAN §5.2 says the costume system is what makes the tests controlled, and spec 21's migration refused to infer them. The only moment they are known is resolve. §5.6.
6. **May a client ever see a piece at `build`?** PLAN §4, by name: the client never sees drafts before review or the engines' internals. That is what §13.2 makes true server side.
7. **Does the brief run automatically for every piece in a batch?** PLAN §5.1 refinement item 4: *"she triggers, the engine proposes, she picks."* Nothing runs behind her, and money is one of her three gates. §6.8.

**One input this spec waits on, which is not a hole:** spec 23 §16's parked question — whether there is a monthly ceiling on engine model spend and what happens when it is reached. It is hers, it is already on record for her collective phase, and it binds this spec's brief calls exactly as it binds extraction. **This spec builds nothing that spends past her answer**; `cost_estimate_usd` is written from run one either way, so whichever shape she picks has real numbers to work from. Everything else here may build while that waits.
