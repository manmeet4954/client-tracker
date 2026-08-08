# Phase 4 — ANALYSIS

Eight screens collapsed to three groups, coverage first, dressed in the design
tokens. Written against the handoff README's "ANALYSIS" section and
`design/RoomsV3.dc.html`.

---

## What I built

| File | What it is |
|---|---|
| `lib/analysis/groups.ts` | **New.** All the pure logic. The three groups, the coverage bar, every bar width, every metric card, every plural, every count. No React, no fetch, no clock. |
| `tests/analysis.groups.test.ts` | **New.** 42 tests over that file. Plain Node, no dependencies. |
| `components/analysis/AnalysisApp.tsx` | Rewritten. The app: it decides which groups render, draws the title and the three-segment control, and mounts one group. |
| `components/analysis/AnalysisGroup.tsx` | The recovered `.wip`, finished. One group: coverage once at the top, then its screens stacked, each reading its own payload. |
| `components/analysis/Shared.tsx` | Rewritten. The furniture, in the design tokens: `CoverageFirst`, `CoverageDiffers`, `ScreenTitle`, `MetricCard`, `Meter`, `Pill`, `Card`, `Kicker`, `Figure`, `Band`, buttons. |
| `components/analysis/Tabs.tsx` | Rewritten. The eight screens, redressed. Same payloads, same eight switches, nothing added to the data model. |

Nothing outside `components/analysis/`, `lib/analysis/groups.ts`,
`tests/analysis.groups.test.ts` and this note was touched. No file under `app/`,
no shared wiring file, no state slice, no tree address.

### The three groups

```
Where we are    Now · Goals · Health
What happened   Slices · Scorecard · Funnel
What it means   Compare · Verdicts
```

The eight are not gone. Each is still its own switch (`ANALYSIS_TABS` in
`lib/shell/nav.ts` is unchanged), its own read, its own `/api/analysis` payload.
What changed is what the navigation addresses.

### The honesty rules, and where each one lives

Every one of these is in `lib/analysis/groups.ts` with a test beside it, so a
screen cannot re-implement it differently:

- **An uncollected metric is an em dash.** `metricCard()` returns an em dash for
  `no-coverage`, `too-early` and `not-measurable`, and the note says which and
  since when. A genuine `0` still prints `0` — a real floor is a reading.
- **A gap is drawn as a gap.** `meterBar()` gives an unread row `pct: 100,
  hatched: true`. It fills the whole track with the diagonal hatch rather than
  drawing a zero-length bar, because a zero-length bar is the picture of a slump
  and this is a hole in collection. The prototype's own slice code draws
  `width: 0` with a hatch background (so nothing is visible); I followed the
  README rule instead, which says the hatch is drawn.
- **Coverage is the first thing on screen, once.** `CoverageFirst` is the group's
  first block. The old per-tab `CoverageBanner` is deleted — eight copies of a
  rule is eight chances to forget it, and two screens were drawing it twice.
  A screen whose own coverage differs from the group's says so with
  `CoverageDiffers` ("This one reads 20 of 31 days, not 23.") rather than
  drawing a second bar.
- **Below the thresholds, no ranking.** `compareVerdict()` turns
  `not-enough-comparable-data` into the words "Not enough comparable data" plus
  what is missing. It never falls through to a comparison.
- **Every count is counted.** `countLine()` takes the array, not a number. So do
  `sliceRows()` (counts from `piece_ids`, ignoring a stale `n`),
  `pillarRead()` ("thin, 2 pieces"), and `selectionLine()`.
- **Off means absent.** `groupsFor()` drops a hidden screen and drops a group
  whose screens all dropped. With all eight off, `AnalysisApp` renders one line
  and no shell.

---

## The wiring the integrator must do

### 1. `app/profile/[id]/analysis/[tab]/page.tsx` — REQUIRED

This route now addresses a **group**, not a tab. The page must **delete its own
`<h2>Analysis</h2>`, its eight-item `Segmented`, and its mobile bottom-sheet
picker** — `AnalysisApp` draws the title and the three-segment control itself.
Leaving them in gives two "Analysis" headings and two navigations.

Rename the segment to `[group]` and render:

```tsx
import { ANALYSIS_TABS, rendered } from '@/lib/shell/nav';
import { renderProfile, shellRole } from '@/lib/shell/profile';
import AnalysisApp from '@/components/analysis/AnalysisApp';
import { Screen } from '@/components/shell/Screen';

const kind = shellRole(state, role, params.id);
if (kind !== 'owner') notFound();

const tabs = rendered(ANALYSIS_TABS, renderProfile(state, params.id, role), kind)
  .map(t => ({ id: t.id, label: t.label, state: t.state }));

return (
  <Screen>
    <AnalysisApp
      clientId={params.id}
      tabs={tabs}
      group={params.group}
      hrefForGroup={id => `/profile/${params.id}/analysis/${id}`}
    />
  </Screen>
);
```

Do not `notFound()` on an unknown group: `resolveGroup()` already falls back to
the first group that renders, which is the right behaviour when a switch was
turned off since the link was made.

**If you would rather not rename the segment yet**, the old eight-tab addresses
still work: pass `tab={params.tab}` instead of `group`, and `AnalysisApp` maps
that screen to the group it now lives in via `groupOf()`. The header must still
be removed from the page.

### 2. `app/profile/[id]/analysis/page.tsx` — REQUIRED

The landing redirect currently sends her to the first rendering **tab**. It must
send her to the first rendering **group**:

```ts
import { defaultGroupId } from '@/lib/analysis/groups';

const tabs = rendered(ANALYSIS_TABS, renderProfile(state, params.id, role), kind)
  .map(t => ({ id: t.id, label: t.label, state: t.state }));
const group = defaultGroupId(tabs);
router.replace(group ? `/profile/${params.id}/analysis/${group}` : `/profile/${params.id}`);
```

The client branch (`ResultsWindow`) is untouched and must stay untouched.

### 3. `tests/run.ts` — REQUIRED

I cannot edit it. Add:

```ts
import './analysis.groups.test.ts';
```

Verified standalone with:

```
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
  -e "import('./tests/analysis.groups.test.ts').then(async m => process.exit(await (await import('./tests/harness.ts')).run()))"
```

### 4. `app/client/[id]/analytics/page.tsx` — no change needed

`AnalysisApp` still accepts `accent` (accepted and ignored; the chrome is ink
now) and still works with no `tab` and no `tabs`: it reads the switch list from
`/api/analysis` itself. That costs one extra request, so pass `tabs` wherever
you already have it.

### 5. `lib/shell/nav.ts` — no change needed

`ANALYSIS_TABS` stays the eight switches. The groups are a view over it, not a
replacement. If the rail or bottom bar ever wants the group labels, import
`ANALYSIS_GROUPS` from `lib/analysis/groups.ts`.

### Prop contract

```ts
<AnalysisApp
  clientId: string                // the profile id
  tabs?: TabNode[]                // {id,label,state} from rendered(ANALYSIS_TABS, ...)
  group?: string                  // 'where' | 'what' | 'means'
  tab?: string                    // an old eight-tab id; resolves to its group
  hrefForGroup?: (id) => string   // makes the control navigate; without it it is local state
  fixHref?: string                // default: this pathname + ?strategy=channels
  engineHref?: string             // default: /profile/<clientId>/creation/engine
  accent?: string                 // accepted, ignored
/>
```

---

## What I tested

`tests/analysis.groups.test.ts`, 42 cases, all passing:

- the three groups hold all eight screens, in the handoff's order, none twice
- a hidden screen is dropped; a group with every screen hidden is dropped whole;
  with all eight off there is nothing to land on
- landing goes to the first group that **renders**, not always to "Where we are"
- a route asking for a dead group falls back rather than 404s
- the stalled month reads exactly "23 of 31 days collected", "not collecting
  since 12 July", "Everything below is read against 23 days, not 31."
- the bar's two halves fill the track; a complete month says nothing about stalls
- a stall, a switch-off and a never-connected read differently
- the open gap is the one that started last
- a screen on a narrower stretch says so instead of borrowing the headline
- an uncollected metric is an em dash and never `0`; a genuine `0` survives
- an unread row hatches at full width; a real zero draws a zero-length bar
- slice counts come from `piece_ids`, not a stored `n`; singular at 1
- goal bars clamp at 100 and a direction-only goal gets no bar at all
- "thin" always names the piece count; a coverage gap is not a failing pillar
- below the thresholds the answer is the refusal, verbatim
- `countLine` takes the array

Also run: `npm test` gives 398/398 (nothing I touched is registered in it, but
nothing broke), `./node_modules/.bin/tsc --noEmit` is clean, `next build` reports
"Compiled successfully" with the type and lint pass green.

---

## What I did NOT do, honestly

- **No visual check.** `next build` fails at page-data collection for
  `/api/upload/sign` because there is no `.env.local` on this machine, and with
  no database `/api/state` is empty, so `/profile/<id>/analysis/...` bails at
  "This profile is not available" before reaching my components. I could not see
  these screens at 1240 or 392. The layout is built to the prototype's
  measurements and every wide thing (the runs table, the chip rows, the
  segmented control) scrolls inside its own container, but **nobody has looked
  at it.** Open it once against a real profile before trusting it.
- **The compare columns have no numbers.** The design says each piece shows how
  it was born *above its numbers*. `/api/analysis`'s compare branch sends
  `selectable: { piece_id, title, published, costume }` and a resolved verdict —
  it sends **no per-piece metric readings and no seed**. So the column renders
  the title, the born line from the costume, and the age it was read at, and
  that is all. `CompareTab` already renders `p.readings` (`{label, value:
  Measured}[]`) and `p.seed_title` the moment the route sends them; adding those
  two fields to the compare branch is the smallest change that finishes the
  design. I could not make it: `app/` is not mine.
- **The group mixes two periods.** `/api/analysis` runs `tab === 'now'` on
  month-to-date and every other tab on full-month bounds. Stacking Now with
  Goals and Health therefore stacks two periods. That is exactly what
  `CoverageDiffers` exists to say out loud, and it does — but the honest fix is
  one period for the whole group, which means the route accepting a period the
  group passes down. Flagged, not fixed.
- **One request per screen.** A group of three screens makes three calls to
  `/api/analysis`. The old app made one per tab, so this is three where there
  used to be one. It is correct and it is simple; if it reads slow on her phone,
  the fix is a route that answers a whole group.
- **Health's "Fix the connection" only opens the Channels panel.** It does not
  re-run a sync. There is no such action in the route today.
- **No mobile bottom-sheet.** With three segments there is no need: the
  segmented control is one row that scrolls and never wraps.

## Things in the existing code that look wrong

1. **The prototype's uncollected slice draws nothing.** `RoomsV3.dc.html` sets
   `width: 0%` with the hatch as its background, so the hatch is invisible. The
   README's rule ("an uncollected slice draws the hatch, not a zero-length bar")
   is the one I implemented. If she wanted the prototype's behaviour, the line to
   change is `meterBar()` in `lib/analysis/groups.ts`.
2. **Coverage was being drawn twice on some screens.** Before this phase the
   shell's Analysis page rendered a tab, and the tab rendered its own
   `CoverageBanner`; `SlicesTab` used `payload.slice.coverage` while the others
   used `payload.coverage`, which are not always the same number. Two different
   coverage claims on one screen. Now there is one, at the top, and a line when a
   screen genuinely differs.
3. **`AnalysisApp`'s old fallback showed all eight tabs when the API answered
   with none** (`visible.length ? visible : Object.keys(TAB_LABEL)...`). That is
   the opposite of "off means absent": an error became a full tab bar. It is
   gone; an unreadable switch list now says so in one line.
4. **`Bucket` printed `bucket?.count ?? 0`** — a headline number read from a
   stored field rather than counted from the ids beside it. Now counted.
