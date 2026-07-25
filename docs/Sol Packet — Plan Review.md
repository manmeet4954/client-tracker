# Sol Packet — Master Plan Review

Prepared 2026-07-25 by the control room (Claude/Fable) for Manmeet to carry
to GPT Sol. Everything Sol needs is in this one file: the brief, then the
full locked plan below the divider.

---

## Brief for Sol

Sol — this is the locked master plan for Manmeet's dashboard: the system
that runs her personal-branding service (KRNL). You shaped its Content
Engine: your three-layer architecture (universal engine / client context /
content request) and the seed taxonomy became section 5.1. The plan is now
locked whole. Before detailed specs get written from it, Manmeet wants your
pressure-test of the complete plan.

**What to check (in priority order):**

1. **The flows.** Walk entries through the tree (section 3, and the proof
   walk in 3.9). Where would an entry get stuck, go blank, or need to be
   typed twice? Where do two folders both think they own something?
2. **The engine room (5.1).** Against your own architecture's intent: is
   anything missing, mistranslated, or weaker than what you designed? The
   costume variables, the seed template, the gates, the feedback routing.
3. **The Analysis Engine (5.2).** Her correction made it quantitative:
   track everything, bifurcate by any birth parameter, and compare (A/B on
   the same seed — format test, hook test), verdict on a 30-day / 2–3
   month cycle. Does the machinery hold? What would you add or cut?
4. **The switch cascade (3.4).** Strategy switches features per client and
   the switches propagate down the tree (Instagram-only kills LinkedIn's
   formats, strategy asks, analysis columns). Any combination that breaks?
5. **The client side (section 4).** Four give-points, switch-granted
   windows, the workshop rule. Anything a real client relationship needs
   that has no door?
6. **The dictionary (5.3).** Any definition you would sharpen or dispute.

**Ground rules:**

- The spine is locked and not up for redesign: the Context/Work-Log tree,
  the four laws, profiles, the two engines, the three apps. Propose WITHIN
  the structure, not against it.
- Format your findings as a numbered list. Each finding: the plan section
  it refers to, the issue in two or three sentences, and your proposed fix.
  Severity mark: [breaks it] / [weakens it] / [nice to have].
- Manmeet carries your findings back. The control room folds accepted ones
  into the plan as dated entries. Nothing changes the plan directly.

---

## The plan (verbatim copy, locked 2026-07-25)

# PLAN — The Dashboard Master Plan

**Status: LOCKED 2026-07-25, whole.** Built with Manmeet across one day —
four tree rounds, the engine maps, her corrections — and closed on her
words: "I can trust you with the whole plan." From here: no re-litigating.
Changes go through her and land as dated entries in section 9. Every
session — Fable, Opus, build agents, Sol — reads this file FIRST.

Started 2026-07-25 from her narration across three sessions. This file is the
one plan the whole dashboard is built towards. When it is locked, every
session — Fable, Opus, build agents, GPT Sol — reads this file FIRST, before
CLAUDE.md's feature detail, before any spec. Where a spec and this plan
disagree, the plan wins until the spec is rewritten.

Sections marked **CONFIRMED** carry her explicit yes and the date. Sections
marked **draft** are Claude's proposal awaiting her reaction.

---

## 1. What we are building, in plain words (draft)

One dashboard that runs Manmeet's personal-branding service end to end. It
has two sides:

- **Her side:** she picks a profile, enters it, and has every tool — the
  full folder tree, both engines, all curation controls.
- **The client side:** each client logs in and sees only their own profile,
  with a small set of moments where they GIVE something and a small set of
  windows where they SEE things. Nothing else.

Inside every profile live two **products-inside-the-product**:

- **The Content Engine** — a generic tool: seed in, formats and drafts out.
  Same mechanism for every client.
- **The Analysis Engine** — a generic tool: strategy and goals declared once,
  analysis happens against them automatically. Same mechanism for every
  client.

**The one sentence that governs everything:** the folders are the same for
every profile, the engines are the same for every profile — only Context
differs. Customization is fuel, not machinery.

**The engines are not the whole dashboard (her 2026-07-25 correction).**
The dashboard has its own job, independent of the engines: storing every
piece of content, keeping client information, scheduling, previewing,
holding scripts, recording and keeping data. That is the BODY — the system
of record — and its complete map is section 3 of this file, not somewhere
else. The engines are tools that work INSIDE the body: they produce content
and analyze content, but they never store it, never schedule it, never own
the client's information. The body would still function without the
engines; the engines cannot exist without the body.

Why the rebuild: the dashboard was built in phases, so its parts never
learned to talk to each other. The analytics tab and the chat cannot know
which variables connect because no single document ever said so. This plan is
that document.

---

## 2. The profile model (CONFIRMED 2026-07-25)

Everything is a profile. One profile per client. Her own workspaces —
ResumeGuru, KRNL — live inside the same dashboard as client profiles, with
the same folder structure and the same engines. She is client zero: how she
collects and connects her own profiles' Context is her call, but the
structure does not bend for her.

A client login opens its own profile only. Her login opens the profile
picker, then any profile with full tools.

**The interface follows the profile model (her 2026-07-25 mandate).** Today
the dashboard is one site where all client workspaces are visible to her at
once and she toggles between them — not app-friendly, and it does not match
the structure. The GUI gets restructured around profiles: her side becomes
pick a profile → enter it → the three apps of that profile, one world at a
time. **How the apps, folders, and sub-apps look on screen is delegated to
Claude to design** — her requirement is only that it feels like a proper
app, not a site with toggles. The GUI redesign is part of the build path,
not a cosmetic afterthought.

**The interface, screen by screen (Claude's design, her veto):**

1. **The shelf.** Her login lands on a grid of profile cards — clients and
   her own, each with its brand color and a one-line pulse ("2 in review ·
   4 scheduled"). Cards show status, never content: nothing from inside a
   profile leaks onto the shelf. The shelf also carries her one
   cross-profile window: the today strip (client tasks due across
   profiles — the surviving half of My Day). Add-profile lives here.
2. **Inside a profile.** One world at a time, lightly skinned in the
   brand's color. The three apps as the only navigation: Intake (shown
   until curated, then retired to a quiet "done"), Creation, Analysis —
   plus Strategy and Switches as owner-only controls in the corner.
   Whatever the switches turn off is not grayed out — it is NOT RENDERED.
   Leaving a profile = back to the shelf; no sideways toggling between
   profiles, ever.
3. **The Creation app.** Sub-apps as tabs: Engine · Board (the stages) ·
   Assets · References · Logs. The Engine opens as a room — a space that
   starts from "what are we talking about today?", with this profile's
   pillars and this profile's platforms (and only their formats) laid out
   to select from, ending in one action: into build state.
4. **Phone first.** She and her clients live on phones: bottom tab bar on
   mobile, sidebar on desktop, same three apps. The floating owner chat
   stays on every screen, both layouts.

A client's login skips the shelf entirely — they land inside their
profile, seeing only what their switches grant.

---

## 3. The tree — every profile's folder structure (draft)

The spine comes from spec 20 (Context / Work Log), extended with her
2026-07-25 additions (intake, review as a client moment, client perception),
and governed by the four laws below (her instruction, same day).

### 3.0 The four laws of the tree

This is the FINAL structure of the dashboard. It is built not to break.
Four laws guarantee that:

1. **The spine is frozen.** `context/` and `work-log/` and their main
   folders never change names, merge, or split. All growth happens INSIDE
   them, never by reshaping them.
2. **Every variable is a folder.** The questions we ask, the platforms, the
   pillars, the goals, the formats, the channels — each is a folder holding
   entries, never a loose field packed inside something bigger. A pillar is
   an entry in `pillars/`; a platform is an entry in `platforms/`; a
   question is an entry in `questions/`.
   **And it nests (her 2026-07-25 question, answered):** an entry that
   carries its own knowledge is itself a folder. Three levels, always:
   the VARIABLE folder (the shelf — `platforms/`), the ENTRY folder (the
   box — `platforms/instagram/`), and the entry's own PARAMETERS (the
   compartments — how Instagram works, its formats, its rules). The
   shelf's connections apply to every box on it, all the way down. So
   "each platform an entry" never means one flat line — Instagram is a
   folder holding everything we know about how Instagram works.
3. **Connections belong to the folder, not the entry.** Every folder
   declares ONCE what feeds it (writes) and what reads it. Anything added
   inside inherits those connections automatically. Add a fourth pillar
   today and it appears in the seed step's picker, the mix targets, and the
   analysis scorecard the moment it exists. Nothing added ever goes blank.
4. **Extension without breakage.** A new folder may be added at any time —
   but it must declare its feeds and readers at birth. A folder with no
   declared connections is rejected. (The same rule binds every future
   spec: no address, no build.)

Because of law 3, every folder below carries its two connection lines —
**fed by** and **read by**. This is the connect-point map that was never
written down before, and it is the actual deliverable of this section.

### The full tree

```
[Profile]/
│
├── context/                        ← know this before touching anything
│   ├── intake/                     ← the ROUTE only: how information travels
│   │   ├── questions/              ← generated from the detail folders' parameters
│   │   └── answers/                ← raw client answers, untouched
│   ├── personal-details/
│   │   ├── identity/               ← who they are, what they do
│   │   ├── journey/                ← the story, the why
│   │   ├── voice-of-the-person/    ← tone, pace, likes, dislikes
│   │   ├── ambitions/              ← goals, achievements, vision
│   │   ├── camera/                 ← face on camera: yes / sometimes / no
│   │   └── history/                ← past wins, past flops
│   ├── business-details/
│   │   ├── offers/                 ← each offer an entry; one marked hero
│   │   ├── buying-route/           ← how a sale actually happens
│   │   ├── market/                 ← industry, USP, competitors
│   │   ├── numbers/                ← team size, revenue
│   │   ├── pains/                  ← struggles, pain points
│   │   └── audience-raw/           ← audience as described, uncurated
│   └── content-strategy/           ← DERIVED; the brand book; locked first
│       ├── positioning/
│       ├── platforms/              ← each platform its own folder:
│       │                             how-it-works / formats / rules / connection
│       ├── pillars/                ← each pillar its own folder:
│       │                             job / mix target / description / seed examples
│       ├── voice/                  ← vibe words, never-words
│       ├── audience-decided/
│       ├── goals/                  ← KPIs, north star, goal mix
│       ├── funnel-shape/
│       ├── visual-branding/
│       ├── ctas/
│       ├── proof-library/          ← real results, quotes, BTS, case studies
│       ├── boundaries/             ← prohibited claims, never-promise, unwanted audience
│       ├── cadence/                ← frequency target, production reality
│       ├── working-mode/           ← collaboration mode, posting ownership
│       ├── toolset/                ← which work-log tools are ON for this profile
│       └── obligations/            ← client's jobs vs KRNL's jobs
│
└── work-log/                       ← the living, daily side
    ├── creation/                   ← the Content Engine's home
    │   ├── topics/                 ← the seed pool
    │   ├── making/                 ← drafts and versions
    │   ├── review/                 ← client approval + perception capture
    │   ├── scheduling/
    │   ├── channels/               ← each channel an entry, tied to a platform
    │   └── funnel/
    ├── assets/
    │   └── sets/                   ← each set an entry; videos via Drive tile
    ├── references/
    │   ├── from-client/
    │   └── our-vision/
    ├── logs/
    │   ├── tasks/
    │   ├── decisions/
    │   ├── requests/               ← the special-demands lane
    │   └── changes/                ← alterations to the standing agreement
    └── analysis/                   ← the Analysis Engine's home
        ├── study-own-data/
        ├── goal-tracking/
        ├── client-perception/
        └── market-research/
```

### 3.1 context/intake/ — the collection ROUTE (locked shape, 2026-07-25)

**Her clarification, now the rule: intake is HOW, never WHAT.** Intake is
only the way information travels from the client to us. WHAT we collect is
defined by personal-details and business-details — every parameter in those
two folders carries its own question (spec 08's pairing of field and
question). Intake gathers those questions, presents them to the client, and
brings the raw answers back. It owns nothing else.

- **questions/** — generated FROM the detail folders' parameters, never
  written independently. Add a parameter to personal-details tomorrow and
  its question appears in the next intake automatically (law 3). Her
  vocabulary session still owed for the finite word lists.
- **answers/** — raw answers, untouched, per client, per round.
- **Delivery mode, per client:** dashboard questionnaire or recorded meeting
  (the Finding Session); both routes fill the same fields.
- **Status:** not sent / sent / answered / curated. Creation does not start
  until Context is curated and content-strategy is locked.

**Fed by:** the detail folders (questions) · the client (answers —
give-point 1).
**Read by:** her curation pass, which writes personal-details and
business-details. The client never writes those folders directly.

### 3.2 context/personal-details/ (curated by her)

Subfolders: identity · journey · voice-of-the-person · ambitions · camera ·
history. (Spec 20 + spec 08 blocks D and F.)

**Fed by:** her curation of intake answers, only.
**Read by:** the content-strategy derivation · the card editor's side panel
(C9) · the digest's color.

### 3.3 context/business-details/ (curated by her)

Subfolders: offers (with the hero offer) · buying-route · market · numbers ·
pains · audience-raw. (Spec 20 + spec 08 blocks A and B.)

**Fed by:** her curation of intake answers, only.
**Read by:** the content-strategy derivation (funnel-shape, ctas, goals) ·
analysis/market-research.

### 3.4 context/content-strategy/ — the decision layer

Not collected. DERIVED by her from personal-details + business-details. This
is what a brand book deliverable really is. Locked before any content is
created. Each parameter is its own subfolder (law 2): positioning ·
platforms · pillars · voice · audience-decided · goals (KPIs, north star,
goal mix) · funnel-shape · visual-branding · ctas · cadence · working-mode
(collaboration mode: does this client bring ideas, or does she lead and
they only approve; posting ownership: we post or they post) · obligations.

The two deepest ones, spelled out per the nesting rule:

- **platforms/** — each platform is its own folder holding how that
  platform works: `how-it-works/` (the platform's logic and rhythms),
  `formats/` (the formats it offers — reel, carousel, static, story for
  Instagram; text post, document, article for LinkedIn), `rules/` (what
  works and what is banned there for this brand), `connection/` (API
  status, the spec 03 link). **A format never exists apart from its
  platform** — the seed step's format choice comes FROM the chosen
  platform's `formats/` folder. Add a platform tomorrow and its formats
  ride in with it; every reader (seed step, scheduling, channels,
  analysis) inherits it by law 3.
- **pillars/** — each pillar is its own folder: its job (Reach / Trust /
  Convert), its mix target, its description in plain words, its example
  seeds. Add a pillar and the seed picker, the mix math, and the
  scorecard know it instantly.

**The strategy is the switchboard (her 2026-07-25 addition, locked).**
Working mode and posting ownership are finalized INSIDE the strategy, and
the strategy's final output is the toolset decision: `toolset/` declares
which work-log tools are ACTIVE for this profile, derived from the
deliverables promised. A client we don't post for gets no scheduling
surface; a client who never brings ideas gets no seed input of their own.
The tree never changes shape for anyone — dormant folders stay in place,
switched off — so activation varies per client while the structure stays
identical (law 1 intact). Every work-log tool checks `toolset/` before it
shows itself.

**Every feature is a switch (her 2026-07-25 law).** The switchboard is not
a curated dozen — it is exhaustive and it grows by itself. Every feature
built anywhere in the software registers its own switch in `toolset/` at
birth, the same way every folder declares its connections at birth. A spec
that ships a feature without naming its switch is rejected (this binds
section 6, rule 3). Claude suggests each switch's default position; she is
the only one who finalizes.

**When the switches get set (her timing, locked):** per client, AFTER
intake — once she knows them and has derived the strategy, the deliverables
decide the positions. Order: intake → curation → strategy → switches set →
creation begins.

**The switch cascade (her 2026-07-25 addition):** switches are not only
about what the CLIENT sees — they design HER dashboard for that profile
too. A switch follows the tree: turning a folder off turns off everything
that exists only because of it, on both sides. Her example, now the
canonical trace: a client goes Instagram-only → the LinkedIn folder is off
for this profile → LinkedIn's formats (text post, document) never appear in
the seed picker, LinkedIn strategy is never asked for, no LinkedIn channel,
no LinkedIn column in analysis — for her OR the client. Flip it the other
way (LinkedIn-only) and Instagram vanishes the same way. This is law 3 run
in reverse: connections carry activation as well as data. Nothing dormant
ever asks to be filled in, thought about, or scrolled past.

**Fed by:** her derivation from the two detail folders · accepted analysis
conclusions (the loop's C8 — every change dated, the strategy changelog).
**Read by:** everything in work-log. The seed step reads pillars, platforms,
working-mode · making reads voice and visual-branding · scheduling reads
cadence · funnel reads funnel-shape and ctas · analysis reads goals and
pillars as its measuring stick · the client sees the curated summary.

### 3.5 work-log/creation/ — the Content Engine's home

The six-step flow, per post (her 2026-07-25 narration, merged with spec 20
§4), with each step's folder and connections:

1. **Seed** — a topic enters `topics/` (entry: her words, source, linked
   pillar + platform + format, status).
   *Fed by:* her · the client (only if working-mode allows) · the Analysis
   Engine's suggestions. *Reads:* content-strategy/pillars, platforms,
   working-mode · analysis/study-own-data.
2. **Create** — the draft is made in `making/` (versions kept).
   *Reads:* assets · references · voice · visual-branding.
3. **Review** — the client approves or asks for changes in `review/`. THE
   client interaction moment (give-point 3), batched per the monthly
   rhythm. Skipped only where working-mode grants her full authority.
   *Writes:* the verdict back onto the entry · the client's perception note
   into analysis/client-perception.
4. **Schedule** — approved entries get date + channel in `scheduling/`.
   *Reads:* cadence · goals targets.
5. **Distribute** — the post goes out. `channels/` (each channel an entry
   tied to a platform) holds how each is run; `funnel/` holds how posts
   chain toward the CTA. *Reads:* funnel-shape · ctas.
6. **Record** — automatic. The posted entry carries pillar, topic, format,
   month, channel from birth; the fetch pipe attaches real numbers. Never a
   reporting chore (the 2026-07-10 byproduct law, kept).
   *Read by:* analysis/study-own-data.

The engine's full component list — what happens inside seed → draft, the
format library, the taste memory — is **pending the Content Engine session**
(section 5).

### 3.6 work-log/assets/ and references/

- **assets/sets/** — material FROM the client: each set an entry, originals
  never recompressed, videos via the Drive tile (live today).
  *Fed by:* the client (give-point 2) · her · WhatsApp/chat photo routing.
  *Read by:* making · the catalogue-style export.
- **references/from-client/ and our-vision/** — what they share, and what we
  recorded wanting for them.
  *Fed by:* the client · her. *Read by:* making · the strategy derivation.

### 3.7 work-log/logs/

Subfolders: tasks (one-time and recurring client work) · decisions ·
requests (the special-demands lane, parked visibly) · changes (alterations
to the standing agreement).

**Fed by:** her · the chat/WhatsApp routing (`#client #task`) · client asks.
**Read by:** her day view's client half · the monthly call agenda · any
session reconstructing why something is the way it is.

### 3.8 work-log/analysis/ — the Analysis Engine's home

- **study-own-data/** — every published entry judged against
  content-strategy: which pillar is doing its job, which formats and hooks
  land, where the funnel leaks.
  *Fed by:* recorded posts + the fetch pipe (`ig_*`).
  *Reads:* pillars and goals as the measuring stick — never generic metrics.
  *Read by:* the digest · the seed step's suggestions.
- **goal-tracking/** — north star progress, monthly targets vs actual.
  *Reads:* content-strategy/goals; never asks anyone to re-state a goal.
- **client-perception/** — the client's own read on performance (give-point
  4), captured at review and at the monthly call (three perception
  questions + the attribution count).
  *Read by:* HER, directly. Per her 2026-07-25 correction, soft signals
  are recorded but do NOT feed the engine's verdicts — the engine
  concludes from numbers only.
- **market-research/** — the one genuinely new area; parameters pending the
  engine sessions.

The engine's conclusions flow BACK to `creation/topics/` (suggestions) and
to `content-strategy/` (proposed updates she accepts or rejects — dated).
That is the loop closing, and how her taste trains into the system (spec
10's territory).

### 3.9 The proof walk — one entry, end to end

How one entry knows where to go, what it impacts, and what toggles when it
lands. This trace is the test of the whole tree: if any step below requires
someone to re-type something already known, the tree is broken.

She types one seed into a profile: *"how to answer the salary question."*

1. It is born in `creation/topics/` — and because topics' connections are
   declared, the entry is born already wired: it must link one pillar (the
   picker reads `content-strategy/pillars/`), one platform (reads
   `platforms/`), and one format (reads THAT platform's `formats/`). Say:
   pillar Trust, platform Instagram, format carousel.
2. She moves it to making. `making/` pulls what it needs without asking:
   voice from `content-strategy/voice/`, look from `visual-branding/`,
   material from `assets/sets/`, direction from `references/our-vision/`.
3. The draft goes to `review/`. Because this profile's `working-mode/` says
   the client approves, the client sees it in their review window — the
   entry itself put it there. Their verdict lands on the entry; their "I
   think this kind of post works" note flows to
   `analysis/client-perception/` without a second entry.
4. Approved → `scheduling/` offers a date informed by `cadence/` and the
   month's `goals/` targets. The calendar and the client's upcoming-content
   window both update — same entry, two windows.
5. Posted → the record step fires by itself. The entry already carries
   pillar, topic, platform, format, month; the fetch pipe attaches real
   numbers to it over the following days. Nobody records anything.
6. `analysis/study-own-data/` judges it by its pillar's job — Trust, so
   saves and comments, not sales — against `goals/`. Its result joins the
   pattern verdicts.
7. The loop closes: if carousels on salary topics keep winning, the engine's
   suggestion appears back in `topics/` ("more of this"), and a proposed
   mix-target change appears against `content-strategy/` for her to accept
   or reject — dated either way.

Seven stations, one entry, zero repeated typing. And the same wiring answers
the growth case: add a new platform folder tomorrow (say YouTube, with its
`formats/` inside) and steps 1, 4, 5, and 6 pick it up without any of them
changing — that is law 3 doing its work.

### 3.10 The three apps — how a profile presents (her 2026-07-25 regrouping)

The tree above is the DATA. On screen, a profile presents as **three
apps**, and the toolset switches operate at this level:

1. **Intake** — the collection phase (3.1). On for every new client;
   retired from their view once Context is curated.
2. **Creation** — the working app. Its sub-apps: the **Content Engine**
   (the brainstorm space, see below), **assets** (where the client posts
   and keeps their material), **references** (where anyone can feed), and
   **logs** (runtime memory: pending things, client asks, decisions).
3. **Analysis** — the reading app.

**Strategy is not a switch.** It is the always-on decision layer that OWNS
the switchboard — her space, present in every profile, deciding what the
other three apps show.

**The Content Engine inside Creation (her requirement, on record):** the
engine is not a form that pushes you to the next step. It is a separate,
powerful space to brainstorm in — you sit with the topic, you see the
pillars fitted inside the platforms, the formats, and you SELECT; only then
does the entry go into build state. The seed can also be used just to get
content she then alters by hand — the engine serves, never rails. The full
inside of this space is the component session's job (section 5).

**Build state and outside tools (her working reality, on record):** the
creative work often happens OUTSIDE the dashboard — design software, video
editors, Canva (the Canva API link has worked before and is the precedent).
The making step must expect the round-trip: the entry leaves as a brief,
the piece comes back and attaches to the same entry, previews render from
it, feedback lands on it. The dashboard is the home; the tools are visits.

### 3.11 The record of posted work — stages, not a separate register
(her verdict 2026-07-25)

A separate Record room was proposed and REJECTED by her as unnecessary.
Her rule instead: **the stages are the truth.** What matters is which stage
a topic or content piece is in — idea, build, review, approved, scheduled,
posted. Once a piece is done, she links it (the live-post link on the
piece), and everything the register would have shown is already on the
piece itself: its pillar, platform, format, channel, month, its link, and
the numbers the fetch pipe attaches.

So seeing "everything posted, filtered by any parameter" is simply the
posted stage of Creation's existing views with the filters — not a new
place, not a new object. Analysis reads the posted pieces where they live.
No feature may introduce a second copy of a content piece to display it
somewhere else.

---

## 4. The client side — give-points and see-points (draft)

The client side is not a smaller dashboard; it is a defined set of moments.

**Where the client GIVES (exactly four):**
1. **Intake** — they answer the questionnaire / sit the recorded meeting.
2. **Assets** — they drop photos and videos as they have them.
3. **Review** — they approve or request changes on previews.
4. **Perception** — they say how they think it's performing (at review and
   at the monthly call).

**Where the client SEES:**
- their strategy summary (curated by her — never the raw working notes)
- upcoming content: previews and the calendar
- the readable version of analysis (verdicts in plain words, her-curated)
- their own obligations list (what we're waiting on from them)

**What the client NEVER sees:** the engines' internals, drafts before review,
her logs and notes, any other profile. (KRNL OS rule 1, kept: the client
never sees the workshop.)

---

## 5. The two engines (skeleton — filled by the sessions)

Both engines are tools, not features. A tool takes any client's fuel and
runs. Neither engine hard-codes a client, a niche, or a platform.

**Each engine gets its own separate family of specifications** — not one
spec each, but as many as its components demand. They are the deepest builds
in the system and the specs must go component by component. The boundary
binding every engine spec: the engine reads and writes the body's folders
(section 3); storing, scheduling, previewing, and client information keeping
are the body's job, never the engine's. An engine spec that invents its own
storage is rejected.

**Where the engines' extensive plans live: HERE, in this section (her
2026-07-25 question, answered).** This section is thin today for one reason
only — its information does not exist yet. The Content Engine's components
live in her head and come out in the component session; the flows get
pressure-tested by Sol; the Analysis Engine's conclusions model needs her
corrections. As each session happens, THIS section grows into the full
component map: every component, every parameter, every connection, written
here. Only after this section is complete for an engine does Opus turn it
into that engine's spec family — the specs hold build detail (screens, data
shapes, code order), never the concept. Nothing about the engines is
planned anywhere else.

### 5.1 The Content Engine — the component map (landed 2026-07-25)

Source: the engine architecture she built with GPT Sol (brief filed
2026-07-25) + the ResumeGuru Seed Taxonomy (`raw/ResumeGuru Seed Taxonomy
(Sol).md`) as the living proof of the first client package. Sol's flow
entry (section 6, step 2) is largely SATISFIED by this document; what
remains is her refinement pass on the open items at the bottom.

**The central rule of the engine (adopted verbatim as law):** never
generate content directly from a topic. Generate it from a properly
understood SEED inside a properly understood client context. A topic is
"career strategy." A seed is what THIS client believes about it, why, what
they've observed, what the audience should take away, how the product
relates, and what must never be claimed.

**The three layers** (Sol's architecture, mapped onto this plan):

1. **The universal engine** — the method, identical for every profile: how
   raw conversations are analyzed, how ideas become seeds, how pillars get
   assigned, how objectives/angles/hooks are chosen, how formats compress
   the expression, how voice is protected, how quality gates run, how
   feedback improves future output. This IS the product-inside-the-product;
   it never changes per client (section 1's law, confirmed from the other
   direction).
2. **The client context** — the fuel. Maps ONE-TO-ONE onto our `context/`:
   his context bundle's fifteen items are our folders. Nothing of Sol's
   architecture requires a second structure — his `clients/resumeguru/`
   folder IS our profile's context, plus the seed bank in creation.
3. **The content request (the costume)** — what she selects in the engine
   room each time: seed · pillar · objective · audience stage · angle ·
   hook type · format · platform · length · product intensity · CTA ·
   voice · proof. Same seed, different costume, different post. This is
   the engine room's selection surface (GUI section: "the engine is a
   room").

**The engine flow** (each step with its tree address):

```
Client discovery            → context/intake (the questions now cover
                              Sol's discovery: business, audience,
                              positioning, founder beliefs, raw voice)
Client context bundle       → context/ (curated + derived)
Raw founder conversations   → the talk-it-out sessions; recordings in
                              assets, transcripts feeding seed extraction
Seed extraction             → engine reads conversations, proposes seeds
Seed bank                   → creation/topics/ — each entry now carries
                              the FULL SEED TEMPLATE (below)
Select seed + costume       → the engine room (request layer)
Internal brief              → engine writes a small brief BEFORE copy:
                              the one point, the tension, the realization,
                              the takeaway, product's role, tone, ending,
                              what to leave out
Create                      → creation/making (with format rules applied)
Quality gates               → seven gates before "ready" (below)
Client feedback             → creation/review + the feedback memory
Update context + seed       → the loop back (routing below)
```

**The seed template** — every entry in `creation/topics/` carries: seed id
and name · the founder's RAW thought (kept verbatim, forever — this is
what protects the perspective from being polished into marketing speak) ·
core message in one sentence · visible problem · deeper problem · common
belief · the brand's reframe · audience value (what they learn without
buying) · product connection · concrete examples · nuance · prohibited
interpretation · proof required · possible pillars · possible angles ·
status (draft / discussed / validated / locked). **Only locked seeds can
enter build state.** The seed-vs-post test: if an idea can produce only
one post, it's a post idea; if it can produce reels, carousels, stories,
case studies, and newsletters, it's a seed.

**Pillars with jobs** — Sol's pillar template matches our
`content-strategy/pillars/` folders and extends their parameters: name ·
purpose · audience stage · what belongs / what does not · how the product
appears · typical proof · preferred formats · approximate mix percent.
Confirmed: pillar NAMES vary per client (ResumeGuru's four lanes vs
another client's education/founder/product/proof) — the JOB is what the
engine reads.

**The costume variables** — finite lists, stored in the universal engine,
Sol's drafts adopted as v1 (her edit pass pending):
- Objective: reach · engagement · trust · education · lead generation ·
  conversion · retention
- Audience stage: unaware · problem-aware · solution-aware ·
  product-aware · existing customer
- Angle: question · contrarian · mistake · founder observation ·
  framework · case study · personal story · before-and-after · tutorial ·
  product demo · myth · warning · prediction
- Hook type: direct claim · question · pain recognition · curiosity ·
  specific result · disagreement · confession · story opening
- Product intensity: none · light mention · natural connection ·
  product-led · direct promotion
- CTA: from the profile's `ctas/` folder
- Format: from the chosen platform's `formats/` folder (our law kept —
  formats live inside platforms)

**Format rules** — universal per format (carousel: one point per slide,
caption carries depth; reel: hook immediately, spoken language, one
argument, payoff; LinkedIn: strong claim, more reasoning; newsletter:
scene, full argument, framework), stored in the universal engine —
**with per-client overrides stored in that profile's platform `rules/`**
(e.g. ResumeGuru carousels run shorter, bite-size slides). Override beats
universal, always.

**The seven quality gates** — five brand gates, customizable per client
(ResumeGuru's five: coach, hook, value, stance, friend) + two operational
gates that never vary (accuracy: claims within what the product honestly
delivers; format: the piece behaves properly on its platform). Nothing
reaches review until all seven pass. Gate configs live in
`content-strategy/` per profile.

**The feedback memory** — feedback is classified, then ROUTED, never
piled: voice feedback updates the voice profile (`voice/`) · seed
feedback updates the seed itself (`topics/`) · format feedback updates
platform `rules/` · performance feedback updates future costume choices
(analysis → engine suggestions). This is spec 10's taste-learning given
its mechanism.

**Tree additions this map forced** (now in section 3's tree):
- `content-strategy/proof-library/` — real results, quotes, BTS, case
  studies; the costume's proof variable picks from here.
- `content-strategy/boundaries/` — prohibited claims, what the brand
  never promises, the UNWANTED audience (who we do not invite — it shapes
  how the brand speaks). Distinct from voice's never-words: boundaries
  are about claims, never-words about language.
- `audience-decided/` gains the stage lens (unaware → existing customer).
- `creation/topics/` entries upgraded from "seed = a line + links" to the
  full seed template above.

**The five refinement items — RESOLVED with her, 2026-07-25:**

1. **The lists ship FULL, and they multi-select.** No shortlisting now —
   the creative industry needs breadth, and what's needed varies per
   client. Sol's lists stand as shipped options; Claude may add; only she
   removes, and removal happens through use, not upfront. The costume
   pickers must allow selecting MULTIPLE values (e.g. two audience
   stages, several angles) and the costume includes pillar and
   goal/objective as first-class dimensions. Pillars stay plentiful.
2. **The capture door is "Create a seed."** She narrates — talks the
   topic out, pastes raw client material, shares what she has and what
   she wants to present. That raw draft goes in; the engine analyzes it
   and proposes the seeds it finds (one conversation can yield two, or
   three — each shows up separately). Every seed stores ALL the raw
   information it was born from, forever. Adding a seed later = give a
   new talked-out draft; the engine analyzes again.
3. **Gates are derived, not interviewed.** The five brand gates come out
   of what is decided in strategy — the voice and positioning folders —
   and some emerge only after working with the client for a while. So:
   the gate config lives in content-strategy, is drafted FROM strategy's
   own folders, and is expected to be refined as the relationship
   matures. No separate gate questionnaire.
4. **Autonomy: she triggers, the engine proposes, she picks.** Extraction
   runs when she gives a draft (her narration IS the trigger); the engine
   surfaces its proposed seeds; she picks, refines, and locks. Nothing
   extracts behind her back.
5. **The definitions layer is Claude's duty** — as detailed as it has to
   be, clear to everyone (what a seed is, what a pillar is, what each
   word means), written into this plan before deployment. Delivered as
   section 5.3 below.

**THE INTELLIGENCE BAR (her requirement, 2026-07-25 — a law, and the
reason the engine exists):** the engine is not a form plus templates. At
its core sits a real model, and the quality bar is explicit: when she
selects a seed and its doors, the recommendations and drafts that come
out must MATCH the quality she gets from talking directly to a frontier
LLM (Claude, Sol) with full context. "If that was not the case, why was I
even building it." The whole structure above — the context bundle, the
seed template, the gates — exists to GROUND the model so it hits that bar
on every request without her re-explaining anything. Consequences for the
spec family: the engine specs must cover the model layer itself — which
model, how the context bundle is assembled into each request, and how
output quality is checked — not just screens and storage. A cheap model
that saves money but misses the bar fails the spec.

### 5.2 The Analysis Engine — the component map (drafted 2026-07-25,
her review pending)

Home: `work-log/analysis/`. Drafted by Claude from specs 03–07's locked
decisions plus her words across sessions. Her corrections finalize it.

**The one question the engine answers, per profile:** *is the strategy
doing its job — and what should change?* Analytics exists to prove the
client's strategy is working, or honestly show it isn't. It never
measures against generic metrics; the measuring stick is always THIS
profile's `content-strategy/` — pillars judged by their jobs, the funnel
ending at this profile's north star, progress read against this
profile's goals. (Her standing position, kept: no number-chasing —
followers, views, and virality are not what the engine celebrates.)

**HER CORRECTION, 2026-07-25 (supersedes the first draft's emphasis):
the engine is QUANTITATIVE.** Reference point, hers: sandcastles.ai — a
tool where a linked account gets tracked, everything is recorded, and
the content's real performance on the platform is the material. The
qualitative measures come OUT of the engine's core: "if we keep the
qualitative measures in it, it won't work that way." And the impact /
brand-recall layer is named honestly as not achievable — the engine
never pretends to measure it.

**What the engine is (corrected):** a tracking machine plus a comparison
machine.

1. **Track and keep everything.** Account linked → the engine records,
   daily, forever: the professional-dashboard numbers (views, reach,
   interactions, follows, profile visits, directions) per post and per
   account, building the monthly account analysis on its own. History is
   never lost — every day not recorded is gone, so recording is the
   engine's first duty.
2. **Bifurcate by anything.** Every parameter a piece was born with is a
   filter: see how each pillar performs (the posts' data split by
   pillar), how each format performs, by platform, by month, by hook, by
   seed. She decides the filters one by one; the birth-links make every
   slice possible without anyone tagging anything.
3. **Compare — what the engine is actually built for.** A/B on the same
   seed: same topic as a video vs as a carousel (format test); same
   format with different hooks (hook test). A compare option puts any
   two pieces side by side. The costume system is what makes these tests
   controlled — change ONE variable, hold the rest — and this is the
   deepest reason the seed/costume structure exists.
4. **The verdict, on a cycle.** After 30 days, and again at two or three
   months: one verdict — which patterns and topics outperform the
   others, and whether working on them more is the right call. Not a
   dashboard of numbers; a call.

**The quantitative core's feeds:** the recorded pieces (full birth:
seed, costume, pillar, platform, format, channel, month — nothing
re-entered) + the fetched numbers (the daily pipe per connected
platform, the `ig_*` mechanism generalized).

**The soft signals (outside the engine's math):** DMs received,
inquiries, attribution answers, her observations, the client's remarks —
these get RECORDED somewhere light (counters and notes in
`analysis/client-perception/` and `logs/`), because they're worth
keeping, but they do not feed the engine's verdicts. The engine
concludes from numbers; she reads the soft signals herself.

**Supporting components (kept from the first draft, now serving the
quantitative core):**
- **The reading layer** — the card's own pillar/seed/costume is the
  primary tag source (planning IS tagging); AI tagging only as fallback
  for history without cards.
- **The scorecard** — each pillar judged ONLY on its job's metrics.
- **The funnel** — attention moving toward this profile's north star.
- **Goal tracking** — targets vs actual, straight from
  `content-strategy/goals/`.
- **Experiments** — now simply the compare feature used deliberately: a
  planned A/B is marked as one, so its pieces are judged as a test.
- **Market research** — still the one deliberately open area; defined
  with her when the first real need appears, per law 4.

**The conclusions (outputs) — the digest:**
- **Monthly digest per profile**, delivered right after the month ends
  (LOCKED 07-13): what outperformed, which pillar is earning by its job,
  which combinations are winning, what the funnel says, one concrete
  suggestion — short, plain words.
- **Weekly pulse, her eyes only:** a few lines across ALL profiles —
  anything moving, anything early, anything slipping.
- **Always-live view:** the Analysis app itself shows the running state
  anytime; no waiting for month-end.

**The four rules that make it trustworthy (all locked earlier, kept):**
1. **The trust rule** — every number is computed by code; AI only words
   and explains. It can never invent a metric.
2. **The honesty rule** — below the data threshold it says "not enough
   data yet" instead of guessing. Every suggestion cites its evidence.
3. **The curation rule** — her digest displays automatically; anything a
   CLIENT sees is drafted by the engine and approved or edited by her
   first. Nothing AI-worded goes client-facing without her.
4. **The one-truth rule** — analysis reads the pieces where they live
   (the stages); it never copies content into its own store.

**The loop back (what makes it an engine, not a report):** conclusions
are routed, never piled —
- winning combinations → costume recommendations inside the engine room
  ("this hook type is landing for this stage");
- "double down on X" → one-tap proposed entries in the seed bank, born
  in idea stage with the winning costume pre-linked, clearly marked
  engine-proposed, untouchable until she picks them up;
- structural findings → proposed updates against `content-strategy/`
  (mix targets, pillar jobs) that she accepts or rejects — every change
  dated in the strategy changelog. The engine proposes; SHE decides;
  nothing updates strategy behind her back;
- format findings → the platform's `rules/` via the feedback memory.

**The language law:** the engine speaks in the dictionary's terms — seed,
costume, pillar, job, gate, stage — so its feedback lands in the right
folders automatically and the Content Engine can read it without
translation.

**The intelligence bar applies here too:** verdicts must read like a
sharp strategist's conclusions — "your trust pillar is doing its job:
saves doubled on founder-observation carousels; your convert lane is
starving because nothing entered it this month" — not a metrics dump.
Same model-layer requirements as 5.1.

**Existing machinery:** specs 03–06 (built, undeployed) and 07 (specced)
already implement most of this for Instagram. At build time (section 8,
step 6) Opus re-cuts them to this map and the tree's addresses — absorbed,
not re-invented.

### 5.3 The dictionary — one meaning for every word

Every model, agent, and person building or using this system reads these
definitions and means the same thing. Where a client uses different
names, the MECHANISM keeps these names underneath; only the label on
screen changes. She corrects any definition that isn't hers; corrections
are dated.

**Profile** — one client's (or one of her own brands') entire world in
the dashboard: its context, its work log, its switches. Everything in the
system belongs to exactly one profile. There is nothing between profiles
except her shelf.

**The body** — the dashboard itself: the folders, the storing,
scheduling, previewing, and client-information keeping. The body works
without the engines; the engines cannot exist without the body.

**Engine** — a tool working inside the body. The Content Engine produces;
the Analysis Engine judges. An engine never stores, never schedules,
never owns data.

**Folder** — the home of one kind of thing, with connections declared
once (fed by / read by). Whatever is added inside inherits those
connections automatically.

**Entry** — one thing inside a folder. An entry that carries its own
knowledge is itself a folder (Instagram inside platforms).

**Topic** — a subject area: "career strategy," "yoga for beginners." A
topic is NOT content material. The engine never generates from a topic —
that is the central rule.

**Seed** — one fully understood idea belonging to one profile: the
founder's raw thought kept verbatim, what they believe about it and why,
what the audience wrongly assumes, the reframe, the nuance, what must
never be claimed, and how the product honestly relates. The test: a seed
can produce many pieces across formats and pillars. Counter-example:
"5 resume tips" is a post idea, not a seed — it produces one post.

**Seed bank** — `creation/topics/`: where seeds live permanently. A seed
moves draft → discussed → validated → locked. Only locked seeds may enter
build state.

**Pillar** (ResumeGuru calls them lanes) — a standing job the content
does for the brand, defined by its purpose, not its name. A pillar guides
a content decision; it never merely organizes topics into pretty
categories.

**Job** — what a pillar is FOR: reach, trust, convert, or the client's
own. Analysis judges each pillar only against its job — a promo pillar
is never shamed for low reach.

**Costume** — the full set of choices that dresses a seed for one
expression: pillar, objective, audience stage, angle, hook type, format,
platform, length, product intensity, CTA, voice, proof. Same seed, new
costume = new post, zero new understanding needed. Costume pickers
multi-select.

**Objective** — what this one piece should accomplish (reach, trust,
conversion, …). One piece, one objective; a post never does every job.

**Audience stage** — how much the viewer already knows: unaware →
problem-aware → solution-aware → product-aware → existing customer.

**Angle** — the entrance into the idea: question, contrarian, mistake,
case study, framework, story, …

**Hook** — how the piece earns attention in the first two seconds. A hook
is an expression choice; it is never a new seed.

**Format** — the container: reel, carousel, single post, newsletter, … A
format lives INSIDE its platform's folder; a format without a platform
does not exist in this system.

**Platform** — a place where content is published, held as its own folder:
how it works, its formats, its rules, its connection.

**Channel** — this profile's actual presence on a platform (the account
that posts).

**Gate** — a pass/fail check a piece must clear before it is ready: five
brand gates derived from the profile's strategy, plus two fixed
operational gates (accuracy, format). Seven passes or it does not ship.

**Boundary** — what this brand never claims, never promises, and who it
deliberately does not invite. Boundaries are about claims; voice's
never-words are about language.

**Proof** — real evidence from `proof-library/`: results, quotes,
behind-the-scenes, case material. Claims that need proof wait until proof
exists.

**Context bundle** — everything in a profile's `context/`, assembled and
handed to the engine's model with every request, so nothing is ever
re-explained.

**Grounding** — giving the model the context bundle at request time. No
training, no fine-tuning — retrieval of structured truth.

**Switch** — the on/off state of one feature for one profile, set inside
strategy after intake. Switches cascade down the tree's connections and
shape both her side and the client's.

**The shelf** — her home screen: every profile as a card, status only,
never content.

**Stage** (of a piece) — where a content piece currently stands: idea →
build → review → approved → scheduled → posted. The stages are the truth
of the system; there is no separate register.

---

## 6. Who builds what (draft)

1. **Fable (this file's keeper):** the master plan, the component sessions
   with her, the vault as source of truth.
2. **GPT Sol, entry one — flows:** after the Content Engine session, Sol gets
   a self-contained context bundle (the ResumeGuru bundle pattern) and
   pressure-tests the funnel flows: seed → pillar → format connections. His
   output comes back into this plan.
3. **Opus — specs:** once the plan is locked, Opus writes detailed specs one
   by one. **Every spec must declare which folders it reads from and writes
   to, and must name the switch each shipped feature registers in
   `toolset/`.** A spec with no address is rejected; a feature with no
   switch is rejected.
4. **Build agents:** build one spec at a time, per the existing rules
   (CLAUDE.md rules 1–6, DEPLOY.md gates, her explicit go every time).
5. **GPT Sol, entry two — review:** reviews the built code.

---

## 7. What leaves the dashboard (LOCKED 2026-07-25, her yes on the whole
list)

The test: does it serve a profile's loop? What doesn't feel necessary isn't
in the dashboard.

- **My Day's personal side** (personal tasks, day tracking) — leaves. It
  managed her week; it does not run the system. Client-task and content-task
  sync (spec 01's client half) stays, re-addressed into `work-log/logs/` and
  `creation/`.
- **Brain dump, container map, life tracker** — leave the dashboard; the
  vault already holds thinking.
- **Catalogue** — does not die: it becomes an assets use-case (sets +
  selection + PDF export) inside the profile that needs it.
- **Momentum / Money meter** — CONFIRMED: they survive only inside her own
  profiles (ResumeGuru, KRNL), as her private view; absent from client
  profiles entirely.
- Everything else live today gets an address in the tree (spec 20 §5's
  mapping) rather than a verdict.

---

## 8. The 0-to-100 path (draft skeleton)

1. ~~She reacts to this draft, folder by folder; the tree locks.~~
   **DONE 2026-07-25 — all four rounds locked (Context, Work Log, client
   side, what leaves), plus the laws, the switchboard, the cascade, the
   three apps, and the GUI mandate.**
2. ~~The Content Engine session~~ **DONE 2026-07-25** — Sol's
   architecture + the seed taxonomy landed as 5.1; the five refinement
   items resolved with her same day.
3. ~~Sol flow pass~~ **SATISFIED 2026-07-25** — the Sol document WAS the
   flow work; his second entry (code review) remains at step 7.
4. ~~Analysis Engine draft → her corrections~~ **DONE 2026-07-25** — her
   correction folded in: quantitative core, compare/A-B as the purpose,
   soft signals out of the math.
5. ~~Plan locked whole.~~ **LOCKED 2026-07-25.** From here, no
   re-litigating — build only.
6. Opus specs, in order: data-layer restructure (give every existing piece
   its address) → intake → Content Engine → Analysis Engine → client-side
   regroup.
7. Build → Sol review → deploy, one spec at a time, her go each time.
8. Migrate existing profiles' data into the addresses; backfill Context one
   client at a time (pilot first).
9. Client-side interface regrouped under the tree; profiles switched on.
10. Both engines live for every profile. 100.

Pending builds already made (analytics core, chat brain v4, parked WhatsApp
pipe) are re-judged against the locked tree at step 6 — absorbed where they
fit, not deployed on momentum.

---

## 9. Decisions on record

- 2026-07-25 — Her workspaces (ResumeGuru, KRNL) live inside the dashboard
  as client profiles; she is client zero. CONFIRMED.
- 2026-07-25 — Client-side intake surface needed (questionnaire or meeting);
  client perception input captured at approval. Her additions, in the tree.
- 2026-07-25 — Components before specs: each engine's full component map is
  documented in this plan BEFORE Opus writes its specs. Sol enters twice
  (flows before specs, review after build).
- 2026-07-25 — Keep/remove is decided by the ideal-dashboard test, not
  item-by-item votes (her instruction; section 7 is the result, awaiting
  her reaction).
- 2026-07-25 — The four laws of the tree (her instruction): the spine is
  frozen; every variable is a folder; connections belong to the folder and
  entries inherit them (nothing added ever goes blank); new folders may be
  added anytime but must declare their feeds and readers at birth.
- 2026-07-25 — Body vs engines (her correction): the dashboard's own job —
  storing content, keeping client information, scheduling, previewing,
  holding scripts, recording data — is the body, fully mapped in this file.
  The engines produce and analyze but never store, schedule, or own data.
  Each engine gets its own separate family of specifications.
- 2026-07-25 — ROUND 1 (Context) LOCKED, with two amendments from her:
  (a) intake is HOW, never WHAT — the questions belong to the parameters
  of personal-details and business-details; intake only carries them and
  brings answers back. (b) The strategy is the switchboard: working mode
  and posting ownership are finalized inside the strategy, and its
  `toolset/` output declares which work-log tools are active per profile;
  dormant folders stay in the tree, switched off.
- 2026-07-25 — Round 2 amendments from her: a profile presents as THREE
  APPS — Intake / Creation (sub-apps: Content Engine, assets, references,
  logs) / Analysis — with strategy as the always-on layer that owns the
  switchboard. The Content Engine must be a powerful separate brainstorm
  space, never a step-pusher. Making expects the outside-tools round-trip
  (design/video software, Canva precedent). The Record register (3.11)
  proposed as the Analysis app's front room — her yes pending. The master
  switch list is hers to finalize from Claude's table.
- 2026-07-25 — ROUND 2 (Work Log) LOCKED with her verdicts: the separate
  Record register REJECTED — stages are the truth, a done piece gets
  linked, posted-stage views with filters serve the need (3.11 rewritten).
  EVERY FEATURE IS A SWITCH — each feature registers its switch in
  `toolset/` at birth; specs must name their switches or be rejected.
  Switch positions are set per client AFTER intake, from the deliverables:
  intake → curation → strategy → switches → creation.
- 2026-07-25 — The switch cascade (her addition): switches design HER side
  too, and they propagate down the tree's connections — Instagram-only
  means LinkedIn's formats, strategy asks, channels, and analysis columns
  all disappear for that profile, both sides. Connections carry activation
  as well as data.
- 2026-07-25 — ROUND 3 (client side) LOCKED: the four give-points (intake
  answers, assets, review, perception) stand, each behind a switch; what
  the client sees is whatever their switches grant; the workshop rule is
  absolute — no switch can grant sight of the engine, drafts, her logs, or
  another profile.
- 2026-07-25 — ROUND 4 (what leaves) LOCKED, her yes on the whole list:
  My Day personal side, brain dump, container map, Life Tracker leave;
  catalogue becomes an assets capability behind a switch; Momentum and
  Money meter survive only in her own profiles as her private view.
  THE TREE IS LOCKED END TO END.
- 2026-07-25 — GUI mandate: the one-site-with-toggles interface is
  retired; the GUI is restructured around profiles (pick → enter → three
  apps, one world at a time). How it looks is delegated to Claude; her
  requirement is that it feels like a proper app.
- 2026-07-25 — THE CONTENT ENGINE MAP LANDED (section 5.1): built from
  the Sol architecture brief she shared + the ResumeGuru Seed Taxonomy
  (filed in raw/). Central rule adopted: never generate from a topic,
  only from an understood seed in an understood context. Three layers
  (universal engine / client context / costume request) map cleanly onto
  the tree; seed template, costume variables, format rules with
  per-client overrides, seven gates, and routed feedback memory all
  documented. Tree gained proof-library/ and boundaries/. Sol's flow
  entry largely satisfied; remaining session with her = the five open
  refinement items in 5.1.
- 2026-07-25 — The five refinement items RESOLVED (lists ship full with
  multi-select, she prunes through use; "Create a seed" is the capture
  door, she narrates and the engine proposes; gates derive from strategy
  and mature with the client; she triggers extraction; definitions are
  Claude's duty — delivered as 5.3). THE INTELLIGENCE BAR added as law:
  the engine's output must match frontier-LLM-with-full-context quality;
  engine specs must cover the model layer, not just screens.
- 2026-07-25 — Her GO to finalize the plan. The Analysis Engine drafted
  in full (5.2) from specs 03–07's locked decisions + her words: one
  question (is the strategy doing its job, what should change), four
  feeds, the components, the digest, the four trust rules, the routed
  loop back, the language law. Awaiting only her review — her
  corrections lock the plan whole.
- 2026-07-25 — HER ANALYSIS CORRECTION, and THE PLAN LOCKED WHOLE. The
  engine is QUANTITATIVE (sandcastles.ai as the reference): track and
  keep everything from the linked account, bifurcate by any birth
  parameter, and — the actual purpose — COMPARE: A/B on the same seed
  (format test, hook test) with one variable changed. Verdict on a
  cycle (30 days, 2–3 months): which patterns outperform, right call or
  not. Qualitative/soft signals (DMs, inquiries, perception) are
  recorded lightly but do NOT feed the engine's verdicts; the impact
  layer is named honestly as not achievable. Closed on her words: "I
  can trust you with the whole plan."
