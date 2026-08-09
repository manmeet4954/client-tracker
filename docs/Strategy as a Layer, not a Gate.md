# Strategy as a layer, not a gate

**Design, 2026-08-09. Her decision, written up for her to correct before anything
is built.**

Her words, and they are the whole brief:

> "These accounts already exist. They were working. Strategy is the initial
> thing, the fertilizer thing that we need from the client. It just keeps the
> information within it that helps us make better content or understand the
> brand better. Don't make it hard rules. Why are you hard blocking this?"

---

## What is wrong today

The product treats strategy as a ceremony with a door at the end: fourteen
decisions, five gates, seventy-eight switches, then a lock. Before the lock,
nothing in Creation can be written.

Two things follow, and both are happening to her right now.

1. **Seven of nine profiles never got through the ceremony**, so seven of nine
   profiles refuse to record the work that is actually going on in them.
2. **The ceremony is all-or-nothing.** A profile where she knows the audience,
   the pillars and the voice, but has not settled the goals, is treated exactly
   like a profile she knows nothing about.

The mistake underneath is that the lock conflates *deciding what to make* with
*writing down what happened*. Only the first needs a strategy.

## The replacement

**Strategy stops being a state. It becomes a set of facts about a brand, and it
is always partial.**

Nothing asks "is this profile locked". Each capability asks for the one or two
facts it actually needs, and turns on when they are there. Nothing is blocked
wholesale.

### The facts

A starting set, drawn from what the app already stores. **The naming and the
grouping here are hers, not the spec's — this is a proposal to correct, not a
vocabulary to accept.** The last time a parameter list was written without her,
it produced sixty-six questions she never chose, and that is the thing this
design exists to undo.

| Fact | Plain question | Where it already lives |
|---|---|---|
| Positioning | What do they do, and for whom | `brand` |
| Audience | Who are they talking to | `brand` |
| Voice | What do they sound like | `brand`, brand voice pages |
| Pillars | What do they talk about | `pillars` |
| Channels | Where do they post | `platforms`, `instagram` |
| Cadence | How often | `postTarget` |
| Goals | What would success look like | `goals` |
| Look | Colours, type, treatment | `brandKit` |

Each one is filled independently, in any order, by whoever knows it.

### What needs what

| Capability | Needs |
|---|---|
| Record a card, move it, date it, mark it posted, paste the live link | **nothing** |
| Assets, references, notes, tasks, logs | **nothing** |
| Send a client preview | **nothing** |
| Tag a card to a pillar | Pillars |
| Analysis that DESCRIBES: how much went out, when, in what format | **nothing** |
| Analysis that JUDGES: mix against target, pace against cadence | Pillars, Cadence |
| Analysis against goals | Goals |
| Generate a draft | Voice, Audience, Pillars |
| Resolve a costume, run the gates | Pillars, and the gate set |

So an empty profile is still a completely usable notebook. A half-known profile
starts having opinions. A fully known profile does everything.

### What she sees instead of a lock

A line that reads like progress rather than a refusal:

> Divine Studio. Three of eight known.
> Drafting needs Voice and Audience.

It names the next useful thing rather than the missing ceremony. Filling one fact
visibly turns something on, which is the opposite of the current experience.

`strategy_version` survives, but it stops meaning "permission to work". It means
"she has read this through and settled it", which is worth recording and worth
showing, and gates nothing.

---

## Intake, which is the same thing

Her law from the beginning was **intake is HOW, never WHAT**. The build inverted
it and made a questionnaire the only way a fact could arrive.

In this model intake is one input among several into the same set of facts.

1. **She can type any fact herself, at any time.** For a client of a year, she
   already knows the answer. There is no reason to ask a form to ask the client
   to tell her what she already knows.
2. **A questionnaire is generated from the gaps.** She picks which gaps to ask
   about, edits the wording, and sends it. It never asks fifty-three questions,
   and never asks for something already known.
3. **An answer arrives attached to the fact it was asked for.** Curating stays
   what it is: turning their raw words into the fact the system uses. Raw answers
   stay permanent and uneditable.
4. **A fact learned on a call is the same as a fact answered in a form.** Both
   land in the same place, both record where they came from.

This is also what kills "nothing is asked twice", properly: there is one place a
fact lives, so a question can be checked against it before it is ever sent.

---

## What this does not change

- Role filtering, path scoping and the write door stay exactly as they are.
- Generation stays gated. A draft written without a voice is a draft about
  nobody, and the refusal there is correct.
- The client never sees the workshop.
- Raw intake answers stay permanent.
- ResumeGuru, the one profile that went through the old ceremony, keeps working
  with nothing to redo.

## Open, and hers to answer

1. **The fact list above is a proposal.** Which of these are real to her, what is
   missing, what is named wrong. This should be a conversation, not a spec.
2. Does "settled" (the old lock) still deserve to exist as a thing she can mark,
   now that it grants nothing?
3. Analysis that describes versus analysis that judges: does she want the
   describing half switched on for every profile immediately, including the seven
   that have no strategy yet?
