# 09 — Strategy Draft (the system prepares, she decides)

Reserved in the backlog since 2026-07-13; written 2026-07-17. This is the
Decide station's first real feature and the full version of connection C8 in
`13 — The Connected Loop.md`: analysis flows back into the plan.

**One sentence:** a filled Brand Profile goes in, a complete draft strategy
comes out — positioning line, pillars WITH jobs, mix percentages, posting
frequency, platform plan, CTA plan — and every single item cites its
reasoning. It is a draft she edits, never a verdict.

---

## 1. Why this exists

Manmeet's words (2026-07-13): once the parameters are explicit, her judgment
stops being re-derived per client — "that just eats my brain." The system
prepares everything around the one human read that stays hers: "what are they
really selling."

Boundary, restated: nothing here trains a model. The draft engine reads the
Brand Profile, the playbook (spec 10), and her taste rules (spec 10) like an
open book, and cites what it used. Everything it says is inspectable.

---

## 2. The two moments a draft happens

### Moment 1 — the new-client draft (day one)

Right after the Brand Profile session (spec 08), one button: **"Draft the
strategy."** The output is one screen, structured exactly like the objects it
will become:

| Draft section | Becomes | Cites |
|---|---|---|
| Positioning line (1–2 sentences) | The client's Overview | Profile: offers, audience, vibe |
| 3–5 pillars, each with a job + one-line purpose | `ContentPillar[]` with jobs (spec 04 objects) | Profile: goalMix, audiencePain, heroOffer; playbook patterns if any |
| Mix targets (% per pillar) | Pillar mix targets | goalMix + frequencyTarget |
| Posting frequency | `frequencyTarget` confirmed or challenged | productionReality (never drafts a plan the client can't sustain) |
| Platform plan | platforms[] priorities | audiencePrimary, productionReality |
| CTA plan per pillar | Convert pillar CTAs, bio link plan | buyingRoute, heroOffer, goals[] |
| First 6 content ideas | Cards in Idea stage (only if she accepts them) | audienceLanguage, pastWins, playbook combos |

**The citation rule (the heart of the spec):** every drafted item carries a
small "why" line in plain words. "Trust-heavy mix (45%) because the goal mix
leans recognition and the audience pain is trust-shaped." No orphan
suggestions. If the engine can't cite a reason, it doesn't draft the item —
it asks instead.

### Moment 2 — the refresh draft (monthly, existing clients)

The digest (spec 07) already concludes each month. The refresh draft is the
digest's last section turned actionable: **proposed plan changes**, each one
tied to its evidence:

- "Raise Value mix 30% → 40% — it beat baseline 4 of the last 5 posts."
- "Experiment 'street interviews' has 3 wins — graduate it to a pillar?"
- "Promo pillar has done its job 2 months straight — hold, don't grow."

She reviews with three buttons per item: **accept / edit / dismiss.**

## 3. What "accept" actually does (the C8 mechanics)

This is the part that makes the loop close instead of dead-ending in a
report. Accepting a proposal edits the real strategy objects, with history:

- Mix change → pillar mix targets update, **change-dated**. Analysis after
  the date judges against the new targets; old months keep their old stick.
  Regimes never mix (the spec 04 rule, now enforced at the write).
- Experiment graduation → new pillar created (job asked, one tap), the
  experiment's cards re-home to it, the experiments lane closes that line.
- Job change → allowed, change-dated, same regime rule.
- Frequency change → updates the target the momentum/consistency math uses.

Every accepted change lands in a small, visible **strategy changelog** per
client: date, what changed, the cited reason. That changelog IS the story
she shows the client ("here's what we changed and why") — and it is the raw
material for the taste layer (spec 10 reads her edits and dismissals).

## 4. Trust rules (inherited, non-negotiable)

- Numbers computed by code, AI only words and reasons (roadmap trust rule).
- Below data thresholds the refresh draft says "no changes proposed — not
  enough data yet." An empty draft is a valid draft.
- Client-facing: drafts and changelogs are owner-side. Anything the client
  sees passes her curation first (dashboard rule 1).
- The draft NEVER auto-applies. No accept, no change. Her hand on every
  strategy edit, forever.

## 5. Build shape

Medium. One draft engine (server route calling Claude with profile + computed
stats + playbook as input, structured output), one review screen (draft with
accept/edit/dismiss per item), the change-dated writes on strategy objects,
the changelog slice (rule-5 checklist applies: `emptyState`, `normalizeState`,
`filterStateForRole`, `mergeRoleWrite`). Depends on: spec 08 live (profile is
the input), specs 03–06 deployed and fed (evidence), spec 07 live for the
refresh moment. Moment 1 (new-client draft) can ship before spec 07 exists.

---

## Pending decisions (Manmeet)

1. Draft output shape: is the section list in Moment 1's table the right
   deliverable set, or should v1 draft pillars + mix only?
2. The first 6 content ideas: include in the day-one draft, or keep drafts
   strategy-only and let ideas come from the digest's one-tap cards?
3. The strategy changelog: client-visible (after her curation) or
   owner-only? (Recommendation: client-visible — it is the proof the service
   is steering, the exact thing she wants the dashboard to demonstrate.)
4. Refresh cadence: monthly with the digest, or only when she asks?
