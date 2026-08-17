# STATE - Client Dashboard

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


## 2026-08-16, evening — DEPLOYED: THE TOGGLES RULE, AND THE ROGUE ROLLBACK FOUND

Live and verified in a real browser: the /login gate renders on the public
address, and the deployed JS carries the new code (checked inside the served
chunks, not by status codes). Head 29e847c, 1013 tests. origin/main and
client-tracker/main both hold it; the repos are reconciled again.

WHAT SHIPPED: the 2026-08-12 defect, all three coats (see the two entries
below): the dead lock rule's fourth home in render.ts, Brand's own movable
switch, the fixed-switch write guard, login derived from the live binding,
and toggles that read position-or-default.

FOUND DURING THE DEPLOY, worth remembering:
 - On 2026-08-15 ~22:00, six production deploys put an OLD dashboard build
   live (pre-/login). They coincided with the crochet-catalog session. That
   rollback, not only the toggle defect, is why her link-and-code tests
   failed so completely on 08-16.
 - Vercel builds were coming from the STALE client-tracker GitHub repo, which
   had not been pushed since the hook died on 08-10. CLI uploads from this
   machine repeatedly produced old builds; pushing the graft to
   client-tracker/main (DEPLOY.md step 4) is what actually shipped. The
   GitHub hook appears to be ALIVE again - a push now builds.
 - Two junk Vercel projects exist from accidental unlinked CLI runs:
   ct-deploy (08-16) and cli-deploy (08-15). Safe to delete in the Vercel
   dashboard.
 - Verification lesson, again: Next embeds the not-found text in every page,
   so grepping HTML for it proves nothing. Verify a deploy by fetching the
   served chunks and grepping for a string only the new code contains, or by
   rendering in a real browser.

STILL HERS: the SMG re-test (Settings -> toggles -> private window),
"posted left" column order, the dedicated References window, Riti, the
Instagram restart.

---


## 2026-08-16 — THE TOGGLES RULE: THE DEAD RULE'S FOURTH HOME, AND THE BRAND TOGGLE THAT WROTE A FORBIDDEN POSITION

1013 tests, up from 1005. Typecheck clean. NOT deployed — the deploy is hers
to call, per rule 6.

THE 2026-08-12 OPEN DEFECT IS RESOLVED BY THIS ENTRY. Her Settings toggles
(the five client windows) now decide what a client actually sees, and the
whole wire is test-pinned. Two causes, both real:

 1. THE FOURTH HOME OF THE DEAD RULE. `lib/tree/render.ts` step 4 still held
    `if (role === 'client') return 'hidden'` for every after-lock family
    (creation, analysis, assets, references, logs, platforms) on an unlocked
    profile. Her order of 2026-08-11 — "get rid of this rule that they can't
    use or see anything without a set strategy for clients" — killed three
    homes of that rule the same day; this one survived behind a comment
    restating the rule as its own justification. Since no real client profile
    has ever locked, the client answer for creation.review, creation.scheduling,
    assets.client_upload and analysis.digest_client was `hidden` whatever the
    switches said — which is exactly why her SMG test showed Brand + Intake
    only with Content and Assets ON. Removed: for a client the lock plays NO
    part in visibility. Her side keeps the quiet waiting shell (history before
    the lock) exactly as before. `windowsForBinding`'s owner-side check
    (Results' publication flow) now asks the resolver with the lock set aside,
    the desk's established pattern, or Results stayed silently vetoed on every
    unlocked profile.

 2. THE BRAND TOGGLE WROTE A FORBIDDEN POSITION. "Their brand" hung on
    `strategy.fixed` — FIXED, allowed_states ['active'], and a prerequisite of
    half the switchboard (creation.board included). The toggle wrote
    `strategy.fixed = hidden`, a position the registry forbids, and the cascade
    would have obeyed it FOR HER TOO: one tick of Brand-off and her own board
    goes dark. No validator ran on that write. Now: a new, genuinely movable
    switch `strategy.client_brand` (audience client, active/hidden, suggested
    default ACTIVE so nothing visible changed today) carries the window in
    BOTH tables (`WINDOWS` in lib/access.ts, `WINDOW_CHOICES` in
    lib/access/windowChoice.ts), reaching through see:strategy — a new switch,
    never a new door. And `setSwitchPosition` now REFUSES any fixed switch at
    the one write door, so this class of bug cannot regrow. The other six
    window switches audited CLEAN: intake.questionnaire, intake.finding_session,
    creation.review, creation.scheduling, assets.client_upload,
    analysis.digest_client, analysis.client_publication — none fixed, all hold
    both positions.

PINNED (tests/access.windows.test.ts, new suite): for a guest binding on an
UNLOCKED cut-over profile, each of the five windows follows its toggle through
moveFor → setSwitchPosition → windowsForBinding, on and off; every preset
round-trips the same wire; Brand-off changes nothing the owner renders; a
fixed switch throws at the write door; no window switch is fixed. Shell test
14b rewritten with the reason and the date, like acceptance test 12 before it.

SPEC-DRIFT NOTE for whoever reads specs 21–28 later: spec 22 §8.7's "creation
and analysis cannot open before strategy locks" and spec 28's resolver step 4
now govern OWNER and STAFF rendering only. For a client the lock gates
nothing, by her 2026-08-11 order. The switches on Settings remain the single
authority on client visibility, bounded only by paused/closing/archived. And
the Brand window's switch is `strategy.client_brand`, not `strategy.fixed`,
anywhere a spec names it.

TWO MORE, FOUND AND FIXED THE SAME DAY — the first draft of this entry listed
them as "deliberately not changed", and both were the same defect wearing a
different coat, so they went the same way:

 3. A BINDING IS THE LOGIN (derived, never stored). `client_access.login` was
    declared derived from the start ("profile lifecycle + working-mode") and
    NOTHING in the app has ever written it — the raw switchboard that could
    have was cut from the rail on 2026-08-11. So on every real profile it sat
    at its hidden default and vetoed assets.client_upload and
    analysis.digest_client however she set her toggles: her exact complaint,
    one layer down. Now `withDerivedLogin` (lib/strategy/derivation.ts) is the
    one copy of the rule, applied at BOTH resolution sites: `renderProfile`
    (lib/shell/profile.ts — covers windowsForBinding, windowsForRole and the
    Settings preview through their shared path) overlays it when the role
    holds a live non-staff binding to the profile, and `applySwitchStates`
    (lib/access.ts) overlays it for any client-kind payload, which only ever
    runs for a bound login. Derived it cannot drift: guest bindings are
    rebuilt from live invites, so a revoke takes the login with it, and SMG's
    existing binding needs no backfill. Owner and staff answers unchanged; the
    deep link still demands her explicit, non-suggested position before it
    redirects (spec 21 §9.6 stands). Also correctly reaches
    creation.review_deeplink, client_access.mini_shelf,
    creation.seed_input_client and intake.reminders — a bound client factually
    has a login.

 4. THE TOGGLE READS HER CHOICE, DEFAULTS INCLUDED. `windowsOn` read explicit
    positions only, so on a never-touched profile a default-active window
    (Brand, Intake, Content, Assets) rendered for the client while its toggle
    read OFF — the read-back half of "Settings say one thing, the client sees
    another". `readPosition` (lib/access/windowChoice.ts) is the one copy:
    position-or-suggested-default per switch, used by windowsOn and the parts
    row in ClientAccess. The requires-cascade is deliberately NOT folded in:
    with the login derived, cascade truth for a bound client matches
    position-or-default across all five windows, and an unbound profile's
    screen already says "nobody has a login yet" in words. Pinned: a
    never-touched profile's toggles read exactly what a bound client is
    granted, window by window; and the test fixture no longer pre-sets the
    login switch, because the real app never does.

DELIBERATELY UNTOUCHED, so nobody "fixes" them in passing: the client's
strategy payload still serves locked versions only (lockedOnly, spec 22 §10),
and Results content still serves approved publications only (spec 27 §14).
Those are content rules, not visibility rules, and they are hers.

---


## 2026-08-12, small hours — THE LEDGER, AND ONE OPEN DEFECT (RESOLVED 2026-08-16, see the entry above)

Live head `fa74839`. 1005 tests. Everything committed is deployed; live build
verified identical to the repo.

THE ONE OPEN DEFECT, not solved, top of the next session:
The client sidebar does not reflect her window toggles. Her private-window
test as SMG's client shows Brand + Intake only, while her Settings show
Content and Assets ON. Suspects, in order:
 1. The client's window list is fetched at sign-in (GET /api/state computes
    windowsForRole once); toggles changed after their login may not appear
    until a full reload or re-login. Her test window predates several deploys.
 2. "Their brand" maps to strategy.fixed, which is a FIXED switch; the toggle
    writes a position the resolver may ignore, so Brand may show regardless of
    the toggle and the toggle may read OFF regardless of reality.
 3. SMG's toggle writes may not have persisted; needs checking against the
    stored body's toolset entries.
Diagnose against live data BEFORE changing code: ask what windowsForRole
returns for a guest bound to SMG, then work backwards.

DONE AND LIVE TONIGHT despite the mess: /login (the door the invite flow
shipped without); the invites-stripped-on-save bug (normalizeState, one line,
test-pinned, with the client-never-receives-codes pin beside it); the client's
Brand window shows the strategy AS IT STANDS; a client's Intake is Share-an-
idea (the 53-question bank can never be served to a client again); a client's
Content is the REAL board read-only plus Approvals and References; the phone
board can Add; Table view removed as Board's second name.

DECIDED BUT NOT DONE: "posted left" (ambiguous, awaiting her word on column
order); a dedicated References window in the client nav (References currently
rides inside the client's Content tabs); Riti's access and the Instagram
restart remain hers.

---


## 2026-08-11, last entry — WHAT A CLIENT CAN REACH, VERIFIED, AND TOPIC SUGGESTIONS

Live head `ad5b8b5`. 1004 tests.

Her boundary list for clients was mostly already structural, and this time it
was VERIFIED in code before answering, not assured: the chat renders null for
any role but owner; the client creation route 404s Engine, Logs and References
and maps board/assets to the two client windows; client intake is the form
only; Results is an off-by-default toggle showing only approved publications.

Built new: topic suggestions. Client side, a box on their Content window;
her side, "Topics they suggested" on the intake front, one tap to an Idea
card, "On the board" once taken. It rides the client-ideas lane spec 22 §7.5
declared, through give:intake - no new door, test-pinned.

Also this stretch: previews attach FROM the orphans strip (piece picker in
place of directions to one); board columns flex to fill the screen; piece
panel gained Edit details; "From her" off the asset tiles; Content window
split into Approvals/Upcoming parts with per-part switches the client window
actually obeys; Settings got a back link; the Creation header collapsed from
six bars to two; Rejected stage; parked Approved/Scheduled columns.

THE DAY IN ONE LINE for the next session: she used the dashboard for real all
day, on real clients (Riti, SMG), and nearly everything she hit was either a
rule that had outlived its repeal, a control that existed but was invisible,
or directions-to-a-control where the control should have been.

---


## 2026-08-11, late — THE BOARD RESHAPED, AND THE LAST STRATEGY GATE ON CLIENTS REMOVED

Live head `9faa5f4`. 999 tests. Two deploys, both verified Ready.

THE BOARD, from her first real session on it:
 - REJECTED is a seventh stage ("if something gets rejected in the review, it
   gets rejected"), drawn only when occupied, one-tap Reject on Review cards.
   In the tree a rejection stays a review VERDICT; a rejected board card
   migrates as back-in-build.
 - Approved and Scheduled are parked: hidden while empty, drawn the moment
   they hold a piece. Data never disappears behind a preference (test-pinned).
 - Pillars are a responsive grid now, not 206px columns floating in the width.
 - The sidebar collapse got a VISIBLE button. It existed all day on the profile
   chip and she asked for the feature while it existed: an invisible control
   is not a control.
 - The Client profile and fact boxes read at full height with a pencil to
   edit; a filled box is a thing to READ.
 - Goals take her own entries; the closed three-goal union widened to string.
 - The client profile takes PDF/doc attachments, filed as ordinary intake
   documents tagged client-profile, so they also appear under Files.

THE GATE, her order verbatim: "get rid of this rule that they can't use or see
anything without a set strategy for clients." Removed in all three places it
lived: setup's one-door policy (spec 22 acceptance test 12, rewritten), the
renderState setup branch, and the Brand window's needsLockedStrategy. Paused,
closing and archived still close every door - that half of lifecycle is what
makes pausing real, and the rewritten tests pin it. A guard test pins that no
window can quietly regrow a lock precondition.

SPEC-DRIFT NOTE for whoever reads specs 21-28 later: acceptance test 12 and
§11.1's setup-narrows-doors rule are DEAD BY HER ORDER, as is the lock's grip
on anything client-facing. The switches on Settings are the single authority
on client visibility, bounded only by resting lifecycles.

---


## 2026-08-11, night — ONE FORM, THE STRATEGY FRONT, DELEGATED COPY, AND THE CLIENT-VIEW PREVIEW

Live head `ea1dc56`. 999 tests. Four deploys this evening, each verified Ready.

INTAKE, third rework, on her sharpest note yet: "Questionnaire" and "Build a
form" were two tabs that both asked questions. ONE form now; the eight brand
questions are prefills inside it, each carrying its fact id so answers land
under the brand boxes. The FRONT of intake is the strategy taking shape: a
Client profile box (recorded, never generated - her explicit rule: "I only
want things to get recorded correctly and in proper place rather than making
up something"), the eight boxes filling as answers arrive, and now PDF/doc
attachments filed as ordinary intake documents tagged client-profile. She can
record answers herself in Responses (owner-recorded), so calls and WhatsApp
replies are not second-class.

SETTINGS gained "If they logged in right now": clientView() asks
windowsForBinding against a temporary binding - the preview IS the real rules,
and closed windows carry the reason. This is the answer to "I have to properly
share access and see what they are able to see".

TWO DELEGATED COPY PASSES, both reviewed line-by-line before commit (both were
pure string swaps, 74/74 and 180/180, honesty rules intact):
 - Client-facing surfaces: Sign in / access code, the form (Answer later,
   Review your answers, Submit), verdict labels (Approve, Request a revision,
   Decline...), public preview errors.
 - Analysis: Coverage / Comparison / Verdicts register; "Sync stalled" for
   "The pipe stopped"; every third-person "her" out of client-visible strings.

GOALS are hers to invent: the closed three-goal union widened to string, the
three stay as suggestions, anything she types is a chip of equal standing.

WORTH KNOWING NEXT SESSION: she is now actually USING it (Riti's profile is
filled in). The delegated-agent pattern worked: strict brief (copy only, tests
updated not deleted, honesty rules named), then line-by-line diff review in
the main session before commit. Both agents were clean on first review.

---


## 2026-08-11 — MARGINS, A COLLAPSIBLE RAIL, RENAMING, AND THE ADD-A-POST CARD

Live head `a4c7a03`. 997 tests.

MARGINS, corrected. Removing the width cap earlier in the day, I cut the padding
with it, and the board ended up clipped against both edges. Full width means no
CAP, not no MARGIN. That distinction is now written in Screen.tsx so it is not
made again.

THE RAIL COLLAPSES, and the profile chip is the control, so one thing does both
jobs. Remembered in localStorage, because a rail that reopens on every
navigation is not collapsible.

RENAMING a profile, from the three dots on the desk. In place, not a dialog: a
typo is a two-second fix. Safe because access binds by profile ID and never by
name (spec 21 §6) - renaming can no longer open or cut off a login.

THE ADD-A-POST CARD, rebuilt the same day it shipped, and this is the entry
worth reading later. That morning I ASKED her what "add" should do and she
picked title, pillar and format. I built exactly that, inline in the column.
Seeing it beside what she used to have, she was right that it was the wrong
shape: a piece is born with a pillar, a topic, a date, a link and usually the
client's draft, and a three-field row cannot hold a pasted carousel script. It
quietly taught her to add a title now and fill the rest later, which is how a
board fills with cards nobody can act on.

THE LESSON: her answer to a narrow question is not a specification. She answered
what I asked; I should have asked what the card had to HOLD. A date now also
decides the month a piece files under, beating the month on the table, because a
piece dated 3 September belongs to September.

---


## 2026-08-11 — THE QUESTIONNAIRE BUILDER

Live head `c30bcdd`. 997 tests.

Her ask: it should work "like how we make it on Google Forms". Three tabs, and
the third is the one that earns its keep, because a form you can build and send
but cannot read the answers to is a mailing list.
 - BUILD: a type per question (Paragraph, Short answer, Choose one, Choose any,
   Yes or no, Number), options for the choice types, reorder, remove.
 - PREVIEW: drawn from the STORED questions once a form is out, never from the
   drafts on screen. A preview of something other than what was sent is a lie
   with good intentions.
 - RESPONSES: every question with its answer, and every UNANSWERED question
   shown rather than hidden.

SMALLER THAN IT LOOKS, and this is the useful part for whoever reads next:
ClientForm could ALREADY draw all six shapes, because the 53-parameter bank
used them. What was missing was any way for her to CHOOSE one; `openOwnRound`
hardcoded 'long-text'. Most of what looks missing in this app is a control over
something that already works.

A REAL BUG THE TESTS CAUGHT, already live before today. Archiving a round set
the entry state to 'history' and left the round's own `status` saying 'sent'.
`readRounds` reads data and ignores entry state, so "which round is open?" saw
every round ever sent and took the FIRST. A second questionnaire would have
left her reading the first one while the client answered the second. One shared
`closeOpenRounds` now closes both facts together, for all three senders.

REMOVED THE SAME DAY IT SHIPPED: `YourOwnQuestions`, the one-textarea stopgap.
A second way to ask a question is the duplication she spent the day cutting.

STILL OPEN: Riti and the Instagram collection restart, both of which she has
taken on herself.

---


## 2026-08-11, end of day — THE CUT-DOWN CONTINUED, AND TWO DEAD RULES FOUND

Live head `d143c28`. 985 tests. Live code verified identical to main.

A whole day of her opening screens and finding things. The pattern that emerged
is worth more than the list: MOST OF WHAT ANNOYED HER WAS A RULE THAT HAD
ALREADY BEEN OVERTURNED, still being enforced by code nobody had revisited.

TWO DEAD RULES, both traced to her 2026-08-09 ruling that the lock refuses
nothing and recording always works:

 1. "Strategy not locked" was printed on six of her eight profiles, in the
    shelf, in the sidebar footer, in a board banner and in the Strategy panel
    line. Its justification, written in the code, was that an unlocked profile
    has a READ-ONLY Creation. It had not for two days. Removed everywhere. The
    desk question "Anything not locked?" still answers, and now reads the lock
    directly rather than a shelf line that no longer exists.

 2. A profile in `setup` hid Creation and Analysis FROM HER, on the same dead
    grounds. That is why Subhash Mangat had a sidebar with Intake alone and she
    could not reach its board. Her side is open now; a CLIENT on a setup profile
    still sees intake only, and the test pins both halves.

ALSO CUT: the month chips (added that morning, removed the same day, because
the arrows already moved months and two controls for one job is the clutter she
has been cutting); the max-w cap on every app screen, which fought the sidebar
and left wide empty gutters.

INTAKE became four features behind a segmented control, her structure:
Questionnaire, Custom questions, Meeting notes, Files.

LANGUAGE, and she had to say it twice. The upload form read like a person
narrating a favour: "A file", "Some words", "Call it", "Given for", "Who gave
it: They did / I did", "Keep it". Now: File, Link, Text, Name, Attach to,
Source, Save.

NOT DONE, and she was told plainly rather than left to find out: the
questionnaire is a tab holding a question list, NOT a form builder. She asked
for something that works "like how we make it on Google Forms" - build it,
preview it, open it, see responses laid out. That is the next real piece of
work. Riti still does not exist, though she can now create the login herself.
Instagram collection still stalled since 12 July.

THE RULE THIS DAY EARNED, twice over: when a rule changes, the code enforcing
it does not change with it. A ruling is not applied until every place that
quoted the old rule has been found and removed.

---


## 2026-08-11 — THE STRATEGY 404, AND HOW IT SURVIVED A "FIX"

Live head `d8fa562`. 985 tests.

Deleting the Facts tab broke the Strategy button on every profile. It then
stayed broken through a fix, a deploy, and a message telling her it was fixed.
That is the part worth recording.

WHY IT SURVIVED:
 - THREE lists of panels existed for one room: lib/shell/nav, Room.tsx and
   StrategyPanel.tsx. Two were updated. Room.tsx already carried a comment
   warning that a second list had caused exactly this before, when the Profile
   mockup panel silently did not draw. It happened again because a third copy
   was never found.
 - The Strategy BUTTON reads DEFAULT_STRATEGY_TAB, which was still the string
   'facts'. Fixing the /strategy landing redirect fixed a page she does not use.
 - The panel route called notFound() on anything unrecognised, so a stale link
   died rather than landing.
 - IT WAS VERIFIED WITH CURL. curl returned 200 for a page that 404s in the
   browser a moment later, because the refusal happens client side. The check
   could not have caught the bug it was run to catch.

FIXED AT THE CAUSE:
 - STRATEGY_TABS is DERIVED from ROOM_PANELS. One list.
 - the default is a panel that exists.
 - an unrecognised panel FALLS BACK to the default instead of 404ing, so a
   stale link, bookmark or cached button lands somewhere useful. A renamed
   panel is our problem, not hers. This also means a browser still running the
   old bundle cannot produce a 404 any more.

tests/shell.panels.test.ts pins all of it, and the guard was checked by putting
the bug back: it fails with "the Strategy button opens facts, which is not a
panel". It also pins that every panel in the rail has a renderer, and that
Settings is linked from something clickable, because Settings shipped linked
from nowhere and therefore did not exist from her side.

THE RULE THIS EARNED: a status code is not a verification. For anything that
renders client side, verify the RENDER or verify STRUCTURALLY with a test that
fails when the bug is reintroduced. Never report a fix on the strength of a 200.

ALSO IN THIS PASS: the board's chrome was cut (lock banner is a line, the empty
"Needs you today" card is hidden, the posted reading is a line) and columns went
170px to 440px; the copy was rewritten to agency language (Client
questionnaire, Custom questions, Meeting notes, Client uploads, "Brand profile
6 of 8 complete").

---


## 2026-08-11, later — PEOPLE BECAME DATA, and intake got its two missing routes

Live head `ac43660`, deployed by CLI. Verified after: settings loads, her Divine
link loads, a wrong invite code is refused 401.

THE CEILING THAT CAME DOWN. Her words: "I cannot register everyone's password
every time." She was right, and it was structural. `lib/auth.ts` mapped five
ROLES to five ENVIRONMENT VARIABLES, so a person was a line of code plus a
server setting: every client cost a change and a deploy. That is the real
reason Riti never existed.

Now: Settings -> People. A name, a tick per profile, and the app makes a code.
An invite writes the SAME bindings every other login uses, always kind
'client', so nothing downstream learned a new idea. An invite decides WHO and
WHICH PROFILES; the switches still decide WHAT.

Pinned by tests, because this is the security surface:
 - an invite can never mint 'owner' or any of the five environment roles
   (guest roles are namespaced `guest:<id>`),
 - it reaches only the profiles ticked, and an invite with none reaches nothing,
 - revoking shuts the door in the SAME write that kills the code, because guest
   bindings are rebuilt from live invites only.

Her own passcode deliberately stays in the environment: her login must never
depend on a database read.

ONE CHOICE AGAINST INSTINCT, recorded so nobody "fixes" it later: the code is
shown permanently rather than once. The real failure mode here is not someone
reading it off her screen, it is her client losing it and her having no way to
read it back, which would force a reissue and make her first message a lie.
Take back is one tap and immediate.

THE DECLARATION CONTRACT EARNED ITS KEEP. Adding `invites` to AppState failed
the build twice until it had a feature, an address and a scope. Spec 21 working
exactly as designed, catching a real omission with no human involved.

INTAKE'S TWO MISSING ROUTES, from her question the same day:
 - Her own questionnaire NEVER EXISTED. Intake could send the eight blank facts
   or a round from a 53-parameter bank nobody chose. She writes questions now,
   one per line, and answers come back under the question asked.
 - Meeting notes existed and I DELETED THEM that morning: the route lived only
   on the Rounds screen, and taking Rounds off Intake took it too. Restored,
   and now carrying who said it. A meeting round opens ALREADY curated so it
   never sits there looking like a question waiting on a client.

THE PDF READER. Documents open in place, list left and the file right. No pdf
library: browsers already draw PDFs and the file is a URL on storage the app
serves, so an iframe is the whole implementation. A LINK ending .pdf stays a
link, because Canva and Drive refuse to be framed and a permanently blank box
reads as a broken app.

SPACING, first pass only. Board columns 206 to 240 (268 wide), Strategy rail
212 to 172. She has not reviewed it yet.

STILL OPEN: Riti does not exist (she can now create the login herself, which
was the blocker). Instagram collection still stalled since 12 July, so the new
posted bar shows counts and refuses to show performance. The four legacy
logins stay in server config and are not listed in People.

---


## 2026-08-11, deployed — THE CUT-DOWN. Live on her go.

Live head `daabe45`, deployed by CLI (the GitHub hook has been dead since 08-10).
Both client-facing links verified after: the SMG mockup and the Divine carousel.

Her framing, and the one to keep: "We have built a lot, and a lot of this is
very unnecessary. To make it usable, we now have to cut down things." Every
change below REMOVES something. That is the direction of travel now.

WHAT WENT
- Intake's Rounds and Curation screens, and the 53-question bank as her route in.
- Strategy's Facts tab (the same eight boxes with six fewer of them).
- Decide from the rail; it survives only as the editor a row on The brand opens.
- Gates (it polices machine drafts, and the Engine is parked).
- Switches (91 toggles of plumbing; "What they see" is the half she wanted).
- The fact boxes off Intake entirely. Her first and sharpest complaint.

WHAT ARRIVED
- The brand: one page, five headings, the whole brand read top to bottom.
- Settings as its own group: What they see, Lifecycle, Intake history.
- Brand book takes files AND links (Canva cannot be uploaded, so a link is a
  first-class member, not a lesser case).
- Board: every month holding work is a chip; add an entry with title, pillar
  and format on every column; a posted-so-far bar.
- Engine moved last in Creation.
- USPs and Demographics, declared and outside the lock's list on purpose.

THE STANDING LESSON, earned twice today. Asked to remove duplication, the first
attempt ADDED a fifth copy of the brand questions and called it a draft. She
counted them back: "the same thing again... same thing again." When she says
cut, the deliverable is a shorter list, not a better-organised longer one.

NOT DONE, and owed: the documentation feature (client PDFs opening in a real
reader), the spacing pass, and Riti still does not exist. DB credentials are
unavailable in this session, so no live profile has been touched by hand.

---


## 2026-08-11 — INTAKE REBUILT, AND SHARING BECOMES A CHOICE (branch, not live)

Branch `claude/intake-rework`, preview deployed, NOT in production.

**What she said:** "I am particularly annoyed with the intake section. I just
don't want to keep it there... make it simple instead of 'record this' or 'do
that,' and have a proper UI/UX working: what will proceed where." And: "build a
settings feature in my dashboard where I can select what exactly the client can
view while adding the profile, and what not."

**What intake was.** A process: Rounds and Curation, two screens over one set of
information, under two nouns she never chose, beside a THIRD page (Strategy ->
Facts) holding the same eight boxes. Asking a client one question meant three
screens. The parameter bank behind it asks 53 questions. She never asked for
any of that; PLAN and specs 21 to 35 were largely Claude's model of her business
approved at the end rather than built from her at the start, and this is the
first place that bill came due.

**What it is now.** ONE page: the eight facts, hers to type at any time, and
three EQUAL ways in - she types it, they send a document, or she asks them the
blanks and the link appears in the same breath. No route is required. Nothing
is gated. "Round" and "curation" appear nowhere she can read. Old rounds still
read through Strategy -> Intake history, so nothing recorded is lost.

A real bug fell out of the merge: the client's answer was only ever shown under
three of the eight facts. A client could answer Pillars, Platforms, Cadence,
Goals or Look and she would never see it. All eight show it now.

**What they see.** Five windows, her words, one toggle each, four presets. It
sets the switches she has been setting by hand, per profile, on a screen of
forty. It grants nothing: `windowsForBinding` stays the only authority, and a
test READS lib/access.ts to prove the table matches, so this screen can never
drift into promising access the rules will refuse. It also says the two things
she would otherwise learn from a client: a ticked window that still will not
render says why, and a profile nobody is bound to says so first.

942/942, typecheck clean, build green.

**Not done, and owed:** Riti does not exist anywhere yet, and the DB credentials
are unavailable in this session, so no live profile was touched. Her clients
still need a PASSCODE to answer intake - the link is `/profile/<id>/intake`, not
a public one like `/p/`. That is the next real piece of friction and spec 32 is
where it gets removed.

---


## 2026-08-11 — THE OTHER DEAD LINK: MOCKUP SHARING WAS NEVER BUILT

She copied the share link for the profile mockup she made for Subhash Mangat &
Group, and it opened to "Preview not found". Different bug, same shape of
lesson.

**This one was not the caching bug and had nothing to do with it.** Spec 35 §5
said the mockup shares through the existing `/p/[shareId]` machinery, and
`MockupScreen` shipped a "Copy the link" button that hands out exactly such a
URL - but the page only ever resolved PREVIEWS. Every mockup link ever copied
was dead from the day the feature went live. It stayed invisible because the
only way to find it is to actually send one to a client, which is what she did.

The page now falls through **preview → mockup → not-found**. The mockup render
is the same `Phone` component with every handler left off, so spec 35's
read-only guarantee (acceptance item 7) is structural rather than promised:
on that render no editing affordance exists in any state.

Live and verified: her mockup link serves `@subhashmangatgroup`, her Divine
carousel link still serves `@divinestudio2021`. 923/923, typecheck clean,
build green, deployed by CLI (`vercel deploy --prod`) because Vercel's GitHub
hook stopped firing on 08-10 and has not resumed - **if a push does not appear
live, that is why; deploy from a clean archive of origin/main.**

The standing lesson from both link failures, now twice earned: **verify the
thing she will actually do, not the code path you believe in.** The carousel
bug needed instruments. This one needed one click of her own button.

---


## 2026-08-10 — THE EIGHT-DAY DATA EATER, FOUND AND KILLED

Her Divine preview link died in front of a client, three remakes failed, and
the trail ended somewhere nobody had looked: **Next.js was caching the
database read itself.** supabase-js rides on fetch, Next caches fetch by URL,
and the server client's few long-lived query URLs were served from the data
cache at random. Every symptom since 1 August was this one behavior:

- previews vanishing after saving (a save read a CACHED base and wrote it
  back, erasing everything newer - the log caught the store going 4 → 5 → 3 → 4)
- the two previews "a stale tab erased" on 08-01 (it was never the tab)
- a public preview link that lived and died by coin toss for days
- three wrong diagnoses in a row (lock gate, stale tab, ghost link), each
  plausible, none evidenced. The lesson is written in the code comments:
  instruments before theories.

**The proof** was an invisible fact line on the not-found page: a request that
rendered "Preview not found" carried `inBlob=true` in the same breath. Same
row, same request; the only difference between the query that hit and the one
that missed was the fetch URL.

**Fixed, deployed, and measured: 70 of 70 loads of her client link succeed.**

Three layers shipped, all staying:
1. `noStoreFetch` pinned on EVERY server-side Supabase client (9 files). The
   database is the cache.
2. Every write door (all 9) is now compare-and-swap via `mutateState`: a write
   lands only if the row still carries the version its base was read from.
   Lost updates are structurally impossible even if some future layer goes
   stale again.
3. Previews mirror into a small dedicated row on every save; the public /p/
   page reads the mirror first and self-heals it on a blob hit.

Also that day, her rulings: the lock refuses nothing anymore (recording always
works), and the desk chat imports Canva links instead of refusing them.

---


## 2026-08-09, end of day — BOTH DEPLOYS LIVE, ON HER PUSH

Live head `dfbf3cb`, Vercel SUCCESS, live matches vault exactly. Three deploys,
both pushed by her hand after gates 1 and 2 passed here:

1. `bc7c118` — one chat everywhere that acts, recording open on every profile,
   the Strategy Facts page, lifecycle and Canva tools on the chat.
2. `7023757` — month strip on the board (an empty month names where the work
   is), previews reminder folded to one line. Her feedback on the first deploy,
   fixed same day.
3. `dfbf3cb` — intake asks the blanks: on Facts, every blank fact is a chip,
   "Make the round" writes a sent round asking exactly those in the page's own
   wording (`lib/intake/factsRound.ts`), and answers come back under the box
   they were asked for with a one-tap "Use this". 923 tests.

The data migration (all nine profiles carrying a body) was applied directly to
the live database earlier today, verified by read-back, backup in
`dashboard/.backups/`.

**Owed next, in her order:** retire the old Decide tab (Facts replaces it, she
flagged the duplication) · Documents section on Facts (drop a brief, get
suggestions under blank boxes, one tap to accept, never auto-filled). The
questionnaire from the blanks shipped in deploy 3.

## 2026-08-09, later — RECORDING NEVER WAITS FOR THE LOCK, AND ALL NINE PROFILES MIGRATED

Her decision, plainly: recording what is happening always works; strategy gates
generation only. Shipped on the branch (907 tests green, typecheck clean):

- `refusedCreationWrites` / `refusedLegacyCreationWrites` return empty. The
  functions stay so the decision lives in one commented place.
- `guardPath` no longer asks the lock. Archived, paused and switched-off still
  refuse. Clients see nothing new.
- Lock banner and board copy rewritten: strategy pending, recording still saves.
- All nine profiles now carry a migrated body (applied to the LIVE database
  2026-08-09 with a verified read-back; backup at `dashboard/.backups/`).
  133 cards before and after. Only ResumeGuru is locked; that no longer matters
  for recording.

Direction settled with her (docs/Strategy as a Layer, not a Gate.md and
docs/Access Matrix — Strategy States.md): strategy becomes one page of eight
facts per profile, filled in any order; a questionnaire is generated from the
blank facts only. She rejected ceremony and over-explanation — show screens,
not documents.

## 2026-08-09 — ONE CHAT, TWO SURFACES: THE DESK REACHES THE HARNESS

Branch `claude/ui-work-handoff-review-5361ad`. **902 tests green.** Not deployed,
not typechecked (this worktree has no `node_modules`, no Supabase and no key, so
nothing here could be run end to end). Her go is still needed per DEPLOY.md.

### What she said the problem was

Not the layout. "The desk looks fine." The chat does not behave like a chat: she
asks it to do something and it tells her it has no setting for that. She had
assumed the desk chat and the floating bubble were one thing shown two ways.

Her reason for wanting it, in her words: across four or five accounts, opening
each one to add and update things by hand is the pain, and it never gets done.
She wants to say "I did this today" and have the card made or moved, and to
paste a link and get back a preview link she can send to the client.

### Two causes, both found in the code

1. **They were two different chats.** The floating bubble calls `/api/desk-chat`
   (spec 30, fifteen tools, acts). The desk called `/api/chat-brain` (no tools,
   writes a sentence). The desk was wired to the half built not to act.
2. **The desk keyword-matched everything she typed** through `DESK_INTENTS`
   before anything else ran. The triggers include `today`, `yes`, `go`, `due`
   and `review` as whole words, so "I posted the Career Bubble reel today"
   matched `today`, was answered with the standing today list, and her actual
   instruction was discarded. This is the larger of the two.

### The decision, and it is now the rule

**One brain, two surfaces.** `runDesk` in `lib/shell/desk.ts` calls
`/api/desk-chat`, and `Shelf.tsx` uses it. `askDesk` stays as the fallback only.

**A tapped chip is answered locally; anything TYPED goes to the harness.** The
trigger table is no longer allowed to route free text. Nothing is lost: the
harness answers the same five standing questions through `across_profiles`.

Also settled with her: the chat DOES the thing and then says so. It does not ask
permission first. That is the point of it saving her time.

### What it still cannot do (told to her plainly, not hidden)

- ~~No lifecycle tool anywhere.~~ **BUILT, 2026-08-09.** `setLifecycle` in
  `lib/desk/write.ts`, exposed as the `set_lifecycle` tool. Active, paused,
  closing, archived, both directions. It writes `clients` through the owner
  scope `shelf/profiles`, the same slice the row menu writes, and its tests
  carry the path through `checkScopes` and `applyScopes` rather than trusting
  the return value. A `setup` profile refuses. Six tests, 893 green.
- ~~Canva links are refused by `make_preview`.~~ **BUILT, 2026-08-09.** The loop
  resolves a Canva link to image links before the pure preview code sees it,
  through an injected `importCanva` that runs the same
  `resolveDesignId` / `getValidAccessToken` / `exportDesignPages` path as
  `/api/canva/import`, re-hosting every page so a sent preview cannot expire.
  `runTool` is async now and `maxDuration = 60` is set on the route. A failed or
  empty export refuses whole and writes nothing: never half a carousel to a
  client. Six tests, all with the importer injected so they need no network.
  The background, kept because it is the lesson: Canva Connect is fully built and she uses it every day: paste a
  design link into the preview editor, `/api/canva/import` exports the pages,
  re-hosts them and hands back permanent image URLs. The OAuth app exists and
  the tokens are stored. The chat refuses only because spec 30 never let the
  chat run that import: the refusal she would hit is `CANVA_CONNECT_FIRST`,
  "the Canva app is registered, but this chat cannot run the import itself".
  **Nothing is blocked on her.** The tool can call the same server code the
  editor calls.
- **The tools reach about a third of the app**: pieces, tasks, seeds, notes,
  previews, status. Not intake, strategy, switches, the lock, analysis, assets,
  references or pipelines. Her standard is that it reacts across everything
  built, so this gap is the real backlog.
- **It runs on Haiku** to keep the bill down. `DESK_CHAT_MODEL` raises the tier
  with no deploy, and for the judgement she is asking for it probably should.

### A correction worth keeping

I told her twice that something was owed by her when it was not.

1. The Anthropic key, "still unset in production" — quoted from a code comment
   dated 2026-08-05 as if it were today's truth. She had already set it.
2. The Canva OAuth app, "needs your OAuth app first" — quoted from the handoff's
   "owed by her" list. She had already made it, and the import works daily.

Both came from reading a dated document as live configuration. **The repo's own
notes describe the day they were written, not today.** Check the code path, and
check what she says she is already doing, before telling her she owes anything.
She was right both times and it cost her patience, not mine.

### One chat, two surfaces — done, and pinned

Her ask, in her words: the desk chat and the floating chat should be the same
thing shown two ways. They already shared the THREAD (both dispatch
`ADD_CHAT_MESSAGE` into `chatLog`). They did not share the BRAIN: the bubble had
its own copy of the harness fetch and the desk called the old endpoint.

Now `runDesk` in `lib/shell/desk.ts` is the only thing in the app that names
`/api/desk-chat`, and both surfaces call it. Three tests in `shell.test.ts` scan
the source and hold that: one caller, both surfaces through it, both into the one
thread. The first of those would have FAILED before this change, which is what
makes it worth keeping.

What is still legitimately different is CHROME, not brain: the desk has the five
chips and rows she can walk into, the bubble takes photos and keeps the `#task`
shortcut. Neither changes what the chat can do.

### Next step

Nothing is blocked. Deploy on her go (DEPLOY.md, drift check not optional), then
widen the tools past pieces, tasks, seeds, notes, previews, status and lifecycle
— intake, strategy, analysis, assets, references and pipelines are still
unreachable from the chat, and her standard is that it reaches everything built.

## 2026-08-08 — THE STRATEGY ROOM, INTAKE, AND THE CHAT THAT KEEPS ITS THREAD

Branch `main`. **855 tests green**, typecheck clean, production build green.

**DEPLOYED on her go, three times. Latest: `993c909` (the profile mockup, dark
and light), Vercel SUCCESS. Before it: `9cbcf81` (pause and archive from the
desk). Before it: `eccc216` (the Strategy room, the intake form,
documents, the kept thread), Vercel SUCCESS 2026-08-08 11:33.** All three DEPLOY.md gates passed, including the drift check
showing nothing live the vault did not already have. Previous head was
`f585b3c`, if it ever needs backing out; no stored data changed in this deploy.

She deployed it to REVIEW it, on the understanding she will come back with
changes. That is now the loop (see the decision below), not a one-off.

### A DECISION THAT CHANGES WHAT THIS IS (hers, 2026-08-08)

**The idea of rebuilding the whole dashboard inside KRNL OS is scrapped, for
now.** Her words: this dashboard is the main thing she will be using to manage
her clients, she is not waiting for it, and it has to be perfect.

Three consequences, and they are not small:

1. **This is the product, not a stopgap.** Every earlier decision that leaned on
   "the real one comes later" is void. Nothing gets left rough because a rebuild
   was coming.
2. **Her daily use is the standard.** She reviews screens on the live app and
   comes back with changes. That loop is now the main way this gets better, so
   deploying often and honestly matters more than batching.
3. **KRNL OS is not cancelled as a project** - she said "for now", and
   `studio/krnl-os/` and `krnl-os/` are untouched. What is off is the plan to
   move this dashboard into it.

### Her three verdicts from the live app, and what each became

1. **"This whole strategy thing needs to be restructured."** One diagnosis
   behind all of it: the Strategy corner rendered the DATA MODEL instead of the
   work. "0 of 7 sources ready" is a count of curated intake records. The Lock
   screen printed fourteen identical sentences. The Switches screen showed
   `intake.questionnaire` and a line apologising that a suggestion was only a
   suggestion. And all fourteen parameters got the SAME form: two free text
   boxes with a required reason, so Platforms, a multiple-choice question, was
   built as an essay.
   Spec 34 fixes it: full screen on her yes, and each parameter gets the input
   its answer actually is. Verified on screen: Platforms picks from nine
   platforms and ticks formats; Goals picks a goal, a number and how it is
   measured, with the S16 rule stated where she can read it; Lock now says what
   locking DOES before asking, then lists only what is missing; Switches shows
   plain names grouped by question, with 78 defaults folded away.
   **Her test, adopted as a standing rule: if the screen needs a paragraph
   explaining itself, the screen is wrong.**
2. **"There is no option to skip, go backward, pause, or go next."** Correct,
   and the client's form was the worst screen in the build: every question in
   one flat list with a send button each. Spec 33 rebuilt it as a form. Also
   recorded as a standing rule (spec 33 §5): any screen that walks a person
   through more than three of something must answer where am I, how do I go on,
   how do I go back, and how do I leave without losing anything.
3. **"If I refresh the chat the past conversation does not exist."** True, and
   not a save bug. The desk kept its thread in component state and nothing else,
   so nothing was ever saved. That is also why there was no past-chats feature
   to find. The thread now lives in `chatLog`, shared with the floating bubble:
   one conversation, two places. Rows are stored as they were said rather than
   recomputed, so an answer cannot quietly change under her.

### What that crossed, deliberately

Moving the desk's thread into `chatLog` breaks the line SHE drew on 2026-07-25
(PLAN §11 Q1: the chat is HELD, the shell may not touch it). She reversed it on
2026-08-08 by asking for the fix, so the test that pinned it was rewritten with
the reason and the date rather than worked around. It still forbids a second
chat widget and any shell module calling the brain behind the desk's back.

### Named, not hidden

- **PDFs do not read yet.** A PDF stores, opens and lists, and says its text was
  not read. It needs one dependency (`unpdf`), which is her call under rule 5.
- **Scans, photos of documents and links behind a login can never be read.**
  They say so. They still reach the model by title and note, so nothing answers
  as though it had read them.
- **No real file upload has been watched.** No database on this machine.
- **A true unlock does not exist.** `unlockStrategy` would need to not collide
  with versions already stamped on pieces. The screen offers what the product
  actually supports and states its cost.
- **The chat thread is still capped at 100.** It survives a refresh; it is not
  an archive. A real Chats surface is a separate build and hers to ask for.

### Specs written today

**31 (pausing a profile) is built and LIVE.** Setting a lifecycle already
worked, buried in the Strategy corner, and changed nothing on screen. Pause and
Archive are now on the profile row, and resting profiles leave the list for a
folded "Resting (n)" row. Nothing is deleted.

**35 (the profile mockup) is built and LIVE.** An editable Instagram profile she
shows a client during onboarding: username, name, bio, link, avatar, five
highlight covers and a six-tile 4:5 grid with up to three pins, in dark or
light. Copy one for a before-and-after; share it read-only by link. Furniture
(the counts, the followed-by line, the buttons, the story ring) has no setters.
Its screen was built by hand after the agent building it stalled with 790 lines
uncommitted.

**32 (resources) is WRITTEN AND NOT BUILT.** 33 (intake) and 34 (the Strategy
room) are built and live.

### How she wants this reported, from here (her 2026-08-08 frustration)

She lost track of what had changed across two hours of batched work, and said
so. Two changes to how this is run, and they are not optional:

1. **One thing at a time, deployed, then reported in about three lines.** Not
   "here are six things I did".
2. **This file carries the plain running list**, so "what changed?" is always
   answerable from the repo rather than from anyone's memory of a chat.

---

## 2026-08-05 — PHASES 2 TO 6 ARE BUILT AND **DEPLOYED**, INCLUDING THE DESK CHAT

**LIVE on her go.** Deploy commit `f585b3c` on `client-tracker/main`, Vercel
build SUCCESS. All three DEPLOY.md gates passed: green build of the exact
shipping tree with dummy keys; drift check clean, with NOTHING live that the
vault did not have, so nothing was erased; and her explicit go.

**Two things are true the moment she opens it:**

1. **Seven boards are read-only.** Only ResumeGuru is locked, and the lock now
   really gates writes (phase 3). Every other profile reads fine and shows
   everything, but a card cannot be added or dragged until that profile is
   walked through migrate then strategy then lock. This was flagged to her three
   times before the deploy and she chose the timing. One profile at a time is
   the sane order.
2. **The desk chat is dormant until `ANTHROPIC_API_KEY` is set in Vercel.** The
   route answers `fallback` without it and the widget uses the hashtag rules it
   has always had, so the chat behaves exactly as it did yesterday. Setting the
   key turns the whole tool loop on. That key was already owed for the nightly
   tagger and the digest.

**If it needs undoing:** the previous head was `9784cce`. No stored data changed
in this deploy, so a revert is a code revert only.

Branch `claude/restructure-phase-2`. **689 tests green**, typecheck clean, production build green.
The demo seed was removed before the deploy.

### The desk chat is built (spec 30)

Her answer on 2026-08-05 settled the handoff's open question: the chat ACTS and
FINDS. A tool loop, not a form with a text box.

- `lib/desk/read.ts` + `status.ts` — find a profile (ambiguity asks, never
  guesses), the per-brand status answer, pieces, tasks, seeds, and the desk's
  existing cross-profile questions REUSED rather than rewritten.
- `lib/desk/write.ts` + `preview.ts` — add and update a task, add a piece, move
  it including "I posted this today", schedule it, file a seed capture, add a
  note, and make a preview attached to its piece with the shareable link back.
- `lib/desk/loop.ts` — the tool registry and dispatcher. The list IS the surface:
  no free-form escape hatch, no path parameter to bend.
- `app/api/desk-chat/route.ts` — the loop, owner only, ceilinged at 12 tool calls
  and 6 writes per message, saving once at the end through the same sequence
  `app/api/state` uses. The chat gets no privilege: an unlocked profile refuses a
  chat write exactly as it refuses a drag.

**Both of her laws are structural, not prompt text.** Every write resolves to a
declared address, so the chat cannot invent a field (her finance-tracker
complaint). Every number is computed before the model sees it, so it never
counts, totals or estimates (her "the calculative thing is something that
matters").

**The bug this caught, and it would have shipped silently:** `stageCounts` read
`entry.data.stage` off the birth record, and `work-log/creation` is append-only,
so a move is an amendment beside it. Dragging a card also rewrote the legacy
card, which hid it. The chat moves pieces through the tree, so every
"8 posted, 4 left" would have started answering from birth records and going
stale. `stageCounts` now resolves. The test that recorded the gap asserts the fix.

**Model:** Haiku, the same one the existing chat uses, so this adds no spend
against a ceiling she has not set. `DESK_CHAT_MODEL` moves it without a deploy.

**No key, no desk:** the route answers `fallback` and the widget drops through to
its hashtag rules. `ANTHROPIC_API_KEY` is still unset in production, so without
this the chat would have gone from working to apologising on the day it shipped.

**Not built, on purpose:** topic and seed GENERATION stays with the Content
Engine family. The chat's part is getting her narration into the bank correctly.

---

## 2026-08-05 — PHASES 2, 3, 4 AND 5 (earlier the same day)

The screens. 593 tests at the time, walked in a browser at 1240 and at 375.

### First, what was nearly lost

The phase 2 agents from the night of 08-04 worked until 00:03 and **never
committed**. Their ~1,600 lines sat loose in the working tree, unregistered and
unwired, exactly like the 26 wiki pages that went missing on 08-03. The vault
moved off iCloud at 23:23, mid-flight, which is almost certainly what killed the
session that was running them. It is all in git now, twice: a snapshot at
`rescue/phase-2-wip-2026-08-05` and as the first commit of this branch.

**The standing lesson, again: work that is not committed does not exist.**
Agents are now told to commit as they go, not once at the end.

### What is now true

1. **Six stages, not five.** Review is a stage of a piece. The five existing
   stage ids are unchanged - `writing` is labelled Build, `ready` is Approved -
   so no card on any board had to be migrated. `review` is the one new id.
2. **A preview belongs to its piece.** `PreviewPost.cardId` closes the last
   place in the product where the same post existed twice. Previews made before
   it are listed as unattached rather than deleted, and get attached by hand.
3. **The lock actually gates now (phase 3).** The guard existed and was
   imported; it was never called. So an unlocked profile showed a banner saying
   "nothing can be written here" while every card, every drag and every preview
   went through the door. Six legacy slices are covered, and a test asserts the
   list is the whole of what the address map files under `work-log/creation`.
4. **Creation is the design.** Board with four views and six columns, the needs
   strip, the piece panel over the screen, Logs with its five tabs absorbing
   Lists, Cold calls, Orders, agenda and Observations, Assets with the catalogue
   as a mode, References in two groups.
5. **Analysis is three groups (phase 4)**, coverage first, an uncollected metric
   drawn as an em dash and never a 0, a gap drawn as a hatch and never a
   zero-length bar.
6. **Intake is Rounds and Curation (phase 5)**, and a raw answer has no edit
   control at all.

### Phase 6 is HALF BUILT, and this is the honest state of it

The desk agent was killed by a server error mid-response. It had written
`components/shell/DeskChat.tsx` and `lib/shell/deskAnswers.ts` and committed
nothing; both were rescued and are in the branch, **unverified**. The desk you
see is still phase 1's `Shelf.tsx`, which already reads as the design: ink
sidebar, profile rows with their hues, the opening answer, the prompt chips,
the composer. `deskAnswers.ts` is wired in far enough to compile and pass, so
nothing is broken - the new chat body is simply not mounted yet.

**Her open question still gates the rest of it:** can the desk chat ACT (move a
piece, send a preview, add a seed) or only FIND? The agent was told to build
find only. The floating chat's existing ability to act was not touched.

### Verified, and how

- 593/593 via `npm test`, up from 401. Six new suites, one per screen.
- Typecheck clean. Production build green.
- In a browser at 1240 and 375: the desk, a profile shell, Creation → Board
  (six columns on desktop, stacked stage sections on the phone, bottom bar of
  exactly three), Creation → Logs (five tabs, one strip, not two), Analysis
  (three groups, one title, no eight-tab row), Intake. No console errors.

### Known and honest, not defects

- **Nothing was seen with real data.** There is no `.env.local` on this machine,
  so every screen above was checked against empty profiles. Cards, seeds,
  previews and metrics have never been rendered by these screens.
- **"Slides" is a temporary second surface.** `PreviewsView` survives as a
  section under Board because the upload, reorder and Canva editor still live
  inside it; deleting it would take away the only way to put pictures on a
  preview. It is called Slides, not Review, so it does not read as a second
  place to approve things. It goes when that editor moves into the piece panel.
- **The analysis empty state repeats itself** three times on a profile with no
  body. Right words, said too often.
- **Sent and opened does not exist in the data model**, so the piece panel says
  so rather than drawing a state it does not have.
- The analysis route is still `[tab]`, not `[group]`, on purpose: every link
  that exists keeps working and an old address resolves to its group.

### THE ONE CONSEQUENCE SHE HAS TO TIME

Only ResumeGuru is locked. When this deploys, **the other seven profiles' boards
become read-only** until each is walked through migrate → strategy → lock. That
is what the design asks for (rule 9, "the lock gates") and it is the right
behaviour, but it lands on her daily work. Hers to time, and worth doing one
profile at a time.

### Next

1. Her look at the screens, and the desk chat decision (act, or only find).
2. Finish phase 6 against that answer.
3. Move the slide editor into the piece panel, then delete Previews.
4. Then deploy, on her go, per DEPLOY.md.

Still owed by her, unchanged: the setup day and the IG collection stall (still
losing a day of data per day since 2026-07-12), the intake vocabulary pass, the
engine spend ceiling, staff and Sonia audiences, and walking the other seven
profiles through migrate → strategy → lock.

Per-screen build notes, including every gap each agent named, are in
`dashboard/docs/phase-notes/`. The design handoff now lives in the repo at
`dashboard/docs/design-handoff/` rather than only in her Downloads folder.

---

## 2026-08-04 — THE RESTRUCTURE, PHASE 1 (THE SHELL) IS BUILT, NOT DEPLOYED

The redesign handoff she commissioned (`design_handoff_dashboard_restructure/`:
a README design spec, her own `UI Structure.md`, and four HTML prototypes)
is being built in six phases. **Phase 1, the shell, is done.** Tests green,
production build green, both viewports checked in a browser. Nothing deployed.

### Her three decisions, 2026-08-04

1. **The cutover gate is DROPPED.** `isCutOver` now returns true for every
   profile. All eight enter the new shell today, with the screens that already
   exist mounted inside. This is what kills the double navigation, and it is
   phase 1's whole point. The alternative, walking seven profiles through
   migrate → strategy → lock first, was days of her decisions before anything
   looked different.
2. **The chat we already built becomes the desk chat.** The desk IS a
   conversation now. `components/ChatWidget.tsx` and `app/api/chat-brain/route.ts`
   were NOT touched — a new `components/ChatMount.tsx` stands the floating
   widget down on `/shelf` and the desk calls the same `/api/chat-brain`.
   Making the chat cleverer is phase 6; phase 1 gave it the right body.
3. **Ink chrome, the profile hue as identity only.** Rails, tabs, buttons and
   headers are ink everywhere. A profile's colour now paints exactly two
   things: its avatar square and the dot beside its name. Eight profiles used
   to mean eight coloured chromes, which was most of why the app read as noise.

### What changed underneath, and why it is not just paint

- **`renderState` step 4 changed.** Before the lock, Creation, Analysis,
  Assets, References and Logs used to resolve `hidden`. With the gate dropped
  that would have put seven profiles into an empty shell. They now resolve
  `history` — visible, read-only — for her and for staff, and stay `hidden`
  for a client. **Writes are untouched:** `refusedCreationWrites` still refuses
  every write under `work-log/creation/` until the lock, server side. The lock
  gates what can be written, not which shell she is looking at.
- **The desk was lying and now is not.** `attentionFor` only said "Strategy not
  locked" for a MIGRATED profile, because an unmigrated one used to be outside
  this shell entirely. The desk was therefore answering "every profile is
  locked, Creation is open everywhere" while Creation was read-only on all of
  them. It now reads the lock itself, migrated or not.
- **Local dev runs without a database.** `createClient(undefined, undefined)`
  threw at MODULE LOAD, so every route answered 500 and no screen could be
  drawn on a machine with no env file. `lib/supabase.ts` and
  `lib/supabaseServer.ts` now fall back, reads return empty and writes go
  nowhere. CLAUDE.md already claimed this worked; now it does. Vercel is
  unaffected — the variables are always set there.

### Files

New: `components/ChatMount.tsx` · `components/shell/Screen.tsx` (the level-3
furniture: display title, segmented control, lock banner) ·
`components/shell/StrategyPanel.tsx` · `lib/shell/desk.ts` (the desk's answers,
composed only from `shelf.ts`'s existing counters).

Changed: `tailwind.config.js` and `app/globals.css` (the design tokens, both
fonts) · `components/shell/Shelf.tsx` (the desk) · `components/shell/Frame.tsx`
(the profile frame) · `lib/shell/profile.ts` (`isCutOver`, new `hueFor`) ·
`lib/shell/shelf.ts` · `lib/shell/nav.ts` (a Lock panel) · `lib/tree/render.ts` ·
the three level-3 pages · `app/layout.tsx` (one line: `ChatMount`) ·
`lib/supabase.ts` · `lib/supabaseServer.ts` · `tests/shell.test.ts`.

**No new route.** The route map in `lib/shell/routes.ts` is untouched and its
completeness test still passes.

### Verified, and how

398/398 via `npm test`. Production build green (with dummy env, as always on
this machine). In a browser at 1240 and at 392: the desk with its sidebar,
drawer, thread, chips and composer; the chat answering from real data; the
profile shell with the ink rail, the three apps, the read-only footer line and
the lock banner; the Strategy corner sliding over the screen without leaving
it; the phone bottom bar holding exactly three items.

### Known and deliberate, not defects

- **The screens inside the shell still look like the old screens.** That is
  phase 1 as she specified it: route what exists into the new structure, even
  where it looks wrong inside. The board still shows five stages, and Review is
  still a section rather than a state of a piece. Phase 2 fixes both.
- **The legacy board is still writable on an unlocked profile,** because it
  writes `contentCards` and not tree paths. Making the lock gate that too is
  phase 3.
- **The intern's and Sonia's logins still open the legacy workspace**
  (`staysOnLegacy`). Spec 28 §19's open question is hers and untouched. It is
  the only legacy door left.
- **Strategy has an eighth panel, Lifecycle.** The design lists seven because
  the prototype had no lifecycle control. The real app has one and it is her
  only way to pause or archive a profile, so it stayed. Say if it should go.

### The phases still to come

2. **Creation.** The board's four views, the piece panel with review as a
   STATE, Logs absorbing Lists, Cold calls, Orders, agenda and Observations.
   The only phase with data changes in it: five stages become six, and a
   preview gets linked to its piece so review stops being a second copy.
3. **The lock**, gating writes for real, including the legacy board.
4. **Analysis**, eight tabs collapsed to three groups, coverage first.
5. **Intake**, rounds and curation appearing and disappearing on open questions.
6. **The desk chat**, after she answers whether it can act or only find.

---

## 2026-08-01 — WHERE THINGS STAND (read this first)

**Live and working:** the whole spec 21–28 batch is built, tested (398 green) and
deployed. ResumeGuru is migrated, its strategy is LOCKED (version 1), and it is
the first profile rendering in the new shell (`/shelf` → profile → three apps).
The other seven profiles still open the legacy tab bar, by design, until each is
migrated and locked.

**The open thread — the UI, not the system.** Her verdict 2026-08-01: the
dashboard feels heavy and chaotic, and the new shell "still looks the same".
The diagnosis, accepted: spec 28 built the shell as PLUMBING (routes, nav logic,
permission rules) and mounted the OLD view components inside it. No screen was
ever redesigned. Two navigation systems are live at once, and the desk is eight
equal cards that answer "what exists" instead of "what needs me".

**The division of labour, restated from PLAN §2:** the structure is hers and is
sound; the LOOK was delegated to Claude on 2026-07-25 and never delivered. She
should not be asked to specify the interface. Claude designs screens, shows them
as pictures, she reacts.

**Three documents were produced for the redesign** (in `dashboard/docs/`):
- `Dashboard Screens.html` — 25 screen views drawn as they look today
- `Dashboard UI Teardown.html` — the written teardown, why it feels chaotic
- `UI Structure.md` — the flow map: desk → profile → app, and where every
  current screen lands. Structure only, no design.

**DECISION RECORDED 2026-08-01 — the separate Content Engine.** A review
compared the dashboard's Content Engine (specs 23-25) with the Codex-built Seed
Bank / Client Intelligence OS. Verdict: PARTIALLY REUSE. Do not integrate that
repository, its file layout, entity model, or vocabulary; its CLAUDE.md is not
authoritative here. Full decision, with what was adopted and what must never be
introduced, is at the end of `specs/00 — Dashboard Backlog.md`.

**SPEC 29 IS WRITTEN 2026-08-04, NOT BUILT:**
`specs/29 — Context Export & the Harvest Door.md`. The export reuses the one
existing assembler as a fifth content profile and renders a single markdown
pack of approved Context plus locked seeds, with a manifest that names every
exclusion; the `visibility` flag (private / internal / portable) defaults to
portable, so there is no migration; the harvest door is idempotent because its
id IS the operation id on an append-only path. §12 step 3 is the named
shippable stopping point — the export alone, one row in the owner corner, no
new tab. One open question is hers (§14): does the pack carry the founder's raw
thought verbatim on a client profile.

**Next step, agreed in principle:** design three screens, one at a time, as
pictures she reacts to — (1) the desk, sorted by what needs her rather than a
grid of eight equal cards (first draft shown and well received), (2) the profile
home, (3) the Board. Nothing is built until she says yes to a drawing.

**Still owed by her** (unchanged, all parked safely): the setup day + the IG
collection stall (losing a day of data per day since 2026-07-12) · the intake
vocabulary pass · engine spend ceiling · cross-profile playbook · staff & Sonia
audiences · the small suggested values · walking the other seven profiles
through migrate → strategy → lock.

---

## 2026-07-27 — SPEC 28 (THE PROFILE INTERFACE) IS BUILT, NOT DEPLOYED

The last spec in the 22–28 batch. Built in §16.2's order: the frame unreachable,
then the resolver, then the shelf replacing `/clients`, then the profile interior,
then the client shell, then the deep link, then the route map. **All of §17's
tests 1 to 13 are implemented and green as 61 checks, plus the payload halves of
14 and 16; specs 21 to 27's 335 are still green — 396/396 via `npm test`.** Tests
15 and 17 (the rendered halves) are named as skips and were verified by hand in
the browser at 375 px and at desktop. Typecheck clean, production build green with
dummy env. Nothing is deployed; the deploy is hers per DEPLOY.md.

### What is now true that was not true this morning

1. **The dashboard is profile-first.** Her login lands on a shelf of cards; she
   enters one profile and sees the three apps of that profile and nothing else.
   The one-site-with-toggles interface is gone from the interior: inside
   `/profile/<id>/*` no rendered element links to another profile, and the only
   route out is `/shelf`. `components/Sidebar.tsx` is retired from the interior
   and still in the repo, unimported, until the legacy routes go (§16.6).
2. **One place decides what exists.** `renderState(profile, switch, role)` in
   `lib/tree/render.ts` composes the cascade, the lifecycle, the audience and the
   door and takes the most restrictive answer. No screen reads a switch position
   itself, and the test that proves it scans the source.
3. **"Not rendered" is a server-side fact now, not a CSS state.** A switch she has
   SET to hidden takes its paths out of the role-filtered payload; at history the
   entries travel read-only and every write against them is refused. It only ever
   removes, and it only acts on a profile whose switchboard she has walked — a
   migrated profile with no positions keeps rendering what it renders today
   (spec 21 §9.6).
4. **Nothing from inside a profile reaches the shelf.** A card carries name,
   colour, lifecycle chip, counts composed at read time, and one attention line
   from a fixed vocabulary. Adding a field to a piece does not change it.
5. **Cutover is derived, per profile, and reversible.** A profile renders in the
   new shell when its body is migrated AND its strategy has locked. Everything
   else opens the legacy workspace, untouched, and the legacy tree stays deployed
   the whole time — the rollback path is one URL.
6. **A shared preview link lands a bound client inside their review window.**
   Five branches, server side, and none of them tells a stranger whether a
   binding exists.
7. **The chat is exactly where it was.** Mounted once in the root layout, above
   every route, on the shelf and in every profile, in both layouts. Neither frozen
   file was touched.

### What was resolved inside the plan (for the control room)

- **`renderState`'s first argument.** The spec writes `renderState(profileId, …)`;
  a pure module cannot fetch a profile by id, so the id arrives already resolved
  through `renderProfile(state, id, role)` — the one place a RenderProfile is
  built. Same three arguments, same answer, no hidden state.
- **The deep link's prerequisite.** §13.2's table makes
  `creation.review_deeplink` require `creation.review_public_link`, while §10 says
  a bound client STILL deep-links when the public link is revoked. Both cannot be
  true, because `requires` means never-more-active-than. §10 is her Q2 answer, so
  the prerequisite is `creation.review` (the door it delivers into) plus a login.
  §13.3's check is intact.
- **`client_access.mini_shelf` and the door validator.** A FIXED client-audience
  switch would have refused every lock on a profile with no client login, for a
  switch nobody can move. Fixed switches are skipped in that one loop; the cascade
  still keeps the mini-shelf no more active than `client_access.login`.
- **Ticking a strip row is an amendment.** `logs/tasks` is append-only, so a tick
  appends `{done: true}` and the original record stays intact (S11).
- **The Channels panel is not the old connections screen in a frame.** That screen
  lists every account beside a picker of every profile name, and nothing inside a
  profile may name another. The panel shows this profile's channels and this
  profile's accounts, and connects a token straight to it.
- **Logs → Notes reads the profile's own `logs/observations`,** not the owner-level
  inbox, for the same reason. §9's named consequence stands.
- **The client's Content window renders the pieces the server already narrows**
  (spec 24 §13.2) and does not add the draft body: `clientPreviewOf` is shipped but
  nothing calls it in the filter, and wiring it in would be re-implementing spec
  25's projection, which §15.4 forbids. The creative still reaches them through the
  preview link, which is what §10 is for.
- **`/connections` keeps rendering.** §11.3 marks it moved with a redirect, and
  §16.5 removes that redirect at the last cutover — but with no profile cut over
  yet it is the only place a token can be entered. It is recorded in the route map
  as moved, redirecting at the last cutover, and it still works today.
- **The route map is code.** `lib/shell/routes.ts` holds every route's fate, the
  legacy layout reads it for the per-profile redirect, and the orphan check runs
  over the app directory.

### Files

New: `lib/tree/render.ts` · `lib/shell/profile.ts` · `nav.ts` · `routes.ts` ·
`shelf.ts` · `trace.ts` · `deeplink.ts` · `components/shell/Frame.tsx` ·
`Shelf.tsx` · `MiniShelf.tsx` · `ClientWindows.tsx` · `Channels.tsx` ·
`CascadeTrace.tsx` · `app/shelf/page.tsx` · `app/profile/[id]/layout.tsx` ·
`page.tsx` · `intake/page.tsx` · `creation/page.tsx` · `creation/[tab]/page.tsx` ·
`analysis/page.tsx` · `analysis/[tab]/page.tsx` · `strategy/page.tsx` ·
`strategy/[panel]/page.tsx` · `tests/shell.test.ts`.

Changed: `lib/tree/switches.ts` (four switches, the door map, `doorsForSwitch`,
§13.3's check) · `lib/tree/features.ts` (nine shell features) · `lib/access.ts`
(`windowsForBinding`, `windowsForRole`, the switch-state pass) ·
`contexts/AppContext.tsx` (the windows payload, `lifecycleAt`, add-profile) ·
`types/index.ts` (`lifecycleAt`) · `app/api/state/route.ts` (windows on GET) ·
`app/page.tsx` · `app/clients/page.tsx` (redirect) · `app/client/[id]/layout.tsx`
(the cutover redirect) · `app/p/[shareId]/page.tsx` (the five branches) ·
`components/SwitchboardView.tsx` (the trace before it commits) ·
`components/analysis/AnalysisApp.tsx` (an optional route-driven tab) ·
`tests/run.ts`.

Untouched, as the spec requires: `components/ChatWidget.tsx` ·
`app/api/chat-brain/route.ts` · every legacy `/client/[id]/*` screen ·
`components/Sidebar.tsx` · `components/ClientsView.tsx` · `/me`, `/brain`, `/map`,
`/observations`, `/connections`.

### What is still hers

No profile has cut over yet, because none has a locked strategy: the shelf ships
and every card opens the legacy workspace, which §16.3 names as a valid shipped
state. ResumeGuru is the first profile to walk intake → curation → strategy →
switches, and that is her collective phase. §16.6's leaves list has NOT run — `/me`,
`/brain` and `/map` still render, and nothing is exported or removed until she says
so. §19's question is untouched: the intern and Sonia keep the legacy workspace on
every profile.

---

## 2026-07-27 — SPEC 27 (ANALYSIS ENGINE II) IS BUILT, NOT DEPLOYED

Built in spec 27 §22.3's order on a build branch: the reading layer and the pure
computation first with nothing rendering, then bifurcation, scorecard, funnel and
goals over that one layer, then compare, then the verdict cycle computed with the
model switched off, then the wording call and its four guards, then the digest in
three cadences, then the loop back, and the client publication last. **All twelve
of §23's fixture tests are implemented and green as 44 checks, and specs 21 to
26's 291 are still green — 335/335 via `npm test`** (plain Node, no dependencies,
no build step). Tests 13 and 14 are live-data checks and are named as skips.
Typecheck clean, production build green with dummy env. Nothing is deployed; the
deploy is hers per DEPLOY.md.

### What is now true that was not true this morning

1. **A gap can no longer read as a slump, on any of the eight surfaces.** Now,
   Slices, Scorecard, Funnel, Compare, Goals, Verdicts and the Digest all render
   coverage before performance, and the July stall shows up in every one of them
   as "the pipe stopped from 12 July", never as a decline. Acceptance test 1
   binds all eight at once, which is the test this whole spec exists to pass.
2. **The engine cannot write an observation.** `lib/analysis/read.ts` is the only
   reader of spec 26's tables and exports no writer at all. The write door was
   narrowed to match: a path fed ONLY by pipes now accepts only the pipes it
   names, so `engine:analysis` writing into `study-own-data` is refused by the
   declaration itself. Nothing else about the door changed.
3. **"AI can never invent a metric" is mechanical now.** Every numeral in every
   worded string must appear in the computed verdict input, in any of its honest
   formattings. A fabricated number is rejected and retried once; a second one
   withholds the words and renders the code-computed verdict with a plain line.
   The causation guard and the sufficiency guard reject the same way.
4. **A pillar is judged only on what its own declaration names.** The Convert
   pillar reads EARNING on link taps while its reach sits well below the account
   baseline, and reach never appears in its verdict. A pillar with no declaration
   reads `blocked` and says so; collection carries on underneath either way.
5. **The client sees nothing until she approves it.** A newly computed digest is
   invisible to a client login. Approval is the only thing in the system that
   sets `published: true`, and the resolver serves a non-owner only published
   client-publications on analysis paths. Removing that gate makes the check fail.
6. **Every suggestion cites its evidence, at the door.** A revisit proposal or a
   proposed strategy change arriving without a cited verdict is refused, not
   warned, both through the helpers and through a whole-body save.
7. **With no API key nothing breaks and nothing is invented.** Every number, band,
   refusal and comparison verdict computes; the verdict renders in words written
   by code, and the surface says plainly that the written summary is missing.

### The three suggested values, still hers

Recorded as suggestions and never applied as her position: the band cut-offs
(±15% lift), the quarter verdict's length (90 days), and the weekly pulse's slot
(Monday 08:00 IST). They ship on the surface as a "three values still waiting on
your call" block and go to her sort queue with spec 26's three.

### What was resolved inside the plan (for the control room)

- **The pipe-only write rule.** Test 3 needs `engine:analysis` refused at
  `study-own-data`, but `putEntry`'s writer check let any writer through wherever
  a `pipe:` or `path:` writer was declared. Tightening it globally would have
  broken the spec-21 migration, which writes `context/intake/questions` as
  `owner`. So the narrowing is exact: only declarations whose `fed_by` is
  ENTIRELY pipes become strict. Nothing else moved.
- **Comparison metadata.** §20.3 forbids adding a field to `MatchedComparison`.
  `planned`, the declared changed variable and a resolution's parentage travel as
  ENTRY metadata around the canonical object, never inside it.
- **Resolutions append.** A comparison resolved at 7d and again at 30d writes two
  entries, the second naming what it resolves. The path is append-only for real.
- **The verdict run kind.** `EngineRun.kind` gained `analysis_verdict` and
  `analysis_digest` rather than an analysis run masquerading as an extraction.
  Same shape, same path, one writer difference: no second run-log format exists.
- **Coverage outranks the call.** `computeCall` checks coverage first, so a
  leading pattern standing on a partial record is never a call.
- **The cascade reaches the computation.** A piece on a switched-off platform
  computes nothing new (slices, patterns, scorecard, packet), while it stays fully
  readable in the joined record. That is what "history stays readable, nothing new
  computes" means in practice.
- **Two conflict markers in this file** left over from the 25/26 parallel merge
  were removed. Both sides' text was kept.

### Files

New: `lib/analysis/read.ts` · `compute.ts` · `bifurcate.ts` · `scorecard.ts` ·
`funnel.ts` · `goals.ts` · `compare.ts` · `verdict.ts` · `words.ts` ·
`digest.ts` · `app/api/analysis/route.ts` · `app/api/analysis/store.ts` ·
`app/api/analysis/verdict/route.ts` · `app/api/analysis/digest/route.ts` ·
`components/analysis/Shared.tsx` · `Tabs.tsx` · `AnalysisApp.tsx` ·
`tests/analysis.test.ts` · `tests/analysisFixtures.ts`.

Changed: `lib/tree/objects.ts` (Verdict, Digest) · `declarations.ts` (the
verdicts path; owner as a writer of digests; the Analysis Engine as a writer of
feedback) · `switches.ts` (eight switches, two lock checks) · `features.ts` ·
`body.ts` (the pipe-only write rule) · `lib/access.ts` (the publication gate) ·
`lib/engine/runs.ts` (two run kinds, an injectable writer) ·
`app/api/state/route.ts` · `app/client/[id]/analytics/page.tsx` · `vercel.json` ·
`tests/run.ts`.

Untouched, as the spec requires: `resolveComparison`, `detectCoverageGaps` and
the thresholds in `lib/tree/metrics.ts`; every connector; `components/ChatWidget.tsx`;
`app/api/chat-brain/route.ts`.

### What is still hers

The SQL from spec 26 still has to be run and the collection stall still has to be
fixed; until then these surfaces render honestly and show a hole that widens by a
day a day. The S16 declarations on ResumeGuru's pillars and goals are what turn
the scorecard and goal tracking on, per subject. And the three suggested values
above are decisions, not defaults.

---

## 2026-07-27 — SPEC 25 (DRAFTING, GATES & FEEDBACK) IS BUILT, NOT DEPLOYED

Built in spec 25 §13.4's order on a build branch: the three new addresses and
the six switches first with no data touched, then the draft as a kept object
with the hand-written path (the shippable stopping point), then the machine gate
checks, then the gate run record and the two stage guards, then the rights gate
and its dated helper, then the drafting call, then the SEPARATE gate call, then
the feedback memory, and the taste layer last. **All 18 acceptance tests in §14
are implemented and green as 53 checks, and specs 21 to 24's 207 are still green
— 260/260 via `npm test`** (plain Node, no dependencies, no build step).
Typecheck clean, production build green with dummy keys. Nothing is deployed;
the deploy is hers per DEPLOY.md.

### What is now true that was not true this morning

1. **A carousel cannot BE an essay.** `DRAFT_SCHEMA` is a discriminated union on
   format family: a carousel is an array of slides with a capped heading and at
   most three lines each, and there is no field anywhere in the schema that a
   paragraph could live in. Her slide law is structural now, not an instruction
   the model may or may not follow.
2. **Her hook survives verbatim or there is no draft.** When the brief carries a
   hook she wrote, a draft that improved it is rejected and retried once with
   the violation named; a second rewording yields no draft and a logged
   violation. She is never shown a tidied version of her own line.
3. **The gates are judged by a second call, not the one that wrote the piece.**
   A model grading its own output in the same turn is not a check. The reviewer
   gets its own packet — the gate questions in her wording, boundaries, the
   never-words, the merged format rule, the machine results — and none of the
   drafting prompt. A pass with no evidence span is rejected and re-run once; a
   pass it still cannot point at becomes a flag, never a pass.
4. **A hard machine failure costs nothing.** If the format rules, the boundaries
   scan, the proof check or her hook guard fails hard, the model call is not
   made at all. The run is still logged, honestly, with `model: null`. "Never
   use carousel as the convert format" is one of those checks, read off the
   profile's own rule, so any client's prohibition works with no code change.
5. **Nothing leaves build until all seven pass.** Six passing verdicts is
   refused at the write door with the failing gate named. Remove the guard and
   the same write goes straight through, which is what proves the guard is doing
   the work.
6. **Gate versions are forward only.** Locking version 2 leaves every version 1
   record byte-identical — not touched, not recomputed, not re-rendered — and a
   piece that passed under v1 still reports `gate_version: 1` on every verdict.
   A posted piece is never re-judged by a standard that did not exist when it
   was made.
7. **Rights block publication, not review.** `rightsCleared` now delegates to
   `rightsClearedAt`, so a piece scheduled for three weeks out is judged against
   the day it posts rather than today. Build to review is allowed; approved to
   scheduled is refused. Every profile starts at `legacy-grace`, where an asset
   with nothing recorded warns instead of blocking the whole back catalogue, and
   a recorded refusal blocks from day one. The flip to `enforced` is one way.
8. **Feedback routes as a proposed diff and nothing else.** Three capture
   moments, five classes, and the law that a class the engine proposed routes
   nowhere. Accept applies the diff and creates strategy parameter version N+1,
   dated, with her feedback as its reason line. Reject preserves the words, the
   diff and her reason — the rejections are half the taste layer's evidence.
9. **Her edits are the data, and she never writes a word of it.** An edit
   creates version n+1 with a computed delta saying what moved and how. Twenty
   versions resolve in order and version 1 stays exactly what was first written.
10. **The taste layer crosses profiles; a client's data never does.** A proposed
    rule is checked against every profile name, id, channel handle, seed name,
    core message and piece title in the system, and against every figure that
    appears in anyone's metrics. A hit refuses activation and names the token.
    Only `rule` and `strength` are ever serialized into a packet — no evidence
    ref, no profile id, no other profile's name — behind a per-profile consent
    switch, capped at 25 and labelled at the bottom of the packet.

### The two things that will surprise her, stated plainly

- **The revise loop stops at two.** A third automatic attempt is not offered.
  The screen says: "Two tries and it is still not passing. That usually means
  the brief is wrong, not the copy," with a link back to the brief.
- **Her usual and the profile's rule will disagree, and the profile wins.** A
  ResumeGuru carousel drafts at 8 to 10 slides even though her standing habit is
  5 to 6. The disagreement is shown once, plainly, rather than swallowed:
  "Your usual is 5 to 6 slides. This profile's rules say 8 to 10. Drafted at 8
  to 10."

### Resolved inside the plan while building (for the control room)

- **`owner/taste-rules` is the first owner-zone store since the shelf**, so it
  is a new top-level AppState slice (`tasteRules`), wired through `emptyState`,
  `normalizeState`, `filterStateForRole`, `mergeRoleWrite`, the scope map and
  the address map, per CLAUDE.md rule 5. It is stripped from every non-owner
  payload in both directions.
- **Migration's all-unknown rights placeholder counts as an ABSENCE**, not a
  recorded refusal, so legacy grace forgives it. `consent: not-given`, a
  restriction, a passed expiry or a platform list that excludes this one are all
  somebody actually saying something, and grace never forgives those.
- **`EngineRun.model` is now nullable**, because a short-circuited gate run is a
  real run that made no call. `runIsComplete` checks the field is present rather
  than truthy, so `null` is honest and absent still fails.
- **Distillation runs one profile at a time**, because the run log is per
  profile. Its candidates land in the owner store as `proposed` and cannot
  activate without passing the de-identification guard against the whole system.
- **`work-log/creation/costume-recommendations` is a real store**, per spec 25
  §9.5 and PLAN §12's ratification, with both of spec 27 §15's rules enforced at
  the write door. Spec 27 §15.2 describes it as a read-time projection; the
  address and the rules are what this spec fixes, and either shape can write
  into it.

### Not built, deliberately

- **No playbook, and no cross-profile numbers anywhere** (§9.6). That is her one
  open question, Q1, for the collective phase; nothing here depends on the
  answer.
- **No spend ceiling.** Still spec 23's parked question.
- **No new screens.** Spec 25 §13.4's order is the data and model layer; the
  Creation app's drafting surface belongs to the interface spec.

### Files

`lib/engine/drafts.ts` · `gates.ts` · `drafting.ts` · `taste.ts` ·
`recommendations.ts` (all new) · `lib/engine/feedback.ts` (the five classes and
her acceptance surface) · `packet.ts` (two more content profiles on the one
assembler) · `formats.ts` (the rules version and the hashed resolution) ·
`runs.ts` · `lib/tree/declarations.ts` · `switches.ts` · `objects.ts` ·
`body.ts` · `features.ts` · `scopes.ts` · `validate.ts` · `migrate.ts` ·
`lib/strategy/derivation.ts` · `lib/access.ts` · `types/index.ts` ·
`app/api/state/route.ts` · `app/api/engine/draft/route.ts` (new) ·
`app/api/engine/gate/route.ts` (new) · `tests/gates.test.ts` (new).

---


## 2026-07-27 — SPEC 26 (ANALYSIS ENGINE I — THE TRACKING STORE) IS BUILT, NOT DEPLOYED

Built in spec 26 §14's order on a build branch: the addresses, switches and the
validator first with no data touched, then the tables, then the connector with
the existing Instagram logic moved into it, then the generalized run, then the
migration, then the tests. **All 12 acceptance tests in §15 are implemented and
green, and specs 21–24's 207 are still green — 238/238 via `npm test`** (plain
Node, no dependencies, no build step). Typecheck clean, production build green
with dummy keys. Nothing is deployed; the deploy is hers per DEPLOY.md.

**No reading surface was built, on purpose.** Nothing renders. Scorecard,
funnel, bifurcation, compare, verdicts and the digest are spec 27's.

### What is now true that was not true this morning

1. **The store is platform-neutral.** Seven tables (`channel_connections`,
   `platform_posts`, `sync_runs`, `post_observations`, `account_observations`,
   `post_links`, `post_readings`) replace the `ig_*` family, with `platform` as
   a column and the per-platform difference pushed into a code connector. The
   `ig_*` tables are untouched and stay readable — this is a copy, not a move.
2. **Observations are append-only for real.** `ig_daily_snapshots` was an UPSERT
   keyed on (post, day), so a second run the same day overwrote the first. The
   new table has a surrogate id, and a database trigger refuses UPDATE and
   DELETE outright. Two runs a day now add information and double-count nothing.
3. **Backfill can never reconstruct a missing day, mechanically.** A backfilled
   row is stamped as one, dated today, and closes no gap. There is no
   interpolation, no carry-forward and no last-known-value anywhere in the
   build. The 2026-07-12 stretch will render as a hole exactly as wide as it is.
4. **An absence always carries a reason.** Every run writes a `sync_runs` row —
   including the runs that decided NOT to collect — so a stall, a switched-off
   platform, a revoked connector, a permission refusal and a stretch before the
   channel started collecting all read differently. `switched-off` and
   `not-yet-tracked` joined the gap reasons: a decision and a boundary are not
   holes.
5. **Windows materialize once and store the real age.** A reading at 19h
   materializes `first-24h` with `age_hours: 19`. Readings at only 41h and 65h
   leave it `unavailable` with the gap named — never zero, and never the 41h
   value borrowed. Once materialized, a window is never recomputed, because
   recomputing it later would silently change history.
6. **A metric's kind is enforced.** Summing a cumulative lifetime counter across
   days throws at the store boundary; a per-day figure is a difference of two
   existing observations and is `unavailable` when either is missing;
   differencing an interval metric throws too. `/api/ig-metrics`'s old comment
   about lifetime counters became an assertion.
7. **The measuring stick is a validated object, not a boolean.** A declaration
   names its metrics, direction, calculation, denominator, window, target,
   platform availability and not-measurable fallback; a rate over a level metric
   is refused, a rate with no denominator is refused, and a blank target is
   refused because "no target" must be a decision. The gate blocks goal tracking
   per goal and the scorecard per pillar — and **collection runs regardless.**
8. **The S23 wall is store-level.** An outcome without both a declared event
   source and attribution method is `unknown`, and any attempt to compute a rate
   from it returns a refusal carrying no number at all — there is nothing for a
   surface to render by accident.
9. **The link join keeps her typing at zero.** She pastes the live link; that
   paste is still the whole trigger. The key now comes from the connector, the
   target is the canonical piece (with `legacy-card` kept for unmigrated
   profiles, never guessed into the other), two pieces claiming one post attach
   to neither, and a time-window match is offered and never written.
10. **The cron runs twice daily** (09:00 and 21:00 IST). A once-daily pipe
    measures "the first 24 hours" anywhere between 1 and 25 hours after
    publication, which made the most important window the least trustworthy one.

### Four addresses added, and the narrowing rule

`work-log/analysis/study-own-data/observations` ·
`work-log/analysis/study-own-data/sync-health` ·
`work-log/analysis/study-own-data/links` · `work-log/analysis/attributed-outcomes`.
All four are `audience: owner` — this spec collects and stores, it shows
nothing. Plus three parameters inside existing entry folders:
`goals/*/measurement`, `pillars/*/measurement`, `platforms/*/metrics`.

The validator now carries §4.1: a child may be narrower than its parent, never
wider. A parameter may never be more visible than the entry it lives in, and any
widening must declare its own client door. That is what keeps the measurement
declarations out of the client's strategy summary while `goals/` itself stays
part of it.

### Three resolutions the build had to make, all inside the plan

1. **An unwalked switchboard does not stop the pipe.** §6.2 step 2 requires the
   platform and its collector switch to resolve `active`. With no positions set —
   which is every profile today — they resolve `hidden`, so a literal reading
   would have stopped all live collection the moment this shipped: exactly the
   silence the spec exists to prevent. Spec 21 §9.6 already rules that a
   migrated profile behaves as it does today until she sets positions, so
   `decideCollection` collects when no position exists and says so in the run.
   Once she walks the switchboard, the cascade check applies strictly.
2. **`analysis.tracking.<platform>` allows `hidden`.** §11's table lists
   `active · history` but its own suggested default is `hidden` where no channel
   is connected. `hidden` is therefore an allowed position; neither it nor
   `history` deletes anything, and every past observation stays readable in both.
   The registry ships `suggested_default: null` (a platform switch cannot know
   from the registry whether a channel is connected) plus
   `suggestedTrackingState(hasConnectedChannel)` for the switchboard to call.
3. **Tests 11 and 12 run on fixtures here.** §15 marks them live-data, but the
   migration and the join are both pure functions, so their arithmetic and their
   rules are proven now. The genuinely live halves — parity against the real
   `ig_*` rows, and a real paste reaching a real post within one run — are
   present as two NAMED skips rather than quietly omitted.

### Honest limits, stated plainly

- **This machine has no database access**, so nothing ran against the real
  tables. `supabase/spec-26-tracking-store.sql` has never been executed, and the
  migration's live half waits on her setup day.
- **Step 0 of the migration is still hers and still urgent.** The collection
  stall since 2026-07-12 is fixed by her "Update now" tap and the error it
  reports. It does not wait for this build, and every day of delay is a day gone
  forever.
- **The collector dual-writes to `ig_*`** for the cutover window (§14.7). Both
  sides are idempotent per run. `/api/ig-sync` forwards to `/api/metrics-sync`
  for one release so the live cron cannot break mid-cutover.
- **`ig_post_tags` is copied to `post_readings` and the tagging job still writes
  the old table.** The rename changes no behavior, which is what §17 asks for;
  re-pointing `app/api/ig-tag` is a behavior change nobody asked for.
- Nothing was verified in a browser, because nothing renders.

### What her sort queue gains

Per channel: its timezone (migrated rows are stamped Asia/Kolkata because the
pipe has always run on IST — confirm it), and its `track_since` (the 2026-05-01
pivot was her call and becomes a stored value). Plus the v1 comparison
thresholds, and an S16 declaration for every goal and every switched-on pillar
job. None of them blocks anything: collection never waits on a decision.

### Files

`lib/platforms/index.ts` · `lib/platforms/instagram/index.ts` · `metrics.ts`
(all new) · `lib/tree/collector.ts` · `postLinks.ts` · `measurement.ts` ·
`migrateTracking.ts` (all new) · `lib/tree/metrics.ts` · `objects.ts` ·
`declarations.ts` · `switches.ts` · `features.ts` · `validate.ts` ·
`app/api/metrics-sync/route.ts` · `app/api/migrate-tracking/route.ts` (both
new) · `app/api/ig-sync/route.ts` (now a forward) · `app/api/ig-metrics/route.ts` ·
`supabase/spec-26-tracking-store.sql` (new) · `vercel.json` ·
`tests/tracking.test.ts` (new) · `tests/run.ts`.

---

## 2026-07-27 — SPEC 24 (COSTUME, BRIEFS & FORMAT RULES) IS BUILT, NOT DEPLOYED

Built in spec 24 §14.6's order on a build branch: the two new addresses, the
four switches and both corrections first with no data touched, then the costume
lists and the format library with tests and nothing on screen, then the surface
that only enumerates, then the resolve step (the shippable stopping point), then
the brief, then materials and rights, then the handoff, then the matched
comparison. **All 19 acceptance tests in §15 are implemented and green, and
specs 21, 22 and 23's 132 are still green — 207/207 via `npm test`** (plain
Node, no dependencies, no build step). Typecheck clean, production build green
with dummy keys. Nothing is deployed; the deploy is hers per DEPLOY.md.

### What is now true that was not true this morning

1. **A locked seed can be dressed, and exploring costs nothing.** Twelve
   multi-select dimensions, a grid that enumerates every combination with a
   count above it, and every row uncheckable. She can move eight pickers, look
   at twenty-four rows, and walk away having written nothing. Cancel writes
   nothing, logs nothing, spends nothing.
2. **Every confirmed row becomes one piece at `build`, with a birth record
   nothing can rewrite.** The costume, the pillar job read now, the goal
   mapping, the gate version, the strategy version. A second write to `birth` is
   refused at the write door from anyone, including both engines; a correction
   is a dated amendment and the original stays byte-identical.
3. **The engine writes the brief before a single line of copy exists**, on
   claude-opus-5 at effort high, and **every prose field carries a hard schema
   cap**. That is the whole guard against a brief becoming a draft, and it is
   mechanical rather than a matter of the model behaving.
4. **Format rules merge field by field.** Her carousel override replaces the
   length bands and the never list and keeps the universal structure whole, and
   the merged rule always says which field came from where. A format with no
   rule at either level says "no rule yet" and invents nothing.
5. **A rule-forbidden combination is shown and explained, not hidden.** A format
   rule is not a switch, so the row renders refused with the rule quoted, and
   she can pass it with a reason that lands in the birth snapshot, so analysis
   can see the piece broke its own rule on purpose.
6. **Rights are asked at attachment, against the piece's resolved platform.**
   An absent right attaches BLOCKED with the missing right in words, because she
   is often mid-clearance and being unable to build until a form comes back
   would be the tool getting in her way. A `restriction: 'blocked'` item is
   refused outright: that is someone saying no, not a gap to fill.
7. **The outside-tool round trip lands on the same piece.** The brief leaves
   carrying an immutable piece id and the version that left; the file comes back
   into `assets/sets` and attaches to that same piece. No second piece is ever
   created. A re-export sets `supersedes` and the chain is never broken.
8. **A matched comparison is born at the only honest moment.** A batch changing
   exactly one dimension offers one; two changed dimensions offer nothing; a
   batch differing only in proof offers nothing; with tracking off it is not
   offered at all. Held and changed variables are read off the costumes, never
   inferred.
9. **A second real leak is closed.** `work-log/creation` is declared
   `audience: both, see:upcoming`, and the body filter worked at PATH level
   only — so every piece at every stage would have reached a client login.
   Nothing created pieces at `build` through the tree until this spec. Non-owner
   logins now receive pieces at `review` and later only, with `costume`,
   `birth`, `batch_id`, `materials` and `notes` stripped.
10. **Nothing spends without a press.** Resolving twelve pieces makes zero model
    calls. Each piece has one "Write the brief"; a batch has one "Brief them
    all" that states the count and the dollar estimate first. "Write it myself"
    is always there, and with no API key it is the only route, said plainly.

### The wall she should expect, stated plainly

**The costume surface does not open on ResumeGuru until she walks it through
curation, derivation, the switches, and the lock.** Spec 22 §8.7 refuses any
write under creation on a profile that has never locked a strategy, and this is
that rule working exactly as written. It is also why the birth snapshot can
promise a real gate version and a real strategy version instead of two nulls.
The screen says this in plain words rather than failing silently.

### Two things found while building, both closed

- **`platforms/*/rules` was client-readable.** Spec 21 declared all four
  platform sub-paths `audience: both, see:strategy`. Spec 24 §13.1's workshop
  rule is absolute — no switch, in any position, may grant a client sight of a
  format-rule override — so the rules child is now owner-only. Filtering only
  got stronger (CLAUDE.md rule 2).
- **Spec 24 §13.3's first declaration edit was already in place**: `owner` is
  already a declared writer of `work-log/analysis/comparisons`. The reasoning is
  now on the declaration so nobody removes it later.

### Files

`lib/engine/costume.ts` · `formats.ts` · `resolve.ts` · `brief.ts` ·
`materials.ts` · `handoff.ts` (all new) · `lib/engine/packet.ts` (one assembler,
two content profiles) · `runs.ts` · `lib/tree/declarations.ts` · `switches.ts` ·
`objects.ts` · `features.ts` · `lib/access.ts` · `app/api/state/route.ts` ·
`app/api/engine/brief/route.ts` (new) · `components/CostumeView.tsx` (new) ·
`PieceBuildPanel.tsx` (new) · `EngineRoomView.tsx` ·
`app/client/[id]/engine/costume/[seedId]/page.tsx` (new) ·
`tests/costume.test.ts` · `tests/brief.test.ts` · `tests/costumeFixtures.ts`.

---

## 2026-07-27 — SPEC 23 (SEED BANK & THE ENGINE ROOM) IS BUILT, NOT DEPLOYED

Built in spec 23 §14.3's order on a build branch: declarations and switches
first with no data touched, then the seed sheet and the lock gates (the
shippable stopping point, and the correct one if the API key is ever dead),
then captures, then the model layer, then proposals, then the piece guard.
**All 12 acceptance tests in §15 are implemented and green, and specs 21 and
22's 96 are still green — 132/132 via `npm test`** (plain Node, no
dependencies, no build step). Typecheck clean, production build green with
dummy keys. Nothing is deployed; the deploy is hers per DEPLOY.md.

### What is now true that was not true this morning

1. **The seed bank works entirely by hand.** She can write a seed, fill the
   template, walk the four-tap ladder and lock it without a model ever being
   called. That was built first on purpose: if the API key is unset or dead,
   everything above still works and the room says so plainly.
2. **The raw thought is immutable, mechanically.** `raw_thought` and
   `raw_material` refuse amendment at any status, and the seed sheet renders
   them as quoted text with no edit affordance. A mis-capture is corrected by
   appending a new capture — the record grows, it never rewrites.
3. **One read function.** `resolveSeed` folds every amendment in order over a
   birth record that is never touched. Twenty amendments later, the birth
   record is byte-identical to what was first written, and the status ladder
   has a dated trail for free.
4. **Six lock gates, in her words.** Raw thought, core message, reframe,
   audience value, prohibited interpretation, and at least one pillar. The lock
   button lists what is missing as a sentence, never a red form. Only she locks
   — there is no auto-lock anywhere in the code.
5. **Only locked seeds mother pieces**, refused at the write door rather than
   hidden in a screen. Content Engine II calls the same guard and cannot route
   around it. Legacy pieces carrying no seed are untouched, and the migration
   passes whole.
6. **Captures are verbatim and written first.** The capture lands before the
   model is called, so a failed or refused run never loses what she said. A
   4,000-word capture with odd whitespace and emoji round-trips byte-identical,
   and an edit to an existing capture is refused server side.
7. **The model layer is real and grounded.** `claude-opus-5` at effort high,
   through the SDK, with structured output against `PROPOSAL_SCHEMA`, two cached
   system blocks, and `stop_reason` checked before content is read. A refusal
   renders as words, never as an empty list.
8. **The packet honors the cascade.** Only `active` paths enter it: turn
   LinkedIn to hidden or history and no LinkedIn name or format reaches the
   model, while every past LinkedIn piece stays readable. Block A is never
   trimmed; every trim is recorded and shown to her.
9. **The verbatim guard bites.** A paraphrased raw thought is rejected, the run
   retries once with the violation named, and a second paraphrase shows zero
   proposals rather than a polished lie. The other four checks badge and never
   hide.
10. **Proposals are untouchable until she picks them up**, enforced at the
    write door. Picking one up births a draft seed with every engine-filled
    field marked; a deepen proposal shows the clash beside her own wording and
    she chooses; a migrated capture-input shell is amended, never duplicated.
11. **Every run is logged, whatever happened.** Success, refusal or error each
    write exactly one `engine_run` carrying the model, the effort, the packet
    folder list, the context version, token counts and `cost_estimate_usd` —
    from run one, so her ceiling question has real numbers when she answers it.
12. **`ProfileBody.context_version` exists**, incremented by the path-scoped
    write door on any write under `context/`. Every packet, and so every
    proposal, is traceable to the exact state of Context it came from.

### Four law-4 folders added

`work-log/creation/topics/captures/` · `work-log/creation/topics/proposals/` ·
`work-log/logs/engine-runs/` · `work-log/logs/feedback/`. The last two are FIXED
records with `allowed_states: ['active']`: a switch that could turn either off
would make S12 and S13 lies.

### Honest limits, stated plainly

- **The engine room does not open on ResumeGuru until she walks it through
  curation, derivation, switches and the lock.** The room renders and the bank
  browses; extraction refuses with a plain reason naming strategy. That is PLAN
  §3.4's order working, and it is the one thing about this build that will feel
  like a wall.
- **No ceiling behavior was built** — her open question (§16). Cost is written
  on every run and the shelf shows the running total; nothing blocks, warns or
  throttles, because that shape is hers to choose.
- **The live call has never run against the real API from here.** The whole
  layer is exercised behind an injected stub, including the refusal path, the
  retry path and the error path. The first real run is hers.
- **`creation.seed_input_client` was corrected to a working-mode flag** with
  `owns: []` and a note naming the intake parameter it governs. Spec §10 says
  "amend its owns to the intake parameter" — but `owns` holds declared PATHS and
  the validator enforces that, so it follows spec 22's established pattern for
  surface switches instead. It grants no write either way.
- **"Make a piece from this" is a door, not a room.** It is present and
  disabled with its reason until the seed locks; what is behind it is Content
  Engine II.
- Not verified in a browser this session; verified by build, typecheck and the
  132 checks.

### What her sort queue gained

Nothing new was added to it — and one thing can now clear. The three migrated
capture-input subjects render badged "Not a seed yet — talk it out", cannot be
locked because `raw_thought` is empty, and their queue entries clear the moment
she talks one out, because picking up a proposal against a shell amends that
shell instead of creating a second entry.

### Next

Spec 24 (Costume, Briefs & Format Rules) builds on this: it consumes
`resolveSeed`, `canMotherPieces`, the `engine-runs` and `feedback` paths, and
`context_version` — all shipped here as shared library functions, none of them
screen-locked.

---

## 2026-07-27 — SPEC 22 (INTAKE & CONTEXT) IS BUILT, NOT DEPLOYED

Built in spec 22 §13's order on a build branch: the registries and the
validator first with no data touched, then spec 21's three named corrections,
then the surfaces, then the round-0 mapping pass. **All 20 acceptance tests in
§14 are implemented and green, and spec 21's 70 are still green — 96/96 via
`npm test`** (plain Node, no dependencies, no build step). Typecheck clean,
production build green with dummy keys. Nothing is deployed; the deploy is hers
per DEPLOY.md, and batch mode holds it until all seven builds are in.

### What is now true that was not true this morning

1. **The parameter inventory exists** (`lib/intake/parameters.ts`): what we
   know about a person and a business, each parameter in its declared folder,
   each carrying its own question. It is universal, like the costume variables,
   so it is code beside the tree registries rather than per-profile data.
   **Every entry ships `vocabulary: draft`** and a round carrying a draft
   parameter cannot be SENT. Her vocabulary pass flips them; nothing else in
   the build waits on it.
2. **Intake is HOW, mechanically.** Questions are generated FROM the
   parameters and never authored: the validator fails the build on a question
   with no parameter, on any parameter addressing content-strategy, and on a
   second lane into the seed bank. A round's questions are snapshots, so an
   answer stays readable years later, and adding a parameter puts it in the
   next round with no code change.
3. **The cascade reaches the questions.** A parameter that belongs to a
   switched-off platform is never asked, and a question's options are narrowed
   the same way. Nothing dormant asks to be filled in.
4. **Raw answers cannot move.** Append-only was already true; `amendEntry` is
   now shut at `context/intake/answers` outright. A correction is a new answer
   in a new round, and the correction lands at the curated level.
5. **No curated value without its source.** Every value she writes carries the
   answers it came from, who curated it, when, and how sure she is. Re-curating
   supersedes: the old reading stays legible, which is what lets analysis read
   a piece against the strategy that existed when it was born.
6. **A profile at `setup` can finally run intake.** Spec 21 shipped `setup`
   with client access OFF, which made the only phase intake exists for the one
   phase the client could not reach it. Client access is now scoped by DOOR:
   setup opens `give:intake` and nothing else — not assets, not review, not
   perception, not one see-point.
7. **The strategy has a room.** Sources, decision, reason, one panel per
   strategy parameter, with the reason REQUIRED. A parameter refuses to be
   written before one of its sources is curated unless she marks it owner
   declared, visibly.
8. **The lock is one act with six refusals**, and a failing lock changes
   nothing. On success everything is stamped at once, the profile moves setup
   to active, and creation opens.
9. **Creation is refused server side** on any profile that has never locked —
   at the write door, the same way an undeclared path is. Migrated profiles
   keep their legacy screens exactly as they are; this binds new writes through
   the tree only.
10. **The client sees the LOCKED version only.** Positioning, voice, audience,
    cadence and CTAs became part of their strategy summary; her working edits
    toward the next version are filtered out until she locks them. No second
    copy of strategy exists.

### One law-4 folder added

`context/business-details/materials/` — what the client already has: brand
book, logo files, photo bank, old content that worked, and the accounts they
already run. Files never live in intake; this records the fact and holds the
reference. `materials.existing-accounts` is the direct answer to one of the 16
questions spec 21's ResumeGuru migration had to leave open.

### Honest limits, stated plainly

- **The inventory as written is 52 parameters, not 41.** The spec's tables list
  52 rows; its prose counts 41. The tables are the inventory and the build
  followed them — dropping eleven named parameters to match a number would have
  been worse. Her vocabulary pass is where the list gets cut, which the spec
  already says.
- **18 of the 52 have no strategy reader** and carry `reader: none-by-design`
  with a written reason. They feed the engine's context bundle and her reading
  of the client. §8.1's derivation map was implemented exactly as written; a
  parameter was never added to it on a guess.
- **The client-side questionnaire screen is not built.** This spec's surfaces
  are hers: intake rounds, curation, derivation, gates, switchboard, lock. What
  a client sees is declared (audience and door per surface) so the client-side
  regroup has a contract, but their screen belongs to that spec.
- **`intake.reminders` ships declared and unbuilt**, as the spec says. She
  chases clients on WhatsApp today and that keeps working.
- **No profile is auto-locked and nothing was auto-curated.** The round-0
  mapping pass reads the old answers, proposes where each one belongs, and puts
  every proposal in her queue. Anything it cannot place is listed by name.
- Verified in the browser at desktop: the intake round generates its questions
  and refuses to send on the draft wording, the curation list renders, and all
  four strategy surfaces render and refuse honestly on an empty profile.

### What her sort queue gained

Every round-0 answer now arrives with a proposal attached ("this looks like the
best-customer parameter, curate it there or send it somewhere else, nothing has
been written"), and the ones nothing matched are named rather than dropped.
Running the pass twice does not double the queue.

### Next

Spec 23 (Seed Bank & the Engine Room) builds on this: its wall is real and
worth saying out loud — **the engine room does not open on ResumeGuru until she
walks it through curation, derivation, switches and the lock.** That is PLAN
§3.4's order working exactly as written.

## 2026-07-27 — THE BATCH IS DEPLOYED (deploy commit e7bea63 on client-tracker/main, Vercel success)

Her go in the control room; all three DEPLOY.md gates passed (green scratch
build; drift check — all 26 differing files verified as past vault states,
vault strictly ahead; her explicit go). She ran the push; Vercel reports
success. **The live app looks unchanged by design** — the entire new world is
dormant until a profile is migrated (apply) AND its strategy locks; legacy
screens keep working per profile until then. RESUMEGURU IS LOCKED AND LIVE IN THE NEW WORLD (2026-07-28). The full
strategy pass completed with her in the side panel: 14/14 parameters decided
with reasons (owner-declared, from her taxonomy and voice rules) · gate set
v1 saved (Coach, Hook, Value, Stance, Friend + accuracy + format) · all 78
switch positions set (suggestions adopted via the cascade-preview flow;
three contradictions caught by the validator and corrected: taste_rules,
review_deeplink, client_upload all off for this no-client-login profile) ·
the channel on record from migration · zero violations · SHE pressed Lock.
strategy_version: 1, lifecycle: active. Creation is open, the Engine Room
is unlocked, ResumeGuru is the first profile rendering in the new shell.

REMAINING ON HER LIST (shrunk): the vocabulary pass (spec 22's parameters,
before any client round) · spend ceiling · playbook question · staff/Sonia
ruling · the small suggested values · the setup day + IG stall (STILL losing
data daily) · other profiles' migrate+lock walks, one at a time.

## Spec-set record (superseded heading kept below)

All seven batch specs are written, control-room verified, and on main:
22 (Intake & Context) · 23 (Seed Bank & Engine Room) · 24 (Costume, Briefs
& Format Rules) · 25 (Drafting, Gates & Feedback) · 26 (The Tracking
Store) · 27 (Bifurcation, Compare & Verdicts) · 28 (The Profile
Interface). Integration records: PLAN.md §12. Next per batch mode: builds
in order (22 → 23 → 24 → 25 → 26 → 27 → 28), undeployed, then ONE deploy
on her go, then the collective phase.

**HER LIST for the collective phase (everything owed by her, one place):**
1. Spec 21's 13 migration confirmations → then the real ResumeGuru
   `apply: true` run.
2. The vocabulary pass on spec 22's 41-parameter inventory (no round
   reaches a client before it).
3. The ResumeGuru strategy pass: curation → derivation → gate set v1 →
   switches → LOCK (unlocks the engines and the new shell for that
   profile).
4. Engine model spend ceiling (spec 23 §16): none / soft / hard,
   shared across all AI features (~$20–40/month at expected use).
5. Cross-profile playbook (spec 25 §16): no / patterns-only (plan
   change) / owner-only reading surface.
6. The suggested-values one-list (specs 26+27): comparison thresholds,
   per-channel track-since, channel timezones, verdict bands (±15%),
   quarter length (90d), weekly pulse time (Mon 08:00 IST).
7. Staff & Sonia (spec 28 §19): what does a staff login see, and where
   does Sonia's Orders/catalogue work live — the plan knows only
   owner/client. Interim: those logins keep legacy screens; nothing
   breaks.
8. Standing, independent of all of it: the analytics setup day + the IG
   collection stall (data lost daily), and the chat-brain model upgrade
   decision (Haiku → Sonnet, parked).

## 2026-07-25 — SPEC 21 DEPLOYED (deploy commit a65079a on client-tracker/main)

Her go given in the control room; all three DEPLOY.md gates passed (green
scratch build with dummy keys; drift check verified safe — every differing
file's live version was an exact past vault state, vault strictly ahead; her
explicit "go"). She ran the push herself (the control-room session's push was
blocked by a safety permission — expected). The push landed twice with the
same content (double-click, harmless). **Chat brain v4 shipped in the same
deploy** — her live retest of the four-item message is now possible.
Awaiting: Vercel green confirmation, then the ResumeGuru DRY RUN
(`POST /api/migrate-profile`, writes nothing) and her read of the 16-question
report.

## Build record (what was built, before the deploy above)

The data-layer restructure is built, in the order the spec set: declarations and
validator first, then path-scoped writes, then one pilot profile migrated. All
of spec 21's acceptance tests pass — **70/70**, via `npm test` (plain Node, no
dependencies, no build step). Typecheck clean, production build green.

**Nothing is deployed and nothing about the live app has changed yet.** The
deploy is hers per DEPLOY.md, and the real-data migration is one owner action
away (below).

### What is now true that was not true this morning

1. **Every folder in the plan's tree has a machine-checkable declaration**
   (`lib/tree/declarations.ts`): what feeds it, what reads it, the switch that
   governs it, its allowed states, how it remembers, who may see it, and which
   of the four client doors it belongs to. A read or write against an
   undeclared path throws. Law 2's nesting is real — `platforms/instagram/
   formats` resolves, and a format has no existence outside its platform.
2. **Every switch exists in one registry** (`lib/tree/switches.ts`), including
   the structural ones that can never move. The cascade resolves as the minimum
   of a switch and its prerequisites, and her canonical trace is a test:
   LinkedIn off removes its formats, its strategy questions, its channel and its
   analysis column — on her side and the client's, in both directions.
3. **The validator refuses the build** on an undeclared path, a feature with no
   switch, or a client audience with no door (`lib/tree/validate.ts`). It caught
   six real mistakes in the declarations while they were being written. The
   orphan check is type-bound: a new state slice with no address will not compile.
4. **The save race is closed.** `app/api/state` now takes `{ state, paths }` and
   merges only the declared paths. Two tabs editing different parts of the
   system both keep their work, where the second save used to erase the first.
   This had to land before anything migrated: under last-write-wins, every
   "append-only" guarantee in the amendments would have been a lie.
5. **Access binds by profile ID.** `RESTRICTED_MATCHERS` — the client-NAME
   regexes — are deleted from the access path. Renaming a profile can no longer
   cut off or open up a login. The regexes survive in one file, used once to
   write down the access that already existed, so nobody loses anything on the
   day this ships.
6. **ResumeGuru is migrated** into a path-addressed body: 59 entries across 44
   addresses, with a report that names every value moved, every value marked
   unverified, and every question that is hers to answer.

### The pilot, and what it wants from her

Pilot = **ResumeGuru** (one of hers — a client profile is never the experiment).
The migration writes the body ALONGSIDE the legacy slices; nothing is deleted
and every screen still renders exactly what it renders today. Switch positions
are **suggested, never set** — she sets them after intake → curation → strategy.

**Honest limit:** this machine has no access to the live database, so the pilot
ran against a fixture shaped like ResumeGuru, not her actual row. The real run
is one owner-only call away and is a DRY RUN by default:

- `POST /api/migrate-profile { "profileId": "<resumeguru id>" }` → the report,
  nothing written.
- Same call with `"apply": true` → writes the body, through the path-scoped door.
- A second run on an already-migrated profile is refused (no double entries).

The 16 questions the migration could not answer, and deliberately did not guess:
which offer is the hero · which part of the old audience field is what they said
vs what she decided · which platforms should offer the formats nothing has used
yet · a metric declaration for each of the 4 goals (analysis stays blocked per
goal until each has one) · the 3 subjects that came over as capture input, not
seeds (they need her narration before they can be locked) · which piece the old
preview belongs to · who owns @resumeguru.ai, its timezone, and whether we post
or they do · rights on every existing photo · which references came from the
client. All of them sit in the profile's sort queue and in the report.

### Frozen, exactly as PLAN §11 ordered

The **chat thread and the untagged inbox are untouched** — `chatLog` and untagged
observations are declared at `frozen/chat-log` and `frozen/observations-inbox`,
not migrated, not moved, still working exactly as today. Their own spec comes
after the restructure. Observations WITH a profile tag did migrate into that
profile's `logs/observations`.

Also frozen and named rather than left silent: the 2026-07-10 legacy card copies,
the Studio canvas, custom fields, `journey.nextSteps`, `ContentCard.role`.

### One real leak found and closed

Writing the security tests surfaced it: her per-profile notes and seed bank live
inside the body now, so the intern's login would have received them. Every
non-owner login now gets a body filtered by the declarations. The 24 security
checks were verified to FAIL when the guard is removed, then pass with it in.

### Two decisions the build had to make (both inside the plan, both recorded)

1. **A client who brings ideas gives them at intake, not into the seed bank.**
   Spec 21 §8.5 listed a `creation.seed_input_client` switch writing into
   `creation/topics`, calling it a "give-point 1 extension". S19 allows exactly
   four client doors, and the validator refused it. The route now honors both:
   the client's idea arrives through intake (give-point 1), and her curation
   turns it into a seed. Same capability, no fifth door.
2. **The shared-list collaborator is not "the client".** Spec 12's live feature
   lets another workspace edit rows of a list she shared. Declaring the client
   as a writer there would have punched a hole in S19, so the tree names a
   distinct writer, `collaborator`: one object she explicitly shared, verified
   server-side against the authoritative state, opening no door into any
   profile's tree. Spec 12's behavior is unchanged and its checks still pass.

### Next

1. Her look at the report, then the real pilot run on ResumeGuru (`apply: true`).
2. Then the remaining profiles, one at a time, per §9.4.
3. Then the intake spec (the parameter inventory, after her vocabulary session),
   the Content Engine family, the Analysis Engine family, the client-side regroup.
4. Deploy is hers, per DEPLOY.md, whenever she wants it — this branch has not
   been merged or pushed anywhere live.

Still owed by her, independent of all of this: the analytics setup day, the IG
collection stall (data lost daily — recording does NOT wait for the restructure),
and the chat brain v4 deploy go.

---

Previous entry: 2026-07-25. **THE MASTER PLAN IS BEING WRITTEN: `dashboard/PLAN.md` (DRAFT).** Her 2026-07-25 direction: one complete build plan documenting the whole system — profiles, the Context/Work Log tree (spec 20's structure, rescued onto this branch), the two engines (Content + Analysis) as products-inside-the-product, client give-points, and the build pipeline (Fable plan → Sol flows → Opus specs → agents build → Sol review). Once locked, every session reads PLAN.md first; specs that disagree with it get rewritten. Confirmed by her: her own workspaces (ResumeGuru, KRNL) are client profiles, she is client zero. 2026-07-25 (final): **THE PLAN IS LOCKED WHOLE — `dashboard/PLAN.md` is now the authority every session reads first.** Locked in one day: the tree (four rounds), the four laws, strategy-as-switchboard + every-feature-is-a-switch + the cascade, the three apps, the GUI mandate (profile-first, look delegated to Claude), the Content Engine map (Sol's architecture + seed taxonomy, five refinements resolved, the intelligence bar), the dictionary (5.3), and the Analysis Engine (her correction: quantitative core, sandcastles.ai reference, compare/A-B as the purpose, soft signals out of the math). Closed on her words: "I can trust you with the whole plan." 2026-07-25 (Sol round 1): Sol pressure-tested the plan; ALL 25 findings accepted on her yes — folded in as PLAN.md section 10 (binding on every spec) plus inline edits: the seed/piece law (seeds never have stages; pieces do), matched comparisons with age windows, context packets, switch validation, profile lifecycle, the dictionary's new "Piece" entry. **SPEC 21 IS WRITTEN** (2026-07-25, fresh Opus chat per the plan's working structure §6) — `specs/21 — Data-Layer Restructure.md`, committed, nothing built; five open questions raised to the control room. Full entry in the section directly below. Also still owed by her, independent of specs: the analytics setup day + IG collection stall fix (data lost daily), and the chat v4 deploy go. Everything below this line predates the plan and stands until the plan supersedes it.

## 2026-07-25 — SPEC 21 WRITTEN (the first spec under the locked plan)

`dashboard/specs/21 — Data-Layer Restructure.md` is written and committed.
NOTHING BUILT — it is a spec, and its build waits on the control room clearing
it plus the five questions below.

What it is: the ADDRESS LEDGER. Every slice of `AppState`/`ClientData`, every
component, route, API endpoint, and `ig_*` table now has one address in the
plan's tree (PLAN §3), with the folders it reads, the folders it writes, and
the switch it registers in `toolset/`. Nothing is left silent: each item is
`active`, `history`, `hidden`, `frozen` (retained read-only), or `leaves`
(PLAN §7), and the spec's own orphan check re-runs as a build test.

Also in the spec, because the amendments require them: the folder/switch
DECLARATION CONTRACT plus a validator that fails the build on three things —
an undeclared path (law 4), a feature with no switch (§6 rule 3), and a client
write outside the four give-points (S19); the switch registry with
prerequisites, dependents, audience, three off-states (S9) and cascade
resolution validated at strategy lock (S8); and the canonical objects declared
once each so no later spec invents a second version — seed, piece (one identity
owned by `creation/`, S1/S2/S15), channel (S17), metric observation
(S3/S6/S7/S23), curated parameter (S11), intake round (S10), review config
(S20), rights record (S21), outside-tool handoff (S18), matched comparison
(S5), context packet (S12), feedback item (S13), gate set (S14), profile
lifecycle (S22).

Two decisions recorded by the spec, both inside its authority:
1. **No new storage pattern** (CLAUDE.md rule 5 holds). Body data stays in the
   one AppState blob, reshaped into a versioned path-addressed per-profile
   body; the `ig_*` tables stay the metric-observation store (rule 5's existing
   exception, which is exactly what S3 asks for). Two triggers make per-profile
   rows mandatory later: the blob passing ~5 MB, or more than one writer per
   profile.
2. **Path-scoped writes are in scope and land before any profile migrates.**
   `app/api/state` moves from "replace the blob" to "apply a patch for the
   paths it declares". Under today's last-write-wins save race (gotcha 2),
   every append-only guarantee in S7/S11/S15 would be a lie.
Also: access binds by profile id, and `RESTRICTED_MATCHERS` (the client-NAME
regexes) is deleted — role filtering derives from switch audience + client_door
+ lifecycle instead. CLAUDE.md rule 2 stands; spec 12's 19-check security test
is re-run as acceptance.

Four law-4 folder additions born in the spec, for the control room to ratify
into PLAN §3 (each declares its feeds and readers, each inside the frozen
spine): `creation/funnel/replies/` (Divine's Lead Answers — the scripts the
body holds), `logs/pipelines/` (Lists incl. sharing, Cold Calls, Orders),
`logs/effort/` (Momentum + Money meter, her own profiles only per §7),
`logs/observations/` (spec 18A, her per-profile notes).

## OPEN QUESTIONS FOR THE CONTROL ROOM — ALL FIVE CLOSED 2026-07-25

Q3/Q4 ruled by the control room, Q1/Q2/Q5 answered by her (full record: PLAN.md
section 11). Headlines: the chat thread + untagged inbox are HELD/frozen (their
own spec comes after the restructure); public preview links survive behind
their switch, with the logged-in deep-link enhancement queued for the
client-side regroup; retention is forever, deletion only by her with export
first. **SPEC 21 IS CLEARED TO BUILD** — fresh build chat per PLAN section 6.
The original questions, kept for the record:

1. **Where do owner-level, cross-profile objects live?** PLAN §5.3: everything
   belongs to exactly one profile, and the only thing between profiles is her
   shelf (whose one cross-profile window is the today strip). But the floating
   owner chat thread (`chatLog`, on every screen per §2) and untagged
   Observations are cross-profile by design and have no address. Inventing an
   owner-level store outside the frozen spine is a plan change — hers.
2. **Do public, unauthenticated preview links survive?** Review is a give-point
   inside the client's profile (§4) and S19 allows only four client doors;
   today review runs on anonymous `/p/[shareId]` links. Is a public link an
   allowed delivery route into the review door, or must review happen only
   inside a client login? The `creation.review_public_link` switch has no
   suggested default until this is answered.
3. **How do people bind to a profile?** The plan says a client login opens its
   own profile only, but never how many client users a profile may have — and
   S20 requires "delegated approvers", implying more than one. Does a delegated
   approver get their own login, and may one person hold logins to two
   profiles? This shapes the bindings replacing the name regexes.
4. **The parameter inventory.** Intake questions are generated FROM the detail
   folders' parameters (§3.1), and the plan records her vocabulary session as
   still owed. Confirm the split: spec 21 ships the parameter CONTRACT, the
   intake spec ships the inventory after her session.
5. **Retention and deletion authority (S22).** Profile lifecycle declares
   retention and deletion authority per state; the values are hers, and
   connector revocation sits next to her money/external-accounts gate. Spec 21
   declares the fields with no defaults. What are the retention windows, and
   who may delete a profile's data?

Next after the control room clears spec 21: the intake spec, then the Content
Engine spec family, then the Analysis Engine family, then the client-side
regroup (PLAN §8 step 6). Independent of all of it and still owed by her: the
analytics setup day, the IG collection stall (data lost daily — recording is
the engine's first duty and does NOT wait for the restructure), and the chat
brain v4 deploy go.

---

Previous update: 2026-07-21. The Dashboard chat (spec 18 part C v2) is LIVE — a floating owner-only chat on every page (deploy 92f3763). Earlier: the Observations panel + WhatsApp inbox (spec 18, both parts) are LIVE (deploy commit 58f1f70 on client-tracker/main, Vercel success, all three DEPLOY.md gates passed; drift = only the spec 18 files). **The panel is usable now. The WhatsApp side is PARKED by her decision 2026-07-20: her eSIM cannot receive SMS, so Meta's number registration cannot complete.** Full parked state, IDs, and the resume path are at the top of `docs/spec-18-setup.md`. Nothing is half-live: webhook never configured, subscribe toggle off, no payment method, app unpublished. Catalogue PDF export (spec 17) is LIVE. The ANALYTICS CORE (specs 03-06) and the Money meter (spec 16) are LIVE. Momentum meter with diary (spec 11), Shared Lists (spec 12), and the mobile stacking fix are also LIVE.

## SETUP DAY STILL OWED (analytics shows nothing until these are done)

The analytics code is deployed, but it reads tables and env vars that do not exist yet. Until Manmeet does these, the Analytics tab and Connections screen render but stay empty:
1. Run 3 SQL files in Supabase (in `dashboard/supabase/`): `spec-03-link-join.sql`, `spec-05-account-insights.sql`, `spec-06-post-tags.sql`.
2. Set `ANTHROPIC_API_KEY` in Vercel (the nightly AI tagger + digest need it; without it the reader stays idle).
3. Instagram tester-invite each account, accept the invite, paste each token into the new owner-only `/connections` screen, and link each account to its dashboard client. Steps: `dashboard/docs/spec-03-setup.md`.
Also note: the daily IG collection has been STALLED since 2026-07-12 — separate from this deploy, still awaiting her "Update now" tap result to diagnose.

This file is overwritten as truth changes. It holds where things stand and the single next step. History belongs in the vault log, not here.

---

## Where things stand

- Live on Vercel, deployed via manual graft push to the `client-tracker` repo (see CLAUDE.md, gotcha 1 and rule 6). **The deploy procedure is now written down: `dashboard/DEPLOY.md` (authoritative). Latest deployed: 2026-07-17, Shared Lists (commit 7578066 on client-tracker/main); earlier same day, Momentum diary + one-tap IG update (1ddc390), Momentum meter v1 (3281960), and the mobile stacking fix (ac31d11). Before that: 2026-07-15, month-aware Pillars + content filters (2c927ff — deployed in another session, recorded here late).**
- **2026-07-17: Momentum meter (spec 11) LIVE**, including same-day v1.1 (diary logging: she writes the day, AI ticks the chips via `app/api/momentum-read`; word-match fallback until ANTHROPIC_API_KEY is set in Vercel — she has NOT set it yet) and v1.2 (stale-IG-data notice + owner "Update now" button; `ig-sync` also accepts an owner session so CRON_SECRET is never needed by hand). All DEPLOY.md gates passed each time; shipped as overlays, analytics v1 still out. OPEN: the daily IG collection has been stalled since 2026-07-12 — waiting on her tapping "Update now" and reporting what it says. Her ask, same day: ResumeGuru's IG feels dead and watching only results is draining her; she wants an effort tracker. Decisions locked: lives on the ResumeGuru Journey tab, skipped days pull the meter back a little, engagement tracked automatically (CareerOS signups out of v1, no data source named). Built: effort meter 0-100 derived from a daily log (`momentum` on ClientData, chips + auto-count of posted cards from the board), 14-day strip, results row from the `ig_*` tables via new owner-only `app/api/ig-metrics`. Files: `components/MomentumMeter.tsx` (new), `components/JourneyView.tsx`, `types/index.ts`, `contexts/AppContext.tsx`, `app/api/ig-metrics/route.ts` (new). Verified interactively at desktop + 375px. Spec: `specs/11 — Momentum Meter.md`.
- **2026-07-17: mobile stacking fix LIVE.** On phones the Content (Board + Pillars views) and Lists pipelines stack their stage columns vertically full-width instead of forcing sideways scroll; desktop unchanged (`md:` breakpoint). Files: `components/ContentView.tsx`, `components/ListsView.tsx`, layout classes only. Deployed as a two-file overlay onto client-tracker/main (all three DEPLOY.md gates passed) because a straight graft would have re-shipped analytics v1. STANDING DEPLOY NOTE: main remains ahead of live by the rejected analytics v1 (`app/analytics/page.tsx` + a `Sidebar.tsx` line), deliberately pulled from live. Whether analytics v1 ever returns to live is Manmeet's decision — ask her before including it in any deploy. Until then, deploy as overlays that exclude it, or graft only after she decides.
- **2026-07-14: Spec 01 (task-client sync) is LIVE.** My Day has a type picker (Content / Client task / Personal) with multi-client select. Content tasks open the real post editor and create a card on each chosen client's board with two-way status sync (tick = posted, drop = deletes card). Client tasks become agenda items on each client's dashboard. Board stage "Writing" is relabeled "Making". Deployed alone (analytics NOT included) via a clean rebuild off main; all three DEPLOY.md gates passed (green local build, clean drift, her go).
- **2026-07-14 (same day, follow-up): My Day polish LIVE** (commit 5480feb). From her feedback on the live screen: (1) add-task box moved to the TOP; below it a two-column split — "Going live" (IG content going live) on the left, "Today" to-do (overdue on top) on the right; This Week / Later / Done today full-width below. (2) The task pencil now opens a full edit modal (name, clients, date, repeat, and stage for content tasks) instead of rename-only. PersonalDashboard.tsx only; built on a clean base off main, deployed via DEPLOY.md gates.
- **2026-07-17: Shared Lists (spec 12) LIVE.** A list can be shared into another workspace: one list, both sides full partners on rows, list object owner-only. Built for workshop pipelines with Merushri. Server-side: `filterStateForRole` injects windows for client logins, `mergeRoleWrite` verifies write-backs against the authoritative state (19-check security test in the spec's checklist passed). Files: `types/index.ts`, `lib/access.ts`, `components/ListsView.tsx`. Spec: `specs/12 — Shared Lists.md`.
- Manmeet uses it daily as owner, and not just for clients: she made workspaces for her LinkedIn, KRNL Studio, Freelance Projects, and ResumeGuru. Logins exist for intern, Sonia, Shiva, and Merushri.
- **Record layer: mature and recently reworked.** The unified Content tab is the hub: one card per post with stages (idea, writing, ready, scheduled, posted), three views (Board, Pillars, Table), platform chips, fold pattern for posted cards. Old Kanban and Pillars routes redirect into it; Evergreen and Studio tabs were removed. Around it: My Day auto-sorted with recurring tasks, monthly agenda, references, brand kit with logo upload, assets, lists as pipelines with custom stages, cold calls, journey, onboarding, catalogue and orders for Sonia, brain dump, container map.
- **Fetch layer: live.** IG metrics for @resumeguru.ai collect daily into the Supabase `ig_*` tables (Stage 2 of the analytics roadmap, in production since 2026-07-11; code at `app/api/ig-sync/route.ts`, cron in `vercel.json`).
- **Analytics v1 is live but rejected.** An owner-only `/analytics` page (sidebar shortcut) reads the `ig_*` tables: followers, totals, top 3 by saves, full since-May table. Manmeet's critique, filed as the Stage 3-4 plan in the roadmap: it must live inside each client's workspace (not one global page), go by the pillars, be readable by clients, and talk to the content instead of being a boring table. NOTE: the `/analytics` code shipped to the deploy repo and the vault working tree, but is NOT in second-brain main yet (drift, see CLAUDE.md gotcha 1).
- **Analyze layer: first piece live.** Journey v2 per client: goal card with progress, stacked month bars in pillar colors with actual vs target percent, tap-to-isolate, post triage flow for sorting old posts into pillars. It analyzes only hand-recorded data so far.
- **Decide layer: not started.** The declared direction: the dashboard should read client data and propose strategy, not just record work.

- **2026-07-18: Money meter (spec 16) LIVE.** Deployed on her go same day (deploy commit b1cd328 on client-tracker/main, Vercel success; all three DEPLOY.md gates passed, drift = only the spec 16 files). She has not set a monthly value yet — the card shows the points meter plus the "Start earning" invitation until she does. Her ask: the effort meter should count in dollars, a money icon moving forward as she works. Decisions: lives on the Momentum card (Journey), Mix earning rule (auto split of a monthly value she sets + optional per-day extra), effort money labeled honestly (not revenue). Built into `components/MomentumMeter.tsx` + two optional fields on `MomentumData` (`monthlyValue`, `MomentumEntry.extraValue`) — old logs untouched, points mode still works when no value is set, set value to 0 to switch back. Deliberate design change from spec 11: earned money never decreases; a skipped day earns $0 and a pace mark shows the gap. Verified interactively in the browser (conversion, chip earning at $48 for a half day of a $3,000/31 month, extra value, pace flip to "ahead by $2"); verification caught and fixed a real bug (saving a day dropped the monthly value). tsc clean. Deploy = merge branch to main + DEPLOY.md gates on her go. Spec: `specs/16 — Money Meter.md`.
- **2026-07-17 (this session, part 3): analytics core DEPLOYED.** On her "go", the session branch fast-forwarded onto vault main (201b147), all three DEPLOY.md gates passed (green scratch build with dummy keys; drift check = only expected files, the analytics additions + v1 deletions + this session's specs, no live-only app file at risk; her explicit go), grafted to client-tracker/main (deploy commit 8704156, tree from origin/main:dashboard onto the old live head 7578066). Vercel build: SUCCESS. Because analytics v1 was retired in the same landing, live and vault main are now fully in sync again — future deploys are plain grafts, no more overlays. The four analytics commits (5176a00, bef6cb5, 0bd3dd4, 7d59a47) are now part of main's history via merge a83815e; the old branch `claude/dashboard-status-review-fb52e4` is spent.
- **2026-07-17 (this session, part 2): spec set COMPLETE + analytics core made deploy-ready.** Specs 09 (Strategy Draft: two draft moments, citation rule, C8 accept/edit/dismiss mechanics with change-dated writes + strategy changelog), 10 (Playbook & Taste: evidence-born cross-brand entries + taste rules distilled from her draft edits, both open-book), and 15 (Data Quality & Trust: seven risks with defenses; centerpiece = Data Health card with verdict language chained to data health — DISCUSSION AGENDA, needs her 30-min session) written and committed. Then the analytics core (specs 03–06) was MERGED onto current main-equivalent on this session's branch (`claude/krnl-dashboard-continuation-a24a96`, merge commit a83815e): merged at 7d59a47 to exclude the stale stacked spec 01; 15 conflicts across 6 files resolved (union of momentum + topics/goals; shared-lists stripping kept; owner-session auth ported into multi-account ig-sync; spec 04 editor features — topic chip, experiment flag, repurpose — ported into the extracted CardEditor.tsx). Analytics v1 (global /analytics page + Sidebar link) DELETED on this branch per her locked 07-13 decision ("global /analytics RETIRED") — once this branch lands on main, deploys are plain grafts again, no overlays. tsc clean; production build green with dummy keys. DEPLOY STILL NEEDS: her explicit go → merge branch to main → DEPLOY.md gates → graft; plus her setup day (3 SQL files in `dashboard/supabase/`, ANTHROPIC_API_KEY in Vercel, tester invites + tokens via /connections — `dashboard/docs/spec-03-setup.md`). IMPORTANT: do NOT merge this branch to main before her deploy go — a graft from main would then carry the analytics core unapproved.
- **2026-07-17 (this session): the loop specced end to end.** Her ask: lots of discussion, not enough visible progress — she wants the data to talk to itself and the connections written down. Three specs written and committed: `13 — The Connected Loop.md` (master map: 8 stations, connections C1–C9 with carrier + why + status, spec scoreboard, proposed closing order — resolves backlog #5), `08 — Brand Profile.md` (onboarding becomes a typed parameter sheet; 16 questions → ~20 fields, every field names its reader; vocabulary session with her pending), `14 — Content Automation.md` (her two use cases: A auto-mark posted via a matcher in ig-sync, B schedule/publish from the dashboard; A first). Backlog 00 updated. Visual map artifact published (claude.ai/code/artifact/056c5ca3-4dd1-4e40-95eb-c73838af1275). Proposed closing order awaiting her confirm: deploy 03–06 → fix pipe → 14A → 08 → 07 → 14B/09.

- **2026-07-19: Catalogue PDF export (spec 17) LIVE.** Deployed on her go same day (deploy commit 1ad7fd1 on client-tracker/main, Vercel success; all three DEPLOY.md gates passed, drift = only the spec 17 files). Her ask: Sonia selects photos across catalogue categories, gets one PDF, shares it on WhatsApp — no extra steps. Locked: one photo per page. Built into `components/CatalogueView.tsx` only (+ `jspdf` dependency, lazy-loaded): Select mode with tick circles, selection survives category navigation (grid cards show "n picked"), bottom bar with Make PDF, photos recompressed to max 1400px JPEG so the file stays sendable, share sheet opens with the PDF attached (`navigator.share` with file; falls back to download on desktop). Nothing written to AppState; `lib/access.ts` untouched. Verified interactively (cross-category selection, toggle, PDF build fetched picked photos in order, desktop + 375px); tsc and production build green. Awaiting her look at the live screen. Spec: `specs/17 — Catalogue PDF Export.md`.

- **2026-07-20: Observations panel (spec 18 part A) BUILT, not yet deployed.** Her ask: a private place in the dashboard, hers only, to add a topic and note observations. Built: owner-only `/observations` page + sidebar shortcut (eye icon, owner block). New top-level `observations` slice in AppState, protected exactly like personalTasks: stripped in `filterStateForRole`, untouchable in `mergeRoleWrite` (all four access functions updated per rule 5). Topics are free text born through use — one-tap chips for existing topics, optional client tag, notes grouped by topic with filter, edit, two-tap delete. Files: `types/index.ts`, `lib/access.ts`, `contexts/AppContext.tsx`, `components/ObservationsView.tsx` (new), `app/observations/page.tsx` (new), `components/Sidebar.tsx`. Verified interactively (add across topics, chip persistence, filter, edit, delete confirm, sidebar link, desktop + 375px); tsc and production build green. Deploy = her go + DEPLOY.md gates. **Part B (WhatsApp bridge)** — she asked if she can text observations to a "Dashboard" WhatsApp contact and have AI file them by topic. Possible via the WhatsApp Business platform; specced honestly in `specs/18 — Observations Panel.md`. BLOCKED on her decision: it needs a dedicated phone number (cannot be a number already used in a normal WhatsApp app), plus a Meta setup day and the ANTHROPIC_API_KEY she already owes.

- **2026-07-20 (same session, part 2): WhatsApp inbox (spec 18 part B) BUILT, not yet deployed.** She got the eSIM and expanded the scope: one "Dashboard" WhatsApp contact for the whole dashboard, her hashtags steering. Routing law: hashtags steer; AI only files UNTAGGED text and only into owner-only Observations — nothing client-visible is ever written without her explicit client hashtag (rule 1). Grammar: `#task` → My Day; `#<client> #task` → client agenda + linked My Day task (spec 01 shape); `#<word>` → observation under that topic; photo + `#<client>` → client Assets in an auto-created "WhatsApp" set; untagged text → AI topic pick (Haiku, "Inbox" fallback); ambiguous client tags ask instead of guessing; every message gets a one-line reply. Security: Meta signature check, owner-number allowlist (strangers get total silence), tokens server-side only. Files: `lib/whatsappInbox.ts` (new, pure routing brain), `app/api/whatsapp/route.ts` (new, Meta I/O), `docs/spec-18-setup.md` (new, her ~45-min paperwork). Verified: 31 routing unit checks green; endpoint curl-tested (verify handshake, 403 wrong token, 401 bad signature, stranger silence, honest "NOT saved" when DB unreachable); tsc + production build green. NOT yet testable: the full live loop — needs deploy + her setup day. Honest v1 limits on record in the spec: Meta redelivery can duplicate a note; the gotcha-2 save race applies (same accepted risk as share-target); text and photos only. Go-live order: her deploy go (part A + B ship together) → setup day → step 7 test script.

- **2026-07-21: Content Engine spec written (spec 19), DRAFT awaiting her validation.** Her ask: a seed-to-post mechanism for the content funnel — she talks a topic once in depth, selects format + platform + pillar, gets a ready draft; repurposing is the machine's job; it must improve over time. Spec: `specs/19 — Content Engine (Seed to Post).md`. Location deliberately undecided (her call): Door 1 no-code (vault files + chat, testable today), Door 2 in-dashboard (rides spec 04 Topics + Repurpose), Door 3 standalone. NOTHING BUILT — and nothing gets built in the dashboard for this until (a) she picks a door and (b) the chat-bubble feature being built in a SEPARATE chat writes its spec/state into this repo (this session searched: no trace of it exists here yet; the two must be cross-checked before any Door 2 build). CROSS-CHECK NOW SATISFIED by the entry below: the chat-bubble feature is spec 18 part C v2, recorded and shipped.

- **2026-07-21: the Dashboard chat (spec 18 part C v2) SHIPPED (deploy commit 92f3763 on client-tracker/main, Vercel success; gates: green scratch build, drift = only this feature + doc riders, her instruction "get that chat thing down, live and working").** Backstory: WhatsApp registration dead-ended at Meta's PIN step (parked, trail in `docs/spec-18-setup.md`); Telegram proposed and REJECTED (she never uses it, calls it banned); the v1 `/quick` capture PAGE was built then REJECTED by her ("looks trash", must be a chat, on all pages, not another page) — v1 deleted, logic salvaged. v2: floating owner-only chat widget on every page (`components/ChatWidget.tsx`, mounted in `app/layout.tsx`; full-screen chat on phones, corner window on desktop; hidden on public /p/ pages and from all non-owner roles). Same routing brain as the WhatsApp pipe; replies in-thread as "Done — ..." / "Not done — ..." bubbles. NEW STATE SLICE (rule 5 decision): `chatLog`, owner-only, capped 100 — the thread survives reloads; filed items live in their real homes. All four access functions updated. Verified interactively in the browser: task → My Day (badge + list confirmed), client task → Divine agenda + linked task, untagged note → Inbox fallback, thread persists across page navigation, desktop + 375px (full-screen chat). tsc + production build green.

- **2026-07-22: chat brain v4 BUILT, not yet deployed.** Her verdict on the live v3 chat (with screenshots): it interrogated her ~25 times to add 4 things, could not create content cards (so the Divine Studio carousel + yoga reel had nowhere to go), and turned the category word "client task" into a card TITLE. Root causes found in the code, not the model: (1) the brain returned ONE action per message, forcing a question-per-turn ping-pong; (2) there was NO create-content-card action at all; (3) the prompt invited clarifying questions with no push to act. Cost checked and ruled out as the blocker (Haiku ~0.4¢/msg, Sonnet ~0.75¢, difference a few $/month) and Gemini discussed (possible, cheaper-than-Haiku Flash, but a second vendor + key; deferred). Her call: fix the structure on Haiku first, judge the model after. Built v4, same Haiku model: the brain now returns a LIST of actions (does the whole message in one go), gained a new **add_card** action that creates a real content card on a client's board (title from her words, default Idea stage, optional contentType/stage — mirrors the spec 01 card shape), and the prompt now says DO-don't-ask with sensible defaults and an explicit "a category word is never a title" rule plus an add_card-vs-add_client_task split (content to make = card; errand/reminder = task). Widget executes every action, validates each id, and posts one clean confirmation ("Done:" bulleted for multi-item), keyless/failure still falls back to the v2 rules. Files: `app/api/chat-brain/route.ts`, `components/ChatWidget.tsx`. Production build green with dummy env; verified in-browser that the widget mounts and the confirmation composer renders (the AI multi-action path itself needs the live ANTHROPIC_API_KEY, so its real test is on deploy). Deploy = her go + DEPLOY.md gates. Her live retest owed: the four-item message and the three v3 failures.

- **2026-07-21 (part 2): the chat brain v3 SHIPPED (deploy commit b8eb791 on client-tracker/main, Vercel success; gates passed).** Her verdict on the live v2 chat: it saves words instead of understanding ("this is very dumb") — it filed "#observations ... under shivansh" under a literal "Observations" topic, filed her question "where?" as a note, and couldn't mark a post as posted. Her observation model, now honored: a topic = one SUBJECT (e.g. Shivansh) accumulating notes long-term. On her yes: AI-first brain — `app/api/chat-brain` (new, owner-only, Haiku) reads every non-shortcut message with clients + topics + unposted cards + the last 8 thread messages, returns one validated action incl. **mark_posted** (moves a real card to Posted) and **reply** (answers/clarifies/refuses honestly). Widget validates all ids; keyless/failure falls back to v2 rules (verified locally — the chat never breaks). Files: `app/api/chat-brain/route.ts` (new), `components/ChatWidget.tsx`. tsc + production build green. Her live retest owed: the three messages that failed her.

## The single next step

Manmeet confirms (or reorders) the loop-closing order in `specs/13 — The Connected Loop.md` section 4 — step 1 is the analytics-core deploy "go" (specs 03–06 + setup day). The 07-12 IG collection stall is still being diagnosed (waiting on her "Update now" tap result).

Background: `specs/00 — Dashboard Backlog.md` is the master list and decision log; specs 01–07 are the 2026-07-13 builds, 08/13/14 the 2026-07-17 additions.

**BUILT 2026-07-13 (deploy-ready, NOT deployed):** the analytics core — Specs 03, 04, 05, 06 — as four commits on the session branch `claude/dashboard-status-review-fb52e4` (5176a00, bef6cb5, 0bd3dd4, 7d59a47). All typecheck-clean. Deploy checklist is at the bottom of the backlog. Her instruction: build STOPPED after 06 — specs 07, 01, 02 stay unbuilt until she says so. Ship = her explicit go, then carry to `client-tracker`.

The 2026-07-13 session SUPERSEDES the roadmap's A/B/C plan in key ways (the roadmap file predates it): AI pillar-tagging is demoted to fallback (the live-link join makes her cards the tag source), pillars get jobs (Reach/Trust/Convert), topics become first-class (repurpose action), experiments get a lane, the funnel ends at each client's Journey north star (never DMs), and the page is three layers (Scorecard / Comparison / Funnel) under a one-truth sync rule. Locked decisions: pillar jobs YES, connect ALL controlled accounts, three layers YES, experiments YES.

Analytics build order: 03 (link join + connections) → 04 (data model) → 05 (scorecard+funnel) → 06 (reading layer) → 05 (comparison) → 07 (digest). Specs 01 (task sync) and 02 (filters) are independent quick-schedulable builds with small forks pending her answers. The bigger picture remains `studio/Vision — Content Analyzer & Connected System.md`; the "parameters/strategy" (Decide layer) conversation is still to come and gets its own spec later.

## Answered (2026-07-12)

1. **Client usage:** Merushri is actively using her login. Shiva has not been given her access information yet; Manmeet plans to hand it to her. Sonia and intern status unchanged.
2. **Priority:** the analyze job. The performance analytics dashboard is the work in progress.
3. **Container Map:** live on the deployed dashboard (later graft deploys carried the whole app, so it went out with them). Its task checkboxes are hand-ticked data, nothing updates them automatically. Working agreement: when a build session ships something that matches a map task, Claude reminds Manmeet which task to tick.

## Open questions

Answers get written into this file, then this block shrinks.

1. Were decisions made in other chats that are written nowhere? Name them here.

## Recently done

- 2026-07-11: polish round live (Journey triage, animated month bars, wider Dashboard tab).
- 2026-07-11: IG analytics pipe live in the deploy clone, daily snapshots into `ig_*` tables.
- 2026-07-11: iteration round from her feedback: Role field removed, platform filter chips, fold pattern as house style, Journey v2, brand logo upload.
- 2026-07-10: rework phases 1 and 2: unified Content tab with one-time client-side migration, My Day auto-sort, Journey tab, Lists as pipelines, ResumeGuru one-click pillar pack.
- Earlier: passcode auth with 5 roles and server-side filtering, Assets tab with signed Cloudinary uploads, Instagram preview share pages, Lead Answers for Divine.

## Tried and rejected (do not redo)

- Deploying from the vault subtree: broke, replaced by the graft push to `client-tracker`.
- Canva Connect import without an OAuth app: parked, needs a proper OAuth app first.
- Separate Kanban and Pillars tabs: merged into the unified Content tab (2026-07-10); do not resurrect.
- Channels strip and next-steps text sections in Journey: removed on her feedback, she wants data, not text sections.
