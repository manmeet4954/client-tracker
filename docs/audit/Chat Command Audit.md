# Audit — the chat as the way the dashboard is operated

**Written 2026-08-09**, against branch `claude/ui-work-handoff-review-5361ad`.
Deliverables 1 and 2 of her brief: current-state audit, and the
feature-to-action coverage matrix.

## What this audit can and cannot claim

Everything below is read from the code. **Nothing here has been verified against
the database**, because this machine has no Supabase connection and no
environment file. Her rule stands and is not bent: no capability is called
working on the strength of tests alone.

What still needs a live database: the per-profile schema census, the real size of
the drift described below, and every one of the fourteen acceptance tests. That
needs either the env values locally or a dedicated test project.

---

## The finding that governs everything else

**The UI and the chat write to two different stores, and nothing reconciles
them.**

| | Where the SCREEN reads | Where the CHAT writes |
|---|---|---|
| Cards / pieces | `clientData.contentCards` — `components/ContentView.tsx:84`, `components/creation/Board.tsx:102` | `body.paths['work-log/creation']` — `lib/desk/write.ts` `addPiece`, `movePiece`, `schedulePiece` |
| Client tasks | `data.monthData[month].agenda` — `components/creation/Logs.tsx:170` | `body.paths['work-log/logs/tasks']` — `lib/desk/write.ts` `addTask`, `updateTask` |
| Observations | `state.observations` — `components/ObservationsView.tsx:27` | `body.paths['work-log/logs/observations']` — `lib/desk/write.ts` `addNote` |

`lib/tree/migrate.ts` copies the legacy slices INTO the body once, at migration.
There is no writer in the other direction anywhere in `lib/`. So the two stores
fork at the moment a profile is migrated and drift apart from then on.

Two consequences, and they are the whole problem:

1. **A card the chat creates never appears on the board.** A piece it moves never
   moves on the board. "I posted this today" writes to a store no screen renders.
2. **The counts disagree by construction.** `stageCounts` in
   `lib/shell/shelf.ts` counts the BODY; the board renders `contentCards`. The
   desk sidebar, `profile_status` and every chat answer read one store while the
   screen she is looking at reads the other. This is a sufficient explanation for
   ResumeGuru's contradictory counts on its own, and it needs no other cause.

**The one exception, and it is the pattern worth copying.** `make_preview` uses
`commitData` rather than `commitBody`, so it writes the legacy `previewPosts`
slice — the one the UI actually renders. It is the only chat write that shows up
on a screen. Every other write uses `commitBody`.

### What this does to her acceptance tests

Tests 2, 3, 4, 6, 7 and 12 cannot pass today, and not for want of tooling. They
require a chat write to be visible in the UI, and no path exists for that except
previews. This is a data-architecture fix, not a prompt or tool fix.

---

## The second finding: there is no service layer

Her requirement is that the UI and the chat call the same services. Today
neither calls a service, because none exists.

- **The UI** dispatches into a 98-case reducer in `contexts/AppContext.tsx`,
  mutating `AppState` in React, then debounce-saves the whole blob with declared
  path scopes to `/api/state`.
- **The chat** calls pure functions in `lib/desk/write.ts` server side, which
  return the next state, and `/api/desk-chat` saves it.

They share the write DOOR — `checkScopes`, `applyScopes`, the strategy lock, then
`writeState` — and nothing above it. What a card is, and what moving one means,
is implemented twice.

The door is the right seam and it already works. The missing layer sits directly
above it: one module per noun, called by the reducer and by the chat.

---

## Coverage matrix

`UI` = reachable by clicking. `Chat` = a tool exists. `Verdict` judges the pair.

**Disconnected** means the tool runs and writes, but to a store the screens do
not read.

### Profiles

| Capability | UI | Chat | Verdict |
|---|---|---|---|
| List and search | shelf | `find_profile` | **Functional** — both read `state.clients` |
| Get details | shelf card | `profile_status` | **Disconnected** — counts from the body, board from `contentCards` |
| Create | `ADD_CLIENT` | — | **Missing** |
| Edit name, colour, kind | `RENAME_CLIENT` | — | **Missing** |
| Archive / unarchive | row menu | `set_lifecycle` | **Functional** — both write `state.clients`, same slice. Untested against the DB |
| Aliases, alternate spellings | n/a | `find_profile` | **Partial** — exact id, exact name, one containing match. No alias store, no `#careerbubble` form, no honorific variants ("Shiva Ma'am") |

### Cards and content

| Capability | UI | Chat | Verdict |
|---|---|---|---|
| Search / open a card | board, table | `find_pieces` | **Disconnected** |
| Create | `ADD_CONTENT_CARD` | `add_piece` | **Disconnected** |
| Move stage | `MOVE_CONTENT_CARD` | `move_piece` | **Disconnected** |
| Schedule / set date | CardEditor | `schedule_piece` | **Disconnected** |
| Mark posted + live URL | CardEditor | `move_piece` | **Disconnected** |
| Edit pillar, format, platform | `UPDATE_CONTENT_CARD` | at creation only | **Partial** — no edit-fields tool |
| Assign an owner | — | — | **Missing** — no owner field on a card |
| Duplicate | — | — | **Missing** |
| Archive / delete | `DELETE_CONTENT_CARD` | — | **Missing** |
| Bulk operations | multi-select | — | **Missing** — and `MAX_WRITES = 6` caps a message |
| Attach a preview | Previews tab | `make_preview` | **Functional** — the one write that lands in a rendered slice |
| Attach assets | Assets tab | — | **Missing** |
| Return a direct link | n/a | `/p/<shareId>` only | **Partial** — no deep link to a record inside the dashboard |

### Tasks and My Day

| Capability | UI | Chat | Verdict |
|---|---|---|---|
| Client task, create | Logs | `add_task` | **Disconnected** |
| Client task, edit / reschedule / complete | Logs | `update_task` | **Disconnected** |
| Personal task / My Day | `ADD_TASK`, `TOGGLE_TASK` on `state.personalTasks` | — | **Missing** |
| Put an existing card in My Day | agenda | — | **Missing** |
| Assign to a person | — | — | **Missing** |
| Find overdue | today strip | `find_tasks` | **Disconnected** — both read the body, the Logs screen reads `monthData` |

### Strategy

| Capability | UI | Chat | Verdict |
|---|---|---|---|
| Read decisions, gates, switches | Strategy panels | — | **Missing** |
| Edit goals, audience, positioning, pillars, voice | `SET_GOALS`, `ADD_PILLAR`, `UPDATE_BRAND` | — | **Missing** |
| Channels | `UPDATE_INSTAGRAM`, Connections | — | **Missing** |
| Lock / unlock | Strategy lock | — | **Missing** |

### Knowledge and assets

| Capability | UI | Chat | Verdict |
|---|---|---|---|
| Add an observation | `ADD_OBSERVATION` | `add_note` | **Disconnected** — owner-level slice vs per-profile body path |
| Search observations | Observations screen | — | **Missing** |
| Add a reference | `ADD_REFERENCE` | — | **Missing** |
| Add an asset or document | `ADD_ASSET_ITEM` | — | **Missing** |
| Retrieve an exact record or link | n/a | — | **Missing** |

### Analytics

| Capability | UI | Chat | Verdict |
|---|---|---|---|
| Read the numbers | `AnalyticsView` via `/api/analytics` | — | **Missing** — no analytics tool at all |
| Distinguish connected / missing / unmeasured | coverage bar in the design | — | **Unbuilt** in the chat |
| Never claim collection from an unconnected channel | — | — | **Unguarded** — nothing enforces this on the chat side |

The `ig_*` tables are populated daily by `app/api/ig-sync`. No screen and no chat
tool reads them.

### Execution guarantees she requires

| Requirement | State |
|---|---|
| Validate before write | **Present** — every tool refuses before touching state |
| Resolve ids | **Present** — `resolveProfile`, and refuses an ambiguous name |
| Execute in a transaction | **Partial** — one save per message, no boundary across a multi-step request |
| Read back from the database | **Missing** — the route saves and reports; it never re-reads |
| Structured action receipt | **Partial** — `did[]` is a list of sentences, not records |
| Direct link | **Partial** — previews only |
| Undo | **Missing** — nothing in the codebase |
| Idempotency | **Missing** — a repeated message writes twice |
| Audit log | **Partial** — body entries carry writer and timestamp; legacy slices carry nothing |
| Confirmation on destructive actions | **Missing** in chat — the UI confirms on archive, the chat does not |
| Never say Done on a failed write | **Partial** — a refusal is honest, but a save that throws after the model has already written its reply is not caught |

---

## What is genuinely functional today

Short list, and it is short on purpose:

1. `find_profile`, and its refusal to guess between two matches.
2. `set_lifecycle` — same slice as the UI. Built 2026-08-09.
3. `make_preview` — including Canva import as of 2026-08-09, and it lands where
   the UI reads.
4. `across_profiles` and the five standing questions, which read the same
   composers the desk sidebar uses.
5. One brain across both surfaces: `runDesk` is the only caller of
   `/api/desk-chat`, pinned by tests in `tests/shell.test.ts`.

Everything else in the chat is either disconnected from the screens or absent.

## Nothing is mocked

Worth saying plainly, because she asked. No tool returns invented data, no write
is simulated, and no confirmation is faked. The tools do real work at a real
address. The address is the problem.

## What needs the database before it can be answered

1. Which profiles have a `body`, and at which `body_version`.
2. For each migrated profile, the size of the drift: pieces in the body versus
   cards in `contentCards`, and the same for tasks.
3. ResumeGuru's actual numbers, to confirm the mechanism above is the cause
   rather than one of several.
4. All fourteen acceptance tests.
