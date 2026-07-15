# Spec 04 — Analytics Data Model: Pillar Jobs, Topics, Experiments

Status: design locked (2026-07-13). Pillar jobs: YES from Manmeet. Experiments lane: YES. Topics: agreed.
Build size: medium. Record-layer changes that feed all analytics.
Depends on: nothing to build; Specs 05–07 depend on it.

---

## Pillar jobs

- Every pillar gets a **job**: `reach` | `trust` | `convert`. One tap at pillar creation, plus an optional one-line "what this pillar is for" (doubles as the client-facing explainer on the scorecard).
- The job decides which metrics the pillar is judged on:
  - **Reach** → reach, shares (rate per view)
  - **Trust** → saves (rate per view), profile visits
  - **Convert** → bio link taps, the client's north-star number (from Journey)
- Vocabulary is fixed and small for cross-brand comparability (the product story); assignment is per pillar per brand; pillar names stay fully custom.
- Existing pillars get jobs assigned once, retroactively (small owner prompt).
- Job changes are allowed but change-dated, so analysis never mixes regimes.
- Pillars stay alive: add later (new pillar starts at "too early to judge"; others unaffected — all verdicts are vs account baseline), rename free (IDs), retire = inactive with history kept.

## Topics (the seed layer)

- New lightweight entity: `Topic { id, name, createdAt }` per client. `ContentCard` gains optional `topicId`.
- **Repurpose action** on any card: births a sibling card sharing the topic — own format, own pillar, own dates. Her natural repurposing workflow IS the data entry.
- **Never mandatory.** No topic dropdown on every card. Links happen only via Repurpose or a deliberate "group these" action. Untagged cards simply don't join topic analysis (topic-TYPE tags from the reading layer still catch them for pattern analysis).
- Analysis rule: expressions of one topic are compared side by side, never averaged into one number.

## Experiments

- `ContentCard` gains `experiment?: { hypothesis: string }` — a flag plus one line of "what we're testing".
- Experiment posts are excluded from their pillar's verdict math (keeps pillar data clean) but shown in their own analytics section: hypothesis, result, verdict.
- A winning experiment "graduates": flag removed, future posts of its kind flow into a pillar.

## Client goals (REVISED per Manmeet 2026-07-13 — multi-select, not one archetype)

Her correction: clients are service businesses and their goal is "one of three, two of three, or three of three" — not a single archetype. So:

- Per client: `goals` = any 1–3 of:
  - **Links** — get people tapping the bio link: website, Calendly, Topmate, any booking/redirect link. Measured by link taps.
  - **Conversations** — get people DMing / booking via DM. NOT API-countable; leans on the Journey north-star check-in, shown honestly.
  - **Followers** — audience growth. Measured by follower curve + reach.
- Convert pillars are judged on the union of the selected goals' metrics.
- Declared by Manmeet, changeable anytime (change-dated like jobs). Vocabulary extendable later if a real fourth goal emerges — she flagged uncertainty, so the field is a list, not a locked enum.
- Also configures: digest recommendation vocabulary (Spec 07) and expected CTA types (Spec 06's alignment check — e.g. content that never asks for the declared goal gets flagged).

## Data changes

`types/index.ts`: `ContentPillar.job`, `ContentPillar.purpose`, `ContentPillar.jobChangedAt`, `Topic`, `ClientData.topics`, `ContentCard.topicId`, `ContentCard.experiment`. All slices registered in `emptyState`, `normalizeState`, `filterStateForRole`, `mergeRoleWrite` (CLAUDE.md rule 5). UI: pillar create/edit modal, Repurpose button on cards, experiment toggle in the card editor.

## Pending decisions (Manmeet)

None — ALL LOCKED 2026-07-13: pillar jobs, topics via repurpose, experiments lane, and goals as multi-select (Links / Conversations / Followers).

## Design law check

Every new field is a byproduct of work she already does: job = 1 tap once per pillar; topic = the repurpose she was doing anyway; experiment = 1 toggle when she's deliberately testing. Nothing is a reporting duty.
