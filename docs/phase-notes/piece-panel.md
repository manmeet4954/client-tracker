# Phase note — the piece panel

Review as a **state of a piece**, not a screen. This is the change that kills the
last second copy in the product: a preview is no longer its own object on its own
Previews screen, it is the review state of the piece that already exists on the
board.

## What I built

| File | What it is |
|---|---|
| `lib/creation/piece.ts` | New. All the panel's logic, pure, no React, no runtime `@/` imports. |
| `components/creation/PiecePanel.tsx` | Rewritten from the recovered work in progress. |
| `tests/creation.piece.test.ts` | New. 32 checks, plain Node, no dependencies. |

### The panel

- Same geometry as the Strategy corner, read off `components/shell/StrategyPanel.tsx`
  and the prototype: `fixed inset-0 z-50`, backdrop `rgba(23,21,26,.34)`,
  `justify-end`, panel `w-full` on phone / `md:w-[470px]` on desktop, `bg-paper`,
  `shadow-panel` (`-16px 0 40px rgba(23,21,26,.22)`).
- Head follows the **prototype's piece panel**, not the Strategy panel: light head
  on `#faf8f6` with a hairline underneath, title 18px/600, `X` 19px in `#9b95a1`.
  (The Strategy panel's head is ink. The recovered file had an ink head here too;
  `ProfileV3.dc.html` lines 96 to 100 say otherwise, so I followed the prototype.)
- Closing calls `onClose`. The backdrop, the `X` and the Escape key all do it.
  Nothing navigates, so the screen underneath is untouched.
- **Stage chips**: the six `CONTENT_STAGES`, current one filled `#1c1a21`, the rest
  `#efece9` on `#6b6570`, 12.5px/600, radius 999. When the profile is **not**
  locked they render as plain spans, not disabled buttons ("off means absent"),
  with one line: "Strategy is not locked yet, so nothing moves here."
- **Fields**: Pillar, Format, Born from, Goes live, Live link. Every absence is
  said in words ("No pillar yet", "Not born from a seed", "Not posted yet") and
  drawn in `#9b95a1`. Only a real `postUrl` becomes a link.
- **In Review**: the Instagram-accurate preview via the existing
  `components/InstagramPost.tsx` (not rebuilt), the `/p/<shareId>` line, "Copy the
  link", "Send on WhatsApp" (a `wa.me` link with the public URL, `target="_blank"`,
  no phone number, nothing sent on her behalf) and "Open it".
- **Attach**: a preview with no `cardId` (or one whose card is gone) is offered
  underneath, one row each with its own slide count. **She picks.** Nothing is ever
  guessed. Uses `unattachedPreviews`/`previewFor` from `lib/creation/board.ts` —
  imported, not duplicated.
- **Make its preview**: creates a `PreviewPost` with `cardId` set **at birth**, its
  name and caption taken off the piece, so nothing is asked twice.
- **Caption drift**: if the piece has been rewritten since the preview was made,
  the panel says so and offers "Use the piece's words". One caption, one home.
- **Gates**: the profile's own brand gates from `readGateSet(body)` plus
  `OPERATIONAL_GATES`. If a profile has no gate set, it says so and shows nothing —
  no invented passes. The headline is counted from the row array at render time.

## The exact wiring the integrator must do

**Contract, and it is the whole contract:**

```tsx
import PiecePanel from '@/components/creation/PiecePanel';

<PiecePanel cardId={string} onClose={() => void} />
```

Nothing else. In particular:

- **Do not pass `profileId`.** The panel resolves the profile from the card id
  itself (`locatePiece`), across the already role-filtered `state.clientData`.
- **Do not pass `readOnly`.** It reads the lock itself via
  `renderProfile(state, profileId, role).strategy_locked`.
- It is a client component and needs to be inside `AppProvider`.

**Where it goes.** `components/creation/Board.tsx` already opens a piece by pushing
`?piece=<cardId>` onto the current route (its `openPiece`). So the panel belongs in
whatever renders the profile's Creation screen — the same place the Strategy
overlay is rendered from — as:

```tsx
const piece = searchParams.get('piece');
{piece && (
  <PiecePanel
    cardId={piece}
    onClose={() => {
      const p = new URLSearchParams(search?.toString() ?? '');
      p.delete('piece');
      router.push(p.size ? `${pathname}?${p}` : pathname);
    }}
  />
)}
```

Clear **only** the `piece` parameter, so the board's view, month and scroll are
untouched.

Two things to decide when wiring:

1. `PiecePanel` and `StrategyOverlay` are both `z-50`. If `?piece=` and `?strategy=`
   are both set they stack. I would render the piece panel only when `strategy` is
   absent, but that is the integrator's call and I did not make it here.
2. **`tests/creation.piece.test.ts` needs registering** in `tests/run.ts`
   (`import './creation.piece.test.ts';`). I do not own that file.

## What I tested

`node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e "import('./tests/creation.piece.test.ts').then(async m => process.exit(await (await import('./tests/harness.ts')).run()))"`
→ **32/32 passed**. `./node_modules/.bin/tsc --noEmit` → **clean**.

Covered: one id resolves to one profile (and to the tree piece a deep link may
carry, and to "missing" when nothing holds it); the lock allows a move when locked
and refuses when not; the five fields and every missing-value line; a preview born
with its `cardId`; attach keeps name, slides, caption and `shareId` and does not
mutate the original; only unattached previews are offered; caption drift; the
share path, the whole URL and the `wa.me` link (asserts it is never `t.me` and
carries no phone number); the gate reading with no set, with an empty set, and
with a set, plus the headline counted from the rows and passes marked only past
review. Four source guards on the panel itself: the two-prop contract, no second
copy of the board arithmetic, no `disabled` control anywhere, and the Strategy
panel geometry.

## What I did NOT do — read this part

1. **No browser verification, at either width.** There is no `.env.local` in this
   worktree (or in the main copy), so the app has no state to render, and I am not
   allowed to touch `app/` to wire the panel in for a screenshot. Both viewports
   are correct **by reading the CSS**, not by looking at them. Someone should open
   it at 1240 and at 392 once it is wired.
2. **Slides cannot be added from the panel.** The slide editor — upload to Supabase
   storage, reorder, delete, Canva import, caption — is still a private modal
   inside `components/PreviewsView.tsx`, and its `uploadImage` helper is not
   exported. So "Make its preview" produces a real, attached, linkable preview with
   **zero slides**, and the only place to fill it is the old Previews screen.
   **The Previews screen cannot be deleted until that editor moves into this panel
   or is lifted into a shared component.** That is the biggest open piece of this
   screen, and it is not mine to do without owning `PreviewsView.tsx`.
3. **"Sent and opened" does not exist in the data.** I searched: no `sentAt`, no
   `openedAt`, no view record anywhere in `types/`, `lib/`, or `app/api/share`. So
   the panel does not draw a sent/opened state; it says plainly that the link is
   live and that nothing records when it was sent or opened, and that the answer
   comes back as a move off Review. Building it truthfully needs a `sentAt` on
   `PreviewPost` (set by the share action) and a view ping on `/p/[shareId]`.
   `deliveryState()` in `lib/creation/piece.ts` is where that turns on.
4. **Gate passes are not recorded per piece.** Nothing in the model holds a per-gate
   verdict, so a gate is marked when the piece has come out of review
   (`ready`/`scheduled`/`posted`) and the panel says exactly that: "A gate is
   marked when the piece has come out of review. Nothing here is ticked by hand."
   Real per-gate marks are a data addition, not a UI change.
5. No animation. The panel appears, it does not slide. `StrategyPanel` does not
   animate either; I matched it rather than inventing a second behaviour.
6. Editing the piece (title, words, date, pillar) is still `CardEditor`. The panel
   reads the piece and moves its stage; it is not a second editor.

## What looks wrong in the existing code

- **`tests/creation.test.ts` is not registered in `tests/run.ts`.** The phase 2 base
  commit added it, but `run.ts` never imports it, so the board's own acceptance
  tests do not run under `npm test`. Mine has the same problem, by rule. Whoever
  edits `run.ts` should add both.
- **`lib/shell/profile.ts`** (around the `pickAccent` comment) still says "The
  accent is CHROME ONLY: the header band, the active nav item, focus rings, primary
  buttons". The redesign's rule is the opposite: chrome is ink everywhere and a
  profile's hue is identity only. The code may be fine; the comment is now
  misleading and will send someone the wrong way.
- The recovered `PiecePanel` took `profileId`, `pieceId`, `closeHref` and
  `readOnly`, and derived `readOnly` from a prop rather than from the lock. If any
  caller was written against that shape it will need updating to the two-prop
  contract above. Nothing in `app/` or `components/` imported it, so as far as I
  can see there is no such caller.
