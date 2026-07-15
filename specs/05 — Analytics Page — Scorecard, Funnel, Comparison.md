# Spec 05 — The Analytics Page: Scorecard, Funnel, Comparison

Status: three-layer structure locked (2026-07-13) with the sync condition. Replaces the rejected global /analytics table.
Build size: large (the flagship screen). Builds in three passes: Scorecard → Funnel → Comparison.
Depends on: Spec 03 (joins), Spec 04 (jobs/topics/experiments). Comparison additionally needs Spec 06 (reading layer).

---

## The one-truth rule (Manmeet's condition, 2026-07-13)

There is ONE set of objects — card, topic, pillar, job, journey goal — and every screen is a different window onto the same objects. The scorecard reads the same cards the Board shows and the same pipe the funnel reads. Client and owner see the same truth filtered by role, never two parallel records. Any feature needing its own copy of data is rejected by design.

## Where it lives

A per-client **Analytics tab** inside each client's workspace. Role access follows `lib/access.ts` exactly: each client login sees only their own; Manmeet sees every client's. The old global `/analytics` page retires or becomes an owner cross-client overview later (her call, not blocking).

## Layer 1 — Pillar Scorecard ("is the strategy working?") — client-facing front page

- One card per pillar: its purpose line (from Spec 04), quantity this period (posts from cards) vs mix target, performance on its JOB's metrics vs the account's own rolling baseline, and a plain verdict: **earning / steady / dragging / too early to judge**.
- Verdicts are code-computed (never AI prose), so they display without approval.
- Honesty rules: judged on typical performance (outlier-resistant, not averages), 8–12 week windows, minimum sample or "too early". Never absolute numbers, never cross-account comparisons.
- **Show-its-work rule:** every verdict expands to one plain sentence: "Judged on saves and profile visits because this pillar's job is Trust; compared against this account's baseline; based on 7 posts over 10 weeks."
- Plain-language explainers on every metric (clients read this page). Client's brand accent colors.

## Layer 2 — The Comparison ("what's winning and why?") — depth view

- Topic groups side by side: same topic across formats (subject held constant = clean format test) and across pillar framings (story vs value version).
- Cross-cuts: format and hook are independent dimensions, so "pillar dragging" can be distinguished from "carousels dragging".
- Value signals: save-rate and share-rate per view.
- Individual topics get *observations* ("the reel version doubled the carousel"), never statistical verdicts — n is 2–4.
- Pattern level: topic-type × format × pillar combinations across 30–50 posts. A combination with 3+ occurrences above baseline becomes a recommendation; below that it shows as "early signal, keep experimenting".
- Experiments section: hypothesis, result, verdict (from Spec 04).
- Multi-month view (2–4 months side by side) lives here — the request from the filters discussion.

## Layer 3 — The Funnel ("is it building the business?")

- Month by month: content volume → reach → profile visits → bio link taps → **the client's own north star**.
- The last step is NEVER hardcoded (Manmeet's rule: a DM is a query, not a conversion; every client's route differs — WhatsApp, trial, call, order). The client's **flow archetype** (Spec 04) configures the last mile automatically: website → link taps; conversation → north-star check-in (API can't count DMs — shown honestly); direct sales → taps + orders/signups; audience → growth. The north-star values come from the Journey check-ins she already logs. No new logging ritual.
- **CTA alignment check:** the reading layer tags each post's CTA type; if content keeps asking for something that doesn't match the declared flow (e.g. website CTAs on a conversation-flow client), the engine flags the drift.
- Brand-building signal: profile visits growing faster than reach = content making people curious about the person.

## Owner vs client view

Same data, two windows: the client sees Scorecard + Funnel + curated highlights. Manmeet sees everything including comparisons, experiments, early signals, and unplanned (unlinked) posts. Anything AI-*worded* that a client would see passes her approval first (dashboard rule 1); code-computed numbers and verdicts display automatically.

## Files touched

New `app/client/[id]/analytics/` + `components/AnalyticsView.tsx`; server routes reading `ig_*` + join tables; `lib/access.ts` tab visibility per role.

## Decisions (Manmeet, 2026-07-13)

1. **Old global `/analytics`: RETIRE.** Its content (the overview she checks) moves into ResumeGuru's own per-client Analytics tab, owner view. No global analytics page remains.
2. Goals vocabulary locked in Spec 04 (Links / Conversations / Followers, multi-select).
3. **Never-posted cards never enter analysis** (her rule): analysis counts only posted posts linked via the join. Ideas and unposted cards are planning data only.
