# Dashboard Backlog

The master list of everything Manmeet is planning for the dashboard. Nothing lives in chat — it lives here. Each initiative gets a one-line status, Claude's honest opinion, whether it can be built now, and the open questions blocking it. When an initiative is locked, it graduates to its own spec file in this folder (`01 — ...`, `02 — ...`).

Last updated: 2026-07-17.

---

## Working method (agreed 2026-07-13)

- **Spec many in parallel, ship one at a time.** Speccing is just thinking + docs — cheap, no risk, do it broadly. Building is where the risk is: the app is one JSON blob with fragile save + role-filtering plumbing (CLAUDE.md rule 5, gotcha 2), so only one build lands at a time, and each ships on Manmeet's explicit go.
- Specs get deployed whenever Manmeet decides, not in list order.
- This backlog is the memory. Update it as decisions land; shrink the open-questions blocks as they get answered.

---

## 1. Task ↔ client sync ("one task, one truth")

**What:** My Day and the client tabs become two windows onto the same work. Every item added in My Day picks a type:
- **Client content** → creates a card on that client's Content board (starts at Idea), two-way status sync.
- **Client task** → becomes an agenda item on that client's Dashboard, surfaces under Upcoming Deadlines. Not a content card.
- **Personal** → plain My Day task, no client.
Multi-select clients on types 1 and 2: one card / one agenda item per chosen client.

**Status:** Design ~90% locked. 4 forks open.

**Opinion:** The highest-value change on the list for daily life — it removes the dead-end where a My Day task never reaches the client board. Worth doing first.

**Buildable now:** Yes, but it's the biggest data-model change since content unification. Touches `emptyState`, `normalizeState`, `filterStateForRole`, `mergeRoleWrite` in `lib/access.ts` plus the save flow. Do it alone.

**Open forks:**
1. Ticking a content task done in My Day → card → Posted; plus a cancel/drop for dead ideas. Confirm.
2. Client tasks (agenda items) with a due date: also show in My Day, or only in the client Dashboard? (Claude recommends: also in My Day.)
3. Board stages today = Idea → Writing → Ready → Scheduled → Posted. Her real lifecycle = ideation → get content → creation → posting. Rename to match? (Treat as its own tiny change.)
4. The type picker (Content · Client task · Personal) is the whole differentiation. Confirm the UX.

---

## 2. Pillars month-filter + better filters

**What:** Make the Pillars view obey the selected month (it currently ignores it and shows all-time). Add filters: content type, month picker. Pillar filter added to Board/Table (in Pillars view the columns already are the pillars).

**Status:** Nearly locked. 1 fork.

**Opinion:** Small, low-risk, useful immediately. Good second build.

**Buildable now:** Yes. Self-contained in `ContentView.tsx`.

**Open forks:**
1. Dateless backlog ideas: when Pillars filters to a month, keep dateless ideas always visible (recommended) or hide them?
2. "Pick 2–4 months, see progress across them" is an *analysis* view, not a filter — belongs with Analytics (#3), not here. Flagged to avoid scope creep.

---

## 3. Analytics board (per-client)

**What:** The A/B/C plan from `studio/Roadmap — Instagram Performance Analytics.md`, replacing the rejected global `/analytics` table.
- **A** — analytics as a per-client tab; link each `ig_account` to a dashboard client; role access follows existing rules (each client login sees only their own).
- **B** — AI tags every post against that client's pillar set (owner corrects via dropdown); pillar-first designed cards vs baseline; plain-language metric explainers; brand-coloured layout.
- **C** — weekly plain-words insight sentence per client. Code computes, AI only words it.

**Status:** Documented, her go pending per stage. This is the "bigger version" she wants to spec fully before building.

**Opinion:** A is small and unlocks the rest. B is the real craft work and the real value. C needs data time.

**Buildable now:**
- A: yes, small.
- B: yes, bigger (AI tagging pipe = Stage 3 of the roadmap, "genuinely easy now").
- C: needs 2–3 weeks of daily snapshots — which are already accumulating in the `ig_*` tables since 2026-07-11. Build later.

**Open:** Full spec discussion still to come — this is the "bigger version" conversation. The multi-month progress view (from #2) folds in here.

**Vision update (2026-07-13, from Manmeet — supersedes parts of the roadmap A/B/C):**
- **The live link is the join.** When she pastes a post's live URL on a content card (the existing `postUrl` field), the system matches it to the fetched IG post (via permalink/shortcode) and tracking starts automatically. No double entry, ever. The card's own pillar/idea/type ride along — so AI pillar-tagging demotes to a fallback for old posts without cards. Her planning IS the tag source.
- **Interpretation over collection.** The system must read content (reel scripts via transcription, carousel copy, hooks, ideas) and interpret, not just count. Reading parameters to be defined in spec.
- **Her parameters:** content pillars, content quantity, content idea. Core question: which pillar actually performs, not just how often it's posted.
- **Qualitative layer:** brand-recall signals (feedback, "where did they hear about us", the 3-question test from Personal Brand Standard). NOT available from any API — needs a manual capture point, near-zero effort. Open: who logs, when.
- **The purpose sentence:** analytics exists to prove the client's strategy is working (or honestly show it isn't). Page organized around the strategy (pillar scorecard), not around metrics.
- **Per-client confirmed:** every client sees only their own analysis, in their own tab. Manmeet sees all.

**Vision update round 2 (2026-07-13):**
- **Trackability settled:** profile visits and bio-link taps come free with the connection. DM counts do NOT exist in any API — substitute is a ~30-second weekly manual log per client (leads/DM volume), plus "where did they hear about us" gathered from the client directly. Later option (not now): dashboard-served smart bio link we count ourselves, works even for unconnected accounts.
- **Productization principle (her call):** build generic-with-depth, pitchable to other personal-branding agencies. Rule: analytics never hardcodes a client; everything keys off the client's own pillar set and own baseline (always "vs this account's average", never absolute). Record layer's existing hardcoded bits (ResumeGuru pack, Divine questions) are fine; analytics stays clean from birth.
- **Why she's building it:** to give a system to her services — stop managing the whole business over Instagram. Everything from understanding a client to analysis lives in the dashboard.
- **"Parameters" partially decoded:** the aspects a strategy decision hangs on — belongs to the Decide layer, its own future spec/conversation. Not a blocker for analytics.
- **Claude's proposed design (pending her yes/no) — three layers:**
  1. **Pillar Scorecard** — per-pillar: purpose, quantity (from cards), performance vs account baseline, plain verdict (earning / steady / dragging / too early to judge). The strategy-proof front page.
  2. **The Comparison** — her one-winner-vs-four-losers view inside a pillar, with AI reading attached (hook type, idea, format, length, time). Save-rate + share-rate per view as the value signals.
  3. **The Funnel** — content → reach → profile visits → bio taps → leads (manual weekly log), month by month. Brand-building signal: profile visits growing faster than reach.
  - Build order inside analytics: 1 → 3 → 2 (2 waits on the AI reading layer).
- Sequencing call: analytics spec first; the strategy/parameters (Decide layer) conversation is separate and later.

**Pillar critique round (2026-07-13) — design corrections to the scorecard:**
- **Verdict: pillars stay the spine.** They're the only unit that ties results to the plan, and the unit clients understand. Client strategy deliverables do decompose into pillars (confirmed with her).
- **Correction 1 — pillar jobs.** One shared metric across pillars systematically kills the pillars that convert (promo never out-views discovery). Each pillar gets a **job** at strategy time — roughly Reach / Trust / Convert — and is judged only on its job's metrics (reach+shares / saves+profile visits / link taps+logged leads). This IS her "parameters" concept made concrete. Needs her yes: one extra choice per pillar at planning time. (Data model note: extend `ContentPillar` with a job field, eventually.)
- **Correction 2 — cross-cuts.** Pillar is the headline dimension; format and hook are cross-cuts (from the reading layer). The comparison layer must be able to say which dimension explains a result (avoid "pillar dragging" when it's really "carousels dragging").
- **Correction 3 — small-n honesty.** 3–4 posts per pillar per month: judge typical performance not averages (outlier-proof), read over 8–12 week windows, ruthless "too early to judge".
- **Experiments lane.** Explicit experiment flag on a content card + one-line hypothesis; own small analytics section (idea, result, verdict); winners graduate into pillars. Keeps pillar data clean and gives her the experiment record she asked for.
- **Boundary noted:** non-pillar deliverables (bio, highlights, visual identity) are invisible to pillar tracking; the funnel layer catches them indirectly.

**The parameter map (2026-07-13) — the engine's inside layer, agreed as the design method:**
Manmeet's framing: decide the parameters that shape the analysis before building it. Five families:
1. **What the post IS** (Record layer — her cards + AI reading): pillar, format, hook type, idea/topic, execution traits (length, caption style, CTA), experiment flag + hypothesis.
2. **Circumstances** (context): posting time/day, post age (results mature), consistency around it, follower count at post time.
3. **What happened** (Fetch layer — the pipe): views/reach; saves+shares as rates per view; profile visits, follows; link taps, logged leads; spike-vs-slow-burn shape from daily snapshots.
4. **Judged against** (normalizers — the honesty layer): account's own rolling baseline (never absolute, never cross-account), format-matched comparisons, the pillar's job decides which signals count, 8–12 week windows, minimum sample or "too early to judge".
5. **The strategy** (set at planning): pillar jobs, mix targets, quantity target, the client's north star (Journey goal).
- **Luck:** not measurable, but defended against via Family 4 (typical-performance judging, sample minimums, spike-shape detection).
- **Show-its-work rule:** every verdict must be explainable in one plain sentence from these parameters (which signals, why, against what baseline, on how many posts). Extends the roadmap's trust rule from numbers to reasoning.
- **Experiments lane: YES from Manmeet** (2026-07-13).

**Topics as first-class objects (2026-07-13, from Manmeet):**
- One topic takes many shapes: across formats (reel / carousel / infographic) and across pillar framings (+story → personal; value-only → general). The engine must support this flexibility of comparison.
- **Data model:** lightweight Topic entity; content card gets an optional topicId. A "Repurpose" action on a card births a sibling card sharing the topic (own format, own pillar, own dates). Her repurposing workflow IS the data entry.
- **New comparisons unlocked:** same topic across formats (clean format test — subject held constant); same topic across pillar framings (which framing lands); topic strength across all expressions (strong topic + weak post = remake; weak everywhere = drop subject).
- **Rule:** expressions of one topic are compared side by side, never averaged into one number.
- AI reading may SUGGEST topic grouping for old/unlinked posts; her explicit repurpose action is the trusted source.

**Pillar lifecycle answers (2026-07-13, Claude's position, pending her confirm):**
- New pillar creation asks for: job (one tap — Reach / Trust / Convert) + optional one-line "what this pillar is for" (doubles as the client-facing explainer on the scorecard). ~5 seconds, once.
- Pillars are per-brand and alive, not locked: add later (starts at "too early to judge", others unaffected since all verdicts are vs account baseline; only mix targets need rebalancing); rename free (data on IDs); retire = inactive, history kept; job change allowed but change-dated so regimes don't mix.
- Job vocabulary fixed and small (Reach/Trust/Convert) for cross-brand comparability (the product story); pillar names fully custom per brand; assignment per pillar per brand. A fourth job word can be added later if real use demands it.

**Topic weight — settled design position (2026-07-13):**
- **Full recording weight:** topic links recorded from day one via the repurpose action (recording is free; the link is unreconstructable later — same asymmetry as daily snapshots).
- **Partial verdict weight:** individual topics (n=2–4 expressions) get side-by-side *observations* ("reel version doubled the carousel"), never statistical verdicts. Observation framing is honest and actionable; certainty framing would be lying.
- **The real payoff is at the pattern level:** the reading layer tags every post's topic TYPE (how-to, fear-based, myth-busting, story...). Across 30–50 posts the engine finds combination verdicts: topic-type × format × pillar ("how-to as carousel under Value: 4/5 wins"). Combinations with 3+ occurrences above baseline become recommendations + AI-generated next post ideas seeded by proven combos; below that, "early signal, keep experimenting" (feeds the experiments lane). This IS the Decide layer's first feature, specced through the front door.
- **Weight split:** pillar = strategy accountability, client-facing headline ("is the strategy working"). Topic = creative intelligence, her-facing seed bank ("what should we make next"), lives in the comparison layer.
- **Guardrail:** topic assignment is never mandatory — only via repurpose or deliberate grouping. No 200-entry topic dropdown, ever (design law). Untagged cards still join pattern analysis via AI-read topic types.

**Decisions locked (2026-07-13):**
- **Pillar jobs: YES.** Reach / Trust / Convert, one tap at pillar creation + optional one-line purpose. Existing pillars get jobs retroactively, once.
- **Connections: ALL accounts she controls now.** ResumeGuru (live), Divine, KRNL, personal, any client account whose login she holds — tester invites, ~2 min each. Data accumulates from day one; every week unconnected is history lost.

**Final design round (2026-07-13) — everything blocking resolved:**
- **Three layers: LOCKED**, with her sync condition promoted to a spec rule (the one-truth rule): one set of objects, every screen a window onto them; client and owner see the same truth filtered by role.
- **Funnel last step: never hardcoded.** Her catch: a DM is a query, not a conversion; each client's route differs (WhatsApp / trial / call / order). Resolution: the funnel reads each client's Journey north star + monthly check-ins, which she already logs. No new logging ritual; no DM metric. The separate "weekly leads log" question dissolved.
- **The Digest agreed:** the engine concludes periodically ("this is happening, this is where you are"); she decides. Monthly per client + weekly owner pulse. Client-visible digests pass her approval (rule 1).

**SPEC SET WRITTEN (2026-07-13)** — the numbered map, review one by one:
- `01 — Task Client Sync.md` (4 forks pending)
- `02 — Content Filters & Month-Aware Pillars.md` (1 fork pending)
- `03 — Analytics Foundation — Link Join & Connections.md` (locked)
- `04 — Analytics Data Model — Jobs, Topics, Experiments.md` (locked)
- `05 — Analytics Page — Scorecard, Funnel, Comparison.md` (locked)
- `06 — Analytics Reading Layer — AI Tagging.md` (parameter list pending her review)
- `07 — Analytics Digest — The Engine's Conclusion.md` (agreed in principle)
- Analytics build order: 03 → 04 → 05 (scorecard, funnel) → 06 → 05 (comparison) → 07. Specs 01–02 independent, schedulable anytime.
- Each build ships only on her explicit go (rule 6), one at a time.

**Flow archetypes added (2026-07-13, from her CTA question):**
- Her insight: the client's goal/CTA changes the flow — website conversion vs DM/WhatsApp bookings vs subscription sales are different processes, not just different CTA text. Confirmed correct: funnel middle is universal (content → reach → profile visit); the goal changes the last mile, the Convert-pillar metrics, and what content should ask.
- Design: **flow archetype** per client, one tap at strategy time: Website / Conversation / Direct sales / Audience first. Declared, never inferred; everything downstream configures automatically. Honest blind spot: conversation flows have an API-uncountable segment (DMs), lean on the north-star check-in.
- Bonus feature: **CTA alignment check** — reading layer tags each post's CTA; mismatch with declared flow = flagged strategy drift.
- Added to Specs 04 (data model + vocabulary pending her confirm), 05 (funnel + check), 06 (CTA tag), 07 (digest vocabulary).

**Implementation started (2026-07-13):**
- Spec 03 build agent spawned (zero pending decisions). Code lands in the session worktree branch; carried to deploy repo only on her go.
- **Spec 03 BUILT (2026-07-13, not yet deployed):** typecheck + build clean, nothing committed/pushed. New: SQL migration (`ig_accounts.client_id`, `ig_post_links` table), shortcode matcher (`lib/igShortcode.ts`), multi-account sync with per-account tokens + nightly post-link matching (`app/api/ig-sync/route.ts`), owner-only Connections screen (`/connections`, sidebar shortcut) to link accounts to clients and paste new tokens (verified + stored server-side, never sent to browser). Manual steps for Manmeet in `dashboard/docs/spec-03-setup.md`: run the SQL once, tester-invite each account, paste each token in Connections, link accounts to clients. Deploy = carry to `client-tracker` on her explicit go.
- All specs now carry an explicit "Pending decisions (Manmeet)" block.

**DECISIONS ROUND (2026-07-13, Manmeet answered everything — all specs unblocked):**
- Spec 01: tick→Posted YES + cancel action; client tasks in My Day YES; stage rename delegated to Claude (labels: Idea → Making → Ready → Scheduled → Posted, ids unchanged); type picker confirmed + her upgrade: Content type opens the real card editor (client pre-picked, date pre-filled) so pillar/stage are set at creation; multi-client = fill once, one card per client.
- Spec 02: dateless ideas stay visible (separated); NEW RULE: never-posted cards never count in analysis.
- Spec 04: flow archetype REVISED to multi-select goals — Links (website/Calendly/Topmate taps) / Conversations (DMs — not API-countable, north-star fallback) / Followers (growth). 1–3 per client, changeable, extendable list.
- Spec 05: global /analytics RETIRED; her overview lives in ResumeGuru's own Analytics tab (owner view).
- Spec 06: tag list LOCKED with her additions — ending/close type, trending audio, face vs no-face; reels transcribed, carousels read slide by slide, structure captured (start/hook, end/close, CTA).
- Spec 07: monthly digest right after month-end + always-visible running state mid-month + weekly owner pulse. LOCKED.
- Spec 03 build committed on the session branch (5176a00). Spec 04 build agent spawned next (analytics chain order); Spec 01 queued after.

**BUILD DAY (2026-07-13, her instruction: build everything deploy-ready today, ship each on her go):**
- Build queue, sequential (shared files): 03 ✓ (5176a00) → 04 ✓ (bef6cb5: jobs+purpose in pillar modal, Topic+Repurpose, experiment flag, goals multi-select in Journey; tsc clean) → 05 ✓ (0bd3dd4: Analytics tab, scorecard with median/70-day/min-5 verdict math, funnel + profile-visit/link-tap collection, comparison with honest empty states) → 06 (building).
- **HER INSTRUCTION (2026-07-13): STOP after Spec 06.** Specs 07 (digest), 01 (task sync), 02 (filters) are NOT to be built until she says so. Queue ends when 06 lands and is committed.
- 06 ✓ (7d59a47): nightly ig-tag cron (Claude Sonnet, ~6 posts/run, capped, idempotent, sticky owner corrections), patterns section (topic x format x pillar, same honesty math as scorecard), tap-to-correct tag chips, CTA alignment flags. HONEST LIMIT: reels are tagged from cover + caption only — Claude takes no audio/video input, so no reel transcription; transcript marked 'no-transcript', trending_audio stays null in practice. Carousels get real slide text. BUILD QUEUE CLOSED.
- **Analytics core deploy checklist (when she says go):** carry 4 commits (5176a00, bef6cb5, 0bd3dd4, 7d59a47) to client-tracker; run 3 SQL files in Supabase (spec-03-link-join, spec-05-account-insights, spec-06-post-tags); set ANTHROPIC_API_KEY in Vercel; remove old global /analytics in the deploy repo; her paperwork: tester invites + tokens into Connections (dashboard/docs/spec-03-setup.md).

**Spec 01 build requested (2026-07-13 evening):** she explicitly asked for Spec 01 (task <-> client sync) — the first thing discussed — to be built so she can see it. This is a deliberate override of "stop after 06" for this one spec (07/02 still not to be built).

**Spec 01 SHIPPED (2026-07-14):** deployed alone, isolated from analytics. Because the first build was stacked on the analytics commits, it was rebuilt cleanly off `origin/main` (branch was created + removed), merged to main (commit ad392f3), and grafted to `client-tracker/main` (deploy commit c18c896) via the DEPLOY.md procedure. All three gates passed: green local build, drift = only the 5 Spec 01 files + docs (no live-only files to erase), her explicit "just make it live" go. Vercel build: success. STATUS = LIVE.
- Deploy procedure is now documented at `dashboard/DEPLOY.md` (she wrote/merged it to main). Authoritative; graft = commit-tree origin/main:dashboard onto client-tracker/main, fast-forward push, never --force.
- The analytics stack (Specs 03-06) remains BUILT but UNDEPLOYED on branch claude/dashboard-status-review-fb52e4 (commits 5176a00, bef6cb5, 0bd3dd4, 7d59a47) + the stacked Spec 01 (f0fbead, now superseded by the clean main version). Analytics still needs its setup day (SQL migrations, ANTHROPIC_API_KEY, tester invites) before it deploys.
- NEXT SESSION (Fable, tomorrow): re-open Specs 08-10 design (Brand Profile / Strategy Draft / Playbook+Taste) and the parameter vocabulary session; decide analytics deploy timing.
- Analytics design audit vs her demands: PASSED (link-join no-double-entry ✓, one-truth sync ✓, interpretation layer ✓, job-based strategy proof ✓, per-client goals ✓, digest ✓). Three standing truths: comparison layer fills last (needs tags), verdicts need 8–12 weeks of data, nothing flows until her tester-invite paperwork (dashboard/docs/spec-03-setup.md).

**ANALYTICS CORE SHIPPED (2026-07-17).** Specs 03, 04, 05, 06 are LIVE on the deployed dashboard (deploy commit 8704156 on client-tracker/main; Vercel success). Reconciled with the four features that shipped after 07-13, analytics v1 retired in the same landing so live and vault main are back in sync. Now visible: per-client Analytics tab (scorecard/funnel/comparison), owner-only /connections screen, nightly link-join + AI tagger crons. STILL EMPTY until her setup day (3 SQL files, ANTHROPIC_API_KEY, tester invites + tokens) — see STATE.md "SETUP DAY STILL OWED".

---

## 4. Client onboarding — rework → THE BRAND PROFILE (decoded 2026-07-13)

**What (from her full vision statement):** Onboarding becomes the **Brand Profile** — one structured parameter sheet per client that everything else reads. Her service's station 1: fetch client data, decide positioning. The parameter space is finite and interconnected: what they sell / offers, goal mix (sales / recognition / trust), audience type, personality-vibe (bold, trustworthy, friendly, loyal, caring...), platform choice, available CTA set (course / template / book-a-call / DM...), content rules (pillars, frequency, timing), brand book / story, raw customer data. Discovery questions stay; their answers land in FIELDS, not paragraphs.

**Status:** **SPEC WRITTEN (2026-07-17): `08 — Brand Profile.md`.** 16 onboarding questions mapped to ~20 typed fields across six blocks (offer, audience, goals, vibe, content rules, history), every field naming which station reads it. Blocked only on the vocabulary session (her word lists) + her review of the question list.

**Sequenced:** after the current build stack ships.

---

## 5. "One thing" — the connected system / system of record

**What:** The feeling that things are built but disconnected. Documented open question in the vision + roadmap: two candidate homes — the **client dashboard** (live, clients use it) vs **KRNL OS** (the bigger brand OS in `studio/krnl-os`). One becomes the system of record; the other merges in or feeds it.

**Status:** **RESOLVED as a spec (2026-07-17): `13 — The Connected Loop.md`** — the master map of the eight-station loop (Understand → Strategy → Make → Publish → Fetch → Measure → Analyze → Decide → back), the nine connection points (C1–C9) with what carries each and its status, the honest scoreboard (4 specs live, 4 built-undeployed, 3 specced-unbuilt, 2 unwritten), and a proposed closing order. The dashboard-vs-KRNL-OS question keeps the earlier partial answer (#6): dashboard = operating system, parameter/taste layer on top.

**Opinion:** The vision doc already argues the analyzer should live in the existing dashboard, not a new app, because a separate tool recreates the disconnection. Claude's lean: make the **dashboard the spine**, fold KRNL OS context into it over time. But this is Manmeet's call and worth deciding before Analytics B is built, so it's built into the winner.

**Open questions:**
1. Dashboard or KRNL OS as the single system of record?
2. What does KRNL OS hold today that the dashboard doesn't? (needs a look at `studio/krnl-os`)

---

## 6. "The parameters thing" — FULLY DECODED (2026-07-13): the Strategy Engine

Her complete vision, stated 2026-07-13. Her service = three stations: Positioning (onboard → fetch data → decide positioning) → Operation (create, track = record/fetch) → Learning (analyze per brand + across brands). The parameters are station 1's finite decision space (see #4), interconnected (audience shapes platform, goal shapes CTA, personality shapes style). Once explicit, her judgment stops being re-derived per client ("that just eats my brain").

**The three future specs — ALL WRITTEN as of 2026-07-17:**
- **Spec 08 — Brand Profile** (= #4): the structured parameter sheet + onboarding rework. WRITTEN.
- **Spec 09 — Strategy Draft:** WRITTEN 2026-07-17. Two moments (day-one draft from the profile; monthly refresh draft from the digest), the citation rule (no item without a plain-words why), and the C8 mechanics: accept/edit/dismiss per item, accepted changes edit the real strategy objects change-dated, all landing in a per-client strategy changelog. 4 pending decisions.
- **Spec 10 — Playbook + Taste layer:** WRITTEN 2026-07-17. Playbook: evidence-born entries (spec 06 threshold), context-matched citation, small-n honesty stored on the entry, no cross-account numbers, entries age. Taste: distilled from her accept/edit/dismiss stream, visible and editable rules, conflicts with evidence surface and never auto-resolve. Staged so 08/09 get built with the right hooks. 3 pending decisions.

**Boundary (told to her):** nothing literally trains a model — it's an inspectable, citable evidence playbook the AI reads before drafting (open-book exam, same as the roadmap's RAG note). Numbers/trust/honesty rules inherit from analytics.

**Alignment verdict (2026-07-13):** today's build IS this system's middle — pillar jobs, client goals, topics, experiments, CTA-check are the first parameters already live. Missing: the intake (08) and the generator (09/10).

**Partial answer to #5 ("one thing"):** dashboard = the operating system; the parameter + taste + playbook layer = KRNL OS, living on top of the same objects, not a separate app. Her words: "make this as a tool for KRNL OS... parameters are layered by the taste that I have."

**Next step:** a working session to pin each parameter's finite vocabulary (vibe words, CTA set, audience axes) — the heart of Spec 08.

---

## 7. Momentum meter (ResumeGuru effort tracker)

**What:** An effort meter on the ResumeGuru Journey tab. She logs daily work with one-tap
chips (posting auto-counts from the Content board), the meter (0–100) moves forward on
worked days and slips back a little on skipped ones, a 14-day strip shows the streak, and
the real IG numbers (followers, engagement, reach, week over week) sit underneath from the
`ig_*` tables. Full spec: `11 — Momentum Meter.md`.

**Status:** SHIPPED. Requested, decisions locked, built, and deployed 2026-07-17.

**Opinion:** Emotionally load-bearing. The IG numbers alone read as failure right now; the
meter makes the effort visible while results catch up. Small build, no access-rule changes.

**Buildable now:** Yes — built. Ships as an overlay (analytics v1 stays out of live).

---

## 8. Shared Lists (collaboration on pipelines)

**What:** A list can be shared into another workspace: one list, same rows and stages,
visible and workable from both sides. Built for running workshops with Merushri. Owner
shares/unshares/edits the list itself; the shared side is a full partner on rows (add,
move, edit). Full spec: `12 — Shared Lists.md`.

**Status:** SHIPPED. Requested, locked (full partner), built, and deployed 2026-07-17.
One-list model with server-side windows for client logins, 19-check security test on
the access functions.

**Opinion:** The right primitive — one truth, no twin-copy drift, and the access-rule
guarantee is extended rather than weakened.

---

## 9. The Connected Loop (master map)

**What:** The spec that makes the whole system one loop and names every
connection point. `13 — The Connected Loop.md`. Resolves #5.

**Status:** SPEC WRITTEN 2026-07-17. Not a build itself — it is the contract
other builds follow, plus a proposed closing order (deploy 03–06 → fix the
pipe → spec 14A → spec 08 → spec 07 → 14B/09). Pending: her confirm on the
order and the analytics deploy "go".

---

## 10. Content automation (the publish seam)

**What:** Her two use cases, specced as `14 — Content Automation.md`.
A — posts she makes on Instagram auto-mark their card Posted and start
tracking (matcher inside the existing nightly sync; confident match moves the
card, uncertain match asks, unplanned posts land in a one-tap inbox).
B — schedule and publish to Instagram from the dashboard (we hold the
schedule, cron publishes at time; owner-armed per card, loud failure states,
v1 = image/carousel/reel + caption).

**Status:** SPEC WRITTEN 2026-07-17. A depends on spec 03 deployed + healthy
pipe; B builds after A earns trust. 4 pending decisions in the spec.

**Opinion:** A is the cheapest honest win in the whole backlog once 03
deploys — it completes the loop's data with zero new rituals. B is the
flashy one; ship it second.

---

## 11. Data quality & trust (the pending conversation, prepared)

**What:** `15 — Data Quality & Trust.md`, written 2026-07-17 from her ask
("think hard about the missing connection — how to improve the quality of the
data for analyzing strategy"). Seven quality risks with a defense each: pipe
holes, unlinked posts, polluted baselines, wrong tags, the qualitative gap,
strategy drift, and confidence theater. Centerpiece proposal: the **Data
Health card** — the analysis states its own trustworthiness, and verdict
language is chained to data health (green may say "working", red says
"collecting").

**Status:** DISCUSSION AGENDA, not locked. Needs a 30-minute working session
(agenda at the bottom of the spec). Builds are small and independent; none
urgent before the analytics core deploys and runs for a few weeks.

---

## 12. Money meter (momentum v2, effort in dollars)

**What:** `16 — Money Meter.md`, requested and built 2026-07-18. The Momentum
card speaks money instead of points: she sets what the month's work is worth,
each worked day earns its share (chips + auto-counted posts), a dollar icon
rides the bar, and an optional extra value marks a day that deserved more.
Design change from spec 11, deliberate: **earned money never decreases** — a
skipped day earns $0 and the pace mark shows the gap, instead of taking
dollars back. Set the value to 0 to return to points mode; old log untouched.

**Status:** SHIPPED 2026-07-18 (deploy commit b1cd328, Vercel success).
Verified interactively before deploy (points mode, conversion, chip earning,
extra value, pace math all exercised in the browser; one real bug found and
fixed in verification: logging a day used to drop the monthly value).

---

## 13. Catalogue PDF export (Sonia)

**What:** `17 — Catalogue PDF Export.md`, requested and built 2026-07-19.
Sonia picks photos from anywhere in the catalogue (selection survives moving
between categories), taps Make PDF, and the phone's share sheet opens with
the PDF attached — one photo per page (her locked layout choice), photos
recompressed so the file stays WhatsApp-friendly. Nothing saved to AppState;
no access-rule changes; one new dependency (jspdf, loaded only when used).

**Status:** SHIPPED 2026-07-19 (deploy commit 1ad7fd1, Vercel success).
Verified interactively before deploy (selection across categories, picked
badges, toggle on/off, PDF build fetched the picked photos in order,
desktop + 375px).

---

## 14. Observations panel + WhatsApp bridge

**What:** `18 — Observations Panel.md`, requested 2026-07-20. Part A: a
private owner-only notebook at `/observations` — she writes an observation,
gives it a topic (free text, chips for existing topics), optionally tags a
client; notes group by topic. The slice is stripped for every other role,
same guarantee as personal tasks. Later this becomes the manual capture point
the analytics qualitative layer needs (spec 15's gap). Part B: a "Dashboard"
WhatsApp contact she texts observations to; a webhook receives them and AI
files each into the right topic.

**Status:** SHIPPED 2026-07-20 (deploy commit 58f1f70, Vercel success, all
three gates passed). The panel is live and usable now; the WhatsApp side is
inert until her Meta setup day (`docs/spec-18-setup.md`). Part A was
verified interactively. Part B unblocked the same day (she got an eSIM) and
grew into the full WhatsApp inbox on her ask: hashtags steer (`#task` → My
Day, `#client #task` → client agenda, `#word` → observation topic, photo +
`#client` → client assets), AI files only untagged text and only into
owner-only Observations (rule 1 kept). 31 routing checks + endpoint security
curl-tests green. After deploy: her ~45-min Meta paperwork
(`docs/spec-18-setup.md`), then the live test script.

---

## 15. Content Engine (seed to post)

**What:** `19 — Content Engine (Seed to Post).md`, requested 2026-07-21. Her
mechanism for the content funnel: she talks about a topic once in depth (the
seed), selects format + platform + pillar, and gets a ready draft; every
repurpose after the seed is the machine's job. Four knowledge layers (platform
files, format files, pillar layer, taste layer), built examples-over-rules like
the IG writing systems. Improvement loop: her edits are captured and distilled
into taste rules she confirms. This is the Make station of the Connected Loop
(spec 13) getting its engine; seeds map onto spec 04 Topics; the taste capture
is the early on-ramp to spec 10 Half B.

**Status:** DRAFT awaiting her validation. Location undecided by her design:
Door 1 (no code, vault files + chat, testable today), Door 2 (in-dashboard,
rides Topics + Repurpose), Door 3 (standalone tool). Claude recommends Door 1
now, decide later. Deliberately code-free until the separate chat-bubble
feature writes its state into the repo, so the two cannot collide.

**Buildable now:** Door 1 needs no build at all. The test script is in the spec.

**Open questions:** her 5 pending decisions at the bottom of the spec (format
and platform lists, first brand, file location, chat-bubble sync, door choice).

---

## Sequencing (Claude's recommendation, not locked)

1. Task sync (#1) — biggest daily payoff, ship first.
2. Pillars + filters (#2) — quick win.
3. Analytics A → B (#3) — the flagship, spec fully first.
4. Onboarding (#4) and connected-system (#5) — decide scope before they can be sequenced.
5. Parameters (#6) — undefined until Manmeet explains.

---

## [2026-07-25] PLAN RECONCILIATION — the master plan supersedes this backlog

`dashboard/PLAN.md` was locked whole on 2026-07-25. It outranks this file and
every spec below 21. Where the 20 stand under the plan:

- **Live, staying, re-addressed by spec 21:** 01, 02, 11*, 12, 16*, 17, 18A,
  18C. (*Momentum and Money meter survive only in her own profiles — plan §7.)
- **Live but dark, needs her setup day (do NOT wait for the restructure —
  recording is the engine's first duty):** 03–06. Plus the IG collection
  stall (since 07-12) needs fixing now.
- **Built, undeployed, her go pending:** chat brain v4.
- **Absorbed into the plan (files stay as history, never build from them):**
  08 → intake + detail folders; 09/10 → the engines' loop-back and feedback
  memory; 13 → the plan itself; 15 → the four trust rules; 19 → plan §5.1;
  20 → the tree (plan §3).
- **Re-cut by Opus at the right path step:** 03–07 machinery → the Analysis
  Engine spec family; 14 → the Creation app specs.
- **Parked, unchanged:** 18B (WhatsApp).

New specs start at 21 and follow the plan's build order (plan §8 step 6).
Every new spec must declare its folder addresses and its switches, or it is
rejected (plan §6).

**Written 2026-07-25:** `21 — Data-Layer Restructure.md` — the address ledger.
Gives every existing slice, table, route, and component its address in the
plan's tree, with the folders it reads and writes and the switch it registers;
declares the folder/switch declaration contract and its validator, the
canonical objects the Sol amendments require, and the migration order. Nothing
built. Five open questions raised to the control room (see STATE.md): the
owner-level home for the chat thread and untagged observations, public preview
links, profile bindings and delegated approvers, the parameter inventory, and
S22 retention/deletion authority.

**CLEARED 2026-07-25** — all five questions closed (PLAN §11): the chat and the
untagged inbox are HELD/frozen, public preview links survive behind their switch,
bindings are (person, profile) pairs, spec 21 ships the parameter contract and
the intake spec ships the inventory, retention is forever with deletion only by
her after an export.

**BUILT 2026-07-25, NOT DEPLOYED** (branch `claude/spec-21-data-layer-6d04af`,
three commits). In the spec's own order: the declaration contract, switch
registry and validator (`lib/tree/`); then path-scoped writes at
`app/api/state`, which closed the save race (gotcha 2); then the pilot profile
(ResumeGuru, one of hers) migrated into a path-addressed body, with an
owner-only dry-run door at `app/api/migrate-profile`. Access now binds by
profile id and `RESTRICTED_MATCHERS` is deleted. All ten acceptance tests plus
spec 12's re-run security checks pass — 70/70 via `npm test`. Deploy is hers per
DEPLOY.md; the real-data migration run is still pending her.
