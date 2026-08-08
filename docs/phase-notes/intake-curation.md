# Spec 33 — the Curation screen

Agent: `intake-curation`. Spec 33 §3, and the second half of §4 (Back and Skip
on her side).

Files owned and touched:

- `dashboard/lib/intake/curationNav.ts` — new. All the logic, no React.
- `dashboard/components/intake/Curation.tsx` — edited. An addition, not a rewrite.
- `dashboard/tests/intake.curation.test.ts` — new. 30 tests.

Nothing else was changed. `lib/intake/curate.ts` is untouched and needs no
change. `lib/intake/screens.ts` is untouched.

---

## What was built

### 1. Curation reads documents beside typed answers

`composeSources(body, parameterId)` returns ONE list of sources, not a list of
answers with a documents box under it. Each source carries `from` (where it
came from, in words), `text`, `meta`, `readable`, `note`, and the literal
`editable: false`. A document, a typed answer and a refusal are all the same
shape, which is what "studied the same way the questions are studied" asks for.

Documents are read from `context/intake/answers`, where the upload agent stores
them. That folder declares exactly one entry type (`answer`), so a document is
told apart from an answer by its RECORD SHAPE, not by a second path:
`isDocumentRecord` is true when the data carries `extraction_state`, or carries
a `kind` of `file`/`link`/`text` with a `title`. A typed answer's `kind` is only
ever `answer` or `skipped`, so the two can never be confused.

The screen shows:

- **sources** — answers, refusals, and the documents she has already said speak
  to this parameter.
- **offered** — everything else handed over, listed with no control on it. A
  document never curates anything by itself; it sits here until she names it.

She names it by picking it as a source on the RIGHT, in the write panel, which
keeps the raw column free of anything that could read as editing (S11).

### 2. `covers` — how her decision is actually recorded

**This is the one design decision worth reading.** `context/intake/answers` is
declared `history: 'append_only'` and is in `NO_AMENDMENT_PATHS`, so a document
record can never be edited after it arrives: `putEntry` refuses a second write
on the same id, and `amendEntry` refuses that path outright. There is therefore
no way to write `covers` back onto the record at curation time, and I did not
add one.

So coverage is DERIVED. When she curates a parameter from a document, the
provenance records `document:<id>` in `source_refs`. `documentCoverage(body)`
reads every curated parameter's provenance and returns which documents cover
which parameters. `readDocuments(body)` merges three things into `covers`:
whatever was stored on the record at upload, whatever `answers_parameter` says
(a document attached to one question), and what her curation derived.

The effect is exactly what §2 asks for — set by her during curation, never
guessed on upload — and it costs no second write to an append-only folder. If
she ever wants `covers` materialised on the record, that has to happen at
creation time by the upload agent, or the declaration's `history` has to change,
which is a spec-level decision and not mine.

The ref format is `document:<entry id>`. It cannot collide with an answer id
(those are `a<round>-<parameter>-<by>`) and it does not start with
`owner-direct:`, so `ownerDirectOnly` and §7.4's "from your own note" flag stay
truthful.

### 3. Provenance names a document as plainly as an answer

`screens.ts` resolves answer refs and her own notes; it does not know about
documents, so a document ref lands there as `missing`. `resolveSources` and
`provenanceLine` in `curationNav.ts` put the name back on it without touching
that shared file. The screen now renders `provenanceLine(...)` instead of
`panel.provenanceLine`, and it reads "Curated by owner on 2 Aug. From 1 answer
and 1 document. They said it plainly."

### 4. Spec 32 §4 honesty

A document is never presented as read. `readable` is false unless
`extraction_state === 'ok'` or it is pasted text with text in it. When false the
`text` is empty (never invented) and `note` says why, in her words: a scan says
"There is no text layer in this one, so nothing in it has been read. Open it
yourself." A link that could not be fetched says it cannot be opened from here.
`not-attempted` and `none` say their own different things.

She can still curate from an unreadable document — she opens it and reads it
with her own eyes — and provenance records that honestly while the system still
never claims to have read it.

### 5. Back and Skip

Same three words as the client's form. `Next` walks forward one in queue order.
`Back` walks back one. `Skip` sets the current one aside and moves her to the
next one she has NOT set aside (wrapping if need be, so she never dead-ends).

- Where am I: `3 of 6`, counted from the queue at render time.
- How do I go on / back: two buttons, disabled honestly at the ends.
- How do I leave: "Everything you write is saved when you write it. You can
  close this and come back." A curated value is written on the write action, so
  this is true.
- Set aside: listed as chips under the nav with "2 set aside to come back to."
  Clicking one goes back to it. Writing a value clears its mark.

Kept exactly as they were: the progress line ("4 of 18 written."), the picker
that jumps, and "Next one waiting". `Next` and `Next one waiting` are different
on purpose — one walks, one jumps to the next unwritten one.

Every count in every sentence is counted from the array it describes. Tests 4,
19, 21 and 29 prove that by changing the array and reading the sentence again.

---

## Wiring the integrator must do

1. **Nothing is required for the screen to compile or render.** `Curation.tsx`
   keeps its existing props (`clientId`, `body`, `ownerProfile`) and
   `IntakeApp.tsx` needs no change.

2. **Register the test file.** `tests/run.ts` is shared and I did not touch it.
   Add:
   ```ts
   import './intake.curation.test.ts';
   ```
   alongside the other intake imports.

3. **Tell the upload agent the ref format.** Anything that later wants to know
   which documents produced which parameters must use
   `documentCoverage(body)` / `readDocuments(body)` from
   `lib/intake/curationNav.ts`, not a stored `covers` field. The context-packet
   builder in particular should read documents through `readDocuments` so it
   inherits the `extraction_state` honesty rather than re-deriving it.

4. **One thing to watch in `lib/intake/rounds.ts` (not mine to change).**
   `readAnswers` maps EVERY entry at `context/intake/answers` into an
   `AnswerRecord`, so a document record comes back as an answer with
   `parameter_id: ''` and `value: ''`. Today this is harmless — every consumer
   filters by a real `parameter_id`, and `''` matches none of them, so no
   document leaks into a left column or a status computation (test 30 pins
   this). It is still a trap for the next person. The one-line fix, when
   whoever owns that file is next in it:
   ```ts
   .filter(e => !isDocumentRecord(e.data as Record<string, unknown>))
   ```
   I did not make the change because `rounds.ts` is shared with the other two
   agents this round.

5. **Skips on her side are session state, deliberately.** `IntakeRound.skipped`
   is the ANSWERER's third state. Her curation-side "set aside" is a different
   thing and lives in React state, because nothing is written or lost by it and
   persisting it would need a write to the round object in `rounds.ts`. Every
   nav function takes `skipped: string[]` as an argument, so if she later wants
   it remembered across sessions the only change is where that array is stored.

---

## What I tested

`dashboard/tests/intake.curation.test.ts`, 30 tests, all passing:

```
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e \
  "import('./tests/intake.curation.test.ts').then(async m => \
   process.exit(await (await import('./tests/harness.ts')).run()))"
→ 30/30 passed
```

They cover: document-vs-answer shape detection both ways; documents read back
out of the answers folder; the one labelled source list; counted sentences
proved by changing the array; the empty and refusal cases; `editable: false` on
every raw source; offered-not-source until she names it; coverage derived from
her curation and nothing guessed on upload; the ref format; provenance naming a
document, naming both, and admitting a ref it cannot find; unreadable file,
unreadable link, not-attempted, none, and pasted text; curating from an
unreadable document without claiming to have read it; where/back/next/skip
including the wrap, the single-item case and the unskip; where the screen opens;
and all of it again over a real `ProfileBody` with a real queue.

`./node_modules/.bin/tsc --noEmit` — clean.

**Layout, verified in a browser at 1240 and at 392**, by compiling the real
Tailwind config against a static page carrying the component's exact markup and
class strings (the worktree has no `.env.local`, so the live app cannot reach a
database and the real screen could not be rendered against real data):

- 1240: two columns side by side; nav row is Back · "3 of 6" · Skip · Next.
- 392: columns stack; the three buttons stay on one row full width with the
  position line wrapping under them; `document.documentElement.scrollWidth ===
  392`, so nothing overflows sideways; no source chip clips its label.

---

## What I did NOT do

- **I did not render the real screen against real data.** No `.env.local` exists
  in this worktree, so the app cannot load a profile. The layout check above is
  markup-accurate but it is a static copy, not the component running. Someone
  with the real app should open Intake → Curation on a profile that has a
  document and confirm it once.
- **I did not build document upload, storage, extraction, or the client's
  attach-here control.** Those belong to the other two agents. This screen reads
  whatever they write and will show nothing if nothing is written.
- **I did not change `lib/intake/curate.ts`.** It needed no change: it already
  accepts arbitrary `source_refs` and already refuses a value without one.
- **I did not change `lib/intake/screens.ts`.** `composeCuration` is still used
  for the parameter, the current reading, the superseded readings and the feeds
  line. Only the left column's source list and the provenance line are now
  computed in my file. `panel.raw` and `panel.rawLine` are no longer rendered by
  this screen — they are correct, but they count answers only, and the left
  column now also holds documents.
- **I did not pin the nav bar within thumb reach on phone.** It sits in flow
  under the picker, where "where am I" belongs. A sticky bottom bar on phone
  would be a better phone shape and is a small change, but it overlays content
  and is more than "add Back and Skip", so it is hers to ask for.
- **I did not persist her set-aside list.** See wiring item 5.
- **I did not register the test in `tests/run.ts`.** See wiring item 2.
