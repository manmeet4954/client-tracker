# 08 — Brand Profile (onboarding becomes the loop's entrance)

Reserved in the backlog since 2026-07-13; written 2026-07-17. This is station 1
of the loop (see `13 — The Connected Loop.md`, connection C1): understanding a
client stops being prose in her head and becomes a structured sheet that every
other station reads.

**The rule this spec exists to enforce:** discovery answers land in FIELDS,
not paragraphs. A paragraph can only be read by Manmeet. A field can be read
by the strategy draft, the analytics scorecard, the card editor, and the
digest.

---

## 1. What it is

One **Brand Profile** per client: a structured parameter sheet, living where
the Onboarding tab is today. It has two faces:

- **The interview face** — the discovery questions, asked in plain language,
  in her voice, over a call or a form. This face is for the client.
- **The sheet face** — the same answers stored as typed fields with small,
  finite word lists. This face is for the system.

The existing `OnboardingItem[]` Q&A stays as a free-notes section at the
bottom (nothing is lost), but it stops being the main event.

---

## 2. The fields, and the onboarding questions that fill them

Manmeet asked directly: "what are the questions we need in the onboarding
process — the things we need to know to eventually start with the client."
This is that list. Each block: the fields, the questions that fill them, and
which station reads them (the WHY — if nothing reads a field, it gets cut).

### Block A — The offer (what they sell)

| Field | Type | Read by |
|---|---|---|
| `offers[]` | list: name, price band (low/mid/premium), type (product / service / course / template / booking) | Strategy draft (Convert pillar shape), funnel last mile |
| `heroOffer` | one of the offers | Funnel, CTA plan |
| `buyingRoute` | how a sale actually happens today: website / DM chat / WhatsApp / call / in person / marketplace | Flow goals (spec 04), funnel last step |

Questions:
1. What do you sell, and which one thing pays the bills?
2. Walk me through the last sale: where did that person come from and what
   did they do right before paying?
3. What should someone do the moment your content convinces them? (This one
   answer sets the whole CTA plan.)

### Block B — The audience (who we talk to)

| Field | Type | Read by |
|---|---|---|
| `audiencePrimary` | short structured line: who + life stage + where they hang out | Strategy draft, reading layer (hook fit) |
| `audiencePain` | the 1–3 problems they'd pay to solve | Strategy draft (Trust pillar topics) |
| `audienceLanguage` | words the audience uses (their words, not the brand's) | Card editor side panel (C9), voice |

Questions:
4. Describe your best customer ever. Not the ideal one — a real one.
5. What do they type into Google or Instagram search before finding you?
6. What do they say when they DM you? (Their words go straight into hooks.)

### Block C — Goals (what winning means)

| Field | Type | Read by |
|---|---|---|
| `goals[]` | multi-select, 1–3: Links / Conversations / Followers (the spec 04 list, extendable) | Funnel, scorecard |
| `northStar` | the Journey goal, one number + date | Funnel last step, digest |
| `goalMix` | rough split: sales vs recognition vs trust | Strategy draft (pillar mix) |

Questions:
7. Six months from now, what number would make you say this worked?
8. If you had to choose: more people knowing you, or more people buying —
   which one first?

### Block D — Personality and voice (how it should feel)

| Field | Type | Read by |
|---|---|---|
| `vibeWords[]` | pick 2–4 from a finite list (draft below, HER list pending) | Strategy draft, card editor panel, reading layer (voice drift check, later) |
| `neverWords[]` | words/tones the brand must never use | Same |
| `faceOnCamera` | yes / sometimes / no | Strategy draft (format plan), reading layer (face vs no-face tag already in spec 06) |
| `story` | free text: the founder story, kept short | Digest color, Trust pillar seeds |

Draft vibe list (Manmeet edits this in the vocabulary session — do not build
until she has): bold · warm · expert · playful · premium · honest ·
rebellious · calm · caring · direct.

Questions:
9. Show me three accounts you'd be proud to sound like — and one you'd hate
   to be compared to.
10. Will you show your face? How often, honestly?
11. What's the story only you can tell?

### Block E — Content rules (the operating constraints)

| Field | Type | Read by |
|---|---|---|
| `platforms[]` | where we publish (IG first-class; others listed) | Everything |
| `frequencyTarget` | posts per week the client can actually sustain | Momentum/consistency math, scorecard honesty windows |
| `productionReality` | who shoots, who edits, turnaround days | Strategy draft (format plan — no daily reels for a client with monthly shoots) |
| `assetsAvailable` | brand book yes/no, photo bank yes/no, existing content yes/no | Onboarding checklist, Assets tab seeding |

Questions:
12. How many posts a week can you sustain on your worst week, not your best?
13. Who takes the photos and videos? How fast can you get me raw material?
14. Do you have a brand book, logo files, old content that worked?

### Block F — History (the baseline)

| Field | Type | Read by |
|---|---|---|
| `igHandle` + connection status | from spec 03 Connections | The pipe |
| `pastWins` / `pastFlops` | short notes: what already worked / died | Strategy draft ("seen before" context), reading layer priors |
| `whereHeardCheck` | is a "where did you hear about us" capture possible? (the brand-recall signal) | Qualitative layer (backlog #3), digest |

Questions:
15. Which past post are you most proud of, and which one embarrassed you?
16. When a new customer shows up, do you ever ask how they found you? Could
    you start?

**Total: 16 questions, ~45 minutes of call time, filling ~20 fields.** Every
field names its reader. That is the test of the sheet: no orphan fields.

---

## 3. How it connects (the loop contract)

- **C1 (→ Strategy):** the strategy draft (spec 09, future) cites fields by
  name: "Trust-heavy mix because goalMix leans recognition and audiencePain
  is trust-shaped." Until 09 exists, Manmeet reads the sheet herself — still
  a win: the sheet is the handover document the second goal in CLAUDE.md
  asks for.
- **C9 (→ Make):** the card editor gets a small collapsible "who we're
  talking to" panel showing vibeWords, audienceLanguage, heroOffer CTA.
- **→ Analytics:** goals[] and northStar are ALREADY the spec 04/05 objects;
  the Brand Profile becomes where they're set during onboarding instead of
  later in Journey. One truth, set once.
- **→ Pillars:** pillar creation (with jobs) happens at the end of the
  profile session — the profile's last page is "the plan": pillars + jobs +
  mix. Understanding flows into strategy in the same sitting.

## 4. Data model sketch

New `brandProfile` object on `ClientData` (one per client), plus the standing
rule-5 checklist: add to `emptyState`, `normalizeState`, `filterStateForRole`,
`mergeRoleWrite`. Client roles can READ their own profile (it's their brand),
only owner writes. Existing `onboarding: OnboardingItem[]` untouched.

## 5. Build shape

Small-to-medium. One new view (profile sheet with sections above), one
migration of the Onboarding tab label, the card-editor side panel (C9) as a
separate follow-up. No cron, no API, no new storage pattern.

---

## Pending decisions (Manmeet)

1. **The vocabulary session** — the finite word lists are drafted above but
   they are Claude's placeholders. Her taste pins them: vibe words, the goal
   words, price bands, buying routes. One sitting.
2. Question list: 16 drafted — cut, reword, or add. They should sound like
   her on a call, not like a form.
3. Does the client ever SEE their profile sheet (read-only), or is it
   internal? (Recommendation: visible — it is the "here's what we heard"
   trust artifact, and rule 1 is satisfied since she writes every field.)
4. Do existing clients (Divine, Shiva, Merushri, ResumeGuru) get back-filled
   profiles in the same session the feature ships?
