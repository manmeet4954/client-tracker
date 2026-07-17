# 15 — Data Quality & Trust (the conversation that is still pending)

Written 2026-07-17. Manmeet's framing: "we need to think hard about the
connection part that is missing — how to get things right, how to improve the
quality of the data for analyzing strategy." This spec is that thinking,
prepared. Status: **discussion agenda with Claude's positions. Nothing here
is locked. It becomes a build spec only after the working session.**

The one-line thesis: the loop (spec 13) makes data TALK. This spec makes sure
what it says is TRUE. An analysis built on holes, unlinked posts, and polluted
baselines is worse than no analysis — it is confident nonsense shown to a
client.

---

## The seven quality risks, and the defense for each

### Q1 — Holes in the history (the pipe stall problem)

Instagram never backfills. The current stall (since 07-12) means those days'
growth curves are gone forever. The risk isn't just missing data — it is
analysis that doesn't KNOW it's missing data (a week-over-week number spanning
a hole is a lie).

**Defense proposed:** the pipe becomes self-aware. Every computed stat checks
its window for gaps; a stat spanning a hole is marked "partial data" on
screen. Plus loud failure: if the daily sync misses 2 days, Manmeet gets a
My Day item, not silence. (The Momentum stale-notice from spec 11 v1.2 was
this idea's first sprout; this generalizes it.)

### Q2 — Posted but invisible (the unlinked-post problem)

A posted card without its live link never joins the analysis (C5 never
fires). Today that depends on her remembering to paste. Every forgotten
paste silently shrinks the sample the verdicts stand on.

**Defense proposed:** spec 14 use case A is the real fix (auto-match). Until
it ships: a gentle counter on the Content tab — "3 posted cards aren't
linked yet" — one tap shows them. And the honesty rule extends: the scorecard
states its coverage ("built on 14 of 17 posted cards").

### Q3 — Polluted baselines (the apples problem)

"Vs this account's average" is the honesty layer — but the average can rot:
one viral outlier drags it up (everything after looks like failure), a
follower jump changes the game, a strategy change mixes regimes.

**Defense status:** mostly already designed in spec 04 (medians not means,
8–12 week rolling windows, change-dated regimes) — this session's C8
mechanics (spec 09 §3) close the regime piece. **Open question for her:**
should a detected viral outlier be excluded from the baseline automatically
(with a visible "1 outlier excluded" note), or shown but flagged?

### Q4 — Wrong tags (the reading-quality problem)

The AI reader (spec 06) tags pillar/topic/hook for old posts and reads
content traits. Wrong tags = wrong patterns = wrong playbook entries. Her
corrections are already sticky, but nobody measures how often the reader is
wrong.

**Defense proposed:** a correction rate, tracked quietly. If she corrects
more than ~1 in 5 tags, the patterns section says "tags still settling —
verdicts carry less weight." The reader earns trust with a number, like
everything else. Card-born tags (her own planning) always outrank AI tags —
that hierarchy is already law; state it on screen.

### Q5 — The signals no API has (the qualitative gap)

Brand recall, "where did they hear about us," the 3-question test — the
signals that prove a BRAND is forming, not just content performing. No API
will ever deliver these. Decided long ago they need a capture point;
never designed.

**Proposal to discuss:** one field, not a form. On each client's Dashboard
tab, a tiny "heard about us" counter: client or Manmeet taps +1 and picks a
source word (Instagram / referral / search / other) when it happens in real
life. Ten seconds, additive, and after months it is funnel gold. The design
law question for her: is even this too much ritual?

### Q6 — Strategy drift (the plan-vs-behavior problem)

The mix says 40% Value; the last month was 70% promo. The CTA-alignment
check (spec 06) catches per-post drift; nothing yet watches MIX drift — the
plan quietly becoming fiction while the scorecard still judges against it.

**Defense proposed:** the scorecard's mix column already shows actual vs
target (spec 05); add one honest sentence when the gap stays big for 4+
weeks: "the plan and the posting disagree — update one of them." That
sentence routes to spec 09's refresh draft. Drift becomes a decision prompt,
never a silent re-judging.

### Q7 — Confidence theater (the trust-the-machine problem)

The deepest risk: a clean UI makes weak conclusions look strong. Every
defense above produces a caveat; scattered caveats get ignored.

**Proposal to discuss — the Data Health card.** One card at the top of each
client's Analytics tab, four plain lines:

- Pipe: running / stalled X days (Q1)
- Coverage: X of Y posted cards linked (Q2)
- Tags: settling / trusted (Q4)
- History: X weeks collected (verdicts firm at 8–12)

The rule that makes it matter: **verdict language is chained to data health.**
Green health may say "this is working." Yellow says "early signal." Red says
"collecting." The same math, honest volume control. This is the single
cheapest thing that keeps the system trustworthy at a client meeting — and
it is the missing connection Manmeet sensed: the analysis talking about
ITSELF.

---

## What this costs (build shape, if agreed)

Small pieces, each independent, none urgent before the analytics core
deploys: gap-marking in stats (Q1) + sync failure alarm, unlinked counter
(Q2), outlier flag (Q3), correction rate (Q4), heard-about-us counter (Q5),
drift sentence (Q6), Data Health card (Q7). Q7 first — it is the frame the
others plug into.

## The working session agenda (30 minutes, her call when)

1. Q7: yes/no to the Data Health card and verdict-language chaining.
2. Q3: outliers — auto-exclude with a note, or flag only?
3. Q5: is the +1 counter acceptable ritual, or does qualitative stay out?
4. Q1: how loud should pipe failure be? (My Day item / notification / both.)
5. Order the pieces, or park the whole spec until 03–06 have run for weeks.
