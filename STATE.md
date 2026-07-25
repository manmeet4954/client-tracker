# STATE - Client Dashboard

## 2026-07-25 — SPEC 21 IS BUILT (branch `claude/spec-21-data-layer-6d04af`, NOT deployed)

The data-layer restructure is built, in the order the spec set: declarations and
validator first, then path-scoped writes, then one pilot profile migrated. All
of spec 21's acceptance tests pass — **70/70**, via `npm test` (plain Node, no
dependencies, no build step). Typecheck clean, production build green.

**Nothing is deployed and nothing about the live app has changed yet.** The
deploy is hers per DEPLOY.md, and the real-data migration is one owner action
away (below).

### What is now true that was not true this morning

1. **Every folder in the plan's tree has a machine-checkable declaration**
   (`lib/tree/declarations.ts`): what feeds it, what reads it, the switch that
   governs it, its allowed states, how it remembers, who may see it, and which
   of the four client doors it belongs to. A read or write against an
   undeclared path throws. Law 2's nesting is real — `platforms/instagram/
   formats` resolves, and a format has no existence outside its platform.
2. **Every switch exists in one registry** (`lib/tree/switches.ts`), including
   the structural ones that can never move. The cascade resolves as the minimum
   of a switch and its prerequisites, and her canonical trace is a test:
   LinkedIn off removes its formats, its strategy questions, its channel and its
   analysis column — on her side and the client's, in both directions.
3. **The validator refuses the build** on an undeclared path, a feature with no
   switch, or a client audience with no door (`lib/tree/validate.ts`). It caught
   six real mistakes in the declarations while they were being written. The
   orphan check is type-bound: a new state slice with no address will not compile.
4. **The save race is closed.** `app/api/state` now takes `{ state, paths }` and
   merges only the declared paths. Two tabs editing different parts of the
   system both keep their work, where the second save used to erase the first.
   This had to land before anything migrated: under last-write-wins, every
   "append-only" guarantee in the amendments would have been a lie.
5. **Access binds by profile ID.** `RESTRICTED_MATCHERS` — the client-NAME
   regexes — are deleted from the access path. Renaming a profile can no longer
   cut off or open up a login. The regexes survive in one file, used once to
   write down the access that already existed, so nobody loses anything on the
   day this ships.
6. **ResumeGuru is migrated** into a path-addressed body: 59 entries across 44
   addresses, with a report that names every value moved, every value marked
   unverified, and every question that is hers to answer.

### The pilot, and what it wants from her

Pilot = **ResumeGuru** (one of hers — a client profile is never the experiment).
The migration writes the body ALONGSIDE the legacy slices; nothing is deleted
and every screen still renders exactly what it renders today. Switch positions
are **suggested, never set** — she sets them after intake → curation → strategy.

**Honest limit:** this machine has no access to the live database, so the pilot
ran against a fixture shaped like ResumeGuru, not her actual row. The real run
is one owner-only call away and is a DRY RUN by default:

- `POST /api/migrate-profile { "profileId": "<resumeguru id>" }` → the report,
  nothing written.
- Same call with `"apply": true` → writes the body, through the path-scoped door.
- A second run on an already-migrated profile is refused (no double entries).

The 16 questions the migration could not answer, and deliberately did not guess:
which offer is the hero · which part of the old audience field is what they said
vs what she decided · which platforms should offer the formats nothing has used
yet · a metric declaration for each of the 4 goals (analysis stays blocked per
goal until each has one) · the 3 subjects that came over as capture input, not
seeds (they need her narration before they can be locked) · which piece the old
preview belongs to · who owns @resumeguru.ai, its timezone, and whether we post
or they do · rights on every existing photo · which references came from the
client. All of them sit in the profile's sort queue and in the report.

### Frozen, exactly as PLAN §11 ordered

The **chat thread and the untagged inbox are untouched** — `chatLog` and untagged
observations are declared at `frozen/chat-log` and `frozen/observations-inbox`,
not migrated, not moved, still working exactly as today. Their own spec comes
after the restructure. Observations WITH a profile tag did migrate into that
profile's `logs/observations`.

Also frozen and named rather than left silent: the 2026-07-10 legacy card copies,
the Studio canvas, custom fields, `journey.nextSteps`, `ContentCard.role`.

### One real leak found and closed

Writing the security tests surfaced it: her per-profile notes and seed bank live
inside the body now, so the intern's login would have received them. Every
non-owner login now gets a body filtered by the declarations. The 24 security
checks were verified to FAIL when the guard is removed, then pass with it in.

### Two decisions the build had to make (both inside the plan, both recorded)

1. **A client who brings ideas gives them at intake, not into the seed bank.**
   Spec 21 §8.5 listed a `creation.seed_input_client` switch writing into
   `creation/topics`, calling it a "give-point 1 extension". S19 allows exactly
   four client doors, and the validator refused it. The route now honors both:
   the client's idea arrives through intake (give-point 1), and her curation
   turns it into a seed. Same capability, no fifth door.
2. **The shared-list collaborator is not "the client".** Spec 12's live feature
   lets another workspace edit rows of a list she shared. Declaring the client
   as a writer there would have punched a hole in S19, so the tree names a
   distinct writer, `collaborator`: one object she explicitly shared, verified
   server-side against the authoritative state, opening no door into any
   profile's tree. Spec 12's behavior is unchanged and its checks still pass.

### Next

1. Her look at the report, then the real pilot run on ResumeGuru (`apply: true`).
2. Then the remaining profiles, one at a time, per §9.4.
3. Then the intake spec (the parameter inventory, after her vocabulary session),
   the Content Engine family, the Analysis Engine family, the client-side regroup.
4. Deploy is hers, per DEPLOY.md, whenever she wants it — this branch has not
   been merged or pushed anywhere live.

Still owed by her, independent of all of this: the analytics setup day, the IG
collection stall (data lost daily — recording does NOT wait for the restructure),
and the chat brain v4 deploy go.

---

Previous entry: 2026-07-25. **THE MASTER PLAN IS BEING WRITTEN: `dashboard/PLAN.md` (DRAFT).** Her 2026-07-25 direction: one complete build plan documenting the whole system — profiles, the Context/Work Log tree (spec 20's structure, rescued onto this branch), the two engines (Content + Analysis) as products-inside-the-product, client give-points, and the build pipeline (Fable plan → Sol flows → Opus specs → agents build → Sol review). Once locked, every session reads PLAN.md first; specs that disagree with it get rewritten. Confirmed by her: her own workspaces (ResumeGuru, KRNL) are client profiles, she is client zero. 2026-07-25 (final): **THE PLAN IS LOCKED WHOLE — `dashboard/PLAN.md` is now the authority every session reads first.** Locked in one day: the tree (four rounds), the four laws, strategy-as-switchboard + every-feature-is-a-switch + the cascade, the three apps, the GUI mandate (profile-first, look delegated to Claude), the Content Engine map (Sol's architecture + seed taxonomy, five refinements resolved, the intelligence bar), the dictionary (5.3), and the Analysis Engine (her correction: quantitative core, sandcastles.ai reference, compare/A-B as the purpose, soft signals out of the math). Closed on her words: "I can trust you with the whole plan." 2026-07-25 (Sol round 1): Sol pressure-tested the plan; ALL 25 findings accepted on her yes — folded in as PLAN.md section 10 (binding on every spec) plus inline edits: the seed/piece law (seeds never have stages; pieces do), matched comparisons with age windows, context packets, switch validation, profile lifecycle, the dictionary's new "Piece" entry. **SPEC 21 IS WRITTEN** (2026-07-25, fresh Opus chat per the plan's working structure §6) — `specs/21 — Data-Layer Restructure.md`, committed, nothing built; five open questions raised to the control room. Full entry in the section directly below. Also still owed by her, independent of specs: the analytics setup day + IG collection stall fix (data lost daily), and the chat v4 deploy go. Everything below this line predates the plan and stands until the plan supersedes it.

## 2026-07-25 — SPEC 21 WRITTEN (the first spec under the locked plan)

`dashboard/specs/21 — Data-Layer Restructure.md` is written and committed.
NOTHING BUILT — it is a spec, and its build waits on the control room clearing
it plus the five questions below.

What it is: the ADDRESS LEDGER. Every slice of `AppState`/`ClientData`, every
component, route, API endpoint, and `ig_*` table now has one address in the
plan's tree (PLAN §3), with the folders it reads, the folders it writes, and
the switch it registers in `toolset/`. Nothing is left silent: each item is
`active`, `history`, `hidden`, `frozen` (retained read-only), or `leaves`
(PLAN §7), and the spec's own orphan check re-runs as a build test.

Also in the spec, because the amendments require them: the folder/switch
DECLARATION CONTRACT plus a validator that fails the build on three things —
an undeclared path (law 4), a feature with no switch (§6 rule 3), and a client
write outside the four give-points (S19); the switch registry with
prerequisites, dependents, audience, three off-states (S9) and cascade
resolution validated at strategy lock (S8); and the canonical objects declared
once each so no later spec invents a second version — seed, piece (one identity
owned by `creation/`, S1/S2/S15), channel (S17), metric observation
(S3/S6/S7/S23), curated parameter (S11), intake round (S10), review config
(S20), rights record (S21), outside-tool handoff (S18), matched comparison
(S5), context packet (S12), feedback item (S13), gate set (S14), profile
lifecycle (S22).

Two decisions recorded by the spec, both inside its authority:
1. **No new storage pattern** (CLAUDE.md rule 5 holds). Body data stays in the
   one AppState blob, reshaped into a versioned path-addressed per-profile
   body; the `ig_*` tables stay the metric-observation store (rule 5's existing
   exception, which is exactly what S3 asks for). Two triggers make per-profile
   rows mandatory later: the blob passing ~5 MB, or more than one writer per
   profile.
2. **Path-scoped writes are in scope and land before any profile migrates.**
   `app/api/state` moves from "replace the blob" to "apply a patch for the
   paths it declares". Under today's last-write-wins save race (gotcha 2),
   every append-only guarantee in S7/S11/S15 would be a lie.
Also: access binds by profile id, and `RESTRICTED_MATCHERS` (the client-NAME
regexes) is deleted — role filtering derives from switch audience + client_door
+ lifecycle instead. CLAUDE.md rule 2 stands; spec 12's 19-check security test
is re-run as acceptance.

Four law-4 folder additions born in the spec, for the control room to ratify
into PLAN §3 (each declares its feeds and readers, each inside the frozen
spine): `creation/funnel/replies/` (Divine's Lead Answers — the scripts the
body holds), `logs/pipelines/` (Lists incl. sharing, Cold Calls, Orders),
`logs/effort/` (Momentum + Money meter, her own profiles only per §7),
`logs/observations/` (spec 18A, her per-profile notes).

## OPEN QUESTIONS FOR THE CONTROL ROOM — ALL FIVE CLOSED 2026-07-25

Q3/Q4 ruled by the control room, Q1/Q2/Q5 answered by her (full record: PLAN.md
section 11). Headlines: the chat thread + untagged inbox are HELD/frozen (their
own spec comes after the restructure); public preview links survive behind
their switch, with the logged-in deep-link enhancement queued for the
client-side regroup; retention is forever, deletion only by her with export
first. **SPEC 21 IS CLEARED TO BUILD** — fresh build chat per PLAN section 6.
The original questions, kept for the record:

1. **Where do owner-level, cross-profile objects live?** PLAN §5.3: everything
   belongs to exactly one profile, and the only thing between profiles is her
   shelf (whose one cross-profile window is the today strip). But the floating
   owner chat thread (`chatLog`, on every screen per §2) and untagged
   Observations are cross-profile by design and have no address. Inventing an
   owner-level store outside the frozen spine is a plan change — hers.
2. **Do public, unauthenticated preview links survive?** Review is a give-point
   inside the client's profile (§4) and S19 allows only four client doors;
   today review runs on anonymous `/p/[shareId]` links. Is a public link an
   allowed delivery route into the review door, or must review happen only
   inside a client login? The `creation.review_public_link` switch has no
   suggested default until this is answered.
3. **How do people bind to a profile?** The plan says a client login opens its
   own profile only, but never how many client users a profile may have — and
   S20 requires "delegated approvers", implying more than one. Does a delegated
   approver get their own login, and may one person hold logins to two
   profiles? This shapes the bindings replacing the name regexes.
4. **The parameter inventory.** Intake questions are generated FROM the detail
   folders' parameters (§3.1), and the plan records her vocabulary session as
   still owed. Confirm the split: spec 21 ships the parameter CONTRACT, the
   intake spec ships the inventory after her session.
5. **Retention and deletion authority (S22).** Profile lifecycle declares
   retention and deletion authority per state; the values are hers, and
   connector revocation sits next to her money/external-accounts gate. Spec 21
   declares the fields with no defaults. What are the retention windows, and
   who may delete a profile's data?

Next after the control room clears spec 21: the intake spec, then the Content
Engine spec family, then the Analysis Engine family, then the client-side
regroup (PLAN §8 step 6). Independent of all of it and still owed by her: the
analytics setup day, the IG collection stall (data lost daily — recording is
the engine's first duty and does NOT wait for the restructure), and the chat
brain v4 deploy go.

---

Previous update: 2026-07-21. The Dashboard chat (spec 18 part C v2) is LIVE — a floating owner-only chat on every page (deploy 92f3763). Earlier: the Observations panel + WhatsApp inbox (spec 18, both parts) are LIVE (deploy commit 58f1f70 on client-tracker/main, Vercel success, all three DEPLOY.md gates passed; drift = only the spec 18 files). **The panel is usable now. The WhatsApp side is PARKED by her decision 2026-07-20: her eSIM cannot receive SMS, so Meta's number registration cannot complete.** Full parked state, IDs, and the resume path are at the top of `docs/spec-18-setup.md`. Nothing is half-live: webhook never configured, subscribe toggle off, no payment method, app unpublished. Catalogue PDF export (spec 17) is LIVE. The ANALYTICS CORE (specs 03-06) and the Money meter (spec 16) are LIVE. Momentum meter with diary (spec 11), Shared Lists (spec 12), and the mobile stacking fix are also LIVE.

## SETUP DAY STILL OWED (analytics shows nothing until these are done)

The analytics code is deployed, but it reads tables and env vars that do not exist yet. Until Manmeet does these, the Analytics tab and Connections screen render but stay empty:
1. Run 3 SQL files in Supabase (in `dashboard/supabase/`): `spec-03-link-join.sql`, `spec-05-account-insights.sql`, `spec-06-post-tags.sql`.
2. Set `ANTHROPIC_API_KEY` in Vercel (the nightly AI tagger + digest need it; without it the reader stays idle).
3. Instagram tester-invite each account, accept the invite, paste each token into the new owner-only `/connections` screen, and link each account to its dashboard client. Steps: `dashboard/docs/spec-03-setup.md`.
Also note: the daily IG collection has been STALLED since 2026-07-12 — separate from this deploy, still awaiting her "Update now" tap result to diagnose.

This file is overwritten as truth changes. It holds where things stand and the single next step. History belongs in the vault log, not here.

---

## Where things stand

- Live on Vercel, deployed via manual graft push to the `client-tracker` repo (see CLAUDE.md, gotcha 1 and rule 6). **The deploy procedure is now written down: `dashboard/DEPLOY.md` (authoritative). Latest deployed: 2026-07-17, Shared Lists (commit 7578066 on client-tracker/main); earlier same day, Momentum diary + one-tap IG update (1ddc390), Momentum meter v1 (3281960), and the mobile stacking fix (ac31d11). Before that: 2026-07-15, month-aware Pillars + content filters (2c927ff — deployed in another session, recorded here late).**
- **2026-07-17: Momentum meter (spec 11) LIVE**, including same-day v1.1 (diary logging: she writes the day, AI ticks the chips via `app/api/momentum-read`; word-match fallback until ANTHROPIC_API_KEY is set in Vercel — she has NOT set it yet) and v1.2 (stale-IG-data notice + owner "Update now" button; `ig-sync` also accepts an owner session so CRON_SECRET is never needed by hand). All DEPLOY.md gates passed each time; shipped as overlays, analytics v1 still out. OPEN: the daily IG collection has been stalled since 2026-07-12 — waiting on her tapping "Update now" and reporting what it says. Her ask, same day: ResumeGuru's IG feels dead and watching only results is draining her; she wants an effort tracker. Decisions locked: lives on the ResumeGuru Journey tab, skipped days pull the meter back a little, engagement tracked automatically (CareerOS signups out of v1, no data source named). Built: effort meter 0-100 derived from a daily log (`momentum` on ClientData, chips + auto-count of posted cards from the board), 14-day strip, results row from the `ig_*` tables via new owner-only `app/api/ig-metrics`. Files: `components/MomentumMeter.tsx` (new), `components/JourneyView.tsx`, `types/index.ts`, `contexts/AppContext.tsx`, `app/api/ig-metrics/route.ts` (new). Verified interactively at desktop + 375px. Spec: `specs/11 — Momentum Meter.md`.
- **2026-07-17: mobile stacking fix LIVE.** On phones the Content (Board + Pillars views) and Lists pipelines stack their stage columns vertically full-width instead of forcing sideways scroll; desktop unchanged (`md:` breakpoint). Files: `components/ContentView.tsx`, `components/ListsView.tsx`, layout classes only. Deployed as a two-file overlay onto client-tracker/main (all three DEPLOY.md gates passed) because a straight graft would have re-shipped analytics v1. STANDING DEPLOY NOTE: main remains ahead of live by the rejected analytics v1 (`app/analytics/page.tsx` + a `Sidebar.tsx` line), deliberately pulled from live. Whether analytics v1 ever returns to live is Manmeet's decision — ask her before including it in any deploy. Until then, deploy as overlays that exclude it, or graft only after she decides.
- **2026-07-14: Spec 01 (task-client sync) is LIVE.** My Day has a type picker (Content / Client task / Personal) with multi-client select. Content tasks open the real post editor and create a card on each chosen client's board with two-way status sync (tick = posted, drop = deletes card). Client tasks become agenda items on each client's dashboard. Board stage "Writing" is relabeled "Making". Deployed alone (analytics NOT included) via a clean rebuild off main; all three DEPLOY.md gates passed (green local build, clean drift, her go).
- **2026-07-14 (same day, follow-up): My Day polish LIVE** (commit 5480feb). From her feedback on the live screen: (1) add-task box moved to the TOP; below it a two-column split — "Going live" (IG content going live) on the left, "Today" to-do (overdue on top) on the right; This Week / Later / Done today full-width below. (2) The task pencil now opens a full edit modal (name, clients, date, repeat, and stage for content tasks) instead of rename-only. PersonalDashboard.tsx only; built on a clean base off main, deployed via DEPLOY.md gates.
- **2026-07-17: Shared Lists (spec 12) LIVE.** A list can be shared into another workspace: one list, both sides full partners on rows, list object owner-only. Built for workshop pipelines with Merushri. Server-side: `filterStateForRole` injects windows for client logins, `mergeRoleWrite` verifies write-backs against the authoritative state (19-check security test in the spec's checklist passed). Files: `types/index.ts`, `lib/access.ts`, `components/ListsView.tsx`. Spec: `specs/12 — Shared Lists.md`.
- Manmeet uses it daily as owner, and not just for clients: she made workspaces for her LinkedIn, KRNL Studio, Freelance Projects, and ResumeGuru. Logins exist for intern, Sonia, Shiva, and Merushri.
- **Record layer: mature and recently reworked.** The unified Content tab is the hub: one card per post with stages (idea, writing, ready, scheduled, posted), three views (Board, Pillars, Table), platform chips, fold pattern for posted cards. Old Kanban and Pillars routes redirect into it; Evergreen and Studio tabs were removed. Around it: My Day auto-sorted with recurring tasks, monthly agenda, references, brand kit with logo upload, assets, lists as pipelines with custom stages, cold calls, journey, onboarding, catalogue and orders for Sonia, brain dump, container map.
- **Fetch layer: live.** IG metrics for @resumeguru.ai collect daily into the Supabase `ig_*` tables (Stage 2 of the analytics roadmap, in production since 2026-07-11; code at `app/api/ig-sync/route.ts`, cron in `vercel.json`).
- **Analytics v1 is live but rejected.** An owner-only `/analytics` page (sidebar shortcut) reads the `ig_*` tables: followers, totals, top 3 by saves, full since-May table. Manmeet's critique, filed as the Stage 3-4 plan in the roadmap: it must live inside each client's workspace (not one global page), go by the pillars, be readable by clients, and talk to the content instead of being a boring table. NOTE: the `/analytics` code shipped to the deploy repo and the vault working tree, but is NOT in second-brain main yet (drift, see CLAUDE.md gotcha 1).
- **Analyze layer: first piece live.** Journey v2 per client: goal card with progress, stacked month bars in pillar colors with actual vs target percent, tap-to-isolate, post triage flow for sorting old posts into pillars. It analyzes only hand-recorded data so far.
- **Decide layer: not started.** The declared direction: the dashboard should read client data and propose strategy, not just record work.

- **2026-07-18: Money meter (spec 16) LIVE.** Deployed on her go same day (deploy commit b1cd328 on client-tracker/main, Vercel success; all three DEPLOY.md gates passed, drift = only the spec 16 files). She has not set a monthly value yet — the card shows the points meter plus the "Start earning" invitation until she does. Her ask: the effort meter should count in dollars, a money icon moving forward as she works. Decisions: lives on the Momentum card (Journey), Mix earning rule (auto split of a monthly value she sets + optional per-day extra), effort money labeled honestly (not revenue). Built into `components/MomentumMeter.tsx` + two optional fields on `MomentumData` (`monthlyValue`, `MomentumEntry.extraValue`) — old logs untouched, points mode still works when no value is set, set value to 0 to switch back. Deliberate design change from spec 11: earned money never decreases; a skipped day earns $0 and a pace mark shows the gap. Verified interactively in the browser (conversion, chip earning at $48 for a half day of a $3,000/31 month, extra value, pace flip to "ahead by $2"); verification caught and fixed a real bug (saving a day dropped the monthly value). tsc clean. Deploy = merge branch to main + DEPLOY.md gates on her go. Spec: `specs/16 — Money Meter.md`.
- **2026-07-17 (this session, part 3): analytics core DEPLOYED.** On her "go", the session branch fast-forwarded onto vault main (201b147), all three DEPLOY.md gates passed (green scratch build with dummy keys; drift check = only expected files, the analytics additions + v1 deletions + this session's specs, no live-only app file at risk; her explicit go), grafted to client-tracker/main (deploy commit 8704156, tree from origin/main:dashboard onto the old live head 7578066). Vercel build: SUCCESS. Because analytics v1 was retired in the same landing, live and vault main are now fully in sync again — future deploys are plain grafts, no more overlays. The four analytics commits (5176a00, bef6cb5, 0bd3dd4, 7d59a47) are now part of main's history via merge a83815e; the old branch `claude/dashboard-status-review-fb52e4` is spent.
- **2026-07-17 (this session, part 2): spec set COMPLETE + analytics core made deploy-ready.** Specs 09 (Strategy Draft: two draft moments, citation rule, C8 accept/edit/dismiss mechanics with change-dated writes + strategy changelog), 10 (Playbook & Taste: evidence-born cross-brand entries + taste rules distilled from her draft edits, both open-book), and 15 (Data Quality & Trust: seven risks with defenses; centerpiece = Data Health card with verdict language chained to data health — DISCUSSION AGENDA, needs her 30-min session) written and committed. Then the analytics core (specs 03–06) was MERGED onto current main-equivalent on this session's branch (`claude/krnl-dashboard-continuation-a24a96`, merge commit a83815e): merged at 7d59a47 to exclude the stale stacked spec 01; 15 conflicts across 6 files resolved (union of momentum + topics/goals; shared-lists stripping kept; owner-session auth ported into multi-account ig-sync; spec 04 editor features — topic chip, experiment flag, repurpose — ported into the extracted CardEditor.tsx). Analytics v1 (global /analytics page + Sidebar link) DELETED on this branch per her locked 07-13 decision ("global /analytics RETIRED") — once this branch lands on main, deploys are plain grafts again, no overlays. tsc clean; production build green with dummy keys. DEPLOY STILL NEEDS: her explicit go → merge branch to main → DEPLOY.md gates → graft; plus her setup day (3 SQL files in `dashboard/supabase/`, ANTHROPIC_API_KEY in Vercel, tester invites + tokens via /connections — `dashboard/docs/spec-03-setup.md`). IMPORTANT: do NOT merge this branch to main before her deploy go — a graft from main would then carry the analytics core unapproved.
- **2026-07-17 (this session): the loop specced end to end.** Her ask: lots of discussion, not enough visible progress — she wants the data to talk to itself and the connections written down. Three specs written and committed: `13 — The Connected Loop.md` (master map: 8 stations, connections C1–C9 with carrier + why + status, spec scoreboard, proposed closing order — resolves backlog #5), `08 — Brand Profile.md` (onboarding becomes a typed parameter sheet; 16 questions → ~20 fields, every field names its reader; vocabulary session with her pending), `14 — Content Automation.md` (her two use cases: A auto-mark posted via a matcher in ig-sync, B schedule/publish from the dashboard; A first). Backlog 00 updated. Visual map artifact published (claude.ai/code/artifact/056c5ca3-4dd1-4e40-95eb-c73838af1275). Proposed closing order awaiting her confirm: deploy 03–06 → fix pipe → 14A → 08 → 07 → 14B/09.

- **2026-07-19: Catalogue PDF export (spec 17) LIVE.** Deployed on her go same day (deploy commit 1ad7fd1 on client-tracker/main, Vercel success; all three DEPLOY.md gates passed, drift = only the spec 17 files). Her ask: Sonia selects photos across catalogue categories, gets one PDF, shares it on WhatsApp — no extra steps. Locked: one photo per page. Built into `components/CatalogueView.tsx` only (+ `jspdf` dependency, lazy-loaded): Select mode with tick circles, selection survives category navigation (grid cards show "n picked"), bottom bar with Make PDF, photos recompressed to max 1400px JPEG so the file stays sendable, share sheet opens with the PDF attached (`navigator.share` with file; falls back to download on desktop). Nothing written to AppState; `lib/access.ts` untouched. Verified interactively (cross-category selection, toggle, PDF build fetched picked photos in order, desktop + 375px); tsc and production build green. Awaiting her look at the live screen. Spec: `specs/17 — Catalogue PDF Export.md`.

- **2026-07-20: Observations panel (spec 18 part A) BUILT, not yet deployed.** Her ask: a private place in the dashboard, hers only, to add a topic and note observations. Built: owner-only `/observations` page + sidebar shortcut (eye icon, owner block). New top-level `observations` slice in AppState, protected exactly like personalTasks: stripped in `filterStateForRole`, untouchable in `mergeRoleWrite` (all four access functions updated per rule 5). Topics are free text born through use — one-tap chips for existing topics, optional client tag, notes grouped by topic with filter, edit, two-tap delete. Files: `types/index.ts`, `lib/access.ts`, `contexts/AppContext.tsx`, `components/ObservationsView.tsx` (new), `app/observations/page.tsx` (new), `components/Sidebar.tsx`. Verified interactively (add across topics, chip persistence, filter, edit, delete confirm, sidebar link, desktop + 375px); tsc and production build green. Deploy = her go + DEPLOY.md gates. **Part B (WhatsApp bridge)** — she asked if she can text observations to a "Dashboard" WhatsApp contact and have AI file them by topic. Possible via the WhatsApp Business platform; specced honestly in `specs/18 — Observations Panel.md`. BLOCKED on her decision: it needs a dedicated phone number (cannot be a number already used in a normal WhatsApp app), plus a Meta setup day and the ANTHROPIC_API_KEY she already owes.

- **2026-07-20 (same session, part 2): WhatsApp inbox (spec 18 part B) BUILT, not yet deployed.** She got the eSIM and expanded the scope: one "Dashboard" WhatsApp contact for the whole dashboard, her hashtags steering. Routing law: hashtags steer; AI only files UNTAGGED text and only into owner-only Observations — nothing client-visible is ever written without her explicit client hashtag (rule 1). Grammar: `#task` → My Day; `#<client> #task` → client agenda + linked My Day task (spec 01 shape); `#<word>` → observation under that topic; photo + `#<client>` → client Assets in an auto-created "WhatsApp" set; untagged text → AI topic pick (Haiku, "Inbox" fallback); ambiguous client tags ask instead of guessing; every message gets a one-line reply. Security: Meta signature check, owner-number allowlist (strangers get total silence), tokens server-side only. Files: `lib/whatsappInbox.ts` (new, pure routing brain), `app/api/whatsapp/route.ts` (new, Meta I/O), `docs/spec-18-setup.md` (new, her ~45-min paperwork). Verified: 31 routing unit checks green; endpoint curl-tested (verify handshake, 403 wrong token, 401 bad signature, stranger silence, honest "NOT saved" when DB unreachable); tsc + production build green. NOT yet testable: the full live loop — needs deploy + her setup day. Honest v1 limits on record in the spec: Meta redelivery can duplicate a note; the gotcha-2 save race applies (same accepted risk as share-target); text and photos only. Go-live order: her deploy go (part A + B ship together) → setup day → step 7 test script.

- **2026-07-21: Content Engine spec written (spec 19), DRAFT awaiting her validation.** Her ask: a seed-to-post mechanism for the content funnel — she talks a topic once in depth, selects format + platform + pillar, gets a ready draft; repurposing is the machine's job; it must improve over time. Spec: `specs/19 — Content Engine (Seed to Post).md`. Location deliberately undecided (her call): Door 1 no-code (vault files + chat, testable today), Door 2 in-dashboard (rides spec 04 Topics + Repurpose), Door 3 standalone. NOTHING BUILT — and nothing gets built in the dashboard for this until (a) she picks a door and (b) the chat-bubble feature being built in a SEPARATE chat writes its spec/state into this repo (this session searched: no trace of it exists here yet; the two must be cross-checked before any Door 2 build). CROSS-CHECK NOW SATISFIED by the entry below: the chat-bubble feature is spec 18 part C v2, recorded and shipped.

- **2026-07-21: the Dashboard chat (spec 18 part C v2) SHIPPED (deploy commit 92f3763 on client-tracker/main, Vercel success; gates: green scratch build, drift = only this feature + doc riders, her instruction "get that chat thing down, live and working").** Backstory: WhatsApp registration dead-ended at Meta's PIN step (parked, trail in `docs/spec-18-setup.md`); Telegram proposed and REJECTED (she never uses it, calls it banned); the v1 `/quick` capture PAGE was built then REJECTED by her ("looks trash", must be a chat, on all pages, not another page) — v1 deleted, logic salvaged. v2: floating owner-only chat widget on every page (`components/ChatWidget.tsx`, mounted in `app/layout.tsx`; full-screen chat on phones, corner window on desktop; hidden on public /p/ pages and from all non-owner roles). Same routing brain as the WhatsApp pipe; replies in-thread as "Done — ..." / "Not done — ..." bubbles. NEW STATE SLICE (rule 5 decision): `chatLog`, owner-only, capped 100 — the thread survives reloads; filed items live in their real homes. All four access functions updated. Verified interactively in the browser: task → My Day (badge + list confirmed), client task → Divine agenda + linked task, untagged note → Inbox fallback, thread persists across page navigation, desktop + 375px (full-screen chat). tsc + production build green.

- **2026-07-22: chat brain v4 BUILT, not yet deployed.** Her verdict on the live v3 chat (with screenshots): it interrogated her ~25 times to add 4 things, could not create content cards (so the Divine Studio carousel + yoga reel had nowhere to go), and turned the category word "client task" into a card TITLE. Root causes found in the code, not the model: (1) the brain returned ONE action per message, forcing a question-per-turn ping-pong; (2) there was NO create-content-card action at all; (3) the prompt invited clarifying questions with no push to act. Cost checked and ruled out as the blocker (Haiku ~0.4¢/msg, Sonnet ~0.75¢, difference a few $/month) and Gemini discussed (possible, cheaper-than-Haiku Flash, but a second vendor + key; deferred). Her call: fix the structure on Haiku first, judge the model after. Built v4, same Haiku model: the brain now returns a LIST of actions (does the whole message in one go), gained a new **add_card** action that creates a real content card on a client's board (title from her words, default Idea stage, optional contentType/stage — mirrors the spec 01 card shape), and the prompt now says DO-don't-ask with sensible defaults and an explicit "a category word is never a title" rule plus an add_card-vs-add_client_task split (content to make = card; errand/reminder = task). Widget executes every action, validates each id, and posts one clean confirmation ("Done:" bulleted for multi-item), keyless/failure still falls back to the v2 rules. Files: `app/api/chat-brain/route.ts`, `components/ChatWidget.tsx`. Production build green with dummy env; verified in-browser that the widget mounts and the confirmation composer renders (the AI multi-action path itself needs the live ANTHROPIC_API_KEY, so its real test is on deploy). Deploy = her go + DEPLOY.md gates. Her live retest owed: the four-item message and the three v3 failures.

- **2026-07-21 (part 2): the chat brain v3 SHIPPED (deploy commit b8eb791 on client-tracker/main, Vercel success; gates passed).** Her verdict on the live v2 chat: it saves words instead of understanding ("this is very dumb") — it filed "#observations ... under shivansh" under a literal "Observations" topic, filed her question "where?" as a note, and couldn't mark a post as posted. Her observation model, now honored: a topic = one SUBJECT (e.g. Shivansh) accumulating notes long-term. On her yes: AI-first brain — `app/api/chat-brain` (new, owner-only, Haiku) reads every non-shortcut message with clients + topics + unposted cards + the last 8 thread messages, returns one validated action incl. **mark_posted** (moves a real card to Posted) and **reply** (answers/clarifies/refuses honestly). Widget validates all ids; keyless/failure falls back to v2 rules (verified locally — the chat never breaks). Files: `app/api/chat-brain/route.ts` (new), `components/ChatWidget.tsx`. tsc + production build green. Her live retest owed: the three messages that failed her.

## The single next step

Manmeet confirms (or reorders) the loop-closing order in `specs/13 — The Connected Loop.md` section 4 — step 1 is the analytics-core deploy "go" (specs 03–06 + setup day). The 07-12 IG collection stall is still being diagnosed (waiting on her "Update now" tap result).

Background: `specs/00 — Dashboard Backlog.md` is the master list and decision log; specs 01–07 are the 2026-07-13 builds, 08/13/14 the 2026-07-17 additions.

**BUILT 2026-07-13 (deploy-ready, NOT deployed):** the analytics core — Specs 03, 04, 05, 06 — as four commits on the session branch `claude/dashboard-status-review-fb52e4` (5176a00, bef6cb5, 0bd3dd4, 7d59a47). All typecheck-clean. Deploy checklist is at the bottom of the backlog. Her instruction: build STOPPED after 06 — specs 07, 01, 02 stay unbuilt until she says so. Ship = her explicit go, then carry to `client-tracker`.

The 2026-07-13 session SUPERSEDES the roadmap's A/B/C plan in key ways (the roadmap file predates it): AI pillar-tagging is demoted to fallback (the live-link join makes her cards the tag source), pillars get jobs (Reach/Trust/Convert), topics become first-class (repurpose action), experiments get a lane, the funnel ends at each client's Journey north star (never DMs), and the page is three layers (Scorecard / Comparison / Funnel) under a one-truth sync rule. Locked decisions: pillar jobs YES, connect ALL controlled accounts, three layers YES, experiments YES.

Analytics build order: 03 (link join + connections) → 04 (data model) → 05 (scorecard+funnel) → 06 (reading layer) → 05 (comparison) → 07 (digest). Specs 01 (task sync) and 02 (filters) are independent quick-schedulable builds with small forks pending her answers. The bigger picture remains `studio/Vision — Content Analyzer & Connected System.md`; the "parameters/strategy" (Decide layer) conversation is still to come and gets its own spec later.

## Answered (2026-07-12)

1. **Client usage:** Merushri is actively using her login. Shiva has not been given her access information yet; Manmeet plans to hand it to her. Sonia and intern status unchanged.
2. **Priority:** the analyze job. The performance analytics dashboard is the work in progress.
3. **Container Map:** live on the deployed dashboard (later graft deploys carried the whole app, so it went out with them). Its task checkboxes are hand-ticked data, nothing updates them automatically. Working agreement: when a build session ships something that matches a map task, Claude reminds Manmeet which task to tick.

## Open questions

Answers get written into this file, then this block shrinks.

1. Were decisions made in other chats that are written nowhere? Name them here.

## Recently done

- 2026-07-11: polish round live (Journey triage, animated month bars, wider Dashboard tab).
- 2026-07-11: IG analytics pipe live in the deploy clone, daily snapshots into `ig_*` tables.
- 2026-07-11: iteration round from her feedback: Role field removed, platform filter chips, fold pattern as house style, Journey v2, brand logo upload.
- 2026-07-10: rework phases 1 and 2: unified Content tab with one-time client-side migration, My Day auto-sort, Journey tab, Lists as pipelines, ResumeGuru one-click pillar pack.
- Earlier: passcode auth with 5 roles and server-side filtering, Assets tab with signed Cloudinary uploads, Instagram preview share pages, Lead Answers for Divine.

## Tried and rejected (do not redo)

- Deploying from the vault subtree: broke, replaced by the graft push to `client-tracker`.
- Canva Connect import without an OAuth app: parked, needs a proper OAuth app first.
- Separate Kanban and Pillars tabs: merged into the unified Content tab (2026-07-10); do not resurrect.
- Channels strip and next-steps text sections in Journey: removed on her feedback, she wants data, not text sections.
