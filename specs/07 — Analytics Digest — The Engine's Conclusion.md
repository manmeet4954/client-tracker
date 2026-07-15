# Spec 07 — The Digest: The Engine's Conclusion

Status: agreed in principle (2026-07-13: "the engine concludes, I decide"). Builds last.
Build size: small-medium once 03–06 exist. Mostly prompt + delivery design.
Depends on: Specs 03, 04, 05; richer with 06. Needs weeks of accumulated data to say anything.

---

## What it is

Manmeet's words: the engine gives a proper update — "this is happening, this is where you are" — so she builds decisions and strategy without doing the raw interpretation herself. This is the evolved Part C of the old roadmap.

## How it works

- **Monthly digest per client:** what outperformed, which pillar is earning (by its job), which combinations are winning, what the funnel says, one concrete suggestion. Short, plain words.
- **Weekly pulse for Manmeet only:** a few lines across all clients — anything that moved, anything early-signal, anything slipping.
- **The trust rule:** every number in the digest is computed by code; AI only words and explains. It can never invent a metric.
- **The honesty rule:** below the data threshold it says "not enough data yet" instead of guessing. Suggestions cite their evidence (show-its-work, same as the scorecard).
- **The curation rule (dashboard rule 1):** the owner digest displays automatically. Any digest a CLIENT sees is drafted by the engine and approved/edited by Manmeet before it appears in their view. Nothing AI-worded goes client-facing without her.

## Full circle

Digest suggestions connect back to the record layer: "double down on X" can offer one-tap creation of content cards seeded by the winning combination (new cards land in Idea stage, in the right pillar, linked to the topic). The loop: record → express → measure → conclude → new cards → record. This is the bridge to the future Decide layer (strategy engine), which gets its own spec after the parameters conversation.

## Decisions (Manmeet, 2026-07-13)

- **Monthly digest per client, delivered right after the month ends** — the collected month, concluded. LOCKED.
- **Mid-month visibility:** she must be able to check the running state anytime — the Analytics tab itself is the always-live view, and the weekly owner pulse covers "anything moving." No waiting for month-end to see where things stand.
- Digest suggestions speak the client's goals language (Links / Conversations / Followers, from Spec 04).

## Files touched

Server cron (weekly/monthly), Claude API call with computed-stats input, digest storage, display sections in the Analytics tab, approval flow for client-visible digests.
