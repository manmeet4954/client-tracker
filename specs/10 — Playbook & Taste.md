# 10 — Playbook & Taste (what KRNL learns across clients)

Reserved in the backlog since 2026-07-13; written 2026-07-17. The last
station of the system: what one client's results teach every future client,
and how the system learns to draft the way MANMEET would. Her words: "make
this a tool for KRNL OS — parameters layered by the taste that I have." This
is the irreplaceability layer.

Two halves, one spec, because they feed the same reader (the draft engine of
spec 09).

---

## Half A — The Playbook (cross-brand evidence)

### What it is

Every client's analytics already produces verdicts (spec 06 patterns, spec 07
digests). The playbook is where verdicts that survived become **reusable,
cited entries**, keyed by context:

> "How-to carousels under a Trust pillar: beat baseline in 7 of 9 posts
> across 2 service-business accounts (ResumeGuru, Divine). Seen since
> 2026-06. Evidence: [the posts]."

An entry is always: the pattern + the context it worked in (industry,
audience type, goal mix — Brand Profile fields, which is why spec 08 fields
are typed) + the sample size + the evidence links.

### The rules that keep it honest

1. **Entries are born from data, not opinion.** A pattern needs the spec 06
   threshold (3+ occurrences above baseline) in at least one account before
   it can enter the playbook. Below that it stays a local "early signal."
2. **Small-n honesty travels with the entry.** "Seen twice, early signal"
   is stored ON the entry and shown wherever it is cited. At 10–20 brands
   this becomes genuinely powerful; at 3 it stays modest — and says so.
3. **Context match required.** The draft engine may only cite an entry for
   a new client if the context overlaps (same industry family, similar goal
   mix, similar audience type). A restaurant pattern never advises a career
   coach just because both are "clients."
4. **Numbers never cross accounts.** Playbook entries carry patterns and
   win-rates, never absolute metrics. Baselines stay per-account, always
   (spec 04 law).
5. **Entries age.** Each entry shows when last confirmed. Instagram changes;
   a 2026 pattern is not a 2028 truth. Stale entries fade to "historical",
   they are never silently deleted.

### Where entries come from (no new ritual)

- Automatic candidates: spec 06 pattern verdicts crossing the threshold.
- Her one tap: a digest insight she found true gets "add to playbook."
- Never: free-typed folklore without evidence links.

## Half B — The Taste Layer (how Manmeet decides)

### What it is

Spec 09's review screen produces a stream nobody has to write: her
**accepts, edits, and dismissals** of drafted items. The taste layer distills
those into explicit, inspectable rules:

> "Cuts promo mix below 20% — done on 4 of 4 drafts."
> "Renames pillar names to the client's own words, never keeps generic ones."
> "Rejects posting-frequency increases for solo founders."

The next draft is generated WITH those rules in the prompt — so drafts start
arriving pre-shaped to her judgment, and the "why" line can say "kept promo
at 15% (your standing preference)."

### The rules

1. **Taste rules are visible and hers.** A screen lists every learned rule
   in plain words with the edits that created it. She can pin one as law,
   soften it to a lean, or delete it. Nothing hidden, nothing implied.
2. **A rule needs repetition.** One edit is a fact; three of the same kind
   are a candidate rule. The system proposes, she confirms (same accept
   pattern as everything else).
3. **Taste vs evidence conflicts surface, never auto-resolve.** If the
   playbook says "grow promo" and her taste says "cap promo," the draft
   shows both and asks. Her call is then captured — that collision answer
   is the highest-value taste data there is.
4. **Nothing trains.** Same boundary as spec 09: rules are text the engine
   reads openly, not weights. Delete a rule and it is gone.

### Why this is the moat

The playbook is copyable in principle (any agency could collect patterns).
The taste layer is not — it is HER accumulated judgment, made explicit,
citable, and teachable. It is also the handover document CLAUDE.md's second
goal asks for: a new hire reading the taste rules learns how Manmeet decides.

## Build shape

Medium, but naturally staged and almost all of it rides on spec 09's
plumbing:

- Stage 1 (with spec 09): capture the accept/edit/dismiss stream. Free.
- Stage 2: playbook entries (new storage slice, rule-5 checklist) + the
  "add to playbook" tap in digests.
- Stage 3: taste-rule distillation (a periodic Claude pass over the edit
  stream, proposing rules for her confirm) + both feeding spec 09's prompt.

Depends on: 08 + 09 live, and honestly, months of real use. This spec exists
now so 08 and 09 are built with the right hooks (typed profile fields,
captured edit stream), not so it gets built next.

---

## Pending decisions (Manmeet)

1. Playbook context keys: industry family + goal mix + audience type enough,
   or add price band? (Her vocabulary session for spec 08 settles the words.)
2. Should Sonia/intern ever see the playbook (internal training material),
   or owner-only? Clients never see it either way.
3. Taste rules: is she comfortable with the system proposing rules about her
   own behavior? (The alternative: she writes taste rules by hand only.)
