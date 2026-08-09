# HANDOFF — the UI work

**Read this before anything else in this folder, including PLAN.md.**
Written 2026-08-08, at the end of a long session, for the chat that continues
this work.

---

## What she asked for, in her words

> "Show me the screen side by side. Give me an explanation of what you have
> built and how it was being used, and then I will tell you what can be the
> better way. Instead of changing it right there, build a prototype. We will
> discuss it once the prototype is something that I'm happy with and I know how
> it works. Maybe then we can proceed with making the changes in the app."

And earlier, plainly: **"the UI in itself is trash."**

## The working agreement. This is the whole point of this file.

1. **Prototype first, never the live screen.** She has said, more than once, that
   changes landing straight in the app make it unusable while she is trying to
   work in it. A change is built as a SEPARATE page she can open beside the real
   one, and only moves across when she says so.
2. **Explain before changing.** Show her the screen, say what it does and how it
   is meant to be used, and let her tell you the better way. Do not arrive with
   the improvement already made.
3. **One screen at a time.** Not six things and a summary.
4. **No specs for how something looks.** Specs were for structure and they are
   finished. A screen that reads badly needs changing, not documenting.
5. **No agents on UI.** Three times this session an agent returned a screen that
   was technically correct and wrong to use. Do these by hand.
6. **Work on a branch.** She asked directly. The branch is
   `claude/desk-design-lab`, off `main` at `e06b98c`, and it is empty on
   purpose: nothing was built before she had seen and explained the screen.

   This file lives on `main` so a fresh chat can actually find it. That is the
   only reason. It is the first mistake this handoff made about itself: it was
   committed to the branch, and the next chat looked on main and found nothing.

## What she has already told you is wrong

Do not make her say these again.

- **Intake is the worst screen.** Her side shows every question in one flat list.
  53 of them on a real profile.
- **She never chose those questions.** 66 parameters were written by specs, not
  by her. Her vocabulary session was owed from the start and never happened.
- **The questionnaire became the only way in.** Her own law was "intake is HOW,
  never WHAT". The build made a question the only shape information could take.
- **The app refuses too much.** Hard rules mean that when her real work does not
  match the planned path, the app says no politely instead of coping.
- **What she actually wants it to be:** a place to store information no matter
  where or how it arrives, which then processes that information to help her
  create, and then analyses it. Store, then process, then analyse. The structure
  should come out of the pile, not be demanded at the door.

## What she does NOT want

- **No starting from scratch.** She has said clearly she will not re-plan this
  and is not up for it. Improve what exists.
- **No re-litigating the architecture with her.** She does not know or care what
  is underneath, and should not have to.

## A warning about this repo's own documents

`PLAN.md` and `specs/21`–`35` read like settled truth. They are largely MY model
of her business, written confidently, approved by her at the end rather than
built from her at the start. That gap is the root of what she is unhappy about.

Use them for what is BUILT and WHERE THINGS LIVE. Do not use them as the
authority on what she needs. She is that authority.

## Where things stand

- **Live:** deploy `993c909` on `client-tracker/main`. The desk, the three apps,
  the Strategy room, intake, the profile mockup, pause and archive.
- **Branch:** `claude/desk-design-lab`, off `main` at `e06b98c`. Nothing on it yet.
- **Tests:** 884 green via `npm test`. Deploy procedure is `DEPLOY.md`, her
  explicit go every time, and the drift check is not optional.

## Owed by her, not by us

**Corrected 2026-08-09. Two things on this list were already done, and a chat
read the list instead of the code and told her she owed them. Do not repeat it.**

- ~~The Anthropic key in Vercel~~ — **DONE.** She had set it. Both chat routes
  read the same `ANTHROPIC_API_KEY`. If a written sentence comes back at all,
  the key is there.
- ~~A Canva OAuth app~~ — **DONE, and in daily use.** She pastes a design link
  into the preview editor and `/api/canva/import` exports the pages, re-hosts
  them and returns the images. The chat refused Canva links for its own reason,
  not for a missing app, and that is fixed too.

Still genuinely hers: locking the seven unlocked profiles · the Instagram
collection stall since 2026-07-12 · the PDF-reading library decision.

**The rule this list earned:** a document records the day it was written. Before
telling her she owes anything, read the code path and ask what she is already
doing. She was right both times.

## The first thing to do in the new chat

Open the desk beside a duplicate of it, explain what the desk does and how it is
meant to be used, and ask her what a better version looks like. Then build that
into the duplicate. Not into the desk.
