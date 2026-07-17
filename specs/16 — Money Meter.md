# 16 — Money Meter (momentum v2: effort in dollars)

Requested 2026-07-18, decisions taken same day. The Momentum card (spec 11)
stops speaking in points and starts speaking in money: a bar with a money
icon that moves forward as she works, showing what the work earned toward
the month's goal.

Her framing: this build phase needs a lot of effort, and she wants that
effort counted against the goal — "show me how much money I made, every
dollar I'm earning when I'm working on this."

## Decisions (Manmeet, 2026-07-18)

1. **Where:** the Momentum card on the ResumeGuru Journey tab converts.
   Same card, same diary logging, same chips, same 14-day strip.
2. **Dollar rule: Mix.** Days earn automatically from a monthly value she
   sets once; a specific day can carry extra value when the work deserved
   more.
3. **Money type: effort money.** Symbolic, honest: the bar shows what her
   work is worth toward the goal, so effort feels paid before results
   arrive. The card says so in plain words; it never pretends to be revenue.

## The money math (computed on render, only the log is stored)

- She sets **the month's work value** once, e.g. $3,000. Stored as
  `monthlyValue` on the momentum data; editable anytime with a pencil tap.
- **Daily rate** = monthly value ÷ days in that month. ($3,000 in a 30-day
  month → a full work day earns $100.)
- **A day earns** its fraction of the daily rate: the existing day score
  (chips + auto-counted posted cards, capped at 8 points) divided by the
  cap. A full day earns 100% of the rate; a half day earns half. Plus that
  day's **extra value**, if she added one.
- **Earned money never goes down.** This is the one deliberate change from
  spec 11's slip-back rule: taking back dollars she earned would make the
  dollar a lie. A skipped day simply earns $0 — and the card shows **pace**
  instead: where the bar should be by today vs where it is ("$120 behind
  pace" / "ahead of pace"). The pressure survives; the honesty improves.
- Month boundary: each month starts a fresh bar. The log keeps everything.

## The card, money mode

- Big number: **$ earned this month** (was: the 0–100 score).
- The bar fills toward the monthly value, a dollar icon riding the fill
  edge, a thin tick showing today's pace point.
- "+$X today" replaces "+N today". Streak unchanged.
- 14-day strip unchanged, tooltips and the day panel show that day's $.
- "Extra value" on today: a small optional field — for days that deserved
  more than the flat rate.
- Honesty line under the title: effort money, not revenue.
- Until she sets a monthly value, the card shows spec 11's points meter
  unchanged plus a one-line invitation to switch. No data migration; the
  new fields are optional on the existing log.

## Files

`types/index.ts` (two optional fields), `components/MomentumMeter.tsx`.
No access-rule changes: `momentum` is already a handled slice.
