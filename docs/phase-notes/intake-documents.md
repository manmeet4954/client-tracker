# Spec 33 §2 — documents as the third intake route

Agent: `intake-documents`. Branch: `claude/spec-21-data-layer-6d04af`, merged from
`main` at `601820a` ("Spec 33 foundation").

---

## What I built

Three files are mine, plus two small, permitted additions to `Rounds.tsx`.

**`dashboard/lib/intake/documents.ts`** (new) — all the logic, no React.

- `addDocument(body, input)` writes an `IntakeDocument` to
  `context/intake/answers`, as an entry of type `answer` (that is what the path
  declares) carrying `record: 'document'` as its discriminator. Append only, and
  never altered afterwards.
- `readDocuments(body, round?)` reads them back, oldest first.
- `classifyDocument(input)` decides what we are willing to CLAIM about a
  document's text. This is spec 32 §4 turned into code, and it is where the
  honesty lives.
- `readDocumentText(input)` is the seam a parser drops into, plus
  `registerDocumentTextReader(kind, fn)`.
- The reporting side: `documentContext(docs)`, `documentContextHeader(docs)`,
  `documentsLine(docs)`, `extractionLine(doc)`, `sourceWords(doc)`,
  `documentsForParameter`, `documentsForRoundOnly`, `titleFor`,
  `nextDocumentId`, `behindLogin`, `hostOf`, `extensionOf`.
- Every count in every returned sentence is counted from the array it describes,
  at the moment it is asked for. Nothing is stored as a number.

**`dashboard/components/intake/Documents.tsx`** (new) — the list and the add
control, mounted on the round card.

- Lists what was handed over: title, kind, who gave it, when, an "Open" link for
  a file or link, the pasted words for text, and the state dot plus the plain
  reason whenever the words are not in hand.
- The add control is one screen, not a sequence: kind chips (a file, a link,
  some words), the one field that kind needs, a title, "Given for" (this round
  as a whole, or one question), "Who gave it" (they did, I did), Keep it, and
  Cancel. Nothing is stored until Keep it, so Cancel loses nothing. That is the
  §5 standing rule answered by not being a walk in the first place.
- Files go through the EXISTING signed upload path, `/api/upload/sign` plus a
  direct `uploadToSignedUrl` to the `assets` bucket, which is the same code
  shape `components/creation/AssetsScreen.tsx` uses. There is no second upload
  mechanism.
- No edit control anywhere on a stored document. There never will be (S11).

**`dashboard/tests/intake.documents.test.ts`** (new) — 23 tests, all passing.

**`dashboard/components/intake/Rounds.tsx`** — exactly two changes, both the
ones I was allowed:

1. A fourth button, "Open one for documents", calling `open('documents')`. The
   `open` parameter type widened from the two literals to `IntakeDelivery`.
2. `Documents` mounted inside the round card, passed down as a `documents` node
   prop on the existing `Card` component, rendered above the send row.

Nothing else in that file moved.

---

## The extraction states, and exactly what is and is not true

Written plainly because the spec asks me not to pretend.

| Input | State | Built? |
|---|---|---|
| Pasted text | `ok`, kept verbatim | Yes, real |
| A PDF, doc, deck | `not-attempted` | **No parser. Seam built, nothing installed.** |
| A picture or a scan | `unreadable`, with the reason | Yes, decided from extension and mime |
| Video or audio | `unreadable`, "belongs in assets" | Yes |
| A link behind a login | `unreadable`, with the reason | Yes, by host list plus a manual tick |
| An ordinary web link | `not-attempted` | **No server-side fetch. Not built.** |

**I did not build server-side link fetching.** An ordinary link is stored as
`not-attempted` and the row says "Nothing has read this link yet." That is the
literal truth, not a placeholder dressed as one.

**I did not add a PDF parser, and did not add any dependency.** A PDF is stored
as `not-attempted` with the line "Nothing has read this yet. A file like this
needs a reader we have not added, so only its name is known."

**The library I would use, if she says yes:** `unpdf` — pure JavaScript, no
native build step, works on Vercel's serverless runtime, and it is the one that
does not fight Next.js. `pdf-parse` is the better-known alternative but it ships
a Node-only path that has historically needed webpack config to survive a Next
build. Either way this is a dependency, so it is her decision recorded under
CLAUDE.md rule 5, and I have not made it.

**How to drop one in when she says yes.** One call, in a server route:

```ts
registerDocumentTextReader('file', async ({ url, mime, filename }) => { /* … */ });
```

After that, `readDocumentText(input)` returns `ok` with the words. Three things
it will still refuse to do, by design: it never rescues an `unreadable` verdict
(a photo stays a photo), a reader that returns nothing becomes `unreadable`
rather than `ok`, and a reader that throws becomes `not-attempted` rather than a
silent success. Tests 15 and 16 hold those.

**The rule that matters most is held by `documentContext(docs)`.** Every
document comes back from it, read or not. An unread one carries `text: null`,
its title, its source, its reason, and a `line` that begins with the title and
says "Not read: …". Nothing is filtered out for being inconvenient. Test 18
proves it with a deck and a Drive folder that nobody has read.

---

## The exact wiring the integrator must do

Six things. Two of them are real and the rest are one-liners.

**1. `lib/tree/switches.ts` — `intake.documents` is missing from `SWITCH_DOOR`.**
Spec 33 §2 says its client door is `give:intake`. The switch exists and is
declared, but the door map does not list it, so a client-audience read of that
switch resolves to no door. Add:

```ts
'intake.documents': 'give:intake',
```

I did not touch that file, as instructed.

**2. `lib/intake/rounds.ts` — `readAnswers` should skip document entries.**
Documents live at `context/intake/answers`, so `readAnswers` currently maps them
into `AnswerRecord` with `parameter_id: ''`. Nothing breaks today (test 6 proves
it: they never match a parameter, never mark a question answered, and never move
a round's status), but it is fragile. One line makes it explicit:

```ts
export function readAnswers(body: ProfileBody): AnswerRecord[] {
  return readPath(body, ANSWERS_PATH)
    .filter(e => (e.data as Record<string, unknown>).record !== 'document')
    .map(e => { /* unchanged */ });
}
```

That file is owned by the rounds agent, so I left it alone.

**3. `covers` cannot be written today, and this is a real blocker for §3.**
The spec says she sets `covers` during curation. She cannot: `context/intake/
answers` is `append_only` (a second `putEntry` on the same id throws) and it is
in `NO_AMENDMENT_PATHS` (`amendEntry` refuses by name). Both refusals are S11
working correctly — a raw answer is never altered — and superseding a document
with a covers-carrying copy would be altering it.

So `covers` has to live somewhere that is hers to write, not on the raw record.
The two options, and this is a tree decision I do not own:

- put it on the round, beside `curation`, as `document_covers: Record<docId,
  string[]>` — cheapest, and it matches where `skipped` already went; or
- give it its own declared path under `context/` fed by `owner`.

Until one of those exists, `addDocument` never sets `covers` and `readDocuments`
reads it if present. Test 8 asserts it is never guessed on the way in.

**4. Curation's left column (§3) should show documents beside answers.** Not
mine, not built. `documentsForParameter(readDocuments(body), parameterId)` gives
the ones handed over for that question, and `documentsForRoundOnly(...)` the
rest. `composeCuration` in `lib/intake/screens.ts` is where they belong, and its
`SourceLine` type needs a third `kind: 'document'`.

**5. The client's own window (§4 "Attach here").** `Documents` takes
`defaultGivenBy="client"` and `writer="client"`, so it can be mounted straight
into `ClientIntakeWindow` in `components/shell/ClientWindows.tsx`. I did not
mount it there: that file is the form-rebuild agent's, and dropping a second add
control into a screen being rewritten would collide.

**6. `tests/run.ts`** needs `import './intake.documents.test.ts';`. That file is
the integrator's.

---

## What I tested, and how

`node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e "import('./tests/intake.documents.test.ts').then(async m => process.exit(await (await import('./tests/harness.ts')).run()))"`

**23 of 23 pass.** `npm test` (the whole suite, without mine registered) is
**689 of 689**. `./node_modules/.bin/tsc --noEmit` is **clean**.

What the tests actually bite on:

- All three kinds store, read back, and stay in their own round.
- A second document with the same title gets its own id and does not overwrite
  the first, because raw material is never replaced.
- **A document attached to a question leaves that question waiting**, and leaves
  the round at `sent`. Counted through `composeRounds`, not asserted on a flag.
- No document ever appears as an answer for any parameter.
- Every extraction verdict above, including the mime-only cases where the file
  name has lost its extension.
- A login host in the path (`example.com/notion.so`) is not treated as a login
  host. A subdomain of one is.
- The seam: nothing installed means `not-attempted`; installed means `ok`; empty
  means `unreadable`; thrown means `not-attempted`.
- Every count line is checked by changing the array and reading the sentence
  again, which is the only way to catch a typed number.

**In the browser**, on a real dev server at `localhost:3007`, on the Career
Bubble profile:

- Opened a documents round. The card reads "Round 1, they hand things over".
- Added a Google Drive link. The login tick turned itself on and locked, and the
  row came back as "This link needs a login, so its words cannot be read from
  here." with the accent dot.
- Added pasted text against "Any words or phrases that make you cringe?". The
  row shows "Given for: …", the words in full, and "Read in full, exactly as it
  was pasted." The count line moved from "1 thing handed over. None of it read
  yet" to "2 things handed over. 1 read, 1 not." on its own.
- The question it was attached to was still `waiting`, and all 53 questions were
  still waiting. A document did not answer anything.
- **At 1240**: reads as designed.
- **At 392**: the list and the whole add form stack, and
  `document.documentElement.scrollWidth === clientWidth === 392`, so the page
  does not scroll sideways.

---

## What I did NOT do

- **No PDF parser and no dependency.** Named above, hers to decide.
- **No server-side link fetch.** Ordinary links are `not-attempted`, honestly.
- **No OCR.** A scan is `unreadable` and says so.
- **`covers` is not writable.** Blocker 3 above. This is the one thing in my
  slice of §2 that the current tree rules refuse, and it needs her or the
  integrator to pick where it lives.
- **Did not exercise a real file upload.** There are no Supabase credentials in
  this worktree, so `/api/upload/sign` could not be called for real. The upload
  code is the same shape `AssetsScreen` uses and typechecks, but I have not
  watched a file land in storage, and I am not going to claim I have.
- Did not touch `types/index.ts`, `lib/tree/*`, `lib/access.ts`, `tests/run.ts`,
  `contexts/AppContext.tsx`, `lib/shell/nav.ts`, or any `app/**/page.tsx`.
- Did not build §3 (curation reading documents) or §4 (the form rebuild). Those
  are the other two agents.
