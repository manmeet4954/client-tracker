# 23 — Content Engine I — Seed Bank & the Engine Room

**Status:** BUILT, NOT DEPLOYED (2026-07-27). Built in §14.3's order; all 12 acceptance tests in §15 green alongside specs 21 and 22's 96 (132/132), typecheck clean, production build green. Build record in `dashboard/STATE.md`. The one open question (§16, the spend ceiling) is untouched by the build, as the spec says. First spec of the Content Engine family (PLAN §5 — "each engine gets its own separate family of specifications"). Written in a fresh chat per PLAN §6, from `PLAN.md` (including section 10, the Sol Amendments) and `specs/21 — Data-Layer Restructure.md`.

**Authority:** `PLAN.md` outranks this file. Where this spec and the plan disagree, the plan wins. Where an amendment in plan section 10 touches anything below, the amendment wins. Spec 21 is the data-layer contract underneath this spec: its canonical Seed and Piece objects, its declaration contract, its switch registry, and its path-scoped write door are used as they are. **This spec invents no second version of anything spec 21 declared.** Where it needs a field spec 21 does not have, that field is listed explicitly in §6.4 and nowhere else.

**Why this is spec 23 and not spec 19 rewritten:** spec 19 was a DRAFT written before the plan existed, and it asked her to pick a door (vault files / dashboard / standalone). The plan closed that: the Content Engine is a sub-app inside Creation (PLAN §3.10), its home is `work-log/creation/`, and its component map is PLAN §5.1. Spec 19 survives only as raw material — its knowledge-layer idea is now the context bundle, its independence requirement is now the grounding law, and its "one seed, many posts" promise is now the seed/piece law (S1). Nothing else of it is carried forward.

---

## 1. What this spec is, and is not

**It is:**

1. **The Engine Room as a screen** — the brainstorm space PLAN §2 item 3 describes, opening from *"what are we talking about today?"*, never a step-pusher form.
2. **The "Create a seed" flow** — she narrates or pastes raw material; the engine (a real model call, grounded per S12) analyzes it and PROPOSES seeds; one conversation can yield several; each proposal is shown separately; she picks, refines, and locks.
3. **The seed template as entry fields** — every field of PLAN §5.1's template, on screen, with the founder's raw thought kept verbatim forever and the four-step status ladder.
4. **The seed bank** — browse, filter, and the seed detail page that lists the pieces that seed has mothered.
5. **The model layer, concretely** — which model, what enters the context packet, what is logged per output, and how output quality is checked. PLAN §5.1's INTELLIGENCE BAR makes this mandatory: "the engine specs must cover the model layer itself… not just screens and storage."
6. **The lock guard** — only locked seeds may mother pieces, enforced in the data layer so no later spec can bypass it.

**It is not:**

- **The costume surface.** Selecting pillar · objective · audience stage · angle · hook type · format · platform · length · product intensity · CTA · voice · proof, resolving a multi-select into candidate pieces (S4), the internal brief, the drafting call, and the seven gates are **Content Engine II**. This spec ends where a locked seed exists and the room's request layer begins.
- **The Analysis Engine.** Its proposals get an address here (§8.3) so it cannot invent a second home later; its mechanism is its own family.
- **Intake.** Client-brought ideas arrive through intake (§10). The intake spec ships the parameter inventory after her vocabulary session (PLAN §11 Q4).
- **The GUI restructure.** The profile-first shell (shelf → profile → three apps) is its own spec. This spec describes ONE screen inside the Creation app and states what it needs from the shell.
- **Anything client-facing.** Every path in this spec is `audience: owner`. The workshop rule is absolute (PLAN §4, CLAUDE.md rule 1).

---

## 2. Where this sits, and what it needs first

### 2.1 Order

PLAN §8 step 6: data-layer restructure → intake → Content Engine → Analysis Engine → client-side regroup. Spec 21 is built and deployed. The intake spec is not written yet. **This spec does not wait for intake**, because the Engine Room reads Context but never writes it, and because her own profiles (ResumeGuru first) already carry a migrated body.

### 2.2 What must be true before this builds

| Precondition | State today | If missing |
|---|---|---|
| Spec 21 deployed, path-scoped writes live | done (deploy `a65079a`) | blocked — the append-only guarantees below are lies without it |
| `ANTHROPIC_API_KEY` set in Vercel | set (verified 2026-07-26 in the Vercel project; rotate the key if extraction ever returns fallback) | the room opens, the bank works, extraction is disabled with an honest message. Nothing fakes a proposal. |
| The pilot profile migrated for real (`apply: true`) | dry run done, apply parked to the collective phase | the room reads the legacy slices instead of the body; extraction refuses (§14.3) |
| Strategy derived and locked for the profile | not for any profile | the room opens and says so: proposals will be shallow (§5.6) |

### 2.3 What a profile's lifecycle grants

Per S22 and spec 21 §6: a profile at `setup` cannot open creation until strategy locks — the Engine Room is **not rendered** there. A profile at `active` opens the room. A profile at `paused`, `closing`, or `archived` opens the room read-only: the bank browses, extraction refuses, nothing writes.

---

## 3. The Engine Room — the screen

### 3.1 The law it is built against

PLAN §3.10, on record and binding: *"the engine is not a form that pushes you to the next step. It is a separate, powerful space to brainstorm in… the engine serves, never rails."* PLAN §2 item 3: it *"starts from 'what are we talking about today?'"*

Everything below is designed against exactly that. **There is no wizard, no step counter, no "next" chain, and no required field anywhere except the six lock gates in §6.5.** She can enter the room and leave without creating anything. She can create a seed entirely by hand and never call the model. She can call the model and dismiss everything it says.

### 3.2 The room, on screen

One route: `creation/engine` inside the profile. Lightly skinned in the profile's brand color, like the rest of the profile.

**Desktop — two columns.**

- **Left, the wide side: the open box.** One line above it, in her language: *"What are we talking about today?"* Under it, one big text area that accepts anything — typed narration, a pasted client WhatsApp message, a voice-note transcript, a half-thought. Below the box, one quiet line: *"Paste anything. Transcripts, client messages, your own rambling. Length is welcome."* One button: **Find the seeds in this.** One secondary link: **Write a seed myself** (opens an empty seed sheet, model never called).
- **Right, the narrow side: the seed bank shelf.** Locked seeds first, then validated, discussed, draft. Each row: name, status dot, pillar chips, and a piece count ("4 pieces · 2 posted"). A search box and the filters from §7.2 sit above it.

**Mobile — one column, the box on top, the shelf below it.** The proposals arrive as a bottom sheet; the seed sheet opens full-screen. Bottom tab bar per PLAN §2 item 4.

**What is deliberately absent:** no "recommended next action", no empty-state nagging, no progress bar, no counter telling her how many seeds she "should" have. The room's empty state is one line: *"Nothing here yet. Talk something out when you're ready."*

### 3.3 The three things the room can do

1. **Sit with what exists** — browse and filter the bank, open a seed, read its raw thought, see its pieces. No model call, no cost, no writes.
2. **Capture and extract** — §4.
3. **Write a seed by hand** — the same seed sheet as §6, empty, with the raw-thought box as the first field. `origin: 'hers'`, no run logged, no proposal. This path exists because the engine serves and never rails: she must always be able to bypass it.

---

## 4. "Create a seed" — the capture door

This is PLAN §5.1 refinement item 2, verbatim as law: *"The capture door is 'Create a seed.' She narrates — talks the topic out, pastes raw client material, shares what she has and what she wants to present. That raw draft goes in; the engine analyzes it and proposes the seeds it finds (one conversation can yield two, or three — each shows up separately). Every seed stores ALL the raw information it was born from, forever."*

And refinement item 4: *"Autonomy: she triggers, the engine proposes, she picks."*

### 4.1 The flow, step by step

1. **She writes or pastes into the box.** Nothing happens. No autosave prompt, no analysis, no suggestion. The text is hers until she says otherwise.
2. **She presses "Find the seeds in this."** This is the trigger, and the only trigger. Nothing extracts behind her back — not on paste, not on a timer, not when a client message arrives, not ever.
3. **The capture is written first**, before the model is called, to `work-log/creation/topics/captures` as a `seed_capture` entry: the text exactly as she gave it, the time, and how it arrived (`typed` / `pasted` / `from-intake-answer` / `from-transcript`). **Append-only. Never edited, never trimmed, never summarized in place.** If the model call fails, the capture is still there and she can retry against it.
4. **The engine runs** (§5). One model call. A quiet working state — no fake progress steps, one line: *"Reading it."* Typical wait: 20–60 seconds at the effort setting in §5.3.
5. **Proposals arrive as separate cards** (§8). One conversation yielding three seeds shows three cards, not one long answer.
6. **She picks one up, or dismisses it.** Picking up opens the seed sheet pre-filled. Dismissing writes a feedback item and the proposal stays in the record at `state: 'dismissed'` — nothing is deleted (§9.2, S13).
7. **She refines and locks** on her own time. A picked-up proposal becomes a `draft` seed the moment she picks it up; nothing is auto-locked, ever.

### 4.2 Adding to an existing seed later

Refinement item 2 again: *"Adding a seed later = give a new talked-out draft; the engine analyzes again."*

From a seed's detail page there is a second capture box: **"Talk more about this one."** The capture is written the same way and linked to that seed. Extraction runs with the existing seed included in the packet and one extra instruction: *this capture is about seed X — deepen it, or tell me it is actually a different seed.* Two possible outcomes, both shown as proposals:

- **`kind: 'deepen'`** — proposed additions to named fields of seed X. Picking it up appends an amendment to the seed (§6.3). Her existing wording is never overwritten by the engine; a deepen proposal that touches a field she already filled shows both, side by side, and she chooses.
- **`kind: 'new-seed'`** — the engine says this is a different idea. Same as a normal proposal.

**The raw thought and the raw material of seed X are never touched by this path.** They are append-only forever.

### 4.3 The three subjects that came over as capture input

The ResumeGuru migration wrote three legacy `topics[]` / `evergreenIdeas[]` entries as `draft` seed shells with an empty `raw_thought` and a note that a subject is capture INPUT, not a seed (S24). They sit in the profile's sort queue.

In the room they render in the bank at status `draft` with a visible badge: **"Not a seed yet — talk it out."** Opening one shows the seed sheet with its capture box already open and the legacy line pre-filled as read-only context. It cannot pass the lock gates (§6.5) because `raw_thought` is empty. That is the migration's promise made mechanical, not a reminder she has to remember.

---

## 5. The model layer — the intelligence bar, made concrete

PLAN §5.1's law: *"when she selects a seed and its doors, the recommendations and drafts that come out must MATCH the quality she gets from talking directly to a frontier LLM (Claude, Sol) with full context. 'If that was not the case, why was I even building it.'… A cheap model that saves money but misses the bar fails the spec."*

This section is the spec's answer. It is deliberately specific: a later build chat must be able to write this call from this section alone.

### 5.1 The model

**`claude-opus-5`**, through the official SDK already in `package.json` (`@anthropic-ai/sdk` ^0.111.0) — not the raw `fetch` the chat brain uses, so refusal handling and structured outputs come from the SDK rather than being hand-rolled.

The chat brain's `claude-haiku-4-5` is the wrong model here and the choice is not a cost question: the chat brain routes short messages into folders; this call reads a rambling human conversation and has to find the belief underneath it. That is the exact task the intelligence bar was written about.

**Rules that come with this model** (they are 400 errors, not preferences):

- No `temperature`, `top_p`, or `top_k`. Steering is done by the prompt.
- No `budget_tokens`. Thinking is **on by default** on this model; depth is set by `output_config.effort`.
- No assistant-turn prefill. Output shape comes from `output_config.format`.
- `max_tokens` caps thinking **plus** output. Set it generously (§5.3) or the proposals truncate mid-field.

### 5.2 The call

```
model:          claude-opus-5
max_tokens:     16000            (non-streaming; thinking + output share this)
output_config:  { effort: "high",
                  format: { type: "json_schema", schema: PROPOSAL_SCHEMA } }
thinking:       default (adaptive, on) — display "omitted"; we do not surface reasoning
system:         [ universal engine block  (cache_control: ephemeral) ,
                  context packet block    (cache_control: ephemeral) ]
messages:       [ { role: "user", content: <the capture, verbatim, plus the ask> } ]
betas:          [ "server-side-fallback-2026-07-01" ]
fallbacks:      "default"
```

Three things about that shape:

- **Structured output, not prose parsing.** `PROPOSAL_SCHEMA` (§5.5) forces valid JSON with every seed-template field present and nullable. No regex, no "parse the model's markdown", no silent field loss.
- **Prompt caching where it actually pays.** The two system blocks are the stable prefix — the universal engine method and the profile's context packet. The volatile part (her capture) sits after the last breakpoint, in the user turn. Repeat extractions in the same working session read the packet from cache at about a tenth of the price. This model's minimum cacheable prefix is 512 tokens, so even a thin profile's packet caches.
- **Refusal handling.** `stop_reason` is checked before `content` is read. A refusal never renders as an empty proposal list with no explanation; it renders as *"The model declined this one. Nothing was saved as a proposal — your capture is still here."* and the run is logged with its refusal category.

### 5.3 Effort, cost, and the honest number

`effort: "high"` for seed extraction. This is the intelligence-sensitive end of the system — the whole point of the seed is that a shallow read produces a post idea, not a seed. Lower effort is not offered as a per-run toggle; the switch in §12 is on/off, not cheap/expensive, because a cheap-but-present engine is exactly the failure the bar names.

**What a run costs, plainly.** Input at $5 per million tokens, output at $25 per million, cache reads at about a tenth of input.

| Part | Size | Cost |
|---|---|---|
| Context packet (first run in a session) | 8k–20k tokens | $0.04–$0.10 |
| Context packet (cached, repeat runs) | same | $0.004–$0.01 |
| Her capture | 0.5k–4k tokens | ~$0.01 |
| Proposals out (2–4 seeds, full template) | 2k–6k tokens | $0.05–$0.15 |

**About 15–25 cents per extraction, most of it the output.** Twenty extractions a month across five profiles is roughly $15–25/month. That number belongs on record because money is her gate (PLAN §6) — see the open question in §16.

### 5.4 The context packet (S12) — exactly what enters

The packet is assembled fresh from the body on every run, versioned, and logged. Nothing is trained, nothing is remembered between calls: the model reads structured truth each time (PLAN §5.3, "Grounding").

**Only `active` paths enter the packet.** A path at `history` or `hidden` is excluded — a retired platform never shapes a proposal (S9 + the cascade). A folder whose switch resolves to anything but `active` is not in the packet at all.

**Block A — mandatory constraints. Always first, always whole, never trimmed to fit.**

| Source | Why it is mandatory |
|---|---|
| `context/content-strategy/boundaries` | prohibited claims, never-promises, the unwanted audience (S21-adjacent, PLAN §5.1) |
| `context/content-strategy/voice` (never-words only) | language the brand does not use |
| `context/content-strategy/positioning` | what this brand actually is |
| Four fixed operational rules | (1) the raw thought is quoted verbatim, never paraphrased; (2) any field the capture does not support comes back `null`, never invented; (3) a proposal must be able to produce more than one post or it is a post idea, not a seed; (4) nothing is claimed that `proof-library` cannot back — say what proof is needed instead |

**Block B — relevant folders.**

| Path | What is sent |
|---|---|
| `context/personal-details/identity` · `journey` · `voice-of-the-person` · `ambitions` · `history` | full |
| `context/business-details/offers` (hero marked) · `buying-route` · `market` · `pains` · `audience-raw` | full |
| `context/content-strategy/audience-decided` | full, including the stage lens |
| `context/content-strategy/pillars/*` | name, job, description, mix target, seed examples |
| `context/content-strategy/platforms/*` | platform names and their `formats` names only — format RULES belong to drafting (Content Engine II), not to understanding an idea |
| `context/content-strategy/proof-library` | titles and kinds only, never the assets themselves |
| `context/content-strategy/ctas` · `goals` | labels only |
| `work-log/creation/topics` | the existing seed bank as an INDEX — id, name, core message, status. This is what lets the engine say "this is seed 3 again" instead of proposing a duplicate |

**Deliberately excluded, and the reason:**

- Everything in `work-log/` except the seed index — drafts, review verdicts, schedules, metrics. Understanding an idea does not need last month's saves. (Analysis-born suggestions arrive as proposals, §8.3; they do not enter this packet.)
- Asset and proof binaries — titles only. Rights (S21) are a publication gate, not an extraction input.
- Every other profile. Always. A packet is built from exactly one profile's `context/`.
- Everything under `frozen/` — the chat thread and the untagged inbox stay out, exactly as PLAN §11 ordered.
- Her `logs/observations`. Soft signals are hers to read (PLAN §5.2); they do not shape a proposal.

**Packet size guard.** If Block A plus Block B exceeds 60% of the model's context window, Block B is trimmed **from the bottom of the table upward** (goals → ctas → proof titles → platforms → …), Block A is never trimmed, and the trim is recorded in the run log and shown to her: *"This profile's context is large — the engine read everything except [list]."* No silent truncation. Ever.

### 5.5 What comes back

`PROPOSAL_SCHEMA` — an object with one array, `proposals`, each item carrying:

- `kind`: `"new-seed" | "deepen"`
- `name` — a short handle, her language not marketing language
- every field of the seed template (§6.1), each nullable
- `evidence_span` — a verbatim substring of the capture the proposal came from
- `why` — one plain line: why this is a seed and not a post idea
- `duplicate_of` — the id of an existing seed if this is the same idea, else null
- `target_seed_id` — for `deepen` proposals
- `confidence` — `"clear" | "thin"`; `"thin"` means the capture did not really carry this and she should talk more

### 5.6 How output quality is checked

Six machine checks run before a single proposal is shown. They do not judge taste — she does. They catch the specific failures that would make the bar unmeasurable.

| # | Check | On failure |
|---|---|---|
| 1 | **Schema valid** | guaranteed by structured outputs; a malformed response is a run error, no proposals shown |
| 2 | **Verbatim guard** — `raw_thought` and `evidence_span` must each be an exact substring of the capture (whitespace normalized) | the proposal is REJECTED and the run retried once with the violation named. This is what makes "kept verbatim forever" mechanical rather than a promise |
| 3 | **Seed-vs-post test** — the proposal must carry a `reframe` AND (≥2 `possible_pillars` OR ≥3 `possible_angles`) | shown, but badged **"post idea, not a seed"**, and it cannot be locked without her filling the gap |
| 4 | **Boundary check** — no proposal text may contain a phrase from `boundaries/`'s never-promise list | shown, badged **"crosses a boundary"**, with the boundary named |
| 5 | **Invention check** — if the capture is under ~150 words and the proposal fills more than eight fields, badge **"thin capture — check for invention"** | shown with the badge |
| 6 | **Duplicate check** — the model's `duplicate_of`, plus a local exact-name match against the bank | shown, badged **"looks like [seed name]"**, with a link |

Check 2 rejects. Checks 3–6 badge and never hide: hiding a flawed proposal would teach her the engine is smarter than it is.

**Then the real bar.** Every proposal card carries **"Below the bar"**. Pressing it writes a feedback item scoped `profile-rule` (S13) carrying the run id, the packet version, and her one-line reason, into `work-log/logs/feedback`. Two things follow: the run is traceable to what it was given, and the count of below-bar marks over time is the honest measure of whether the engine is holding the bar. If that count is not falling, the loop is broken and we fix the loop.

### 5.7 What is logged, per output (S12)

Every run writes one `engine_run` entry to `work-log/logs/engine-runs`. Append-only. Retained forever (PLAN §11 Q5).

```
id, kind: "seed_extraction", profile_id, triggered_by: "owner",
packet: { packet_id, context_version, folders[], mandatory_constraints[], trimmed[] },
model: "claude-opus-5", effort: "high", thinking: "adaptive",
schema_version, prompt_version,
capture_ids[], proposal_ids[],
usage: { input_tokens, cache_read_input_tokens, cache_creation_input_tokens, output_tokens },
cost_estimate_usd, latency_ms, stop_reason, refusal_category?,
checks: { rejected: n, badged: [{ proposal_id, check }] },
started_at, finished_at, error?
```

The run log never stores the API key, never stores another profile's data, and is `audience: owner`.

**`context_version`.** S12 requires a versioned packet, and the body has no version counter today. This spec adds one: `ProfileBody.context_version`, a plain integer incremented by the path-scoped write door whenever any path under `context/` is written for that profile. Cheap, because writes already declare their paths. Every packet, and therefore every proposal, is traceable to the exact state of Context it was assembled from.

---

## 6. The seed, as entry fields

### 6.1 The template on screen

The canonical `Seed` object is spec 21 §7.1 (`lib/tree/objects.ts`). **This spec does not redefine it.** It renders it. One field per row, all optional except the lock gates, in this order:

| On screen | Field | Note |
|---|---|---|
| Name | `name` | short handle |
| **What you actually said** | `raw_thought` | pinned at the top, quoted, **read-only forever once written** |
| Everything it came from | `raw_material[]` | the captures, in order, expandable, never editable |
| The one thing this says | `core_message` | one sentence |
| The problem they see | `visible_problem` | |
| The problem underneath | `deeper_problem` | |
| What people assume | `common_belief` | |
| What you say instead | `reframe` | |
| What they get without buying | `audience_value` | |
| Where the product honestly fits | `product_connection` | |
| Real examples | `examples[]` | |
| The nuance you must keep | `nuance` | |
| What this must never be read as | `prohibited_interpretation` | |
| Proof this needs before it ships | `proof_required[]` | picks from `proof-library` or names what is missing |
| Pillars this could serve | `possible_pillars[]` | reads `content-strategy/pillars/` — law 3: a fourth pillar appears here the moment it exists |
| Angles this could take | `possible_angles[]` | from the universal engine's angle list, multi-select |
| Status | `status` | the ladder, §6.5 |

Every field the engine filled carries a small marker. Her edit clears the marker. This is the "clearly marked" law applied at field level.

### 6.2 The raw thought is immutable

`raw_thought` and `raw_material[]` are write-once. The seed sheet renders them as quoted text with no edit affordance, and the data layer refuses an amendment that touches either. If she genuinely mis-captured, the answer is a new capture appended — the record grows, it never rewrites. This is PLAN §5.1's reason, stated there and kept here: *"this is what protects the perspective from being polished into marketing speak."*

### 6.3 How a seed changes (append-only, honored)

`work-log/creation/topics` is declared `history: 'append_only'` in spec 21. Under `putEntry`, an existing id cannot be overwritten. So:

- **The entry's `data` is the seed's birth record.** Every later change — a field edited, a status advanced, a deepen proposal accepted — is an `Amendment` appended to `amendments[]`, carrying `at`, `by`, `note`, and the changed fields.
- **Reads go through one function**, `resolveSeed(entry)`, which folds amendments in order and returns the current seed. Every screen and every packet uses it; nothing reads `entry.data` directly.
- **Two fields refuse amendment**: `raw_thought`, `raw_material`. An amendment touching them throws.

The free consequence: the status ladder has a dated trail (who moved it to validated, when, and why) with no extra machinery.

### 6.4 The only additions to the canonical Seed

Three fields, each with its reason. **No later spec may add a fourth without the same justification; nothing else about the Seed changes.**

| Field | Why |
|---|---|
| `origin: 'hers' \| 'engine:content' \| 'engine:analysis'` | the "clearly marked" law and the bank's origin filter |
| `field_sources?: Record<string, 'engine' \| 'her'>` | per-field marking of what the engine wrote vs what she wrote (§6.1) |
| `duplicate_of?: string` | the dedupe result of check 6, kept so the same idea does not fork silently |

Plus one addition to `ProfileBody`: `context_version: number` (§5.7).

### 6.5 The status ladder and the six lock gates

`draft → discussed → validated → locked`, exactly as spec 21 §7.1 and PLAN §5.3.

Shown as four taps, not a dropdown. She can move a seed up or back at any time; moving back is not a failure state and is not warned about.

**Locking requires six fields non-empty.** Nothing else. These are the minimum for a seed to survive a costume without the engine having to invent:

1. `raw_thought`
2. `core_message`
3. `reframe`
4. `audience_value`
5. `prohibited_interpretation`
6. at least one `possible_pillars`

The lock button shows what is missing in plain words, never a red form. Locking writes an amendment: `{ status: 'locked' }`, dated, by her. **Only she locks — no engine, no automation, no "auto-lock when complete."**

---

## 7. The seed bank

`work-log/creation/topics` is the seed bank (PLAN §5.3). Its permitted entry type is `seed` and nothing else (S24) — captures and proposals live at child paths with their own types, so they are never peer entries.

### 7.1 Browse

Default sort: locked first, then validated, discussed, draft; within each, most recently touched first. Each row: name · status dot · pillar chips · piece count with stage breakdown · origin marker if it was engine-born.

### 7.2 Filter

- **Pillar** — reads `content-strategy/pillars/`. Add a pillar and it appears here immediately, with no code change and nothing blank (law 3, and acceptance test 2).
- **Status** — draft / discussed / validated / locked.
- **Has pieces / no pieces** — the honest gap view: locked seeds nothing has been made from yet.
- **Origin** — hers / engine-proposed / analysis-proposed.
- **Search** — over name, core message, and the full raw material. Searching what she actually said is the point.

Filters combine. The filter state is not persisted between visits; the room does not remember a lens she did not ask it to keep.

### 7.3 Seed detail

The seed sheet (§6.1), plus below it:

- **Its pieces** — every piece in `work-log/creation` whose `seed_id` is this seed, grouped by stage (idea · build · review · approved · scheduled · posted), each row showing its resolved platform, format, and pillar, and linking to the piece. Posted pieces show their live link and, once the Analysis family lands, their numbers. **Read from where the pieces live; never copied** (S2, the one-truth rule).
- **"Talk more about this one"** — the capture box of §4.2.
- **Make a piece from this** — present only when the seed is locked; disabled with the reason when it is not. The button hands off to Content Engine II; this spec ships the door and the guard, not the room behind it.
- **History** — the amendment trail, plainly worded: *"You moved this to validated on 12 August."*

---

## 8. Proposals — marked, and untouchable until she picks them up

PLAN §5.2 states the law for analysis-born suggestions: *"clearly marked engine-proposed, untouchable until she picks them up."* This spec applies the same rule to every proposal, whichever engine made it.

### 8.1 Where they live

A new declared path: `work-log/creation/topics/proposals`, entry type `seed_proposal`, append-only, `audience: owner`.

A proposal is **not a seed**. It cannot be filtered into the bank, it cannot be referenced by a piece, it cannot enter a context packet, and it has no status ladder. It has one field with three values: `state: 'waiting' | 'picked-up' | 'dismissed'`.

### 8.2 How they behave

- **Visually separated and marked.** Proposal cards render in a distinct block above the bank, each stamped **ENGINE PROPOSED** with the run's date and the model that made it. They never appear inline among her seeds.
- **Untouchable.** No field on a waiting proposal is editable. There is exactly one edit affordance: **Pick this up.**
- **Picking up** creates a real seed at `status: 'draft'`, `origin: 'engine:content'`, with `field_sources` marking every engine-filled field, the capture attached as `raw_material`, and the proposal moved to `picked-up` with `picked_up_seed_id` set. From that moment it is a normal seed and she edits it freely.
  - For a `deepen` proposal, picking up appends an amendment to the target seed instead of creating a new one — and where it touches a field she already wrote, it shows both and she chooses.
  - For the three migrated capture-input shells (§4.3), picking up **amends the existing shell** rather than creating a second entry. No duplicates from migration.
- **Dismissing** sets `state: 'dismissed'`, keeps the proposal in the record forever, and writes a feedback item (scope `seed`) carrying her reason if she gives one. S13: the original and the decision are both preserved.
- **Nothing expires.** A waiting proposal from three months ago is still waiting. The engine does not tidy up after her.

### 8.3 Analysis-born proposals (address reserved, mechanism not built)

PLAN §5.2's loop-back writes "double down on X" suggestions into the seed bank. Their address is this same path, with `fed_by` including `engine:analysis` and `kind: 'revisit-seed'`: a reference to an existing locked seed plus a suggested costume, born from a pattern verdict.

Two things this spec fixes now so the Analysis family cannot get them wrong:

1. **A revisit proposal never creates a seed.** The seed already exists. Picking it up opens the engine room on that seed with the winning costume pre-filled — which is Content Engine II's surface.
2. **It carries its evidence.** A revisit proposal with no cited verdict is refused at the write door. PLAN §5.2's honesty rule: every suggestion cites its evidence.

---

## 9. Two rules this spec enforces in the data layer

### 9.1 Only locked seeds may mother pieces

PLAN §5.1 and §5.3, and S1. A guard ships with this spec, in the tree layer, not in a screen:

```
canMotherPieces(seed) → seed.status === 'locked'
```

Any write of a piece carrying a `seed_id` whose seed is not `locked` is refused at the write door, with the reason. Content Engine II calls this; it cannot route around it. Acceptance test 6 removes the guard and proves the write is then accepted — the same way spec 21 proved its security tests.

Legacy pieces migrated with `seed_id: null` are untouched: they predate the seed bank and are honest about it.

### 9.2 Feedback is scoped and routed, never piled (S13)

A new declared path: `work-log/logs/feedback`, entry type `feedback_item`, using spec 21 §7.12's canonical object as it is. It is declared here for the whole engine family so no later spec invents a second home.

This spec writes two scopes only:

| Her action | Scope | Where it routes |
|---|---|---|
| Dismissing a proposal, with a reason | `seed` | stays on the record; read when the same capture is re-run |
| "Below the bar" on a proposal or run | `profile-rule` | a proposed diff against the profile's voice or boundaries folders, **requiring her acceptance** — never applied automatically |

Voice, format, and performance feedback (PLAN §5.1's other routes) belong to Content Engine II and the Analysis family; they use this same path.

---

## 10. The client door — there is no fifth one

PLAN §11 and STATE's build decision are explicit, and this spec implements them without softening:

> A client who brings ideas gives them at intake (give-point 1), and her curation turns them into a seed. Same capability, no fifth door.

Concretely:

- `work-log/creation/topics` and both its child paths are `audience: owner`. A client login sees nothing of the engine — not the room, not the bank, not a proposal, not a run. This is enforced by the declarations, server side, not by hiding a nav item.
- The route a client idea actually takes: intake round → `context/intake/answers` (give-point 1, append-only, never altered) → her curation reads it → she opens the Engine Room and pastes it into the capture box, tagged `from-intake-answer` with the answer id as its source. From there it is an ordinary capture.
- **One correction to spec 21's switch registry.** `creation.seed_input_client` is registered with `owns: ['work-log/creation/topics']` and `audience: 'client'`. Read literally that implies a client write into the seed bank, which S19 forbids and which the path's `audience: owner` already blocks. It is a **working-mode flag**, not a write grant: it says "this client brings ideas", and its only effect is that the intake round asks for them. This spec amends its `owns` to the intake parameter it actually governs and adds a note saying so, so that no later build reads it as a door. Nothing about its position or its default (`hidden`) changes — those are hers.

---

## 11. Addresses — every folder this spec reads and writes

Per PLAN §6 rule 3, no spec ships without this table.

### 11.1 Paths WRITTEN

| Path | New? | Entry type | Fed by | Read by | Switch | History | Audience |
|---|---|---|---|---|---|---|---|
| `work-log/creation/topics` | existing (spec 21) | `seed` | `owner`, `engine:content`, `engine:analysis` | `work-log/creation`, `engine:content` | `creation.engine` | `append_only` | owner |
| `work-log/creation/topics/captures` | **new (law 4)** | `seed_capture` | `owner` | `engine:content`, `work-log/creation/topics` | `creation.engine` | `append_only` | owner |
| `work-log/creation/topics/proposals` | **new (law 4)** | `seed_proposal` | `engine:content`, `engine:analysis` | `owner` | `creation.seed_extraction` | `append_only` | owner |
| `work-log/logs/engine-runs` | **new (law 4)** | `engine_run` | `engine:content`, `engine:analysis` | `owner` | `logs.engine_runs` (fixed) | `append_only` | owner |
| `work-log/logs/feedback` | **new (law 4)** | `feedback_item` | `owner` | `owner`, `engine:content`, `context/content-strategy` | `logs.feedback` (fixed) | `append_only` | owner |

Each new folder declares its feeds and its readers at birth, lives INSIDE an existing spine folder (law 1 intact), and is listed in §11.3 for the control room to ratify into PLAN §3.

### 11.2 Paths READ (and never written)

`context/content-strategy/boundaries` · `voice` · `positioning` · `pillars/*` · `platforms/*` (names + `formats` names) · `audience-decided` · `proof-library` (titles) · `ctas` (labels) · `goals` (labels) · `toolset` — and `context/personal-details/*` · `context/business-details/*` in full. Also `work-log/creation` (to list a seed's pieces) and `context/intake/answers` (as a capture source, read-only).

**Read but never written** is load-bearing: the Content Engine is a tool inside the body (PLAN §1). It does not curate Context, does not derive strategy, does not schedule, does not store a piece. A proposed change to strategy leaves as a feedback item requiring her acceptance, and nothing else.

### 11.3 Law-4 additions for the control room to ratify into PLAN §3

| Path | Why | Fed by | Read by | Switch |
|---|---|---|---|---|
| `work-log/creation/topics/captures/` | The raw material every seed is born from, kept verbatim forever (PLAN §5.1). Loose subjects are capture INPUT, never peer entries (S24) — this is where they live. | her | the engine; the seed they became | `creation.engine` |
| `work-log/creation/topics/proposals/` | Engine-proposed seeds, clearly marked and untouchable until she picks them up (PLAN §5.2). Also the reserved home for the Analysis loop-back's "more of this". | `engine:content`, `engine:analysis` | her, directly | `creation.seed_extraction` |
| `work-log/logs/engine-runs/` | S12's per-output log: model, packet contents, context version. Without an address this amendment cannot be honored. | both engines | her; the below-the-bar count | `logs.engine_runs` |
| `work-log/logs/feedback/` | S13's classified, routed feedback with her decision preserved. Declared once for the whole engine family. | her | her; the engines; proposed diffs against strategy | `logs.feedback` |

---

## 12. Switches registered

Every feature registers its switch at birth (PLAN §3.4, her law). Suggested defaults only — **she finalizes every position**, after intake → curation → strategy.

| Switch | Owns | Requires | Dependents | Audience | States | Suggested |
|---|---|---|---|---|---|---|
| `creation.engine` *(existing)* | the Engine Room, the seed bank, captures | `creation.board` | `creation.seed_extraction` | owner | active / history / hidden | active |
| `creation.seed_extraction` **(new)** | the model call and the proposals path | `creation.engine` | — | owner | active / hidden | active |
| `logs.engine_runs` **(new, fixed)** | the run log | `creation.engine` | — | owner | active only | active |
| `logs.feedback` **(new, fixed)** | the feedback record | — | — | owner | active only | active |
| `creation.seed_input_client` *(existing, corrected)* | the intake parameter "does this client bring ideas" — **not** a write into `topics` | `intake.questionnaire`, `client_access.login` | — | client | active / hidden | hidden |

**Why two are fixed.** S12 requires the model, the packet, and the context version to be logged per output; S13 requires the original feedback and her decision to both be preserved. A switch that can turn either off would make the amendment a lie. They get records with `allowed_states: ['active']` and a `fixed` marker so the registry stays exhaustive.

**The cascade, traced.** `creation.engine → hidden` removes the room, the bank, the capture box, and the extraction button, on her side (the client never had them). Existing seeds, captures, proposals, and runs move to `history` and stay readable — nothing is deleted (S9). `creation.seed_extraction → hidden` alone leaves the whole bank working by hand and only stops the model call: the honest off-switch for a profile where she does not want API spend.

**Validation at strategy lock** (S8, spec 21 §5.3) gains one check: `creation.seed_extraction` cannot be `active` on a profile whose `content-strategy` has never been locked. The room may open; extraction on a profile with no derived strategy would be grounded on nothing and would miss the bar by construction.

---

## 13. Audiences

Everything in this spec is `audience: owner`. No path carries a `client_door`, so the validator's no-fifth-door check passes trivially and a client write anywhere here is refused server side.

**Non-owner logins.** Spec 21's build found and closed exactly this leak: her per-profile notes and seed bank would have reached the intern's login. Every path here is filtered out of every non-owner body by the declarations. Acceptance test 8 re-runs that check against the new paths and verifies it FAILS when the guard is removed.

**The workshop rule, restated because it is absolute:** no switch, in any position, can grant a client sight of the Engine Room, a capture, a proposal, a run log, or a seed. PLAN §4, and KRNL OS rule 1.

---

## 14. Migration

Boring on purpose. Nothing about this spec's build changes existing data.

### 14.1 The 22 migrated ResumeGuru pieces

The migration wrote the profile's content cards into `work-log/creation` as the canonical piece identity, carrying `seed_id: card.topicId` where that topic id existed in the migrated shells, and `null` otherwise. Nothing here rewrites them.

- A piece with `seed_id: null` renders normally everywhere and simply does not appear under any seed. It is honest: it predates the seed bank.
- A piece pointing at one of the three capture-input shells appears under that shell in the seed detail — which is exactly the prompt she needs: *four pieces already came out of this subject and it still has no raw thought.*
- **No piece is re-parented automatically.** The engine never guesses which seed an old post belonged to. If she wants a posted piece attached to a seed she later locks, she attaches it by hand from the seed detail, and the attachment is an amendment on the piece, not an overwrite of its birth snapshot (S15).
- The exact counts (22 pieces, 3 capture-input subjects) come from the migration report; the rules above hold whatever the numbers turn out to be on the real `apply: true` run.

### 14.2 The three capture-input subjects

Covered in §4.3 and §8.2: they render badged, they cannot be locked, and a picked-up proposal amends the existing shell rather than creating a duplicate. Their sort-queue entries clear only when `raw_thought` becomes non-empty.

### 14.3 Order of build

1. The declarations and switches for the four new paths, validator green with an empty tree.
2. The seed sheet, the ladder, the lock gates, and `resolveSeed` — the bank works by hand, no model involved. **This is a shippable stopping point**, and it is the correct one if the API key is ever unset or dead.
3. The capture box and the captures path.
4. The model layer, the packet assembler, the checks, the run log.
5. Proposals and pick-up.
6. Seed detail's piece list and the `canMotherPieces` guard.

One profile at a time, pilot first, her own profile (never a client's).

### 14.4 Nothing is deleted

No legacy slice is touched. `topics[]` and `evergreenIdeas[]` remain in the blob at `history`, exactly as spec 21 left them.

---

## 15. Acceptance tests

Run by `npm test`, alongside spec 21's 70.

1. **The capture is verbatim.** A capture with odd whitespace, emoji, and 4,000 words round-trips byte-identical. A write attempting to edit an existing capture throws.
2. **The growth test (law 3).** Add a fourth pillar. It appears in the seed sheet's `possible_pillars` picker, in the bank's pillar filter, and in the context packet — no code change, nothing blank.
3. **The verbatim guard (check 2).** A model response whose `raw_thought` paraphrases the capture is rejected, the run retries once, and if it paraphrases again zero proposals are shown and the run is logged with the violation.
4. **Untouchable proposals.** Every write to a `waiting` proposal other than pick-up or dismiss is refused. A dismissed proposal still exists and still carries its original text.
5. **The lock gates.** A seed missing any of the six fields cannot be locked. A locked seed's amendment trail shows who locked it and when. `raw_thought` refuses amendment at any status.
6. **Only locked seeds mother pieces.** A piece write with a `draft` seed's id is refused. Removing the guard makes it pass — proving the guard is what stops it, not luck.
7. **The packet honors the cascade.** With `platforms.linkedin → hidden`, no LinkedIn name or format appears anywhere in the assembled packet. Flip to `history` and it still does not enter, while every past LinkedIn piece stays readable.
8. **No client, no leak.** A client login and an intern login both receive a body with zero entries at `topics`, `captures`, `proposals`, `engine-runs`, and `feedback`. The check FAILS when the audience filter is removed. (Re-runs spec 12's security suite against the new paths.)
9. **The run log is complete.** Every extraction — success, refusal, or error — writes exactly one `engine_run` carrying model, effort, packet folder list, context version, token counts, and outcome. A run with no packet record fails the test.
10. **Keyless honesty.** With no `ANTHROPIC_API_KEY`, the room opens, the bank works, "Write a seed myself" works, and the extraction button is disabled with a plain reason. Nothing fabricates a proposal, and no run is logged.
11. **The append-only test.** Twenty amendments on one seed resolve in order to the expected current state, and the birth record is byte-identical to what was first written.
12. **The save-race test, extended.** Two concurrent writes — one to a seed, one to a proposal — both survive.

---

## 16. Open question — one, and it is hers

Everything else in this spec was answerable from the plan. This one is not, because the plan sets no number and PLAN §6 names money as one of her three gates.

**Q1 — Is there a monthly ceiling on engine model spend, and what happens when it is reached?**

The intelligence bar settles the model: frontier, not cheap, because *"a cheap model that saves money but misses the bar fails the spec."* That is decided and this spec does not reopen it. What the plan does not say is whether there is a budget line at all.

The honest numbers: about **15–25 cents per extraction**, roughly **$15–25/month** at twenty extractions a month across five profiles, rising with use. This is the same `ANTHROPIC_API_KEY` the chat brain, the AI tagger, and the digest already draw on — so the ceiling, if she wants one, is shared across all of them, not per feature.

Three shapes, hers to choose:

1. **No ceiling.** Simplest, matches the bar, and the run log makes the spend visible after the fact.
2. **A soft ceiling per profile per month.** Extraction keeps working past it and says so: *"this profile has used $X this month."* Nothing blocks.
3. **A hard ceiling.** Extraction refuses past it until she raises it. The bank and hand-writing still work.

**This spec builds nothing that spends money past her answer.** The run log's `cost_estimate_usd` is written from run one regardless, so whichever she picks has real numbers to work from. Everything else in the spec may build while this is open — only the ceiling behavior waits.

---

## 17. Deliberately untouched

- **The chat thread and the untagged inbox.** FROZEN, exactly as PLAN §11 ordered. The chat is not the mouth of this engine and does not become one in this spec. Its own spec comes after the restructure.
- **The costume surface, the internal brief, drafting, and the seven gates.** Content Engine II.
- **The gate set.** S14 derives and locks a versioned v1 gate set WITH strategy, before creation opens. Its address is reserved (`context/content-strategy/gates`); this spec neither derives nor reads it — a seed is not gated, a piece is.
- **The Analysis Engine.** Its proposal address is reserved here; nothing else of it is built.
- **Outside-tool handoffs (S18) and rights (S21).** Both belong to making and publishing, not to understanding an idea.
- **The GUI restructure.** This spec describes one screen and states what it needs from the shell.
- **The deploy path.** DEPLOY.md and CLAUDE.md rule 6 stand: her explicit go, every time.
- **The setup day and the IG collection stall.** These do not wait for the engine — recording is the Analysis Engine's first duty and every day not recorded is gone.
