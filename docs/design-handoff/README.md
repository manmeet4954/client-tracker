# Handoff: KRNL client dashboard, structural redesign

## Overview

The KRNL client dashboard is a private working system for a one-person personal-branding studio. One operator (Manmeet) runs content for eight profiles — some are clients, some are her own brands. A few clients get read-only logins to see their own work. It is used every day, mostly from a phone.

The live app has grown two complete navigation systems at once: an older client list plus a 13–15 tab bar per profile, and a newer profile shelf plus three apps. Both are reachable, neither replaced the other. That is the problem this redesign solves.

**This handoff replaces both with one structure**: a desk, one profile at a time, three apps, and a Strategy corner.

## About the design files

The files in `design/` are **design references written in HTML**. They are prototypes showing intended structure, layout and behaviour. They are **not production code to copy**.

The task is to **recreate these designs inside the existing Next.js application**, using its established components, routing and data layer. Where a pattern already exists in the codebase, use it. Where the design implies a new pattern, build it in the codebase's idiom, not by importing this HTML.

The `.dc.html` files use a small runtime (`support.js`) that turns a template plus a logic class into a React tree. Read them as **specification and layout reference** — the markup, inline styles and computed values are accurate and can be read directly for measurements, colours and copy.

## Fidelity

**High fidelity.** Colours, type, spacing, radii, copy and interaction states are final and should be recreated faithfully. Data is invented; structure, layout and behaviour are not.

---

## The rules this structure must not break

These are operating guarantees, not preferences. Any implementation decision that breaks one of these is wrong.

1. **One world at a time.** You are either on the desk, or inside exactly one profile. Never both, never two profiles at once, never a profile with another profile visible beside it.
2. **Three levels, hard.** Desk → profile → app. Anything deeper is a panel inside a level-3 screen, never a fourth place.
3. **Off means absent.** A switched-off or empty thing is not rendered at all — no disabled buttons, no empty tabs, no "not available for this client".
4. **One thing, one home.** A piece of content lives on the Board. Review shows the same piece; Analysis reads the same piece. Never a second copy.
5. **Nothing is asked twice.** No screen may ask the operator to enter data the system already has, or to report on work already done.
6. **The client never sees the workshop.** Drafts before review, engine internals, private notes, other profiles and the desk are unreachable from a client login in any switch position.
7. **Missing data is shown as missing.** "Not collecting since 12 July", never a zero and never a dip.
8. **Phone is the real target.** The structure must survive a bottom bar with three items and no room for more.
9. **The lock gates.** Until a profile's Strategy is locked, Creation cannot be written to.

---

## Level 1 — The desk

The only screen that knows about more than one profile. Entry point on login; every exit from a profile returns here.

**It is a chat.** The main column is a conversation that answers across every profile, and every answer is a list of rows the user can walk into.

### Layout, desktop (design width 1240)

- Root: `display:flex`, height 100% of the viewport, background `#faf8f6`.
- **Left sidebar**, 262px fixed, background `#1c1a21`, colour `#fff`, padding `22px 14px 16px`, `display:flex; flex-direction:column`.
  - Date kicker: 10.5px, weight 700, letter-spacing `.2em`, uppercase, `rgba(255,255,255,.4)`.
  - "The desk": Bricolage Grotesque 700, 22px, letter-spacing `-.02em`.
  - "PROFILES" label: 10.5px/700/.16em uppercase, `rgba(255,255,255,.4)`.
  - Profile rows (scrolling list): 28×28 avatar, `border-radius:9px`, initial in 12.5px/700 white on the profile hue; name 14px/600; status line 11.5px — `#ff8a5c` when the profile is unlocked or has slipped items, otherwise `rgba(255,255,255,.42)`. Row padding `9px 10px`, radius 12px, hover `background:rgba(255,255,255,.08)`.
  - "+ Add a profile": dashed 1px `rgba(255,255,255,.24)`, radius 12px, 13px/600.
- **Main column**: chat thread (scrolls) above a fixed composer.

### Layout, phone (design width 392)

- Header, background `#1c1a21`, padding `16px`: hamburger (Lucide `menu`, 22px) + date kicker + "Ask the desk" (Bricolage 700, 22px).
- Profiles are **not** on the surface. The hamburger opens a **left drawer**: `position:absolute; inset 0 auto 0 0; width:270px; box-sizing:border-box; background:#1c1a21; z-index:21`, shadow `16px 0 40px rgba(23,21,26,.3)`, over a scrim `rgba(23,21,26,.4)` at z-index 20. The drawer lists the same profile rows and closes on scrim tap or the × button.
- The composer stays pinned to the bottom of the frame.

### The chat thread

- Bot message: full width, background `#fff`, border `1px solid rgba(23,21,26,.09)`, radius `18px 18px 18px 5px`, padding `16px 18px`, shadow `0 1px 2px rgba(23,21,26,.04)`. Body copy 15px/1.6.
- User message: max-width 82%, background `#1c1a21`, colour `#fff`, radius `18px 18px 5px 18px`, padding `12px 16px`, 15px/1.5, right-aligned.
- Result rows inside a bot message: `display:flex; align-items:center; gap:11px`, padding `11px 0`, separated by `1px solid rgba(23,21,26,.07)`. Left: 8px dot in the profile hue. Then title 14.5px/600. Then profile name 12.5px `#6b6570`. Then the when-label 12.5px/600, `#c2410c` if overdue, otherwise `#9b95a1`. Tapping a row navigates into that profile.
- Note line under the rows: 12.5px `#9b95a1`.
- **Phone folding**: any answer with more than two rows renders a persistent summary control instead of the rows — `background:#f4f1ee`, radius 13px, padding `11px 13px`, containing a dot (`#ea4711` if anything slipped, else `#9b95a1`), a label like "7 items, 4 slipped", a trailing action reading "Open" or "Hide", and a chevron rotated `-90deg` when collapsed. It toggles both ways and never disappears. Desktop always shows the rows.
- Suggested prompt chips below the thread: 13px/600 `#6b6570`, background `#fff`, border `1px solid rgba(23,21,26,.1)`, radius 999px, padding `8px 15px`; hover border `rgba(234,71,17,.4)`, colour `#b8551f`.
- Composer: input 15px, padding `13px 16px`, border `1px solid rgba(23,21,26,.12)`, radius 14px, background `#fff`; send button 46×46, radius 14px, `#1c1a21`, Lucide `arrow-right` 19px. Enter sends. Footnote 11.5px `#9b95a1`.

### The opening answer

The desk loads **already answering** "what needs me today" — the operator gets the standing answer without asking, and it is a normal message in the thread that scrolls away. There is no separate Today block and no weekly-read block; the weekly read is a prompt chip.

### Answer set implemented in the prototype

Keyword matched; every headline counts from the same array it renders, with singular/plural and an empty state.

| Trigger words | Answers with |
|---|---|
| default / today | Everything due today across profiles, overdue first |
| stuck, waiting, yes | Every piece currently in Review |
| lock, strategy | Profiles whose Strategy is not locked |
| quiet, not posted, behind | Profiles with nothing on their board |
| week, month, go | The weekly read, plus the piece worth repeating |

In the real app these are queries, not string matching. **Open question for the team: whether the chat can also act — move a piece, send a preview, add a seed — or only find things. The prototype only finds.**

---

## Level 2 — Inside one profile

Entering a profile replaces the entire screen. The desk is gone until the user leaves.

### Navigation is exactly three apps

`INTAKE → CREATION → ANALYSIS`, with Analysis's verdicts feeding back into Creation.

- **Intake is present only while questions are outstanding.** Once curated it disappears from navigation and lives inside Strategy as history, reopenable from there.
- **Analysis is present only where something is collected.** A profile with no collection has two apps, not three greyed out.
- Nothing else competes with the three. There is no Today app, no Previews app, no Settings item.

### Desktop shell (1240 wide)

- Left rail 224px, background `#1c1a21`, padding `20px 14px 16px`.
  - "← THE DESK": Lucide `chevron-left` 15px + 11.5px/700/.13em uppercase `rgba(255,255,255,.55)`.
  - Profile identity: 32×32 avatar radius 10px in the profile hue, name 16px/600, kind 11.5px `rgba(255,255,255,.55)`, with a `1px solid rgba(255,255,255,.12)` divider under it.
  - App items: `display:flex; gap:11px; padding:11px 12px; border-radius:13px; font-size:14.5px; font-weight:600`. Active = `background:#fff; color:#17151a` with the icon in `#ea4711`. Inactive = `color:rgba(255,255,255,.82)`, icon `rgba(255,255,255,.7)`. Icons: Intake = Lucide `message-circle`, Creation = `pen-line`, Analysis = `chart-column`, all 18px, stroke 1.9.
  - Badges: Intake = open question count, Creation = pieces not yet posted. 11.5px/700 tabular.
  - Rail footer, 11.5px `rgba(255,255,255,.35)`: "Strategy locked. Creation is open." or "Strategy is not locked, so Creation is read only."
- Content header, background `#fff`, `1px solid rgba(23,21,26,.09)` bottom, padding `16px 26px`: profile hue dot 10px, profile name 16px/600, and the **Strategy corner control** pushed right.

### Phone shell (392 wide)

- Same header with a back chevron on the left; the Strategy control shows the icon only.
- Bottom bar, background `#fff`, top border `1px solid rgba(23,21,26,.09)`: one item per live app, **never more than three**. Icon 21px + 10.5px/600 label. Active `#ea4711`, inactive `#9b95a1`.

### The Strategy corner

Not an app. A control in the top-right of the profile header, present on every screen inside the profile and reachable from nowhere else. Owner only, always.

It opens as a **panel over the current screen** — 470px wide on desktop, full width on phone, `background:#faf8f6`, shadow `-16px 0 40px rgba(23,21,26,.22)`, sliding from the right. Closing returns to exactly where the user was.

Panel header: `#1c1a21`, "Strategy" 18px/600 plus a state line 12px `rgba(255,255,255,.55)`. Tab strip below on `#f4f1ee`: pill buttons 12.5px/600, radius 10px, active `#1c1a21` on white text, inactive `#fff` on `#6b6570`.

Tabs, in order: **Decide · Gates · Switches · Lock · Channels · Brand kit · Intake history**.

- **Decide** — the 14 parameters. Numbered `01`–`14` tabular, name 14px/600 in a 118px column, decided value 13.5px `#6b6570`. Each opens to show its sources, the decision and a required one-line reason.
- **Gates** — five gates every piece clears plus two the client can raise. 16px dot, `#1a7f4b` when always-on, `#c9c3c8` when client-raised; trailing pill "always" / "client raised".
- **Switches** — 78 switches, grouped in six and folded. Only groups with a change from default open by default; the rest show "all N default" and stay shut. Search field above. Summary line "6 changed · 72 default". Toggle: 38×22 pill, `#1c1a21` when on, `#d9d4d0` when off, 18px white knob.
- **Lock** — the gate between the two halves of the product. Before it, Creation cannot be written to. Shows a card (border `rgba(234,71,17,.3)` when unlocked) with the action "Lock it and open Creation" or "Change a decision", plus a checklist: decisions made, gates chosen, intake curated.
- **Channels** — where the profile posts and where numbers come from. A channel switched off is not drawn anywhere else in the product.
- **Brand kit** — palette and type.
- **Intake history** — the rounds, and a "Reopen intake" action that brings Intake back as an app.

---

## Level 3 — Inside each app

### INTAKE

Two screens, segmented control: **Rounds · Curation**.

- **Rounds** — each round is a card: 9px status dot (`#1a7f4b` answered, `#ea4711` open), name 16px/600, state pill. Questions listed beneath, each with its answered/waiting state. Actions: "Send a new round", "Copy the client link".
- **Curation** — one parameter at a time. Two columns: **What they said, kept** on `#f4f1ee` (14px/1.6 `#6b6570`) and **What it means, curated** on `rgba(234,71,17,.07)` with the label in `#b8551f`. A footer line names the Strategy parameter it feeds.
- **Raw answers are permanent and never editable.** Curating is the only path from a raw answer to something the system uses.

### CREATION — the daily home

Five screens, segmented control: **Board · Engine · Assets · References · Logs**. **Board is the default landing** — the app opens on her work, not on a question.

On phone the strip is a single row with `flex-wrap:nowrap; overflow-x:auto`. It must never wrap to two lines.

#### Board

- **"Needs you today"** strip at the top: a collapsible card listing what has slipped or goes live today for this profile only. Chevron + label + count pill (`#b8551f` on `rgba(234,71,17,.10)`). Collapsed state is remembered.
- **Four views** in a segmented control: **Board · Pillars · Table · Month**.
  - *Board*, desktop: six columns — Idea, Build, Review, Approved, Scheduled, Posted — 206px wide, background `#f6f3f0` (Posted `#f1eeeb`), radius 18px, padding `14px 12px`. Cards: white, `1px solid rgba(23,21,26,.09)`, radius 14px, padding `12px 13px`, `border-left:3px solid <profile hue>`, title 14px/600, tag chips 11px/600 on `#f4f1ee`, meta 11.5px `#9b95a1`. Drag between columns.
  - *Board*, phone, and *Table*: the same stages as stacked full-width sections with rows.
  - *Pillars*: columns by content pillar with the mix target in the header. **Stacks vertically on phone** — never a horizontal scroller there.
  - *Month*, desktop: a 7-column, 35-cell grid, each cell 62px min-height with dated pieces as 10px chips in the profile hue. **On phone this becomes an agenda list**, not a grid.
- **Review and scheduling are states of a piece, not screens.** Clicking any card opens the **piece panel** (same geometry as the Strategy panel): stage chips (the six stages, current one filled `#1c1a21`), fields (pillar, format, born-from seed, date, live link), and — when the piece is in Review — the Instagram-accurate preview, the public `/p/<shareId>` link, "Copy the link" and "Send on WhatsApp", plus the sent/opened state. The five gates are listed underneath with pass marks.
- **When the profile is unlocked**, the board renders a lock banner (white card, border `rgba(234,71,17,.3)`, Lucide `lock` in `#ea4711`) reading "Strategy is not locked yet, so nothing can be written here. Read the board, but the pieces cannot move." Cards get `draggable="false"` and the board note reads "Read only until Strategy is locked." The banner's button opens the Strategy corner.

#### Engine

Where a thought becomes a seed, and a seed gets dressed into pieces.

- Left, 1.5fr: "What are we talking about today?" (Bricolage 700, 23px) over a subtitle, then a textarea (`background:#faf8f6`, radius 14px, padding 14px, 14.5px/1.6) with placeholder "Say it once. It gets kept." Actions: "Find the seeds in this" (dark) and "Write one myself" (ghost).
- Below a divider, **Dress it**: four chip groups — Pillar, Platform, Format, Angle. Selected chip `#1c1a21` on white, unselected `#f4f1ee` on `#6b6570`. Action "Send it to the board", which lands the dressed seed on the Board in Idea.
- Right, 1fr: **Seed bank**. Each seed is a card with title 15.5px/600, meta ("locked · 4 pieces · 2 posted"), and the operator's own words preserved verbatim. Selected seed gets a `rgba(234,71,17,.35)` border and a soft accent shadow. Only locked seeds can produce pieces.
- Below the bank, a **Back from Analysis** card carrying the verdict that says "make more of this", with a "Turn it into a seed" action.

**This screen is the least finished part of the prototype.** Still to design: the seed detail view, how the pieces born from a seed are shown against it, and what "find the seeds in this" returns on screen.

#### Assets

Grid of sets, `minmax(178px, 1fr)`. Each: 4:3 thumbnail on a `#f4f1ee → #e7e2dd` gradient with an uppercase kind label, name 14.5px/600, meta 12px. Originals are always kept; video opens in Drive. For profiles that sell products, a **Catalogue mode** toggle switches the same screen to the product catalogue — the catalogue is an assets mode, not its own screen.

#### References

Two groups, each a card with a header: **What they shared** and **What we want for them**. Rows: title 15px/600, source 12.5px, date 12px tabular.

#### Logs

The profile's memory of everything that is not content. Segmented control: **Tasks · Decisions · Requests · Pipelines · Notes**.

Rows: 8px status dot, title 15px/600, sub-line 12.5px `#9b95a1`, when 12px tabular. A footnote per tab explains what lives there.

**Pipelines** is where every per-client one-off list lands — Orders, Cold calls, Saved replies, Leads — switched on only for the profiles that use them. **Notes** is the old Observations, per profile and private to the operator.

### ANALYSIS

Eight screens in the old app collapse to **three groups**, and coverage is always the first thing on screen.

- **Where we are** (Now, Goals, Health)
  - **Coverage first**: a 12px bar showing collected vs uncollected days — collected `#1c1a21`, uncollected a diagonal hatch `repeating-linear-gradient(135deg,#e0dbd6 0 6px,#f4f1ee 6px 12px)` — with "23 of 31 days collected" and "not collecting since 12 July" in `#c2410c`, and a "Fix the connection" action. Then: "Everything below is read against 23 days, not 31."
  - Metric cards: label 11.5px/700/.09em uppercase `#9b95a1`, value Bricolage 700 32px tabular, delta 12.5px/600. **An uncollected metric shows `—`, never `0`.**
  - Goals: label + value + a 7px progress bar on `#efece9`.
- **What happened** (Slices, Scorecard, Funnel)
  - Slice by pillar / format / hook / seed / platform — any birth parameter. Rows with a bar; an uncollected slice draws the hatch, not a zero-length bar.
  - Scorecard: each pillar judged against its own job, with a pass/thin pill.
- **What it means** (Compare, Verdicts)
  - Compare: two or more pieces side by side, each showing how it was born (seed · angle · format) above its numbers. This is the point of the engine.
  - The verdict in words, with "Send this back to Engine" — which is how a verdict becomes the next seed.

---

## Design tokens

### Colour

| Token | Value | Use |
|---|---|---|
| Ink | `#1c1a21` | Rails, desk sidebar, panel headers, primary buttons, bars |
| Text | `#17151a` | Body text |
| Paper | `#faf8f6` | App background |
| Surface | `#ffffff` | Cards, headers, composer |
| Sunken | `#f6f3f0` | Board columns |
| Sunken, muted | `#f1eeeb` | The Posted column |
| Chip / control ground | `#efece9` / `#f4f1ee` | Segmented controls, tag chips |
| Hairline | `rgba(23,21,26,.09)` | Card borders |
| Divider | `rgba(23,21,26,.07)` | Row separators |
| Muted text | `#6b6570` | Secondary copy |
| Faint text | `#9b95a1` | Meta, labels, placeholders |
| Accent | `#ea4711` | Active icons, seed selection, attention |
| Accent, text-safe | `#b8551f` / `#c2410c` | Accent text, overdue |
| Positive | `#1a7f4b` on `#e6f5ec` | Passed gates, healthy states |

Profile hues (identity only, never chrome): `#3b82f6` Career Bubble, `#0ea5e9` Divine Studio, `#ec4899` Sonia's Crochet, `#22c55e` ResumeGuru, `#f97316` KRNL Studio, `#e879f9` Freelance Projects, `#6366f1` Shiva Mam, `#2dd4bf` Manmeet's LinkedIn.

### Type

- Display: **Bricolage Grotesque**, weight 700, letter-spacing `-.02em` to `-.03em`. Sizes: 52px desk hero, 30–32px screen titles, 21–23px section titles, 19px card numerals.
- UI and body: **Plus Jakarta Sans**, 400/500/600/700. Body 14–15px, meta 12–12.5px, kickers 10.5–11.5px at weight 700 with `.09em`–`.2em` letter-spacing, uppercase.
- Weight ceiling is 700. Nothing goes to 800.
- All figures that stand as numbers use `font-variant-numeric: tabular-nums`.

### Spacing, radius, elevation

- Radii: 999px pills · 9–14px controls and small cards · 18px cards · 20px large cards and frames · 34px phone frame.
- Card padding 16–20px; row padding `11–15px` vertical, `16–18px` horizontal; grid and stack gaps 10–14px.
- Elevation is a whisper: `0 1px 2px rgba(23,21,26,.04)` for cards, `0 2px 10px rgba(234,71,17,.10)` for the selected seed, `-16px 0 40px rgba(23,21,26,.22)` for side panels.
- Focus is never the browser default: `outline: 2px solid #ea4711; outline-offset: 2px`.

### Icons

Lucide throughout, stroke width 1.9–2.2, 15–22px. Used: `chevron-left`, `chevron-down`, `menu`, `x`, `arrow-right`, `message-circle`, `pen-line`, `chart-column`, `sliders-horizontal` (Strategy), `lock`, `list`.

---

## State

Held at the top of the prototype and passed down:

- `route: { screen: 'desk' | 'profile', pid, app, tab, piece, strategyOpen, strategyTab }`
- `posts` — every piece, each with `pid`, `title`, `stage`, `tags`, `meta`, optional `day`. Dragging mutates `stage`.
- `profiles` — each with `hue`, `kind`, `locked`, `intakeOpen`, `analysis`, `catalogue`, `pipelines`. `locked` is toggled from the Strategy corner and gates Creation.
- `todayItems` — cross-profile, each with `pid`, `title`, `when`, `group: 'live' | 'overdue' | 'waiting'`.

Local, per screen: chat thread and draft, drawer open, per-message fold, board view, log tab, slice, asset mode, seed selection, costume selection, switch group folds.

**Every count shown in copy is derived from the array it describes.** No headline states a number that is not counted from the same data at render time — this was a recurring bug and should be treated as a rule.

## Responsive

The prototype renders both viewports side by side from one implementation, driven by a `narrow` flag rather than media queries, so a real implementation can use breakpoints freely. Behaviour that changes on narrow:

| Surface | Desktop | Phone |
|---|---|---|
| Desk profiles | Left sidebar, always visible | Drawer behind the hamburger |
| Chat answers | Rows always expanded | Folded behind a two-way summary row when more than two |
| Profile nav | Left rail | Bottom bar, max three items |
| Sub-tab strips | Wrap freely | One row, horizontal scroll, never two lines |
| Board | Six columns | Stacked stage sections |
| Pillars | Horizontal scroller | Stacked full width |
| Month | 7-column grid | Agenda list |
| Panels | 470px from the right | Full width |

## The client's version

Not built in this prototype, and it needs designing. Same structure, fewer doors: a client login goes straight into their own profile, never sees the desk, and gets only what their switches grant from the same three apps. Strategy is never reachable, not one panel. A client with two profiles gets a small picker of **their own** profiles and nothing else. A client can only *give* in four places: intake answers, assets, review verdicts, and their read on how things are going.

## Assets

None. All iconography is Lucide; imagery in the prototype is placeholder gradients where photographs will go.

## Where every current screen lands

| Today | Goes to |
|---|---|
| `/clients` client list | The desk |
| Dashboard tab | Absorbed: counters onto the desk, agenda into Creation → Logs |
| Content (board / pillars / table) | Creation → Board, three views of one screen |
| Previews | Creation → Board, as the review state of a piece |
| Journey | Split: goal → Analysis → Goals; pillar bars → Analysis → Scorecard |
| Analytics | Analysis, its eight tabs collapsed to three groups |
| Lists | Creation → Logs → Pipelines |
| Assets, Catalogue | Creation → Assets, catalogue is a mode |
| References | Creation → References |
| Brand | Strategy → Brand kit |
| Cold Calls, Orders, Answers | Creation → Logs → Pipelines, per profile |
| Onboarding, Intake, Curation | Intake |
| Strategy, Engine | Strategy corner, and Creation → Engine |
| My Day | Client half → the desk's opening answer. Personal half leaves |
| Observations | Creation → Logs → Notes, per profile |
| Connections | Strategy → Channels |
| Brain dump, Container map | Leave the product |
| Public preview `/p/…` | Unchanged. The only screen an outsider sees |

**13–15 tabs per profile becomes 3 apps + 1 corner**, and 5 screens inside the app used daily.

## Files in this bundle

- `design/Dashboard v3.dc.html` — the frame: data, routing, and both viewports side by side. Read the `PROFILES`, `POSTS` and `TODAY_ITEMS` constants for the shape of the data.
- `design/DeskV3.dc.html` — Level 1, the chat desk, sidebar and drawer.
- `design/ProfileV3.dc.html` — Level 2, the profile shell, rail, bottom bar, piece panel and Strategy corner.
- `design/RoomsV3.dc.html` — Level 3, Intake, Creation and Analysis.
- `design/support.js` — the runtime the `.dc.html` files need to open in a browser. Not part of the design.
- `UI Structure.md` — the operator's own structural spec. **Where this README and that document ever disagree, that document wins.**
- `Dashboard UI Teardown.html` — the honest survey of the app as it exists today, including the pain list and the operating laws.

## Open questions for the team

1. Can the desk chat **act** (move a piece, send a preview, add a seed), or only find? The prototype only finds.
2. The Engine's seed detail view, and how pieces born from a seed are shown against it.
3. The client's logged-in version, in full.
4. What the desk looks like with 20 profiles rather than 8.
5. The floating chat that exists in the current app: does it merge into the desk chat, or stay separate?
