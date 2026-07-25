# 20 — Client Data Structure (Context & Work Log)

**Status:** DRAFT — her brief captured 2026-07-21, awaiting her answers to the
open questions at the bottom. Nothing built.

**Requested:** 2026-07-21. Her framing: the dashboard cannot understand and
build things well because it does not feel connected to its own data. Features
were added in stages and never wired together. This spec is the structural
rewiring: a single, deliberate structure that tells the dashboard where every
kind of client data lives, when to reach for it, and how the pieces feed each
other — the same way the vault's CLAUDE.md / STATE.md files tell a session how
to behave.

This is her visualization, written down as close to her words as possible.
The structure is the deliverable; code comes only after she validates it.

---

## 1. The two divisions

Every client's world splits into exactly two folders:

1. **Context** — everything we must know BEFORE starting. Mostly one-time,
   but consulted constantly: every piece of work fetches from it.
2. **Work Log** — everything that happens once the client is live: all
   content, all deliverables, everything agreed on.

```
[Client]/
├── context/                      ← know this before touching anything
│   ├── personal-details/
│   ├── business-details/
│   └── content-strategy/         ← BUILT FROM the two above (the "brand book")
│
└── work-log/                     ← the living, daily side
    ├── creation/
    ├── assets/
    ├── references/
    ├── logs/
    └── analysis/
```

Each named item above is itself a folder, and the parameters inside it are its
sub-items. The point is not the folders themselves — it is that every
parameter has ONE home, so the system always knows where to read and where to
write.

---

## 2. Context — the foundational blocks

### 2.1 personal-details/
Who this person is, for the personal-branding side. The questions that find
their personality:
- who they are, what they do
- their journey, and why they are doing it
- how they talk — tone, voice, pace
- likes and dislikes
- goals, achievements
- vision

### 2.2 business-details/
The business numbers and context:
- industry
- product or service being sold
- USP
- team size
- revenue
- struggles and pain points
- audience
- competitors

### 2.3 content-strategy/ — the decision layer
Not collected — DERIVED. Personal details + business details (+ goals) combine
into the strategy. This is what a "brand book" deliverable really is. It must
be finalized before any content is created. Its parameters:
- positioning
- ideal channels
- brand voice (how they will talk, how they position themselves)
- content pillars
- audience (as decided for content, refined from the raw inputs)
- KPIs
- how the business flows
- visual branding
- CTAs
- what is needed from the client vs. what KRNL handles ("we lay it down to
  them: this is what we will help you with")

---

## 3. Work Log — the living side

### 3.1 creation/
The content pipeline itself. Sub-areas she named:
- **topics** — the seed pool (spec 19 mechanism: seed → pillar + platform +
  format → post)
- **previews / feedback** — client sees before posting; the existing preview
  tab is the anchor here
- **scheduling** — how content is scheduled and rolled out
- **funnel** — how the funnel is made
- **channels** — how the different channels are managed

### 3.2 assets/
Material FROM the client, stored in one place, actually used when creating
content.

### 3.3 references/
Two sources feed it: things the client shares, and our own recorded vision
for this client ("this is what we want to do for them").

### 3.4 logs/
Runtime record: one-time tasks, changes, non-recurring asks, decisions made
along the way — anything outside the standing agreement that must be
remembered.

### 3.5 analysis/
Three sub-jobs, each with its own definition:
- **market-research** — what kinds, what exactly we research (to be defined
  with her)
- **study-own-data** — which parameters of our own output we study
- **goal-tracking** — the goals and how they are tracked

---

## 4. The flow (how the folders talk to each other)

Her narrated pipeline, per post:

1. **Seed** — pick a topic from `creation/topics`; select pillar + platform +
   format; decide the post. (Spec 19's mechanism. Reads: `context/content-strategy`
   for pillars and channels; `work-log/analysis` for what is working.)
2. **Create** — make the thing. Needs `work-log/assets` (client data) and the
   design/editing work. Text-first platforms may ship the generated draft
   nearly as-is.
3. **Preview** — client feedback before posting; the preview tab / share pages.
4. **Distribute** — schedule and roll out. The scheduling options she has been
   asking for (spec 14B territory).
5. **Record** — every published piece gets recorded per channel, with filters:
   time, pillar, strategy, goals, channel. (Today: the content card's `posted`
   stage + the `ig_*` tables + spec 04's fields.)
6. **Analyze** — study own data: what works, what doesn't, which hooks land,
   goal progress, suggested improvements.
7. **Loop back** — the analysis TRAINS the seed step: next time she brings a
   topic, the output already reflects how content has been performing. Plus
   her taste, captured over time (spec 10).

This is spec 13's Connected Loop restated as an address system: the loop was
the wiring diagram; this spec is the floor plan the wires run through.

---

## 5. What already exists where (the mapping)

Nothing in her brief is a brand-new feature. Almost every folder already has a
partial owner — scattered:

| Her folder | What exists today |
|---|---|
| context/personal + business | spec 08 Brand Profile (16 questions → parameter sheet); onboarding tab |
| context/content-strategy | spec 08 outputs, spec 09 Strategy Draft, brand kit tab (visual), Journey goal card (KPIs) |
| work-log/creation/topics | spec 19 Content Engine, spec 04 Topics |
| work-log/creation/previews | preview/share pages (`/p/[shareId]`) |
| work-log/creation/scheduling | spec 14B (unbuilt) |
| work-log/assets | Assets tab (+ WhatsApp photo routing) |
| work-log/references | References tab |
| work-log/logs | agenda items, spec 01 client tasks, chat/WhatsApp `#client #task` routing |
| work-log/analysis/study-own-data | specs 03–06 analytics core (built, undeployed), `ig_*` tables |
| work-log/analysis/goal-tracking | Journey tab |
| work-log/analysis/market-research | nothing yet — new |
| the loop-back into seeds | spec 10 Playbook & Taste, spec 07 digest |

The work of this spec is therefore REORGANIZATION, not invention: give every
existing piece its address in the two-folder structure, and make every future
feature declare which folder it reads from and writes to.

---

## 6. Open questions (hers to answer — with Claude's recommendation on each)

1. **Where does this structure live?** (a) The dashboard's internal data
   layer — the AppState/DB reorganized so the AI and features navigate by
   this map; (b) the visible client workspace UI — tabs regrouped under
   Context / Work Log; (c) both. *Recommendation: both, data layer first —
   the UI regroup is cheap once the data knows its own structure.*
2. **How does Context get filled?** Does the onboarding tab become the Context
   intake (spec 08's questionnaire lives there), and do existing clients get a
   backfill session each? *Recommendation: yes to both; backfill one client
   first as the pilot.*
3. **Recording stays a byproduct?** The 2026-07-10 design law says no
   reporting duties. Confirm: recording = moving the card to `posted` plus
   automatic IG fetch, with the filters (time, pillar, goal, channel) as
   fields on the card — never a separate recording chore. *Recommendation:
   yes, keep the law.*
4. **Does this apply to her own workspaces too?** ResumeGuru, LinkedIn, KRNL
   are workspaces in the same dashboard. *Recommendation: yes — same
   structure, she is client zero.* **ANSWERED 2026-07-25: yes, confirmed.
   Her workspaces are client profiles inside the dashboard; how she fills
   her own Context is her call. Recorded in `dashboard/PLAN.md` §2.**
5. **market-research/** is the one genuinely new area — its parameters need
   her definition session before it can be specced.

---

## 7. Explicitly not decided yet

- Any UI change, any migration, any build order. This spec exists so the
  structure is agreed BEFORE those conversations.
- How this interacts with spec 19's door choice (the Content Engine's
  location) — but note: whichever door, its files land in
  `work-log/creation/topics` conceptually.
