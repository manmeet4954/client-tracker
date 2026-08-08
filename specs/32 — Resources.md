# 32 — Resources

**Status:** SPEC, 2026-08-08. Her ask, from the live app: "I want to keep a place
where I can add all the deliverables that I am timely receiving from the people.
Add one category around strategy. These resources should be read properly by the
API and should also be used whenever needed, like something someone shared. A
shared material can include links, PDFs, or texts."

**Authority:** `PLAN.md`, then `dashboard/CLAUDE.md`. This spec adds one folder,
declaring its feeds, readers and switch at birth (PLAN law 4).

---

## 1. What this is, and what it is not

**It is:** the place where material other people hand her lands, per profile,
so that it is kept, findable, and **available to the model as context** the next
time anything is written or judged for that profile.

The three kinds she named, and they are the whole list:

- **A link** — a doc, a deck, a shared folder, a post.
- **A file** — a PDF, and by extension the other documents that arrive as files.
- **Text** — something pasted straight in. A brief in a message, a paragraph of
  positioning, a list of dates.

**It is not** any of the four things that already exist and would otherwise
swallow it. This distinction is the spec's real work, because getting it wrong
would create a fifth place content lives:

| Existing home | What lives there | Why a resource is not that |
|---|---|---|
| `work-log/assets/sets/` | Photos and video FROM the client, to make posts out of | A resource is read, not published |
| `work-log/references/` | Things that show what we want it to LOOK like | A resource is information, not taste |
| `content-strategy/proof-library/` | Real results and quotes a claim can lean on | A resource may contain proof, but is not itself a claim |
| `context/intake/answers/` | What a client said when we ASKED | A resource arrives unasked, whenever they send it |

**The one-line test:** if it arrived because someone sent it and its value is
that it can be READ, it is a resource.

## 2. Where it lives

`context/content-strategy/resources/` — a new folder inside the frozen spine,
so law 1 is intact.

**Why under strategy and not in the work log.** She said "around strategy", and
the reason it belongs there survives the test: a resource is CONTEXT. It informs
what the brand is and how it speaks, which is the decision layer's job. The work
log is what we do day to day; a brand book somebody emailed is not a day's work,
it is a thing that shapes every day after it.

It presents as a panel in the **Strategy corner**, beside Brand kit and Channels.

**Declared at birth (law 4):**

- **Fed by:** her. Only her. A client's material still arrives through the four
  doors and she files it here if it belongs here. No fifth door (S19).
- **Read by:** the context bundle handed to the model on every request (S12);
  the Content Engine when drafting; the desk chat when answering; her.
- **Switch:** `strategy.resources`, audience `owner`, suggested default active.
- **History:** `append_only` for the material itself, and
  `mutable_with_supersession` for its title and notes. Something someone sent is
  not ours to edit: the record of what arrived stays as it arrived.
- **Audience:** `owner`. No `client_door`, so no client ever reads this folder.

## 3. The resource record

| Field | Meaning |
|---|---|
| `id` | The entry's own id. |
| `kind` | `link` · `file` · `text`. |
| `title` | What she calls it. Required, because a list of untitled PDFs is not findable. |
| `source` | Who sent it, in her words. Free text: a person, a company, "the client". |
| `received_at` | When it arrived. Defaults to today, editable, because things get filed late. |
| `url` | For `link`, and for `file` the stored URL of the upload. |
| `text` | For `text`, her paste, verbatim. |
| `extracted` | The readable text pulled out of a file or a page, when it could be. Null when it could not. See §4. |
| `extraction_state` | `none` · `ok` · `unreadable` · `not_attempted`. The honest field. |
| `note` | Her own line about what it is for. |
| `tags` | Free words, born through use, the way Observations topics already work. |

## 4. "Read properly by the API" — what that means, honestly

This is the half of her ask that has real limits, so they are written here rather
than discovered later.

**Works, and is the point:**

- **Text she pastes** is already text. Nothing to do.
- **A PDF with a text layer** — most briefs, decks exported to PDF, contracts,
  brand books — extracts cleanly. This needs one dependency for parsing, which
  is a decision to record under CLAUDE.md rule 5 (a library, not a second
  storage pattern, so the rule permits it with the decision written down).
- **A link to an ordinary web page** can have its readable text fetched
  server-side.

**Does not work, and the record says so rather than pretending:**

- **A scanned PDF or a photograph of a document** has no text layer. It stores
  fine and is downloadable, but `extraction_state` is `unreadable` and no model
  will ever see its contents. OCR is a separate build and is not in this spec.
- **A link behind a login** (a private Drive folder, a Notion page, a Canva
  design) cannot be fetched. It stores as a link she can open. Same honest state.
- **Video and audio** are out of scope entirely. They belong in assets.

**The rule that follows:** a resource whose text could not be read is never
silently dropped from the context bundle as if it did not exist. It appears in
the bundle by title, source and her note, marked as not readable, so the model
knows the thing exists and can say so instead of answering as though it had read
it. That is the honesty rule (PLAN §5.2) applied to reading rather than to
numbers.

## 5. How it reaches the model

Resources join the **context packet** (S12), which is the assembled, versioned
bundle handed to the model with every request. They are not injected ad hoc by
whoever remembers to.

Two limits, because a context packet has a size and a brand book does not:

1. Each resource contributes a bounded extract, longest-relevant-first, never
   the whole document.
2. The packet records **which resources it carried and at what version**, so an
   output can be traced back to what it had read. That is S12's existing
   requirement, extended to cover this folder.

The desk chat reaches them through a `find_resources` read tool (spec 30 §3.1's
pattern) rather than by having them stuffed into every prompt.

## 6. The screen

A panel in the Strategy corner: **Resources**.

- One list, newest first, grouped by nothing. Each row: kind icon, title,
  source, date, and a small state dot when its text could not be read.
- Adding is one control offering the three kinds. A link is a paste. A file uses
  the existing signed upload path (`app/api/upload/sign`), the same one Assets
  uses; no second upload mechanism. Text is a box.
- Tapping a row opens what we have: the extract when there is one, the file to
  download, or the link to open.
- A resource can be removed. Removing keeps the record at state `history` per S9;
  nothing she was sent disappears from the log of what arrived.

## 7. What this deliberately does not do

- **No auto-filing.** Nothing arrives here without her putting it here. The chat
  may offer to file something; it does not decide.
- **No client-facing surface.** Ever. This is her reading pile.
- **No summarising on arrival.** Extraction is mechanical. Any opinion about a
  resource is the engine's job, at the moment it is used.

## 8. Acceptance

1. All three kinds add, list and open, on desktop and phone.
2. A PDF with a text layer extracts and the extract is visible on the row.
3. A scanned PDF stores, opens, and reports `unreadable` in plain words. It is
   never presented as read.
4. An unreadable resource still appears in the context packet by title, source
   and note, marked as not read.
5. A resource is reachable by the desk chat through a read tool, and answering
   from one names it.
6. Nothing in this folder is visible to any client role, in any switch position.
7. Removing a resource keeps its record; the log of what arrived is complete.
