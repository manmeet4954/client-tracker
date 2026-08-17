# 36 — Plug and Play: the client sees her dashboard

**Written:** 2026-08-17
**Rewritten:** 2026-08-17, same day, after she rejected the first version's concept
**Status:** written, not built
**Ordered by:** Manmeet, directly

---

## 1. The concept. Read this section twice before writing any code.

### A PLUG IS A WHOLE FEATURE.

Not a capability. Not a permission. Not a row in a switch table. **A whole,
working feature, exactly as it works for her.**

Plug in the Board and a client gets **the board**: drag a card between stages,
add a card in any column, tap a card and edit it. Everything a board does.

There is one decision per plug and it is binary. **In, or out.** She does not
decide whether the board can drag. A board drags. That is what a board is.

### Her correction, which this rewrite exists to encode

> "On the client side, things work in a board. One feature is that it should
> work like a board. There is absolute dumbness in not being able to do that. I
> think you are at fault for not being able to understand the plug-and-play
> feature."

And the day before, on the same mistake in a different place:

> "You don't have to build anything new. You just have to pick the features
> that are already there in my dashboard."

### The anti-pattern this replaces, named so it is recognisable

**Dissection.** Taking one feature apart, shipping a fraction of it, and
waiting to be asked for the rest.

The worked example, from the day this spec was written. A client was given the
Board with:

- dragging off
- editing off
- adding allowed in one column only
- and a line saying "Read only"

Four separate asks from her to assemble one feature she already owned. Each fix
addressed the exact thing she had just named and stopped there. That is the
failure. **The unit of work was a capability when it should have been a
feature.**

### The test to apply before shipping anything client-facing

Name the feature. List everything it does on HER screen. A client with that
plug in gets **all of it**. If the list you shipped is shorter than the list she
has, you have dissected a feature and the work is wrong — no matter how many
tests pass.

### The only legitimate exception

A capability may be withheld from a plug **only** when it is named explicitly
in §5 below, with the reason written down and her word on it. Not as a default,
not as caution, not because it seemed safer. Silence means the client gets it.

---

## 2. The plugs

The plug list is **her own navigation** (`lib/shell/nav.ts`). Not a separate
table that someone maintains by hand, because a hand-maintained list is how the
client shell fell four features behind hers.

**Strategy:** The brand · Brand book · Profile mockup · Channels · Lock ·
Lifecycle · Intake history
**Intake:** Intake
**Creation:** Engine · Board · Assets · References · Logs
**Analysis:** Now · Slices · Scorecard · Funnel · Compare · Goals · Verdicts ·
Health

Twenty-one plugs. Each whole. A feature she adds later becomes a plug the day
she adds it, with no further work.

---

## 3. Why the code cannot do this today

Two lines of policy, in two files, each vetoing what the other allows.

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

| | count |
|---|---|
| switches marked `audience: 'owner'` | **68** |
| switches marked `client` or `both` | 28 |
| declarations carrying a `client_door` | **29** |

68 of 96 features are invisible to a client whatever she ticks, and a path with
no hand-declared door is invisible even when its switch is on. Making one
feature client-visible today means editing four or five files. **That is why
every request of hers became a build, and why her toggles felt fake.**

### And the second, worse problem: the switches are already dissected

One board is governed by FOUR switches: `creation.board`,
`creation.scheduling`, `creation.review`, `creation.seed_input_client`. So even
after the vetoes are removed, the client shell would still be assembling a
board out of parts, and still shipping fractions of one.

**Collapsing that is the heart of this spec, not a detail of it.**

---

## 4. The ruling on defaults

Asked what must be permanently off-limits: **nothing is hard-blocked.** Every
plug is togglable, the Engine included.

So the defaults carry the protection, and no default is ever a reason to ship
half a feature:

- **Off by default:** Engine, Logs, Verdicts, Lock, Lifecycle, Intake history.
  Her workshop and her private decisions.
- **On by default:** everything else.
- **No position is forbidden.** She can put the Engine in for a client if she
  wants to, and take anything else out.

`CLAUDE.md` rule 1 stands and is why the drafting family starts out: nothing
AI-generated reaches a client without her curating it. That constrains the
DEFAULT. It never justifies shipping a plug with pieces missing.

---

## 5. The named exceptions

The complete list of capabilities withheld from a plug that is otherwise in.
Anything not on this list is included. **Adding to this list requires her word.**

| Plug | Withheld | Why |
|---|---|---|
| Board | Delete a card | Removal is hers; a client moves and edits, never destroys. |
| Board | The gates, seed and caption-drift readings in the card panel | Craft machinery, spec 24 §13.1. The client's panel shows the piece, not how it was made. |
| Analysis (all tabs) | Anything unpublished | Spec 27 §14, unchanged: nothing on an analysis path travels until she has approved it. |

Three rows. If a fourth is proposed, it is a conversation with her, not a
judgement call in a build session.

---

## 6. What gets built

### 6.1 One plug, one switch, one answer

Collapse the per-capability switches into **one plug switch per feature** for
the client-facing question. Internally the existing switches stay — they are
her own controls and her spec set depends on them — but the client's answer to
"is the Board in?" is ONE value, and everything the board does rides on it.

```ts
// lib/tree/plugs.ts
export function plugState(plugId: string, config: SwitchConfig): PathState
```

No caller may ask a sub-question. There is no client-facing
`creation.board.canDrag`. A board drags.

### 6.2 Both sides ask the same function

The read resolver and the payload filter must never disagree; today they are
two hand-kept copies of one policy, which is how the client shell came to show
tabs whose data the server had already stripped.

- `renderState` step 5: delete the `audience === 'owner'` veto and the
  `needed.length === 0` veto. Ask `plugState`.
- `clientMayRead`: takes the config, returns what `plugState` says. An
  unaddressed path still returns false — that guard is about the tree being
  complete, not about clients.
- Doors keep governing **writes**, where they are the real boundary. They stop
  governing sight.

### 6.3 The window and tab tables are generated

`WINDOWS` in `lib/access.ts` and `WINDOW_CHOICES` in `windowChoice.ts` stop
being hand-maintained lists and are derived from `lib/shell/nav.ts`. A screen
she adds becomes available to clients automatically, forever.

### 6.4 The Settings screen

One row per plug, grouped by folder, default marked, nothing missing — because
the list is generated from the same nav. She reads it as "what they get", not
as a permissions matrix.

### 6.5 The client's screens mount HER components

Every one. `Board`, `EditPiece`, `AssetsView`, `ReferencesScreen`, the Analysis
tabs. A component whose name begins with `Client` may exist only to arrange her
components, never to reimplement one.

---

## 7. What must NOT change

Real boundaries, none of which is what she was complaining about:

1. `allowedClientIds` — a client reaches their own profiles and no others. The
   actual security boundary. Untouched.
2. `mergeRoleWrite` — a restricted role's write lands only on its own profiles.
3. The four give-points and their doors. Writing stays as declared.
4. `CLAUDE.md` rule 1: nothing AI-generated reaches a client uncurated.
5. Resting lifecycles: paused, closing and archived still drop everything
   client-facing to read-only. **This is the one place "read only" is honest.**

---

## 8. The separate defect this spec also closes

A client login receives **all 30 legacy `ClientData` slices** for their profile.
Only `body` is filtered. So `brand.strategy` (her private notes), `coldCalls`,
`orders`, `leadAnswers`, `momentum` and `goals` sit in the JSON their browser
downloads. Nothing draws them, so nothing has been seen, and a comment in
`ClientWindows.tsx` claims `brand.strategy` is excluded — true of what is drawn,
false of what is sent.

`filterStateForRole` must filter the legacy slices through the same
`plugState`.

---

## 9. Acceptance

Every check is performed by **using the running app as a client**. Green tests
are not acceptance for this spec — the suite reads source files as text and
cannot see a screen.

1. **The board is a board.** With Board in, a client drags a card between every
   stage, adds in every column, and edits title, pillar, format, date, link and
   note. Nothing on §5's list is missing.
2. **The same test, for every other plug.** Assets uploads. References opens.
   Intake answers. Each Analysis tab shows what hers shows. For each one: her
   screen and their screen do the same things.
3. **Out means gone.** Take a plug out: the tab disappears AND its paths leave
   the payload, checked in a browser network tab. Put it back: it returns. No
   code change either way.
4. **The Engine round-trips.** She puts it in for a test client and it appears;
   she takes it out and it goes. Nothing is hard-blocked.
5. `brand.strategy` is absent from a client's payload.
6. **No `Client*` component reimplements a feature that exists elsewhere.**
7. **The dissection check.** For each plug: list what it does on her screen,
   list what it does on theirs, diff the two. The only differences permitted are
   §5's three rows.

---

## 10. Cost and risk

A full build session: the two resolvers, the plug collapse, the generated
tables, the Settings screen, the legacy slice filter, and the tests that pin
the old vetoes.

The risk worth naming: inverting a default from hidden to visible means a
mistake exposes rather than hides. That is why §4 gives her workshop an off
default, and why §9.3 and §9.5 are checked against the real payload in a
browser rather than asserted in a test file.

---

## 11. For whoever builds this

The mistake this spec exists to prevent has been made four times in three days,
by sessions that each believed they were following instructions. It does not
feel like a mistake while you are making it. It feels like being careful.

If you find yourself about to ship a feature with a piece missing, and the
reason is caution rather than §5, **you are making it right now.** Ship the
whole feature or ask her.
