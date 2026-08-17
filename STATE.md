# STATE - Client Dashboard

Short on purpose. Read it top to bottom before doing anything; it takes two
minutes. The full history is in `STATE-ARCHIVE.md` and nothing has been deleted
from it.

**How to keep this file useful:** the four blocks below are the CURRENT TRUTH and
must be edited in place, never appended to. Session notes go under "Recent
sessions", newest first, and anything older than about a week moves to the
archive. If this file passes 250 lines again, it has stopped working.

---

## 1. What is live right now

The live app is the separate `client-tracker` repo, not this folder. **Check
before you believe anything here:**

```bash
cd "/Users/manmeetkaur/Manmeet Brain" && git fetch client-tracker main && git log client-tracker/main --oneline -3
```

Deploy status as of **2026-08-17**: everything in this folder through the
"nothing is hidden by the lock" work is committed here and deployed.

A hard lesson worth keeping: on 2026-08-16 this file said the previous night's
work was NOT deployed when it WAS. She then tested the live app, saw old
behaviour, and reported things broken that were already fixed. **If you are not
certain of deploy status, run the command above rather than trusting a
sentence.**

---

## 2. The rules she has ruled on (do not re-litigate)

These came from her directly. They are settled. If a piece of code disagrees
with one of them, the code is wrong.

1. **Nothing is gated on intake or on a locked strategy.** Ruled 2026-08-17:
   "We are not keeping it for the clients, and it won't be kept for me as well."
   This rule has now been removed from FIVE separate places over three weeks
   (08-11 x3, 08-16, 08-17). If you find a sixth, remove it and say so. The lock
   still gates GENERATION inside the engine, and nothing else.
2. **Never build a client version of a feature she already has.** Ruled
   2026-08-17: "you don't have to build anything new. You just have to pick the
   features that are already there in my dashboard." A client sees HER screen,
   HER component, HER names, with writing off. A thinner client-special box is
   always the wrong answer, and has been built and deleted three times.
3. **Her switches are the only authority on what a client sees.** Not the lock,
   not the lifecycle short of resting, not a hand-declared door.
4. **Nothing is hard-blocked from clients.** Ruled 2026-08-17. Every feature is
   a plug she can tick on or off, the Engine included. Defaults protect her:
   her workshop starts OFF, everything else starts ON. See spec 36.
5. **Clients see curated content only** (unchanged). Nothing AI-generated goes
   client-facing without her curating it first.

---

## 3. The single next step

**Spec 36 — Plug and Play: the client sees her dashboard.** Written 2026-08-17,
not yet built. It is the inversion that makes rule 4 above real in code.

Everything else waits behind it. Do not start a second thing.

---

## 4. Known open items (hers to call)

- The SMG re-test: Settings, toggles, private window.
- "Posted left" column order.
- Whether References deserves its own window.
- Riti.
- The Instagram restart. The daily pipe is live into the `ig_*` tables; no UI
  reads them yet.
- Two junk Vercel projects to delete: `ct-deploy`, `cli-deploy`.

---

## 5. Recent sessions

## 2026-08-17, night — AND LOG OUT NEVER CLEARED THE COOKIE

The real root cause under the entry below, found after she said the new Log
out button "still not working".

The session cookie is SET with `{ httpOnly, secure, sameSite: 'lax', path }`.
The DELETE cleared it with `{ httpOnly, path, maxAge: 0 }` — **no secure, no
sameSite.** A browser matches a cookie on its attributes, and Safari is the
strictest, so the clear silently missed. The screen flipped to the passcode
gate for a moment, the cookie stayed alive, and the next load signed her
straight back in as the client she had been testing.

That is the whole reason her OWN passcode looked broken: she was never shown a
real gate, and every tab in a browser shares the one cookie.

Verified live by reading the response header, which now carries
`Secure; HttpOnly; SameSite=lax; Max-Age=0; Expires=1970`.

Also: logout reloads the page from zero now. Flipping React to the gate left
the tab holding the previous person's state, a pending autosave and a live
poll, any of which could land after the cookie went.

**THE LESSON, worth more than the fix:** a cookie's clear must come from the
same helper as its set. Test 1f pins that by name. Three separate fixes today
chased this one bug (the client sidebar, the zero-profile screen, then this)
because each time the exit was treated as a UI problem when it was a cookie
problem. **When a logout "does nothing", read the Set-Cookie header before
touching a component.**

---

## 2026-08-17, evening — THE SCREEN THAT LOCKED HER OUT OF HER OWN APP

Her report: "Even my code is not working. My login is also not working."

**A session cookie is per BROWSER, not per tab.** She signed in as a client to
test the view, landed on the zero-profile screen, and from that moment every
tab in that browser was that client — her owner tab included. The app never
showed her the passcode gate, because it already held a valid session, so her
owner code had nothing to type into. That screen carried no Log out, so there
was no way back. The only escapes were a private window or clearing cookies.

It also explains "whenever we make the change, the profile closes": she was
never signed in as herself, so the changes she thought she was making were
never hers to make.

**Read this before diagnosing any future "login is broken" report:**

1. Ask which BROWSER, and whether a client login was ever used in it. A stale
   client cookie beats her passcode every time, silently.
2. A private window is the instant test: no cookie, so the gate appears.
3. "This workspace is closed for now" is NEVER an auth failure. The person is
   already signed in. It means their role has zero profiles.

Fixed: that screen carries Log out. This is the SECOND missing-exit defect
found today, one screen further out than the morning's — the Frame fix covers
a client inside a profile shell, and a client with zero profiles never reaches
it. **When adding a screen a non-owner can land on, the question is not "does
this look right", it is "can they get out".**

Live and verified in the served chunks.

---

## 2026-08-17, later — A CLIENT CAN LOG OUT, AND THE CODE THAT OPENED NOTHING

Both found by her in a real client login on the live app, an hour apart. Live
and verified by fetching the served chunks, not by a status code.

**Log out** existed in three places and none was where a client is: the desk
(hers), the legacy clients list, and the multi-profile picker. A client holding
ONE profile is redirected past that picker straight into their workspace, so
they had no way out at all. It sits at the foot of the client's own sidebar
now. Deletes the session server side, returns them to sign-in. Test-pinned.

**A code that opened nothing.** "Make their code" was enabled by a name alone,
so an invite could be made before a profile was ticked. Signing in with it hit
"This workspace is closed for now" — which reads as a broken app and is really
an unticked box. The button waits for a profile now, and an existing invite
that opens nothing is no longer grey text.

Worth remembering: **that message has exactly two causes** — the invite opens
no profiles, or every profile it opens is paused, closing or archived. It is
never an auth failure; the person is already signed in when they see it.

**Merushri across two profiles needs NO code.** One invite carries a list of
profiles, and the picker renders itself for anyone holding two or more
(`client_access.mini_shelf`, fixed, structural). Tick both on one invite.

---

## 2026-08-17 — THE LOCK GATE'S FIFTH HOME, AND THE FALSE RESTING LINE

Her ruling: the intake/strategy gate is overruled for clients AND for her.
Removed the fifth home of it (lib/tree/render.ts step 4): on any profile
whose strategy was not locked, HER OWN Creation, Analysis, Assets,
References, Logs and Platforms dropped to read-only. That is why her
dashboard kept going quiet on profiles she was mid-way through setting up.
AFTER_LOCK_FAMILIES is gone. strategy_locked survives only for the engine's
own generation gate.

Also fixed: every client on an ACTIVE profile was being told "This profile
is resting, so nothing here moves." A client's board is always read-only, and
read-only and resting shared one sentence. They are separate facts now.

Audit filed the same day: docs/AUDIT-2026-08-17.md. Spec 36 written.

1018 tests. Typecheck clean.

---

## 2026-08-17, small hours — HER CARD, NOT A CLIENT-SPECIAL BOX

1018 tests. Typecheck clean. Her correction, verbatim enough to keep: "you
don't have to build anything new. You just have to pick the features that are
already there in my dashboard... the add post feature... where you can select
the pillar, where you can add the content and everything."

The one-field idea box built yesterday lasted a day, and its mistake is the
lesson: INCLUDE THE EXISTING FEATURE, never build a thinner client version of
it. The client's Idea column now renders HER AddEntry card - pillar, format,
date, link, draft, note - the same component, writing the same ContentCard
through ADD_CONTENT_CARD. No server change: mergeRoleWrite has always merged
a bound client's own contentCards (the same wholesale clientData merge the
legacy client logins use daily), and the new test pins both halves: a bound
client's card lands, a forged write at an unbound profile never does.

ClientIdeaLane deleted (tombstone in ClientWindows.tsx). pendingSuggestions
deleted with it; suggestionTaken stays (Known.tsx "On the board" flag). The
"Add ideas" tick under Creation now governs her card on their column. The
suggestions LANE (spec 22 §7.5) remains for what it already holds; nothing
new writes to it.

NOT DEPLOYED with this entry's writing; deploy is hers per DEPLOY.md.

---

## 2026-08-16, night — THE IDEA LANE MOVES TO THE IDEA COLUMN

1017 tests. Typecheck clean. Her order, seeing the live client board: "there
is no option for them to add an idea (that should also have been there)."

The 08-16 rebuild deleted the Share-an-idea and Suggest-a-topic boxes as
parallel UI in the wrong places. The CAPABILITY was never wrong - only the
address. It is now where an idea belongs:

 - The client's Idea column carries an Add box and their own pending
   suggestions as light dashed cards ("Your idea, with KRNL"). Same lane as
   before: spec 22 §7.5, give:intake, fileSuggestion - a suggestion is an
   intake answer; nothing reaches the board without her. Her "Topics they
   suggested" on the intake front is unchanged and receives these.
 - One match rule, shared: suggestionTaken/pendingSuggestions in
   lib/intake/suggestions.ts decide both her "On the board" flag and when a
   client's suggestion stops rendering separately. Two copies would drift.
 - Board.tsx learned ONE prop (ideaExtra), rendered at the foot of the Idea
   column and the phone's Idea section. It knows nothing about suggestions.
 - DECLARATION CORRECTED: creation.seed_input_client required
   creation.engine, so hiding her Engine Room would have killed the client
   lane invisibly. It requires creation.board + client_access.login now, and
   its default flipped to ACTIVE - every client may bring ideas unless she
   unticks it. "Add ideas" is a part under Creation on What-they-see;
   Approvals-only keeps it off, Everything turns it on. Test-pinned.

NOT DEPLOYED with this entry's writing; deploy is hers per DEPLOY.md.

---

## 2026-08-16, later — THE CLIENT SEES HER DASHBOARD, FILTERED

1014 tests. Typecheck clean. NOT deployed — the deploy is hers to call.

HER VERDICT, seeing the client view live: it had the WRONG SHAPE. The client
sees HER dashboard — the same folders, the same features, the same names —
just cut down to what she ticked. Not a parallel "client experience" with its
own boxes and names. Rejected by name: the "Share an idea" box as the intake
window, the "Approvals"/"Upcoming" digest tabs, the "Suggest a topic" box, and
"Content" as the name for what she calls Creation.

THE CLIENT SHELL NOW — four windows, her folders, her names, her icons:
 - Brand: untouched (the strategy summary, strategy.client_brand).
 - Intake: ONLY the real intake — the round she sent, through ClientForm and
   give:intake. When she has sent nothing: "Nothing to answer right now."
 - Creation (was "Content"): her tab pattern, filtered by her switches —
   Board (the real board, read only; shown when creation.scheduling OR
   creation.review is on), Assets (the upload window, assets.client_upload),
   References (references.from_client). The tabs are the real addresses
   (/creation/board, /creation/assets, /creation/references), so bookmarks
   keep working. Engine and Logs stay a hard 404 for clients.
 - Analysis (was "Results"): content unchanged — the approved publication,
   publishedOnly exactly as it was.

DELETED: the "Share an idea" box (both mounts), the "Suggest a topic" box,
the "Approvals" and "Upcoming" digest tabs (ContentWindow, whole). The
creation.seed_input_client switch stays registered; only its client surface
went. lib/intake/suggestions.ts and her "Topics they suggested" view are
untouched — the client route into it is what she rejected.

MOVED: a client's verdict on a Review piece now lives ON the piece — tapping
a board card opens ClientPiecePanel, and a Review-stage piece carries the
same verdict buttons, note and perception line the Approvals tab had. The
WRITES ARE UNCHANGED: the same review_record through give:review, the same
optional perception through give:perception, gated by creation.review.

THE TABLES: WINDOWS in lib/access.ts and WINDOW_CHOICES in windowChoice.ts
reshaped to Brand / Intake / Creation / Analysis; `assets` stopped being a
window and became a part of Creation beside Board, Approvals and References.
The GRANT LOGIC IS UNTOUCHED: same switches, same doors, same lifecycle,
windowsForBinding still the only authority, no new doors, the four
give-points exactly as declared. Presets learned `partsOn` so Onboarding can
open Creation on the Assets tab alone (board off) — every part written
explicitly, nothing implied. The Settings screen keeps the toggle→switch
wiring built earlier today (moveFor / readPosition / the derived login) and
just wears the new rows.

REFERENCES, the note: the client References tab rides
`references.from_client` — the registered client-audience references switch
(give:assets door, S19-clean). A dedicated "see her references" switch does
NOT exist and was NOT invented; the from-client lane is the closest registered
truth, and whether References deserves its own switch (or its own window, per
the 2026-08-12 "decided but not done" note) stays hers to decide.

TESTS: shell tests 10 and 10c and the windowChoice suite rewritten to the new
shape with the date and her verdict quoted; the toggle round-trip suite (all
windows, presets, derived login, payload) passes against the new table; one
new test pins part-way presets. 1013 → 1014.


---

## Older

Everything before 2026-08-16 evening is in `STATE-ARCHIVE.md`, complete and
in order. Nothing was deleted.
