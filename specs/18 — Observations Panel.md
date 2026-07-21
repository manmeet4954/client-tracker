# Spec 18 — Observations Panel

Requested 2026-07-20. Her ask, verbatim in spirit: a place in the dashboard
that is HERS ONLY where she can add a topic and note down observations. Plus a
question: can WhatsApp connect to it — a "Dashboard" contact she types
observations to, and the system files each one into the right bucket.

Two parts. Part A (the panel) builds now. Part B (the WhatsApp bridge) is
specced honestly with its requirements and waits on her decisions.

---

## Part A — the panel (build now)

### What it is

A private notebook inside the dashboard. She opens Observations from the
sidebar (owner only — the link and the data are invisible to every other
login), types a topic and a note, done. Notes group by topic, newest first.
Later, these observations become the manual capture point the analytics
qualitative layer needs (spec 15 named this gap: brand-recall signals and
"where did they hear about us" have no API — someone has to write them down).

### Rules

- **Owner only, enforced server side.** The `observations` slice follows the
  exact same protection as personal tasks and the brain dump: stripped from
  every non-owner payload in `filterStateForRole`, and a non-owner write can
  never touch it in `mergeRoleWrite`. The page itself redirects non-owners,
  same as `/brain`.
- **Topics are free text, created by use.** No topic management screen. The
  quick-add offers existing topics as one-tap chips; typing a new word makes a
  new bucket. (Design law echo: no 200-entry dropdown, ever.)
- **An observation may optionally tag a client** — useful later when analytics
  wants Divine's brand-recall notes separate from ResumeGuru's. Optional,
  one tap, never required.
- Data lives in the one AppState blob (rule 5), slice `observations` at the
  top level (it is hers, not a client's — client tagging is a field, not a
  home).

### Data model

```ts
interface Observation {
  id: string;
  topic: string;       // free-text bucket, e.g. "Reels", "Client calls"
  text: string;        // the observation itself
  clientId?: string;   // optional tag
  createdAt: string;
  updatedAt: string;
}
// AppState gains: observations: Observation[]
```

### Screen

`/observations`, sidebar shortcut under My Day / Connections (owner block).
- Top: quick-add card — note box, topic chips (existing topics) + free-text
  topic field, optional client picker, Save.
- Below: notes grouped by topic (topic header + count), newest note first
  inside each group; a topic filter row to show one bucket at a time.
- Each note: text, client tag if any, date, edit and delete.
- Plain language everywhere; works at 375px.

### Touched files

`types/index.ts`, `lib/access.ts` (all four state functions),
`contexts/AppContext.tsx` (seed, load, three actions),
`components/ObservationsView.tsx` (new), `app/observations/page.tsx` (new),
`components/Sidebar.tsx` (owner shortcut).

---

## Part B — the WhatsApp inbox (scope expanded 2026-07-20, BUILT)

### What she wants (her expansion, 2026-07-20)

Not just observations — the whole dashboard reachable from one WhatsApp
contact called "Dashboard". Client instructions become tasks, photos land in
the client's assets, notes file themselves, her own tasks reach My Day. Her
words: she sets up labels/hashtags for herself to steer where things go.
She acquired the eSIM the same day — the number blocker is gone.

### The routing law

Her explicit hashtags steer; AI only ever touches UNTAGGED text, and files
it only into Observations (owner-only). Nothing a client login can see is
ever written without an explicit client hashtag from her — this is rule 1
(clients see curated content only) applied to the inbox.

### The hashtag grammar (v1)

| She sends | Where it lands | Reply |
|---|---|---|
| `#task <text>` | My Day (personal task) | Added to My Day. |
| `#<client> #task <text>` | Client's monthly agenda + linked My Day task (spec 01 shape) | Added to X's agenda. |
| `#<word> <text>` (word is no client) | Observation, topic = the word | Noted under Word. |
| `#<client> <text>` (no #task) | Observation, topic = client name, client-tagged | Noted under X. |
| plain text, no hashtag | Observation; AI picks from her existing topics or proposes one; no key → "Inbox" | Noted under ... |
| photo + `#<client>` caption | Client's Assets, auto-created "WhatsApp" set | Photo saved to X's assets. |
| photo, no client tag | Not saved — asks her to resend with a tag | Whose photo is this? ... |
| anything else (voice, video, docs) | Not saved (v1) | Only text and photos land ... |

Client tags match by name: the whole squashed name (`#divinestudio`) or any
4+ letter word of it (`#divine`, `#sonia`). An ambiguous tag (`#studio` when
two clients share the word) never guesses — it asks her to resend with the
full name. Every message gets a one-line confirmation so she knows it landed.

### How it actually works (honest version)

WhatsApp does not let an app read a normal chat. The real mechanism is Meta's
WhatsApp Business platform (the same Meta developer world as the Instagram
connection):

1. A phone number is registered to the WhatsApp Business API. **The catch:
   that number cannot also be used in a normal WhatsApp app.** So it needs a
   dedicated number — a cheap second SIM or a virtual number.
2. She saves that number as "Dashboard" in her contacts and just texts it.
3. Meta forwards every incoming message to a new dashboard endpoint
   (`app/api/whatsapp/route.ts`, webhook + verify token).
4. The endpoint asks Claude to pick the topic: it reads the message, sees her
   existing topic list, and either files it into a matching topic or starts a
   new one. Needs `ANTHROPIC_API_KEY` in Vercel — the same key the analytics
   reader and momentum diary are already waiting on. Fallback with no key:
   everything files under "Inbox" for her to sort.
5. The dashboard can reply in the chat ("Filed under Reels") so she knows it
   landed.

### Setup it needs (one-time, like the Instagram tester-invite day)

- A dedicated phone number (her decision: which number).
- A WhatsApp Business app in the same Meta developer account, webhook pointed
  at the dashboard, tokens stored server side (same discipline as IG tokens:
  never sent to the browser).
- `ANTHROPIC_API_KEY` in Vercel (already owed for analytics).

### Which side needs the number (clarified 2026-07-20, her question)

Her own number is untouched — she texts from her normal WhatsApp like to any
contact. The dedicated number is the DASHBOARD'S side: the contact she texts
to. Once a number is registered as this kind of automated receiver it stops
working inside any WhatsApp app (regular or Business — the Business app is
just a storefront app, not the automated platform). So an actively-used
WhatsApp number would be sacrificed; the real options are a number she owns
but doesn't use on WhatsApp, or a cheap second SIM / virtual number. There is
no workaround: WhatsApp does not let software read a chat between two normal
numbers.

### The eSIM route (discussed 2026-07-20)

An eSIM is a fine way to get the dedicated number: a new prepaid connection
from a real carrier (Jio / Airtel / Vi) delivered as an eSIM, cheapest plan,
activated by scanning their QR code in phone settings. Requirements: the
number must receive one verification SMS/call at registration time, so
data-only travel eSIMs (Airalo etc.) do NOT work — no SMS number. Rules:
never open WhatsApp with this number (it goes straight to the platform), and
keep a small validity recharge going so the prepaid number doesn't lapse.
The eSIM can live on any phone; only the number matters.

### Decisions (all resolved 2026-07-20)

1. The number: RESOLVED — she got an eSIM the same day.
2. Scope: RESOLVED by her expansion — tasks, client tasks, photos to assets,
   observations. Content cards stay out of v1 (nothing client-facing is
   AI-routed; her hashtags could grow a #idea lane later if she asks).
3. Reply-confirm: YES, one short line per message.

### Built (2026-07-20)

- `lib/whatsappInbox.ts` (new) — the routing brain, pure functions: hashtag
  parsing, client matching, decisions, and the state changes. 31-check test
  suite passed (parse, matching incl. ambiguity, every decision branch,
  every apply function).
- `app/api/whatsapp/route.ts` (new) — the Meta I/O: GET webhook verification,
  POST receiver with app-secret signature check, owner-number allowlist
  (silence for strangers), WhatsApp media download re-hosted into the assets
  bucket, Claude topic-picker for untagged notes (Haiku; "Inbox" fallback),
  reply sender. Tokens live server-side in env vars only, like the IG tokens.
- `docs/spec-18-setup.md` (new) — her ~45-minute Meta paperwork, incl. the
  Vercel env vars and the step 7 test script.
- Verified locally: 31 unit checks green; live endpoint exercised with curl —
  verify handshake (200 echo / 403 wrong token), bad signature 401, stranger
  number ignored without touching state, unreachable-database path answers
  "NOT saved" instead of dropping silently. tsc + production build green.
- NOT yet verifiable: the full live loop (real Meta delivery, media download,
  actual state write, reply arrival) — that is step 7 of the setup doc, after
  deploy + her paperwork.

### Honest limits (v1, on record)

- **Duplicates:** Meta occasionally redelivers a webhook; a note could file
  twice. Accepted for v1 (deleting a duplicate is one tap); a processed-id
  memory can come later if it actually happens.
- **The save race (gotcha 2):** the webhook writes server-side while her
  open dashboard tab saves the whole blob debounced — same accepted risk as
  the share-target flow. The visibility-refresh keeps her tab fresh; a
  message sent while actively editing the dashboard could in theory be
  clobbered.
- Voice notes, videos, and documents are not handled in v1.
- One client per task message; multi-client sends are asked to resend.

---

## Part C — the Dashboard chat (floating, every page; final form 2026-07-21)

After the WhatsApp registration dead-ended (see the parked note in
`docs/spec-18-setup.md`), the capture surface moved INSIDE the dashboard.
This section went through two versions in one night:

- v1 (2026-07-20): a separate `/quick` page with a capture box. **REJECTED
  by Manmeet** ("looks trash... overcomplicating my dashboard"). Her real
  spec: it must LOOK like a chat, must NOT be another page, and must be
  available on ALL pages. The page version was deleted; its logic survived.
- v2 (2026-07-21, SHIPPED): a floating **chat widget** on every page.

What it is: an owner-only chat bubble (bottom right, every screen; never on
public share pages, invisible to every other login). Tap → a chat panel
(WhatsApp-style full screen on phones, a corner window on desktop). She
types; the dashboard answers in the thread: **"Done — added to My Day."** /
**"Not done — whose photo is this?"** (amber bubble).

- Same grammar, same brain (`lib/whatsappInbox.decide`): `#task` → My Day;
  `#<client> #task` → client agenda + linked My Day task; `#<word>` →
  observation under that topic; plain text → AI-picked topic via owner-only
  `app/api/inbox-topic` (Haiku, "Inbox" fallback); photo + client tag →
  client assets in a "Quick Add" set (the Assets tab's signed-upload path).
- The thread persists: new owner-only top-level slice **`chatLog`** (capped
  at 100 messages; the filed items live in their real homes, so old lines
  drop safely). Recorded per rule 5; all four access functions updated —
  stripped for non-owners, untouchable by their writes.
- An empty thread shows a short how-to bubble with the grammar.

Files: `components/ChatWidget.tsx` (new), `app/layout.tsx` (mount),
`app/api/inbox-topic/route.ts`, `types/index.ts` (ChatMessage + chatLog),
`lib/access.ts`, `contexts/AppContext.tsx` (ADD_CHAT_MESSAGE).

Decision the same night: **Telegram was proposed and REJECTED** — she never
uses it and calls it banned. WhatsApp remains the only external channel;
part B stays parked, and the shared brain means lighting it up later costs
nothing extra.

## Status

- SHIPPED 2026-07-20 on her go, same day as the build: deploy commit 58f1f70
  on client-tracker/main, Vercel success, all three DEPLOY.md gates passed
  (green scratch build with dummy keys; drift = only the spec 18 files; her
  explicit "go").
- The panel is live and usable now. The WhatsApp side is deployed but INERT
  until her setup day (`docs/spec-18-setup.md`), then the step 7 test script
  over real WhatsApp.
