# Phase note — CREATION → Logs

Built against the handoff's "CREATION → Logs" section and `design/RoomsV3.dc.html`.

## Files I own and changed

| File | State |
|---|---|
| `dashboard/components/creation/Logs.tsx` | rewritten from the recovered work in progress |
| `dashboard/lib/creation/logs.ts` | new — all the pure logic |
| `dashboard/tests/creation.logs.test.ts` | new — 37 tests, all passing |

I touched nothing else. No shared wiring file was edited.

## What it is

One segmented control with five tabs: **Tasks · Decisions · Requests · Pipelines · Notes**,
and the design's row exactly: 8px status dot, title 15px/600, sub-line 12.5px
`#9b95a1`, when 12px tabular. Rows are `15px/18px` on a hairline card with the
whisper shadow. One plain footnote per tab, the prototype's words unchanged.

**Tasks** — this month's `monthData[month].agenda` joined with the client-task
half of `state.personalTasks`. Spec 01's `linkedAgenda` is a POINTER, not a
copy, so an agenda item that a task on her day already points at is drawn once,
with the sub-line "client task, also on your day". A client task for this
profile with no pointer into this month's agenda is a real extra row and says
"from your day". Tick to mark done (dispatches `TOGGLE_AGENDA`); add box
dispatches `ADD_AGENDA`. The effort meter (`MomentumMeter`) mounts under Tasks
when `logs.effort_meter` renders, which is her own profiles only.

**Decisions and Requests** — these needed no new state slice. Spec 21 §8.8
already declares `work-log/logs/decisions` (entry type `decision`) and
`work-log/logs/requests` (entry type `request`), both `fed_by: ['owner']`, both
`history: append_only`, both with a registered switch. So they live in the
profile's own body and are written with the tree's own `putEntry` / `amendEntry`
and handed back through the existing `SET_BODY` action, exactly the way
`IntakeView` and `CurationView` already do it.

Append-only is the point and it shapes the UI: **"mark done" is an amendment on
top of the birth record**, never an overwrite. Reading an entry means folding
its amendments over its data (`foldEntry`). Marking something done twice writes
nothing. A request's ageing ("open 11 days") is counted from its own created_at
against today, never stored.

A profile with no `body` yet reads these tabs and cannot write to them; it shows
one line saying the profile has not been moved across. That is a real state, not
a switched-off one, so it is stated rather than hidden.

**Pipelines** — `ListsView`, `ColdCallsView`, `OrdersView` and `AnswersView`
(Divine's Lead Answers, as "Saved replies") mounted inside the tab, not
rewritten. Each is behind the switch its own spec registered. A profile that
uses none has no Pipelines tab at all; a profile that uses one gets the tab with
no second strip above it.

**Notes** — this profile's tagged observations only. Mid-cutover they exist in
two places (migration copies the notebook into the body under the same ids and
leaves the notebook standing), so `noteRows` merges by id with the body winning:
one note, one row. A new note is written to the body on a migrated profile and
to the legacy notebook on one that has not moved. **The untagged inbox is frozen
and is not read or written here at all.**

Off means absent throughout: `liveLogTabs` and `livePipelines` take the switch
resolver and drop anything that resolves `hidden`. `history` survives, read-only
(S9). There is no disabled tab and no "not available for this client" anywhere.

## The wiring the integrator must do

`app/profile/[id]/creation/[tab]/page.tsx` — one change, and it is a special
case rather than a `SECTIONS` entry, because Logs brings its own five-tab strip
and the page's per-section `Segmented` would be a second strip above it.

```tsx
import Logs from '@/components/creation/Logs';
```

Inside `CreationTabPage`, after `beforeLock` is computed and after the
non-owner branch, before the `SECTIONS` lookup:

```tsx
if (params.tab === 'logs') {
  return (
    <Screen>
      <ScreenHeader
        title="Creation"
        segments={subTabs.map(t => ({
          id: t.id, label: t.label, href: `/profile/${params.id}/creation/${t.id}`,
        }))}
        active={params.tab}
      />
      {beforeLock && <LockBanner />}
      <Logs profileId={params.id} readOnly={beforeLock} />
    </Screen>
  );
}
```

Then **delete the whole `logs:` entry from `SECTIONS`** (the six sections that
mount `DashboardView`, `ListsView`, `ColdCallsView`, `OrdersView`,
`ProfileNotes` and `MomentumMeter`), and delete the now-unused `ProfileNotes`
function at the bottom of the page plus the imports those sections used
(`DashboardView`, `ListsView`, `ColdCallsView`, `OrdersView`, `MomentumMeter`)
if nothing else on the page needs them.

Prop contract:

```ts
interface LogsProps {
  profileId: string;
  readOnly?: boolean;   // default false
}
```

`readOnly` is a hard override for the page that already shows the lock banner.
Each tab also goes read-only on its own when its switch resolves `history`, so
passing nothing is safe — it just means the banner and the controls could
disagree before the lock, which is why the page should pass `beforeLock`.

**Mount it directly under `<Screen>`, with no `-mx-4 md:-mx-7` wrapper.** Logs
applies that negative margin itself, only to the two full-bleed things it mounts
(a pipeline screen and the effort meter). Wrapping the whole component in it
again would pull the tab strip and the rows off the edge of the phone.

## Registering the test file

`tests/run.ts` is shared, so I could not register it. It needs one line:

```ts
import './creation.logs.test.ts';
```

Verified meanwhile with:

```
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e "import('./tests/creation.logs.test.ts').then(async m => process.exit(await (await import('./tests/harness.ts')).run()))"
```

→ **37/37 passed.**

## What I tested

Five things, each because a later tidy-up would quietly undo it:

1. **Off means absent** — a switched-off tab is not in the list, Pipelines
   disappears entirely for a profile with no pipelines and reappears the moment
   one is on (the container rule), a `history` pipeline is kept read-only, and
   every footnote exists and has no em dash.
2. **One thing, one home** — an agenda item a task on her day points at is one
   row; a pointer at another profile or another month folds nothing; personal
   and content tasks never appear here; the legacy single `clientId` still counts.
3. **Missing is missing** — "no date" not a zero, overdue vs today vs later each
   say which they are, done sinks to the bottom, `shortDay` invents nothing from
   rubbish input.
4. **Append-only** — the birth record still reads `done: false` after the entry
   is marked done, the amendment carries its own date, marking twice writes
   nothing, a second write at the same id is refused by the tree, a blank entry
   is refused before the tree sees it, "received 30 Jul" comes off the amendment
   and not off today.
5. **Counted, never stated** — singular/plural, ageing in whole days, and the
   on-screen "N of M still open" line computed off the array drawn above it.

`./node_modules/.bin/tsc --noEmit` is **clean for the whole project**.

## What I did NOT do, honestly

- **No browser check.** The component is not mounted on any route yet and
  `app/` is off-limits to me, so there was nothing to open. Geometry comes
  straight from the prototype's inline styles and I checked the phone case by
  construction (the segmented control already scrolls one row and never wraps;
  `min-w-[9rem]` on the add-bar fields makes the wrap at 392 predictable, two
  fields on one line and the button on the next). **It has not been seen
  rendering.** That is the one real gap in this screen.
- **`logs.changes` has no tab.** Spec 21 §8.8 declares
  `work-log/logs/changes` (standing-agreement changes, and out-of-scope review
  asks auto-routed there by S20). The design's five tabs have no home for it.
  It is neither rendered nor lost — it just is not addressed by this screen, and
  somebody has to decide whether it belongs under Decisions or gets a sixth tab.
  I did not decide that on her behalf.
- **The Pipelines sub-screens are the old screens, unchanged.** They still wear
  their pre-restructure look (stone palette, their own headers and paddings)
  inside the new card. Mounting beat rewriting four screens, but they will look
  out of place until somebody restyles them. That is visible, not hidden.
- **No new state slice, so nothing was needed in `lib/access.ts` or
  `lib/tree/`.** If a later change ever does need one, the addresses already
  exist and the slice is the wrong move.

## Things I found that look wrong in existing code

1. **`tests/creation.test.ts` test 2d fails against `lib/shell/nav.ts` as it
   stands.** The test asserts that `creation.funnel_replies` has left the Board
   tab's switches and landed on the Logs tab's:

   ```
   ok(!board.switches.includes('creation.funnel_replies'), 'saved replies left the board');
   ok(logs.switches.includes('creation.funnel_replies'), 'and landed in Logs → Pipelines');
   ```

   `CREATION_TABS` currently has it on `board` and not on `logs`, so both
   assertions fail. `nav.ts` is shared and off-limits to me. **The fix is to
   move the string:** delete `'creation.funnel_replies'` from the `board` entry
   and add it to the `logs` entry. My `LOG_TAB_SWITCHES.pipelines` already
   includes it, which is what makes Saved replies show up as a pipeline. The
   Board agent also needs to drop the `funnel` section that mounts
   `AnswersView`, or Saved replies will have two homes.

2. **Two definitions of "today".** `components/creation/Board.tsx` line 84 uses
   `new Date().toISOString().slice(0, 10)`, which is the **UTC** date. Mine uses
   the local date. In IST those disagree for the first five and a half hours of
   every day, so before 05:30 the Board and Logs would call different things
   overdue. One of them should win and it should live in one helper. I used
   local because that is the day she is actually in.

3. **`ObservationsView.tsx` is not mountable and is now partly orphaned.** It is
   a full-page screen with its own gradient header and a "Home" button, and it
   mixes the tagged notes with the frozen untagged inbox. I could not wrap it,
   so Notes is a rewrite of the per-profile half. The untagged inbox still needs
   `ObservationsView` (or whatever replaces it) somewhere outside a profile;
   nothing in the new shell reaches it today.
