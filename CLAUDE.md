# CLAUDE.md - Client Dashboard (KRNL Personal Branding System)

Read this file fully before doing anything in this folder. Then read STATE.md.

---

## What this is

This dashboard is the working system behind Manmeet's personal branding service at KRNL Studio. It started as a client tracker. It is being grown into the system that runs the whole service: one place where client work is recorded, client data is pulled in, that data is analyzed, and strategy decisions come out the other side.

The four jobs, in order of maturity:

1. **Record.** Capture everything per client: the unified Content tab (one card per post, idea to posted), monthly agenda, references, brand kit, assets, lists as pipelines, orders. This works today and is used daily. Design law from the 2026-07-10 rework: every data point must be a byproduct of work she already does, never a reporting duty.
2. **Fetch.** Pull real data in automatically instead of typing it in. Partially built and LIVE: Instagram metrics for @resumeguru.ai flow into Supabase daily (the `ig_*` tables) via `app/api/ig-sync/route.ts` and the `vercel.json` cron (9:00 AM IST). Nothing in the UI reads those tables yet. The full build path is in the vault: `studio/Roadmap — Instagram Performance Analytics.md`.
3. **Analyze.** Read what the data says: what worked, what did not, per pillar, per format. First piece exists: the Journey tab (goal card, content mix vs pillar targets, month map in pillar colors). But it only analyzes what she records by hand; it does not touch the fetched IG data yet.
4. **Decide.** Turn analysis into strategy for the client: what to post, what to drop, what to double down on. Not built yet. This is what makes the dashboard worth handing to a client.

A second goal, equal in weight: the system must be documented well enough that Manmeet can hand the workflow to someone else and they understand what processes she runs here. Write docs and UI copy with that reader in mind.

---

## The memory rule

This folder is the only memory. Chat history is not. If a decision was made, it goes into STATE.md (or this file) before the session ends. When a file and anyone's memory disagree, the file wins.

---

## Read order for a fresh session

1. This file, fully.
2. `STATE.md`: short by design. What is live, the rules she has ruled on, the single next step.
3. `types/index.ts`: the entire data model in one file.
4. `lib/access.ts`: the roles and what each may see and write.
5. The page and component pair for whatever section you are touching.

Then report back in two lines: where the project stands and what the next step is. Only then start work.

**Do not read `STATE-ARCHIVE.md` as part of this.** It is 2,500 lines of history, kept complete so no decision is lost. Go into it when you need to know WHY something is the way it is, never to find out what is true now.

---

## What `npm test` does and does not prove

`npm test` runs about 1,000 checks with no browser, no React and no DOM. Most of them read source files as **text** and assert that certain strings appear. They are good at catching a rule being deleted. They prove **nothing** about whether a screen renders, looks right, or is usable.

So: **never report "1018 tests pass" to Manmeet as evidence that a screen is correct.** It is not. If you changed something she will look at, either run it and look at it, or tell her plainly that you have not seen it yet. Reporting green tests over a broken screen is the fastest way to lose her trust, and it has already happened.

---

## How the data works (read before touching state)

- In `app/client/[id]/`, the Content tab is the hub. `kanban` and `pillars` are legacy routes that redirect into it — do not build onto them.
- The entire app state is ONE JSON blob (`AppState`) stored in a single Supabase row. `app/api/state/route.ts` reads and writes it. There is no per-table schema for app data.
- **Writes are PATH-SCOPED** (spec 21). A save sends `{ state, paths }`: the paths it touched, addressed in the tree (`lib/tree/scopes.ts`). The server merges only those and takes everything else from what is stored. An undeclared path is refused. This is what closed the old save race.
- **The tree is the address system** (`lib/tree/`). Every folder declares what feeds it, what reads it, and the switch that governs it; a read or write against an undeclared path throws. `npm test` runs the validator plus spec 21's acceptance tests — no dependencies, no build step.
- A migrated profile carries a `body` (path-addressed) ALONGSIDE its legacy slices. The legacy slices are still what the screens render; the GUI moves over in its own spec.
- Roles: `owner`, `intern`, `sonia`, `shiva`, `merushri` (see `lib/access.ts`). `shiva` and `merushri` are client roles: they see only their own workspace with a reduced tab set.
- Role filtering happens SERVER SIDE in `filterStateForRole` and `mergeRoleWrite`. Never trust the client payload. A restricted role's write may only touch its own clients' data.
- **Access binds by PROFILE ID**, through `state.bindings` (spec 21 §6). The old `RESTRICTED_MATCHERS` name regexes are gone — renaming a profile no longer changes anyone's access. The regexes survive only in `lib/tree/legacyBindings.ts`, used once to seed the bindings that already existed. Nothing else may import that file.
- Auth is passcode based with a signed cookie (`lib/auth.ts`). With no passcodes configured the app runs in open mode as owner (local dev).
- Media uploads go to Cloudinary through signed uploads (`app/api/upload/sign`).
- Public share links: `app/api/share` plus `app/p/[shareId]`.

---

## Running

Needs `.env.local` with the Supabase, Cloudinary, and passcode variables. Variable names may be written in docs; values never.

---

## Specs — build plans live in `dashboard/specs/`

Anything bigger than a quick fix gets a spec FILE here first, before code.

- **Location and naming:** `dashboard/specs/`, named `NN — Title.md` (two digits, space, Title Case). `00 — Dashboard Backlog.md` is the master index and decision log; `01`+ are the numbered builds.
- **Commit specs the moment they are written.** Never leave them as untracked loose files. A spec that is not in git is one folder-clean from gone — this already happened once (the 00–07 set sat uncommitted for two days).
- **A build session reads the spec by name and builds from it.** Specs are never pasted between chats; you point a chat at the filename, and it reads the file (after pulling `main`).
- When a spec ships, mark it in `00 — Dashboard Backlog.md`.

---

## Rules (do not violate)

0. **THE PLUG RULE. Never build a client version of something she already has.** Her ruling, 2026-08-17: "you don't have to build anything new. You just have to pick the features that are already there in my dashboard." A client sees HER screen, HER component, HER names, with writing turned off. Every feature is a plug she ticks on or off. If you catch yourself writing a new component whose name contains "Client", stop: the answer is to mount the existing one with `readOnly`. This exact mistake has been made and undone three times (the client idea box, 08-15, 08-16, 08-17), and it is the single most expensive habit in this project's history.

0b. **Nothing is gated on intake being complete or on a locked strategy.** Her ruling, 2026-08-17: "We are not keeping it for the clients, and it won't be kept for me as well." This rule has been removed from five separate places (08-11 x3, 08-16, 08-17). If you find a sixth home, remove it and say so in STATE.md. The lock gates GENERATION inside the engine and nothing else. Her switches are the one authority on what renders.

1. **Clients see curated content only.** Anything AI-generated inside KRNL is internal drafting material. Nothing generated goes client-facing without Manmeet curating it first.
2. **Never weaken server-side role filtering to fix a UI problem.** The access rules in `lib/access.ts` are the product's guarantee.
3. **UI copy in plain, simple language.** No designer jargon, no em dashes, short lines.
4. **One feature at a time.** No refactors in passing, no unrequested extras.
5. **App data lives in the one AppState blob.** Do not introduce a second storage pattern without a decision recorded in STATE.md. (The `ig_*` analytics tables are the one existing exception: pipeline data, not app state.) Any new top-level state slice must also be added to `emptyState`, `normalizeState`, `filterStateForRole`, and `mergeRoleWrite` in `lib/access.ts`, or it gets silently stripped — **and it must be given an address** in `lib/tree/features.ts` and `lib/tree/scopes.ts`, or it will not compile and the validator will fail the build (PLAN law 4).
6. **Never push to production without Manmeet's explicit go.** The deploy is a manual graft push to the `client-tracker` repo. The exact, tested, step-by-step procedure is `dashboard/DEPLOY.md` — follow it, do not reconstruct it from memory. She says "go" first, every time.

---

## Gotchas (each of these already cost real time)

1. **Deploys do not come from this folder.** The Vercel deploy runs from a separate repo (`client-tracker`) because the vault subtree flow broke. The two copies CAN DRIFT: code has shipped to the deploy repo before landing here, and the other way around. The full deploy procedure, including the mandatory drift check, is `dashboard/DEPLOY.md`. Before editing, check which copy is ahead; after changing code here, deploy per DEPLOY.md so they reconcile.
2. **The save race — FIXED, but only for declared paths (spec 21).** Saves used to POST the whole blob, so two overlapping saves clobbered each other. Now a save declares the paths it touched and only those merge. Two rules follow: a new state slice must be given an address in `lib/tree/scopes.ts` (TypeScript stops the build otherwise), and a payload sent with no `paths` still falls back to the old whole-blob behavior — so never strip the `paths` field from a save to "simplify" it.
3. **The contentCards migration.** `normalizeState` deliberately does NOT default `contentCards`. The client-side load migration keys off it being undefined. Defaulting it breaks the migration.
4. **Share-to-save is Android only.** The PWA share target does not work on iOS.
5. **This folder lives inside the vault repo.** The vault must stay on `main`, and iCloud sync can stall git. Follow the vault's usual commit flow; never force anything here.

---

## How to work with Manmeet

- Explain the step in plain language first, discuss until it is clear, then build. Never several features in one go.
- She does not read code. Give the mental model, the cost, and the tradeoff. Give exact file paths when filing anything.
- **Report results, not plumbing.** Tell her "done" or "here is the one decision I need." Never narrate git, branches, merges, conflicts, typechecks, stashes, or PRs unless she explicitly asks what is happening under the hood. Routine machinery reads as chaos to her and causes real anxiety; translate any scary-but-normal operation into plain reassurance.
- Decisions are hers. Draft, show, let her correct. Never declare anything locked on her behalf.
- If context is missing, ask her directly. Do not go hunting through repos and transcripts.
- Ship the simple working version first. Infrastructure repair comes after it is live and testable.

---

## Where the wider truth lives

The service vision and standards live in the vault (the parent repo), not here:

- `studio/Personal Brand Standard.md`: her definition of a good personal brand, the 3-question test, the pillars.
- `studio/Personal Brand Foundation.md`: beliefs, proof points, and stories behind the service.
- `studio/Overview.md`: KRNL positioning.
- `studio/Vision — Content Analyzer & Connected System.md`: the long-term vision this dashboard is growing toward.
- `studio/Roadmap — Instagram Performance Analytics.md`: the 6-stage build path for the analytics layer, with status.

This file describes the app. Those describe the service the app exists to run.
