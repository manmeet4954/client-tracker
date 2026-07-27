# 22 — Intake & Context

**Status: BUILT 2026-07-27, NOT DEPLOYED.** Built in §13's order: the registries and the validator first with nothing touched, then §11's three corrections, then the surfaces, then the round-0 mapping pass. All 20 acceptance tests in §14 are implemented and green alongside spec 21's 70 — 96/96 via `npm test`. Typecheck clean, production build green. Two things the build had to decide, both recorded in STATE.md rather than here: the inventory follows §4's TABLES (52 parameters) where §4.4's prose counts 41, and the 18 parameters no strategy parameter derives from carry `reader: none-by-design` with a written reason rather than being added to §8.1's map on a guess. Her vocabulary pass is still the one input, exactly as §16 says.

Second spec under the locked master plan (`dashboard/PLAN.md`, including its section 10 Sol Amendments). Written in a fresh chat per PLAN §6's working structure, from the vault only. Its build waits on the control room clearing it and on the one input it cannot invent: her vocabulary pass (§4.7).

**Authority:** `PLAN.md` outranks this file. Where this spec and the plan disagree, the plan wins. Where an amendment in plan section 10 touches anything below, the amendment wins. `specs/21 — Data-Layer Restructure.md` is the data-layer contract this spec is built ON: its canonical objects (intake round, curated parameter, gate set, channel, review configuration, profile lifecycle), its declaration contract, its switch registry, and its validator. **This spec defines no second version of anything spec 21 declared.** Where it needs spec 21's shipped code to change, that change is named in §11 as a correction, in place, never as a parallel object.

**Why this spec is next:** PLAN §8 step 6 orders the specs — data-layer restructure → **intake** → Content Engine → Analysis Engine → client-side regroup. Spec 21 gave every existing piece its address. This spec fills the first two folders that address system was built for. Nothing downstream can be correct until a profile's Context is real: the Content Engine's context bundle (PLAN §5.1) is `context/`, and the Analysis Engine's measuring stick (PLAN §5.2) is `content-strategy/`. Both are empty until this ships.

**What it delivers, in one line:** the route information travels from a client to us, the pass where she turns raw answers into curated knowledge with a full trail, and the surface where she derives the strategy that unlocks creation.

---

## 1. What this spec is, and is not

**It is:**

1. **The parameter inventory** — the full list of what we know about a person and a business, each parameter living in its declared folder, each carrying its own question. This is what PLAN §11 Q4 split off from spec 21: spec 21 shipped the parameter CONTRACT, this spec ships the INVENTORY. It ships marked **draft — her vocabulary pass pending, collective review phase**, and it does not go to a client before that pass.
2. **The intake round mechanism** — owner-triggered, versioned rounds (S10) that generate their questions FROM those parameters, carry them to the client by one of two declared routes, and bring raw answers back untouched.
3. **The curation pass** — the surface where she reads raw answers and writes curated parameters, every value carrying source references, curator, timestamp, confidence, and supersession history (S11).
4. **The content-strategy derivation surface** — where she derives positioning, pillars, voice, goals and the rest from the two detail folders; where the v1 gate set is derived and locked with strategy (S14); where she sets every switch (PLAN §3.4); and where strategy locks in one act that opens creation.
5. **The status flow and the lock** — not sent / sent / answered / curated, and the rule that creation stays refused until strategy locks.

**It is not:**

- **Any GUI design.** How the Intake app and the Strategy surface look on screen belongs to the interface spec (PLAN §2, §3.10). This spec says what each surface must hold, who may see it, and what it refuses. It does not say where the buttons go.
- **The client-side rendering.** What the client's four windows look like is the client-side regroup (PLAN §8 step 9). This spec declares the audience and the door of every surface so that spec has something to render against.
- **Either engine.** No seed extraction, no drafting, no analysis. A finding-session transcript is stored here; reading it for seeds is the Content Engine family's job (PLAN §5.1).
- **An AI that writes strategy.** PLAN §3.4 says content-strategy is DERIVED BY HER. The derivation surface puts the sources in front of her and records her decision with its reason. Spec 09's draft engine is not in scope and gets re-cut later against the plan (§15).
- **A new storage pattern.** CLAUDE.md rule 5 holds. Everything here lives in the path-addressed per-profile `body` spec 21 shipped, written through the path-scoped door.

---

## 2. The one rule this spec exists to hold

**Intake is HOW, never WHAT** (PLAN §3.1, her amendment, locked 2026-07-25).

Intake is only the way information travels from the client to us. What we collect is defined by `personal-details/` and `business-details/`. Every parameter in those two folders carries its own question. Intake gathers those questions, presents them, and brings the raw answers back. It owns nothing else.

Three consequences that bind every line below:

1. **No question is authored inside intake.** If a question exists, a parameter exists. Add a parameter to `business-details/market/` tomorrow and its question appears in the next round with no code change (law 3). The validator enforces this: a question with no parameter fails the build.
2. **Intake never asks a strategy question.** `content-strategy/` is derived, not collected (PLAN §3.4). "Which platforms should we be on?" is not an intake question — "which accounts do you already have, and who runs them?" is, and she derives the platform decision from it. The validator enforces this too: no parameter may address `context/content-strategy/*`.
3. **The client never writes the detail folders.** They write answers. She writes parameters. There is no path from a client's keystroke to a curated value that does not pass through her.

---

## 3. Folder addresses — every folder this spec reads and writes

Per PLAN §6 rule 3: no address, no build. Addresses are as declared in `lib/tree/declarations.ts` (spec 21 §4). Nothing below invents a path except the one law-4 addition in §12.

### 3.1 Folders WRITTEN

| Path | Written by | What lands there | History |
|---|---|---|---|
| `context/intake` | owner | The round record (spec 21 §7.6 `IntakeRound`) | `versioned` |
| `context/intake/questions` | generated from `context/personal-details` + `context/business-details` | The questions of one round, generated, never authored | `versioned` |
| `context/intake/answers` | **client** (dashboard questionnaire, give-point 1) · owner (filing a finding session) | The raw answer, verbatim, forever | `append_only` |
| `context/personal-details/*` (identity · journey · voice-of-the-person · ambitions · camera · history) | owner (the curation pass) | Curated parameters with full lineage (spec 21 §7.4) | `mutable_with_supersession` |
| `context/business-details/*` (offers · buying-route · market · numbers · pains · audience-raw · **materials**) | owner (the curation pass) | Same | `mutable_with_supersession` |
| `context/content-strategy/*` (positioning · platforms/\* · pillars/\* · voice · audience-decided · goals · funnel-shape · visual-branding · ctas · proof-library · boundaries · cadence · working-mode · obligations) | owner (the derivation surface) | Derived strategy parameters, each with its cited sources | `versioned` |
| `context/content-strategy/gates` | owner | The v1 gate set, locked with strategy (S14) | `versioned` |
| `context/content-strategy/toolset` | owner | Her switch positions (the switchboard step) | `versioned` |
| `work-log/creation/channels` | owner | One channel per active platform, seeded from `materials/existing-accounts`, completed at strategy lock (S17) | `mutable_with_supersession` |
| `work-log/creation/topics` | owner | Seeds she births from the client-ideas lane only (§7.5). No other seed writing in this spec | `append_only` |
| `work-log/assets/sets` | client · owner | Files handed over during intake (brand book, logo files, old content). Give-point 2, with its rights record (S21) | `append_only` |

### 3.2 Folders READ

| Path | Read for |
|---|---|
| `shelf/profiles` | Profile identity, `owner_kind`, lifecycle, bindings — who may be sent a round, and whether owner-direct curation applies (PLAN §2) |
| `context/intake/answers` | The curation pass, and the "what is still unanswered" state of a round |
| `context/personal-details/*`, `context/business-details/*` | Question generation (what is still missing) and the whole derivation surface |
| `context/content-strategy/voice`, `context/content-strategy/positioning` | Gate-set derivation (S14 — the five brand gates come from strategy, never from a separate questionnaire) |
| `context/content-strategy/toolset` | Lock validation, and every surface checking whether it renders |
| `context/content-strategy/platforms/*` | Channel seeding and lock validation (no channel active on a hidden platform) |
| `work-log/assets/sets` | The material references `materials/` points at |
| `work-log/references/from-client` | Derivation input — already declared as read by `context/content-strategy` |

### 3.3 Where the inventory itself lives

The parameter inventory is **universal**, like the costume variables (PLAN §5.1: "finite lists, stored in the universal engine"). It is the same for every profile; only the answers differ. So it is a code registry beside the tree registries, not per-profile data:

```
lib/intake/parameters.ts   ← the parameter registry (this spec's §4)
lib/intake/generate.ts     ← round questions, generated from it
lib/intake/status.ts       ← the computed status flow (§5.2)
lib/strategy/derivation.ts ← the derivation map (§8.1) and the lock (§8.6)
```

This mirrors spec 21 exactly: `DECLARATIONS`, `SWITCHES`, `FEATURES` are code; what lives at the paths is data. It also means the validator can check the inventory against the tree at build time, which is the whole point.

---

## 4. The parameter inventory (DRAFT — her vocabulary pass pending, collective review phase)

**Status of this section, stated plainly.** PLAN §3.1 records that her vocabulary session is still owed for the finite word lists. PLAN §11 Q4 confirms the split: spec 21 shipped the contract, this spec ships the inventory. What follows is the inventory drafted from spec 08's 16 discovery questions plus the parameters the tree itself names that spec 08 never asked about. **It is in a collective review phase.** Two rules follow, and they are build rules, not politeness:

1. **No round goes to a client while any parameter in it is `vocabulary: draft`.** The generator refuses. Her pass flips parameters to `vocabulary: hers`.
2. **She removes; Claude may add.** PLAN §5.1 item 1, applied here: the lists ship FULL, breadth over shortlisting, and removal happens through use. Multi-select wherever a real answer can hold more than one value. Her no-assumption law stands: this spec's wording is a starting point to be argued with, not a definition.

Spec 08's own pending decision 2 ("16 drafted — cut, reword, or add; they should sound like her on a call, not like a form") is inherited whole.

### 4.1 What a parameter record carries

| Field | Meaning |
|---|---|
| `id` | e.g. `offers.hero-offer`. Stable — a round records ids, so rewording a question never breaks a round's history. |
| `path` | The declared folder it belongs to. Must be under `context/personal-details/` or `context/business-details/` (the one exception is §7.5). |
| `label` | The short name of the thing, for her side. |
| `question` | The words the client reads. Plain, hers, spoken. |
| `shape` | `text` · `long-text` · `number` · `single-select` · `multi-select` · `list` · `entry-list` (a list of things that each have their own fields) · `yes-no` · `file-reference` |
| `options` | The finite word list, where the shape needs one. Drafted here, hers to pin. |
| `asked_of` | `client` (goes in a round) · `owner-observed` (she fills it, never asked) |
| `required_for` | Which strategy parameters cannot be derived without it (§8.1). |
| `vocabulary` | `draft` · `hers`. Every entry below ships `draft`. |
| `spec08` | The spec 08 question number it came from, or `new` where the tree names something spec 08 never asked. |

### 4.2 personal-details — the six folders

**`identity/` — who they are, what they do**

| id | Question | Shape | spec 08 |
|---|---|---|---|
| `identity.name` | What name do you want this brand to carry? | text | new |
| `identity.one-line` | How do you describe what you do, in one line? | text | new |
| `identity.working-week` | What does a normal working week actually look like for you? | long-text | new |
| `identity.credentials` | What have you done that makes you worth listening to on this? | list | new |
| `identity.place-and-language` | Where are you based, and what language should the content be in? | text + multi-select | new |

**`journey/` — the story, the why**

| id | Question | Shape | spec 08 |
|---|---|---|---|
| `journey.origin` | What's the story only you can tell? | long-text | Q11 |
| `journey.why` | Why did you start doing this, and why are you still doing it? | long-text | new |
| `journey.turning-points` | What are the two or three moments that changed how you work? | list | new |

**`voice-of-the-person/` — tone, pace, likes, dislikes. RAW, not the decided voice.**

| id | Question | Shape | spec 08 |
|---|---|---|---|
| `voice.sounds-like` | Show me three accounts you'd be proud to sound like. | list | Q9a |
| `voice.never-sounds-like` | And one you'd hate to be compared to. | list | Q9b |
| `voice.natural-tone` | When you explain your work to a friend, how does it come out? | multi-select (vibe list, §4.7) + long-text | Q9 |
| `voice.words-they-hate` | Any words or phrases that make you cringe? | list | new |
| `voice.pace` | Do you like it short and sharp, or do you like to explain properly? | single-select | new |

> This folder is the person's raw preference. `content-strategy/voice/` is the decided voice. Spec 08 ran them together in one `vibeWords` field; the tree separates them, and this spec keeps them separate. Everything here is evidence; the decision happens at §8.

**`ambitions/` — goals, achievements, vision**

| id | Question | Shape | spec 08 |
|---|---|---|---|
| `ambitions.six-months` | Six months from now, what would make you say this worked? | long-text + optional number | Q7 |
| `ambitions.known-or-sold` | If you had to choose: more people knowing you, or more people buying — which one first? | single-select | Q8 |
| `ambitions.proudest` | What are you proudest of so far? | list | new |
| `ambitions.three-years` | Where do you want this to be in three years? | long-text | new |

> `ambitions` is what they SAY they want. `content-strategy/goals/` is what we will measure, with its S16 metric declaration. Never the same record.

**`camera/` — face on camera**

| id | Question | Shape | spec 08 |
|---|---|---|---|
| `camera.face` | Will you show your face? How often, honestly? | single-select: yes / sometimes / no | Q10 |
| `camera.comfort` | What kind of filming feels fine, and what feels like too much? | long-text | new |
| `camera.voice-only` | Are you okay being heard but not seen? | yes-no | new |

**`history/` — past wins, past flops**

| id | Question | Shape | spec 08 |
|---|---|---|---|
| `history.wins` | Which past post are you most proud of? | list (link + why) | Q15a |
| `history.flops` | And which one embarrassed you? | list (link + why) | Q15b |
| `history.already-tried` | What have you already tried that didn't work? | long-text | new |

### 4.3 business-details — six folders plus materials

**`offers/` — each offer an entry; one marked hero**

| id | Question | Shape | spec 08 |
|---|---|---|---|
| `offers.list` | What do you sell? | entry-list: name · what it is · price band · type | Q1a |
| `offers.hero` | Which one thing pays the bills? | single-select over `offers.list` | Q1b |
| `offers.in-their-words` | How do you describe it to someone who's never heard of it? | long-text | new |

> If the client names no hero, the curation pass does NOT guess — the profile's sort queue gets the question, exactly as spec 21's migration already does for legacy offers.

**`buying-route/` — how a sale actually happens**

| id | Question | Shape | spec 08 |
|---|---|---|---|
| `buying.last-sale` | Walk me through the last sale: where did that person come from, and what did they do right before paying? | long-text | Q2 |
| `buying.where` | Where does the money actually change hands? | multi-select (route list, §4.7) | Q2b |
| `buying.next-step` | What should someone do the moment your content convinces them? | long-text | Q3 |
| `buying.attribution` | When a new customer shows up, do you ever ask how they found you? Could you start? | single-select: yes / no / could start | Q16 |

**`market/` — industry, USP, competitors** (all new: spec 08 has no market block)

| id | Question | Shape | spec 08 |
|---|---|---|---|
| `market.industry` | What industry would someone put you in? | text | new |
| `market.usp` | What do you do that the others in your space don't? | long-text | new |
| `market.competitors` | Who else would your customer be looking at? | list | new |
| `market.shift` | What's changing in your world right now? | long-text | new |

**`numbers/` — team size, revenue, production reality**

| id | Question | Shape | spec 08 |
|---|---|---|---|
| `numbers.team-size` | How many people, including you? | number | new |
| `numbers.revenue-band` | Roughly what does the business do in a month? | single-select (band list, §4.7) | new |
| `numbers.production` | Who takes the photos and videos, and how fast can you get me raw material? | long-text | Q13 |
| `numbers.sustainable-output` | How many posts a week can you sustain on your worst week, not your best? | number | Q12 |

> `numbers.sustainable-output` is a capacity FACT. `content-strategy/cadence/` is the decision derived from it. Spec 08 called this field `frequencyTarget` and put it in strategy territory; the tree does not, and this spec follows the tree.

**`pains/` — the business's struggles** (spec 08's pain block was AUDIENCE pain, which lives in `audience-raw/`)

| id | Question | Shape | spec 08 |
|---|---|---|---|
| `pains.hardest-part` | What's the hardest part of the business right now? | long-text | new |
| `pains.content-blocker` | What's stopped you posting consistently before? | long-text | new |
| `pains.growth-worry` | What worries you about growing this? | long-text | new |

**`audience-raw/` — audience as described, uncurated**

| id | Question | Shape | spec 08 |
|---|---|---|---|
| `audience.best-customer` | Describe your best customer ever. Not the ideal one — a real one. | long-text | Q4 |
| `audience.where` | Where do they spend their time? | long-text + multi-select | Q4b |
| `audience.search-words` | What do they type into Google or Instagram before finding you? | list | Q5 |
| `audience.dm-words` | What do they say when they DM you? | list | Q6 |
| `audience.pain` | What one to three problems would they pay to solve? | list | Q (block B field `audiencePain`) |
| `audience.unwanted` | Who do you NOT want as a customer? | long-text | new |

> `audience.unwanted` is the intake source of `content-strategy/boundaries/` — PLAN §5.1 named the unwanted audience as a boundary, and nothing collected it until now.

**`materials/` — what they already have** (law-4 addition, §12)

| id | Question | Shape | spec 08 |
|---|---|---|---|
| `materials.brand-book` | Do you have a brand book? | yes-no + file-reference | Q14a |
| `materials.logo-files` | Do you have logo files? | yes-no + file-reference | Q14b |
| `materials.photo-bank` | Do you have a photo or video bank we can pull from? | yes-no + long-text | Q14c |
| `materials.old-content` | Any old content that worked? | list (links) | Q14d |
| `materials.existing-accounts` | Which accounts do you already have — the handles, and who runs each one? | entry-list: platform · handle · who runs it | new |

> **Files never live in intake.** A file handed over at intake lands in `work-log/assets/sets` through give-point 2, with its rights record (S21). `materials/` records the FACT and holds the reference. Intake is a route, not a file store.
>
> `materials.existing-accounts` is what seeds `work-log/creation/channels` at strategy time, and it is the direct answer to a question spec 21's ResumeGuru migration had to leave open ("who owns @resumeguru.ai, its timezone, and whether we post or they do").

### 4.4 The count, honestly

**Spec 08's 16 questions all survive.** They fill 17 of the parameters above. The other 24 are drafted here because the tree names them and nobody ever asked them: identity has no spec 08 block at all, market has none, the business's own pains have none, and the tree's split between raw preference and decided value creates parameters spec 08 collapsed into one field.

That is 41 parameters, of which 38 are `asked_of: client`. At spec 08's rate that is well past a 45-minute call, which is exactly why rounds are subsets (§5.5) and why the finding-session route exists. **Trimming this list is part of her vocabulary pass, not a separate exercise.**

### 4.5 What deliberately has NO parameter

Named so nobody adds them later by accident:

- **Everything in `content-strategy/`.** Derived, never collected (rule 2 of §2). Platforms, pillars, voice, goals, cadence, CTAs, funnel shape, positioning, boundaries, obligations, toolset, gates — none has an intake question, and the validator fails the build if one appears.
- **`work-log/analysis/market-research/`.** PLAN §5.2 keeps its parameters deliberately open until the first real need appears (law 4). Not this spec.
- **Review preferences.** The S20 review configuration is set by her inside `working-mode/` at strategy time (§8.5), not asked at intake.
- **Anything about how we work together commercially.** Scope, price, and the standing agreement are hers; they enter through `working-mode/` and `obligations/`, and their record lives in `logs/changes/`.

### 4.6 The no-orphan-parameter rule

Spec 08's own test, kept and made machine-checkable: **every field names its reader.** Here:

- every parameter names at least one strategy parameter in `required_for`, **or** carries `reader: none-by-design` with a one-line reason;
- every strategy parameter in the derivation map (§8.1) names at least one source parameter.

Both directions run as acceptance test 10. A parameter nothing reads is not collected — it is a question asked for nothing, and it is exactly what spec 08 promised to prevent.

### 4.7 The vocabulary lists (all DRAFT — hers to pin)

Shipped full and multi-select where a real answer holds more than one value, per PLAN §5.1 item 1.

| List | Draft values | Used by |
|---|---|---|
| Vibe words | bold · warm · expert · playful · premium · honest · rebellious · calm · caring · direct | `voice.natural-tone` |
| Pace | short and sharp · explains fully · mixed | `voice.pace` |
| Price band | low · mid · premium | `offers.list` |
| Offer type | product · service · course · template · booking · retainer | `offers.list` |
| Buying route | website · DM chat · WhatsApp · call · in person · marketplace · form | `buying.where` |
| Known or sold | more people knowing me first · more people buying first · both, and here's the split | `ambitions.known-or-sold` |
| Face on camera | yes · sometimes · no | `camera.face` |
| Revenue band | **not drafted** — the words are hers | `numbers.revenue-band` |

Every list ships with a free-text "something else" lane, because a finite list that cannot be escaped produces false answers.

---

## 5. The intake round

### 5.1 The object

`IntakeRound`, exactly as spec 21 §7.6 declared it, at `context/intake`, history `versioned`. No second version. What this spec adds is behavior, not shape:

- `parameters` holds parameter **ids** from the registry (§4.1), never question text. Rewording a question never changes what a past round asked.
- `delivery` is per round, not per profile. Round 1 can be a recorded meeting and round 2 a questionnaire.
- `curation` is the per-parameter record of her pass: curated yes/no, when, by whom.
- `legacy: true` marks round 0, the legacy import (§13).

### 5.2 The status flow

`not sent` → `sent` → `answered` → `curated`, exactly as PLAN §3.1 names it.

| Status | What it means | Who causes it |
|---|---|---|
| `not sent` | The round exists, its parameters are chosen, its questions are generated. Nobody outside has seen it. | She opens it |
| `sent` | The questions are reachable by the client (dashboard mode), or the meeting is booked (finding-session mode) | She sends it |
| `answered` | Every parameter in the round has either an answer or an explicit skip | Computed |
| `curated` | Every parameter in the round has a curation decision | Computed |

**Status is computed, never client-written.** This matters for S19. The round record at `context/intake` declares `fed_by: ['owner']` — the client is not a writer there. So a client submitting answers writes only to `context/intake/answers`, and the round's status is a function:

```
status(round, answers, curation) =
  not sent   if she has not sent it
  sent       if sent and any parameter has neither an answer nor a skip
  answered   if every parameter has an answer or a skip, and curation is incomplete
  curated    if every parameter in the round has a curation decision
```

The stored `status` field mirrors that function and is refreshed on any owner-side read or write of the round. No client action ever writes the round object. This is the cleanest reading of the four-doors rule and it needs no new machinery.

**Partial answers are normal.** The client can save and come back; the round stays `sent`. A parameter they cannot or will not answer is skipped explicitly, with the skip recorded as an answer entry of kind `skipped` — because "they refused to say" is knowledge, and a blank is not.

### 5.3 Question generation

When she opens a round she picks parameters (or takes the default: everything not yet curated). The generator then, per parameter:

1. reads the registry record;
2. refuses if `vocabulary: draft` (§4, rule 1) or if `asked_of: owner-observed`;
3. refuses if the parameter's declared path is not `active` for this profile — the cascade applies to questions too (PLAN §3.4: "nothing dormant ever asks to be filled in");
4. writes one question entry to `context/intake/questions` carrying the parameter id, the question text, the shape, the options as they stand today, and the round version.

Questions are **snapshots**. A round's questions never change after it is sent, even if the registry changes; the next round regenerates. That is what `versioned` means at this path, and it is what makes an old answer readable years later.

**The growth guarantee, restated at this level (law 3):** add a parameter to `business-details/market/` and it appears in the next round automatically. Nobody edits a questionnaire.

### 5.4 The two delivery modes

PLAN §3.1 declares exactly two, and both fill the same fields.

**Mode 1 — the dashboard questionnaire. This is give-point 1.**
The client logs into their profile and sees the Intake app: the questions of rounds sent to them, grouped by folder, in plain words, saveable in passes. Their submit writes answer entries to `context/intake/answers` with the answering person recorded. Switch: `intake.questionnaire`. Door: `give:intake`.

**Mode 2 — the recorded meeting (the Finding Session). She files the answers.**
She sits the call, records it, and files answers herself. The recording is an asset (`work-log/assets/sets`, per spec 21 §8.2); the transcript is attached to it. Each answer entry she files carries `source: finding-session:<asset id>` plus the transcript reference, so the trail from a curated value back to a spoken sentence is unbroken. Switch: `intake.finding_session`. The client does not touch the dashboard in this mode at all.

**A profile with no client login uses mode 2.** The plan names two modes and only two. A public, unauthenticated intake link is not one of them, and S19 permits no fifth door — so it is out of scope (§15). Noted honestly: this will be felt, because most new clients will not have a login on day one. If she wants a third route, that is a plan change and therefore her gate (PLAN §6, autonomy agreement).

**More than one client user may answer.** PLAN §11 Q3: bindings are (person, profile) pairs and a profile may have several client users. Any bound client user may answer any question in a sent round; each answer records its author. Conflicting answers are not resolved by the machine — both survive as raw, and her curation decides. That is the whole design: raw is plural, curated is singular.

### 5.5 Reopening a round (S10)

Intake is never "done" as a lifecycle fact — it retires from navigation and stays reopenable.

She selects parameters, and a new round is born at `version = last + 1`, holding only those parameters, with its own delivery mode and its own status. Old rounds move to `history`: readable forever, accepting no writes (S9, enforced by `putEntry`). Their answers are untouched.

Reopening is how the system handles the truth that people's answers change: a business pivots, an offer dies, they finally admit they hate being on camera. The new answer never edits the old one — it supersedes at the CURATED level (§7.3), and both readings stay legible.

Switch: `intake.rounds_reopen`, owner audience, already registered by spec 21.

### 5.6 Retirement, and the quiet done

PLAN §2 item 2: Intake is "shown until curated, then retired to a quiet done." S10: it retires from navigation but stays reopenable.

Concretely: when every round of a profile is at `curated`, the Intake app stops being navigation on both sides. On her side it becomes a quiet done state on the Strategy surface — the round history, one line each, and the reopen action. On the client's side it is simply not rendered (PLAN §2: whatever the switches turn off is NOT rendered, never grayed out). Their past answers stay readable through their own door.

Reopening a round returns it to active on both sides. Nothing is deleted, ever (S9).

---

## 6. Raw answers are immutable

S11 in one line: **raw answers are never altered.** The path is `append_only`, and spec 21's `putEntry` already throws on a second write to the same entry id at an append-only path.

This spec adds two rules on top:

1. **No amendments on answers.** Spec 21's `amendEntry` is the escape hatch for append-only records, and for a raw answer there is no legitimate use of it. The build adds a guard: `amendEntry` refuses any entry at `context/intake/answers`. A correction is a NEW answer in a NEW round; the correction lands at the curated level, where supersession lives.
2. **Transcripts are answers too.** A filed finding-session answer is as immutable as a typed one. If she mis-hears a sentence and files it wrong, the fix is a new answer entry citing the same recording at a new timestamp — not an edit.

Why this is not pedantry: every downstream claim rests on it. S15's birth snapshots, S12's context packets, and the whole confidence system are only worth something if the bottom of the stack cannot move.

---

## 7. The curation pass

This is the surface PLAN §3.1 means by "her curation pass, which writes personal-details and business-details. The client never writes those folders directly."

### 7.1 What the surface holds

Two sides, one parameter at a time:

- **Left: the raw.** Every answer that touches this parameter, across every round, in date order, verbatim, with its source (which round, typed or spoken, which person, which recording and timestamp). Read-only, forever.
- **Right: the curated value.** The parameter's shape from the registry — the select, the list, the entry list — with the current curated value if one exists, and its full history underneath.

Between them, one action: **curate.** It writes a `CuratedParameter` (spec 21 §7.4) into the declared folder, through the path-scoped door, at the parameter's path.

She works parameter by parameter, not answer by answer. That is the direction that matters: the folders are the truth, and answers are evidence for them.

### 7.2 What every curated value carries (S11)

`Provenance`, exactly as spec 21 §7.4 declared it — required, never optional at these paths:

| Field | Rule |
|---|---|
| `source_refs` | At least one. Answer entry ids, or `owner-direct:<note>` for owner-direct curation (§7.4). A curated value with no source fails the write. |
| `curator` | Who curated it. |
| `at` | When. |
| `confidence` | `confirmed` (they said it plainly) · `inferred` (she read it out of what they said) · `legacy-unverified` (came from the old dashboard, §13) · `unknown` (recorded so the gap is visible rather than silent). |
| `supersedes` | The entry id this replaces, when it replaces one. |

The rule the build enforces: **no curated value without its source.** This is what makes it possible, two years later, to ask "why does this brand never say 'hustle'?" and get an actual sentence from an actual call as the answer.

### 7.3 Supersession, not editing

A re-curated value uses spec 21's `supersedeEntry`: the old entry stays, moved to `history`; the new one records what it supersedes. Both readable. Nothing is overwritten in place.

This is how a round-3 answer changes a value that came from round 1 without erasing what was true then — and it is what lets analysis read a piece against the strategy version that existed when it was born (S15), rather than against today's.

### 7.4 Her own profiles (client zero)

PLAN §2: her workspaces are profiles like any other, but "how she collects and connects her own profiles' Context is her call, and the structure does not bend for her."

So for `owner_kind: hers`: no round is required. She may curate a parameter directly, and the provenance carries `source_refs: ['owner-direct:<her note>']` with `curator` and `confidence` as normal. Every other rule holds — the shape, the folders, the supersession, the derivation, the lock. The structure does not bend; only the route in is shorter.

For `owner_kind: client`: a curated value with only an `owner-direct` source is allowed but flagged in the profile's report, because a client's context assembled entirely from her assumptions is a thing she should be able to see at a glance.

### 7.5 The one lane that is not a context parameter: the client's ideas

Recorded in STATE.md as a build decision under spec 21, and binding here: **a client who brings ideas gives them at intake, not into the seed bank.** Spec 21's original `creation.seed_input_client` switch tried to let a client write `creation/topics` and the validator refused it — S19 allows four doors, and that would have been a fifth.

The route that honors both: the registry carries exactly ONE entry whose target is not a detail folder.

| id | `client-ideas` |
|---|---|
| Question | Anything you want us to talk about? Tell it however it comes out. |
| Shape | `long-text`, repeatable |
| Lands at | `context/intake/answers` — the same door as every other answer (give-point 1) |
| Curates to | `work-log/creation/topics` — she reads the idea and births a seed from it, as owner |
| Switch | `creation.seed_input_client` (spec 21, audience client, requires `creation.engine` + `client_access.login`, suggested default `hidden`) |

It is called out here, alone, with its authority named, so nobody later mistakes it for permission to add more targets. The validator asserts: **no parameter targets `content-strategy/`, and exactly one targets `work-log/creation/topics` — this one.**

One declaration edit is required for it: `context/intake/answers` gains `work-log/creation/topics` as a reader (§11).

---

## 8. The content-strategy derivation surface

`content-strategy/` is "not collected. DERIVED by her from personal-details + business-details. This is what a brand book deliverable really is. Locked before any content is created." (PLAN §3.4.) This section builds the room where that happens.

Strategy is not a switch (PLAN §3.10) — it is the always-on layer that owns the switchboard. It is present in every profile, owner-only, and cannot be turned off.

### 8.1 The derivation map

Which detail parameters feed which strategy parameter. This IS law 3 written at parameter level, and it is what the surface puts on screen.

| Strategy parameter | Derived from |
|---|---|
| `positioning/` | `identity.one-line` · `identity.credentials` · `journey.origin` · `journey.why` · `market.usp` · `offers.hero` · `audience.best-customer` |
| `platforms/` | `materials.existing-accounts` · `audience.where` · `numbers.production` · `camera.face` |
| `platforms/*/formats` | the universal format library per platform, narrowed by `camera.face` · `numbers.production` |
| `platforms/*/rules` | universal format rules, overridden per client as the relationship matures (PLAN §5.1: override beats universal, always) |
| `pillars/` | `ambitions.known-or-sold` · `audience.pain` · `offers.hero` · `market.usp` · `journey.why` |
| `pillars/*/job` | `ambitions.known-or-sold` · `ambitions.six-months` |
| `pillars/*/mix-target` | `ambitions.known-or-sold` · `cadence` |
| `voice/` | `voice.natural-tone` · `voice.sounds-like` · `voice.never-sounds-like` · `voice.words-they-hate` · `voice.pace` · `audience.dm-words` |
| `audience-decided/` | `audience.best-customer` · `audience.where` · `audience.search-words` · `audience.dm-words` · `audience.pain` + the stage lens (unaware → existing customer, PLAN §5.1) |
| `goals/` | `ambitions.six-months` · `ambitions.known-or-sold` · `buying.where` · `offers.hero` — **plus an S16 metric declaration per goal** |
| `funnel-shape/` | `buying.last-sale` · `buying.where` · `buying.next-step` · `buying.attribution` |
| `ctas/` | `buying.next-step` · `offers.hero` · `buying.where` |
| `visual-branding/` | `materials.brand-book` · `materials.logo-files` |
| `proof-library/` | `history.wins` · `offers.list` · `market.usp` — every item carrying its rights record (S21) |
| `boundaries/` | `audience.unwanted` · `voice.words-they-hate` · `market.usp` · `pains.growth-worry` |
| `cadence/` | `numbers.sustainable-output` · `numbers.production` |
| `working-mode/` | `materials.existing-accounts` (who runs each account) · `numbers.production` · her commercial agreement (owner-declared, not from intake) |
| `obligations/` | `working-mode/` · `materials.*` · `numbers.production` |
| `gates` | `voice/` · `positioning/` — S14, never a separate questionnaire |
| `toolset/` | the whole strategy — the switchboard step (§8.5) |

### 8.2 The workspace

One panel per strategy parameter. Three parts:

1. **Sources.** The curated detail parameters this one derives from, per the map above, with their values and their confidence. If a source is missing or `unknown`, it says so here — this is where "we never asked them that" becomes visible instead of silent.
2. **The decision.** The strategy parameter's own shape. Hers to write.
3. **The reason.** One plain line: why this decision, from these sources. **Required.** Spec 09's citation rule, adopted here as a data requirement rather than an AI feature: no strategy parameter locks without a reason line.

The reason line is not ceremony. It is what makes the strategy readable a year later, it is the raw material the taste layer reads (spec 10), and it is the thing she shows a client when they ask why their pillar mix is what it is.

### 8.3 What the surface refuses

- A strategy parameter cannot be written before at least one of its declared sources is curated. If she wants to decide ahead of the evidence, she marks the parameter `owner-declared` with a reason — allowed, visible, and counted in the lock report.
- No AI writes here. Nothing in this spec generates a strategy value. (§15.)

### 8.4 The gate set, v1 (S14)

S14: a versioned v1 gate set is derived and locked WITH strategy, before creation opens. Gate versions apply forward only; old pass records are never rewritten.

- **Five brand gates**, derived from `voice/` and `positioning/`. PLAN §5.1 item 3: gates come out of what is decided in strategy — there is no gate questionnaire, and some gates only emerge after working with a client for a while.
- **Two operational gates**, fixed forever: accuracy and format. Spec 21 already ships them as `OPERATIONAL_GATES`; this spec does not redefine them.
- The set is a `GateSet` (spec 21 §7.13) with `version: 1` and `locked_with_strategy_version: 1`.
- Refining a gate later creates version 2. Version 1's pass records stay exactly as they are.

The surface: five slots, each with its question in her words, each showing the voice or positioning line it came from. It refuses to lock while `voice/` or `positioning/` is empty.

### 8.5 The switchboard step (PLAN §3.4)

Her timing, locked: **intake → curation → strategy → switches set → creation begins.**

The switchboard shows every switch in spec 21's registry that applies to this profile, grouped by app, each with:

- its suggested default (Claude's proposal, marked as a suggestion — spec 21 §5.1);
- what it turns off if she moves it: the cascade set, computed by `cascadeOf`, showing her side AND the client's, because switches design her dashboard too (PLAN §3.4);
- the strategy decision it derives from (`derived_from`), so working-mode and posting ownership visibly drive the positions.

Two things this step must produce, because lock validation needs them:

1. **A channel per active platform** (S17): account identity, ownership, connection state, timezone, posting permission. Seeded from `materials.existing-accounts`, completed by her. Without the timezone every metric is meaningless (S7); without the posting permission the publishing switch cannot validate (spec 21 §5.3).
2. **A metric declaration per goal** (S16): metric ids, direction, calculation, denominator, observation window, target, platform availability, and the not-measurable fallback. Analysis stays blocked per goal until its goal has one — this is already how spec 21 migrated ResumeGuru's four goals, and this is where that debt gets paid.

**Migration never sets a position** (spec 21 §9.6). A suggestion is not a setting; `suggested: true` counts as unset at the lock.

### 8.6 The lock — one act

Strategy locks in a single action, and that action is the gate between "understanding this client" and "making things for them."

**It validates first.** The lock refuses while any of these is true:

1. any strategy parameter has neither a value nor an explicit "not applicable" with a reason;
2. any strategy parameter has a value and no reason line (§8.2);
3. the gate set has fewer than five brand gates, or `voice/` or `positioning/` is empty;
4. any switch has no position set by her (a suggestion is not a position);
5. `validateSwitchConfig` (spec 21 §5.3) returns any violation — a switch active on a non-active prerequisite, a channel on a hidden platform, a client-audience switch active with no client access, an analysis switch active on a goal with no metric declaration, a publishing switch active where the client posts;
6. any active platform has no channel record.

**On success, in one transaction:**

- every strategy parameter is stamped `strategy_version: 1`;
- the gate set locks at `version: 1`, `locked_with_strategy_version: 1`;
- the switch configuration is stamped with `set_at` and `strategy_version: 1`, and `suggested` is cleared;
- the profile lifecycle moves `setup` → `active` (S22);
- creation opens (§8.7);
- the client's strategy summary becomes visible (§10).

**On failure:** a list of exactly what is missing, per item, with a link to the panel that fixes it. No partial lock. "Contradictions refuse activation" (S8) means the strategy cannot lock with them present.

### 8.7 Creation stays locked until strategy locks

PLAN §3.1: "Creation does not start until Context is curated and content-strategy is locked." Made concrete, server side, not in the UI:

> Any write to a path under `work-log/creation` on a profile whose `strategy_version` is null is refused.

Not hidden, not grayed out — refused at the write door, the same way an undeclared path is refused. The Creation app renders as a locked state naming what is still owed (from the lock validation list). Spec 21's migrated profiles are unaffected: they are at lifecycle `active` with their legacy slices rendering as they always did, and they acquire a `strategy_version` when she runs them through this surface (§13).

### 8.8 After v1

Strategy is `versioned`, and PLAN §3.4 says accepted analysis conclusions feed it, "every change dated, the strategy changelog."

- A change to a locked strategy parameter creates version N+1 for that parameter, dated, with its reason. Old versions stay readable, and analysis reads a piece against the version that existed at the piece's birth (S15).
- Gate refinement creates gate set version N+1, forward only.
- Switch changes are re-validated against the same rules; a change that would create a contradiction is refused.
- **The client sees the locked version only** (§10). Working edits toward the next version are invisible until she locks them. That is the plan's "never the raw working notes" (PLAN §4), and it needs no separate summary artifact.

---

## 9. Switches registered by this spec

PLAN §6 rule 3: a feature with no switch is rejected. Every feature this spec ships names one.

### 9.1 Reused from spec 21's registry (no redefinition)

| Switch | What it governs here |
|---|---|
| `intake.questionnaire` | The dashboard questionnaire route and the three intake paths |
| `intake.finding_session` | The recorded-meeting route |
| `intake.rounds_reopen` | Owner-triggered versioned reopen (S10) |
| `creation.seed_input_client` | The client-ideas lane (§7.5) |
| `client_access.login` | Whether this profile has a client login at all |
| `spine.fixed` | The two detail folders — curation is structural |
| `strategy.fixed` | `content-strategy/` — strategy is not a switch |
| `assets.client_upload` | Files handed over during intake (give-point 2) |

### 9.2 New switches this spec registers

Following spec 21's `client_access.login` precedent, owner-side surface switches carry `owns: []` and name what they govern in their note — the governing switch of a PATH stays the one its declaration names, so nothing is re-pointed.

| id | owns | requires | dependents | audience | allowed states | suggested default | fixed | derived from |
|---|---|---|---|---|---|---|---|---|
| `intake.curation` | — (the curation workspace) | `spine.fixed` | — | owner | `active` | `active` | yes | structural: her pass is the only writer of the detail folders |
| `intake.reminders` | — (nudging a client whose round is `sent`) | `intake.questionnaire`, `client_access.login` | — | client | `active`, `hidden` | `hidden` | no | working-mode: does this client need chasing |
| `strategy.derivation` | — (the derivation workspace) | `strategy.fixed` | `strategy.gate_set`, `strategy.switchboard`, `strategy.lock` | owner | `active` | `active` | yes | structural (PLAN §3.10) |
| `strategy.gate_set` | — (the v1 gate set surface, S14) | `strategy.derivation` | — | owner | `active` | `active` | yes | structural |
| `strategy.switchboard` | — (the switch-setting step, PLAN §3.4) | `strategy.derivation` | — | owner | `active` | `active` | yes | structural |
| `strategy.lock` | — (the lock action and its validation) | `strategy.derivation`, `strategy.gate_set`, `strategy.switchboard` | `creation.board` | owner | `active` | `active` | yes | structural |

`intake.reminders` ships **declared, unbuilt** (spec 21's `declared` state): it has its address and its switch, and no code in this build. She chases clients on WhatsApp today and that keeps working.

`strategy.lock` gaining `creation.board` as a dependent is the switch-level expression of §8.7 — creation cannot be active where strategy has not locked.

---

## 10. Audience — per profile, per surface

The client-facing guarantee lives in the declarations, not in the UI (spec 21 §4.1). This is the full table for everything this spec touches.

| Surface | Owner sees | Client sees | Door |
|---|---|---|---|
| Intake app — questionnaire | yes | yes: only rounds sent to their profile, only their own profile's questions | `give:intake` |
| Intake app — their submitted answers | yes | yes, read-only, their own profile's answers | `give:intake` |
| Intake — the client-ideas lane | yes | yes, when `creation.seed_input_client` is active | `give:intake` |
| Intake — round list, versions, status | yes | only the progress of their own open round | `give:intake` |
| Finding session — recording and transcript | yes | no | — |
| Curation workspace | yes | **never** | — |
| `personal-details/*`, `business-details/*` | yes | **never** — the folders are owner audience in the declarations | — |
| Derivation workspace, reason lines, sources | yes | **never** — these are the raw working notes PLAN §4 excludes | — |
| Gate set | yes | never | — |
| Switchboard / `toolset/` | yes | never | — |
| Strategy summary (locked version only) | yes | yes — `positioning`, `pillars` (name, description, job), `platforms`, `voice`, `audience-decided`, `goals`, `visual-branding`, `cadence`, `ctas`, `obligations` | `see:strategy`, `see:obligations` |
| Strategy internals | yes | **never** — `boundaries`, `proof-library`, `funnel-shape`, `working-mode` internals, `toolset`, `gates` | — |
| Files handed over at intake | yes | their own, in their assets window | `give:assets` |

**The strategy summary is a filtered view of the locked version, not a second artifact.** PLAN §4 asks for "their strategy summary (curated by her — never the raw working notes)." The lock is what separates the two: what the client sees is the version she locked, never the state she is editing toward. No copy of strategy is created, so PLAN §3.11's no-second-copy law is untouched.

Declaring this requires audience amendments to spec 21's declarations for several `content-strategy` subfolders (§11.3). They are additions of a declared see-point, not a new door — `see:strategy` already exists, and a see-point may never be fed by the client, which none of these are.

---

## 11. Corrections this spec must land in spec 21's shipped code

Named openly, changed in place, no parallel versions.

### 11.1 A profile at lifecycle `setup` must be able to receive intake

**The bug:** spec 21's `LIFECYCLE_POLICY.setup` sets `client_access: false`. But `setup` is exactly the phase intake exists for, and the dashboard questionnaire is give-point 1 — a client door. As shipped, the only phase where intake happens is the phase where the client cannot reach it.

**Where it came from:** S22 says each lifecycle state declares its client access; it does not say setup has none. That was spec 21's encoding, and it contradicts PLAN §4 and PLAN §3.4's order (intake → curation → strategy → switches → creation).

**The fix:** client access becomes scoped rather than boolean.

| Lifecycle | Client doors open |
|---|---|
| `setup` | `give:intake` only |
| `active` | all four give-points and the see-points their switches grant |
| `paused` | none (client-audience switches at `history`) |
| `closing` | none; connectors revoked; export package |
| `archived` | none; everything at `history` |

`LifecyclePolicy` gains `client_doors: ClientDoor[]`; `client_access` stays as the derived boolean (`client_doors.length > 0`) so nothing else breaks. `validateSwitchConfig`'s "no client-audience switch active while client access is off" check becomes door-aware.

### 11.2 `amendEntry` must refuse raw answers

Per §6. `amendEntry` currently accepts any entry at an append-only path. It gains a guard: entries at `context/intake/answers` accept no amendments at all. S11's "raw answers are never altered" becomes true rather than intended.

### 11.3 Declaration edits

| Path | Edit | Why |
|---|---|---|
| `context/intake/answers` | add `work-log/creation/topics` to `read_by` | The client-ideas lane (§7.5), per the recorded ruling that a client's ideas arrive at intake and her curation makes them seeds |
| `context/business-details/materials` | **new declaration** (§12) | Law-4 addition |
| `context/business-details` | add `work-log/creation/channels` and `work-log/assets` to `read_by` | `materials.existing-accounts` seeds channels; `materials.*` points at assets |
| `context/content-strategy/positioning`, `voice`, `audience-decided`, `cadence`, `ctas` | `audience: 'owner'` → `'both'`, `client_door: 'see:strategy'` | PLAN §4: the client sees their strategy summary, and a brand book without positioning or voice is not one. `boundaries`, `proof-library`, `funnel-shape` stay owner-only |
| `context/content-strategy/gates` | `read_by` gains `context/content-strategy/voice`, `context/content-strategy/positioning` as sources | S14: gates are derived from strategy |

Every edit runs through spec 21's validator; none creates a new door, and none touches the frozen spine.

---

## 12. Law-4 addition

One new folder, declaring its feeds and readers at birth (law 4), living inside an existing spine folder so law 1 is intact. Listed for the control room to ratify into PLAN §3, in the same form spec 21 used.

| Path | Why | Fed by | Read by | Switch |
|---|---|---|---|---|
| `context/business-details/materials/` | What the client already has: brand book, logo files, photo and video bank, old content that worked, and the accounts they already run. Spec 08's Block E asked for it (Q14) and the tree had nowhere to put it; `visual-branding`, `obligations`, `cadence`, and channel creation all need it, and channel identity was one of the 16 questions spec 21's ResumeGuru migration had to leave unanswered | owner (her curation of intake answers) | `context/content-strategy` (visual-branding, obligations, cadence, platforms) · `work-log/creation/channels` (account identity seed) · `work-log/assets` (what to expect) | `spine.fixed` |

Kind `parameter`, entry type `curated_parameter`, states `['active']`, history `mutable_with_supersession`, audience `owner` — identical in every respect to the six sibling folders it sits beside.

---

## 13. Migration — existing profiles' onboarding data

Spec 21 already did half of this, and this spec does not redo it.

**What already happened (spec 21's `migrateProfile`):** a profile's legacy `onboarding[]` became **round 0** — the round record with `legacy: true` and status `answered`; one question entry per item, marked legacy and flagged `regenerate_from_parameters: true`, confidence `legacy-unverified`; one answer entry per item, verbatim, confidence `confirmed`. A sort-queue item was added saying these questions were hand-written and get regenerated after her vocabulary session. `intake.questionnaire` was SUGGESTED at `history` — never set.

**What this spec adds — a second, separate pass:**

1. **The mapping pass.** For each round-0 answer, propose the parameter it most likely belongs to, and put the proposal in her curation queue. **It never writes a curated value.** A legacy question like "what's your Instagram?" maps to `materials.existing-accounts`; a rambling paragraph may map to three parameters or none. Anything unmapped is listed by name, not dropped silently.
2. **Legacy values already curated by spec 21's migration** (offers from `brand.services`, audience from `brand.audience`, positioning from `brand.tagline`) keep `confidence: legacy-unverified` until she confirms them here. Confirming sets `confidence: confirmed`, `curator: her`, and `source_refs` pointing at the legacy field id — the trail stays honest about where it came from.
3. **Question regeneration.** Once her vocabulary pass lands, round 1 is generated from the registry. Round 0's questions stay exactly as written, at `history`, forever — the record of what was actually asked.
4. **Profiles with no onboarding data** get no round 0. Their round 1 is their first.
5. **Her own profiles** may skip rounds entirely and use owner-direct curation (§7.4).
6. **No profile is auto-locked.** Every existing profile keeps rendering exactly what it renders today until she walks it through curation → derivation → switches → lock. `strategy_version` stays null until she locks, and §8.7's creation refusal applies only to profiles that have never locked — which is why the migrated profiles need a one-time exemption: **a profile migrated by spec 21 keeps its legacy creation surface working until it locks.** Stated as a rule so nobody removes it later: the refusal binds new writes through the tree, not the legacy slices spec 21 deliberately left rendering.

**Order of the build itself** (spec 21 §9's discipline, kept):

1. The parameter registry, the generator, the derivation map, and the validator extensions ship first, with no data touched. `npm test` green before anything else.
2. The corrections in §11 land next — the lifecycle scope, the amendment guard, the declaration edits.
3. The curation surface, then the derivation surface, then the lock.
4. Then one profile: **ResumeGuru**, hers, the same pilot spec 21 used. A client profile is never the experiment.
5. Then her other profiles, then clients one at a time, each verified by §14 against real data before the next starts.

---

## 14. Acceptance tests

Concrete and runnable, in spec 21's style: plain Node, no dependencies, no build step, added to `tests/` and run by `npm test` alongside spec 21's existing 70 checks, which must all stay green.

1. **Intake is HOW.** Every question generated in a round resolves to a registry parameter whose `path` is a declared path under `context/personal-details/` or `context/business-details/`. A question with no parameter fails the build.
2. **No strategy question.** No registry parameter targets `context/content-strategy/*`. Exactly one parameter (`client-ideas`) targets `work-log/creation/topics`; any second one fails.
3. **The growth test, at parameter level.** Add a parameter to `business-details/market/` in the registry; it appears in the next generated round with no code change, and does not appear in an already-sent round.
4. **Cascade reaches questions.** With `platforms.linkedin → hidden`, no generated question addresses a LinkedIn-dependent parameter, on her side or the client's. Flip to Instagram and it behaves identically.
5. **Draft vocabulary blocks sending.** A round containing any `vocabulary: draft` parameter cannot move to `sent`.
6. **Answers are immutable.** A second `putEntry` on an existing answer id throws; `amendEntry` on any entry at `context/intake/answers` throws; a corrected answer is accepted only as a new entry in a new round.
7. **Lineage is required.** A curated value written with no `source_refs`, no `curator`, or no `confidence` is refused. Every value written by the curation pass in a full pilot run has at least one `source_ref` that resolves to a real answer entry (or an `owner-direct:` marker on an `owner_kind: hers` profile).
8. **Supersession keeps history.** Re-curate a parameter: the old entry is at `history`, the new one carries `provenance.supersedes` pointing at it, both are readable, neither is deleted.
9. **The status flow.** `not sent` → `sent` → `answered` → `curated` computes correctly; a round with one unanswered and unskipped parameter stays `sent`; an explicit skip counts as answered; curation of every parameter flips it to `curated`.
10. **No orphan parameter, both directions.** Every registry parameter names at least one strategy reader in `required_for` or carries `reader: none-by-design` with a reason; every strategy parameter in the derivation map names at least one source parameter.
11. **The four doors hold.** A client write to `context/intake` (the round object), to any `personal-details` or `business-details` path, or to any `content-strategy` path is refused server side. A client write to `context/intake/answers` for a round sent to their own profile succeeds. A client write to another profile's answers is refused. Spec 12's security suite is re-run against the resolver.
12. **Setup access.** A profile at lifecycle `setup` with a client binding can reach `give:intake` and nothing else — not assets, not review, not perception, not any see-point.
13. **Gate set v1.** The gate set cannot lock while `voice/` or `positioning/` is empty, or with fewer than five brand gates. Once locked, version 1 is immutable; a gate change produces version 2, and version 1's pass records are unchanged.
14. **The switchboard blocks the lock.** Strategy cannot lock while any switch has no position set by her; a position carrying `suggested: true` counts as unset.
15. **Lock validation bites.** Each of the six refusal conditions in §8.6 blocks the lock on its own, and the failure message names the condition. After a successful lock, `validateSwitchConfig` returns clean and the canonical LinkedIn cascade trace still holds.
16. **Creation stays locked.** Any write to a path under `work-log/creation` on a profile with `strategy_version == null` is refused; after the lock the same write succeeds. A spec-21-migrated profile's legacy slices keep working throughout.
17. **Retirement and reopen.** With every round `curated`, `intake.questionnaire` resolves to `history` for the client and the Intake app is not rendered; past answers stay readable. Reopening a round for two parameters creates version N+1 with exactly two questions, returns the app to active, and leaves the previous round and all its answers untouched at `history`.
18. **Migration is honest.** A profile with legacy `onboarding[]` produces round 0 with every answer preserved verbatim; every legacy answer is either mapped to a parameter proposal or listed by name in the sort queue; nothing is auto-curated; no legacy answer is lost.
19. **The save race, at this spec's seam.** A client submitting answers and her curating a parameter at the same moment both survive — scopes `context/intake/answers` and `context/personal-details/*` merge independently.
20. **Nothing regressed.** Spec 21's full suite (70 checks, including the orphan check and the security re-run) passes with the new registry, the new declaration, and the §11 corrections in place.

---

## 15. Deliberately out of scope

Named rather than left silent, per spec 21's discipline.

- **The GUI.** How the Intake app, the curation workspace, and the Strategy surface look belongs to the interface spec (PLAN §2, §3.10). This spec fixes content, audience, and refusals; not layout.
- **The client-side rendering** of the strategy summary and the four see-points — the client-side regroup (PLAN §8 step 9). This spec declares the audience so that spec has a contract.
- **AI-drafted strategy.** PLAN §3.4: derived by her. Spec 09 (Strategy Draft) predates the plan and gets re-cut against it later; nothing in this spec generates a strategy value, a positioning line, or a pillar.
- **Seed extraction from finding-session transcripts.** The transcript is stored and addressed here; reading it for seeds is the Content Engine family's job (PLAN §5.1, §5.3).
- **`analysis/market-research/` parameters.** PLAN §5.2 keeps them deliberately open until the first real need appears (law 4).
- **The review workflow.** The S20 review configuration's VALUES are set here at strategy lock, because the switchboard depends on them. How review actually runs — verdicts, windows, reminders, delegated approvers, the silence rule — is creation's and the client-side regroup's territory.
- **Public, unauthenticated intake links.** PLAN §3.1 names exactly two delivery modes, and S19 permits no fifth door. A third route would be a plan change and therefore her gate. Flagged honestly in §5.4 because it will be felt on day one with a new client.
- **WhatsApp as an intake route.** The pipe is parked at Meta's registration step (spec 18B), unchanged.
- **The chat thread and the untagged inbox.** Frozen per PLAN §11 Q1, untouched, their own spec after the restructure.
- **Retention and deletion.** Answered by her (PLAN §11 Q5): retention forever, deletion only by her with an export first. Already encoded in spec 21's `LIFECYCLE_POLICY`; nothing to add.
- **The deploy path.** DEPLOY.md and CLAUDE.md rule 6 stand: her explicit go, every time.

---

## 16. Open questions

**None.** Per PLAN §6, a question a fresh spec chat cannot answer from the vault is a hole in the plan. Four candidates were checked twice and the plan answered all four; recorded here so the control room can see the reasoning rather than take the claim on trust.

1. **What does the client's "strategy summary" mean — a filtered view, or a document she writes?**
   Answered by PLAN §3.4 plus §4 read together: strategy is versioned and LOCKED before creation. What the client sees is the locked version of the client-audience parameters; her working edits toward the next version stay invisible. That satisfies "curated by her, never the raw working notes" without creating a second copy of strategy, which PLAN §3.11 forbids. §10.

2. **How does a client without a login answer intake?**
   Answered by PLAN §3.1: exactly two delivery modes, and only two. No login means the recorded meeting, which she files. Extending review's public-link ruling (PLAN §11 Q2) to intake would invent a third route and a door S19 does not grant. §5.4.

3. **Who answers when a profile has several client users?**
   Answered by PLAN §11 Q3's ruling: bindings are (person, profile) pairs and a profile may have several client users. Any bound user may answer; each answer records its author; conflicts are not machine-resolved, because raw is plural and curated is singular, and curation is hers. §5.4.

4. **Does intake apply to her own profiles?**
   Answered by PLAN §2: her workspaces are profiles, she is client zero, how she collects her own Context is her call, and the structure does not bend for her. Hence owner-direct curation with full provenance, and every other rule unchanged. §7.4.

**One input this spec waits on, which is not a hole:** her vocabulary pass on §4. PLAN §3.1 already records that session as owed, and PLAN §11 Q4 already assigned the inventory to this spec after it. The build can ship everything else — the registry machinery, the rounds, the curation pass, the derivation surface, the lock — with the inventory in `vocabulary: draft`, and the generator refusing to send a draft round to a client. Her pass flips the flag; nothing waits on it except the first real client round.
