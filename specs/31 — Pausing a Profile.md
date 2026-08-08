# 31 — Pausing a Profile

**Status:** SPEC, 2026-08-08. Her ask, from the live app: "There can be cases
where I discontinue some project or pause some project, so add a button where I
can tap to pause the project, so that it does not feature or get archived so
that I don't have to see it."

**Authority:** `PLAN.md`, then `dashboard/CLAUDE.md`. This spec adds no new
concept and no new storage. Amendment S22 already defines profile lifecycle;
this makes it reachable and makes it mean something on screen.

---

## 1. What is already true, and what is missing

**Already built (spec 21 §6, S22):** every profile carries a `lifecycle` of
`setup` · `active` · `paused` · `closing` · `archived`. Each state already
declares what a client may reach, whether connectors are revoked, and what the
screens render. There is a Lifecycle panel in the Strategy corner that sets it,
and `SET_LIFECYCLE` already works.

**Missing, and it is why she asked:**

1. **It is unreachable in practice.** The control is the eighth tab of a panel
   behind a corner button. She looked at eight profiles and did not find it. A
   thing she needs twice a year must still be findable the first time.
2. **Pausing changes nothing she can see.** `shelfGroupOf` sorts `archived` away
   from the rest, and nothing on the desk reads even that. A paused profile sits
   in the list exactly like a live one, so the state has no consequence — which
   is the same as not existing.

The whole of this spec is closing that gap. No new states, no new fields.

---

## 2. What pausing must do

**On the desk, the only place it matters.** Her sidebar is the list of things
that want her. A profile that is paused or archived does not want her.

- Active profiles list as they do now.
- Paused, closing and archived profiles leave the list and collect behind one
  quiet row at the bottom: "Resting (3)". Tapping it unfolds them, greyed, with
  their state named. Tapping one still opens it, read only.
- The fold is **shut by default** and its state is remembered.
- When nothing is resting, the row is not drawn at all. Off means absent.

**Everywhere else, nothing changes.** A paused profile keeps every piece, every
number and every note. Amendment S9 is the rule and it is not being bent:
`hidden` never deletes. Pausing is about her attention, not her data.

## 3. Where the button goes

Two places, because they answer two different moments.

1. **Inside the profile**, in the Strategy corner, where it already is. That
   stays: it is the considered decision, next to the lifecycle's own
   explanation of what each state does.
2. **On the desk, on the profile row itself.** A small control that appears on
   hover on desktop and on long-press on phone, offering exactly two words:
   **Pause** and **Archive**. That is the fast path, and it is the one she
   asked for.

**Pausing is one tap and is instantly reversible** from the resting fold
("Bring back"). Archiving asks once, because it is the one that reads as final,
even though it is equally reversible.

**No confirmation dialog on pause.** She is pausing a client, not deleting one.
A dialog would be the app not trusting a decision it just offered her.

## 4. What each state says on screen

The words matter more than the machinery here, because the states only mean
something if she can tell them apart at a glance.

| State | The row says | What it means in plain words |
|---|---|---|
| `active` | its real pulse | working on it |
| `paused` | "Paused" | not now, but coming back |
| `closing` | "Closing" | winding down, still owed things |
| `archived` | "Archived" | done, kept forever |

`setup` is not in the resting fold: a profile she has just added is waiting on
her, not resting, and it keeps its place in the list.

## 5. The switch

`shelf.resting_fold`, audience `owner`, suggested default `active`. Registered
in the switch registry at birth, per PLAN §6 rule 3. It governs the fold only:
the lifecycle states themselves are structural and have no switch, because a
profile always has exactly one state.

## 6. Reads and writes

- **Writes:** `clients[].lifecycle`, through the existing `SET_LIFECYCLE`. No
  new slice, no new address.
- **Reads:** the desk (`lib/shell/shelf.ts`, `lib/shell/profile.ts`), the
  Strategy corner's Lifecycle panel, and `doorsOpenAt` for the client side,
  all of which already read it.

## 7. Acceptance

1. Pausing a profile from the desk row removes it from the list and puts it in
   the resting fold, in one tap, with no reload.
2. The fold is shut by default, remembers being opened, and is **not drawn at
   all** when nothing is resting.
3. A paused profile opened from the fold shows every piece, task, note and
   number it had. Nothing is hidden inside it and nothing is deleted.
4. Bringing a profile back restores it to the list in its previous state.
5. A client bound to a paused profile loses their doors, exactly as
   `LIFECYCLE_POLICY` already says. That behaviour is not re-implemented here,
   only tested.
6. The desk's counts and the today strip ignore resting profiles, so a paused
   client cannot make her think something needs her.
