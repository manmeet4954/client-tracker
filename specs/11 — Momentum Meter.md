# 11 — Momentum Meter

Requested 2026-07-17, in her words: ResumeGuru's Instagram feels dead, opening the page is
demoralizing, and she cannot see whether she is making progress. She wants speed and
experiments, not waiting. She asked for a goal tracking system that tracks progress by the
effort she puts in: she logs what she did each day, and a meter moves forward or backward.
Skipped days pull it back. Connect it to the Instagram data that already collects daily.

Decisions locked 2026-07-17 (her answers):
- Lives on the **ResumeGuru Journey tab** (where the goal card already is).
- A day with nothing done **moves the meter back a little** (about half a worked day). Never below zero.
- The goal is **engagement back on the page**, tracked automatically by the tool. Signups
  (CareerOS) stay out of v1 — no data source named yet.

---

## The idea in one line

Results lag effort by weeks on Instagram. If she can only see results, every day feels like
losing. The meter tracks the one thing she fully controls — effort — and shows the real
Instagram numbers underneath it, so effort and results sit side by side.

## What it looks like (top to bottom, one card on Journey)

1. **The meter.** A number 0–100 with a progress bar in the brand accent. Under it, the
   current streak of worked days and what today added.
2. **Today's log.** One-tap chips: Story · Comments & replies · DMs · Outreach · Other work.
   Tap to toggle. An optional one-line note. **Posting logs itself**: when a ResumeGuru card
   hits Posted on the Content board, that day gets the posting credit automatically —
   she never logs a post twice (design law: data as a byproduct of work).
3. **14-day strip.** One square per day: worked = accent, skipped = grey, today = outlined
   until something is logged.
4. **Results row** (the honest mirror): followers now and change over 7 days, engagement
   gained this week vs last week, reach this week vs last week. Read from the `ig_*`
   tables that `/api/ig-sync` fills daily. If the numbers can't load, the row hides —
   the meter never breaks because of the pipe.

## The math (all derived, nothing stored but the log)

- Day score: posted +4 (per posted card, from the board), story +2, comments/replies +2,
  DMs +2, outreach +2, other +1. Capped at +8 per day.
- A past day with nothing at all: −3. Today never subtracts while it is still today.
- Meter = sum over days from the start date, clamped 0–100. Start date = the first day
  she logs. It does NOT reach back to old posted cards; starting the meter in the past
  would bury it under skip penalties before day one.
- The meter value is computed from the log every render. Only the log entries are saved.

## Data + plumbing

- `MomentumEntry { date, actions[], note? }`, `MomentumData { startDate, entries[] }`.
- Stored as `momentum?: MomentumData` on `ClientData` — inside the existing per-client
  blob, like `journey`. No new top-level state slice, so the access functions in
  `lib/access.ts` need no changes (per-client data passes through whole).
- New reducer action `UPDATE_MOMENTUM` mirroring `UPDATE_JOURNEY`.
- New API route `app/api/ig-metrics/route.ts` (owner-only, server-side keys): returns the
  small weekly summary for the results row. Reads `ig_account_snapshots` for followers and
  `ig_daily_snapshots` summed per date for the week-over-week deltas.
- Renders on the Journey tab for clients whose name matches /resume/i (same check the
  ResumeGuru pillar pack uses).

## Out of v1, by decision

- CareerOS signups on the meter (no data source yet; the goal card's north star can hold a
  hand-typed number meanwhile, as today).
- A My Day strip of the meter (she chose Journey only).
- Rest days that freeze the meter (she chose the honest small drop).

## v1.1 — Diary logging (requested 2026-07-17, same day as v1 shipped)

Her ask: instead of only tapping toggles, she wants to WRITE the log like a diary
("Today I did this, yesterday I did this") and have that be the way she logs.

Decisions locked (her answers, 2026-07-17):
- **AI reading.** She writes the entry; an AI reads it and ticks the chips for her.
  The chips stay visible as auto-ticked lights she can tap to correct. Scoring math
  unchanged; the diary is just a better way to feed it.
- **Today only.** No backfill. A missed day stays a skipped day.

Build:
- The one-line note input becomes a proper diary textarea with a Save button.
  Saving sends the text to a new owner-only route `app/api/momentum-read/route.ts`,
  which asks Claude (via the ANTHROPIC_API_KEY env var on Vercel) which chips the
  entry describes, constrained to the five chip ids. Posting is never inferred —
  the board counts it.
- **Graceful fallback:** no API key or a failed call falls back to plain word
  matching (story, replied, DM, outreach...) so the diary never breaks. The
  response says which reader ran (`source: ai | words`).
- Tapping a day in the 14-day strip opens that day's entry read-only, so the strip
  becomes a journal she can read back.
- Needs `ANTHROPIC_API_KEY` set in Vercel env for the AI reading (Manmeet adds it;
  the fallback covers local dev and until the key is set).

## v1.2 — Self-service Instagram updates (2026-07-17)

Context: the daily IG collection stalled after 2026-07-12 and diagnosing it required
the CRON_SECRET, which Vercel hides even from Manmeet. She asked for no manual steps.

- `app/api/ig-sync` now ALSO accepts a logged-in owner session (cookie), not just the
  cron secret. Same trust level; nothing weakened for outsiders.
- When the results row's data is 2+ days old, the Momentum card shows an amber notice
  with an "Update now" button. Tapping it runs the collector and reports the outcome in
  plain words, including Instagram's exact refusal if the connection is broken. That
  message is the diagnosis; she screenshots it if it needs fixing.
- CRON_SECRET is no longer needed for anything she does by hand.

## Ship checklist

- [ ] Types + reducer + component + API route, typecheck clean.
- [ ] Green local build (DEPLOY.md gate 1).
- [ ] Drift check (gate 2) — remember: deploy as an overlay excluding analytics v1, which
      stays out of live until Manmeet decides.
- [ ] Her go (gate 3).
