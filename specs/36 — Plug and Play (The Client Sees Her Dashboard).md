# 36 — Plug and Play: the client sees her dashboard

**Written:** 2026-08-17
**Status:** written, not built
**Ordered by:** Manmeet, directly, on 2026-08-17

---

## 1. Her words

> "I'm not sure why it is rebuilding the whole thing when we have the dashboard
> set up. We just need to improve the plugins' plug-and-play feature correctly
> to make these visible to the clients and usable for them. I just have to tell
> you what things I don't want them to have."

And, the day before, correcting the third rebuild of the same box:

> "You don't have to build anything new. You just have to pick the features that
> are already there in my dashboard."

---

## 2. The concept in one paragraph

Her dashboard is already built. There is no client product to build. **Every
feature she has is a plug.** A client login opens her real screens, her real
components, her real names, with writing turned off where it should be. A tick
in Settings decides whether a plug is in or out. She names what to hide; she
never asks for something to be built client-visible, because everything already
is.

---

## 3. Why this is not how it works today

Two lines of policy, in two files, both saying the same thing in opposite
directions:

**`lib/tree/render.ts`, step 5 — what a client's screen may draw:**

```ts
if (dec.audience === 'owner') return 'hidden';   // veto, in any switch position
...
if (needed.length === 0) return 'hidden';        // "no door, no sight"
```

**`lib/tree/validate.ts:122` — what a client's browser may receive:**

```ts
export function clientMayRead(path: string): boolean {
  const dec = findDeclaration(path);
  if (!dec) return false;
  return dec.audience !== 'owner' && !!dec.client_door;
}
```

The numbers that matter:

| | count |
|---|---|
| switches marked `audience: 'owner'` | **68** |
| switches marked `client` or `both` | 28 |
| declarations carrying a `client_door` | **29** |

So 68 of her 96 features are invisible to a client **no matter what she ticks**,
and a path with no hand-declared door is invisible even if its switch is on.
Making one feature client-visible today means editing `switches.ts`,
`features.ts`, `declarations.ts` and usually `access.ts` and `windowChoice.ts`
as well. That is a build, every time. **That is the entire reason her toggles
feel fake and every request turns into a rebuild.**

---

## 4. The ruling

Asked on 2026-08-17 which parts must be permanently off-limits to a client, she
answered: **nothing is hard-blocked.** Every feature becomes a toggle, the
Engine included.

Asked what a client should get in Analysis, she answered: **her real tabs, each
its own toggle, except Verdicts, which stays hers.**

Reconciled, since "nothing is hard-blocked" and "Verdicts stays mine" must both
hold: **every switch is togglable; the DEFAULT is what protects her.**

- Her workshop defaults **OFF**: `creation.engine` and everything under it
  (drafting, gates, costume, briefs, taste rules), `logs.*`, the effort and
  money meters, `analysis.verdicts`, her private per-profile notes.
- Everything else defaults **ON**.
- No position is forbidden. She can tick the Engine on for a client if she
  ever wants to, and untick anything else.

Rule 1 of `CLAUDE.md` is untouched and constrains the defaults above: nothing
AI-generated reaches a client without her curating it, which is precisely why
the drafting family starts off.

---

## 5. What gets built

### 5.1 One helper, asked by both sides

The read resolver and the payload filter must never disagree. Today they are
two hand-kept copies of the same policy, which is how the client sidebar came
to show tabs whose data the server had already stripped.

Add ONE function, and make both call it:

```ts
// lib/tree/clientVisibility.ts
export function clientPosition(switchId: string, config: SwitchConfig): PathState
```

- Her explicit position in `config` wins, always. This is what makes a toggle
  real.
- With no explicit position, fall back to the default for that switch's family
  (§4 above).
- `audience: 'owner'` no longer vetoes. It becomes the marker that sets the
  default to off, and nothing more.
- A missing `client_door` no longer means invisible. Doors keep governing
  WRITES, where they are the real security boundary, and stop governing sight.

### 5.2 `renderState` step 5, rewritten

Delete the `audience === 'owner'` veto and the `needed.length === 0` veto.
Ask `clientPosition` instead. Keep the door check for writes and keep the
resting lifecycles.

### 5.3 `clientMayRead`, rewritten

Takes the config. Returns what `clientPosition` says. An unaddressed path still
returns false: that guard is about the tree being complete, not about clients.

### 5.4 The window and tab tables

`WINDOWS` in `lib/access.ts` and `WINDOW_CHOICES` in `windowChoice.ts` stop
being hand-maintained lists of four. They are **generated from her own nav**
(`lib/shell/nav.ts`), so a tab she has is a tab a client can be given. Adding a
screen to her dashboard makes it available to clients automatically, forever.

Analysis gains its eight real tabs this way: Now, Slices, Scorecard, Funnel,
Compare, Goals, Verdicts (default off), Health.

### 5.5 The Settings screen

Her What-they-see panel lists every plug, grouped by folder, with a tick each
and the default marked. No feature is missing from the list, because the list
is generated from the same nav.

---

## 6. What must NOT change

These are the real boundaries and none of them is what she was complaining
about. Do not touch them while doing the above.

1. `allowedClientIds` — a client reaches their own profiles and no others. This
   is the actual security boundary. Untouched.
2. `mergeRoleWrite` — a restricted role's write may only land on its own
   profiles. Untouched.
3. The four give-points and their doors. Writing stays exactly as declared.
4. `CLAUDE.md` rule 1: nothing AI-generated reaches a client uncurated.
5. The resting lifecycles: paused, closing and archived still drop everything
   client-facing to read-only.

---

## 7. Separate defect found on 2026-08-17, fix inside this spec

A client login currently receives **all 30 legacy `ClientData` slices** for
their profile. Only `body` is filtered. So `brand.strategy` (her private
strategy notes), `coldCalls`, `orders`, `leadAnswers`, `momentum` and `goals`
are all sitting in the JSON a client's browser downloads. Nothing draws them,
so nothing has been seen, and a code comment in `ClientWindows.tsx` claims
`brand.strategy` is deliberately excluded — which is true of what is drawn and
false of what is sent.

`filterStateForRole` must filter the legacy slices the same way it filters the
body, through the same `clientPosition` helper.

---

## 8. Acceptance

1. She unticks Engine for a client; the Engine tab disappears from their shell
   AND its paths leave their payload. She ticks it back; it returns. No code
   change either way.
2. She ticks Scorecard for a client. They see her real Scorecard, read-only.
   Verdicts stays off until she ticks it.
3. No component named `Client*` renders a feature that exists elsewhere. The
   client's Board, Assets, References and Analysis tabs are HER components with
   `readOnly`.
4. A client's payload contains no path whose plug is off, checked in a browser
   network tab, not by reading code.
5. `brand.strategy` is absent from a client's payload.
6. Every acceptance check above is verified by LOOKING at the running app.
   Green tests are not acceptance for this spec.

---

## 9. Cost and risk

Real work: the two resolvers, the two tables, the Settings panel, the legacy
slice filter, and the tests that pin the old vetoes. Roughly a full build
session, not a quick fix.

The risk worth naming: inverting a default from hidden to visible means a
mistake exposes something rather than hiding it. That is why §4 gives her
workshop an off default and why §8.4 and §8.5 are checked in a browser against
the real payload rather than asserted in a test file.
