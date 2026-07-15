# STATE - Client Dashboard

Last updated: 2026-07-13. Full analytics design session with Manmeet; the plan now lives in `specs/`.

This file is overwritten as truth changes. It holds where things stand and the single next step. History belongs in the vault log, not here.

---

## Where things stand

- Live on Vercel, deployed via manual graft push to the `client-tracker` repo (see CLAUDE.md, gotcha 1 and rule 6). **The deploy procedure is now written down: `dashboard/DEPLOY.md` (authoritative). Latest deployed: 2026-07-14, My Day polish (commit 5480feb on client-tracker/main).**
- **2026-07-14: Spec 01 (task-client sync) is LIVE.** My Day has a type picker (Content / Client task / Personal) with multi-client select. Content tasks open the real post editor and create a card on each chosen client's board with two-way status sync (tick = posted, drop = deletes card). Client tasks become agenda items on each client's dashboard. Board stage "Writing" is relabeled "Making". Deployed alone (analytics NOT included) via a clean rebuild off main; all three DEPLOY.md gates passed (green local build, clean drift, her go).
- **2026-07-14 (same day, follow-up): My Day polish LIVE** (commit 5480feb). From her feedback on the live screen: (1) add-task box moved to the TOP; below it a two-column split — "Going live" (IG content going live) on the left, "Today" to-do (overdue on top) on the right; This Week / Later / Done today full-width below. (2) The task pencil now opens a full edit modal (name, clients, date, repeat, and stage for content tasks) instead of rename-only. PersonalDashboard.tsx only; built on a clean base off main, deployed via DEPLOY.md gates.
- Manmeet uses it daily as owner, and not just for clients: she made workspaces for her LinkedIn, KRNL Studio, Freelance Projects, and ResumeGuru. Logins exist for intern, Sonia, Shiva, and Merushri.
- **Record layer: mature and recently reworked.** The unified Content tab is the hub: one card per post with stages (idea, writing, ready, scheduled, posted), three views (Board, Pillars, Table), platform chips, fold pattern for posted cards. Old Kanban and Pillars routes redirect into it; Evergreen and Studio tabs were removed. Around it: My Day auto-sorted with recurring tasks, monthly agenda, references, brand kit with logo upload, assets, lists as pipelines with custom stages, cold calls, journey, onboarding, catalogue and orders for Sonia, brain dump, container map.
- **Fetch layer: live.** IG metrics for @resumeguru.ai collect daily into the Supabase `ig_*` tables (Stage 2 of the analytics roadmap, in production since 2026-07-11; code at `app/api/ig-sync/route.ts`, cron in `vercel.json`).
- **Analytics v1 is live but rejected.** An owner-only `/analytics` page (sidebar shortcut) reads the `ig_*` tables: followers, totals, top 3 by saves, full since-May table. Manmeet's critique, filed as the Stage 3-4 plan in the roadmap: it must live inside each client's workspace (not one global page), go by the pillars, be readable by clients, and talk to the content instead of being a boring table. NOTE: the `/analytics` code shipped to the deploy repo and the vault working tree, but is NOT in second-brain main yet (drift, see CLAUDE.md gotcha 1).
- **Analyze layer: first piece live.** Journey v2 per client: goal card with progress, stacked month bars in pillar colors with actual vs target percent, tap-to-isolate, post triage flow for sorting old posts into pillars. It analyzes only hand-recorded data so far.
- **Decide layer: not started.** The declared direction: the dashboard should read client data and propose strategy, not just record work.

## The single next step

Manmeet reviews the spec set in `specs/` (written 2026-07-13, one full design session). `specs/00 — Dashboard Backlog.md` is the master list and decision log; specs 01–07 are the numbered builds.

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
