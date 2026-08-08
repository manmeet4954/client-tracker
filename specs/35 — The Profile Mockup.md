# 35 — The Profile Mockup

**Status:** SPEC, 2026-08-08. Her ask, from the live app, with a screenshot of
`@yourcareerbubble` as the reference.

> "Take the preview tab one step ahead. When a client is onboarded I do a profile
> optimization for them, and we have to show them visually how their profile will
> look. Bio, name, username, profile picture, highlight covers, and a grid of six
> posts. Editable, every time. Make it exactly like this. No flair needed."

**Authority:** `PLAN.md`, then `dashboard/CLAUDE.md`.

---

## 1. What this is

The existing preview shows one POST as it will look on Instagram. This shows the
whole PROFILE as it will look after she has optimised it. Same job, one level up:
something she can put in front of a client and say *this is what we are going to
make your profile into*.

It is a **mockup**, not a connected account. Nothing here reads from Instagram
and nothing here is published to Instagram. Every part of it is something she
types or uploads, because the entire point is showing a profile that does not
exist yet.

## 2. Fidelity is the requirement

Her instruction is "make it exactly like this", and the screenshot is the spec.
Anything invented, styled differently, or added for polish is a defect. A client
has to look at it and see Instagram, not a diagram of Instagram.

That cuts both ways: **nothing gets added that Instagram does not have.** No
labels explaining the parts, no "edit" pencils floating over everything, no
guidance copy. Editing happens in place: tap the text and type, tap the picture
and upload.

## 3. What is editable, and what is not

Read straight off her message, in the order the screen has them.

| Part | Editable | Notes |
|---|---|---|
| Username, top bar | **Yes**, text | With the verified tick beside it. |
| Back arrow, bell, dots | No | Chrome. Drawn, not functional. |
| Profile picture | **Yes**, image upload | PNG and the other usual formats. |
| The story ring around it | **No, never** | Her words: the ring never changes. Always drawn. |
| Name line | **Yes**, text | "Merushri Baboota \| Career Counsellor & Soft Skills Trainer". |
| Posts / followers / following | **No** | Her words: not wanted, not editable. The format stays, the numbers are furniture. |
| Bio | **Yes**, text, multi-line | Takes the space it takes in the screenshot and no more. |
| Link | **Yes**, text | With the chain icon. |
| "Followed by ... and 2 others" | **No** | Kept as drawn furniture. Cheap to keep, and removing it makes the mockup less convincing. |
| Following / Message / Contact / add-person | No | Chrome, exactly as drawn. |
| Highlight covers | **Yes**, five, image + label | Both the picture and the word under it. |
| The grid | **Yes**, six tiles, image each | See §4. |
| Pins | **Yes**, up to three | The pin corner marker, as Instagram draws it. |

**Nothing else is editable.** If it is not in the Yes column, it is furniture.

## 4. The grid

**Tiles are 4:5 portrait**, which is what the screenshot shows and what Instagram
switched its profile grid to. Uploads are fitted to that, centre-cropped, so a
square or landscape image she drops in still looks like the grid looks.

- Six tiles, three across, exactly as the screenshot.
- Up to three can be pinned, and a pinned tile draws the pin marker top right.
- The row of tabs above the grid (grid / reels / repost / tagged) is furniture.

## 5. Where it lives, and how it is shared

**Address:** `context/content-strategy/profile-mockup/`, a law-4 addition inside
the frozen spine.

- **Fed by:** her. Only her. A mockup is work she does FOR the client.
- **Read by:** her; the client, when she shares it; and the strategy derivation,
  because the bio she writes here IS positioning and the look IS visual
  branding. It should not have to be typed twice.
- **Switch:** `strategy.profile_mockup`, audience `both`, client door
  `see:strategy` (it is part of the strategy summary they are shown, not a fifth
  give-point). Suggested default active.
- **History:** `versioned`. She iterates these with a client and the previous
  version has to survive, which is also what makes "copy it" work.

**More than one per profile**, because she does this at onboarding and again
later, and because comparing before with after is the point of the exercise.
Each carries a name and a date.

**Sharing** reuses the existing public link machinery (`/p/[shareId]`), because
that is how she already sends previews and the client already knows what one
looks like. A shared mockup is read-only and shows no editing affordance at all.

**"Copy it"** duplicates a mockup into a new one she can edit, leaving the
original alone. That is what makes a before-and-after possible.

## 6. Deliberately not in this spec

- **No connection to a real Instagram account.** Not reading a live profile to
  pre-fill it, not publishing anything.
- **No image editing.** Upload, crop to fit, replace. No filters, no text tools.
- **No counts.** Followers and posts stay furniture. She said so, and a made-up
  follower count in a client deliverable is a thing best not built.

## 7. Acceptance

1. Every part in the Yes column of §3 edits in place, and every part in the No
   column cannot be edited at all.
2. The story ring is always drawn and can never be removed.
3. A landscape photo dropped into a grid tile displays as a 4:5 portrait tile
   without distortion.
4. Up to three tiles pin, a fourth is refused with a plain line, and unpinning
   works.
5. It is recognisable as Instagram at a glance, at 392 wide, with no label,
   pencil or hint drawn on top of it.
6. Copying a mockup leaves the original untouched.
7. A shared mockup shows no editing affordance to the client, in any state.
8. Nothing in it is visible to a client whose switch is off.
