# 29 — Context Export & the Harvest Door

**Status:** WRITTEN, NOT BUILT (2026-08-04). Written from the decision recorded at the end of `specs/00 — Dashboard Backlog.md` on 2026-08-01, plus `PLAN.md` (§5.1, §5.3, §10), `specs/22 — Intake & Context.md` and `specs/23 — Content Engine I — Seed Bank & the Engine Room.md`. The decision is made and this spec does not reopen it.

**Authority:** `PLAN.md` outranks this file. Where an amendment in PLAN §10 touches anything below, the amendment wins. Specs 21–28 are the shipped contract underneath: this spec invents no second version of anything they declared, and it introduces no second storage pattern (CLAUDE.md rule 5). The separate Content Engine repository (the Codex "Seed Bank / Client Intelligence OS") is **not authoritative here** — four of its ideas were adopted by the 2026-08-01 decision and nothing else of it is carried forward.

**Why this spec exists, in one line:** the dashboard assembles a context packet on every model call and **that packet has never once left the building**. She cannot hand a profile's understanding to a chat, to a collaborator, or to herself in a different tool. This spec opens that door in both directions — out (the export) and back in (the harvest).

---

## 1. What this spec is, and is not

**It is, in priority order:**

1. **The export.** One action inside a profile that produces a portable pack: the profile's approved Context and its locked seeds, as one readable file she can attach or paste into any chat. **This is the hinge and it is shippable alone.**
2. **The visibility flag.** `private` · `internal` · `portable` on Context parameters and on seeds, so the export has something to filter on and so she can keep a thing out of the pack without deleting it.
3. **The harvest door.** A typed, idempotent, review-gated packet coming back the other way, generalising spec 23's capture box: an outside conversation produces candidate values, they queue, and **nothing lands in Context or the seed bank until she accepts it, one candidate at a time.**

**It is not:**

- **A second context assembler.** The export reuses `assemblePacket` in `lib/engine/packet.ts` as a fifth content profile. A build that writes a parallel walker of the body is rejected on sight.
- **A new tab, a new app, or a new nav item.** She said the dashboard already feels heavy and chaotic (STATE.md 2026-08-01), and adding machinery is the wrong direction. The export is one row in the owner corner of spec 28 §5.5. The harvest door is one screen reachable from that same row.
- **A fifth client door.** Everything here is `audience: owner`. A client-produced packet reaches the system through give-point 1 (intake), which is spec 22's amendment, not this spec's build (§10).
- **A model call.** The export makes none, costs nothing, and works with `ANTHROPIC_API_KEY` unset. The harvest door makes none either: the outside chat did the thinking, this side only types and queues it.
- **The Hook Bank.** Parked by the 2026-08-01 decision, deliberately, because it overlaps the costume's `hook_type` dimension and needs a which-is-authoritative call first.
- **The three small amendments.** `evidence_status` on the Seed (spec 23 §6.4), the client-AI extraction protocol (spec 22 §5.4), and owner-facing success metrics (PLAN §5.1) were adopted as amendments to those documents, not as work in this one. §16 names what this spec assumes about each.

---

## 2. Where this sits, and what it needs first

### 2.1 Order

After spec 28. Nothing in the engine family, the analysis family, or the shell depends on this spec, and this spec depends on all of them existing. It can be built at any time, and it is the smallest useful thing left in the plan.

### 2.2 What must be true before this builds

| Precondition | State today | If missing |
|---|---|---|
| Specs 21–28 built and deployed | done (2026-08-01) | blocked |
| `assemblePacket` shipped with the content-profile pattern | done (spec 24 shipped it with two profiles; spec 25 took it to four) | blocked — the alternative is a second assembler, which this spec forbids |
| The profile has curated Context | true for ResumeGuru only | the export runs and produces a thin pack that says plainly what is missing. It never refuses and never invents. |
| The profile's strategy has locked | true for ResumeGuru only | the pack carries personal-details and business-details and says: *"strategy is not locked on this profile — nothing derived is in this pack."* |
| `ANTHROPIC_API_KEY` | irrelevant | no effect. Nothing here calls a model. |

### 2.3 What a profile's lifecycle grants

Per S22 and `LIFECYCLE_POLICY` in `lib/tree/objects.ts`:

- `setup` · `active` · `paused` — the export runs; the harvest door accepts packets.
- `closing` · `archived` — **the export must still run.** `export_package: true` is declared on both states and has never been implemented; this spec is what makes that declaration true. The harvest door is closed at both: nothing new enters a profile that is closing.

This is also PLAN §11 Q5's other half. Her answer was: retention forever, **deletion only by her, personally, with an export first.** There is no export today, so the deletion path has never been legally walkable. After this spec it is.

---

## 3. The export — what a pack is

### 3.1 The shape

**One markdown file.** Not a zip, not JSON, not a folder. The reasons, all of them load-bearing:

- It pastes into a chat window as-is, and it attaches as a file where the chat takes attachments.
- A person can read it. She can read it, and so can a collaborator she hands it to.
- It opens in Obsidian, which is where the rest of her thinking lives.
- The fresh-AI portability test (§8) is only meaningful if the thing handed over is what a model actually reads best.

Filename: `<profile-name> — Context Pack — YYYY-MM-DD.md`.

### 3.2 What is in it

Four parts, in this order.

**Part 1 — the header.** Profile name, the date generated, the pack version, the `context_version` it was assembled at, and one plain line she does not have to write: *"This is a client context file. Treat it the way you would treat their brand folder."*

**Part 2 — the manifest.** What is in this pack, what is not, and why. Every excluded path is named with its reason, from a fixed vocabulary: `not curated yet` · `strategy not locked` · `switched off` · `marked private` · `marked internal` · `never portable`. **No silent omission, ever** — the same law §5.4 of spec 23 put on the packet's size guard.

**Part 3 — the context.** Block A and Block B as `assemblePacket` already assembles them, rendered as headed markdown sections instead of cached system blocks.

**Part 4 — the seeds.** Every **locked** seed, in full: name, the raw thought, core message, visible and deeper problem, common belief, reframe, audience value, product connection, examples, nuance, prohibited interpretation, proof required, possible pillars, possible angles. This is the part that makes the pack worth more than a brand book — it is not what the brand looks like, it is what the brand *thinks*.

**What is structurally ineligible, whatever any flag says:**

| Not in the pack | Why |
|---|---|
| Raw intake answers | Verbatim client speech, append-only evidence, never a deliverable (spec 22 §6) |
| Unlocked seeds, captures, proposals | Not approved. A draft seed leaving the building is a half-thought presented as a position |
| Everything in `work-log/` except locked seeds | Drafts, verdicts, schedules, metrics, assets, rights, engine runs, feedback, taste rules |
| Another profile's anything | Always. A pack is built from exactly one profile (spec 23 §5.4, kept) |
| Everything under `frozen/` | The chat thread and the untagged inbox, exactly as PLAN §11 ordered |

The whitelist is the mechanism: only curated Context and locked seeds are ever candidates. The visibility flag narrows that set; it can never widen it.

### 3.3 What "approved" means, per part

Both conditions must hold. Neither alone is enough.

| Part | Approved when |
|---|---|
| `context/personal-details/*` · `context/business-details/*` | a `CuratedParameter` exists at the path, carrying provenance (spec 22 §7.2) |
| `context/content-strategy/*` | the profile's strategy has locked (version ≥ 1) — a derived value before the lock is a draft |
| `work-log/creation/topics` | `status === 'locked'` (spec 23 §6.5) |

A path with no curated value is not in the pack and appears in the manifest as `not curated yet`. That absence is information: it tells her exactly where the profile's understanding is thin, which is the same job her sort queue does.

### 3.4 The cascade applies, unchanged

Only `active` paths enter the pack. A platform at `history` or `hidden` puts nothing in it, and its past pieces stay readable in the dashboard exactly as S9 requires. `pathIsActive` already does this inside the assembler and the export inherits it for free.

### 3.5 On screen

Spec 28 §5.5, the owner corner, gains **one row**: *"Take this profile with you."*

Pressing it shows the manifest first — what will be in the pack and what will not — with the excluded lines readable, and two buttons: **Copy** and **Download**. Nothing generates in the background; nothing is stored unless she presses one of the two.

**No new tab. No new app. No badge, no count, no nag.** If a build adds a fourth app to a profile for this, the build is wrong.

### 3.6 What is recorded

One `export_record` per completed export, appended to `work-log/logs/exports`:

```
id, profile_id, at, by,
pack_version, context_version, strategy_version,
included: { paths[], seed_ids[] },
excluded: [{ path_or_seed_id, reason }],
size_chars, delivery: "copy" | "download"
```

No copy of the pack's text is stored. The pack is a projection of the body and the body is the record; storing the file too would be the second copy S1/S2 exist to prevent. The record exists for one reason: PLAN §11 Q5's deletion rule needs to be able to answer *"was there an export first?"*

---

## 4. The visibility flag

### 4.1 The three values

| Value | Meaning |
|---|---|
| `portable` | travels everywhere: into engine packets, into the export |
| `internal` | travels into engine packets, **never leaves in an export** |
| `private` | stays where it is. Not in the export, and **not in an engine packet either** |

Three values and not two, because there are genuinely two different reasons to hold something back, and collapsing them would make the flag a lie in one direction or the other. `internal` is "the engine should know this, an outsider should not" — pricing, a difficult client history, an unlaunched offer. `private` is "nothing automated should read this at all."

### 4.2 The default is portable, and there is no migration

The absence of a flag reads as `portable`. Nothing is written to existing data, no backfill runs, and the export works on day one on every profile that has curated Context. Marking is a downgrade she performs when she wants one — never a chore she must complete before the feature works.

This is deliberate and it has a cost, stated plainly: **the first export of a client profile will contain that client's context by default.** That is correct — it is her file about her client, the same as their folder in her drive — and it is why the pack header says so in words, why the export is owner-only, and why raw answers are structurally ineligible no matter what.

### 4.3 Where it lives

On the entry, not on the declaration. A `CuratedParameter` gains `visibility?: Visibility`, and a `Seed` gains the same field. Both optional; both absent everywhere until she sets one.

**This is a fourth addition to the canonical Seed, and spec 23 §6.4 says no later spec may add one "without the same justification."** The justification: the export cannot exist without a per-seed answer to "does this leave the building", the flag is not derivable from `status` (a locked seed can still be one she will not hand out), and there is nowhere else it could live without creating a second record about seeds. Recorded here so the rule stays real rather than quietly broken.

### 4.4 The teeth, in both directions

`private` excluding a path from engine packets is a behavior change to shipped code, and it will be felt: marking something private can make a draft thinner. So it is never silent. The assembler already records what it read and what it trimmed; a private exclusion is recorded the same way and rendered on the same "the engine read everything except…" line spec 23 §5.4 built.

### 4.5 On screen

One small control on the parameter row in the curation surface, and one on the seed sheet. Default state shows nothing at all — an unmarked thing renders with no badge, because the default is the common case and badging it would put a chip on every row in the system. `internal` and `private` render as a quiet label.

---

## 5. The harvest door

### 5.1 What it is

Spec 23's capture box, generalised. The capture box takes raw text she pastes and hands it to the engine. The harvest door takes **structured candidates an outside conversation already produced** — from the pack she exported and talked to, from a transcript tool, from a client's own AI — and queues them for her review.

The philosophy the 2026-08-01 decision adopted, stated plainly: *the chat is where the rich thinking happens; the records are the durable memory.* Today that thinking has no way home except retyping. This is the way home.

### 5.2 The packet

```
operation_id      required, unique, chosen by the sender. The idempotency key.
base_revision     the context_version the pack was generated at
source            free text: "claude chat 2026-08-04", "client AI packet", …
generated_at
candidates[]      each one:
  temp_id         required. Sender-chosen. Never a real entry id.
  target          "context/business-details/offers" | "seed"
  key             the parameter key, for context targets
  value           the proposed value
  evidence        verbatim text from the conversation this came from
  confidence      "confirmed" | "inferred" | "hypothesis"
  note            optional, one line
```

Four rules, each enforced at the write door and each with a failure it prevents:

1. **`temp_id` only.** A candidate may never carry a real entry id. An outside packet can therefore never address, overwrite, or supersede anything that exists. Malformed or hostile, the worst it can do is queue noise she declines.
2. **Idempotent by construction.** The packet is written at `work-log/logs/harvests` with `id = operation_id`, and that path is `append_only` — `putEntry` already refuses to overwrite an existing id. Re-submitting the same packet is a no-op that returns the original record. No new machinery: the door spec 21 built does this already.
3. **Nothing writes through.** Accepting a candidate is a separate owner action per candidate. The packet landing is not a write into Context or the seed bank and cannot become one.
4. **`evidence` is required.** A candidate with no evidence span is refused at the door. The whole point is that the durable record can say where a value came from; a candidate with no evidence has nothing to give provenance.

### 5.3 The review queue

One screen, reachable from the same owner-corner row as the export. Per candidate: the proposed value, the evidence beside it, its confidence, and where it wants to go. Three actions:

- **Accept** — writes the real record: a `CuratedParameter` at the target path through the path-scoped door with `provenance.source_refs: ['harvest:<operation_id>#<temp_id>']`, `curator: her`, and `confidence` carried across; or, for a `seed` target, a `seed_capture` into `work-log/creation/topics/captures` exactly as if she had pasted it into the capture box, from which spec 23's flow continues unchanged.
- **Edit and accept** — the same, with her wording. The candidate's original text stays on the harvest record.
- **Decline, with a reason** — the candidate stays on the record at `declined`. Nothing is deleted.

The provenance chain is unbroken end to end: a curated value points at a harvest candidate, which carries its evidence span, which names the conversation it came from. Two years later "why does this brand never say hustle" still returns a sentence somebody actually said.

### 5.4 A stale base revision does not refuse

If `context_version` has moved since the pack was generated, the candidates still queue, badged: *"the context moved since this pack left — check these against what is there now."* Refusing would throw away real work over a race that is normal in a system where she is the only writer. The check is a warning, never a gate.

### 5.5 Who may submit

**Owner only.** The endpoint is owner-authenticated and a client login cannot reach it, which is what keeps S19's four doors at four. A client-produced packet arrives the way every other client-produced thing arrives: through intake, give-point 1, as an answer she then curates — spec 22 §5.4's amendment, which is not built here.

---

## 6. Addresses — every folder this spec reads and writes

Per PLAN §6 rule 3, no spec ships without this table.

### 6.1 Paths WRITTEN

| Path | New? | Entry type | Fed by | Read by | Switch | History | Audience |
|---|---|---|---|---|---|---|---|
| `work-log/logs/exports` | **new (law 4)** | `export_record` | `owner` | `owner` | `context.export` (fixed) | `append_only` | owner |
| `work-log/logs/harvests` | **new (law 4)** | `harvest_packet` | `owner` | `owner`, `path:context/personal-details`, `path:context/business-details`, `path:work-log/creation/topics/captures` | `context.harvest` | `append_only` | owner |
| `context/personal-details` · `context/business-details` | existing | `curated_parameter` | `owner` | unchanged | unchanged | unchanged | owner |
| `work-log/creation/topics/captures` | existing (spec 23) | `seed_capture` | `owner` | unchanged | `creation.engine` | `append_only` | owner |

The last two are written only by an accepted harvest candidate, through the ordinary owner door, with provenance. This spec adds no new writer to either.

### 6.2 Paths READ (and never written)

Everything `assemblePacket` already reads for the extraction profile — `context/content-strategy/boundaries` · `voice` · `positioning` · `pillars/*` · `platforms/*` · `audience-decided` · `proof-library` · `ctas` · `goals`, and `context/personal-details/*` · `context/business-details/*` in full — plus `work-log/creation/topics` (the locked seeds **in full**, where extraction reads only the index).

### 6.3 Law-4 additions for the control room to ratify into PLAN §3

| Path | Why | Fed by | Read by | Switch |
|---|---|---|---|---|
| `work-log/logs/exports/` | PLAN §11 Q5 makes deletion legal only after an export. Without a record, "was there an export first" is unanswerable, and S22's `export_package: true` at `closing` and `archived` stays a declaration nothing honors. | her | her | `context.export` |
| `work-log/logs/harvests/` | The typed, idempotent packet, kept whole with its candidates, their evidence, and her decision on each. Idempotency is `id = operation_id` on an append-only path, so the record IS the mechanism, not a log of it. | her | her; the paths an accepted candidate routes to | `context.harvest` |

Both live inside the existing `work-log/logs/` spine folder (law 1 intact), beside `engine-runs` and `feedback`, and each declares its feeds and readers at birth (law 4).

---

## 7. Switches registered

| Switch | Owns | Requires | Dependents | Audience | States | Suggested |
|---|---|---|---|---|---|---|
| `context.export` **(new, fixed)** | the export action and its record | — | `context.harvest` | owner | active only | active |
| `context.harvest` **(new)** | the harvest door, the review queue, the packet record | `context.export` | — | owner | active / history / hidden | **hidden** |

**Why the export is fixed.** PLAN §11 Q5 makes an export the precondition of deletion, and S22 declares `export_package: true` at `closing` and `archived`. A switch that could turn the export off would make both a lie, and would make a profile at `archived` — the exact state where the export matters most — the one state where it does not run. Same justification shape as spec 23's `logs.engine_runs` and `logs.feedback`.

**Why the harvest ships hidden.** She said the dashboard feels heavy. The harvest door is machinery; the export is the thing she asked for. It ships off, she turns it on when she wants it, and turning it on costs nothing that was not already built. Turning it back to `hidden` later leaves every past packet and every accepted value readable (S9).

**The cascade, traced.** `context.harvest → hidden` removes the submit endpoint and the review queue. Packets already accepted stay as ordinary curated values with their provenance intact — an accepted candidate is a normal record and does not belong to this switch once it lands.

**Validation at strategy lock** (S8) gains nothing. Neither switch has a prerequisite that a lock could contradict.

---

## 8. The portability test

Adopted from the 2026-08-01 decision, finding 5, as a first-class acceptance criterion rather than a nice idea.

**The claim the pack makes:** a model that has never seen this dashboard, given the pack and nothing else, can answer questions about the brand that today only the dashboard can answer.

**How it is checked, mechanically** (fixture test, runs in `npm test`): a fixture profile with known curated Context and two locked seeds is exported, and the pack must contain, verbatim or as an exact value, the answers to five questions:

1. Who is this brand for?
2. What does this brand never say, and what does it never promise?
3. What is the hero offer and how does someone buy it?
4. What does this brand believe that its market does not — in the founder's own words?
5. What proof exists, and what proof is still missing?

A pack missing any of the five fails the test.

**How it is checked, honestly** (named skip): the real version is handing the real pack to a fresh chat and asking the five questions in prose. That is not automatable and is not pretended to be. It is a named skip in the suite and a step in the build report, the same way specs 26 and 27 named their live-data halves instead of quietly omitting them.

---

## 9. Corrections and additions to shipped code

Small, and each one named so no build invents a fifth.

### 9.1 `lib/engine/packet.ts` — a fifth content profile

`ContentProfile` gains `'export'`, with `exportBlocks(input)` built from the existing helpers (`fullFolder`, `pillarLines`, `platformLines`, `proofLines`, `labelsOnly`, `neverWords`, `pathIsActive`). Two differences from `'extraction'`, both stated in the code:

- `work-log/creation/topics` renders **locked seeds in full** (`seedInFull`, already exported for the brief profile) instead of the index.
- `MANDATORY_RULES` and `universal_block` do not apply — there is no model in this path. `universal_block` is the empty string for this profile and `packetSystemBlocks` is never called on an export packet.

The size guard still runs and still records its trims; a pack that dropped a folder says so in its manifest.

### 9.2 `renderExportPack(assembled, extras)` — new, in `lib/engine/export.ts`

The only new module of any size. Pure: takes an `AssembledPacket` plus the header facts and the exclusion list, returns a markdown string. No fetching, no state, no side effects — which is what makes §8's test cheap.

### 9.3 The visibility filter

`Visibility = 'private' | 'internal' | 'portable'` in `lib/tree/objects.ts`. `CuratedParameter` and `Seed` each gain `visibility?: Visibility`. One helper, `visibleIn(entry, 'packet' | 'export'): boolean`, used by the assembler in exactly two places so there is only ever one rule.

### 9.4 `LIFECYCLE_POLICY` — nothing changes

`export_package` is already `true` at `closing` and `archived`. This spec implements the declaration; it does not amend it. Worth stating because a build may reasonably expect to touch it and should not.

### 9.5 What is deliberately not changed

`assemblePacket`'s signature, `PacketInput`, the four existing content profiles' output, the extraction call in spec 23, `putEntry`'s append-only behavior, and every declaration spec 21–28 shipped.

---

## 10. Audiences

Everything in this spec is `audience: owner`. No path carries a `client_door`, so the validator's no-fifth-door check passes trivially.

**The workshop rule, restated because it is absolute:** no switch, in any position, can grant a client sight of an export, a pack, a harvest packet, or a review queue. PLAN §4, CLAUDE.md rule 1.

**The one thing worth saying out loud:** the export is the first feature in this system whose whole purpose is to move a profile's understanding *out* of it. Its safety is not in the filtering — it is in who holds the file. The pack is generated by her, on her press, and handed by her. Nothing sends it anywhere.

---

## 11. Migration

**None.** No existing data is read, rewritten, or backfilled. The absence of a `visibility` flag reads as `portable` (§4.2), so every profile with curated Context can be exported the moment this ships, and every profile without it exports a pack that says what is missing.

Two new paths start empty. Nothing is deleted, nothing is moved, and no legacy slice is touched.

---

## 12. Order of build

1. **The `'export'` content profile and `renderExportPack`.** Nothing on screen, tested against fixtures. Includes §8's five-question test.
2. **The visibility flag and `visibleIn`.** Still nothing on screen; the filter is exercised by fixtures in both directions (packet and export).
3. **The owner-corner row, the manifest preview, Copy and Download, and `work-log/logs/exports`.**

   → **This is the shippable stopping point, and it is the correct one.** The export is the hinge. If scope must be cut, it is cut here and the rest waits. The dashboard already feels too heavy to her; shipping one working button and stopping is a better outcome than shipping three features she has to learn.

4. The visibility controls on the curation surface and the seed sheet.
5. `work-log/logs/harvests`, the packet type, the four door rules, and the submit endpoint. No screen.
6. The review queue and the three actions.

One profile at a time, ResumeGuru first, her own profile — never a client's.

---

## 13. Acceptance tests

Run by `npm test`, alongside specs 21–28's 398.

1. **The pack answers the five questions.** §8's fixture test. A pack missing any of the five fails.
2. **Approval is two conditions, not one.** An uncurated parameter and an unlocked seed are both absent from the pack, and both appear in the manifest with the right reason. A curated parameter on a profile whose strategy has never locked exports its detail folders and excludes everything under `content-strategy/` with `strategy not locked`.
3. **Nothing is omitted silently.** Every excluded path and every excluded seed appears in the manifest with a reason from the fixed vocabulary. A test that removes one exclusion line from the manifest while leaving it out of the pack must fail.
4. **The cascade reaches the export.** With `platforms.linkedin → hidden`, no LinkedIn name or format appears anywhere in the pack; flip to `history` and it still does not, while every past LinkedIn piece stays readable in the dashboard.
5. **`private` and `internal` behave differently.** A parameter marked `internal` is in the engine packet and not in the pack. A parameter marked `private` is in neither, and its absence from the packet is recorded on the assembler's "read everything except" line rather than being silent.
6. **The ineligible list is structural.** With every eligible entry marked `portable`, no raw intake answer, no unlocked seed, no capture, no proposal, no asset, no metric, no engine run, no feedback item and no taste rule appears in the pack. The test fails if any of them does.
7. **One profile only.** A pack generated for profile A contains no name, handle, seed, offer or figure belonging to profile B. (The de-identification approach spec 25 §9.6 built for taste rules, applied to the pack.)
8. **There is no second assembler.** A source scan asserts that `renderExportPack` is the only consumer of an export-profile packet and that nothing outside `lib/engine/packet.ts` walks `ProfileBody` to build one.
9. **The harvest packet is idempotent.** Submitting the same `operation_id` twice writes one record and returns the first result. The second submit changes nothing, including when its candidates differ.
10. **A candidate cannot address a real entry.** A packet whose candidate carries an existing entry id is refused at the door. A packet whose candidate carries no `evidence` is refused. Neither writes a record.
11. **Nothing lands without her.** With ten candidates queued, `context/` and `topics/captures` are byte-identical to before the packet arrived. Accepting one candidate writes exactly one record, carrying `provenance.source_refs: ['harvest:<operation_id>#<temp_id>']`. Declining preserves the candidate's original text and its reason.
12. **A stale base revision warns and does not refuse.** A packet whose `base_revision` is behind the profile's `context_version` still queues, badged, with every candidate acceptable.
13. **The export runs at `archived`.** A profile at `closing` and a profile at `archived` both export. The harvest door is closed at both.
14. **No client, no leak.** A client login and an intern login both receive a body with zero entries at `logs/exports` and `logs/harvests`, and neither can reach the export or submit endpoints. The check FAILS when the audience filter is removed.
15. **Keyless, costless.** With `ANTHROPIC_API_KEY` unset, the export produces a complete pack and the harvest door accepts a packet. No `engine_run` is written by either — they are not engine runs.

---

## 14. Open question — one, and it is hers

**Q1 — does the pack carry the founder's raw thought verbatim, or only the resolved understanding?**

The raw thought is the most valuable line in a seed and the reason the seed template exists: *"this is what protects the perspective from being polished into marketing speak"* (PLAN §5.1). A pack without it hands over a tidy summary of a belief instead of the belief. A pack with it hands somebody's unguarded words — a client's, on a client profile — into a chat window.

Three shapes, hers to choose:

1. **Always include it.** The pack is worth the most and the portability test passes on question 4 without qualification.
2. **Include it on her own profiles, exclude it on client profiles.** Reads `owner_kind`, which already exists (spec 22 §7.4). Question 4 of the portability test then passes in her language on her profiles and in the curated language on clients'.
3. **Per seed, through the flag.** `internal` on a seed means the engine keeps the raw thought and the pack takes the resolved fields only. Most control, most marking.

**The build does not wait on this.** Ship shape 1 behind the flag as §4 already defines it — a seed marked `internal` keeps its raw thought at home — and her answer either stands, or becomes a two-line change to `seedInFull` for the export profile.

**A second thing that is hers, not a question:** whether the harvest door (steps 5–6 of §12) is built at all in this pass, or parked after the export ships. The spec is written so that stopping at step 3 leaves nothing dangling.

---

## 15. Deliberately untouched

- **The Hook Bank.** Parked by the 2026-08-01 decision until it is settled whether it or the costume's `hook_type` is authoritative.
- **The Codex repository's file layout, entity model, and vocabulary.** Not adopted. Its `content_idea` + `content_piece` split violates S1/S2, its normalized relationship edges would be a second storage pattern, and its CLAUDE.md is not authoritative here.
- **The chat thread and the untagged inbox.** FROZEN, exactly as PLAN §11 ordered. The export does not read them and the harvest door does not write into them.
- **Intake's delivery modes.** The client-AI extraction protocol is spec 22 §5.4's amendment, not this spec's build.
- **The UI redesign.** The open thread in STATE.md. This spec adds one row to a screen that already exists and takes no position on how that screen should look.
- **The deploy path.** DEPLOY.md and CLAUDE.md rule 6 stand: her explicit go, every time.

---

## 16. What this spec assumes about the three amendments

Named so a build does not go looking for work that belongs elsewhere.

- **spec 23 §6.4 — `evidence_status` on the Seed.** If it has landed, the pack renders it beside each seed and the manifest counts hypotheses. If it has not, the pack is unaffected. Nothing here depends on it.
- **spec 22 §5.4 — the client-AI extraction protocol.** When it lands, a client-produced packet arrives through intake and her curation routes it; the harvest door needs no change to accept the same shape from her hand.
- **PLAN §5.1 — owner-facing success metrics.** The `export_record`'s fields are chosen to feed one of them (portability: how often a pack is taken out, and how much of the profile it could carry). No metric surface is built here.
