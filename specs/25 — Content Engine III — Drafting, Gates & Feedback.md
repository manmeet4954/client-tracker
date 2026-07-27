# 25 — Content Engine III — Drafting, Gates & Feedback

**Status:** BUILT 2026-07-27, NOT DEPLOYED. All 18 acceptance tests in §14 green (260/260 with specs 21 to 24's). Build record: `dashboard/STATE.md`. Third spec of the Content Engine family (PLAN §5 — "each engine gets its own separate family of specifications"). Written in a fresh chat per PLAN §6, from `PLAN.md` (including section 10, the Sol Amendments), `CLAUDE.md`, `STATE.md`, `specs/21`, `specs/22`, `specs/23`, and `raw/ResumeGuru Seed Taxonomy (Sol).md`.

**Authority:** `PLAN.md` outranks this file. Where this spec and the plan disagree, the plan wins. Where an amendment in plan section 10 touches anything below, the amendment wins. Spec 21 is the data-layer contract underneath: its canonical `Piece`, `ResolvedCostume`, `BirthSnapshot`, `RightsRecord`, `FeedbackItem`, `GateSet`, `Gate`, `OPERATIONAL_GATES` and `ContextPacket` objects are used exactly as they are shipped. Spec 22 owns the derivation of gate set v1 and the strategy lock; this spec consumes them and never re-derives them. Spec 23 owns the model-layer pattern; **this spec follows spec 23 §5 as a template and reuses its machinery — the run log, the feedback path, the packet assembler, the below-the-bar loop — rather than building a second one of anything.**

**Where spec 24 is.** `specs/24` does not exist on disk as this is written. Spec 23 §1 listed the costume surface, the internal brief, the drafting call and the seven gates together as "Content Engine II"; batch mode split that work in two. Spec 24 owns the costume surface (multi-select exploring, S4 resolution into candidate pieces) and the internal brief, and ends with a piece sitting in **build state** with a resolved costume and a brief. This spec starts there. §2.3 states exactly what spec 25 needs from spec 24, drawn from PLAN §5.1 and spec 21 §7.2, both of which are plan-level authority and cannot move. If spec 24 lands with different field names, §2.3 is the one place the two are reconciled and nothing else in this spec changes.

---

## 1. What this spec is, and is not

**It is:**

1. **The drafting call** — a piece in build state, with its brief and its resolved costume, becomes an actual draft: carousel slides that are real slides, reel scripts that are spoken language, per the format's own rules. Grounded per S12, at the intelligence bar, following spec 23 §5's pattern exactly.
2. **The draft as a kept object** — versions in `work-log/creation/making`, append-only, every version traceable to the run and the packet that made it, her edits captured as deltas without anybody writing a report.
3. **The seven gates** — the five brand gates from this profile's locked `GateSet` plus accuracy and format, run before a piece may leave build state, as machine checks where a machine can check and as model-judged verdicts where judgment is needed, every verdict logged with its gate version, every pass record immutable (S14).
4. **The rights gate (S21)** — publication-blocking when a required right is absent on an attached asset or a cited proof item.
5. **The feedback memory (S13)** — classification at review and after posting, and routing as **proposed diffs that require her acceptance**: voice to `voice/`, format to the platform's `rules/`, seed to the seed, performance to costume recommendations.
6. **The taste layer** — spec 10 re-cut against the locked plan: evidence-born rules distilled from her own accepted and rejected diffs, stored where the plan allows, with a mechanical guard that stops one client's data reaching another client's packet.

**It is not:**

- **The costume surface or the internal brief.** Spec 24.
- **The Analysis Engine's verdicts, the digest, or the numbers.** Spec 26 ships the tracking store; spec 27 ships the verdicts. This spec reserves the address costume recommendations land at (§9.5) so spec 27 cannot invent a second home, and builds none of the mechanism.
- **Scheduling, publishing, or the client-side review workflow.** The body's job (PLAN §1). This spec defines the two stage boundaries it guards and nothing about what happens after them.
- **The GUI restructure.** This spec describes screens inside the Creation app and states what it needs from the shell.
- **Anything a client may see beyond the four give-points and the declared see-points.** The workshop rule is absolute (PLAN §4, CLAUDE.md rule 1). Everything this spec writes is `audience: owner` except one whitelisted projection, §12.2.

---

## 2. Where this sits, and what it needs first

### 2.1 Order

PLAN §8 step 6: data-layer restructure → intake → Content Engine → Analysis Engine → client-side regroup. Spec 21 is built and deployed (`a65079a`). Specs 22, 23 and 26 are written. This is the last Content Engine spec, and it is the one that touches the intelligence bar most directly, because a bad draft is the failure she would actually see.

### 2.2 What must be true before this builds

| Precondition | State today | If missing |
|---|---|---|
| Spec 21 deployed, path-scoped writes live | done | blocked — every "append-only" and "never rewritten" promise below is a lie without it |
| Spec 23 built (run log, feedback path, packet assembler) | written, not built | blocked — this spec reuses that machinery and must not fork it |
| Spec 24 built (costume resolution, the internal brief) | not written | blocked for the drafting call. The gate machinery and the feedback memory can build and be tested against hand-written drafts |
| Spec 22 built, strategy locked for the profile, gate set v1 locked | not for any profile | **hard block.** There is no draft without a locked strategy and no gate run without a locked gate set. The Creation app renders spec 22 §8.7's locked state naming what is owed |
| `ANTHROPIC_API_KEY` set in Vercel | set | build state still works: she writes the draft by hand, machine gate checks still run, model-judged gates report "not run" honestly and the piece cannot pass. Nothing fabricates a verdict (§15, test 15) |
| The pilot profile migrated for real (`apply: true`) | dry run done, apply parked to the collective phase | drafting refuses on that profile; the legacy screens keep working exactly as today |

### 2.3 The seam with spec 24 — exactly what this spec is handed

This spec is handed **one piece**, at `stage: 'build'`, carrying:

1. **A resolved costume** — spec 21 §7.2's `ResolvedCostume`, exactly one value per dimension (S4): `pillar_id`, `platform`, `format`, `objective`, `audience_stage`, `angle`, `hook_type`, `cta`, `length`, `product_intensity`, `voice`, `proof[]`.
2. **A locked seed** — `seed_id` pointing at a seed whose status is `locked`. Spec 23 §9.1's `canMotherPieces` guard already refuses the write otherwise; this spec calls the same guard and does not restate it.
3. **An internal brief** — PLAN §5.1: *"the engine writes a small brief BEFORE copy: the one point, the tension, the realization, the takeaway, product's role, tone, ending, what to leave out."* Eight fields, plus `brief_version` and an optional `hook` when she wrote one herself:

```
InternalBrief {
  brief_version: number
  one_point: string          the single thing this piece says
  tension: string            what makes it worth watching
  realization: string        the turn
  takeaway: string           what they leave with
  product_role: string       how the product honestly appears, or "none"
  tone: string
  ending: string
  leave_out: string[]        what must not be in this piece
  hook?: string              HERS, verbatim, when she wrote one
}
```

**No brief, no draft.** PLAN §5.1's flow puts the brief before copy, and that ordering is the whole reason the engine does not write from a topic. A drafting call against a piece with no brief is refused at the write door, with the reason. This is a law, not a validation nicety.

If spec 24 ships different field names, one function reconciles them — `resolveBrief(piece)` — and every other line of this spec reads the eight fields above through it.

### 2.4 What a profile's lifecycle grants

Per S22 and spec 21 §6: `setup` cannot open creation at all (spec 22 §8.7 refuses the write server side). `active` drafts and gates normally. `paused`, `closing`, `archived` render everything read-only: existing drafts and gate runs are readable, no model call runs, no gate run is written, nothing publishes.

---

## 3. The draft, as a kept object

### 3.1 Where drafts live

`work-log/creation/making`, already declared by spec 21: `entry_type: 'draft_version'`, `fed_by: ['owner', 'engine:content']`, `history: 'append_only'`, `audience: 'owner'`, switch `creation.making`. **No new path is needed for drafts, and none is created.**

### 3.2 The draft version record

```
DraftVersion {
  id, piece_id, version: number
  origin: 'engine' | 'hers' | 'engine+her-edit'
  brief_version: number
  gate_set_version: number          the version in force when this was drafted
  strategy_version: number
  format_rules_resolution: string   the merged universal+override rule set, hashed and named
  format_family: 'carousel' | 'reel' | 'static' | 'longform-text' | 'newsletter'
  content: <the format payload, §5>
  claims: Claim[]                   §4.6 — what makes accuracy checkable
  proof_refs: string[]              proof-library ids the draft leans on
  asset_refs: string[]              assets attached to this expression
  engine_run_id: string | null      null when she wrote it herself
  gate_run_id: string | null
  edit_delta?: EditDelta            present on 'engine+her-edit' versions, §8.6
  created_at, created_by
}
```

### 3.3 How a draft changes

Append-only, honored the way spec 23 §6.3 honors it for seeds. Her edit does not overwrite version *n*; it creates version *n+1* with `origin: 'engine+her-edit'` and an `edit_delta` recording exactly what moved. That delta is free — she was editing anyway — and it is the raw material the taste layer reads (§9). This is the byproduct law from CLAUDE.md, applied to the one stream that matters most: **a data point must be a byproduct of work she already does, never a reporting duty.**

Nothing about a draft version is ever rewritten. A version that failed its gates stays, with its verdicts, forever. That is what makes the below-the-bar count in §4.9 mean something.

### 3.4 Which version is "the draft"

The piece points at `current_draft_version_id`. Everything else — review, the client preview projection, scheduling, the birth snapshot — reads that one pointer. **No copy of a draft is made anywhere** (PLAN §3.11, the one-truth rule).

---

## 4. The drafting model call

PLAN §5.1's law, quoted because it is the reason this section is this long: *"when she selects a seed and its doors, the recommendations and drafts that come out must MATCH the quality she gets from talking directly to a frontier LLM (Claude, Sol) with full context. 'If that was not the case, why was I even building it.'… A cheap model that saves money but misses the bar fails the spec."*

This section follows spec 23 §5 exactly, because that pattern is now the family's house style and a second pattern would be a second thing to maintain.

### 4.1 The model

**`claude-opus-5`**, through the official SDK already in `package.json` (`@anthropic-ai/sdk` ^0.111.0). Same model as seed extraction, same reasons, and one more: drafting is where her taste is either matched or missed, and this is the only place in the system where the output is the deliverable rather than an aid to one.

Rules that come with this model — they are 400 errors, not preferences, and spec 23 already learned them:

- No `temperature`, `top_p`, or `top_k`. Steering is done by the prompt.
- No `budget_tokens`. Thinking is on by default; depth is set by `output_config.effort`.
- No assistant-turn prefill. Output shape comes from `output_config.format`.
- `max_tokens` caps thinking **plus** output. A newsletter draft needs room; set it per format family (§4.3) or the last slide truncates.

### 4.2 The call

```
model:          claude-opus-5
max_tokens:     12000 (carousel/reel/static) | 20000 (longform-text/newsletter)
output_config:  { effort: "high",
                  format: { type: "json_schema", schema: DRAFT_SCHEMA } }
thinking:       default (adaptive, on) — display "omitted"; reasoning is never surfaced
system:         [ universal engine block   (cache_control: ephemeral) ,
                  context packet block     (cache_control: ephemeral) ]
messages:       [ { role: "user", content: <the brief, the resolved costume,
                                            the seed resolved, her hook if any,
                                            the revise notes if this is attempt 2+> } ]
betas:          [ "server-side-fallback-2026-07-01" ]
fallbacks:      "default"
```

Three things about that shape, mirroring spec 23 §5.2:

- **Structured output, not prose parsing.** `DRAFT_SCHEMA` (§4.6) is a discriminated union on `format_family`. A carousel comes back as an array of slides with typed fields, not as markdown that somebody has to split. There is no regex anywhere in the drafting path.
- **Prompt caching where it pays.** The stable prefix is the universal engine block plus this profile's context packet. The volatile part — the brief, the costume, her hook, the revise notes — sits after the last breakpoint in the user turn. Drafting three variants of one seed in one sitting reads the packet from cache at about a tenth of the price. The minimum cacheable prefix is 512 tokens; a drafting packet is always well past it.
- **Refusal handling.** `stop_reason` is checked before `content` is read. A refusal renders as *"The model declined this one. Nothing was saved as a draft. Your brief is still here."* and the run is logged with its refusal category. No empty draft, no silent retry loop.

### 4.3 Effort, cost, and the honest number

`effort: "high"`. Not offered as a per-run cheap/expensive toggle, for the reason spec 23 §5.3 gives: a cheap-but-present engine is exactly the failure the bar names. The switch in §11 is on or off.

Input at $5 per million tokens, output at $25 per million, cache reads at about a tenth of input.

| Part | Size | Cost |
|---|---|---|
| Drafting packet, first run in a session | 12k–25k tokens | $0.06–$0.13 |
| Drafting packet, cached repeat | same | $0.006–$0.013 |
| Brief + costume + seed + revise notes | 1k–3k tokens | ~$0.01 |
| Draft out — carousel (10 slides + caption + claims) | 1.5k–3k tokens | $0.04–$0.08 |
| Draft out — reel script | 1k–2k tokens | $0.03–$0.05 |
| Draft out — newsletter | 3k–6k tokens | $0.08–$0.15 |
| The gate call (§6.8) | 6k–12k in, 0.8k–1.5k out | $0.05–$0.10 |

**About 20 to 35 cents for a piece that passes first time; about 60 cents with one revise loop; the ceiling per piece is the two-revise cap in §4.10, so roughly 90 cents worst case.** Twenty pieces a month across five profiles is **$5–$12/month**, on top of seed extraction's $15–$25.

That number belongs on record because money is one of her three gates (PLAN §6). It does **not** open a new question: it rolls into spec 23 §16 Q1, which asks whether there is a shared monthly ceiling across every feature drawing on the one `ANTHROPIC_API_KEY`. Whatever she answers there governs here. `cost_estimate_usd` is written on every run from run one regardless, so her answer has real numbers to work from.

### 4.4 The context packet (S12) — exactly what enters

Assembled fresh from the body on every run, versioned, logged. Nothing trains, nothing is remembered between calls (PLAN §5.3, "Grounding"). The assembler is spec 23's, with a second profile of contents — **one assembler, two profiles, not two assemblers.**

**Only `active` paths enter.** A path at `history` or `hidden` is excluded, so a retired platform never shapes a draft (S9 plus the cascade). This is acceptance test 13.

**Block A — mandatory constraints. Always first, always whole, never trimmed to fit.**

| Source | Why it is mandatory |
|---|---|
| `context/content-strategy/boundaries` | prohibited claims, never-promises, the unwanted audience. The accuracy gate is judged against this, so the drafter must have it |
| `context/content-strategy/voice` | vibe words and never-words, in full — this is the folder the brand's voice actually lives in |
| `context/content-strategy/positioning` | what this brand is |
| `context/content-strategy/gates` | the profile's locked `GateSet` — the five brand gates in her own question wording, plus accuracy and format. A draft written knowing the standard is better than one graded after the fact. **Passing is claimed by the reviewer call, never by the drafter** (§6.8) |
| The seed's `prohibited_interpretation` and `nuance` | the two fields that exist specifically to stop a good idea being flattened |
| The brief's `leave_out[]` | the one instruction the drafter is most likely to drift from |
| Five fixed operational rules | (1) her hook, when present, is used verbatim and is never "improved"; (2) every factual claim is enumerated in `claims[]` with the proof it needs; (3) nothing is claimed that `proof-library` cannot back — name the missing proof instead of asserting; (4) a carousel is slides, not an essay cut into pieces; (5) a reel script is spoken language a person can say out loud |

**Block B — the fuel.**

| Path | What is sent |
|---|---|
| The resolved seed | in full, through spec 23's `resolveSeed()` — raw thought verbatim included, because it is the perspective the draft has to protect |
| The resolved costume | in full, exactly one value per dimension |
| `content-strategy/pillars/<pillar_id>` | name, job, description, what belongs, what does not, how the product appears, typical proof |
| `content-strategy/platforms/<platform>/how-it-works` | how this platform actually behaves for this brand |
| **The merged format rules** for `<platform>/<format>` | universal rules overridden by this profile's `platforms/*/rules` — §4.5, and override beats universal, always |
| `content-strategy/visual-branding` | notes only: palette, type feeling, the look. Never binaries |
| `content-strategy/audience-decided` | including the stage lens, with the costume's chosen stage marked |
| `content-strategy/ctas/<cta>` | the chosen CTA in full; other CTAs as labels |
| `content-strategy/proof-library` | **titles, kinds, one-line summaries, and rights status** for every item; the full item only for the ids in `costume.proof[]`. Rights status enters so the drafter does not build a piece around proof that cannot be published (§7) |
| This seed's already-posted pieces, this profile only | title and hook only, capped at 20, so the draft does not repeat a hook the account already used |
| `owner/taste-rules` | her accepted standing habits, de-identified, capped, clearly labelled as last-resort instruction (§9) |

**Deliberately excluded, and the reason:**

- **Every other profile. Always.** A packet is built from exactly one profile (PLAN §5.3: everything belongs to exactly one profile). The only cross-profile text that may enter is a taste rule that has passed the de-identification guard in §9.3, and that text is hers, not a client's.
- Metrics, verdicts, digests. Drafting does not read last month's numbers; performance reaches the engine as a costume recommendation at selection time (spec 24), not as evidence inside a draft prompt.
- `logs/observations`. Soft signals are hers to read (PLAN §5.2).
- Asset and proof binaries. Titles, kinds and rights only.
- Everything under `frozen/`. The chat thread and the untagged inbox stay out, exactly as PLAN §11 ordered.
- The client's review words from *other* pieces. Feedback routes through §8 and lands as a diff she accepts; it does not leak sideways into an unrelated draft.

**Packet size guard.** If Block A plus Block B exceeds 60% of the model's context window, Block B is trimmed from the bottom of the table upward (taste rules → prior hooks → other CTAs → proof titles → …), Block A is never trimmed, and the trim is recorded in the run log and shown to her: *"This profile's context is large. The engine read everything except [list]."* No silent truncation, ever. Same rule as spec 23 §5.4, same words on screen.

### 4.5 Format rules — universal, then the profile's override

PLAN §5.1: *"Format rules — universal per format… stored in the universal engine — with per-client overrides stored in that profile's platform `rules/`… Override beats universal, always."*

**Where the universal library lives.** In code (`lib/engine/format-rules.ts`), versioned by `format_rules_version`, not in any profile's body. It belongs to no profile, and the tree is per-profile data, so giving it a tree address would be a category error. Its version is written on every run and every gate run, so any draft is traceable to the method that made it. **No build agent may invent a profile folder for it.**

The universal set, from PLAN §5.1 and the ResumeGuru taxonomy as the living example:

| Format | Universal rule | Machine-checkable part |
|---|---|---|
| Carousel | one point per slide; the caption carries depth; cover is one simple hook; last slide is the CTA, not a philosophical close | slide count; per-slide heading word cap; per-slide body line count; cover is hook-only; final slide carries the CTA; caption is longer than any single slide |
| Reel | hook immediately; spoken language; one argument; a payoff; a named action | first spoken line is the hook; no bullet characters, no headings, no slide markers; sentence length distribution; a named action exists |
| Single post / static | one clear claim, formula, table or opinion; understood at a glance; caption deepens instead of repeating | one claim in `claims[]` marked primary; caption is not a substring of the visual text |
| LinkedIn post | strong claim first, then the builder's reasoning, then a useful framework | first line is a claim, not a question stem; body has at least one reasoning move |
| Newsletter | a scene, the full argument, a framework or practice at the end | sections present in order |

**The override.** The profile's `content-strategy/platforms/<platform>/rules` supplies the same keys with this client's numbers and prohibitions. ResumeGuru's carousel override, straight from the taxonomy: 8 to 10 slides; cover is one simple hook; body slides are a heading plus 1 to 3 short sentences; last slide is follow and CTA; **never use carousel as the convert format.**

The merge is per key, override wins, and the merged result is named and hashed as `format_rules_resolution` on the draft version and the gate run — so a verdict written a year from now can still say which rules judged the piece (S15's spirit, applied to rules rather than costume).

**"Never use carousel as the convert format" is a machine check, not a hope.** If the costume resolves `format: carousel` with `objective: conversion` or `product_intensity: direct promotion` on a profile whose rules carry that prohibition, the format gate fails with the rule quoted. Acceptance test 5.

### 4.6 What comes back

`DRAFT_SCHEMA`, a discriminated union on `format_family`. Common to every family:

- `hook` — the first thing a person meets. If `brief.hook` was present, this must equal it exactly.
- `caption` — for the platforms that have one.
- `cta_line` — the chosen CTA expressed in this piece's language.
- `claims: Claim[]` — **the field that makes accuracy checkable rather than judged.** Each claim: `text` (a verbatim substring of the draft), `kind: 'fact' | 'result' | 'opinion' | 'promise'`, `needs_proof: boolean`, `proof_id: string | null`, `within_boundaries: boolean`. A draft that states a result with `proof_id: null` has told on itself, in a field, before any reviewer looks.
- `alt_text[]` — accessibility, one per visual.
- `leave_out_check[]` — one line per item in `brief.leave_out[]` confirming it was kept out.
- `notes_for_her` — anything the model wants to flag, plainly. One or two lines, not an essay.

Per family:

- **carousel** — `slides[]`, each `{ index, heading, lines[], visual_note }`. Lines are short lines, not paragraphs. `visual_note` is direction for whoever designs it, never a design.
- **reel** — `script[]`, each `{ beat: 'hook' | 'recognition' | 'reframe' | 'payoff' | 'action', spoken, on_screen_text?, seconds_estimate }`. `spoken` is what a person says out loud.
- **static** — `{ visual_text, caption }`.
- **longform-text** — `{ opening_claim, body_blocks[], closing }`.
- **newsletter** — `{ scene, sections[], practice }`.

### 4.7 Her two standing laws, made mechanical

Her record across sessions, restated here because these are the two things she notices first:

**Slide copy, not essays.** Carousel drafts arrive as real slides with short lines, never a post essay chopped into pieces. This is enforced three ways: the schema cannot express a paragraph slide, the format machine checks cap heading words and body lines, and the format gate quotes the offending slide back when it fails.

**Keep her hook.** When `brief.hook` is present, it is used verbatim as slide 1, as the first spoken line, or as the opening claim, depending on family. A whitespace-normalized exact-substring guard runs before a draft is ever shown, exactly like spec 23's verbatim guard, and a draft that improved her hook is **rejected and retried once with the violation named**. When she wrote no hook, the model returns three hook options, the strongest is used, and the other two are offered beside the draft. Acceptance test 1.

### 4.8 What is logged, per output (S12)

One `engine_run` entry per call, to `work-log/logs/engine-runs` — **spec 23's path and spec 23's shape, with a different `kind`.** No second run-log format exists.

```
id, kind: "draft" | "gate_run", profile_id, triggered_by: "owner",
piece_id, draft_version_id, brief_version,
packet: { packet_id, context_version, folders[], mandatory_constraints[], trimmed[] },
model: "claude-opus-5", effort: "high", thinking: "adaptive",
schema_version, prompt_version, format_rules_version, format_rules_resolution,
gate_set_version, strategy_version,
usage: { input_tokens, cache_read_input_tokens, cache_creation_input_tokens, output_tokens },
cost_estimate_usd, latency_ms, stop_reason, refusal_category?,
checks: { rejected: n, badged: [{ check, detail }] },
attempt: 1 | 2 | 3,
started_at, finished_at, error?
```

Append-only, retained forever (PLAN §11 Q5), `audience: owner`, never stores the API key, never stores another profile's data.

### 4.9 The bar, and the loop that proves it

Every draft carries **"Below the bar"**, exactly as spec 23 §5.6 defines it. Pressing it writes a `FeedbackItem` scoped `profile-rule` carrying the run id, the packet version, the gate set version and her one-line reason, into `work-log/logs/feedback`.

Two things follow, and they are the entire point:

1. Any draft is traceable to what it was given. If the draft was thin, we can see whether the packet was thin.
2. **The below-the-bar count over time is the honest measure of whether the engine holds the bar.** If that count is not falling, the loop is broken and we fix the loop, not the wording.

The count is shown on the profile's engine screen and on nothing client-facing.

### 4.10 Revise, and the ceiling on it

A failed gate run offers **Revise**: a second drafting call carrying the failed verdicts verbatim, her note if she wrote one, and an instruction to fix exactly those and change nothing else.

**Two automatic revise attempts, then it stops.** Attempt three is not offered. The screen says, plainly: *"Two tries and it is still not passing the hook gate. That usually means the brief is wrong, not the copy."* with a link back to the brief. This is not a cost measure primarily — it is the honest read of what a repeated gate failure means, and it prevents a spend spiral on a piece that needed a different idea. Acceptance test 17.

---

## 5. What a draft actually looks like

Written out because a build chat must be able to render these from this section alone, and because "carousel slides as real slides" has to mean something specific.

**A carousel, ResumeGuru, seed "AI cannot replace career judgment", costume: pillar AI Lane, objective reach, angle contrarian, hook type direct claim, platform Instagram, format carousel, product intensity light mention.**

Ten slide objects. Slide 1 is the cover and carries the hook and nothing else. Slides 2 through 9 each carry one heading of a few words and one to three short lines under it. Slide 10 carries the CTA and the follow ask, not a closing thought. The caption is where the depth goes — the nuance, the qualification, the part that would ruin a slide. That is the universal carousel rule and this profile's override agreeing.

**A reel, same seed, costume: objective trust, angle founder observation, format reel.**

Five beats. The hook beat is one spoken line a person can say in under three seconds. The recognition beat names what the viewer already feels. The reframe beat is the turn. The payoff beat gives them something usable whether or not they ever open the product. The action beat names one action. Every `spoken` string reads as speech: contractions, short sentences, no headings, no bullets, no "firstly". If it cannot be said out loud in one breath per line, the format gate catches it.

**The thing neither of them is:** a block of post text with line breaks. There is no format family in the schema that produces one, which is the structural version of her standing law.

---

## 6. The seven gates

PLAN §5.1: *"five brand gates, customizable per client (ResumeGuru's five: coach, hook, value, stance, friend) + two operational gates that never vary (accuracy… format…). Nothing reaches review until all seven pass."*

### 6.1 Where the gates come from

The profile's `context/content-strategy/gates`, a `GateSet` (spec 21 §7.13) derived and locked with strategy by spec 22 §8.4. **This spec derives nothing.** It reads five `kind: 'brand'` gates plus spec 21's shipped `OPERATIONAL_GATES` (accuracy, format) and runs them.

ResumeGuru's five, as the living example, from the taxonomy and the voice framing:

| Gate | The question, in her words |
|---|---|
| Coach | Could a career coach with no product have written this? If yes it is generic — it needs a builder-side pattern, a real number, or a take that disagrees with common advice |
| Hook | Can the first line be understood in under two seconds, in plain words? |
| Value | Would the viewer be better off even if they never use ResumeGuru? |
| Stance | Is "AI does the work, you keep the judgment" present where it is relevant? |
| Friend | Read it out loud. Would you say this to a friend over chai, or does it sound like a brand script? |

Another profile's five will read nothing like these. The mechanism does not care. It reads `gate.question` and judges against it.

### 6.2 When gates run

At the **build → review** boundary. A piece may not leave build state until all seven pass. Enforced at the write door, not in the UI: a stage write moving a piece out of `build` with no passing gate run at the current gate set version is refused, with the reason. Acceptance test 6 removes the guard and proves the write is then accepted — the same way spec 21 and spec 23 prove their guards.

She can run gates whenever she likes before that, as many times as she likes. Each run is a record.

### 6.3 Machine checks first, then judgment

Every gate is scored as **the AND of its machine checks and its model verdict.** A gate with no machine check is model-only. A gate with no judgment component is machine-only.

**If any hard machine check fails, the gate run short-circuits: the model call is not made at all.** The draft is going back regardless, and paying for a judgment on copy that is already provably wrong is the kind of spend that has no defence. The run is still logged, with `model: null` and the failing check named.

| Gate | Machine checks | Model judgment |
|---|---|---|
| Brand gate 1–5 | her hook verbatim guard (when a hook was supplied); never-words from `voice/` do not appear | yes — the gate's own question, answered with a reason and a verbatim evidence span |
| **Accuracy** | every `claims[]` entry with `needs_proof: true` has a `proof_id` that exists in `proof-library`; no draft text matches a phrase in `boundaries/`'s never-promise list; no claim marked `kind: 'promise'` at all where boundaries forbid promises | yes — the residue: are there claims the model did not enumerate, and is each enumerated claim actually supported by the proof it cites |
| **Format** | the merged format rules of §4.5, as a rule set: counts, caps, ordering, family-specific prohibitions, the convert-carousel prohibition | yes — "does this behave properly on this platform", the part a count cannot see |
| **Rights** (publication gate, §7) | `rightsClearedAt()` on every referenced asset and proof item, against the piece's platform and its scheduled date | no — rights are a record, not an opinion |

### 6.4 The accuracy gate, spelled out

PLAN §5.1 and spec 21's shipped wording: *"Is every claim within what the product honestly delivers?"* Made concrete:

1. **Within boundaries.** Any draft text matching a never-promise phrase from `boundaries/` fails. This is a substring scan, and it is deliberately blunt.
2. **Backed by proof, or flagged.** Every claim of a result, a number, or an outcome must cite a `proof_id`. A claim with no proof does not silently pass and does not silently fail — it is **flagged**: shown to her, named, with the proof it would need. She can attach proof, edit the claim, or mark it `owner-verified` with a reason (she knows her business; the machine does not). An `owner-verified` mark is recorded on the gate run, immutably, with her words.
3. **The one thing she cannot wave through.** A **boundaries violation is not overridable at the piece.** Boundaries are the brand's own declared law; a per-piece exception would make them meaningless. It is fixed by editing the draft, or by amending `boundaries/` in strategy — which is a strategy version change, dated, with a reason (spec 22 §8.8). That is the honest route and it costs her one deliberate action.

### 6.5 The format gate, spelled out

*"Does the piece behave properly on its platform?"* — the merged rule set of §4.5, run as checks, plus the model residue. A failure quotes the rule and the offending part: *"Slide 4 is 47 words. This profile's rule says a heading plus 1 to 3 short sentences."* Never a red form, never a score.

### 6.6 The gate run record

A new declared path, `work-log/creation/making/gate-runs`, `entry_type: 'gate_run'`, append-only, `audience: owner`.

```
GateRun {
  id, piece_id, draft_version_id,
  gate_set_version: number, strategy_version: number,
  format_rules_version, format_rules_resolution,
  verdicts: GateVerdict[]
  overall: 'passed' | 'failed' | 'passed-with-override'
  engine_run_id: string | null      null when short-circuited by a machine check
  run_at, run_by
}

GateVerdict {
  gate_id, gate_kind: 'brand' | 'operational' | 'rights',
  gate_version: number,             stamped per verdict, per S14
  source: 'machine' | 'model' | 'machine+model',
  verdict: 'pass' | 'fail' | 'flagged' | 'not-applicable' | 'not-run',
  reason: string,                   one plain line
  evidence_span?: string,           a verbatim substring of the draft
  override?: { by, at, reason }     never present on rights or on a boundaries failure
}
```

**Every verdict carries its gate version.** That is S14 made mechanical rather than promised.

### 6.7 Versioning, forward only (S14)

- A gate run is written under the gate set version in force at that moment.
- When she refines a gate, spec 22 §8.8 creates gate set version N+1. **Version N's pass records are not touched, not recomputed, not re-rendered.** A piece that passed under v1 keeps `gate_version: 1` in its birth snapshot (spec 21 §7.2's `BirthSnapshot.gate_version`, already shipped).
- A piece pulled back into build after v2 locks is drafted and gated under v2. Nothing is retro-gated, ever. A posted piece is never re-judged by a standard that did not exist when it was made.
- Acceptance test 7.

### 6.8 The gate call is a separate call

The gates are judged by a **second model call, not by the drafting call.** A model grading its own output in the same turn is not a check, and the intelligence bar is not served by a system that congratulates itself.

```
model:          claude-opus-5
max_tokens:     6000
output_config:  { effort: "high", format: { type: "json_schema", schema: GATE_SCHEMA } }
system:         [ reviewer method block   (cache_control: ephemeral) ,
                  gate packet block       (cache_control: ephemeral) ]
messages:       [ { role: "user", content: <the draft, the resolved costume,
                                            the brief's leave_out, the machine-check results> } ]
```

The gate packet carries: the `GateSet` questions verbatim, `boundaries/`, `voice/`'s never-words, the merged format rules, `proof-library` titles and rights status, and the seed's `prohibited_interpretation` and `nuance`. It does **not** carry the drafting call's reasoning, the drafting system prompt, or any encouragement to pass.

**A verdict of `pass` with no `evidence_span` is rejected and the gate is re-run once.** A reviewer that cannot point at the thing it approved has not reviewed anything. This is the same shape as spec 23's verbatim guard, applied to judgment instead of quotation.

### 6.9 What she can override, and what she cannot

| | Overridable at the piece | How it is recorded |
|---|---|---|
| A brand gate verdict | **yes**, with a reason | `override` on the verdict, immutable; the run's `overall` becomes `passed-with-override`; the piece's birth snapshot records it |
| The format gate | **yes**, with a reason | same |
| Accuracy — an unbacked claim | **yes**, by attaching proof or marking it `owner-verified` with a reason | same, with her words kept |
| Accuracy — a boundaries violation | **no** | fix the draft, or amend `boundaries/` in strategy (a dated strategy version) |
| Rights | **no** | fix the rights record on the asset or the proof item (§7) |

She is the authority in this system and the plan says so repeatedly. The two exceptions are not distrust of her judgment — they are the two places where waving something through would quietly delete a decision she already made deliberately.

---

## 7. The rights gate (S21)

S21: *"Assets and proof carry rights: ownership, consent, permitted platforms/uses, expiry, attribution, subject releases, restriction status. Gates block publication when required rights are absent."*

### 7.1 What it checks

Every asset in `asset_refs[]` and every proof item in `proof_refs[]` on the current draft version. Both already carry spec 21 §7.8's `RightsRecord`, and spec 21 already ships `rightsCleared(record, platform)`. **This spec does not define a second rights object and does not write a second checker.**

### 7.2 The one correction to the shipped helper

`rightsCleared` checks expiry against *now*. A piece scheduled for three weeks out, using a photo whose consent expires in two, passes today and is wrong on the day it posts.

**Correction, in place, not a parallel object** (the pattern spec 22 §11 established): add `rightsClearedAt(record, platform, at: string)` and reimplement `rightsCleared(record, platform)` as `rightsClearedAt(record, platform, now)`. Every existing caller keeps working unchanged. The gate calls the dated form with the piece's scheduled date, or with today when nothing is scheduled yet.

### 7.3 Where it blocks

**Not at build → review.** At build the rights verdict renders as a visible warning naming exactly which asset is missing which right, so she knows before a client ever sees the preview.

**At approved → scheduled, it blocks.** A stage write moving a piece to `scheduled` or `posted` with any rights verdict at `fail` is refused at the write door. That is what "blocks publication" means, and it is the correct boundary: a draft may be shown to the client who owns the photo; it may not go out to the world on an expired release.

Acceptance test 9 proves both halves: review is allowed, scheduling is refused, and the expiry is judged against the scheduled date rather than today.

### 7.4 The legacy problem, named honestly

Spec 21 migrated the existing assets with no rights records. On the day this ships, a strict gate would block publication on every piece with an attached photo, across the whole back catalogue. That is not S21 being honoured; that is the pipeline breaking.

**The resolution, forward-only:** each profile carries `rights_baseline: 'legacy-grace' | 'enforced'`.

- Migration sets `legacy-grace`. Under grace, an asset with **no record at all** produces a warning and a sort-queue item, not a block. An asset **with** a record that fails produces a block, exactly as normal — grace forgives absence, never a recorded refusal.
- She runs the rights pass for that profile (a list of every asset with no record, with the fields to fill). When it completes, the profile flips to `enforced`.
- **`enforced` can never flip back.** Same shape as gate versions: forward only.
- The count of ungraded assets is visible on the profile the whole time. This is a dated, visible debt, not an indefinite exemption.

If she would rather block from day one, that is one field's starting value and no code change.

---

## 8. The feedback memory (S13)

PLAN §5.1: *"feedback is classified, then ROUTED, never piled: voice feedback updates the voice profile (`voice/`) · seed feedback updates the seed itself (`topics/`) · format feedback updates platform `rules/` · performance feedback updates future costume choices."*

S13: *"Feedback is classified by scope — piece, seed, profile rule, candidate strategy change. Durable changes land as proposed diffs requiring her acceptance; original feedback and the decision are both preserved."*

### 8.1 Where feedback is captured

Three moments, no fourth.

1. **At review, hers.** She reads the draft. Below-the-bar, an edit, or a typed note. This is the highest-signal moment and the one the taste layer feeds on.
2. **At review, the client's.** The client's verdict and their words arrive through give-point 3 into the existing `work-log/creation/review` record (`audience: both`, `client_door: give:review`). **The client never classifies and never routes anything.** Their words are data; she classifies them. Out-of-scope asks auto-route to `work-log/logs/changes` per S20, which spec 21 already declared. No fifth door is created (S19).
3. **After posting.** One light prompt on a posted piece: *"Anything you learned from this one?"* Optional, dismissible, never a chore. This is where most performance-class feedback lands.

### 8.2 The five classes

PLAN §5.1 names four routes. A fifth class exists because most feedback is not durable at all, and pretending otherwise is how a system fills up with noise.

| Class | What it means | S13 scope | Routes to |
|---|---|---|---|
| **Piece-only** | "make slide 3 shorter" — true of this piece and nothing else | `piece` | nowhere. Recorded on the piece, used by the revise call, never becomes a diff |
| **Voice** | "this doesn't sound like her", "never say 'unlock'" | `profile-rule` | a proposed diff against `context/content-strategy/voice` |
| **Seed** | "the nuance is wrong — we never say the market is easy" | `seed` | a proposed amendment on the seed in `work-log/creation/topics` |
| **Format** | "our carousels should be six slides, not ten" | `profile-rule` | a proposed diff against `context/content-strategy/platforms/<platform>/rules` |
| **Performance** | "this hook landed", "the founder-observation ones do better" | `candidate-strategy-change` | a **costume recommendation**, §9.5 — recorded, marked as her observation, never binding |

A repeated voice class on the same theme also produces a **candidate gate refinement**: a proposed diff against `content-strategy/gates` that, if she accepts it, creates gate set version 2 (spec 22 §8.8). This is how PLAN §5.1 item 3's *"some gates only emerge after working with a client for a while"* actually happens, without a gate questionnaire ever existing.

### 8.3 Classification never happens by itself

The engine **proposes** a class, with its reason, on every captured item. **She confirms it.** Nothing routes on a proposed class alone. This is refinement item 4's autonomy law generalized: she triggers, the engine proposes, she picks. Acceptance test 11.

### 8.4 Routing is a proposed diff, and only that

Every durable route produces a `FeedbackItem` (spec 21 §7.12, used as shipped) with `proposed_diff: { path, before, after }` and `decision: undefined`.

Her acceptance surface, per profile, lists every waiting diff in plain words:

> *"Add 'unlock' to never-words in voice. From your note on the CareerBubble carousel, 12 August."*
> **Accept** · **Reject** · **Edit and accept**

- **Accept** applies the diff and creates strategy parameter version N+1, dated, with the feedback as its reason line (spec 22 §8.8). The strategy changelog gets an entry for free.
- **Reject** preserves the item, the diff and the rejection with her reason. **The rejections matter as much as the acceptances** — they are half the taste layer's evidence.
- **Edit and accept** stores her edited version as the applied diff and the original as the proposal. Both survive.

**Nothing applies automatically. Ever.** PLAN §5.2: *"The engine proposes; SHE decides; nothing updates strategy behind her back."*

### 8.5 The performance route, and its honest limit

PLAN §5.2 is unambiguous: soft signals are recorded but **do not feed the engine's verdicts**; the engine concludes from numbers only.

So her performance feedback lands as a costume recommendation **marked `source: 'her-observation'`**, visible on spec 24's costume surface as something she said, and it never becomes a strategy diff and never enters a drafting packet as evidence. Only spec 27's numeric verdicts write recommendations marked `source: 'verdict'`, and only those carry the evidence citation PLAN §5.2's honesty rule demands. The address is reserved in §9.5; the mechanism is spec 27's.

### 8.6 Her edits are feedback nobody writes

When she edits an engine draft, the resulting `EditDelta` is stored on the new draft version:

```
EditDelta {
  from_version, to_version,
  changes: [{ field, before, after, kind: 'shortened' | 'reworded' | 'removed' | 'added' | 'reordered' }]
  proposed_class?: 'voice' | 'format' | 'seed' | 'piece-only'
}
```

It is **not** a feedback item and it routes nowhere on its own. It is the observation stream the taste layer distils from, and it costs her nothing, because she was editing anyway.

---

## 9. The taste layer — spec 10 re-cut against the plan

Spec 10 was written 2026-07-17, before the plan existed. PLAN §8 step 6 says pending work is re-judged against the locked tree — absorbed where it fits, not deployed on momentum. This section is that re-cut.

### 9.1 What survives, and what does not

| Spec 10 | Verdict under the plan |
|---|---|
| **Half B — the taste layer.** Her accepts, edits and dismissals distilled into explicit, inspectable rules that the next draft is generated with | **Survives**, with a leak guard the original did not have (§9.3). This is the irreplaceability layer and it is worth the care |
| Rules are visible, hers, editable, deletable; nothing trains | **Survives, unchanged.** Rules are text the engine reads openly, not weights |
| A rule needs repetition (three of a kind), the system proposes, she confirms | **Survives, unchanged.** It is the same accept-a-diff pattern as everything else |
| Taste vs evidence conflicts surface, never auto-resolve | **Survives**, and §9.4 gives it a real worked example |
| **Half A — the playbook.** Cross-brand performance evidence, win-rates and patterns keyed by context | **Does not survive into any packet.** Cross-profile *numbers* have no address under the plan. §9.6 |
| Feeding spec 09's draft engine | Re-pointed: it feeds **this** spec's drafting packet, at the bottom of Block B, capped and trimmable |

### 9.2 Where taste rules live

They cannot live inside a profile — they are hers, across her whole practice, and a copy per profile would be five copies of one truth. The tree already has an owner zone (spec 21's declarations: zone `owner`, holding `shelf/profiles` and `shelf/today-strip`). Taste rules are a **law-4 addition to that zone**: `owner/taste-rules`, entry type `taste_rule`, append-only, `audience: owner`, switch `owner.taste_rules`.

```
TasteRule {
  id, rule: string                  one plain line, her language
  strength: 'law' | 'lean'
  state: 'proposed' | 'active' | 'retired'
  evidence_refs: string[]           the deltas and decisions that made it — NEVER leaves the owner surface
  de_identified: true               set only by the guard in §9.3
  proposed_at, accepted_at?, last_confirmed?, retired_at?
}
```

Distillation is a model pass over the `EditDelta` stream and the accepted/rejected diffs, **triggered by her, never on a schedule**, proposing candidate rules that meet spec 10's three-of-a-kind threshold. It uses spec 23's run-log path and the same call shape; nothing new.

### 9.3 The leak guard — this is the part that matters

The risk is exact and it is not hypothetical: a rule distilled from CareerBubble's rejections gets sent inside Divine Studio's drafting packet, carrying CareerBubble's words with it. The plan's law is that a packet is built from exactly one profile (PLAN §5.3; spec 23 §5.4, "Every other profile. Always.").

**The resolution, within the plan.** What may cross is **her instruction**, never a client's data. A rule that says *"she cuts a carousel's slide count when the pillar's job is convert"* is a fact about how Manmeet decides. It is the same category as something she typed into the box herself, and the plan has never restricted her from typing. A rule that says *"CareerBubble hated the word 'unlock'"* is CareerBubble's data wearing a rule's clothes, and it does not cross.

The line between them is drawn mechanically, not by good intentions:

1. **The de-identification gate.** Before a proposed rule may become `active`, its text is checked against every profile name, every channel account handle, every seed name and core message, every piece title and every client person's name across the whole system. A hit **refuses activation** and names the offending token. She can rewrite the rule generically and re-submit.
2. **Numbers do not cross.** A rule containing a figure that appears in any metric observation is refused. Spec 10's own rule 4, enforced instead of stated.
3. **Evidence never travels.** `evidence_refs` are profile-scoped ids. The packet assembler serialises `rule` and `strength` and nothing else. An acceptance test asserts that no evidence ref, no profile id and no profile name appears anywhere in an assembled drafting packet, and **fails when the guard is removed** (test 12).
4. **She accepted it.** No rule enters any packet before she moved it from `proposed` to `active`. A proposal that never got her yes never leaves her screen.
5. **Per-profile consent.** A second switch, `creation.taste_rules`, decides whether *this* profile's packets carry her standing habits at all. A client whose brand is deliberately unlike her defaults gets it off, and nothing about the store changes.
6. **Capped and labelled.** At most 25 active rules enter a packet, ordered by strength then recency, trimmed with the trim recorded (§4.4). They sit at the **bottom** of Block B under one line: *"These are Manmeet's standing habits across her own work. Where they disagree with anything above, what is above wins."*

### 9.4 The conflict this will actually produce, worked

Her standing habit, on record across sessions: carousels are short, five or six pages, short lines. ResumeGuru's own rules, from the taxonomy: eight to ten slides.

Under §9.3 rule 6, the profile wins: a ResumeGuru carousel is drafted at eight to ten slides. But the disagreement is not swallowed — spec 10's rule 3 stands, and the drafting screen shows it once, plainly: *"Your usual is 5 to 6 slides. This profile's rules say 8 to 10. Drafted at 8 to 10."* One line, dismissible, and if she disagrees she changes the profile's rule, which is a format-class feedback item and a dated diff.

That collision answer is, in spec 10's words, the highest-value taste data there is. It is captured because it was shown.

### 9.5 Costume recommendations — the address, reserved

A law-4 addition, `work-log/creation/costume-recommendations`, entry type `costume_recommendation`, append-only, `audience: owner`, switch `creation.engine`. Fed by `engine:analysis` (spec 27's verdicts) and `owner` (her performance feedback, §8.5). Read by `engine:content` — that is, by spec 24's costume surface.

Two things fixed now so the Analysis family cannot get them wrong, in the same spirit as spec 23 §8.3:

1. **A recommendation from a verdict carries its evidence.** A `source: 'verdict'` entry with no cited comparison or verdict id is refused at the write door. PLAN §5.2's honesty rule.
2. **A recommendation never selects anything.** It appears beside the costume pickers as a suggestion. It cannot pre-resolve a costume, cannot birth a piece, and cannot enter a drafting packet as an instruction.

### 9.6 The playbook half — raised, not smuggled

Spec 10's half A wants cross-brand performance evidence: *"how-to carousels under a Trust pillar beat baseline in 7 of 9 posts across 2 accounts."* That is one client's numbers shaping another client's work.

The plan does not permit it, in three places: everything belongs to exactly one profile (§5.3); the shelf is the only cross-profile window and it shows status, never content (§2); and packets are single-profile (S12 as spec 23 implemented it). Spec 10's own rules already conceded most of the ground — numbers never cross accounts, context match required, small-n honesty travels with the entry.

**This spec therefore builds no playbook, and no cross-profile evidence enters any packet.** Whether she wants one at all is §16 Q1, because turning it on would be a plan change and plan changes are her gate (PLAN §6). Nothing in this spec depends on her answer, and nothing here has to be rebuilt whichever way she goes: the taste store is already the place a playbook entry would sit beside, and it already has the guard that would have to police it.

---

## 10. Addresses — every folder this spec reads and writes

Per PLAN §6 rule 3, no spec ships without this table.

### 10.1 Paths WRITTEN

| Path | New? | Entry type | Fed by | Read by | Switch | History | Audience |
|---|---|---|---|---|---|---|---|
| `work-log/creation/making` | existing (spec 21) | `draft_version` | `owner`, `engine:content` | `work-log/creation/review`, `work-log/creation` | `creation.making` | `append_only` | owner |
| `work-log/creation/making/gate-runs` | **new (law 4)** | `gate_run` | `engine:content`, `owner` | `work-log/creation`, `work-log/creation/review`, `work-log/analysis/study-own-data` | `creation.gates` (fixed) | `append_only` | owner |
| `work-log/creation/costume-recommendations` | **new (law 4)** | `costume_recommendation` | `engine:analysis`, `owner` | `engine:content` | `creation.engine` | `append_only` | owner |
| `owner/taste-rules` | **new (law 4, zone `owner`)** | `taste_rule` | `owner`, `engine:content` | `engine:content` | `owner.taste_rules` | `append_only` | owner |
| `work-log/logs/feedback` | existing (spec 23) | `feedback_item` | `owner` | `owner`, `engine:content`, `context/content-strategy` | `logs.feedback` (fixed) | `append_only` | owner |
| `work-log/logs/engine-runs` | existing (spec 23) | `engine_run` | `engine:content`, `engine:analysis` | `owner` | `logs.engine_runs` (fixed) | `append_only` | owner |
| `work-log/creation` | existing (spec 21) | `piece` | `owner`, `engine:content` | many | `creation.board` | `append_only` | both (`see:upcoming`) |
| `context/content-strategy/voice` · `platforms/*/rules` · `gates` | existing | `strategy_parameter` / `gate_set` | `owner` (**only on her acceptance of a diff**) | `work-log`, `engine:content` | `strategy.fixed` | `versioned` | owner |
| `work-log/creation/topics` | existing (spec 23) | `seed` | `owner`, `engine:content`, `engine:analysis` | `work-log/creation`, `engine:content` | `creation.engine` | `append_only` | owner |

The strategy and seed rows are written **only** as the result of her accepting a proposed diff (§8.4). The engine never writes them directly. This is PLAN §1's boundary: an engine is a tool inside the body; it does not curate Context.

### 10.2 Paths READ (and never written)

`context/content-strategy/boundaries` · `positioning` · `pillars/*` · `platforms/*` (`how-it-works`, `formats`, `rules`) · `audience-decided` · `ctas` · `proof-library` (titles, kinds, rights) · `visual-branding` · `cadence` · `toolset` · `working-mode` (review configuration) — and `work-log/assets/sets/*` (rights records, references only) · `work-log/creation/review` (the client's words, at classification time) · `work-log/creation/scheduling` (the scheduled date, for the rights expiry check).

**Read but never written** is load-bearing. The Content Engine produces; it does not store, schedule, or own the client's information (PLAN §1, §5.3).

### 10.3 Law-4 additions for the control room to ratify into PLAN §3

| Path | Why | Fed by | Read by | Switch |
|---|---|---|---|---|
| `work-log/creation/making/gate-runs/` | S14 requires every verdict to carry its gate version and old pass records to be immutable. Without an address that amendment cannot be honoured, and analysis has nowhere to read "what standard judged this piece". | the engine; her overrides | the piece's stage guard; review; analysis | `creation.gates` |
| `work-log/creation/costume-recommendations/` | PLAN §5.2's loop-back writes winning combinations into the engine room. Declared here so spec 27 cannot invent a second home, with the evidence rule already enforced. | `engine:analysis` (verdicts), her (observations, non-binding) | the costume surface (spec 24) | `creation.engine` |
| `owner/taste-rules/` (zone `owner`) | Spec 10's taste layer, re-cut. Cross-profile by nature, so it cannot live in a profile; the owner zone is the plan's only place for that, and the de-identification guard is what makes it lawful. | her (acceptance), the engine (proposals) | drafting packets, per profile, behind `creation.taste_rules` | `owner.taste_rules` |

---

## 11. Switches registered

Every feature registers its switch at birth (PLAN §3.4, her law). Suggested defaults only — **she finalizes every position**, after intake → curation → strategy.

| Switch | Owns | Requires | Dependents | Audience | States | Suggested |
|---|---|---|---|---|---|---|
| `creation.making` *(existing)* | drafts and versions | `creation.board` | `creation.making_handoff`, `creation.drafting`, `creation.gates` | owner | active / history / hidden | active |
| `creation.drafting` **(new)** | the drafting model call | `creation.making` | — | owner | active / hidden | active |
| `creation.gates` **(new, fixed)** | the seven-gate run and the gate-run record | `creation.making` | — | owner | active only | active |
| `creation.rights_gate` **(new, fixed)** | S21's publication block | `creation.making` | — | owner | active only | active |
| `creation.post_learning` **(new)** | the after-posting "anything you learned" capture | `creation.board` | — | owner | active / hidden | active |
| `creation.taste_rules` **(new)** | whether THIS profile's drafting packets carry her standing habits | `creation.drafting`, `owner.taste_rules` | — | owner | active / hidden | active |
| `owner.taste_rules` **(new, owner-level)** | the taste store and its screen, across her whole practice | — | `creation.taste_rules` | owner | active / hidden | **hidden** — it has nothing to say until roughly three months of edits exist. Flipping it on later changes no stored data |
| `logs.feedback` *(existing, spec 23, fixed)* | the feedback record | — | — | owner | active only | active |
| `logs.engine_runs` *(existing, spec 23, fixed)* | the run log | `creation.engine` | — | owner | active only | active |

**Why three are fixed.** PLAN §5.1: nothing reaches review until all seven gates pass. S21: gates block publication when rights are absent. S13: the original feedback and her decision are both preserved. A switch that could turn any of these off would make the law a lie. They get registry records with `allowed_states: ['active']` and a `fixed` marker, so the registry stays exhaustive per her law.

**The cascade, traced.** `creation.making → hidden` removes drafting, gates, and the whole making surface on her side; existing drafts and gate runs move to `history` and stay readable — nothing is deleted (S9). `creation.drafting → hidden` alone leaves gates, review and the board fully working and only stops the model call: the honest off-switch for a profile where she writes everything herself. `platforms.linkedin → hidden` removes LinkedIn's formats and rules from every packet and every gate run, on her side and the client's, in both directions (test 13).

**Validation at strategy lock** (S8, spec 21 §5.3) gains two checks:

1. `creation.drafting` cannot be `active` on a profile whose `content-strategy` has never locked. A draft grounded on nothing misses the bar by construction.
2. `creation.taste_rules` cannot be `active` while `owner.taste_rules` is not. This is a prerequisite, so the existing cascade resolver already enforces it; it is named here so nobody adds a second check.

---

## 12. Audiences

### 12.1 The default

Everything this spec writes is `audience: owner`: drafts, gate runs, verdicts, overrides, feedback items, classifications, taste rules, run logs, costume recommendations. No path carries a new `client_door`, so the validator's no-fifth-door check passes trivially.

**The workshop rule, restated because it is absolute:** no switch, in any position, can grant a client sight of a draft version history, a gate verdict, an override, a feedback classification, a taste rule, a run log, or a cost. PLAN §4, CLAUDE.md rule 1, KRNL OS rule 1.

### 12.2 The one thing a client sees, and how

The client sees the preview at review (give-point 3) and upcoming content (`see:upcoming`). The draft object lives at `work-log/creation/making`, which is `audience: owner`. These two facts have to be reconciled without making a copy, because PLAN §3.11 forbids a second copy of a piece anywhere.

**The resolution: a server-side whitelist projection.** `clientPreviewOf(draftVersion)` returns a fixed set of presentational fields and nothing else:

- carousel: `slides[].heading`, `slides[].lines[]`, `caption`, `cta_line`, rendered media
- reel: `script[].spoken`, `script[].on_screen_text`, `caption`, `cta_line`
- static / longform / newsletter: the equivalent presentational fields only

**Never projected:** `claims[]`, `proof_refs[]`, `notes_for_her`, `leave_out_check[]`, `edit_delta`, `engine_run_id`, `gate_run_id`, any verdict, any version other than `current_draft_version_id`, any cost.

It is a **whitelist, not a blacklist**, and acceptance test 14 proves that adding a new field to the draft object does not automatically expose it. That distinction is the whole guarantee: a blacklist leaks the day someone adds a field and forgets.

### 12.3 Non-owner logins

Spec 21's build found and closed exactly this class of leak. Every path here is filtered out of every non-owner body by the declarations, server side. Test 14 re-runs that check against the new paths and verifies it **fails** when the audience filter is removed.

---

## 13. Migration

Boring on purpose. Nothing about this spec's build changes existing data.

### 13.1 The migrated pieces

- **No piece is retro-gated.** A posted piece stays posted. Its birth snapshot records `gate_version: null` — honest: it predates the gate set. It renders normally everywhere.
- A migrated piece she pulls back into build is drafted and gated under the **current** gate set version. Forward only, always.
- Whatever draft text a legacy content card carries migrates as **draft version 1 with `origin: 'hers'` and `engine_run_id: null`.** Nothing is attributed to the engine that the engine did not write.
- The exact counts come from the migration report; the rules hold whatever the numbers turn out to be on the real `apply: true` run.

### 13.2 Assets and rights

Per §7.4: migration sets `rights_baseline: 'legacy-grace'` on every profile, writes one sort-queue item per asset with no rights record, and shows the ungraded count on the profile until she runs the pass. Absence is a warning; a recorded refusal is a block from day one.

### 13.3 The gate set

Nothing to migrate. Spec 22 derives and locks v1; before that lock, drafting and gating are refused server side (spec 22 §8.7), which is the correct behaviour and not a gap.

### 13.4 Order of build

1. The declarations and switches for the three new paths, validator green with an empty tree.
2. The draft version object, the append-only history, `resolveDraft`, and the hand-written draft path. **A shippable stopping point**, and the correct one if the API key is ever unset or dead: she writes drafts by hand, gate machine checks run, model gates report "not run".
3. The machine gate checks: format rules merge, boundaries scan, proof presence, her-hook verbatim guard, the convert-carousel prohibition.
4. The gate run record, the stage guard at build → review, versioning and immutability.
5. The rights gate, the dated helper correction, the approved → scheduled guard, the legacy grace flag.
6. The drafting model call, the packet profile, the run log, the revise loop and its ceiling.
7. The gate model call, the reviewer packet, the evidence-span requirement.
8. Feedback capture, classification, proposed diffs and her acceptance surface.
9. Edit deltas, then the taste store, its guard, and its packet block — last, because it has nothing to say until the deltas exist.

One profile at a time, pilot first, her own profile, never a client's.

### 13.5 Nothing is deleted

No legacy slice is touched. Everything spec 21 left at `history` stays exactly as it is.

---

## 14. Acceptance tests

Run by `npm test`, alongside spec 21's 70 and spec 23's 12. No dependencies, no build step.

1. **Her hook survives.** A brief carrying a hook produces a draft whose slide 1 (or first spoken line, or opening claim) is that hook byte-identical after whitespace normalization. A model response that reworded it is rejected, the run retries once, and a second rewording yields no draft and a logged violation.
2. **Slide copy, not essays.** A carousel draft with a 47-word slide fails the format gate, and the failure quotes the rule and the slide. A draft within the caps passes. The schema cannot represent a paragraph-only slide at all.
3. **Reels are speakable.** A reel script containing bullet characters, headings, or a 60-word single line fails the format gate. A spoken-language script passes.
4. **Override beats universal.** With ResumeGuru's carousel rule (8 to 10 slides) present, a 6-slide draft fails. With the override removed, the same draft passes against the universal rule. The `format_rules_resolution` on both runs differs and is recorded.
5. **The convert-carousel prohibition.** Costume `format: carousel` with `objective: conversion` on a profile carrying "never use carousel as the convert format" fails the format gate before any model call is made, and the run logs `model: null`.
6. **Seven, not six.** A piece with six passing verdicts cannot leave build state; the write is refused with the reason. Removing the guard makes the write succeed — proving the guard is what stops it, not luck.
7. **Gate versions are forward only.** Lock gate set v2. Every v1 gate run is byte-identical to what was written. A piece that passed under v1 still reports `gate_version: 1`. A piece re-drafted after the lock runs under v2.
8. **Accuracy has teeth.** A claim of a result with `proof_id: null` is flagged, not silently passed. Attaching a valid proof id clears it. Marking it `owner-verified` clears it and records her words. A draft containing a never-promise phrase from `boundaries/` fails, and no override path exists for it in the API or the UI.
9. **Rights block publication, not review.** A piece with an asset whose consent is `not-given` moves build → review normally and is refused at approved → scheduled. A piece whose asset rights expire before its scheduled date is refused even though the rights are valid today. Under `legacy-grace`, an asset with no record at all warns and does not block; after the flip to `enforced`, it blocks; the flip cannot be reversed.
10. **Feedback routes as a diff, never an application.** A voice-class item produces a `proposed_diff` and changes nothing. Accepting it applies it and creates strategy parameter version N+1 with the feedback as its reason. Rejecting it preserves the original words, the diff, and her reason. Neither path ever writes strategy without her decision.
11. **Classification is never automatic.** A captured item with only a `proposed_class` routes nowhere. Every routing path asserts a confirmed class and refuses without one.
12. **Taste rules never leak.** A proposed rule containing a profile name, a channel handle, a seed name, a piece title, or a figure present in any metric observation is refused activation, with the offending token named. An assembled drafting packet contains no evidence ref, no profile id, and no other profile's name. **The packet assertion fails when the guard is removed.**
13. **The packet honors the cascade.** With `platforms.linkedin → hidden`, no LinkedIn name, format, or rule appears anywhere in an assembled drafting packet or gate packet. Flip it to `history` and it still does not enter, while every past LinkedIn piece and its gate runs stay readable.
14. **No client, no leak.** A client login and an intern login both receive a body with zero entries at `making`, `gate-runs`, `costume-recommendations`, `taste-rules`, `engine-runs`, and `feedback`. `clientPreviewOf` returns only whitelisted fields; adding a new field to the draft object does not expose it. Both checks **fail** when the filters are removed.
15. **Keyless honesty.** With no `ANTHROPIC_API_KEY`: build state opens, hand-written drafts work, machine gate checks run and report, model-judged gates report `not-run`, the piece cannot leave build, and the reason is stated plainly. Nothing fabricates a draft or a verdict, and no run is logged.
16. **The run log is complete.** Every drafting call and every gate call — success, refusal, short-circuit, or error — writes exactly one `engine_run` carrying model, effort, packet folder list, context version, gate set version, format rules resolution, token counts, cost estimate and outcome. A run with no packet record fails the test.
17. **The revise ceiling.** Three failed gate runs on one piece produce exactly two automatic revise calls and no third. The third state is the brief-level message, not another spend.
18. **Append-only holds.** Twenty draft versions on one piece resolve in order to the expected current state; version 1 is byte-identical to what was first written; a write attempting to edit an existing draft version or gate run throws.

---

## 15. What this spec deliberately does not do

- **It does not derive gates.** Spec 22 does, with strategy, once, at v1.
- **It does not compute a number.** PLAN §5.2's trust rule: every number is computed by code, AI only words and explains. This spec's model never sees a metric and never states one.
- **It does not schedule, publish, or run the client review workflow.** It defines two stage boundaries and guards them.
- **It does not touch the chat thread or the untagged inbox.** FROZEN, exactly as PLAN §11 ordered.
- **It does not build the Analysis loop-back.** It reserves the address and fixes the two rules spec 27 must honour.
- **It does not build a playbook.** §9.6, and §16 Q1.
- **It does not deploy.** DEPLOY.md and CLAUDE.md rule 6 stand: her explicit go, every time.

---

## 16. Open question — one, and it is hers

Everything else in this spec was answerable from the plan, from spec 21's objects, or from spec 22's and 23's decisions. Four candidates were answered from the plan rather than raised: the gate override rules (§6.9, resolved on the principle that she is the authority except where waving something through would delete a decision she made deliberately), the revise ceiling (§4.10, resolved on what a repeated failure actually means), the rights grace period (§7.4, resolved as a dated forward-only debt rather than an exemption), and the spend (§4.3, which rolls into spec 23 §16 Q1 rather than opening a second money question).

**Q1 — May cross-profile performance evidence ever exist, and does she want it?**

Spec 10's playbook wants one client's results to teach the next client's drafts: *"how-to carousels under a Trust pillar beat baseline in 7 of 9 posts across 2 accounts."* The plan says no in three places (§5.3 everything belongs to one profile; §2 the shelf shows status never content; S12 as implemented, one profile per packet), so this spec builds none of it and no cross-profile number enters any packet.

Her judgment is a different matter and is already resolved: the taste layer crosses profiles because the rules are hers, de-identified, and accepted by her one at a time (§9.3). That half builds.

What is genuinely hers to answer is the other half:

1. **No, keep it single-profile.** Simplest, matches the plan as locked, and at three profiles a playbook would say very little anyway — spec 10's own small-n honesty.
2. **Yes, patterns only, never numbers.** A cross-profile entry may carry a pattern and a context match but no metric value, subject to the same de-identification guard as a taste rule. This is a plan change to PLAN §5.3 and therefore her gate.
3. **Yes, with numbers, owner-only, never in a packet.** A reading surface for her alone — she carries what she learns into the work herself. No leak risk, no packet change, no plan change to §5.3's packet law; it would still need an address ratified into §3.

**This spec builds nothing that depends on her answer, and nothing here has to be rebuilt whichever way she goes.** The taste store already sits where a playbook entry would sit beside it, with the guard that would police it.
