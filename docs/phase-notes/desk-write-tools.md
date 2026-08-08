# Spec 30, the write half: what the desk chat can DO

Agent: desk-write-tools. Built against `dashboard/specs/30 — The Desk Chat as a Working Harness.md` §3.2 and §3.3.

Files owned and written:

- `dashboard/lib/desk/write.ts` — every write tool
- `dashboard/lib/desk/preview.ts` — `makePreview`
- `dashboard/tests/desk.write.test.ts` — 36 tests, all passing

Not touched: `types/index.ts`, `lib/access.ts`, `lib/tree/*`, `lib/shell/*`, `tests/run.ts`, `contexts/`, `app/`.

`./node_modules/.bin/tsc --noEmit` is clean. `npm test` is 593/593 (my file is not yet in `tests/run.ts` — the integrator adds `import './desk.write.test.ts';`).

---

## The shape every tool returns

```ts
export type ToolResult =
  | { ok: true; state: AppState; paths: string[]; summary: string }
  | { ok: false; refusal: string };
```

`paths` are SCOPE KEYS, built with `scopeKey(profileId, path)` from `lib/tree/scopes.ts` — the exact strings the save door parses. Post `{ state, paths }` and path scoping, the lock and role filtering all apply as normal.

No tool saves. No tool mutates: a test asserts the state handed in is byte for byte unchanged after a successful write.

Three tools return the same shape plus one extra field, because the caller needs the id it just made:

- `addPiece` → `+ pieceId`
- `addSeedCapture` → `+ captureId`
- `makePreview` → `+ sharePath, shareId, previewId, pieceId, pieceCreated`

## The context every tool takes

```ts
export interface IdSource { id(): string; shareId(): string }
export interface WriteContext { state: AppState; now: string; ids: IdSource }
```

`now` and `ids` are INJECTED. No clock read, no randomness, so every test is repeatable.

The route must pass the app's own generators, not new ones:

```ts
import { generateId, generateShareId } from '@/lib/utils';
const ctx = { state, now: new Date().toISOString(), ids: { id: generateId, shareId: generateShareId } };
```

That is how "reuse `PreviewsView`'s id and shareId generation" is honoured without this module importing a browser-crypto function it cannot run under Node.

---

## Every tool, exactly

```ts
updateTask(ctx: WriteContext, intent: {
  profile: string; taskId: string;
  text?: string; dueDate?: string; done?: boolean; pieceId?: string;
}): ToolResult

addTask(ctx: WriteContext, intent: {
  profile: string; text: string; dueDate?: string; pieceId?: string;
}): ToolResult

addPiece(ctx: WriteContext, intent: {
  profile: string; title: string; hook?: string;
  pillarId?: string; platform?: string; format?: string;
  stage?: string; seedId?: string; scheduledDate?: string; notes?: string;
}): { ok: true; state; paths; summary; pieceId: string } | { ok: false; refusal: string }

movePiece(ctx: WriteContext, intent: {
  profile: string; pieceId: string; to: string;
  liveLink?: string; postedOn?: string;
}): ToolResult

schedulePiece(ctx: WriteContext, intent: {
  profile: string; pieceId: string; date: string;   // '' clears the date
}): ToolResult

addSeedCapture(ctx: WriteContext, intent: {
  profile: string; text: string;
  arrival?: CaptureArrival; sourceRef?: string; seedId?: string;
}): { ok: true; state; paths; summary; captureId: string } | { ok: false; refusal: string }

addNote(ctx: WriteContext, intent: {
  profile: string; text: string; topic?: string;
}): ToolResult

makePreview(ctx: WriteContext, intent: {
  profile: string;
  pieceId?: string;
  newPiece?: { title: string; hook?: string; pillarId?: string; platform?: string; format?: string };
  links: string[];
  name?: string; caption?: string;
  canvaConfigured: boolean;
}): MakePreviewResult
```

`profile` is a profile id OR a name. It resolves id first, then exact name, then a single containing match; two matches refuse and ask which.

Helpers the read half or the loop may want:

```ts
resolveProfile(state, ref): { ok: true; profile: ResolvedProfile } | { ok: false; refusal: string }
guardPath(state, profile, path): string | null      // null means the door is open
normalizeStage(word): PieceStage | null             // 'live' → posted, 'ready' → approved
writerFor(path): 'pipe:chat' | 'owner'
classifyLink(url): 'media' | 'canva' | 'other'      // exported from preview.ts
```

## Where each tool writes

| Tool | Address | How |
|---|---|---|
| `updateTask` | `work-log/logs/tasks` | `amendEntry` (append-only) |
| `addTask` | `work-log/logs/tasks` | `putEntry`, type `task` |
| `addPiece` | `work-log/creation` | `putEntry`, type `piece` |
| `movePiece` | `work-log/creation` | `amendEntry` |
| `schedulePiece` | `work-log/creation` | `amendEntry` |
| `addSeedCapture` | `work-log/creation/topics/captures` | `writeCapture` (`lib/engine/captures.ts`) |
| `addNote` | `work-log/logs/observations` | `addNote` (`lib/creation/logs.ts`) |
| `makePreview` | `work-log/creation/review` (+ `work-log/creation` when a piece is born) | the `previewPosts` slice |

Everything goes through `lib/tree/body.ts`, which refuses an undeclared path, an undeclared writer and the wrong entry type. Nothing here re-checks what that door already checks.

The writer is read off the DECLARATION, not hard-coded: `pipe:chat` on tasks and notes, which name it in `fed_by`; `owner` on creation, which does not, because the chat acting there is her acting.

## The refusal rule, as built

`guardPath` runs before every write:

1. Undeclared path → refused.
2. Under `work-log/creation` and `strategyLocked(body)` is false → the lock refusal. `strategyLocked` and `CREATION_PREFIX` come from `lib/strategy/derivation.ts`; the rule is not re-derived here.
3. The switch the DECLARATION names, resolved through `renderState` (the one visibility authority). Anything other than `active` refuses. `history` refuses too: read-only is not writable.
4. If step 3 refused and the strategy is not locked, the same function is asked the counterfactual — would this render if the strategy WERE locked? If yes, the refusal says the LOCK rather than "switched off". This matters: `renderState` gates whole families behind the lock (logs and assets included, not only creation), so without this an unlocked profile would tell her a switch was off that she never moved.

Beyond the door:

- `addPiece` with a `seedId` re-checks `canMotherPieces` (`lib/engine/seeds.ts`). An unlocked seed refuses the whole write.
- A piece, task or seed id that does not exist refuses.
- A date that is not `yyyy-mm-dd` refuses; a date is never stored as words.
- A stage word the ladder does not have refuses; `normalizeStage` maps her words and invents nothing.
- A change that changes nothing refuses rather than writing an empty amendment.

Every refusal ends "Nothing was written", carries no path and no `[tree]` prefix, and has no em dashes. A test asserts all three.

## make_preview

1. Profile resolved, `work-log/creation/review` guarded.
2. Piece resolved: the tree first, then the profile's legacy `contentCards` (both are real mid-cutover and a preview can be made against either). If none is named and `newPiece` is given, the board's own door is checked too.
3. Links classified BEFORE anything is written, so a refused preview leaves no half-made piece behind.
4. The piece is born only if needed, at stage `review`, in the tree.
5. The preview carries `cardId` AT BIRTH, via `newPreviewFor` in `lib/creation/piece.ts` — the same function the piece panel uses. If the piece already has a preview (`previewFor` from `lib/creation/board.ts`), that preview GROWS: new slides are appended, the shareId is unchanged, so a link she already sent still works. A second copy of a piece is never made.
6. `/p/<shareId>` comes back, built with `sharePath` from `lib/creation/piece.ts`.

Link handling, honestly:

- direct image or video URL → attached, in the order she pasted them
- Canva link → REFUSED, with `CANVA_NOT_CONNECTED`: the import is built and waiting but needs a Canva app registered on her Canva account, which is a one-time setup only she can do. When `canvaConfigured` is true it returns `CANVA_CONNECT_FIRST` instead: the app exists but this chat cannot run the import, so pull it in from the preview editor.
- anything else → refused, naming the link, saying plainly that pages are not read and not screenshotted.
- one bad link refuses the WHOLE preview. Two of three slides reported as done is exactly the half-done write this spec exists to stop.
- more than `MAX_CAROUSEL_SLIDES` refuses with both numbers rather than silently trimming.

Nothing is fetched anywhere in this module. `classifyLink` reads the URL's own host and path.

---

## What I did NOT do, said accurately

**1. Writes go to the TREE, not to the legacy slices, and an unmigrated profile is refused.**
Spec 30 §3 lists "it executes against legacy slices rather than the tree" as a defect of the old brain, and law 1 is the tree. So a profile with no `body` gets a plain refusal: "X has not moved into the new structure yet." The consequence: a piece the chat adds appears on the NEW shell's board (which reads `body.paths`) and not on the legacy `/client/[id]` board (which renders `contentCards`). The one exception is `makePreview`, which must write the `previewPosts` slice, because `findPreviewPost` in `lib/supabaseServer.ts` is what `/p/[shareId]` resolves through. That slice has an address (`work-log/creation/review` in `PROFILE_SCOPES`), so law 1 holds, but it is a legacy slice and I am naming it rather than hiding it.

**2. A stage move does not move the shelf's counts. This is a real gap and it is tested as one.**
`work-log/creation` is `append_only`, so `putEntry` REFUSES an overwrite and a stage change can only be an `amendEntry`. `resolvePiece` (`lib/engine/resolve.ts`) folds amendments and reads `posted` correctly. `stageCounts` in `lib/shell/shelf.ts` reads `entry.data.stage` directly and does NOT fold amendments, so after a chat move the shelf still counts the piece at its birth stage. `composeTodayStrip` in the same file DOES fold amendments for a task's `done`, so the convention exists; `stageCounts` has simply not been brought to it.

The last test in my file (`KNOWN GAP: ...`) asserts what the code actually does today so this cannot surprise anyone. The fix is a one-line change in `lib/shell/shelf.ts` to fold amendments before reading `stage` — I do not own that file. **The read half's `profile_status` should count through `readPieces`/`resolvePiece`, not through `stageCounts`, or "8 posted, 4 left" will be wrong the moment the chat moves a piece.** That is the single most important line in this note.

**3. A personal task has no home, so `addTask` has no personal mode.**
PLAN §7 took the personal half out of the dashboard and `composeTodayStrip` says so in its own comment. Rather than file a personal task somewhere plausible, `addTask` requires a profile and refuses without one. If she wants personal tasks back, that is a decision, not a tool.

**4. `schedulePiece` writes no `schedule_record`.**
The date lands on the piece, which is what every reader reads (`pieceClock`, `monthCells`, the today strip). `work-log/creation/scheduling` is declared and holds `schedule_record` entries, but nothing reads them yet, so writing one would be storage nobody consumes. The scheduling SWITCH is still checked, so a profile that does not schedule gets no dates from the chat.

**5. `movePiece` does not use `canMove` from `lib/creation/piece.ts`.**
That function is typed against the legacy `ContentStage` (`writing`, `ready`), which is a different ladder from `PieceStage` (`build`, `approved`). Its rule — the lock gates moving — is the same rule `guardPath` applies through `strategyLocked`. `normalizeStage` maps `ready` → `approved` and `writing` → `build` so her words still land, without a seventh stage existing anywhere.

**6. `resolveProfile` is a second name resolver.**
The read half owns `find_profile`. Mine exists because "the name is ambiguous between two profiles" is one of my four refusal conditions and a write tool cannot wait for a separate call to know that. If the two disagree the chat will be inconsistent, so the integrator should make one of them call the other. Mine is exported and has the ambiguity test beside it.

**7. Not built, deliberately:** the tool loop, the tool schemas the model sees, the per-message write ceiling, and any route wiring. All of that is the integrator's. Nothing here knows a model exists.

**8. Not verified in a browser.** Every claim above is a unit test on plain Node. No preview has been made against real Supabase, and no `/p/<shareId>` link produced by `makePreview` has been opened.
