# 34 — The Strategy Room

**Status:** SPEC, 2026-08-08. Her verdict on the live Strategy corner: "This
whole strategy thing needs to be restructured." Full-screen approved by her the
same day.

**Authority:** `PLAN.md`, then `dashboard/CLAUDE.md`. No new storage, no new
parameters. Everything here already exists in the data; this is about what she
is asked to do with it.

---

## 1. The one diagnosis

**The Strategy corner renders the data model instead of the work.**

Every screen shows what the SYSTEM needs to be satisfied rather than what SHE
needs to decide:

- "0 of 7 sources ready" is a count of curated intake records. It is true, and
  it is not a thing a person wants to know.
- The Lock screen prints fourteen identical sentences: "it has no decision yet,
  and no explicit not applicable with a reason".
- The Switches screen shows `intake.questionnaire` and "This is only a
  suggestion. It does not count until you pick it."
- Every one of the fourteen parameters gets the SAME form: two free text boxes,
  "What are we doing here" and "Why, in one line", with the reason required.

That last one is the worst. **Platforms is a choice from a list**, and it was
built as an essay question. So are pillars, goals, CTAs, boundaries.

Her test, and it is the right one: *if the screen needs a paragraph explaining
itself, the screen is wrong.*

## 2. Full screen

Strategy stops being a 470px drawer sliding over the work. It becomes a screen:
its sections down the left, the work in the middle. Seven tabs crammed into a
narrow overlay is most of why it feels cramped.

The route `/profile/[id]/strategy/[panel]` already exists and does not change.
Leaving Strategy returns to where she was, as now.

It stays owner-only, always, in every switch position.

## 3. Decide — each parameter gets the input its answer actually is

The fourteen are not fourteen of the same thing. The input follows the answer:

| Parameter | Input |
|---|---|
| Positioning | Prose. It genuinely is prose. |
| Platforms | **Pick from a list**, multi-select. Each picked platform opens its formats to tick. Nothing typed. |
| Pillars | **A set builder.** Three to five, each a name, a job (reach / trust / convert), and a share of the mix. The shares are shown adding up, and say so when they do not. |
| Voice | **Word chips**, two groups: sounds like, never says. |
| Audience, decided | Prose, plus the stage picker (unaware to existing customer). |
| Goals | **Pick the goal, its number, and how it is measured.** The measurement is not optional: analysis stays blocked on a goal without one (S16), and the screen should say that where she can see it, not in a spec. |
| Funnel shape | Prose. |
| CTAs | Chips. |
| Visual branding | **Not a text box.** It is Brand kit. The row opens Brand kit. |
| Proof library | A list of items, each a line and a link. |
| Boundaries | Chips, three groups: never claim, never promise, not for. |
| Cadence | **A number**, per week or per month. |
| Working mode | **Two picks:** do they bring ideas or does she lead, and do we post or do they. |
| Obligations | Two lists: theirs, ours. |

**The forced reason line dies on anything that is a pick.** A required "why, in
one line" beside a tick box is the interface asking her to justify herself to a
form. It stays only where the choice is genuinely arguable: positioning,
audience, funnel shape, working mode.

**The row stops saying "0 of 7 sources ready".** It says decided or not yet, and
when decided, it shows the decision. What they told her appears INSIDE, when the
row is open, under "what they said" — which is where a source is actually
useful.

## 4. Lock — one screen that says one thing

Replace the fourteen identical sentences with:

- **What locking does, in two lines, at the top.** It opens Creation for
  writing, and it freezes the version of the strategy that every piece made from
  here on will be judged against. Neither of those is currently stated anywhere,
  which is why she asked what the deep idea of it is.
- **Only what is missing**, named in her words, each one tappable to go and do
  it. Nothing decided is listed at all.
- The action, and what it will change, in plain words.
- Unlocking is possible and says what it costs.

## 5. Switches — she never sees an id

- No `intake.questionnaire` anywhere on screen. Plain names.
- Grouped by the question they answer: **what this client gets**, **what we do
  for them**, **what they can see**.
- Only what differs from the sensible default is open. The rest folds behind
  "everything else is as it should be", with a count.
- "This is only a suggestion. It does not count until you pick it" is deleted.
  A suggestion she has not touched simply behaves as the suggestion. The
  distinction stays in the DATA, where it matters for the migration, and leaves
  the screen, where it only ever confused.

## 6. Channels — say what it is for

It is where this brand posts, and where the numbers come from. Connecting an
account is what makes Analysis work at all, and the screen never says so.

- One line at the top saying exactly that.
- Each channel: the account, whether it is connected, and what connecting gets
  her.
- Not connected is not an error. It says what is unavailable while it stays that
  way, in one line.

## 7. Gates — the five checks, written out

Show the actual sentences a piece will be checked against, derived from voice
and positioning, not the word "gate" and a dot. Two of the seven never vary
(accuracy, format) and are shown as fixed.

## 8. Brand kit

She says it is fine. The content does not change. The layout gets the same
treatment as everything else on the screen.

## 9. Acceptance

1. No screen in Strategy displays a switch id, a path, or a count of sources.
2. Platforms, pillars, goals, cadence, voice, CTAs and boundaries are each
   completed WITHOUT typing prose.
3. A parameter that is a pick has no required reason field.
4. The Lock screen lists only what is missing, and says what locking does before
   asking her to do it.
5. Every count on every Strategy screen is counted from the array it describes.
6. Strategy is unreachable for every non-owner role in every switch position.
7. Nothing in this spec changes what is stored: a strategy decided through the
   new inputs is the same record a typed one made.
