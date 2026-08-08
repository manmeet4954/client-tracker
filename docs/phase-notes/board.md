# Phase note: Creation → Board

Agent: board. Branch: `worktree-wf_937e8caf-6ae-1`, forked from `claude/restructure-phase-2` at `0b39069`.

## What I built

Three files, and only these three:

| File | State |
|---|---|
| `components/creation/Board.tsx` | Finished. Was recovered work in progress. |
| `lib/creation/board.ts` | Extended. The recovered version was good; I built on it. |
| `tests/creation.board.test.ts` | New. 34 cases, all passing. |

### The screen

**"Needs you today"** at the top: collapsible, chevron + label + count pill, this profile only, both pieces and agenda tasks. The count pill renders `needs.length`, never a stored figure. Empty says so in words rather than drawing a 0. The open/closed state is remembered per profile in `localStorage`, read in an effect so the server render and the first client render agree (the recovered version read storage in the `useState` initialiser, which is a hydration mismatch).

**Four views** in the shell's `Segmented`: Board, Pillars, Table, Month.

- **Board, desktop.** Six columns from `CONTENT_STAGES`, 206px, `bg-sunken` (`bg-sunken-muted` for Posted), radius 18, padding 14/12. Cards white, hairline, radius 14, padding 12/13, `border-left: 3px solid <hue>`, title 14/600, chips 11/600 on `#f4f1ee`, meta 11.5 faint. Drag between columns with dnd-kit, using the repo's existing `SmartPointerSensor` idiom.
- **Board on phone, and Table.** The same stages as stacked full-width sections with rows. These take a drop as well, which is what the prototype does.
- **Pillars.** A column per pillar. The mix target sits in the header, stated as a target (`35% target`) and simply absent when the pillar has none. Under it a line that counts what is actually drawn beneath it (`4 pieces, 24% of the board`). The "No pillar yet" column exists only when something is in it. Stacks vertically on phone, never a horizontal scroller there.
- **Month.** Desktop is the 7-column grid, 62px min-height cells, dated pieces as 10px chips in the profile hue. On phone it becomes the agenda list.

**Unlocked state.** `readOnly` refuses every drop, refuses ticking a task off, sets `draggable="false"` on cards, disables the droppables, and swaps the board note to "Read only until Strategy is locked." The banner is `components/shell/Screen.tsx`'s `LockBanner`, unchanged — it fitted, I did not extend it. Its button already opens the Strategy corner via `?strategy=lock`.

**Orphan previews.** Kept from the recovered version: previews with no `cardId` (or a `cardId` that resolves to nothing) are listed under the board, never deleted, with the line saying the piece panel is where one gets attached. The strip is absent when there are none.

### The pure logic

Everything countable is in `lib/creation/board.ts`. Already there and kept: `needsToday`, `unattachedPreviews`, `previewFor`, `plural`, `monthCells`, `agendaOf`. Added:

- `agendaIdOf(row)` — the agenda item behind a task row.
- `needsOpenKey`, `readNeedsOpen`, `writeNeedsOpen` — the remembered strip.
- `boardCards(cards, month)` — dated pieces belong to their own month, dateless ones to every month.
- `stageBuckets(stages, cards)` — every stage with the pieces standing in it.
- `boardNote(readOnly)`.
- `pillarColumns(cards, pillars)` / `pillarMixLine(col)`.
- `cardChips(card, pillars)`.
- `dndId(surface, id)` / `bareId(value)` — see the note on drag ids below.

## The exact wiring the integrator must do

**File:** `dashboard/app/profile/[id]/creation/[tab]/page.tsx` (I do not own it, so I changed nothing).

1. Import: `import Board from '@/components/creation/Board';`
2. In the `SECTIONS.board` entry, replace the `stages` section's `ContentView` with `Board`. `ContentView.tsx` is untouched and still mounted by the legacy `/client/[id]` routes.

```tsx
board: (id, accent) => [
  {
    id: 'stages', label: 'Stages', switch: 'creation.board',
    render: () => (
      <Board
        profileId={id}
        hue={accent}
        readOnly={beforeLock}
        lockBanner={false}
        onOpenPiece={openPiece}
      />
    ),
  },
  // ... review / funnel sections as they are
],
```

`SECTIONS` is currently a module-level constant that only receives `(id, accent, seedId)`, so `beforeLock` and `openPiece` are not in scope there. Either widen that signature or inline the board section in the component body. That is the integrator's call.

**Prop contract:**

```ts
interface BoardProps {
  profileId: string;              // the profile id, = params.id
  hue: string;                    // accentFor(client, data)
  readOnly: boolean;              // !profile.strategy_locked, i.e. the page's `beforeLock`
  onOpenPiece: (cardId: string) => void;
  lockBanner?: boolean;           // default true
}
```

**`onOpenPiece` — the piece panel is another agent's screen.** The board never routes and never builds the panel. The page already reads `const pieceId = search?.get('piece') ?? ''`, so the natural implementation is the one the recovered Board had inline:

```tsx
function openPiece(cardId: string) {
  const params = new URLSearchParams(search?.toString() ?? '');
  params.set('piece', cardId);
  router.push(`${pathname}?${params.toString()}`);
}
```

Whatever the panel agent settles on, the board only ever hands over a card id.

**`lockBanner`.** The page already renders `{beforeLock && <LockBanner />}` at line 79, above every Creation sub-tab. Pass `lockBanner={false}` so the words are not on screen twice. It defaults to `true` so a board mounted on its own still matches the design.

**Test registration.** `tests/creation.board.test.ts` is not in `tests/run.ts` — that file is shared and I do not own it. Add `import './creation.board.test.ts';` alongside the other imports. Verified standalone with:

```
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e "import('./tests/creation.board.test.ts').then(async m => process.exit(await (await import('./tests/harness.ts')).run()))"
```

## What I tested

34 cases, all passing, plain Node. Behaviour over `lib/creation/board.ts` plus static assertions read off `Board.tsx` for the guarantees that only exist in the markup.

- Needs today: overdue first then today, posted pieces excluded, done tasks excluded, same-day rows not sorted apart by the first letter of their words, task rows carrying their agenda id.
- The strip's memory: per profile, and any value that is not the literal word `closed` reads as open.
- `boardCards`: a dated piece in its own month only, a dateless piece in every month, a date beating the created month.
- Six stages read from `CONTENT_STAGES` and spelled nowhere in the component; every piece in exactly one bucket; counts summing to the input.
- Pillars: share counted from the pieces drawn, no unsorted column unless something is unsorted, an empty board giving 0 rather than a division by nothing, singular and plural in the mix line.
- Month: 35 cells or a whole sixth week rather than losing days, a nonsense month drawing nothing, the phone agenda in date order, the headline counted from the array both viewports render.
- Read only: the drop guard, the tick-off guard, `draggable="false"`, the disabled droppables, and that the lock copy is imported rather than respelled.
- Drag ids never colliding between the two shapes of the board.
- No em dashes in UI copy.

`./node_modules/.bin/tsc --noEmit` is clean across the repo.

## What I did NOT do

- **No browser check.** I did not run the app, so nothing here is verified visually at 1240 or 392. Measurements were taken off `RoomsV3.dc.html` and translated to Tailwind by hand. The six columns at 206px plus gaps come to about 1290px, which is wider than `Screen`'s `max-w-6xl`; it scrolls inside its own `overflow-x-auto`, which is what the prototype does, but somebody should look at it on a real screen.
- **No piece panel.** `components/creation/PiecePanel.tsx` exists as recovered work in progress and I did not touch it.
- **No page, route, nav, types, access or tree edits.** Nothing under `app/`, and none of the shared wiring files.
- **`ContentView.tsx` untouched**, as instructed.
- **No dnd-kit accessibility polish.** Cards are `role="button"` with Enter/Space handlers, but keyboard *dragging* (dnd-kit's `KeyboardSensor`) is not wired. The old board did not have it either.
- **Posted cards are not folded away.** `ContentView`'s pillar columns hide posted pieces behind a "show" footer. The design does not ask for that on the new Pillars view, so I did not carry it over. If she misses it, that is a deliberate gap, not an oversight.

## Things that look wrong in the existing code

1. **`tests/creation.test.ts` is registered nowhere and three of its sixteen cases fail today.** It is recovered phase-2 work. I ran it: **13/16 pass, 3 fail**, and none of the three is caused by anything I changed. It describes the intended end state, not the current one:
   - **1e** expects `types/index.ts` to contain the words `DO NOT "CLEAN THIS UP"`. The file carries the reasoning in prose but not that phrase, so the assertion is false. Either the phrase goes into `types/index.ts` or the test should match what is actually written there.
   - **2d** expects `creation.funnel_replies` to have left the Board node and moved to Logs in `lib/shell/nav.ts`. It is still on `board` (line 34) and not on `logs`.
   - **2e** expects `app/profile/[id]/creation/[tab]/page.tsx` not to mention `PreviewsView` and to mention `PiecePanel`. Today the page mentions `PreviewsView` (line 19, and the `review` section at line 111) and does not mention `PiecePanel` at all.

   Its section 3 duplicates what `creation.board.test.ts` now covers more fully. Whoever owns `nav.ts`, `types/index.ts` and the page should decide whether to make those three true or to drop them; do not register `creation.test.ts` in `tests/run.ts` before then, or the build goes red.

2. **Two live copies of Review.** The page's `SECTIONS.board` still lists a separate `review` section rendering `PreviewsView`, while the design says review is a state of the piece and the preview belongs to the piece panel. That is "one thing, one home" broken until the panel lands and that section is removed. Not mine to remove.

3. **`ContentView.tsx`'s `useDraggable`** has no `disabled` and no read-only concept at all, so the legacy board can still be dragged on an unlocked profile. Out of scope here, but worth a line in the backlog.

4. **The worktree I was given was stale.** It sat at `530d658`, before the phase-2 base, so `docs/design-handoff/`, `components/creation/` and `lib/creation/` did not exist in it. I fast-forwarded to `claude/restructure-phase-2` (`864a291`) before starting. If other agents were given the same stale base, they will have hit the same thing.
