# 14 — Content Automation (the publish seam, both directions)

Written 2026-07-17 from Manmeet's two stated use cases:

> 1. "If I am posting content, it gets automatically updated on the dashboard
>    that something is posted."
> 2. "The content is there and we just do this one thing: we schedule the
>    content right from our platform."

This is connection C3 in `13 — The Connected Loop.md` — the seam between
Make and Publish — automated inbound (A) and outbound (B). Design law applies:
posting is work she already does; the system should notice it, not ask about it.

---

## Use case A — auto-mark posted (inbound, build first)

### What happens today

She posts on Instagram, then must remember to (1) drag the card to Posted and
(2) paste the live URL on the card. Forgetting step 2 means the link join
(C5) never starts tracking that post. Two manual steps guarding the most
important connection in the system.

### What this builds

The nightly `ig-sync` already fetches every new post (permalink, caption,
timestamp, media type). Extend it with a **matcher** that runs after each
sync, per connected account:

1. For each fetched post not yet linked to a card, look at that client's
   cards in **Scheduled** or **Ready** stage.
2. Score candidate matches on: scheduled date vs actual post time (same day
   or ±1 day), format agreement (reel card ↔ VIDEO media, carousel ↔
   CAROUSEL_ALBUM), and caption similarity to the card's text (simple
   word-overlap; no AI needed).
3. **Confident match** (date + format agree, caption overlaps): the card
   moves to Posted, `postUrl` is filled with the permalink, the spec 03 link
   join fires. She opens the board next morning and it is already true.
4. **Uncertain match** (date fits but the rest is weak): the card does NOT
   move. A small "is this that post?" suggestion chip appears on the card —
   one tap yes / no. Never guess silently.
5. **No match at all** (a post that has no card — posted on impulse): a
   quiet "posted on Instagram, not planned here" entry appears in a small
   inbox strip on the Content tab. One tap creates a Posted card from it
   (caption pre-filled, pillar asked). This also catches stories-of-record
   later if we ever want it, but v1 is feed posts and reels only — same
   scope as the pipe.

### Rules

- The matcher NEVER creates or moves anything for a client role. Suggestions
  and auto-moves are owner-side; clients only ever see the curated result
  (rule 1).
- Auto-move happens only on confident matches. The bar for "confident" is
  set strict in v1; loosening it is a decision, not a tweak.
- Cards moved by the matcher carry a small "auto" mark for the first days so
  she can audit trust before it becomes invisible plumbing.

### Size

Small. One function inside the existing `ig-sync` route + a suggestion chip
and inbox strip in `ContentView`. No new storage pattern (matches live on the
card + the existing `ig_post_links`). Depends on spec 03 being deployed
(the link join and per-account tokens are its plumbing).

---

## Use case B — schedule and publish from the dashboard (outbound, build second)

### What this is

A card in Scheduled stage with a date, media attached, and a caption gets a
**"Publish via Instagram"** toggle. At the scheduled time, the system posts
it to the connected account. No phone alarm, no copy-paste at 9 AM.

### How it works (honest mechanics)

- Instagram's official API can publish feed photos, carousels, and reels to
  a connected professional account: you register the media, then publish.
  Media must be reachable at a public URL — our Cloudinary uploads already
  are.
- Instagram does NOT schedule for us. WE hold the schedule: a cron checks
  every few minutes for cards whose publish time has arrived, publishes,
  writes back the permalink (so use case A's link join fires instantly), and
  moves the card to Posted.
- Real limits to design around: max 25 API publishes per account per day
  (irrelevant at our volume), reels need video within Instagram's specs
  (Cloudinary can transcode), first-comment and collaborator tagging have
  partial support, stories support is uneven. v1 scope: **single image,
  carousel, reel — caption included. Nothing else.**
- Works on the same tester-invited accounts as the pipe (the spec 03
  connection paperwork covers it; the publish permission rides the same
  token).

### The safety rules (these are the spec)

1. **Nothing publishes that Manmeet did not explicitly arm.** The toggle is
   off by default on every card. Arming shows exactly what will go out:
   media, caption, account, time. Client roles never see or touch the
   toggle.
2. **A failed publish never fails silently.** The card gets a red "did not
   publish" state and My Day gets an item at the top. Instagram publishing
   has real failure modes (token expiry, media rejected); the system's job
   is honest loud failure, then she posts by hand like today.
3. **One-way door respected:** published means published. There is no
   "unpublish"; the arm step is the confirmation.

### Size

Medium. New API route (publish worker + cron entry in `vercel.json`), card
editor changes (arm toggle + status states), token scope addition in
Connections. Riskier than A because it acts outward on a real account —
which is why A ships first and earns the trust.

---

## Why this order

A first: small, read-only toward Instagram, and it makes the loop's data
complete (every posted card tracked, zero manual steps). B second: it reuses
A's trust and spec 03's plumbing, and by then the connection paperwork is
long done.

Both depend on: spec 03 deployed, the pipe healthy (C4), and per-account
tokens in Connections.

---

## Pending decisions (Manmeet)

1. Use case A: confirm the three behaviours — silent move on confident match,
   ask-chip on uncertain, inbox strip for unplanned posts.
2. Use case A: should an unplanned post's one-tap card ask for the pillar
   right there, or land pillar-less for later triage? (Recommendation: ask
   right there — one tap, and the analysis stays clean.)
3. Use case B: is v1 scope (image, carousel, reel + caption; owner-only;
   arm-per-card) right, or should v1 be even smaller (reels only)?
4. Use case B timing: after A has run trusted for a couple of weeks, or
   sooner?
