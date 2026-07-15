# Spec 06 — The Reading Layer: AI Tagging

Status: role agreed; the exact reading-parameters list is the ONE open item (Manmeet to define with Claude).
Build size: medium. Server-side pipeline.
Depends on: Spec 03 (joined posts). Feeds Spec 05's Comparison layer and Spec 07's digest.

---

## What it is

Interpretation over collection: the system reads each post's actual content — carousel slides and captions directly, reel audio transcribed to script — and tags it. This is what turns "reel #14 got 12k views" into "the reel that opened with a customer story beat the four tip-style reels."

## Role demotion (important design change from the old roadmap)

The old plan had AI guessing each post's pillar with a correction dropdown. Superseded: for LINKED posts, pillar/topic/type come from Manmeet's own card via the link join — more trustworthy than any AI guess. The reading layer now:

1. Tags the dimensions the card does NOT record: hook type, topic type, execution traits.
2. Acts as fallback ONLY for unlinked/historical posts: suggests pillar and topic grouping, owner confirms via dropdown (human-in-the-loop).

## What gets tagged (LOCKED by Manmeet, 2026-07-13)

Reels are transcribed; carousels are read slide by slide. For BOTH, the reading captures the structure: what the topic was, what was said (script/copy), **how it started (the hook), how it ended (the close), and the CTA**.

- **Topic type** — how-to, story, myth-busting, fear-based, listicle, proof/win, trend... (powers combination verdicts)
- **Hook type** — question, bold claim, story open, statistic, pain point...
- **Ending / close type** — how it wraps: CTA close, punchline, summary, open loop...
- **Execution traits** — reel length; carousel slide count; caption style; CTA present + type
- **Trending audio** — trending vs original sound (reels)
- **Visual style** — with face vs without face (carousels and reels); what's working visually
- Format comes from the card; pillar comes from the card (linked posts). Card data informs the reading — the AI reads WITH the card's context, never against it.

The CTA-type tag also powers the **CTA alignment check** (Spec 05): content asks vs the client's declared flow archetype (Spec 04); mismatches get flagged as strategy drift.

## Pending decisions (Manmeet)

None — tag list LOCKED 2026-07-13 (her additions: ending/close type, trending audio, face vs no-face visual style). Later additions apply forward only; re-tagging history is a deliberate re-run.

## Trust rules

- Tags stored once server-side (e.g. `ig_post_tags`), cheap, re-runnable.
- Owner can correct any tag; corrections are sticky (never overwritten by re-runs).
- Tags inform analysis; they never invent metrics. Numbers remain code-computed only.

## Files touched

New server route/job (post-sync step in `ig-sync` or separate cron), transcription step for reels, Claude API tagging call, `ig_post_tags` table, small owner-only correction UI inside the Comparison layer.
