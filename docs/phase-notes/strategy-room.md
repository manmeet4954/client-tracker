# Strategy: the room, and Decide

Spec 34 §2 and §3. Branch `claude/spec-21-data-layer-6d04af`, worktree
`wf_0b903122-f1b-1`.

## What was built

| File | What it is |
|---|---|
| `dashboard/lib/strategy/inputs.ts` | New. Which input each of the fourteen takes, its options, what it refuses, and the reason line written from a pick. No React. |
| `dashboard/tests/strategy.inputs.test.ts` | New. 18 tests, all passing. |
| `dashboard/components/strategy/Room.tsx` | New. The full screen shell: sections down the left, work in the middle, a sideways strip on a phone. |
| `dashboard/components/strategy/Decide.tsx` | New. The fourteen rows, each with its real input. |
| `dashboard/components/strategy/inputs/ui.tsx` | New. Chips, picks, boxes. |
| `dashboard/components/strategy/inputs/Platforms.tsx` | New. Pick a platform, tick its formats. |
| `dashboard/components/strategy/inputs/Pillars.tsx` | New. The set builder, with the shares adding up. |
| `dashboard/components/strategy/inputs/Goals.tsx` | New. Goal, number, period, and how it is measured. |
| `dashboard/components/strategy/inputs/Simple.tsx` | New. Cadence, working mode, voice, CTAs, boundaries, obligations, proof, prose, audience. |
| `dashboard/app/profile/[id]/strategy/[panel]/page.tsx` | Rewritten to render the room instead of the old panel-as-a-page. |

Nothing else was touched. `lib/strategy/derivation.ts`, `lib/tree/*`,
`types/index.ts`, `contexts/AppContext.tsx`, `tests/run.ts` and
`components/shell/StrategyPanel.tsx` are all unchanged.

## What she gets

- Strategy is a screen, not a 470px drawer. Sections down the left at 1240, a
  strip across the top at 392 that scrolls sideways and never wraps.
- Leaving returns where she was: the corner carries `?back=<path>` and the back
  link uses it. Only a path inside the app is followed.
- Every row says **decided** or **not yet**, and shows the decision when there
  is one. "0 of 7 sources ready" is gone from every row.
- What they said is inside the row, under "what they said". When nothing they
  said feeds a parameter, the row says so in one line and the decision is filed
  as owner declared, which is what the old checkbox was for.
- The required reason line survives only on positioning, audience, funnel shape
  and working mode.
- No path, no switch id, no source count anywhere on the screen.

## The record did not change

Every decision still goes through `writeStrategy` with the same fields. The one
thing to know:

**The lock refuses a decision with a blank reason** (`lockViolations` condition
2, and I may not edit that file). So on a pick, `reasonFor` writes the reason
from the pick itself: "Picked Instagram for reel, carousel." The test
`a pick writes its own reason line` walks all fourteen and proves none comes out
blank, and `a strategy decided through the new inputs passes the lock the same
way` builds a whole strategy through the new inputs and asserts `lockViolations`
returns nothing with `fix: 'derivation'`.

Values are now structured where the answer is structured (platforms is an array
of `{platform, formats}`, pillars an array of `{name, job, share}`, and so on).
That is already how the data model works: `StrategyValue.value` is `unknown`,
and `tests/gates.test.ts` already stores voice as an array. `decodeValue` reads
an old typed string back into the new shape, so nothing decided before this
screen is lost or unreadable.

## What the integrator must wire

1. **`tests/run.ts`** — add `import './strategy.inputs.test.ts';` beside the
   other spec files. I do not own that file.

2. **`components/shell/Frame.tsx`** — this is what actually moves Strategy off
   the overlay. Today the corner control still opens `StrategyOverlay` over the
   current screen; the room is only reachable by URL. Two changes:

   - the corner control's href becomes
     `/profile/${profileId}/strategy/${tab}?back=${encodeURIComponent(pathname + search)}`
     instead of `withStrategy(tab)`.
   - stop rendering `<StrategyOverlay …>` (the `cornerOpen` block at the bottom).

   Nothing else in Frame needs to move. `inCorner` already keeps the control
   hidden while inside Strategy.

3. **The other sections.** `Room` renders my `Decide` for `derivation` and calls
   `StrategyBody` from `components/shell/StrategyPanel.tsx` for the other seven,
   so Lock, Switches, Gates, Channels, Brand kit, Intake history and Lifecycle
   all still render, unchanged, inside the room. When the agents building §4 and
   §5 land their components, swap them inside `StrategyBody` and the room picks
   them up with no change to my files. As of this note, the Lock section inside
   the room is still the old one with the fourteen identical sentences.

4. **Platforms does not yet feed the switchboard.** `SwitchboardView` and
   `StrategyLockView` read `data.platforms ?? ['Instagram']`, a legacy slice.
   The platforms she picks in Decide are stored at
   `context/content-strategy/platforms` and nothing copies them across. Until
   something does, picking LinkedIn in Decide does not create a LinkedIn switch
   or a LinkedIn channel requirement. The write belongs to whoever owns the
   legacy slice dispatches. The read is one line:

   ```ts
   (decodeValue('platforms', readStrategy(body, 'context/content-strategy/platforms')?.value)
     as PlatformPick[]).map(p => p.platform)
   ```

5. **Goals and S16.** Each goal carries a plain `measured` string. The Lock
   screen can hand `lockViolations` its `goalsWithMetricDeclaration` from it:

   ```ts
   const goals = decodeValue('goals', readStrategy(body, 'context/content-strategy/goals')?.value) as GoalItem[];
   const goalsWithMetricDeclaration = goals.filter(g => g.measured.trim()).map(g => g.goal);
   ```

   Spec 26's richer `MeasurementDeclaration` object is a separate surface and I
   did not build it. `goalsWithoutMeasure` and `MEASUREMENT_LINE` are exported
   for whoever writes the Lock screen's missing list.

## Checked

- `./node_modules/.bin/tsc --noEmit` clean.
- `node ... tests/strategy.inputs.test.ts` — 18 of 18 pass.
- Looked at it in a browser on a dev server at 1240 and at 392: the room, the
  section list both ways, Platforms picking Instagram and ticking Reel and
  saving (the row went to "Instagram" with a tick and the header to "1 of 14
  decided"), Pillars adding a row and the share total reading "0 of 100" in
  accent, Goals adding "get more leads" with its period and measure list, Voice
  chips on the phone, the Lock section rendering inside the room, and the back
  link returning to the profile. No console errors.

## What I could not finish, or chose not to do

- **The overlay is still live** until change 2 above lands. Both surfaces work;
  they just show different things now.
- **No autosave.** An input is saved when she presses Decide it. Closing a row
  with an unsaved edit keeps the draft in memory but a page navigation loses it.
- **Visual branding writes a marker.** "That is the branding" files the value
  `'Set in Brand kit'` so the lock can count it; the row then shows what is in
  the kit, counted from the kit's own arrays at render time, never a stored
  count. The button is disabled while the kit is empty.
- **Legacy decoding is best effort.** A typed pillars string becomes named
  pillars with no job and no share, and the screen says both are missing rather
  than inventing them.
- **Local dev has no Supabase env here**, so saves do not survive a reload on my
  machine. Everything above was verified inside a session; the write path itself
  is `writeStrategy` plus the existing `SET_BODY` dispatch, unchanged.
- **`?back=` only survives inside Strategy.** Deep links from outside with no
  `back` fall back to `/profile/<id>`, which redirects to her first app.
