# STATE - Client Dashboard

Last updated: 2026-07-12. Manmeet answered the first round of open questions in chat; her answers are written in below.

This file is overwritten as truth changes. It holds where things stand and the single next step. History belongs in the vault log, not here.

---

## Where things stand

- Live on Vercel, deployed via manual graft push to the `client-tracker` repo (see CLAUDE.md, gotcha 1 and rule 6). Latest deployed: the 2026-07-11 polish round.
- Manmeet uses it daily as owner, and not just for clients: she made workspaces for her LinkedIn, KRNL Studio, Freelance Projects, and ResumeGuru. Logins exist for intern, Sonia, Shiva, and Merushri.
- **Record layer: mature and recently reworked.** The unified Content tab is the hub: one card per post with stages (idea, writing, ready, scheduled, posted), three views (Board, Pillars, Table), platform chips, fold pattern for posted cards. Old Kanban and Pillars routes redirect into it; Evergreen and Studio tabs were removed. Around it: My Day auto-sorted with recurring tasks, monthly agenda, references, brand kit with logo upload, assets, lists as pipelines with custom stages, cold calls, journey, onboarding, catalogue and orders for Sonia, brain dump, container map.
- **Fetch layer: live.** IG metrics for @resumeguru.ai collect daily into the Supabase `ig_*` tables (Stage 2 of the analytics roadmap, in production since 2026-07-11; code at `app/api/ig-sync/route.ts`, cron in `vercel.json`).
- **Analytics v1 is live but rejected.** An owner-only `/analytics` page (sidebar shortcut) reads the `ig_*` tables: followers, totals, top 3 by saves, full since-May table. Manmeet's critique, filed as the Stage 3-4 plan in the roadmap: it must live inside each client's workspace (not one global page), go by the pillars, be readable by clients, and talk to the content instead of being a boring table. NOTE: the `/analytics` code shipped to the deploy repo and the vault working tree, but is NOT in second-brain main yet (drift, see CLAUDE.md gotcha 1).
- **Analyze layer: first piece live.** Journey v2 per client: goal card with progress, stacked month bars in pillar colors with actual vs target percent, tap-to-isolate, post triage flow for sorting old posts into pillars. It analyzes only hand-recorded data so far.
- **Decide layer: not started.** The declared direction: the dashboard should read client data and propose strategy, not just record work.

## The single next step

Finish the performance analytics dashboard. Manmeet is in the middle of perfecting it; it is not done and it is the active build (the analyze job). When it is ready she makes the deploy decision, then it ships. Everything else waits behind this.

Confirmed 2026-07-12, in her words: analytics first, decision, then deploy.

The plan for this work lives at `studio/Roadmap — Instagram Performance Analytics.md`. The agreed order from her critique of v1: A) per-client Analytics tab with role access, B) AI pillar-tagging with her correction dropdown plus a pillar-first designed view with plain-language explainers, C) weekly insight sentence. A then B then C; her go pending on each. The bigger picture is `studio/Vision — Content Analyzer & Connected System.md`.

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
