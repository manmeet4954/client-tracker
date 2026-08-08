# Prompt for Claude Code

Paste this as your first message in Claude Code, from the root of the dashboard repo, with this handoff folder unzipped somewhere it can read (or dropped into the repo as `design_handoff_dashboard_restructure/`).

---

I want to restructure this dashboard. Read `design_handoff_dashboard_restructure/` first — all of it — before writing any code.

Read in this order:

1. `Dashboard UI Teardown.html` — what the app is today and why it feels chaotic.
2. `UI Structure.md` — the structure I want. This is the source of truth. Where anything else disagrees with it, it wins.
3. `README.md` — the design spec: every screen, layout, token, interaction and state, plus where each screen that exists today lands in the new structure.
4. `design/*.dc.html` — the actual prototypes. They are HTML design references, not code to copy. Open them in a browser to see the thing working: click into a profile, drag a card on the board, open a piece, open the Strategy corner, toggle the lock on Divine Studio.

Then, before writing anything:

- Map the current codebase against the `## Where every current screen lands` table in the README. Tell me which files own each of the 36 routes today, and which of them will be deleted, merged, or moved.
- Tell me anything in the design that conflicts with how the data or auth actually works in this repo. I would rather change the design than fake it.
- Propose an order of work in phases, smallest shippable first. Do not start until I say go.

Constraints that are not negotiable — these are in the README under "The rules this structure must not break", but the ones I care most about:

- One profile on screen at a time. No sideways travel between profiles.
- Three levels only: desk → profile → app. Anything deeper is a panel.
- An app or a switch that is off is not rendered at all. Never greyed out, never an empty tab.
- One piece of content, one record. Review and Analysis read the same piece; never a second copy.
- The lock actually gates: until a profile's Strategy is locked, Creation cannot be written to.
- Nothing may ask me to enter something the system already knows, or report on work I already did.
- Missing analytics data shows as missing, never as a zero.
- A client login can never reach the desk, another profile, the Strategy corner, or anything before review.
- Phone first. The bottom bar holds three items and there is no room for a fourth.
- Every number in any sentence must be counted from the same data it describes, at render time.

Recreate the designs in this repo's existing stack and component patterns. Do not import the prototype HTML.

Start with the map and the plan.

---

## After the plan, phase by phase

Once it has given you the map, these are the phases I would ask for, in this order. Give one at a time.

**Phase 1 — the shell.** Build the three-level shell with no new features: the desk, the profile shell with the three apps, the Strategy corner as a panel, the phone bottom bar. Route the existing screens into it unchanged, even if they look wrong inside. Delete nothing yet. This is the phase that kills the double navigation.

**Phase 2 — Creation.** Board with its four views, the piece panel with review as a state, and Logs absorbing Lists, Observations, agenda and the per-client pipelines. Previews stops being a screen here.

**Phase 3 — the lock.** Strategy corner in full: the 14 decisions, gates, the folded switchboard, channels, brand kit, intake history. Make the lock genuinely gate writes to Creation.

**Phase 4 — Analysis.** Collapse the eight tabs to the three groups and put coverage first everywhere.

**Phase 5 — Intake.** Rounds and Curation, appearing and disappearing based on open questions.

**Phase 6 — the desk chat.** Only after the rest works. Decide first whether it can act or only find.

## What to hand it later, not now

The Engine's seed detail view and the client's logged-in version are not designed yet. Tell it to build the Engine as it stands in the prototype — paste box, seed bank, costume picker — and leave the seed detail for a later pass.
