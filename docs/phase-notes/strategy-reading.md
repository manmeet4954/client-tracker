# Spec 34 §6, §7, §8 — Channels, Gates, Brand kit

The three reading sections of the Strategy room. Built against spec 34 §1: the
corner was rendering the data model instead of the work.

## What is here

| File | What it is |
|---|---|
| `lib/strategy/reading.ts` | All the pure logic. Reading only, no React, no writes. |
| `tests/strategy.reading.test.ts` | 30 tests over that file. |
| `components/strategy/Channels.tsx` | §6 |
| `components/strategy/Gates.tsx` | §7 |
| `components/strategy/BrandKit.tsx` | §8, layout only |

Nothing outside those five files was touched.

## Channels (§6)

Her complaint was that the screen never said what a channel is for. The first
line now does, and it is the answer to her question: this is where this brand
posts, and where the numbers come from; connecting an account is what makes
Analysis work at all.

Each channel shows the account, its state, and what connecting gets her.

**Two judgement calls worth knowing about.**

1. **Instagram is the only platform this app can collect from.** That is a fact
   about the code (`app/api/ig-sync` is the whole collection layer), and the
   screen now says it rather than implying every platform has a connect button
   that would do nothing. `COLLECTABLE_PLATFORMS` in `reading.ts` is the single
   place that list lives. Add a collector, add the platform there.
2. **A LinkedIn channel does not read "Not connected".** It reads "By hand",
   because there is nothing there to connect and calling it a missing connection
   invents a fault out of a fact. The summary counts connected against the
   channels that CAN be connected, not against all of them, for the same reason.

Not connected gets exactly one line about what stays unavailable, no red and no
warning icon. On a platform we cannot collect from that line is dropped
entirely, because the line above it already said the whole truth.

The connect box posts to `/api/ig-accounts` and ties the account to this profile
in the same two calls the old panel used. There is no second connect flow, and I
did not write one.

Rows come from two places: the channel records at `work-log/creation/channels`,
plus one row per platform she decided on that has no record yet. A platform
decided and never set up is exactly the thing she needs to see here, and it is
invisible if the screen only lists stored records.

`decidedPlatforms` reads the platforms decision as an array OR as prose, because
Decide is being rebuilt around a pick list in the same spec and I do not know
which shape lands first. Both work today.

## Gates (§7)

Shows the sentences. `readGates` pulls the brand gates out of the written set
exactly as `buildGateSet` assembled it, and the two operational ones out of
`OPERATIONAL_GATES`. Nothing derives a second version of anything.

The two fixed ones say why they never vary, which §7 asks for and which "fixed"
alone does not deliver.

Where no set exists the screen says what will produce one, naming whichever of
voice and positioning is still undecided, and offers the write action only when
both are there. The five text boxes are still the writing path, unchanged:
`buildGateSet` / `gateSetViolations` / `writeGateSet`, version N+1 on a change,
version N left exactly as it is.

## Brand kit (§8)

Layout only, as instructed. Same `data.brandKit`, same `UPDATE_BRAND_KIT`, same
`/api/upload` for logo files. Not one field added, renamed or dropped. A colour
saved here is byte for byte the colour the old screen saved.

Two changes beyond styling, both because a phone has no hover: the edit and
delete controls are visible at narrow widths instead of hover-only, and a font's
role moved from a pill beside the name into the meta line, because on a 392
screen that pill is what was truncating the name.

`components/BrandView.tsx` is untouched and still serves `/client/[id]/brand`
with the brand overview content (tagline, goals, audience, strategy, services).
My component covers colours, type and logos only, which is what the design
handoff calls Brand kit. **If the integrator points the Strategy tab at my
component, that overview content is no longer reachable from the Strategy room.**
It stays reachable at its own route. Flag it if that is not what is wanted.

## Wiring the integrator must do

None of these three components is mounted anywhere yet. `StrategyPanel.tsx` is
not mine, so I did not edit it.

In `components/shell/StrategyPanel.tsx`, `StrategyBody`:

```tsx
import Channels from '@/components/strategy/Channels';
import Gates from '@/components/strategy/Gates';
import BrandKit from '@/components/strategy/BrandKit';

case 'gates':    return <Gates profileId={profileId} />;
case 'channels': return <Channels profileId={profileId} />;
case 'brand':    return <BrandKit profileId={profileId} />;
```

That replaces `GateSetView`, `components/shell/Channels.tsx` (`ChannelsPanel`)
and `BrandView` in the corner. All three props are `profileId`, not `clientId`.

After that:

- `components/shell/Channels.tsx` has no caller left. Delete it or leave it; it
  is not mine to remove.
- `components/GateSetView.tsx` is still imported by
  `app/client/[id]/strategy/page.tsx` (the legacy route), so it cannot simply be
  deleted.
- `tests/run.ts` needs one line, `import './strategy.reading.test.ts';`, in the
  spec 34 group. I do not own that file. Until it is added my tests only run when
  invoked directly.

## Checks

- `./node_modules/.bin/tsc --noEmit` clean.
- `tests/strategy.reading.test.ts`: 30 of 30 pass, run without React.
- `npm test`: 766 of 766 still pass.
- Looked at all three in a browser at 1240 and at 392, filled and empty, plus the
  Gates writer. Screens I did NOT see running: a genuinely connected Instagram
  account (there is no database or token in this worktree, so `connected: true`
  is proven by tests only), and a logo file actually uploading.

## Things I would raise rather than change

- `switchesNeedingPosition` / the tracking switch for a platform is not read by
  Channels at all. A channel that is connected while `analysis.tracking.instagram`
  sits at hidden will still read "Connected", and Analysis will still be empty.
  If that combination is real, Channels should say so, and it needs the switch
  config passed in. Say the word and it is a small addition to `buildChannelRows`.
- The connect box hides once everything connectable is connected. That is "off
  means absent" applied honestly, but it also means there is no way to connect a
  second Instagram account to one profile from this screen.
