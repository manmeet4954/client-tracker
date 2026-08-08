# Phase 5 — INTAKE

Restructure handoff, "Level 3 → INTAKE". Prototype: `docs/design-handoff/design/RoomsV3.dc.html`.

## What I built

Four files, all new, all mine:

| File | What it is |
|---|---|
| `lib/intake/screens.ts` | All the logic. Pure, no React, no DOM. |
| `components/intake/IntakeApp.tsx` | The segmented shell over the two screens. |
| `components/intake/Rounds.tsx` | The Rounds screen. |
| `components/intake/Curation.tsx` | The Curation screen. |
| `tests/intake.screens.test.ts` | 24 tests over `screens.ts`. |

Nothing existing was edited. `components/IntakeView.tsx` and `components/CurationView.tsx` are
untouched and still work; they are what `app/profile/[id]/intake/page.tsx` mounts today.

This is a redress and regroup of the spec 22 machinery, not new intake. Every write still goes
through `lib/intake/rounds.ts` and `lib/intake/curate.ts`.

### Rounds

The card is the design's card: 9px dot (`#1a7f4b` when everything is back, `#ea4711` otherwise),
name 16px/600, state pill 11.5px/600 on `#e6f5ec` or `rgba(234,71,17,.10)`, questions listed
beneath at 14px with their state on the right in 12.5px `#9b95a1`.

Actions along the bottom: **Send a new round** (dark) and **Copy the client link** (ghost), plus a
third — see the deviations below.

### Curation

One parameter at a time. Two columns inside one card: **What they said, kept** on `#f4f1ee`
(14px/1.6 `#6b6570`), **What it means, curated** on `rgba(234,71,17,.07)` with its label in
`#b8551f`. Footer line names the Strategy parameters it feeds, e.g.
`Feeds Strategy, Voice and Boundaries.`

**A raw answer has no edit control anywhere.** The left column renders text and a meta line and
nothing else — no button, no input, no handler. Source picking (which answers a curated value came
from) lives on the RIGHT, as chips, precisely so the left column never carries a control that could
read as editing.

**Every curated value carries its provenance** (spec 21 §7.4, S11), on screen and not in a tooltip:
`Curated by owner on 28 Jul. From 1 answer. They said it plainly. It replaced 1 earlier reading,
kept below.` The superseded readings are in a fold under the card, with their curator and date.

## The wiring the integrator must do

One change, in one file I am not allowed to touch:

**`app/profile/[id]/intake/page.tsx`** — replace the body with:

```tsx
'use client';

import { useApp } from '@/contexts/AppContext';
import IntakeApp from '@/components/intake/IntakeApp';
import { ClientIntakeWindow } from '@/components/shell/ClientWindows';
import { shellRole } from '@/lib/shell/profile';

export default function IntakePage({ params }: { params: { id: string } }) {
  const { state, role } = useApp();
  if (shellRole(state, role, params.id) !== 'owner') {
    return <ClientIntakeWindow profileId={params.id} />;
  }
  return <IntakeApp clientId={params.id} />;
}
```

Prop contract:

- `IntakeApp({ clientId: string })` — that is the whole surface. It reads the body itself from
  `useClient(clientId).data.body`, renders `ProfileBodyGate` when there is no body, owns the
  segmented control and renders its own `Screen` / `ScreenHeader`. Do not wrap it in another
  `Screen`.
- `Rounds({ clientId, body })` and `Curation({ clientId, body, ownerProfile? })` are exported
  default from their own files if you ever want them separately. They assume a body exists and
  assume the owner role; `IntakeApp` is what guarantees both.

### Nothing else needs wiring, but two things need deciding elsewhere

1. **Intake disappearing from navigation.** "Intake is present as an app only while questions are
   outstanding. Once curated it disappears and lives inside Strategy as history." That belongs to
   `lib/shell/nav.ts`, which is shared. Today `APPS[0]` renders on
   `intake.questionnaire` / `intake.finding_session` alone, so a fully curated profile still shows
   Intake. The predicate already exists and is tested: `intakeRetired(readRounds(body))` in
   `lib/intake/status.ts`. Whoever owns nav should AND it into the Intake node's state, and the
   Strategy corner's `intake-history` panel (already in `CORNER_PANELS`) is where it reopens from.
2. **Curation as a segment.** `IntakeApp` already drops the Curation segment when there is nothing
   to curate, so a fresh profile is one screen and the segmented control does not draw at all
   (`Segmented` returns null below two segments). That is local to my component and needs nothing
   from you.

## What I tested

`tests/intake.screens.test.ts`, 24 tests, **all passing**. **It is not registered in
`tests/run.ts`** — that file is shared and I could not edit it. Add
`import './intake.screens.test.ts';` alongside the others. Until then it runs on its own:

```
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \
  "import('./tests/intake.screens.test.ts').then(async m => \
   process.exit(await (await import('./tests/harness.ts')).run()))"
```

What the tests actually hold down:

- **Every count is derived from its array.** The tests prove it the only way that catches a
  hardcoded number: they change the array and read the sentence again. Two questions gives
  "2 questions still open from round 1", three gives "3", one gives "1 question" singular, with
  nothing in the copy touched.
- A round written but not sent has `openCount` 0, not "12 still open". Nothing is open with anyone
  when it never went to anyone.
- A refusal to answer ("they would not say") closes a question rather than leaving it waiting. Real
  knowledge, not a gap.
- Every `AnswerLine` comes back with `editable: false` as a literal.
- Provenance: curator, date, how many answers behind it, confidence in words, and how many earlier
  readings it replaced. A value with only `owner-direct:` sources says "From your own note, not from
  an answer."
- Curating twice keeps both readings; the newest reads, the older is in `superseded`.
- The queue puts the work first and the written ones last; a parameter nobody has spoken to is
  absent on a client profile and present on one of hers.
- `client-ideas` never enters the queue (§7.5: it becomes a seed in the Engine).

`./node_modules/.bin/tsc --noEmit` is **clean** across the whole project.
`npx next build` reaches "Compiled successfully" and "Linting and checking validity of types"
without complaint; it then fails at `Collecting page data for /api/upload` with
`supabaseUrl is required`, which is the worktree having no `.env.local` and has nothing to do with
these files.

## Deviations from the design, deliberate, flagged

1. **A third action on Rounds: "Open one for a recorded meeting."** The design lists two actions.
   But spec 22 has two delivery modes — `dashboard-questionnaire` and `finding-session` — and
   dropping the second would have quietly removed a capability the machinery supports. It is a ghost
   button in the same row as "Copy the client link". Say the word and I will take it out.
2. **A question row opens.** Closed it is exactly the row the design draws. Opened, an answered
   question shows the words as they arrived (read only, always) and a waiting one gives her an input
   to file what they said. Without it there is no way to record answers from a recorded meeting at
   all, which is what `IntakeView` was doing before. No new chrome in the default state.
3. **"Send a new round" really sends.** It opens the round and attempts the send in one move. Note
   that in practice it will almost always be refused right now: every parameter in
   `lib/intake/parameters.ts` still ships `vocabulary: 'draft'`, and §4 rule 1 blocks any round
   carrying draft wording. The round is still written, and the screen says plainly how many
   questions are waiting on her vocabulary pass. **She has no screen anywhere that lets her do that
   vocabulary pass.** See "things that look wrong" below.
4. **A parameter picker on Curation.** "One parameter at a time" needs a way to reach the others and
   the design does not draw one. I used a `<select>` plus the progress line ("3 of 12 written"), and
   a "Next one waiting" button under the card. Minimal chrome, works at 392.
5. **The subtitle sits under the header row, not beside the title.** `ScreenHeader` (phase 1, shared)
   puts title and segmented control in one flex row with no slot for a sub-line under the title. The
   prototype has them stacked on the left. Visually near-identical; if it matters, `ScreenHeader`
   needs a `subtitle` prop and that file is not mine.

## What I did NOT do

- **No browser verification.** I could not run the app: it needs Supabase credentials I do not have
  and must not use, and without them every route lands on the passcode gate. Layout is built from
  the prototype's exact numbers and checked by reading, not by looking. Someone should open it at
  1240 and 392 before this is called done. The two Curation columns are `flex-1 min-w-[210px]` inside
  a wrapping flex, so they should stack below roughly 480px; that is the thing most worth eyeballing.
- **I did not touch navigation.** Item 1 under "needs deciding elsewhere" is still open.
- **I did not delete `IntakeView.tsx` or `CurationView.tsx`.** They are still mounted by the page
  until you swap it. Once swapped they are dead code and should go in a later pass, along with
  `mapRoundZero` ("Read the old answers"), which I did not carry over — see below.
- **I did not carry over the "Read the old answers" button** (`mapRoundZero`, spec 22's round-zero
  mapping) or the `sort_queue` list from `CurationView`. Both are migration furniture rather than
  the daily screen, and putting them on a screen whose whole job is "one parameter at a time" would
  have been a second thing on it. If they are still needed they belong in the Strategy corner under
  Intake history. Flagging it because it is a real capability that is not on my screen.
- The "Write it" button is `disabled` while there is no value or no source. That is a form awaiting
  input, not a switched-off feature, so I read it as outside rule 3. If you disagree it should
  render only when ready.

## Things in the existing code that look wrong

1. **There is no vocabulary pass screen.** `blockedFromSending` refuses any round while a parameter
   carries `vocabulary: 'draft'`, and every one of the ~47 parameters in `lib/intake/parameters.ts`
   ships `vocabulary: 'draft'`. So today no round can ever be sent to a client, from any screen, and
   there is nowhere in the app to flip a parameter to `hers`. Spec 22 §16 assumes that pass happens.
   This is a hard stop on client intake and it is not something my screen can fix, because the flag
   lives in a code registry, not in state. Worth its own spec.
2. **`readRounds` drops the entry's `state`.** `lib/intake/rounds.ts` maps `e.data` and discards
   whether the entry is `active` or `history`, so nothing downstream can tell a live round from an
   archived one without re-reading the path. `refreshRounds` and `markCurated` re-read the path to
   get it. My cards therefore show archived rounds identically to the live one, which is right for
   the design (the design shows Round 1 and Round 2 together) but is luck, not intent.
3. **`composeRounds` reads `openCount` as 0 for a not-sent round on purpose**, which means the
   headline for a written-but-unsent round says "Round 1 is written and not sent yet" rather than
   quoting an open count. If someone later wants "12 waiting on her", that is a different count and
   should be a different field, not a reinterpretation of this one.
