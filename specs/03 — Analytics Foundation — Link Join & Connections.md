# Spec 03 — Analytics Foundation: The Link Join & Connections

Status: design locked (2026-07-13). First analytics build.
Build size: medium. Mostly server-side.
Depends on: nothing (the pipe is already live). Everything analytics depends on THIS.

---

## What it is

Two joins that make all analytics possible, with zero new data entry:

1. **Account join:** each `ig_account` links to its dashboard client.
2. **Post join (the connection spot):** when Manmeet pastes a live post link into a card's existing `postUrl` field, the system matches it to the fetched Instagram post. From that moment the post's daily numbers attach to the card — and the card's pillar, topic, type, and idea ride along. No double entry, ever. Her paste IS the trigger.

## How it works

- **Matching:** extract the shortcode from `postUrl` (`instagram.com/p/{code}` or `/reel/{code}`), match against `ig_posts` permalinks. Run on card save and nightly (covers "link pasted before the pipe fetched the post").
- **Where the join lives:** server-side, next to the `ig_*` tables (pipeline data — the documented exception to the one-blob rule). The card keeps only its `postUrl`, which it already has. No analytics data enters the AppState blob.
- **Unmatched posts:** IG posts with no card (history, or unlinked) remain visible to analytics as "unplanned posts" — the reading layer (Spec 06) can suggest pillar/topic tags for them later.

## Connections (decision locked: ALL accounts she controls)

- Tester invites from the existing Meta developer app for: Divine Studio, KRNL, personal, ResumeGuru (already live 2026-07-11), and any client account whose login Manmeet holds. ~2 minutes each, paperwork not code.
- Sync route (`app/api/ig-sync/route.ts`) extends from single-token to per-account tokens stored server-side (Supabase, service-role only, never in the browser). Token auto-refresh per account.
- Every unconnected week is history lost forever (no backfill of daily curves) — so this ships before any analytics screen.

## Files touched

`app/api/ig-sync/route.ts`, new Supabase columns/tables (`ig_accounts.client_id`, `ig_post_links`), a small owner-only UI to link accounts to clients (one dropdown per connected account), card-save hook for shortcode matching.

## Pending decisions (Manmeet)

None — locked 2026-07-13. The tester-invite round is her paperwork task (Claude guides); the code can build now.

## Deploy note

Lives in the deploy repo (`client-tracker`) too — carry over same session per CLAUDE.md gotcha 1. Ships only on Manmeet's explicit go (rule 6).
