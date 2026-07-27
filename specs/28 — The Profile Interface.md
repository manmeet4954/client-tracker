# 28 — The Profile Interface

**Status:** BUILT 2026-07-27, not deployed. Built in §16.2's order; §17's tests 1–13 green as 61 checks plus the payload halves of 14 and 16 (396/396 with specs 21–27), typecheck clean, production build green. Tests 15 and 17 verified by hand in the browser. §16.6's leaves list has NOT run. The build record and the resolutions are in `STATE.md`. This is PLAN §8 step 9 — the client-side regroup — and the last spec in the 22–28 batch.

**Authority:** `PLAN.md` outranks this file. Where this spec and the plan disagree, the plan wins. Where an amendment in PLAN §10 touches anything below, the amendment wins. Specs 21–27 own the data, the engines, and the surfaces; this spec owns only the **shell** they mount into.

**Why this spec exists.** PLAN §2, her mandate, dated and confirmed: *"Today the dashboard is one site where all client workspaces are visible to her at once and she toggles between them — not app-friendly, and it does not match the structure."* Every spec since 21 has said the same sentence in its out-of-scope list — *"this spec describes a screen and states what it needs from the shell"* — and named the shell as its own spec. This is that file. It retires the one-site-with-toggles dashboard and builds the profile-first app: **pick a profile → enter it → the three apps of that profile, one world at a time.**

**What this spec is allowed to invent:** how it looks. PLAN §2: *"How the apps, folders, and sub-apps look on screen is delegated to Claude to design — her requirement is only that it feels like a proper app, not a site with toggles."* Her veto stands over every choice below.

**Folders read: declared in full at §12. Folders written: exactly one (`shelf/profiles`, already declared by spec 21). No law-4 addition — justified hard at §12.3.**

---

## 1. What this spec is, and is not

**It is:**

1. **The shelf** — her login's landing: profile cards, the today strip, add-profile, her weekly pulse lines.
2. **The profile interior** — the brand-skinned frame, the three apps as the only navigation, Strategy and Switches as owner-only corner controls, and the rule that leaving means going back to the shelf.
3. **The render law** — one resolver that turns a switch position, a lifecycle state, and an audience into *rendered · rendered read-only · not rendered at all*, so that no screen decides for itself.
4. **The client's profile** — no shelf, the granted windows only, the mini-shelf for a person bound to more than one profile.
5. **The route map** — every route alive today, with its fate: kept, moved, redirected, or gone per PLAN §7.
6. **The public preview deep link** — PLAN §11 Q2's build item, assigned to this spec by name.
7. **The cutover** — how the live app moves from today's routes to the new shell while she and her clients keep using it every day.

**It is not:**

- **Any new capability.** Nothing in this spec can do something the dashboard could not do before. Screens move; features do not grow.
- **Any screen's insides.** The Engine Room is spec 23. The costume surface is spec 24. Drafting and gates are spec 25. The eight Analysis tabs are spec 27. The Intake app, the curation workspace and the Strategy surface's contents are spec 22. This spec says where they mount, who reaches them, and what happens when their switch is off.
- **The chat.** FROZEN by PLAN §11 Q1. It keeps working exactly as today, mounted unchanged. §9 says what "unchanged" means concretely, and it is mostly a list of things the build may not touch.
- **Any change to server-side filtering that weakens it.** CLAUDE.md rule 2. The three additions in §15 all make it stronger.
- **A build.** Per batch mode, this file is written, verified by the control room, and built in order with the rest.

---

## 2. What must be true before this builds

| Precondition | State today | If missing |
|---|---|---|
| Spec 21 deployed, path-scoped writes live, bindings by profile id | done (deploy `a65079a`) | blocked. The shell renders from switch positions and bindings; without them it is guessing |
| Spec 22 built (strategy lock, the switchboard, lifecycle door scoping) | written, not built | the shell builds and the frame works, but **no profile can cut over** — cutover is gated on a locked strategy (§16) |
| Specs 23–25 built | written, not built | Creation renders Board · Assets · References · Logs, and the Engine tab is not rendered (its switch resolves inactive). Nothing breaks |
| Specs 26–27 built | written, not built | Analysis is not rendered; the Health tab and the weekly pulse have no source. The shelf's pulse block renders its empty line |
| At least one profile migrated for real (`apply: true`) and locked | dry run done, apply parked to the collective phase | the shelf ships and every card opens the legacy workspace (§16.3). That is a valid shipped state |

**The shell is buildable before any of specs 22–27 are.** That is deliberate: the frame, the shelf, the resolver, and the route map are the scaffolding every other spec's screens hang from, and each one appears in the frame as soon as its switch can resolve active. Nothing about the shell waits on an engine.

---

## 3. The frame

Three layers, and every screen in the system sits inside all three.

### 3.1 The route namespace

One rule: **a screen's URL says which profile it belongs to, and there is exactly one profile in any URL.**

```
/                                   entry — passcode, then routed by role
/shelf                              her shelf (owner)
/profile/<id>                       → redirects to the first rendering app
/profile/<id>/intake                the Intake app
/profile/<id>/creation              → redirects to the first rendering sub-tab
/profile/<id>/creation/engine       Engine   (specs 23, 24, 25)
/profile/<id>/creation/board        Board    (the stages, calendar, funnel)
/profile/<id>/creation/assets       Assets   (incl. catalogue mode)
/profile/<id>/creation/references   References
/profile/<id>/creation/logs         Logs     (tasks, pipelines, notes, effort)
/profile/<id>/analysis              → Now
/profile/<id>/analysis/<tab>        the eight tabs (spec 27 §5)
/profile/<id>/strategy              the owner corner
/profile/<id>/strategy/<panel>      derivation · gates · switches · channels · brand · intake-history · lifecycle
/p/<shareId>                        the public preview (§10)
/share-target                       Android share-to-save (unchanged, re-pointed)
```

The client uses the same namespace. Their windows are the same routes, filtered — never a parallel `/client-view/` tree. One set of routes, one resolver, one guarantee.

### 3.2 The render resolver

Every screen, tab, panel, picker row and field asks **one function** whether it exists:

```
renderState(profileId, switchId, role) → 'active' | 'history' | 'hidden'
```

It composes, in this order, and takes the most restrictive answer:

1. **the switch cascade** — `resolveSwitch` / `isRendered` / `isReadableHistory` in `lib/tree/cascade.ts`, already shipped by spec 21: the minimum of a switch's own position and every prerequisite's, computed transitively;
2. **the lifecycle** — `LIFECYCLE_POLICY` (spec 21 §6, as corrected by spec 22 §11.1): a `paused` profile's client-audience switches read `history`, an `archived` profile's everything reads `history`;
3. **the audience and the door** — a non-owner role gets `hidden` for any path whose declaration is `audience: owner`, and `hidden` for a `both` path whose `client_door` their bindings do not grant.

**No component may read a switch position directly.** That is an acceptance test (§17.5), and it is the whole reason the resolver exists: the cascade is only true if there is one place it can be true.

### 3.3 The placement rule

The tree is data; the shell is screens. They are not the same map, and this rule is what keeps them honest:

> **The shell may render a path on any screen whose audience is no wider than the path's own.** It may never render an `audience: owner` path on a screen a client reaches, and it may never render a path on a screen that is reachable when the path's switch resolves `hidden`.

This is why, for example, `work-log/creation/channels` (a creation path) renders inside the owner-only Strategy corner: the corner is stricter than the path, so the rule is satisfied. It never works the other way.

### 3.4 The skin

A profile is *lightly* skinned in its brand color. Accent = the brand kit's primary/accent color, falling back to the profile's stored color — the existing `pickAccent` logic, kept.

The accent is **chrome only**: the header band, the active nav item, focus rings, primary buttons, the shelf card's edge. Content surfaces stay neutral. A client's carousel must look like their carousel, not like their carousel wearing a tint. One rule, stated so nobody prettifies past it.

The skin is the answer to "which world am I in" — it is the reason no screen needs a breadcrumb telling her.

---

## 4. The shelf

PLAN §2 item 1, in full: *"Her login lands on a grid of profile cards — clients and her own, each with its brand color and a one-line pulse ('2 in review · 4 scheduled'). Cards show status, never content: nothing from inside a profile leaks onto the shelf. The shelf also carries her one cross-profile window: the today strip (client tasks due across profiles — the surviving half of My Day). Add-profile lives here."*

### 4.1 The screen

Top to bottom, one column on mobile, a grid on desktop:

1. **Header** — "Your profiles", the date, and one chip: *"3 due today"*, which scrolls to the strip. Nothing else. No global search, no cross-profile filters, no analytics.
2. **The cards** — every profile she owns, grouped: her own profiles first (`owner_kind: hers`), then clients, then a collapsed **Archived** section at the bottom.
3. **Add profile** — the last tile in the grid, a plain outline card with a plus.
4. **The today strip** — §4.3.
5. **The weekly pulse** — §4.4.

### 4.2 The card, and the status-never-content law

A card carries exactly this:

| On the card | Source |
|---|---|
| Profile name | the profile record |
| Brand color as the card's edge and its initial tile | brand kit primary, else profile color |
| Lifecycle chip, when the state is not `active` | `lifecycle` (§4.6) |
| One status line, counts only — *"2 in review · 4 scheduled"* | counts over `work-log/creation` by stage |
| One attention line, when there is one — *"Not collecting since 12 July"* · *"Waiting on intake"* · *"Strategy not locked"* | coverage from `study-own-data/sync-health`, round status from `context/intake`, `strategy_version` |

**What may never appear on a card:** a piece title, a hook, a caption, a seed name, a topic, a client's words, a draft, a metric value, a verdict sentence, a note. The card answers *how much and what state*, never *what*.

The line is composed per profile from that profile's own paths and reduced to counts before it reaches the shelf. Nothing cross-profile is stored to make it (spec 21's declaration for `shelf/profiles` says exactly this: *"Profile cards show status only — nothing from inside a profile leaks onto the shelf"*).

**The two deliberate exceptions, and why they are not exceptions to the card law.** The today strip and the weekly pulse do carry content-shaped lines. Both are granted by name in the plan — the strip as *"her one cross-profile window"* (PLAN §2 item 1), the pulse as *"a few lines across ALL profiles… her eyes only"* (PLAN §5.2). The card law binds cards. The strip and the pulse are separate blocks with their own switches, and a client never sees either.

Tapping a card enters that profile. There is nothing else to tap on a card — no menu, no quick actions, no "open in". Lifecycle changes and deletion live inside the profile, in the corner (§5.6), because they are decisions and decisions belong to the world they are about.

### 4.3 The today strip

The surviving half of My Day (PLAN §7; spec 21 §8.1, §8.8).

- **What it holds:** tasks due today or overdue, from every profile, of both surviving kinds — **client tasks** (`work-log/logs/tasks`) and **content tasks** (a task pointing at a piece, which reads the piece and never copies it, S2). **Personal tasks are gone** — they left with the personal half (PLAN §7).
- **How it is composed:** exactly the pulse pattern spec 27 §13.2 established for the weekly pulse, and for the same reason (PLAN §5.3: everything belongs to exactly one profile). Each profile owns its own tasks at its own address; the shelf reads each profile's `logs/tasks` and composes one list on screen. **No cross-profile object is stored.** A profile leaving the strip (`shelf.today_strip → hidden` for that profile) removes exactly its own rows.
- **Each row:** the task, its profile's color dot and name, and its due state. Tapping a row enters that profile at the task. Ticking it completes it in place, through the profile's own scope — one write, one path, no cross-profile write.
- **Overdue on top**, then today. That ordering is hers, from the 2026-07-14 My Day polish, and it survives.
- **Empty state:** one line — *"Nothing due today."* No encouragement, no streak.
- **Switch:** `shelf.today_strip` (spec 21, exists), which requires `logs.tasks`.

### 4.4 The weekly pulse

Spec 27 §13.2: each profile writes its own weekly-pulse entry into its own `work-log/analysis/digests` with `kind: 'weekly-pulse'`, and **the shelf composes her one screen from them.** This spec builds that composition and nothing else — the words, the numbers, and the guards are spec 27's.

- A block below the strip: one profile per line-group, newest week first, at most a few lines each.
- **Broken collection sorts to the top**, ahead of everything moving (spec 27 §13.2's order, kept).
- A profile with `analysis.pulse_owner` at `hidden` contributes nothing and is not listed.
- Before spec 27 ships, or before the first Monday run, the block renders one line: *"Your weekly read will appear here once there is enough collected."*
- **Switch:** `shelf.weekly_pulse` (new, §13) governs the block; `analysis.pulse_owner` (spec 27) governs each profile's contribution.

### 4.5 Add profile

- Name, brand color. That is the whole form.
- The profile is born at lifecycle `setup`, `owner_kind` chosen (hers / client), no switch positions set, no strategy version.
- Its card immediately reads *"Setting up"*, and entering it lands on Intake if `intake.questionnaire` is active, else the Strategy corner.
- **This is the shell's one write** — `shelf/profiles`, `fed_by: ['owner']`, already declared by spec 21.
- **Switch:** `shelf.add_profile` (new, fixed, §13).

### 4.6 Lifecycle on the shelf (S22)

| State | The card |
|---|---|
| `setup` | Normal card, chip **Setting up**, attention line naming what is owed — *"Intake not sent"* / *"Waiting on answers"* / *"Strategy not locked"*. No counts (there is nothing to count) |
| `active` | The full card: counts, attention line when there is one, no chip |
| `paused` | Muted card, chip **Paused since 3 June**. Counts frozen at the pause date and labelled so. Client access is closed and the card says so in one line |
| `closing` | Chip **Closing**. One line: *"Connections revoked · export ready"*. Counts still render — the record is intact, that is the point of the state |
| `archived` | Below the fold, inside the collapsed **Archived** section. Name, color, chip **Archived**, date. No counts, no attention line |

Nothing is ever removed from the shelf by a lifecycle change. Retention is forever, deletion is hers alone with an export first (PLAN §11 Q5), and the shelf never offers a delete.

### 4.7 What the shelf is not

No global content view. No cross-profile board, calendar, search, or analytics. No "recent activity". The plan is explicit — the shelf's *one* cross-profile window is the today strip, and the pulse is her private weekly read. Anything else that wants to be cross-profile is a plan change and therefore her gate.

---

## 5. Inside a profile — her side

### 5.1 The frame

**Header** (both layouts): back-to-shelf on the left; the profile's name and color; the corner control on the right (§5.6). Nothing in the header belongs to another profile.

**Navigation:** the three apps, and only the three apps.

| App | Renders when | Route |
|---|---|---|
| **Intake** | any round is not yet `curated`, or she reopens one (§5.5) | `/profile/<id>/intake` |
| **Creation** | any of its five sub-tabs renders | `/profile/<id>/creation` |
| **Analysis** | any of spec 27's eight tabs renders | `/profile/<id>/analysis` |

**The container rule:** a container renders when at least one of its children renders. A container with no rendering children is **not rendered** — no empty app, no empty tab, no shell with nothing in it.

**Landing:** `/profile/<id>` redirects to the first rendering app in the order Intake → Creation → Analysis. If none render (a fresh `setup` profile with intake not yet configured), the interior opens on the Strategy corner with one line naming what is owed. There is no profile "home" screen — PLAN §2 item 2 says the three apps are the only navigation, and a fourth landing page would be a fourth thing to navigate.

### 5.2 Creation — the five sub-tabs

PLAN §2 item 3 fixes them: **Engine · Board · Assets · References · Logs.** Five, in that order, no sixth. Everything the dashboard does inside a profile's working day lands in one of them.

| Sub-tab | What it holds | Governing switches |
|---|---|---|
| **Engine** | The Engine Room (spec 23 §3), the capture box, the seed bank, the costume surface and the variant grid (spec 24 §3), the internal brief, drafting and the seven gates (spec 25), the costume recommendations block | `creation.engine`, `creation.seed_extraction`, `creation.costume`, `creation.brief`, `creation.draft` |
| **Board** | The stages (idea → build → review → approved → scheduled → posted), the piece sheet, the calendar, the review queue and previews, the funnel and its reply scripts | `creation.board`, `creation.review`, `creation.scheduling`, `creation.publishing`, `creation.funnel`, `creation.funnel_replies` |
| **Assets** | The asset library and sets, the Drive videos tile, catalogue mode with its PDF export, rights state per item | `assets.library`, `assets.drive_videos`, `assets.catalogue_export`, `assets.share_target` |
| **References** | From-client and our-vision | `references.from_client`, `references.our_vision` |
| **Logs** | Tasks and the monthly agenda · decisions · requests · changes · pipelines (Lists, Cold Calls, Orders) · her per-profile notes · effort and money, **her own profiles only** | `logs.tasks`, `logs.decisions`, `logs.requests`, `logs.changes`, `logs.pipelines.*`, `logs.observations`, `logs.effort_meter`, `logs.effort_money` |

**Where every surface alive today lands:**

| Today | New home |
|---|---|
| `ContentView` board / pillars / table, `CardEditor` | Creation → Board → Stages |
| `ContentCard.scheduledDate`, the calendar, My Day's content half | Creation → Board → Calendar |
| `PreviewsView`, `InstagramPost` | Creation → Board → Review |
| `AnswersView` (Divine's lead replies) | Creation → Board → Funnel |
| `AssetsView`, Drive tile, `CatalogueView` + PDF export | Creation → Assets |
| `ReferencesView` | Creation → References |
| `DashboardView` monthly agenda | Creation → Logs → Tasks |
| `ListsView`, `ColdCallsView`, `OrdersView` | Creation → Logs → Pipelines |
| `ObservationsView` entries carrying a profile tag | Creation → Logs → Notes |
| `MomentumMeter` (spec 11) + Money meter (spec 16) | Creation → Logs → Effort — **only where `owner_kind: hers`** (PLAN §7) |
| `JourneyView` goal card | Analysis → Goals |
| `JourneyView` mix-vs-target bars | Analysis → Scorecard |
| `AnalyticsView` | Analysis (spec 27's eight tabs) |
| `BrandView` brand kit | Strategy corner → Brand book (and the client's Brand window, §7.3) |
| `ConnectionsView`, `/api/ig-accounts` identity | Strategy corner → Channels |
| `OnboardingView` | Intake |

**The momentum meter's placement is a rule, not a preference.** PLAN §7: it survives only inside her own profiles. `logs.effort_meter` resolves `hidden` on every `owner_kind: client` profile, so the Effort panel is not rendered there — for her, for anyone. Test §17.9.

### 5.3 Analysis — spec 27's eight tabs

Now · Slices · Scorecard · Funnel · Compare · Goals · Verdicts · Health, exactly as spec 27 §5 defines them, each with its own switch. This spec adds nothing to them and changes nothing about them. It supplies the frame: desktop tab row, mobile bottom-sheet tab picker (spec 27 §5's own words), and the resolver that decides which of the eight exist.

The Now tab's first block is always coverage (spec 27 §5). The shell may not move it, collapse it, or put a badge in a corner instead.

### 5.4 Intake, and the quiet done

Spec 22 §5.6, carried exactly:

- While any round is not `curated`, **Intake** is the first app in the navigation.
- When every round is `curated`, the Intake app **stops being navigation** on both sides.
- On her side it becomes a quiet done state inside the Strategy corner: `Strategy → Intake history` — the round list, one line each, and the reopen action.
- Reopening a round (S10) returns Intake to the navigation on both sides, holding only the reopened parameters.
- On the client's side it is simply not rendered. Their past answers stay readable through their own door.

Nothing is deleted, ever (S9).

### 5.5 The owner corner — Strategy and Switches

PLAN §2 item 2: *"plus Strategy and Switches as owner-only controls in the corner."* PLAN §3.10: *"Strategy is not a switch. It is the always-on decision layer that OWNS the switchboard — her space, present in every profile."*

- **Where it is:** desktop — pinned at the bottom of the sidebar, below the three apps, visually separated. Mobile — a button in the top-right of the header that opens the corner as a full-screen sheet. It is **never** a fourth item in the bottom tab bar: the bottom bar is the three apps, and the corner is a control, not an app.
- **Panels:** Derivation (spec 22 §8) · Gate set (spec 22 §8.4) · **Switches** (the switchboard, spec 22 §8.5) · Channels and connections (spec 22 §8.5's channel requirement, spec 26's connection state; tokens are entered here and are returned to nobody, spec 26 §12) · Brand book (visual-branding) · Intake history (§5.4) · Lifecycle (§5.7).
- **Audience: owner, always, in every position of every switch.** `strategy.derivation`, `strategy.gate_set`, `strategy.switchboard`, `strategy.lock` are all fixed-active owner switches (spec 22 §9.2). The corner does not exist for any non-owner login — not greyed, not present.
- The corner is present in every profile, including a `setup` profile with nothing else rendered. It is how a profile gets from nothing to locked.

### 5.6 The cascade trace on screen

Spec 22 §8.5 requires the switchboard to show, for each switch, *"what it turns off if she moves it: the cascade set, computed by `cascadeOf`, showing her side AND the client's."* This spec renders it.

Moving any switch opens a preview before it commits:

```
Turning off  Platforms → LinkedIn

Disappears for you                      Disappears for them
  · LinkedIn formats in the seed          · LinkedIn in the strategy summary
    picker and the costume surface        · nothing else — they had no others
  · LinkedIn strategy questions
  · the LinkedIn channel
  · the LinkedIn column in Slices,
    Scorecard and Funnel

Stays, read-only: 11 past LinkedIn pieces and their numbers.
```

Three rules for the trace:

1. It is generated from `cascadeOf(switchId)` and the feature registry — **never hand-written per switch.** A screen that forgets to declare its switch is a screen that goes missing from the trace, which is exactly why §17.5 exists.
2. It always shows both columns, even when the client column is empty, because switches design her dashboard too (PLAN §3.4) and she needs to see when they do not.
3. It always states what survives at `history`. S9: turning something off never removes its history.

### 5.7 Leaving, and no sideways navigation

**Leaving a profile means going back to the shelf. There is no other exit.**

- Inside `/profile/<id>/*`, no rendered element links to another profile. Not a switcher, not a dropdown, not a recent list, not a keyboard shortcut, not a breadcrumb.
- The existing cross-profile `components/Sidebar.tsx` — the profile list that lives beside every client screen today — is **retired from the profile interior.** It is the one-site-with-toggles interface in a single file. It stays in the repo, unimported by the shell, until the last legacy route is removed (§16.6).
- The shell stores no "last profile opened" and offers no return-to-where-you-were. Deliberately: the shelf is the only entrance, and a shortcut past it would re-create the toggling the plan retired.
- **The one exception, which is not an exception:** the today strip and the weekly pulse live on the shelf, not inside a profile. Tapping through them is entering from the shelf, which is the normal route.

This is acceptance test §17.1, and it is checked two ways — statically over the source and dynamically over the rendered navigation.

### 5.8 Lifecycle inside a profile (S22)

| State | The interior |
|---|---|
| `setup` | Intake (if configured) and the Strategy corner. Creation and Analysis are **not rendered** — creation cannot open until strategy locks (spec 22 §8.7; specs 23 §2.3, 24 §2.3) |
| `active` | Everything her switches grant |
| `paused` | Everything renders and reads. The Engine Room, the costume surface and drafting are read-only (specs 23–25 §2.3): the bank browses, extraction refuses, nothing resolves. Client-audience surfaces read `history`. One line at the top of the profile: *"Paused since 3 June."* |
| `closing` | As `paused`, plus: connections show revoked in the Health tab with the honest reason, and the corner offers the export package |
| `archived` | Everything renders read-only. No write control is rendered anywhere — not disabled, not present |

A read-only surface says so once, at the top, in her language, with a date. It never disables a hundred buttons and leaves her guessing which one is broken.

---

## 6. The render law — what NOT RENDERED means

PLAN §2 item 2: *"Whatever the switches turn off is not grayed out — it is NOT RENDERED."* S9 splits "off" into three, and the shell honours all three:

| Resolved state | On screen | In the payload |
|---|---|---|
| `active` | Renders, writable per audience | Present |
| `history` | Renders **read-only**, with one line saying since when and why | Present, refused on write (spec 21 §5.2) |
| `hidden` | **Nothing.** No tab, no label, no placeholder, no disabled control, no empty state, no aria-hidden node | **Absent** — stripped server-side by the declarations before the payload leaves |

The last column is the part that matters. "Not rendered" is not a CSS state; it is a server-side fact. A hidden thing is absent from the role-filtered body (`filterStateForRole` → `filterBodyForNonOwner`, spec 21 §6), and the shell simply has nothing to draw. CLAUDE.md rule 2 stands: the UI never solves a visibility problem the server should have solved.

Concretely, `platforms.linkedin → hidden` on a profile means: no LinkedIn in the format picker, no LinkedIn in the costume surface's platform dimension, no LinkedIn strategy questions in intake, no LinkedIn channel row in the corner, no LinkedIn column in Slices, Scorecard or Funnel, no LinkedIn in the compare surface's selectable pieces, and no LinkedIn word in the packet sent to any model — on her side and the client's, in both directions (PLAN §3.4; spec 21 §10 test 3; spec 27 §18.3). Test §17.4.

---

## 7. The client's profile

### 7.1 No shelf

PLAN §2, closing line: *"A client's login skips the shelf entirely — they land inside their profile, seeing only what their switches grant."*

- A client login with **one** binding: `/` and `/shelf` both land them at `/profile/<their id>`. The shelf is not rendered, not linked, and not reachable.
- The payload a client login receives contains **only their own bound profiles** — spec 21 already enforces this (`filterStateForRole` returns `bindings: bindingsForRole(...)` and only allowed profiles). The shell adds no second guarantee; it relies on the one that is already server-side, and re-tests it (§17.3).

### 7.2 The mini-shelf

PLAN §11's ruling on spec 21 Q3: *"A person holding bindings to several profiles gets a picker limited to THEIR profiles only — never anyone else's."*

- A person with two or more bindings lands on a mini-shelf at `/shelf`: their profiles, as cards, and nothing else.
- **No today strip. No weekly pulse. No add-profile. No counts that reveal her workshop** — a mini-shelf card carries the profile name, its color, and at most one door-shaped line: *"1 waiting for your review."* Counts that come from behind a door they do not hold are not composed at all.
- A profile whose lifecycle grants them no doors (`paused`, `closing`, `archived`) is not listed. If that leaves one profile, the mini-shelf is skipped and they land in it. If it leaves none, they get one plain line and no navigation.
- **Switch:** `client_access.mini_shelf` (new, fixed, §13) — fixed because it is structural: it renders exactly when a person holds more than one live binding, and there is no position in which one binding should show a picker.

### 7.3 The windows

A client gets the same frame and the same routes; the resolver removes everything their doors do not grant. What is left is the four give-points and the see-points, and nothing else (PLAN §4).

| Window | Route | Door | Renders when |
|---|---|---|---|
| **Brand** — their strategy summary (the locked version only) and their obligations list | `/profile/<id>` | `see:strategy`, `see:obligations` | strategy has locked and the summary's switches resolve active (spec 22 §10) |
| **Intake** — their open round's questions, their submitted answers read-only, and the client-ideas lane where working-mode grants it | `/profile/<id>/intake` | `give:intake` | any round sent to them is not yet curated (§5.4) |
| **Content** — upcoming content and the calendar; the review queue with the allowed verdicts (S20), and the perception question at the verdict | `/profile/<id>/creation/board` | `see:upcoming`, `give:review`, `give:perception` | `creation.review` / `creation.scheduling` resolve active |
| **Assets** — their own material, and dropping more | `/profile/<id>/creation/assets` | `give:assets` | `assets.client_upload` resolves active |
| **Results** — the latest approved publication (spec 27 §14) | `/profile/<id>/analysis` | `see:analysis` | `analysis.client_publication` resolves active |

**Their landing** is Brand if it renders, else the first window in the order above that does. Their navigation is a bottom tab bar of exactly the windows that render — at most five, usually two or three.

**The Content window is a projection, never a copy** (PLAN §3.11). It renders:

- pieces at `review`, `approved`, `scheduled`, `posted` only — never `idea`, never `build` (spec 24 §13.2);
- with `costume`, `birth`, `batch_id`, `materials` and `notes` stripped (spec 24 §13.2);
- and the draft itself through `clientPreviewOf(draftVersion)` — a server-side **whitelist** of presentational fields, never a blacklist (spec 25 §12.2).

**The Results window renders a publication, never a live query** (spec 27 §14). Before she approves the first one: *"Your first monthly summary will appear here once it is ready."*

### 7.4 What no switch can grant

The workshop rule is absolute (PLAN §4, CLAUDE.md rule 1, KRNL OS rule 1). **No switch, in any position, and no shell state, may render for a client:**

the Engine Room · a capture, a proposal or a seed · a costume, a variant grid or a birth snapshot · an internal brief · a draft before review or any version history · a gate verdict or an override · a handoff · an engine run, a packet, or a cost · a format-rule override · her notes, decisions, requests, pipelines, effort or money · the switchboard, the gate set, the derivation workspace, or any strategy internal · the today strip · the weekly pulse · sync health · a comparison · a verdict internal · the shelf · **another profile, in any form, including its name.**

The shell does not enforce this — the declarations do, server-side, and every one of specs 22–27 states it for its own paths. The shell's obligation is simpler and absolute: **it never routes around them.** No client route reads from an owner path; no client screen composes from data that was filtered out. Test §17.2 and §17.3.

### 7.5 Lifecycle for a client

Per spec 22 §11.1's corrected table: `setup` → `give:intake` only. `active` → the four gives and the see-points their switches grant. `paused`, `closing`, `archived` → no doors.

A client login on a profile granting no doors gets one screen with one line: *"This workspace is closed for now. Manmeet can reopen it."* Not an error, not a login failure, not a blank page. They keep their login; it simply has nothing behind it today.

---

## 8. Mobile first

PLAN §2 item 4: *"She and her clients live on phones: bottom tab bar on mobile, sidebar on desktop, same three apps. The floating owner chat stays on every screen, both layouts."*

**Mobile (default, ≤ `md`)**

- Bottom tab bar: the three apps (owner) or the granted windows (client). Never more than five items; the client's set is capped by construction.
- Profile header: back-to-shelf, name, corner button (owner only).
- Creation's five sub-tabs: a horizontally scrollable segmented row under the header. Not a second bottom bar.
- Analysis's eight tabs: a bottom-sheet picker (spec 27 §5).
- The Engine Room: box on top, bank below; proposals as a bottom sheet; the seed sheet full-screen (spec 23 §3.2).
- Board stages: stacked full-width columns, never sideways scroll. This is her 2026-07-17 fix and it is house style now, not a preference.
- The shelf: single column — cards, then the strip, then the pulse.

**Desktop (≥ `md`)**

- Left sidebar inside a profile: the three apps, then a separator, then the corner. **Never the profile list.**
- The shelf: no sidebar at all, full-width card grid.
- Sub-tabs as a row; Analysis tabs as a row.

Every screen is verified interactively at 375 px and at desktop before it is called done — the existing discipline, kept.

---

## 9. The floating owner chat — frozen, mounted, untouched

PLAN §11 Q1, her ruling: the chat *"deserves its own separate thing, designed AFTER this structure is ready"*; `chatLog` and the untagged inbox are FROZEN; *"the live chat keeps working exactly as today, outside the new tree, untouched by migration."* PLAN §2 item 4 requires it on every screen, both layouts.

**What this spec does:** nothing to the chat except keep it mounted.

- It stays mounted in `app/layout.tsx`, above every route, exactly as today. Every new route lives under that layout, so the widget appears on the shelf, in every profile, in every app, on every tab, in both layouts, with no per-route mounting anywhere.
- Its own rules stay its own: owner-only (`role !== 'owner'` returns null), hidden on `/p/` pages, full-screen on phones, corner window on desktop.
- Its routing brain is unchanged. It files into My Day, client agendas, cards and observations exactly as it does today.

**What the build may not do:** modify `components/ChatWidget.tsx` or `app/api/chat-brain/route.ts`; make the chat profile-aware; pass it the current profile; move its thread into the tree; give it a new switch; restyle it to the profile's accent; or add a shell control that opens, closes, or positions it. If a shell change would require editing either file, the shell changes instead. Its switch stays `owner.chat` (spec 21 §8.10), owning the two frozen paths, unchanged.

**One named consequence.** Because the chat and the untagged-observations inbox are frozen at owner level, and because her *tagged* observations migrated into each profile's `logs/observations` (spec 21 §8.8), a tagged note is readable in two places until the chat's own spec lands: the frozen `/observations` inbox and the profile's Logs → Notes. That is the freeze doing what a freeze does, named here rather than quietly fixed. §16.5 narrows the legacy route to the untagged half only after the last profile has cut over — the earliest point at which narrowing it changes nothing she is using.

---

## 10. The public preview deep link (PLAN §11 Q2)

Her addition, on record, and assigned to this spec by name: *"when she shares a link (e.g. on WhatsApp) with a client who HAS a binding, the link should land them INSIDE the platform — their profile's review window, from which they can browse their other windows — with the plain public page as the no-login fallback. Build item for the client-side regroup."*

**The resolution order at `/p/<shareId>`**, server-side, in this order:

1. Look up the preview by `shareId` — the existing `findPreviewPost`, unchanged.
2. **No preview found** → today's not-found page, unchanged.
3. **No session cookie** → the plain public page, exactly as today. This is the fallback and it is the common case.
4. **A session exists.** Resolve the preview's profile and its piece.
   - **Owner** → into the profile at the piece: `/profile/<id>/creation/board?piece=<pieceId>`.
   - **A binding to that profile, with `give:review` granted by the lifecycle and `creation.review` resolving active** → their review window at that piece: `/profile/<id>/creation/board?piece=<pieceId>`, which for a client renders the review projection (§7.3). From there their other windows are one tap away, which is the whole point of her ask.
   - **A session with no binding to that profile** → the plain public page. Never an error, never a message that names the profile, never a redirect that reveals the binding state to anyone but the session holder.
5. **The preview has no resolvable piece** → the plain public page, for everyone including her. Legacy previews are exactly this case: *"which piece the old preview belongs to"* is one of the 16 questions spec 21's migration left for her. An unresolvable link degrades to what it already was.

**The two switches, and the honest split:**

- `creation.review_public_link` at `hidden` → the URL serves **nothing** to an unauthenticated viewer. The link is revoked, and revoked means gone. A bound client hitting the same URL still deep-links, because their access comes from their door, not from the public link.
- `creation.review_deeplink` at `hidden` → no redirect for anyone; the public page for everyone. The honest off-switch for a client who prefers a link that never asks them to log in.

**Spec 21's blank default is filled here.** Spec 21 §8.6 left `creation.review_public_link` with no suggested default pending Q2. Q2 is answered: *"public preview links SURVIVE, behind their switch, default on for clients without logins."* So the suggested default becomes `active`, marked as a suggestion like every other (§15.3). She finalizes it, as she finalizes all of them.

The chat stays hidden on `/p/` (§9). Nothing about the public page's rendering changes.

---

## 11. The route map — every route's fate

Column meanings: **Fate** uses spec 21 §8's vocabulary — `active` (kept, re-addressed), `moved`, `redirect`, `frozen` (retained, read-only, not re-pointed), `leaves` (PLAN §7).

### 11.1 Entry and the shelf

| Today | Fate | Where it goes |
|---|---|---|
| `app/page.tsx` — passcode / entry | active | after auth: owner → `/shelf`; client with 1 live binding → their profile; client with 2+ → the mini-shelf |
| `app/clients` — the client list home | **moved** → `/shelf` | becomes the shelf (spec 21 §8.1 already named it). `/clients` permanently redirects |
| `components/Sidebar.tsx` — the cross-profile profile list | **frozen** | retired from the interior (§5.7). Unimported by the shell; removed with the legacy routes at §16.6 |
| `app/me` — My Day, client-task and content-task halves | **moved** | the shelf's today strip (§4.3) |
| `app/me` — My Day, personal tasks and day tracking | **leaves** (PLAN §7) | §11.4 |

### 11.2 Inside a profile

Every `/client/[id]/*` route below **keeps rendering, unchanged, until that profile cuts over** (§16.3). After cutover it permanently redirects to the address in the right-hand column.

| Today | Fate | New address |
|---|---|---|
| `/client/[id]` (Dashboard tab, monthly agenda) | moved | `/profile/<id>/creation/logs` |
| `/client/[id]/content` | moved | `/profile/<id>/creation/board` |
| `/client/[id]/kanban` (already a legacy redirect) | **removed** | redirects to `/profile/<id>/creation/board` for one release, then gone |
| `/client/[id]/pillars` (already a legacy redirect) | **removed** | same |
| `/client/[id]/evergreen` (tab already retired) | **removed** | its entries migrated as seed-capture input (spec 23 §4.3); no route survives |
| `/client/[id]/studio` (tab already removed, frozen) | **removed** | frozen data stays, no route (spec 21 §8.6) |
| `/client/[id]/journey` | **split** | goals → `/profile/<id>/analysis/goals` · mix bars → `/analysis/scorecard` · momentum + money → `/creation/logs` (her profiles only) |
| `/client/[id]/analytics` | moved | `/profile/<id>/analysis` (spec 27's eight tabs) |
| `/client/[id]/lists` | moved | `/profile/<id>/creation/logs` (pipelines) |
| `/client/[id]/coldcalls` | moved | same |
| `/client/[id]/orders` | moved | same |
| `/client/[id]/catalogue` | moved | `/profile/<id>/creation/assets` (catalogue mode) |
| `/client/[id]/assets` | moved | `/profile/<id>/creation/assets` |
| `/client/[id]/references` | moved | `/profile/<id>/creation/references` |
| `/client/[id]/brand` | moved | `/profile/<id>/strategy/brand` (owner) · the client's Brand window (§7.3) |
| `/client/[id]/previews` | moved | `/profile/<id>/creation/board` (review) |
| `/client/[id]/onboarding` | moved | `/profile/<id>/intake` |
| `/client/[id]/answers` | moved | `/profile/<id>/creation/board` (funnel) |
| `/client/[id]/layout.tsx` — the nine-tab bar | **removed** | replaced by the three-app frame (§5.1) |

### 11.3 Owner-level and public routes

| Today | Fate | Note |
|---|---|---|
| `/p/[shareId]` | **active, enhanced** | §10. The public page itself is unchanged |
| `/share-target` (Android share-to-save) | active | unchanged; after cutover it writes into the chosen profile's `assets/sets`. Still Android-only (CLAUDE.md gotcha 4) |
| `/connections` (owner-only, IG tokens) | **moved** | per-profile: `/profile/<id>/strategy/channels`. A channel belongs to a profile (S17; spec 22 §8.5). Redirects to `/shelf` for one release, then gone |
| `/observations` | **frozen** | unchanged while any profile is pre-cutover; narrowed to the untagged inbox afterwards (§9, §16.5) |
| `/brain` — brain dump | **leaves** (PLAN §7) | §11.4 |
| `/map` — container map | **leaves** (PLAN §7) | §11.4 |
| `/api/*` | untouched | this spec changes no API except the two additions in §15 |

### 11.4 What leaves, and what "leaves" means

PLAN §7's list, and only that list: **My Day's personal side** (personal tasks, day tracking, the life-tracking half), **brain dump**, **container map**.

"Leaves" is defined by spec 21 §9.7 and is not a deletion:

1. The route stops rendering at cutover.
2. The data stays in the blob at state `history`. Nothing is removed by this spec, at any point, under any condition.
3. It is **exported to the vault** — one markdown export per slice, filed where thinking already lives.
4. It is removed **only on her word**, as a separate act, after she has the export in her hands.

The catalogue does **not** leave — PLAN §7 is explicit that it becomes an assets use-case behind `assets.catalogue_export`, and §11.2 gives it its address. The momentum and money meters do not leave either; they narrow to her own profiles (§5.2).

---

## 12. Addresses — every folder this spec reads and writes

PLAN §6 rule 3: no address, no build.

### 12.1 Read (and never written)

| Path | What the shell takes from it |
|---|---|
| `shelf/profiles` | the cards: name, color, `owner_kind`, `lifecycle` |
| `shelf/today-strip` | the strip's composition target (spec 21's declared owner-zone view over each profile's tasks) |
| `context/content-strategy/toolset` | the switch configuration, per profile, for the resolver |
| `context/content-strategy/visual-branding` | the accent color; the corner's Brand book panel; the client's Brand window |
| `context/content-strategy` (positioning, pillars, platforms, voice, audience-decided, goals, cadence, ctas, obligations) | the client's Brand window — **the locked version only**, per spec 22 §10 |
| `context/intake` | whether the Intake app renders; the round status on the card; the quiet-done list |
| `work-log/creation` | the card's counts by stage; the piece the deep link resolves to; the client's Content window (projected per specs 24 §13.2 and 25 §12.2) |
| `work-log/creation/review` | the review queue; the `/p/` link's target |
| `work-log/creation/scheduling` | the "n scheduled" count; the calendar |
| `work-log/logs/tasks` | the today strip's rows |
| `work-log/analysis/digests` | the weekly-pulse entries the shelf composes; the client publication the Results window renders |
| `work-log/analysis/study-own-data/sync-health` | the card's *"not collecting since…"* attention line |
| `state.bindings` (spec 21 §6, owner zone) | who lands where; the mini-shelf's contents |

Every one of these is read through the role-filtered payload. The shell never reads around `filterStateForRole`, and it never composes a client-facing screen from a path the filter would have removed.

### 12.2 Written

| Path | What, and when |
|---|---|
| `shelf/profiles` | one entry, when she adds a profile (§4.5). `fed_by: ['owner']`, already declared by spec 21 |

That is the complete list. Everything else the shell does is reading, routing, and rendering. Ticking a task in the today strip, submitting a review verdict, dropping an asset — each of those writes through the surface that owns it, at its own declared path, in its own scope, exactly as it does today.

### 12.3 Why there is no law-4 addition — the hard justification

Law 4 permits new folders and requires them to declare feeds and readers at birth. The bar this spec set for itself was higher: **a shell that stores things is a shell that can disagree with the tree.** Four candidates were considered and each one was refused:

1. **A stored per-profile card summary** ("2 in review · 4 scheduled"). Refused. It would be a second copy of information the pieces already carry, which PLAN §3.11 forbids by name, and it would go stale the moment a piece moved. The counts are computed at read time from `work-log/creation`, where they are true.
2. **A cross-profile pulse object.** Refused, and already refused once — spec 27 §13.2 settled it: each profile writes its own weekly-pulse entry into its own `digests`, and the shelf composes. PLAN §5.3: everything belongs to exactly one profile. Composition is not storage.
3. **A per-profile `interface_version` flag to control cutover.** Refused. The two conditions that make a profile ready — a migrated body and a locked strategy — are already recorded (`body_version`, `strategy_version`), so the flag would be a third statement of a fact stated twice, free to drift from both. Cutover is derived (§16.3).
4. **Navigation memory** — last profile opened, last tab, sidebar state. Refused for the first two on principle (§5.7: a shortcut past the shelf re-creates the toggling the plan retired). The third — the desktop sidebar's collapsed state — lives in `localStorage`, exactly as it does today. It never enters `AppState`, so it needs no address; if it ever did enter `AppState`, it would need one, and the build would not compile without it (spec 21's type-bound orphan check).

If a shell need arises during the build that genuinely cannot be met by reading, it declares its feeds, readers, switch, states, history and audience at birth, or it is not built. No exception is pre-granted here.

---

## 13. Switches registered

PLAN §6 rule 3, her law: every feature registers its switch at birth. Suggested defaults are suggestions — **she finalizes every position** (PLAN §3.4).

### 13.1 Reused, unchanged

`shelf.profiles` (fixed) · `shelf.today_strip` · `client_access.login` · `owner.chat` (frozen) · `intake.questionnaire` · `intake.rounds_reopen` · `strategy.fixed` · `strategy.derivation` · `strategy.gate_set` · `strategy.switchboard` · `strategy.lock` · `strategy.visual_branding` · `creation.board` · `creation.engine` · `creation.making` · `creation.review` · `creation.review_public_link` · `creation.review_perception` · `creation.scheduling` · `creation.publishing` · `creation.channels` · `creation.funnel` · `creation.funnel_replies` · `assets.*` · `references.*` · `logs.*` · `analysis.*` · `platforms.*`.

The shell adds no switch to anything that already had one. Every app, tab, panel and picker it renders is governed by the switch its owning spec already registered — that is what makes the cascade trace complete.

### 13.2 New

| id | owns | requires | dependents | audience | states | suggested | fixed |
|---|---|---|---|---|---|---|---|
| `shelf.weekly_pulse` | the pulse block on the shelf (the composition, not the entries) | `shelf.profiles` | — | owner | active · hidden | `active` | no |
| `shelf.add_profile` | the add-profile tile and the one write in §12.2 | `shelf.profiles` | — | owner | active | `active` | **yes** |
| `client_access.mini_shelf` | the multi-binding picker (§7.2) | `client_access.login` | — | client | active | `active` | **yes** |
| `creation.review_deeplink` | the logged-in branch of `/p/<shareId>` (§10) | `creation.review_public_link`, `client_access.login` | — | client | active · hidden | `active` | no |

**Why two are fixed.** `shelf.add_profile`: she must always be able to add a profile — a dashboard whose owner can be locked out of creating a workspace is broken, not configured. `client_access.mini_shelf`: it is structural, not a preference — it renders exactly when a person holds more than one live binding, and there is no honest position in which a single binding should show a picker. Both get records with `allowed_states: ['active']` and a `fixed` marker so the registry stays exhaustive, per spec 21 §5.4.

Following spec 22 §9.2's precedent, `shelf.weekly_pulse` carries `owns: []` for the per-profile entries — the governing switch of a PATH stays the one its declaration names (`analysis.pulse_owner`), so nothing is re-pointed.

### 13.3 Validation at strategy lock

One check added to `validateSwitchConfig` (spec 21 §5.3):

- `creation.review_deeplink` cannot be `active` while `client_access.login` is off. A deep link into a profile nobody can log into is a redirect to a login wall, which is worse than the public page it replaced.

---

## 14. Audiences and doors

| Surface | Owner | Client | Door |
|---|---|---|---|
| The shelf, its cards, its counts | yes | **never** | — |
| The today strip | yes | **never** | — |
| The weekly pulse | yes | **never** | — |
| Add profile | yes | never | — |
| The mini-shelf (their own profiles only) | n/a | yes, when they hold 2+ live bindings | derived from their own bindings |
| The profile frame, header, back-to-shelf | yes | yes (their profile only) | — |
| The three apps as navigation | yes | only the windows their doors grant | per window |
| The Strategy / Switches corner | yes | **never**, in any switch position | — |
| Brand window — the locked strategy summary and obligations | yes | yes | `see:strategy`, `see:obligations` |
| Intake window | yes | yes, their own rounds only | `give:intake` |
| Content window — upcoming, calendar, review, perception | yes | yes, projected and stage-gated | `see:upcoming`, `give:review`, `give:perception` |
| Assets window | yes | yes | `give:assets` |
| Results window — the approved publication | yes | yes | `see:analysis` |
| The floating chat | yes | **never** (its own `role !== 'owner'` guard, unchanged) | — |
| `/p/<shareId>` public page | yes | anyone with the link, while the switch is active | delivery route into `give:review`, not a fifth door |

**No fifth door.** This spec creates no new client write anywhere. The deep link is a delivery route into the existing review door — PLAN §11 Q2 answered exactly that question, and the answer was that the link survives *behind its switch*, landing a bound client in the door they already hold. The validator's no-fifth-door check passes unchanged.

---

## 15. Corrections and additions to shipped code

Named openly, changed in place, no parallel versions.

### 15.1 The render resolver (new)

`lib/tree/render.ts` — `renderState(profileId, switchId, role)`, composing cascade + lifecycle + audience + door (§3.2). It is the only module the shell may consult about visibility, and no component may import `cascade.ts` or the switch config directly (test §17.5). It weakens nothing: it is a read-side helper over guarantees the server already enforces.

### 15.2 `windowsForBinding` (new, in `lib/access.ts`)

One exported function returning the ordered list of client windows a binding grants, derived from doors + switches + lifecycle. The client's navigation is rendered from it, and the same list is asserted server-side. **It grants nothing** — it is a projection of what the filter has already decided. CLAUDE.md rule 2 stands: filtering only gets stronger.

### 15.3 `creation.review_public_link` gets its suggested default

Spec 21 §8.6 deliberately left it blank pending Q2. Q2 is answered (PLAN §11): links survive, *"default on for clients without logins."* The registry entry gains `suggested_default: 'active'`, marked as a suggestion. Her positions are still hers.

### 15.4 What is deliberately not changed

`filterStateForRole`, `mergeRoleWrite`, and `filterBodyForNonOwner` keep their shapes and their guarantees. The entry-level narrowing at `work-log/creation` belongs to spec 24 §13.2 and the publication rule to spec 27 §14 — this spec depends on both and re-tests both, and it must not re-implement either.

---

## 16. Migration and cutover

The hard constraint: **she uses this every day, and so do her clients.** Nothing below is allowed to take the app away from either of them for an afternoon.

### 16.1 The shape of the cutover

Not a switch-flip for the whole app. **Per profile**, with the legacy screens working the whole time, exactly as spec 22 §13 requires:

> *A profile migrated by spec 21 keeps its legacy creation surface working until it locks. The refusal binds new writes through the tree, not the legacy slices spec 21 deliberately left rendering.*

### 16.2 Order of build

1. **The frame, unreachable.** Routes, the app shell, the header, the nav, the skin, the resolver. Nothing links to it yet; the whole app still runs on the legacy routes. Shippable and invisible.
2. **The resolver and the render law**, with tests, including the cascade trace generator. Still nothing links to it.
3. **The shelf, replacing `/clients`.** This is the first visible change, and it is safe because a card can open either destination (§16.3). She gets the shelf, the today strip and add-profile on day one; the pulse block renders its empty line until spec 27 ships.
4. **The profile interior for her**, mounting the existing views at their new addresses. Reachable only for a cut-over profile.
5. **The client shell** — windows, mini-shelf, landing, and the projections specs 24 and 25 already define.
6. **The deep link** (§10).
7. **Per-profile cutover** (§16.4).
8. **Legacy retirement** (§16.6).

### 16.3 When a profile cuts over — derived, never flagged

A profile renders in the new shell when **both** are true:

- its body is migrated for real (`body_version >= 21`, from `apply: true`), and
- its strategy has locked (`strategy_version != null`, spec 22 §8.6).

Until then its card on the shelf opens the **legacy workspace** (`/client/<id>`), which keeps working exactly as it does today. One shelf, two destinations, for as long as it takes.

This is why cutover needs no new state (§12.3) and why it is honest: those two conditions *are* readiness. A profile whose strategy has not locked has no switch positions set by her, and a shell driven by unset switches would be guessing at what to render — which is precisely the failure the plan's order (intake → curation → strategy → switches → creation) exists to prevent.

**The rollback path, stated so it exists before it is needed:** the legacy route tree stays deployed and reachable by direct URL through the whole cutover. If the new shell misbehaves on a profile, that profile's legacy screens are one URL away and its data is untouched — the body was written *alongside* the legacy slices, never instead of them (spec 21 §9.5).

### 16.4 The order of profiles

1. **ResumeGuru** — hers, the same pilot spec 21 and spec 22 used. A client profile is never the experiment.
2. Her other profiles (KRNL, LinkedIn, Freelance Projects).
3. Client profiles, one at a time, each verified against §17 on real data before the next starts.
4. **A client login is told before their profile moves.** Not by the app — by her, in her own words, on WhatsApp. The shell ships no announcement banner and no what's-new modal.

### 16.5 What happens at each cutover

- The profile's `/client/<id>/*` routes begin permanently redirecting per §11.2.
- Its shelf card begins opening `/profile/<id>`.
- Nothing is deleted. Nothing is copied. No data is written by the cutover itself — it is a routing change over data that already moved.
- When the **last** profile has cut over: `/clients` and `/connections` redirects can be removed, `components/Sidebar.tsx` can be deleted, and `/observations` narrows to the untagged inbox (§9).

### 16.6 The leaves list

Run once, at the end, and not before — she may want a last look at any of it:

1. Export My Day's personal half, the brain dump, and the container map to the vault, one markdown file each.
2. Remove their routes.
3. Leave every byte of their data in the blob at `history`.
4. Remove the data **only on her word**, as a separate act (spec 21 §9.7, PLAN §11 Q5).

---

## 17. Acceptance tests

In spec 21's discipline: plain Node, no dependencies, no build step, added to `tests/` and run by `npm test` alongside every existing check, all of which must stay green. Tests 1–13 are runnable that way — most of them assert over the **server-side role-filtered payload and the resolver**, which is where the guarantee actually lives. Tests 14–16 are the ones that have to be seen; they are browser checks at desktop and 375 px, and they are named as such rather than pretended into unit tests.

1. **No sideways profile navigation exists.** Two checks, both required. *Static:* no module under `app/profile/` or `components/shell/` contains a link, `router.push`, or route string resolving to a profile id other than the one in the current route — and none imports `components/Sidebar.tsx`. *Dynamic:* the rendered navigation tree for profile A contains zero occurrences of profile B's id or name. The only route out of `/profile/<id>/*` is `/shelf`.
2. **A hidden switch renders nothing.** With `platforms.linkedin → hidden`: the served payload contains no LinkedIn entry at any path, and the rendered tree contains no node for it — not a disabled control, not an empty state, not a hidden element. The same check at `history` renders the past pieces read-only with a since-line, and every write against them is refused. The check FAILS when the resolver is bypassed.
3. **A client sees no shelf.** A client role with one binding requesting `/shelf` lands in their profile; with two bindings they get the mini-shelf containing exactly their two profiles, with no today strip, no pulse block, and no add-profile. Their payload contains no other profile's id, name, or color. Re-runs spec 12's 19-check security suite against the resolver.
4. **The cascade trace on screen.** The switchboard's preview for `platforms.linkedin → hidden` lists exactly `cascadeOf('platforms.linkedin')`'s screens, split into her column and the client's, and names what survives at `history`. After applying it, a crawl of every screen in the profile — hers and the client's — finds zero LinkedIn strings. Reversed with Instagram, it behaves identically (PLAN §3.4's canonical trace, spec 21 test 3).
5. **One resolver.** No component imports `lib/tree/cascade.ts` or reads a switch configuration directly; every visibility decision goes through `renderState`. A component that reads a position itself fails the build.
6. **The container rule.** A Creation app whose five sub-tabs all resolve `hidden` is not rendered; an Analysis app whose eight tabs all resolve `hidden` is not rendered; a profile where all three apps are hidden opens on the corner with one line and no empty tab bar.
7. **The card shows status, never content.** For a profile holding pieces, seeds, notes and drafts, the composed card payload contains only: name, color, lifecycle, counts, and one attention string drawn from a fixed vocabulary. No title, hook, caption, seed name, note or metric value appears in it. Adding a new field to a piece does not change the card's payload.
8. **The today strip.** It carries client tasks and content tasks from every profile, and zero personal tasks. Ticking a row writes to exactly one profile's `logs/tasks` scope. A client login's payload contains no strip at all. A profile with `shelf.today_strip → hidden` contributes zero rows and no other profile's rows change.
9. **Momentum stays hers.** On a profile with `owner_kind: 'client'`, `logs.effort_meter` resolves `hidden` for the owner too, the Effort panel is absent from Logs, and the payload contains no effort entries. On `owner_kind: 'hers'` it renders (PLAN §7).
10. **The client's windows are exactly the doors.** For each of the four gives and four sees, granting the door renders the window and revoking it removes the window and its data from the payload. No combination of switch positions renders the Engine, a brief, a draft version, a gate verdict, her logs, the corner, the shelf, or another profile. Each check FAILS when its guard is removed.
11. **The deep link, all five branches.** No session → public page. Owner → the piece inside the profile. Bound client with `give:review` → their review window at that piece. Session with no binding to that profile → public page, with no response difference naming the profile. Unresolvable piece → public page. With `creation.review_public_link → hidden`, the unauthenticated request serves nothing while the bound client still deep-links; with `creation.review_deeplink → hidden`, everyone gets the public page.
12. **The chat is mounted and untouched.** The widget renders on `/shelf` and on every route under `/profile/<id>/*` for the owner, in both layouts; it is absent for every non-owner role; it is absent on `/p/`. The build's diff contains no change to `components/ChatWidget.tsx` or `app/api/chat-brain/route.ts`.
13. **The route map is complete and nothing is deleted.** Every route present in the app today appears exactly once in §11 with a fate; a route with no fate fails the test (the orphan check, applied to routes). After the shell ships, every `leaves` and `frozen` slice is still present in the stored blob at `history`, byte for byte.
14. **The cutover keeps working.** A migrated-but-unlocked profile: its shelf card opens the legacy workspace, its legacy screens render exactly as before, and its `/client/<id>/*` routes do not redirect. The same profile after locking: the card opens the new shell, the legacy routes redirect per §11.2, and no data changed in between. *(Browser check, plus a payload assertion that the two states differ only in routing.)*
15. **Mobile first.** At 375 px: bottom tab bar on every profile screen; Board stages stacked full-width with no sideways scroll; Creation's sub-tabs scroll horizontally without a second bottom bar; Analysis's tabs open as a sheet; the corner opens full-screen; the shelf reads cards → strip → pulse in one column. *(Browser check.)*
16. **Lifecycle rendering.** Each of the five states renders its card per §4.6 and its interior per §5.8; a client on a `paused`, `closing` or `archived` profile gets the one closed line and no navigation; no write control is rendered anywhere in an `archived` profile. *(Browser check for the interiors, payload assertion for the client's doors.)*

---

## 18. Deliberately out of scope

Named rather than left silent, per spec 21's discipline.

- **The insides of any screen.** Specs 22–27 own them. Where this spec describes a screen, it describes its frame, its address, and its audience.
- **The chat's redesign.** Frozen (PLAN §11 Q1); its own spec after the restructure. The owner's-desk idea is shelved with it.
- **The untagged observations inbox.** Frozen with the chat. §9 names the one visible consequence honestly.
- **WhatsApp.** Parked at Meta's registration step (spec 18B), unchanged.
- **New capability of any kind.** No global search, no cross-profile board, no notifications, no what's-new, no onboarding tour, no theme, no offline mode.
- **Performance work.** The blob's ~5 MB and multi-writer triggers (spec 21 §3.3) are real and unchanged; client logins writing give-points bring the second one closer. This spec does not move storage, and says so rather than pretending the trigger went away.
- **The parameter vocabulary, the switch positions, the retention values.** All hers, all queued for the collective phase.
- **The deploy path.** DEPLOY.md and CLAUDE.md rule 6 stand: her explicit go, every time.

---

## 19. Open question — one, and it is hers

Written per PLAN §6: a question a fresh spec chat cannot answer from the vault is a hole in the plan, not something to guess. Six candidates were checked against the plan and answered from it — the client's landing order (PLAN §4's own ordering of see-points), the today strip's contents (PLAN §2 plus spec 21 §8.8), where the weekly pulse lives (spec 27 §13.2), whether a client may reach the shelf (PLAN §2), whether the deep link is a fifth door (PLAN §11 Q2 with S19), and what "off" looks like (PLAN §2 with S9). One did not survive the check.

**Q1 — What does a login that is neither hers nor a four-door client see?**

The plan's audience vocabulary has two values: owner and client (PLAN §4, and the `audience: owner | client | both` field spec 21 built from it). The live app has five logins, and two of them fit neither value:

- **The intern** — bound as `kind: 'staff'` to Divine and ResumeGuru. She works *inside* Manmeet's side: the board, assets, references. Under the shipped resolver, staff receive the same declaration-filtered body as a client (spec 21's closed leak, deliberately: *"`audience: owner` has to mean the same thing for the intern as for a client"*). In the legacy screens that costs nothing, because those screens render legacy slices. **In the new shell, which renders from the body, the intern would land in a client-shaped profile with the four doors and nothing else — no board, no assets library, no working surface.**
- **Sonia** — bound as `kind: 'client'`, and her daily surfaces are Orders and the catalogue selection tool. `logs/pipelines/orders` is `audience: owner`, and PLAN §4 permits no fifth door. **Under the plan as written, Orders cannot render for a client login in the new shell.**

The plan cannot settle this: it never mentions staff, and the four-door law is exactly what makes Sonia's case unanswerable without her. Three shapes exist, and each is a different decision, not a different implementation — a third audience value would be a plan change, re-binding Sonia as staff would move her under whatever staff turns out to mean, and leaving both on the legacy screens is a smaller product than she has today.

**The interim behaviour, so nothing breaks while this waits:** a profile's cutover moves the **owner** and **client** logins to the new shell. A **staff** binding, and Sonia's binding, keep the legacy workspace for that profile until this is answered. Two shells coexist on one profile for as long as that takes — ugly, and honest, and it takes nothing away from anyone who is using it today. Nothing else in this spec depends on the answer.
