# The UI structure

Her structure, from PLAN.md §2 and §3.10, written out as a flow map. This is
**structure only** — no layout, no colour, no components. A designer reads this
to know what sits inside what, and what leads where.

Nothing here is new. It is what she specified on 2026-07-25, expanded to cover
every screen that exists today so nothing is left homeless.

---

## The one rule everything follows

> **One world at a time.**
> You are either on the desk, or inside exactly one profile. Never both, never
> two profiles at once, never a profile with another profile visible beside it.

Everything below is a consequence of that rule.

---

## Three levels, and only three

```
LEVEL 1   THE DESK          where she starts and returns
   │
   ▼
LEVEL 2   ONE PROFILE       three apps + one corner
   │
   ▼
LEVEL 3   ONE APP           its own screens
```

There is no level 4. If something wants to be a fourth level, it is a panel
inside a level-3 screen, not a new place.

---

## LEVEL 1 — The desk

The only screen that knows about more than one profile.

**Holds:**

| Block | What it is |
|---|---|
| Profile cards | One per profile. Status only — counts and one attention line. Never content, never a post title |
| Today | Everything due today, across every profile. The surviving half of My Day |
| This week | Her weekly read, per profile, a few lines each |
| Add profile | One action |

**Does not hold:** any content, any search across profiles, any board, any
calendar, any analytics, any settings.

**Exits:** tap a card → enter that profile. Tap a Today row → enter that
profile, at that thing.

**Entries:** login lands here. Leaving any profile returns here. It is the only
way in and the only way out.

---

## LEVEL 2 — Inside one profile

Entering a profile replaces the whole screen. The desk is gone until she leaves.

**Navigation is exactly three apps:**

```
INTAKE  ─────►  CREATION  ─────►  ANALYSIS
(know them)     (make things)     (read what happened)
                      ▲                  │
                      └──────────────────┘
                        what worked feeds
                        what gets made next
```

**Plus one corner, not an app:** Strategy. It holds the decisions the three apps
obey — the brand book, the gates, the switches, the channels, the lock. Opened
deliberately, closed again. Owner only, always.

**The rules of this level:**

1. Three apps is the whole navigation. Nothing else competes with them.
2. An app that has nothing to show **is not there** — not greyed, not empty. A
   profile with no analysis has two apps.
3. Intake shows while there are questions outstanding, then goes quiet and lives
   inside Strategy as history. It can be reopened.
4. Leaving = back to the desk. There is no sideways move to another profile.
5. Strategy is reachable from anywhere inside the profile, and from nowhere else.

---

## LEVEL 3 — Inside each app

### INTAKE — knowing who they are

```
Questions to send  →  their answers come back  →  she curates  →  Strategy
```

| Screen | Job |
|---|---|
| Rounds | Which questions have been sent, what came back, what is still open |
| Curation | Their raw words on one side, her curated value on the other. One parameter at a time |

Raw answers are permanent and never editable. Curation is the only way a raw
answer becomes something the system uses.

---

### CREATION — the daily home

This is where she is most of the time. Five screens.

```
ENGINE ──► BOARD ──► (make it, often outside the app) ──► REVIEW ──► SCHEDULE ──► POSTED
   │          ▲                                                                     │
   │          └── ASSETS · REFERENCES feed the making ──┘                            │
   └──────────────── ANALYSIS's verdicts come back here ◄────────────────────────────┘
```

| Screen | Job |
|---|---|
| **Engine** | Where a thought becomes a seed, and a seed gets dressed into pieces. Opens on "what are we talking about today?" |
| **Board** | Every piece by stage: idea → build → review → approved → scheduled → posted. Also the month calendar |
| **Assets** | Photos, videos, sets. What the client drops, what gets used |
| **References** | What they shared, and what we want for them |
| **Logs** | Tasks, decisions, requests, pipelines, notes. The profile's memory of everything that is not content |

**Board is the default landing** inside Creation. She opens the app to see her
work, not to be asked a question.

Review and scheduling are **states of a piece on the Board**, not separate
screens. A piece in review shows its review; a scheduled piece shows its date.

---

### ANALYSIS — reading what happened

```
coverage first  →  then the numbers  →  then the verdict  →  back into Engine
```

| Screen | Job |
|---|---|
| Now | This month so far. Coverage is always the first thing on screen |
| Slices | Any birth parameter as a filter: pillar, format, hook, platform, seed |
| Scorecard | Each pillar judged on its own job |
| Funnel | Where attention goes. Business outcomes kept separate |
| Compare | Two or more pieces side by side. The point of the engine |
| Goals | Targets vs actual |
| Verdicts | The 30-day and quarterly call, in words |
| Health | Is collection working, and since when |

Eight is too many for a phone. Structurally they are **three groups**, and a
redesign may collapse them:

- **Where we are** — Now, Goals, Health
- **What happened** — Slices, Scorecard, Funnel
- **What it means** — Compare, Verdicts

---

### STRATEGY — the corner

Four steps in order, then a lock.

```
Decide (14 parameters)  →  Gates (5+2)  →  Switches  →  LOCK
```

After the lock it becomes a reference: open it to read a decision, change one
(which dates a new version), or reopen intake.

Also lives here: channels and connections, the brand kit, intake history, the
profile's lifecycle.

**The lock is the gate between the two halves of the product.** Before it,
Creation cannot be written to. After it, everything opens.

---

## The four flows that matter

**1 · The daily loop** — must be the shortest path in the product

```
Desk → profile → Board → open a piece → mark it moved → done
```

**2 · Making something new**

```
Desk → profile → Engine → talk it out → pick a seed → dress it → into build
     → Board → make it (often in Canva) → back on the piece → review → schedule
```

**3 · A new client**

```
Desk → add profile → Intake (send questions) → answers arrive → Curation
     → Strategy: decide → gates → switches → LOCK → Creation opens
```

**4 · Reading results**

```
Desk → profile → Analysis → coverage → slices/compare → verdict
     → "make more of this" → lands as a proposal in Engine
```

---

## Navigation laws

1. **The desk is the only hub.** Every journey starts and ends there.
2. **No sideways travel.** Inside a profile, no link leads to another profile.
3. **Off means absent.** A switched-off thing is not rendered anywhere — no
   disabled buttons, no empty tabs, no "not available for this client".
4. **Three levels, hard.** Desk → profile → app. Anything deeper is a panel.
5. **One thing, one home.** A post lives on the Board. Review shows the same
   post; Analysis reads the same post. Never a second copy.
6. **Phone is the real target.** The structure must survive a bottom bar with
   three items and no room for more.

---

## Where every screen alive today lands

Nothing is deleted quietly. This is the whole current app, re-homed.

| Today | Goes to |
|---|---|
| Client list (`/clients`) | **The desk** |
| Dashboard tab | Absorbed: counters onto the desk card, agenda into Creation → Logs |
| Content (board / pillars / table) | **Creation → Board** (three views of one screen) |
| Previews | **Creation → Board**, as the review state of a piece |
| Journey | Split: goal → Analysis → Goals · pillar bars → Analysis → Scorecard |
| Analytics | **Analysis** (its eight tabs) |
| Lists | **Creation → Logs → Pipelines** |
| Assets, Catalogue | **Creation → Assets** (catalogue is an assets mode) |
| References | **Creation → References** |
| Brand | **Strategy → Brand kit** |
| Cold Calls, Orders, Answers | **Creation → Logs → Pipelines** (per-profile, switched on only where used) |
| Onboarding | **Intake** |
| Intake, Curation | **Intake** |
| Strategy, Engine | **Strategy corner** and **Creation → Engine** |
| My Day | Client half → **desk → Today**. Personal half → leaves |
| Observations | **Creation → Logs → Notes** (per profile) |
| Connections | **Strategy → Channels** |
| Brain dump, Container map | Leave the product |
| Floating chat | Stays on every screen, both layouts. Its own redesign, later |
| Public preview `/p/…` | Unchanged. The only screen an outsider sees |

**Count:** 13–15 tabs per profile becomes **3 apps + 1 corner**, and 5 screens
inside the app she uses daily.

---

## The client's version

Same structure, fewer doors. A client never sees the desk.

```
login → straight into their profile
```

They get only what their switches grant, drawn from the same three apps:

| App | What they get |
|---|---|
| Intake | Their questions, their answers back |
| Creation | Upcoming content, the review queue, their assets |
| Analysis | The summary she approved, nothing live |
| Strategy | Never. Not one panel |

A client with two profiles gets a small picker of **their own** profiles, and
nothing else.

---

## What a redesign still has to decide

Structure does not answer these. A designer should:

1. Decide whether Analysis stays eight screens or becomes three.
2. Decide how the Engine and the Board relate on a phone — two screens, or one
   screen with a mode.
3. Decide what the profile shows in the first second after entering. (The
   structure says Board; the argument for a small "what needs you" moment is
   open.)
4. Decide how Strategy is reached without it becoming a fourth navigation item.
5. Decide what the desk looks like with 8 profiles, and with 20.
