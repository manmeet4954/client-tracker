# Spec 33 §4 — the client's questionnaire

What was built, what has to be wired, and what I did not do.

---

## The files I own

| File | What it is |
|---|---|
| `lib/intake/form.ts` | All the logic. A small state machine over (questions, answers, skipped). No React. |
| `components/intake/ClientForm.tsx` | The screen. It draws the machine and owns no arithmetic. |
| `tests/intake.form.test.ts` | 24 tests, plain Node, house harness style. |

One function in a file I do not own was changed: `ClientIntakeWindow` in
`components/shell/ClientWindows.tsx`, to mount the form. Nothing else in that
file was touched.

---

## What the screen does now

Before this, it rendered every unanswered question as one flat list with a send
button each: no first, no last, no next, no back, no skip, no progress, and
nothing saying you could stop and come back. Now:

- **One question per screen.** Back and Next are buttons on the screen, never
  the browser's.
- **Skip.** "I'll come back to this" writes the parameter id to
  `round.skipped`. It is a third state, visible as itself on both sides, and it
  writes no answer record — because a skip is not something they said.
- **Progress, counted.** "3 of 8" and "2 answered, 1 to come back to and 5 not
  started" are both computed from the steps array at render time. There is no
  stored total and no percentage anywhere. Plus a rail of one tick per question,
  which is also the array.
- **Save as you go.** Every answer is filed the moment it is given, through
  `fileAnswer`. There is no submit that files anything.
- **Resume.** On open, the cursor is set to the first thing not yet done (a skip
  counts as not done), and one plain line says so: "You are back at question 3
  of 8. Everything you sent before is saved."
- **List view.** One control, "All questions", opens a sheet: every question
  with its state, tap to jump. Bottom sheet on phone, centred panel on desktop.
- **Attach here.** On any question, calling `onAttach(parameterId)`. No upload
  lives in this component.
- **A last look, not a submit button.** The step after the last question lists
  what was answered, what was left to come back to, and what is still blank,
  each row tappable to jump, then "Send it".
- **Raw answers are never editable.** An answered question shows the words in a
  kept block with the line "This one is sent. It stays exactly as you wrote it."
  There is no edit control anywhere in this component.

---

## The wiring the integrator has to do

### 1. Register the tests (30 seconds)

`tests/run.ts` is yours. Add, next to the other spec 33 lines:

```ts
import './intake.form.test.ts';
```

### 2. The client's skip needs a server route — this is the real gap

`round.skipped` lives on the round object at `context/intake`, which is
`fed_by: ['owner']`. That is deliberate and it is pinned by an existing test
(`tests/intake.test.ts:317`, `ok(!clientMayWrite('context/intake'), ...)`). So:

- **From her own session the skip works today.** `writeSkipped(body, roundId,
  ids, now)` writes with the owner writer and the wiring in
  `ClientIntakeWindow` already calls it.
- **From a real client session the tree refuses it**, because passing
  `writer: 'client'` throws at `putEntry`. I wrapped the call in a try/catch so
  the form keeps walking and the client sees one plain line instead of a crash:
  "That one could not be marked to come back to just yet. Everything you have
  answered is still saved."

**Do not fix this by adding `'client'` to `fed_by` of `context/intake`.** That
would break S19 and the test above. The right fix is a route — the client
*asks*, the server *applies it as the owner*:

```
app/api/intake/skip  POST { profileId, roundId, parameterId, on }
  → authorise the caller against the profile (lib/access.ts, as everywhere else)
  → body = writeSkipped(body, roundId, applySkip(current, parameterId, on), now)
  → save with paths: ['context/intake']   (path-scoped write, spec 21)
```

Both functions are exported from `lib/intake/form.ts` and are already tested.
Until that route exists, **acceptance test 1 holds for answers but not for a
client's skip**: an answer survives closing the tab, a client's skip does not.
I am saying that plainly rather than claiming the acceptance passes.

### 3. Documents (another agent owns storage)

`ClientForm` takes two optional props that `ClientIntakeWindow` does not pass
yet, because the storage is not mine:

- `onAttach?: (parameterId: string) => void` — the "Attach something here"
  button. When it is not passed, the button is not rendered at all. Wire it to
  whatever opens the document give-point, carrying the parameter id so the
  document is stored with `answers_parameter` set.
- `documents?: Pick<IntakeDocument, 'answers_parameter'>[]` — used only to count
  "2 so far" on a question. Pass the round's documents when the reader exists.

### 4. Her side (spec 33 §4's last paragraph)

Her curation screen also needs Back and Skip. That is a different screen and a
different agent. `stateLine`, `onlySkipped` and `roundCanBeAnswered` in
`lib/intake/form.ts` are there so both sides use the same three words for the
same three things.

---

## What I tested

`node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e "import('./tests/intake.form.test.ts').then(async m => process.exit(await (await import('./tests/harness.ts')).run()))"`
→ **24/24 passed.** `./node_modules/.bin/tsc --noEmit` → **clean.**

The tests that are worth reading:

- Counts change **because the array changed** — the only way to catch a
  hardcoded number. Same assertion for the position line, the progress line and
  the send line.
- A skip writes no answer record, and `computeStatus` is asserted to still say
  `sent` while something is only skipped, then `answered` once they come back to
  it. **The rule holds by construction**, not by a second check that could drift:
  a round reaches `answered` only when every parameter has an answer, and a skip
  deliberately writes none.
- The round object refuses a client writer (the `throws` above is what proves
  the gap in §2 is real).
- A raw answer keeps its exact whitespace, and a second write over the same
  answer throws.
- Another round's answers do not reach this round's form.

**Looked at, not just typechecked.** I rendered the component to static markup
against a real fixture body and viewed it at 392 and at 1240: no horizontal
scroll at 392 (`scrollWidth === innerWidth === 392`), the column centres at 1240
(672px wide, 284px each side), the progress line drops to its own row on phone
instead of truncating, and Back / Next / "I'll come back to this" all sit within
thumb reach. That harness was a throwaway and is not committed.

---

## What I did NOT do

- **No upload.** `onAttach` asks; it does not store.
- **No API route for the client's skip.** Named above, not built: routes are
  outside my file ownership.
- **The list sheet was not screenshotted.** It is state that a static render
  cannot open. Its markup is the same row component as the review list, which
  was checked.
- **`computeStatus` was not edited.** It did not need to be, and `status.ts` is
  not mine.
- **Her curation side was not touched.**
- **The round the client sees is chosen exactly as before** — the latest round
  that is not curated — so nothing that is open on the live app closes because
  the form gained a navigation bar. Note that this includes a round she has
  written but not sent; that was true before this spec too, and changing it is a
  decision, not a cleanup.
- **No test was run against her live data.** Everything here is fixtures.
