# 33 — Intake by Document, and the Form That Behaves Like One

**Status:** SPEC, 2026-08-08. Two asks from her, on the live app, and they belong
together because they are both about the moment a client is handing things over.

> "It's a big form, so they give me documents and a strategy. Instead of typing
> and answering the questions, which is the only route that we have in the intake
> option, I would like to have some files saved as well that can be studied when
> needed, the same way the questions are studied."

> "There is no option to skip things, go backward, pause, or go next. How would
> you direct someone to go here and there if you are not including these things?"

**Authority:** `PLAN.md`, then `dashboard/CLAUDE.md`. No new storage: intake
rounds, questions, answers and curated parameters all already exist (spec 22).

---

## 1. First, what is actually there today

Written down plainly, because half of this spec is a fix and half is a build, and
they are not the same half.

**The client's form (`ClientIntakeWindow`) has no navigation at all.** It renders
every unanswered question as one flat list, each with its own send button. There
is no first question, no last question, no next, no back, no skip, no progress,
and nothing that says "you can stop and come back". For a long onboarding form
handed to a real client, that is not a form. **Her criticism is correct and this
is the most important thing in this spec.**

**Her curation side is not bare.** It has a progress line, a picker that jumps
between parameters, and a "Next one waiting" action. What it lacks is **Back**
and **Skip**. So: better than she said, worse than it should be.

**Intake has exactly two delivery modes:** a dashboard questionnaire and a
recorded meeting. There is no way to hand over a document, which is what
actually happens when she onboards someone.

## 2. Documents as a third intake route

**The route, not a new concept.** Plan §3.1's law stands: intake is HOW, never
WHAT. A document is another way the same answers travel. It never invents a
parameter and it never answers one by itself.

A round gains delivery mode `documents`, alongside `dashboard-questionnaire` and
`finding-session`. The three mix freely inside one round: a client can answer six
questions, skip four, and drop a brand deck that covers the rest.

**An intake document record:**

| Field | Meaning |
|---|---|
| `id`, `round` | Which round it arrived in. |
| `title`, `kind` | `file` · `link` · `text`, the same three as spec 32. |
| `url` / `text` | The material. Files use the existing signed upload path. |
| `given_by` | The client, or her filing it on their behalf. |
| `received_at` | When it arrived. |
| `extracted`, `extraction_state` | The readable text, and honestly whether there is any. Spec 32 §4 governs this and is not restated here. |
| `covers` | The parameter ids she has decided this document speaks to. **Set by her during curation, never guessed on upload.** |

Stored at `context/intake/answers/`, because that is what it is: **raw material
the client gave, which is never altered** (S11, history `append_only`). It is not
a new folder and does not need one.

**Fed by:** the client (give-point 1) and her.
**Read by:** her curation pass; the context packet, so a document that has been
read is available to the model like everything else in context.
**Switch:** `intake.documents`, audience `both`, client door `give:intake`,
suggested default active. No fifth door: this is give-point 1, which already
exists.

## 3. Curation reads a document exactly like an answer

This is the sentence in her ask that decides the design: *"the same way the
questions are studied."*

So the Curation screen's left column, "What they said, kept", shows **every
source for this parameter** — typed answers and documents together, each labelled
with where it came from. She reads, she decides, she writes the curated value on
the right, and the parameter's provenance (S11) records which source or sources
produced it, whether that was an answer, a transcript, or page four of a deck.

**A document alone never curates anything.** The engine may propose; she decides.
That is plan §5.1 item 4, unchanged.

## 4. The form, rebuilt as a form

This applies to the CLIENT's questionnaire first, because that is the one a
stranger has to get through unaided.

**One question at a time**, with:

- **Next** and **Back**. Back is not a browser button; it is on the screen.
- **Skip** — "I'll come back to this". A skipped question is not unanswered and
  not abandoned: it is a third state, visible to both of them, and the round
  cannot be marked answered while any question is only skipped.
- **Progress**, counted from the array it describes: "4 of 18". Never a
  percentage rounded from nothing.
- **Save and finish later.** Every answer is saved when it is given, not on a
  submit at the end. Closing the tab loses nothing. Reopening the link returns
  to the first thing not yet done, and says so.
- **A list view** behind one control, so she or the client can see all of it and
  jump. A long form must be walkable in order AND surveyable at a glance.
- **Attach here** on any question, so a document can be given in answer to a
  specific question rather than only to the round as a whole.

**On the last question**, not a submit button: a review screen listing what was
answered, what was skipped, and what is still blank, with "send it" as the
action. Nobody should finish a long form without seeing what they said.

**Her curation side gains Back and Skip**, matching the same three words, so the
two sides of intake behave identically. It keeps its picker and progress.

**Phone first.** One question per screen is the phone shape anyway. Next and Back
sit within thumb reach; the list view is a sheet.

## 5. The standing UI rule this exposes

Her question — "how would you direct someone to go here and there if you are not
including these things" — is a fair charge against more than intake, and it gets
written down here so no later screen ships without answering it:

**Any screen that asks a person to work through more than three of something must
offer: where am I, how do I go on, how do I go back, and how do I leave without
losing anything.** A screen that shows a sequence and provides none of those is
unfinished, whatever it looks like.

## 6. Acceptance

1. A client with no login opens the round link on a phone and can go forward,
   back, skip, see progress, close the tab, reopen it, and land where they left
   off, with nothing lost.
2. The round cannot be marked answered while a question is only skipped, and
   both sides can see which.
3. A document can be attached to the round, or to one question, by the client or
   by her.
4. A PDF with a text layer is readable in curation. A scan says so plainly and is
   never presented as read (spec 32 §4).
5. Curation shows typed answers and documents side by side as sources, and a
   curated parameter's provenance names whichever it came from.
6. Her curation side has Back and Skip, and the same three words mean the same
   three things on both sides.
7. No client sees any parameter, question or document belonging to another
   profile, in any switch position.
