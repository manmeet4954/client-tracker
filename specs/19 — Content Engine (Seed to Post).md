# 19 — Content Engine (Seed to Post)

Status: DRAFT written 2026-07-21 for Manmeet's validation. Nothing locked, nothing built.
This spec is a mirror. She walks through it section by section and corrects it.

---

## What this is

One seed, many posts.

Manmeet talks about a topic once, in depth. That one talk is the seed. The engine
turns the seed into finished drafts for whatever she selects: a format, a platform,
a pillar. Her effort goes in one time, at the seed. Every repurpose after that is
the machine's job.

The goal, in her words: outputs good enough to use without iterations, and a system
that improves over time.

In the Connected Loop map (spec 13), this is the **Make station** getting its engine.
Spec 09 drafts strategy (what to post). This drafts the content itself (the post).

---

## The vocabulary: two axes plus pillar

Her list mixed shapes and places, so this spec splits them cleanly. She confirms
both lists.

**Format (the shape of the piece):**
- Reel script (hook, beats, on-screen text, caption)
- Carousel (slide by slide plus caption)
- Text post (words only)
- Static post (one image concept plus caption)
- Blog article
- Email
- Newsletter

**Platform (the room it plays in):**
- Instagram
- LinkedIn
- X
- YouTube
- Email list
- Blog

**Pillar (the job, per brand):** picked from that brand's own pillar set. Pillar
jobs (Reach / Trust / Convert) come from spec 04 and stay the funnel logic: reels
reach, carousels deepen, convert pieces ask.

Not every combination exists (no carousel on the blog). A small valid-combinations
table keeps the menus honest.

---

## The knowledge layers (why "I said it, you build it" is not enough)

She named this herself: different platforms work differently, and the system must
actually know how. Four layers, from universal to personal:

1. **Platform files.** How each platform behaves: what gets rewarded, pace, length,
   hook culture, what dies there. Universal knowledge, useful for every client KRNL
   ever takes. This is a KRNL library asset.
2. **Format files.** How each format works: carousel arc, reel hook rules, what a
   text post can do that a carousel cannot. Also universal, also KRNL library.
3. **Pillar layer.** Per brand: what each pillar sounds like for this brand, with
   its job attached.
4. **Taste layer.** Per person: tone, pace, depth, style preferences, words they
   would never use. This is what makes the output sound like the person and not
   like AI. Same idea as spec 10 Half B, arriving earlier by a simpler road.

**The examples-over-rules law.** Every file is built mostly from real examples
marked as wins or misses, with rules only summarizing what the examples show. This
is the proven approach from the IG writing systems (ResumeGuru archive) and the
resumeguru-voice skill. Rules alone produce generic content; examples carry taste.

All four layers live as plain markdown files she can open, read, and correct.
Nothing trains, nothing is hidden (same boundary as spec 10).

---

## The flow

1. **Seed intake.** Topic name plus her dump: voice note transcript, rambling
   text, bullet points, anything. Depth is welcome; the engine never punishes
   length.
2. **Brainstorm (optional).** The engine proposes angles and additions to the
   topic. She keeps what she likes. She flagged this as a maybe-later stage; it
   is in the spec so it has a home, not because v1 needs it.
3. **Selection.** She picks format, platform, pillar. Or she picks only some and
   says "you suggest the rest": the engine proposes a spread, for example one
   seed becoming a LinkedIn text post under Personal Story, an Instagram carousel
   under Value, and a newsletter section.
4. **Generation.** One draft per selection, built from the seed plus the four
   layers. If the seed is too thin for the ask, the engine says so and asks for
   more instead of padding with generic filler.
5. **Review.** She edits or approves. The gap between draft and final is captured.
6. **Learning.** Repeated edits of the same kind become proposed taste rules she
   confirms or deletes. Her marks are the fuel; the loop is the improvement she
   asked for.

---

## What makes "no iterations" real (the honest section)

Not on day one. Output quality is a product of three things:

- **Seed depth.** A thin seed gives a generic post no matter how good the system
  is. The engine's job is to demand depth, not fake it.
- **Parameter file quality.** The platform and format files start as Claude's
  best knowledge and get corrected by her experience. They mature with use.
- **Taste maturity.** The taste file starts near-empty and grows from her edits
  and her star/miss marks on real outputs.

The measurable goal: her edits shrink over time. First month she rewrites parts;
the system watches what she rewrites; later months she mostly approves. If edits
are not shrinking, the loop is broken and we fix the loop, not blame the seed.

---

## The independence requirement (added 2026-07-21, from her question)

Her requirement, stated after reading the draft: the engine must be independent.
It must not depend on files on her computer, on the vault, or on any one chat's
memory. It has to work from the dashboard alone, on any machine, and for anyone
who uses the dashboard in the future.

What this fixes in the design:

1. **Knowledge lives in the dashboard's own database.** Every format, platform,
   pillar, and person gets a knowledge page stored as dashboard data, edited on
   a Knowledge screen in plain words. Adding a format = a new page born in the
   app. The knowledge travels with the dashboard, not with her computer.
2. **The open-book guarantee.** Nothing trains and nothing is remembered by the
   AI. At generation time, code assembles the prompt from the stored pages,
   every single time. It cannot forget, because it does not remember; it reads.
3. **Provenance on every draft.** Each output shows a "knowledge used" list, so
   she can see what was considered. A missing point is then always one of two
   visible problems: the page lacks it (fix the page) or the engine ignored it
   (fix the engine). Never a mystery.
4. **Chat is never the store.** Anything said in a chat that matters gets
   written into a page, a spec, or STATE before the session ends (the existing
   memory rule). Her check on any claim: "where is that written?" must always
   have an answer with a path.
5. **Analytics feeds it later.** Once the setup day is done, pattern verdicts
   from real data (spec 06/10 shapes) can become cited entries on the relevant
   knowledge pages automatically, with her confirm.

Consequence for the doors below: the DESTINATION is Door 2. Doors 1 and 3 are
allowed only as temporary test benches, and anything they produce migrates into
the dashboard knowledge store at build time. (Her confirm still pending; this
records the direction her question pointed.)

## Where it lives (her decision, three doors)

She is unsure whether this belongs in the dashboard. That is fine; the mechanism
is the same in all three doors, so the test does not have to wait for the answer.

1. **Door 1: no code (testable today).** The knowledge layers live as markdown
   files in the vault. She gives a seed and selections in chat; Claude drafts
   using the files; her corrections update the files. Zero build, zero risk,
   proves or kills the mechanism this week.
2. **Door 2: inside the dashboard.** An engine surface per client. Seeds ride on
   spec 04 Topics (a seed IS a topic with a depth dump attached), and generated
   drafts land as content cards via the existing Repurpose shape. Best long-term
   home because outputs meet analytics (what the funnel actually did). Costs a
   real build and touches AppState (rule 5), so it ships like any other spec.
3. **Door 3: standalone tool.** Own URL, own storage, like the Brand Intake Tool.
   Fastest to feel like a product, but recreates the disconnection problem the
   Connected Loop exists to solve.

Claude's recommendation: Door 1 today. Decide 2 versus 3 only after the outputs
have proven worth keeping. The backlog #5 lean (dashboard = spine) suggests Door 2
eventually, but that is her call and it does not block testing.

---

## Sync and non-interference

- **The chat bubble feature.** Being built in a separate chat; this session found
  no spec, state note, or code for it anywhere in the repo. Per the memory rule
  (the folder is the only memory, chat history is not), that chat needs to write
  its spec or state here before the two can be truly synced. Until then, this
  spec deliberately stays code-free (Door 1), so it cannot collide with anything.
  Before any Door 2 build starts, both features get checked against each other in
  STATE.md.
- **Spec 04 Topics.** A seed maps onto the existing Topic entity. If Door 2 is
  chosen, the engine extends Topics; it never creates a rival entity.
- **Spec 10 Playbook & Taste.** This engine's edit-capture is an early on-ramp to
  the same taste layer, under the same rules: visible, hers, deletable, nothing
  trains. When spec 10 builds, the two merge into one taste store.
- **Spec 14 Content Automation.** Publishing is out of scope here. This spec ends
  at a finished draft; getting it posted stays spec 14's job.
- **Rule 1 (clients see curated content only).** Everything generated is internal
  drafting material. For client brands, Manmeet curates before anything ships.
  For her own brand, she is the curator.

---

## The test (Door 1 script, runnable today)

1. She picks one topic she genuinely wants to post about and brain-dumps it
   (voice or text, the messier the better).
2. She picks a format, platform, and pillar. Recommended first run: her personal
   LinkedIn, because the taste material already exists (Personal Brand Standard,
   her reviewed posts).
3. Claude drafts, openly listing which knowledge it used.
4. She marks the draft: keep, never-say, missing. Those marks become the first
   real entries in her taste file.
5. Same seed, second format (for example an Instagram carousel version). This
   tests the actual promise: one effort, many outputs.

Pass condition: she would post at least one of the two with only light edits.

---

## Pending decisions (Manmeet)

1. Confirm the format list and platform list. Anything missing (X threads?
   YouTube long-form script separate from reels?).
2. Which brand tests first: her personal brand or ResumeGuru?
3. Where the knowledge files live for the Door 1 TEST BENCH only (proposal:
   `studio/content-engine/`). The destination store is the dashboard database
   per the independence requirement; test-bench files migrate in at build time.
4. The chat bubble: what does it do, and where is that chat writing its state?
   One line from her is enough to make the sync section real.
5. Door 1 / 2 / 3, after the test has run.
