# Access matrix — what is allowed at each strategy state

**Her brief, 2026-08-09.** Requested before implementation. This document is the
thing to argue with; nothing is built from it until she has.

## The four states, which are now independent

They were tangled into one. Separating them is most of the fix.

| State | Values | What it is | What it may gate |
|---|---|---|---|
| `migration_status` | `not_migrated` · `migrated` | Has this profile been moved into the addressed structure | Nothing she can see. An internal fact |
| `strategy_status` | `empty` · `draft` · `ready` · `locked` | How much is understood about the brand | Generation quality warnings. Judging in Analysis. **Never recording** |
| `creation_permissions` | from ROLE and LIFECYCLE only | May this person write here at all | Everything, correctly. An archived profile reads only; a client role writes only what it is granted |
| `channel_connection_status` | per channel: `connected` · `not_connected` · `hidden` | Are numbers actually arriving | What Analysis may claim was measured. **Nothing else** |

The rule that follows: **`strategy_status` and `channel_connection_status` never
touch `creation_permissions`.** Only role and lifecycle do.

### The four strategy states

| State | Means |
|---|---|
| `empty` | Nothing recorded yet |
| `draft` | Something recorded, the minimum is not complete |
| `ready` | The minimum is complete: positioning, audience, voice, active platforms |
| `locked` | She has read it through and settled it. Versioned from here |

**The minimum is four things and nothing else**: positioning, audience, voice,
active platforms. Everything else fills in progressively and is only ever
required by the one specific action that genuinely cannot work without it.

### The legacy baseline

Any profile that arrived by migration and already holds creation work starts at
`draft`, not `empty`, with a recorded note that its content predates strategy.
Its existing work is editable from the first second. Nothing about a profile's
history is treated as provisional because a document was never written.

---

## Operation by operation

`YES` = allowed, silently. `WARN` = allowed, with one plain line naming exactly
what is missing. `NO` = refused, with the reason.

### Capture and management — always available, at every state

| Operation | empty | draft | ready | locked |
|---|---|---|---|---|
| Create a card | YES | YES | YES | YES |
| Edit a card's fields | YES | YES | YES | YES |
| Move a card between stages | YES | YES | YES | YES |
| Set a date | YES | YES | YES | YES |
| Set an owner | YES | YES | YES | YES |
| Record posted, with date and live URL | YES | YES | YES | YES |
| Read and search existing work | YES | YES | YES | YES |
| Attach an existing preview | YES | YES | YES | YES |
| Create a preview from links or Canva | YES | YES | YES | YES |
| Add a task | YES | YES | YES | YES |
| Add an observation or note | YES | YES | YES | YES |
| Add a reference, link, document or asset | YES | YES | YES | YES |
| Duplicate, archive or delete a card | YES | YES | YES | YES |

Not one of these depends on knowing anything about the brand. This whole block is
bookkeeping about work that already happened.

### Things that reference strategy content

| Operation | empty | draft | ready | locked |
|---|---|---|---|---|
| Tag a card to a pillar | NO: no pillars exist yet | YES if pillars exist | YES | YES |
| Set a card's format or platform | YES | YES | YES | YES |
| Judge a card against its pillar's job | WARN | WARN | YES | YES |

"No pillars exist yet" is not the lock refusing. It is an empty list. The control
offers to add one.

### Generation and approval — warn, never block

| Operation | empty | draft | ready | locked |
|---|---|---|---|---|
| Generate a draft | WARN: names which of the four are missing | WARN | YES | YES |
| Generate a brief | WARN | WARN | YES | YES |
| Extract seeds from a thought | YES | YES | YES | YES |
| Resolve a costume | WARN | WARN | YES | YES |
| Run brand checks on a piece | WARN: checks are incomplete | WARN | YES | YES |
| Approve a piece | WARN if checks incomplete | WARN | YES | YES |
| Send a preview to a client | YES | YES | YES | YES |

**The honest tension, flagged rather than buried.** A draft generated with no
voice and no audience will read generic, which is the exact failure she complains
about most. Blocking it is the thing she has rejected, so it stays allowed and the
warning names precisely what is missing and what the output will therefore lack.
If she would rather it refused at `empty` only, that is a one-line change and it
is hers to make.

### Analysis

| Operation | empty | draft | ready | locked |
|---|---|---|---|---|
| Count what went out, when, in what format | YES | YES | YES | YES |
| Compare pieces against each other | YES | YES | YES | YES |
| Judge mix against pillar targets | NO: no targets exist | YES if targets exist | YES | YES |
| Judge pace against cadence | NO: no cadence set | YES if set | YES | YES |
| Judge against goals | NO: no goals set | YES if set | YES | YES |
| Claim a number was measured | Only where `channel_connection_status` is `connected`, at every strategy state |

The last row is a separate guarantee and it is absolute. A disconnected channel
reports "not collecting since <date>", never a zero and never a dip, whatever the
strategy state says.

### Strategy itself

| Operation | empty | draft | ready | locked |
|---|---|---|---|---|
| Fill in any strategy fact | YES | YES | YES | YES, and it versions |
| Send or create a questionnaire | YES | YES | YES | YES |
| Mark as settled (lock) | NO: minimum incomplete | NO: minimum incomplete | YES | already |
| Reopen a settled strategy | n/a | n/a | n/a | YES, dated |

---

## Switches and channels

**The eighty switches stop gating whether she can record.** Their job is what is
RENDERED and what a CLIENT may see. That job is real and stays. What they may no
longer do is refuse her a write on her own profile because a switch was never
confirmed.

Concretely: the address guard asks the switch resolver whether a path is
rendered. For the owner, on creation paths, an unconfirmed switch must read as
available rather than absent. For a client role it must keep working exactly as
it does today.

**A hidden or unconnected channel does not gate card creation either.** It gates
one thing: whether Analysis may claim a number came from it.

---

## Career Bubble, as the worked example

Its state today, and what this matrix gives it:

| | Before | After |
|---|---|---|
| migration_status | not migrated | migrated (done 2026-08-09) |
| strategy_status | treated as blocked | `draft`, by legacy baseline |
| creation_permissions | read-only | full, from role and lifecycle |
| channel_connection_status | one hidden channel | unchanged, and it gates only Analysis claims |

Its twenty-seven cards and eight previews become editable immediately. Fourteen
blank decisions and eighty unconfirmed switches stop mattering to whether she can
work.

---

## What must be proven before this is called done

Tests, through the real write door, for both surfaces:

1. On an `empty` profile, through the UI: create a card, edit it, move it to
   another stage, set a date, mark it posted with a live URL, read it back.
2. The same six, through the chat.
3. On an `empty` profile, generation warns and does not refuse.
4. An archived profile is still read-only, at every strategy state.
5. A client role still sees only what its switches grant.
6. Analysis reports "not collecting" for a disconnected channel and never a zero.
7. A migrated profile holding existing work lands at `draft`, never `empty`.
