# 13 — The Connected Loop

Written 2026-07-17 from Manmeet's direct ask: "no matter how much complexity it
would need, I want that data to talk to each other. If I am giving a strategy,
we are measuring ourselves against that strategy, and the analysis shows we are
doing it."

This spec is the master map. It resolves backlog item #5 ("the one thing — the
connected system"). It does not replace specs 03–07, 08, or 14; it explains how
they connect and what is still missing between them. When any future build
touches two stations of the loop, this file is the contract for how they talk.

---

## 1. The loop, named

Manmeet's service runs as a loop, per client:

```
UNDERSTAND  →  STRATEGY  →  MAKE  →  PUBLISH  →  FETCH  →  MEASURE  →  ANALYZE  →  DECIDE
    ↑                                                                                │
    └────────────────────────── the decision updates the strategy ───────────────────┘
```

In plain words:

1. **Understand** — learn the client: what they sell, who they talk to, what
   winning means for them. (Home: Brand Profile, spec 08. Today: a loose Q&A
   list on the Onboarding tab that nothing reads.)
2. **Strategy** — turn understanding into a plan: pillars with jobs, mix
   targets, posting frequency, goals, north star. (Home: pillars + Journey.
   Today: pillars exist; jobs/goals are built in spec 04, undeployed.)
3. **Make** — plan and produce the content. (Home: the Content tab. LIVE and
   mature. Every card already carries pillar, format, stage, dates.)
4. **Publish** — the post goes to Instagram. (Today: by hand, outside the
   system. Spec 14 automates the seam in both directions.)
5. **Fetch** — real numbers flow in daily without anyone typing. (Home:
   `ig-sync` cron into the `ig_*` tables. LIVE since 07-11, currently stalled
   since 07-12 — being diagnosed.)
6. **Measure** — fetched numbers attach to the planned cards. The link join:
   card ↔ real post. (Built in spec 03, undeployed.)
7. **Analyze** — verdicts against the strategy: which pillar is doing its job,
   what the winning posts share, where the funnel leaks. (Built in specs
   04–06, undeployed. Digest specced in 07, unbuilt.)
8. **Decide** — analysis becomes the next strategy call: double down, drop,
   experiment. The loop closes. (Specs 09–10, not yet written. First seed
   already specced: the pattern recommendations in spec 06.)

**The core promise, in one line:** the strategy we set in station 2 is the
measuring stick in stations 6–8. The system never measures against generic
metrics; it measures against THIS client's declared plan.

---

## 2. The connection points — what carries each arrow, and why it matters

This is the part Manmeet asked to see written down. Each arrow in the loop is
carried by one specific piece of data. If that piece is missing, the arrow is
dead and the stations drift apart.

| # | Connection | Carried by | Why it matters | Status today |
|---|---|---|---|---|
| C1 | Understand → Strategy | Brand Profile fields (offers, audience, goals, vibe) feed pillar/job/mix choices | Without it, every strategy is re-derived from memory ("that eats my brain") and nothing proves the strategy fits the client | MISSING — spec 08 written today, needs her vocabulary session |
| C2 | Strategy → Make | Each content card carries a `pillarId`; pillars carry a `job`; the client carries `goals` and mix targets | Planning IS tagging. Because she picks a pillar when making the card, no one ever tags posts later | Pillar on card: LIVE. Jobs + goals: built (spec 04), undeployed |
| C3 | Make → Publish | Card stages (Ready → Scheduled → Posted) + `postUrl` pasted on the card | The card is the one truth for what went out and when | LIVE but manual both ways — spec 14 automates it |
| C4 | Publish → Fetch | The `ig-sync` daily cron snapshots every post's numbers into `ig_*` | Instagram only tells you totals as of today. Every day not snapshotted is history lost forever | LIVE (stalled since 07-12, under repair) |
| C5 | Fetch → Measure | **The link join**: card's `postUrl` shortcode ↔ fetched post permalink (`ig_post_links`) | This is the single most important connection in the system. It welds the plan (card: pillar, idea, format) to reality (numbers). No double entry, ever | BUILT (spec 03), undeployed |
| C6 | Measure → Analyze | Scorecard/funnel/comparison read joined data; each pillar judged ONLY on its job's metrics; funnel ends at the client's own Journey north star | This is "measuring ourselves with the strategy" made literal. A promo pillar is never shamed for low reach; a reach pillar is never praised for zero sales | BUILT (specs 04–05), undeployed |
| C7 | Analyze → Decide | Pattern verdicts (topic-type × format × pillar), experiment results, digest conclusions | Turns analysis from a report into an instruction: what to make next | Patterns BUILT (spec 06, undeployed); digest specced (07); strategy draft not specced (09) |
| C8 | Decide → Strategy | Accepted recommendations update the plan: mix targets shift, experiments graduate to pillars, pillar jobs get re-dated | The loop actually closes. Without C8, "analysis" is a dead-end tab | NOT BUILT — first honest version is manual: digest proposes, she edits the plan by hand |
| C9 | Understand ↔ Make (side channel) | Brand Profile voice/vibe fields available inside the card editor | The person making content sees who they're speaking for without leaving the card | MISSING — cheap once spec 08 lands |

**Design law for every connection (already in force, restated):** every data
point must be a byproduct of work she already does. A connection that needs a
new logging ritual is a broken design.

**The one-truth rule (from the 2026-07-13 session, now a loop-wide rule):**
one set of objects, every screen a window onto them. The card the intern moves,
the number the cron fetched, the verdict the client reads — same objects,
filtered by role. No copies, no exports, no second source of truth.

---

## 3. Why it currently FEELS disconnected — the honest audit

The feeling is correct, and it has three specific causes:

1. **The middle of the loop is built but dark.** Specs 03–06 (link join,
   jobs/topics/experiments, scorecard/funnel/comparison, AI reading) are four
   finished commits on branch `claude/dashboard-status-review-fb52e4`. Until
   they deploy, the dashboard shows recording and one rejected table — so the
   loop is invisible on screen even though most of it exists in code.
2. **The loop has no entrance.** Onboarding today is a flat Q&A list that no
   other feature reads. Understanding a client produces prose, not parameters,
   so strategy can't cite it and analysis can't measure against it. Spec 08
   fixes this.
3. **The loop has no exit.** Nothing yet turns analysis into next month's
   plan. Spec 07 (digest) is the bridge; specs 09–10 are the full version.

### Spec scoreboard (as of 2026-07-17)

| Spec | What | State |
|---|---|---|
| 01 Task-client sync | My Day ↔ client boards | **LIVE** (07-14) |
| 02 Filters + month-aware pillars | Content tab filters | **LIVE** (07-15) |
| 03 Link join + connections | C5, the weld | Built, undeployed |
| 04 Jobs, topics, experiments | C2/C6 data model | Built, undeployed |
| 05 Scorecard, funnel, comparison | C6 screens | Built, undeployed |
| 06 AI reading + patterns | C7 first half | Built, undeployed |
| 07 Digest | C7/C8 bridge | Specced, unbuilt |
| 08 Brand Profile | C1, the entrance | Specced today (13's sibling) |
| 09 Strategy Draft | C8 full version | Specced (07-17) — builds after 08 |
| 10 Playbook + Taste | Cross-client learning | Specced (07-17) — builds after 09 |
| 11 Momentum meter | Effort layer | **LIVE** (07-17) |
| 12 Shared lists | Collaboration | **LIVE** (07-17) |
| 14 Content automation | C3 both directions | Specced today |
| 15 Data quality & trust | The loop's honesty layer | Discussion agenda (07-17) — pending her session |

Score: 4 live, 4 built-and-waiting, 6 specced-not-built, 0 unwritten. Every
station of the loop now has its spec; what remains is deploying, building,
and her decisions.

---

## 4. What closes the loop — the order (proposal, her call)

The cheapest path from "feels disconnected" to "I can watch the loop run":

1. **Deploy the analytics core (specs 03–06).** Zero new code. One setup day:
   3 SQL files, ANTHROPIC_API_KEY in Vercel, tester invites + tokens
   (checklist already at the bottom of spec 00). This lights up C5, C6, and
   half of C7 — the loop becomes visible on screen for ResumeGuru first.
2. **Fix the fetch stall (C4).** Already in motion; nothing downstream works
   while the pipe is dry.
3. **Spec 14 use case A** (auto-mark posted). Small build, closes C3 in the
   inbound direction, removes the last manual step between making and
   measuring.
4. **Spec 08 vocabulary session + build.** One working session with Manmeet to
   pin the finite word lists, then a small build. Opens C1 and C9.
5. **Spec 07 (digest).** Already specced, gives C8 its honest manual version:
   the system concludes, she decides.
6. **Spec 14 use case B** (schedule from the dashboard) and **spec 09**
   (strategy draft) after the above are live and trusted.

Steps 1–3 need no new decisions from her beyond the deploy "go" (analytics v1
page stays out unless she says otherwise — standing note in STATE.md).

---

## 5. Testing the loop — how she checks "this is working, this is not"

Once step 1 deploys, the loop is testable end to end on ResumeGuru with a
20-minute walk-through, one station at a time:

- C2: open a card → its pillar chip is there; pillar has a job in the modal.
- C3: paste a live URL on a posted card.
- C4: next morning, `ig_*` has yesterday's snapshot (Momentum card shows it).
- C5: the card shows its matched post (Connections screen shows the link).
- C6: Analytics tab scorecard shows the pillar judged on its job, marked
  "too early to judge" where data is thin (that honesty showing up IS the
  test passing).
- C7: after the nightly tagger runs, tags appear on posts; patterns section
  fills as history accumulates.

A visual companion map (HTML artifact) is published alongside this spec so she
can see the whole loop with live/built/missing status per connection.

---

## Pending decisions (Manmeet)

1. **The deploy "go" for the analytics core** (specs 03–06) plus the setup
   day. This is the single biggest unlock and it is one decision.
2. Confirm the closing order in section 4, or reorder it.
3. Spec 08's vocabulary session: when. (The questions are drafted in spec 08;
   the word lists need her taste.)
4. Whether analytics v1 (the rejected global page) is deleted from vault main
   or kept as reference. It keeps forcing overlay deploys; her call, no rush.
