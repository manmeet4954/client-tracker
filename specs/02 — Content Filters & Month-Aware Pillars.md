# Spec 02 — Content Filters & Month-Aware Pillars

Status: design agreed, 1 fork pending.
Build size: small, self-contained. Good quick win.
Depends on: nothing.

---

## What it is

The Pillars view currently ignores the selected month and shows the all-time idea library, while Board and Table follow the month. Manmeet wants Pillars month-aware, plus a richer filter row.

## How it works

- **Pillars view obeys the month picker.** Recommended behavior (fork 1): show the selected month's cards PLUS all dateless cards (the backlog never hides). A small toggle or count indicator distinguishes "this month" from "no date yet".
- **Filter row additions** (Board, Pillars, Table):
  - Content type filter (Static / Carousel / Reel / ...).
  - Pillar filter dropdown — Board and Table only (in Pillars view the columns already are the pillars).
  - Existing platform chips and search stay.
  - Month picker becomes visible in Pillars view too (currently hidden there).

## Explicitly out of scope

"Select 2–4 months and see progress across them" — that is an analysis view and belongs to the Analytics page (Spec 05). Flagged by Claude, agreed, to prevent scope creep.

## Files touched

`components/ContentView.tsx` only (plus `lib/utils.ts` if a helper is needed).

## Decisions (2026-07-13)

1. Dateless backlog cards: **always visible** in month-filtered Pillars, clearly separated from the month's dated cards (Claude's recommendation, unvetoed).
2. **Her rule, now explicit:** ideas that were never posted NEVER count in analysis — no impact can be measured for something that never went live. (Analysis counts only posted, linked posts; enforced in Spec 05.)
