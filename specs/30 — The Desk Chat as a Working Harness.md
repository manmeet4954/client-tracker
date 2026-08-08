# 30 — The Desk Chat as a Working Harness

**Status:** SPEC, 2026-08-05. Nothing built. This closes the open question the
redesign handoff left for her: *can the desk chat act, or only find?*

**Her answer, 2026-08-05, and it is the spec's premise:** both. "It should take
action on my behalf and find things on my behalf as well." A proper harness, the
way an agent works — not a form with a text box in front of it.

**Authority:** `PLAN.md` outranks this file, then `dashboard/CLAUDE.md`. This
spec adds one surface and no new storage. It is phase 6 of the restructure.

---

## 1. What she asked for, in her words

Four examples she gave, which between them define the whole job:

1. **"If I want to update a task, it updates it correctly."**
2. **"If I want to ask for an update, it gives me an update correctly for the
   particular brand."** Scoped to one profile, not a smear across all of them.
3. **"If I say I posted something today, it should be reflected. If I paste a
   link, it should create a preview and give me back a link I can share with the
   client."** And she should not be assembling that by hand every time.
4. **"How many posts have we posted so far on the page?"** answered as *"you have
   posted this much, this much is left, these are the pillars we are finalising
   for, here is where we are."*

And the standard she measured it against, which is the most important sentence
in this spec:

> "I built the finance tracker, and it is not built in a way that it collects
> information that the person is saying. It should know where to place what, and
> the calculative thing is something that matters."

That is the whole failure mode named precisely. A chat that **writes down what
you said** is a notepad. A chat that **knows where the thing belongs and can do
the arithmetic** is a working harness. This spec exists to build the second one.

---

## 2. The two laws this rests on, both already in the system

Neither is new. The point of this spec is that the chat obeys them like every
other feature, instead of being a clever exception.

**Law one — nothing is written anywhere without an address.** Every tool the
chat can call resolves to a declared path in the tree (`lib/tree/`), with its
declared writer and its switch. The chat therefore cannot invent a field, cannot
put a task somewhere tasks do not live, and cannot reach a folder this profile
has switched off. "It should know where to place what" is not a prompt
instruction: it is the type system.

**Law two — every number is computed by code; the model only words it**
(PLAN §5.2, the trust rule). "This much posted, this much left" is arithmetic
done in a function with a test beside it. The model receives the computed
answer and writes the sentence. It may never count, never estimate, never
total. "The calculative thing is something that matters" is exactly this rule,
and it is the one that makes the difference between an assistant she can trust
with a number and one she has to check.

**The consequence worth stating out loud:** the model's job shrinks to two
things — understanding what she meant, and saying the answer well. Everything
between those two is code.

---

## 3. The harness

The existing brain (`app/api/chat-brain/route.ts`, v4) already returns a LIST of
actions rather than one, which was the right shape. It stops short in three
ways: its actions are a fixed handful, it cannot read anything, and it executes
against legacy slices rather than the tree.

This spec replaces it with a **tool loop**:

```
her message
  → the model, given: the tool list, the profiles she has, and the
    recent thread
  → the model calls tools (read and write, several, in sequence)
  → each call is executed by CODE, validated, and its real result
    returned to the model
  → the model calls more tools if it needs to
  → the model writes one plain reply from what the tools actually returned
```

The loop is what makes the difference. One pass cannot answer "how many are
left" for a brand, because it has to find the brand, then read its board, then
read its cadence target, then subtract. A loop can.

**Bounded, on purpose:** a hard ceiling on tool calls per message, and a hard
ceiling on writes per message. A runaway loop on her data is not an acceptable
failure mode.

### 3.1 The read tools (find)

Each returns computed values, never raw blobs for the model to interpret.

| Tool | Answers |
|---|---|
| `find_profile` | Resolves a name she typed to one profile id. Ambiguity asks, never guesses. |
| `profile_status` | The whole "where are we" answer for ONE profile: posted this month, scheduled, in review, in build, the cadence target and what remains against it, the pillar mix against its targets, whether strategy is locked. All computed. |
| `find_pieces` | Pieces on one profile, filtered by stage, pillar, platform, format or date. |
| `find_tasks` | Tasks and agenda items, by profile and by when. |
| `find_seeds` | Seeds in the bank, with their status. |
| `across_profiles` | The desk's standing questions: what needs her today, what is stuck in review, what is unlocked, what has gone quiet. These already exist in `lib/shell/desk.ts` — the tools call them, they are not rewritten. |

### 3.2 The write tools (act)

Every one goes through the ordinary write door: path-scoped, lock-gated,
role-filtered. If the door refuses, the chat says so in her words and does not
retry a different way.

| Tool | Does |
|---|---|
| `update_task` | Renames, re-dates, completes, reassigns a task. Her example 1. |
| `add_task` | A new task on a profile, or a personal one. |
| `add_piece` | A piece on a profile's board, born with pillar, platform and format where she named them. |
| `move_piece` | Stage change, including "I posted this today" → posted, with the live link if she gave one. Her example 3, first half. |
| `schedule_piece` | Puts a date on a piece. |
| `make_preview` | The one below. Her example 3, second half. |
| `add_seed_capture` | Files raw narration as seed-capture input. It never creates a locked seed: only she locks a seed (PLAN §5.1 item 4). |
| `add_note` | An observation on a profile. |

**The refusal rule.** When a tool cannot do the thing — the profile is unlocked,
the switch is off, the piece does not exist, two profiles match the name — the
chat says which, plainly, and stops. It never half-does a thing and reports it
as done. This is the same standard as the write door: refused, named, and told
why.

### 3.3 `make_preview`, the flow she described

She pastes a link and wants a shareable client link back, without assembling it.
Decomposed, it is five decisions the harness makes instead of her:

1. Which profile. From the message, or from the piece.
2. Which piece — an existing one on the board, or a new one if she is describing
   something that is not there yet.
3. Create the preview **attached to that piece**. `PreviewPost.cardId` exists as
   of phase 2, so the preview is the review state of that piece and not a second
   copy of it.
4. Put the images on it, from the link.
5. Return `/p/<shareId>` for her to send.

**What step 4 can do, honestly:**

- **A direct image link, or images she has already uploaded: buildable now.**
- **A Canva design link: blocked, and not on us.** The Canva code is written and
  waiting (`lib/canva.ts`, `app/api/canva/connect|callback|import|status`). It
  needs a registered Canva OAuth app and three environment variables. That is a
  one-time setup on an external account, which is one of her three standing
  gates. Until she does it, this path says so plainly rather than failing oddly.
- **A link to a page that is neither: refused with a reason.** No screenshotting,
  no scraping.

---

## 4. Where it lives

The desk (level 1) and the floating chat inside a profile are **one brain, two
mouths**. On the desk it may cross profiles; inside a profile it is scoped to
that profile unless she names another. Same tools, same loop, different scope —
not two implementations that drift apart.

`components/shell/DeskChat.tsx` and `lib/shell/deskAnswers.ts` (rescued from the
killed phase 6 agent) are the desk's body and its standing answers. They stay;
this spec supplies what the body talks to.

---

## 5. What is NOT in this spec

- **Topic and seed GENERATION.** She named it as wanted and, in the same breath,
  that she knows it is complicated. It belongs to the Content Engine's spec
  family, not to the chat. The chat's part is `add_seed_capture`: it gets her
  narration into the bank correctly so the engine can work on it. Drawing the
  line here is what keeps this spec shippable.
- **Anything client-facing.** The chat is hers. It appears for no other role.
- **New storage.** Every tool reads and writes addresses that already exist.

---

## 6. Acceptance

1. **The placement test (her finance-tracker complaint, inverted).** For every
   write tool, the thing lands at its declared address, and a request that has
   no address is refused rather than filed somewhere plausible.
2. **The arithmetic test.** Every count, total and remainder in a reply is
   produced by a tested function. A test asserts the model is never asked to do
   a sum: the numbers in the payload it words are already final.
3. **The scope test.** "How is Divine doing" answers about Divine only.
4. **The refusal test.** An unlocked profile, a switched-off feature and an
   ambiguous name each produce a plain refusal, and no partial write.
5. **The one-truth test.** A preview made by the chat is attached to its piece.
   No flow creates a second copy of a piece.
6. **The loop test.** A message containing four things produces four correct
   outcomes, and a message needing three reads before one write performs them
   in order.
7. **The honesty test.** A Canva link with no OAuth app configured explains
   that, and does not silently produce an empty preview.
