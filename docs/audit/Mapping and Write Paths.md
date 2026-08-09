# Mapping and Write Paths

A read-only audit of the two parallel representations of the same data — the
legacy slices ("the boxes") and the path-addressed tree ("the cabinet") — and of
every place in the app that mutates state without going through a shared service.

Every claim below cites `file:line`. Where the code is genuinely ambiguous, this
document says so rather than picking a plausible answer.

---

## Part 1 — The exact mapping

### 1.1 How to read this

Three different things are called "the path" and they do not always agree:

1. **The scope path** — the key in `PROFILE_SCOPES` / `OWNER_SCOPES`
   (`lib/tree/scopes.ts:37`, `lib/tree/scopes.ts:67`). This is what the save door
   merges on. One scope path may cover several legacy slices.
2. **The write path** — the concrete path `migrateProfile` actually calls
   `putEntry` against (`lib/tree/migrate.ts:91-93`).
3. **The declared path** — the entry in `DECLARATIONS`
   (`lib/tree/declarations.ts`), which carries `entry_type` and `history`.

For several slices these three differ, and that difference is itself a finding
(see §1.5).

### 1.2 Profile-level slices (`ClientData`)

Legacy types are from `types/index.ts`; cabinet object types from
`lib/tree/objects.ts` unless marked **(untyped)** — meaning the object exists only
as `BodyEntry.data: Record<string, unknown>` (`lib/tree/objects.ts:32-45`) with a
string `entry_type` in the declaration and no TypeScript interface anywhere.

| Legacy slice | Scope path (`scopes.ts:37`) | Actual write path(s) in `migrate.ts` | Legacy TS type | Cabinet object type | Clean? |
|---|---|---|---|---|---|
| `onboarding` | `context/intake/answers` | `context/intake` (`:110`), `context/intake/questions` (`:120`), `context/intake/answers` (`:123`) | `OnboardingItem` (`types/index.ts:195`) | `IntakeRound` (`objects.ts:352`) + `question` **(untyped)** + `answer` **(untyped)** | **No** — one slice fans into three paths, two of them outside its own scope |
| `brand` | `context/business-details` | `context/business-details/offers` (`:136`), `context/business-details/audience-raw` (`:147`), `context/content-strategy/audience-decided` (`:150`), `context/content-strategy/positioning` (`:162`), `context/content-strategy/goals` (`:257`, `:262`) | `BrandOverview` (`types/index.ts:64`) | `CuratedParameter` (`objects.ts:257`) + `strategy_parameter` **(untyped)** + `goal` **(untyped)** | **No** — one object splits across two scope roots; `brand.audience` is written to **two** paths from one source (`:147` and `:150`), flagged unverified at `:153` |
| `brandKit` | `context/content-strategy/visual-branding` | same (`:172`) | `BrandKit` (`types/index.ts:92`) | `strategy_parameter` **(untyped)** | Yes — whole object copied verbatim |
| `pillars` | `context/content-strategy/pillars` | `context/content-strategy/pillars/<slug>` (`:181`) plus `/job` (`:185`), `/mix-target` (`:191`), `/description` (`:195`) | `ContentPillar` (`types/index.ts:268`) | `pillar` / `pillar_parameter` **(untyped)** | **No** — write path is a per-pillar folder, scope path is the parent |
| `platforms` | `context/content-strategy/platforms` | `context/content-strategy/platforms/<slug>` (`:214`), `/formats` (`:218`), `/connection` (`:226`) | `string[]` (`types/index.ts:526`) | `platform` / `format` / `platform_parameter` **(untyped)** | **No** — formats are *inferred from `contentCards`* (`:204-211`), not from this slice |
| `postTarget` | `context/content-strategy/cadence` | same (`:248`) | `number` (`types/index.ts:509`) | `strategy_parameter` **(untyped)** | Yes |
| `goals` | `context/content-strategy/goals` | same (`:262`) | `ClientGoal[]` (`types/index.ts:466`) | `goal` **(untyped)** | Partly — shares the path with `brand.goals` and `journey.northStar` (`:255-260`) |
| `contentCards` | `work-log/creation` | `work-log/creation` (`:308`), `work-log/creation/making` (`:348`), `work-log/creation/scheduling` (`:361`), `work-log/analysis/comparisons` (`:368`) | `ContentCard` (`types/index.ts:474`) | `Piece` (`objects.ts:149`) + `draft_version` **(untyped)** + `schedule_record` **(untyped)** + `MatchedComparison` (`objects.ts:486`) | **No** — see §1.3 |
| `topics`, `evergreenIdeas` | `work-log/creation/topics` | same (`:283`) | `Topic` (`types/index.ts:455`), `EvergreenIdea` (`types/index.ts:102`) | `Seed` (`objects.ts:51`) | **No** — every migrated row is written `status: 'draft'` with `raw_thought: ''` and immediately marked unverified (`:292-295`): a topic is capture input, not a seed |
| `previewPosts` | `work-log/creation/review` | same (`:395`) | `PreviewPost` (`types/index.ts:211`) | `review_record` **(untyped)** | **No** — `cardId` is dropped (see §1.5) |
| `instagram` | `work-log/creation/channels` | `work-log/creation/channels` (`:413`) **and** `context/content-strategy/platforms/instagram/connection` (`:226`) | `InstagramProfile` (`types/index.ts:206`) | `Channel` (`objects.ts:228`) | **No** — one slice writes into two scope roots; `avatarUrl` has no cabinet field at all |
| `leadAnswers` | `work-log/creation/funnel/replies` | same (`:437`) | `LeadAnswer` (`types/index.ts:173`) | `reply_script` **(untyped)** | Partly — `createdAt`/`updatedAt` dropped |
| `assetSets`, `assetItems`, `driveFolderUrl`, `catalogueCategories`, `catalogueItems` | `work-log/assets/sets` | `work-log/assets/sets` (`:446`, `:469`, `:475`) and `work-log/assets/sets/<setId>` (`:449`, `:479`) | `AssetSet`, `AssetItem`, `string`, `CatalogueCategory`, `CatalogueItem` (`types/index.ts:236`, `:242`, `:523`, `:112`, `:118`) | `asset_set` **(untyped)** / `asset` **(untyped)** carrying `RightsRecord` (`objects.ts:431`) | **No** — five distinct slices collapse onto one scope; every asset gets an all-`unknown` rights block (`:452-455`, `:481-484`) that blocks publication (`:457`) |
| `references` | `work-log/references` | `work-log/references/our-vision` (`:492`) | `Reference` (`types/index.ts:48`) | `reference` **(untyped)** | **No** — scope path is the parent of the write path; every reference lands in `our-vision` because the legacy row has no source signal (`:495`) |
| `monthData` | `work-log/logs/tasks` | same (`:508`) | `Record<string, MonthData>` → `AgendaItem` (`types/index.ts:41`) | `task` **(untyped)** | **No** — see §1.4 |
| `lists`, `listRows` | `work-log/logs/pipelines/lists` | `work-log/logs/pipelines/lists` (`:517`) and `.../lists/<listId>` (`:521`) | `TrackList`, `ListRow` (`types/index.ts:289`, `:301`) | `pipeline` / `pipeline_row` **(untyped)** | Partly — `createdAt`/`updatedAt` dropped on both |
| `coldCalls` | `work-log/logs/pipelines/cold-calls` | same (`:530`) | `ColdCall` (`types/index.ts:153`) | `pipeline` **(untyped)** | Partly — `createdAt` dropped |
| `orders` | `work-log/logs/pipelines/orders` | same (`:539`) | `SoniaOrder` (`types/index.ts:130`) | `pipeline` **(untyped)** | Partly — `createdAt` dropped |
| `momentum` | `work-log/logs/effort` | `work-log/logs/effort` (`:550`) **only for `ownerKind === 'hers'`** | `MomentumData` (`types/index.ts:349`) | `effort_day` **(untyped)** | **No** — on a client profile it is explicitly **refused and not migrated** (`:560-566`) |
| `journey` | `work-log/analysis/goal-tracking` | `work-log/analysis/goal-tracking` (`:579`), `context/content-strategy/goals` (`:258`), `work-log/creation/channels` (`:428`) | `JourneyData` (`types/index.ts:327`) | `goal_progress` **(untyped)**, `goal` **(untyped)**, `Channel` (`objects.ts:228`) | **No** — one slice fans into three scope roots; `journey.nextSteps` and `journey.startMonth` go nowhere (`:598-600`) |
| `cards`, `pillarCards` | `frozen/legacy-cards` | **nothing written** — reported as frozen (`:586-591`) | `KanbanCard` (`types/index.ts:26`), `PillarCard` (`types/index.ts:392`) | `legacy` (`declarations.ts:646`, `fed_by: []`) | **No cabinet representation at all** |
| `studioCompositions` | `frozen/studio` | **nothing written** (`:592-594`) | `StudioComposition` (`types/index.ts:768`) | `legacy` (`declarations.ts:652`, `fed_by: []`) | **No cabinet representation at all** |
| `customFields` | `frozen/custom-fields` | **nothing written** (`:595-597`) | `CustomFieldDef` (`types/index.ts:19`) | `legacy` (`declarations.ts:658`, `fed_by: []`) | **No cabinet representation at all** |

`ContentCard.customValues` (`types/index.ts:488`) is the *storage* for
`customFields`. Since `customFields` is frozen and `customValues` is never read
by `migrate.ts` (grep for `customValues` in `lib/tree/migrate.ts` returns
nothing), the values are unreachable from the cabinet in both directions.

### 1.3 `ContentCard` ↔ `Piece`, field by field

`ContentCard` at `types/index.ts:474-496`. `Piece` at `lib/tree/objects.ts:149-181`.
Conversion at `lib/tree/migrate.ts:304-387`.

| `ContentCard` field | Becomes | Where | Clean? |
|---|---|---|---|
| `id` | the entry `id` at `work-log/creation` | `migrate.ts:308` | Yes — same id, no re-keying |
| `pillarId: string` (`''` = unsorted) | `costume.pillar_id` via `card.pillarId \|\| null` | `migrate.ts:314` | **No** — `''` becomes `null`, but `ResolvedCostume.pillar_id` is typed `string` (`objects.ts:94`), not `string \| null`. The migration writes a value the declared type forbids. |
| `title` | `title` | `migrate.ts:310` | Yes |
| `hook` | `hook` (`card.hook ?? ''`) | `migrate.ts:311` | Yes |
| `content: string` | **not on the piece.** Goes to `work-log/creation/making` as `draft_version.content` via `legacyDraftPayload` | `migrate.ts:346-357` | **No** — written only if `card.content \|\| card.hook \|\| card.link` is truthy (`:346`). A card with only a title loses nothing, but a card with content gets a `making` entry the piece never points at (see `current_draft_version_id` below). |
| `link?` | `draft_version.link` | `migrate.ts:356` | **No** — a piece-level field becomes a draft-level field; `Piece` has no `link` |
| `stage: ContentStage` | `stage: PieceStage` via `STAGE_MAP` | `migrate.ts:66-73`, `:305` | **No — vocabulary mismatch.** See below. |
| `contentType: string` | `costume.format` (`card.contentType \|\| null`) | `migrate.ts:317` | **No** — same `string` vs `null` problem as `pillar_id` (`objects.ts:95`) |
| `role?: ContentRole \| ''` | **nothing.** Explicitly skipped | `migrate.ts:384-386`, reported frozen at `:601-603` | **No cabinet equivalent** — superseded by pillar jobs |
| `platform?` | `costume.platform` (`card.platform \|\| platforms[0]`) | `migrate.ts:306`, `:316` | Partly — an absent platform is filled with the first entry of `platforms` (or `'Instagram'`, `:203`). That is an inference, not a copy. |
| `scheduledDate` | `scheduled_date` **and** a `schedule_record` at `work-log/creation/scheduling` | `migrate.ts:330`, `:361-364` | Partly — deliberately duplicated into two places |
| `postUrl` | `live_link` (`card.postUrl \|\| null`) | `migrate.ts:331` | Yes |
| `notes` | `notes` | `migrate.ts:332` | Yes |
| `customValues` | **nothing** | absent from `migrate.ts` | **No cabinet equivalent** |
| `createdMonth` | `created_month` | `migrate.ts:332` | Yes |
| `topicId?` | `seed_id`, but only `card.topicId && seedIds.has(card.topicId) ? card.topicId : null` | `migrate.ts:309`, `seedIds` built at `:299` | **No** — a `topicId` whose topic is not in `topics[]`/`evergreenIdeas[]` is silently nulled with no sort-queue item |
| `experiment?.hypothesis` | a `MatchedComparison` at `work-log/analysis/comparisons` | `migrate.ts:366-383` | **No** — `held_variables: []`, `changed_variable: 'unknown'` (`:372-373`); flagged unverified at `:378` and queued at `:381` |
| `collabId?`, `collabWith?` | **nothing** | absent from `migrate.ts` | **No cabinet equivalent.** The collab live-sync in `AppContext.tsx:739-757` and `:790-853` has no tree counterpart at all. |
| `createdAt` | `birth.at` — **only when** `stage` is `posted` or `scheduled` | `migrate.ts:320-321` | **No** — for the other four stages the creation date is lost. The `BodyEntry.created_at` is set to migration `now` by `putEntry`, not to `card.createdAt`. |
| `updatedAt` | **nothing** | absent from `migrate.ts` | **No cabinet equivalent** |

**`Piece` fields with no legacy source:**

- `channel_id` — synthesized from `data.instagram.handle` (`migrate.ts:328`); on a
  non-Instagram platform it is `null` even when a channel exists.
- `birth: BirthSnapshot` — `null` for `idea`/`build`/`review`/`approved`
  (`migrate.ts:320`). Where it *is* written, `gate_version` and `strategy_version`
  are `null` and it is marked unverified (`:326`, `:335-337`).
- `materials?: MaterialRef[]` (`objects.ts:167`) — never written.
- `batch_id?` (`objects.ts:174`) — never written.
- `current_draft_version_id?` (`objects.ts:180`) — **never written**, confirmed by
  grep against `lib/tree/migrate.ts`. Spec 25 §3.4 calls this "the ONE pointer
  everything else reads", and migration writes `<id>-v1` into `making`
  (`migrate.ts:348`) without ever linking the piece to it.
- `costume.objective / audience_stage / angle / hook_type / cta / length /
  product_intensity / voice / proof` (`objects.ts:97-105`) — never written;
  `Piece.costume` is `Partial<ResolvedCostume>` (`objects.ts:155`) so this
  type-checks, but the costume is nine-tenths empty after migration.

**Enum / vocabulary mismatch — `ContentStage` vs `PieceStage`:**

`ContentStage` (`types/index.ts:427`) is
`'idea' | 'writing' | 'review' | 'ready' | 'scheduled' | 'posted'`.
`PieceStage` (`objects.ts:88`, list at `objects.ts:90`) is
`'idea' | 'build' | 'review' | 'approved' | 'scheduled' | 'posted'`.

Two ids differ: `writing` → `build` and `ready` → `approved`
(`migrate.ts:66-73`). The comment at `migrate.ts:60-65` is explicit that
`ready → approved` is lossy in meaning — "today 'ready' means she is done, and
no client verdict was ever recorded" — so an approved piece in the cabinet does
not mean the same thing as a `ready` card in the box. `types/index.ts:416-425`
explains the ids were deliberately not renamed in the box "to buy nothing but
tidier spelling", which means the two vocabularies are now permanently forked
and the map at `migrate.ts:66` is the only bridge.

A third vocabulary exists for the chat: `STAGE_WORDS` at
`lib/desk/write.ts:284-291` accepts `writing`/`ready` as synonyms and maps them
onto `PieceStage`. So `ready` means `approved` in two places and `ready` in a
third.

**Append-only vs freely editable:**

`work-log/creation` is declared `history: 'append_only'`
(`declarations.ts:297`). A second `putEntry` on an existing piece id throws
(`lib/tree/body.ts:104`), so a stage change in the cabinet must be an
`amendEntry` (`lib/desk/write.ts:628`, `:690`). In the box, `MOVE_CONTENT_CARD`
(`AppContext.tsx:783-788`) and `UPDATE_CONTENT_CARD` (`:739-757`) overwrite the
card in place with no history whatsoever. The same user action produces an
audit trail on one side and a silent overwrite on the other.

### 1.4 Agenda item ↔ the task object at `work-log/logs/tasks`

`AgendaItem` at `types/index.ts:41-46`; stored as
`clientData[id].monthData[month].agenda[]` (`types/index.ts:98-100`, `:505`).
The cabinet side has **no TypeScript interface** — it is `BodyEntry.data` with
`entry_type: 'task'` (`declarations.ts:464`). Conversion at `migrate.ts:506-513`.

| `AgendaItem` field | Task field | Where | Clean? |
|---|---|---|---|
| `id` | entry `id` | `migrate.ts:508` | Yes |
| `text` | `text` | `migrate.ts:509` | Yes |
| `dueDate` | `due_date` | `migrate.ts:509` | Yes — naming only |
| `done` | `done` | `migrate.ts:509` | **No** — see below |
| *(the `monthData` key)* | `month` | `migrate.ts:509` | Structural: the map key becomes a field, so `monthData`'s grouping is flattened |

Fields on the task object with no `AgendaItem` source:

- `piece_id` — written by the chat only (`lib/desk/write.ts:435`), never by
  migration. `AgendaItem` has no equivalent; `PersonalTask.linkedAgenda`
  (`types/index.ts:604`) is the box's version and points the other way.

**Append-only vs freely editable — this is the sharpest one.**
`work-log/logs/tasks` is `history: 'append_only'` (`declarations.ts:467`).
`updateTask` in the chat therefore writes `done` as a dated amendment on top of
the original record (`lib/desk/write.ts:311-317`, `:375-383`), and readers have
to fold amendments to see the current value. The box's `TOGGLE_AGENDA`
(`AppContext.tsx:317-330`) flips `i.done` in place, keeping nothing. Toggle a
task twice in the UI and the box shows one boolean; do the same through the
chat and the cabinet shows two amendments.

There is also an **id-scheme difference at the container level**: in the box a
task is addressed by `(clientId, month, itemId)` — every reducer case takes all
three (`AppContext.tsx:308`, `:317`, `:332`, `:344`) — while in the cabinet it
is addressed by `(profileId, entryId)` with `month` demoted to a data field. A
task whose `dueDate` moves across a month boundary changes address in the box
and does not in the cabinet. Nothing in the code reconciles that.

### 1.5 `Observation` ↔ the observation object at `work-log/logs/observations`

`Observation` at `types/index.ts:663-670`; owner-level slice
`AppState.observations` (`types/index.ts:726`). Cabinet side again has **no
TypeScript interface** — `entry_type: 'observation'` (`declarations.ts:532`).
Conversion at `migrate.ts:569-574`; the chat's writer is
`lib/creation/logs.ts:519-523`.

| `Observation` field | Observation-entry field | Where | Clean? |
|---|---|---|---|
| `id` | entry `id` | `migrate.ts:571` | Yes |
| `topic` | `topic` | `migrate.ts:572` | Partly — `logs.ts:522` writes `topic` only when non-empty, so an entry written by the chat may have no `topic` key while a migrated one always does |
| `text` | `text` | `migrate.ts:572` | Yes |
| `createdAt` | `created_at` | `migrate.ts:572` | Yes, though `lib/creation/logs.ts:474-476` has to fall back to `entry.created_at` because the field is not guaranteed |
| `updatedAt` | **nothing** | absent from `migrate.ts` | **No cabinet equivalent** |
| `clientId?` | **not a field** — it becomes *which profile body the entry lives in* | filter at `migrate.ts:569` | **No** — a tag becomes a location. This is the single largest structural change in the mapping. |

**Consequences of `clientId` becoming a location:**

1. An observation with **no** `clientId` is not migrated at all. It stays at the
   owner-level `frozen/observations-inbox` scope (`scopes.ts:72`), which is
   declared `states: ['history'], history: 'none'` and annotated "untagged
   observations are HELD with the chat. Not migrated" (`declarations.ts:640-644`).
2. `Observation.clientId` is optional and re-taggable in the box; in the cabinet
   moving a note between profiles would mean deleting and re-creating it at an
   `append_only` path (`declarations.ts:534`). There is no code that does this.
3. Because migration copies rather than moves, the same note exists under the
   same id in both places. `lib/creation/logs.ts:453-464` documents the
   consequence and merges by id with the body winning
   (`lib/creation/logs.ts:470-490`). This is the only read-side reconciliation
   between a box and the cabinet anywhere in the codebase.

**Owner-scope note:** `OWNER_SCOPES` maps `observations` to
`frozen/observations-inbox` (`scopes.ts:72`), but the tagged rows are written to
the *profile-level* path `work-log/logs/observations`. So the slice's declared
scope and the place its contents actually land are different paths in different
zones. A save that changes `state.observations` declares
`owner::frozen/observations-inbox` and touches nothing in any profile body.

### 1.6 Owner-level slices (`AppState`)

`OWNER_SCOPES` at `lib/tree/scopes.ts:67-75`. `migrateProfile` takes
`(client, data, { observations })` (`migrate.ts:75-79`) — it never sees the other
owner slices, so **none of them are migrated**.

| Owner slice | Scope path | Migrated? | Legacy TS type | Cabinet object type | Clean? |
|---|---|---|---|---|---|
| `clients`, `bindings` | `shelf/profiles` | No | `Client` (`types/index.ts:541`), `ProfileBinding` (`types/index.ts:566`) | `profile` **(untyped)** (`declarations.ts:19`) | **No cabinet representation.** `Client.switches` / `suggestedSwitches` are the one thing migration touches, and it writes them back onto the *box* (`app/api/migrate-profile/route.ts:81`). |
| `personalTasks` | `shelf/today-strip` | No | `PersonalTask` (`types/index.ts:590`) | `task-view` **(untyped)** (`declarations.ts:26`) | **No** — the declaration says `history: 'none'` and "A view, never a store" (`declarations.ts:28-30`), yet `personalTasks` is a real store with 11 fields, `linkedCards`, `linkedAgenda` and `repeat`. The scope path denies that the slice is a store. |
| `tasteRules` | `owner/taste-rules` | No | `TasteRule` (`objects.ts:578`) | `taste_rule` = the same `TasteRule` | Yes — this one slice is already declared as its cabinet object; nothing needs mapping |
| `chatLog` | `frozen/chat-log` | No | `ChatMessage` (`types/index.ts:688`) | `chat_message` (`declarations.ts:634`, `states: ['history']`) | **No cabinet representation.** Deliberate: "the chat is HELD. It keeps working exactly as today, outside the tree" (`declarations.ts:637`). |
| `observations` | `frozen/observations-inbox` | Tagged rows only, to a *different* path | `Observation` (`types/index.ts:663`) | `observation` **(untyped)** | **No** — see §1.5 |
| `brainDump` | `leaves/brain-dump` | No | `BrainDump` (`types/index.ts:632`) | `legacy`, `fed_by: []` (`declarations.ts:689`) | **No cabinet representation at all** |
| `containerMap` | `leaves/container-map` | No | `ContainerMap` (`types/index.ts:653`) | `legacy`, `fed_by: []` (`declarations.ts:694`) | **No cabinet representation at all** |

### 1.7 Summary of slices with no clean cabinet mapping

Counting a slice as "no clean mapping" when it either has no cabinet
representation at all, or its fields do not survive the conversion intact:

**Profile level (13 of 26 scoped slices):** `onboarding`, `brand`, `pillars`,
`platforms`, `contentCards`, `topics`+`evergreenIdeas`, `previewPosts`,
`instagram`, `references`, `monthData`, `momentum`, `journey`, and the three
frozen slices `cards`+`pillarCards`, `studioCompositions`, `customFields`
(counted as three).

**Owner level (6 of 8 slices):** `clients`+`bindings`, `personalTasks`,
`chatLog`, `observations`, `brainDump`, `containerMap`. Only `tasteRules` is
clean, and only because it never had a box/cabinet split to begin with.

### 1.8 Id-scheme differences, collected

1. **Entry ids are preserved everywhere** — `migrate.ts` passes the legacy `id`
   straight through in every `write(...)` call. There is no re-keying. Good.
2. **Derived ids** appear where the box had none: `a-<id>` / `q-<id>`
   (`migrate.ts:120`, `:123`), `offer-<id>` (`:136`), `goal-<slug>` (`:257`),
   `ch-<slug(handle)>` (`:412`), `jc-<id>` (`:428`), `cat-<id>` (`:475`),
   `<cardId>-v1` (`:348`), `<cardId>-sched` (`:361`), `cmp-<cardId>` (`:368`),
   `checkin-<month>` (`:579`). None of these are recorded on the box side, so
   the box cannot find its own cabinet entry without recomputing the slug.
3. **Slug collisions are unguarded.** `slug()` (`migrate.ts:51-53`) strips
   everything non-alphanumeric. Two pillars named "Reels" and "reels!" produce
   the same folder path (`migrate.ts:180-182`), and `putEntry` at an
   `append_only` path would throw on the second. Nothing checks for this.
4. **`PreviewPost.cardId` is dropped.** `types/index.ts:213-219` declares it as
   the link from a preview to its piece; `migrate.ts:396` hardcodes
   `piece_id: null` and the comment at `:393` and `:404-405` asserts previews
   "were never linked to a card". That was true when the field did not exist —
   the field exists now (`types/index.ts:219`) and migration ignores it. Any
   preview attached through the piece panel (`components/creation/PiecePanel.tsx:125`,
   `:135`, `:152`) loses its link on migration.

---

## Part 2 — Inventory of every direct-write path

### 2.1 Method and counts

Every count below is reproducible. The commands were run from the `dashboard/`
directory with `--glob '!node_modules'` on every invocation.

**Total `dispatch(` occurrences:**

```
rg -o "dispatch\(" --glob '!node_modules' | wc -l
→ 180
```

These 180 break down as:

| Shape | Command | Count |
|---|---|---|
| `dispatch({ type: '…'` on one line | `rg -o "dispatch\(\{\s*type:\s*'[^']+'" --glob '!node_modules' \| wc -l` | 150 |
| `dispatch({` with `type: '…'` on the next line | `rg -U -o "dispatch\(\{\s*\n\s*type:\s*'[^']+'" --glob '!node_modules' \| wc -l` | 24 |
| `dispatch({` with a **ternary** type | remainder; the six sites are listed below | 6 |
| | **total call sites** | **180** |

The six ternary sites each name two action types, so the number of *possible
action instances* is `174 + (6 × 2) = 186`. They are:

- `components/ContentView.tsx:198` — `ADD_PILLAR` / `UPDATE_PILLAR`
- `components/ContentView.tsx:134` — `ADD_CONTENT_CARD` / `UPDATE_CONTENT_CARD`
- `components/ContentView.tsx:161` — `ADD_CONTENT_CARD` / `UPDATE_CONTENT_CARD`
- `components/PillarsView.tsx:79` — `ADD_PILLAR_CARD` / `UPDATE_PILLAR_CARD`
- `components/ListsView.tsx:83` — `ADD_LIST_ROW` / `UPDATE_LIST_ROW`
- `components/AnswersView.tsx:57` — `ADD_LEAD_ANSWER` / `UPDATE_LEAD_ANSWER`

**Reducer size:**

```
rg -c "^  \| \{ type: '" contexts/AppContext.tsx   → 98   (declared action types)
rg -c "^    case '"        contexts/AppContext.tsx → 98   (reducer cases)
```

Two declared actions are never dispatched anywhere: `RENAME_CLIENT`
(`AppContext.tsx:104`, case at `:276`) and `RENAME_ASSET_SET`
(`AppContext.tsx:168`, case at `:529`). `LOAD` is dispatched only from inside
`AppContext.tsx:1146`.

**Count per action type** (merging all three shapes; a ternary counts once for
each branch — 186 total):

| Action | n | Writes |
|---|---|---|
| `SET_BODY` | 24 | **CABINET** |
| `MOVE_CONTENT_CARD` | 7 | BOX |
| `ADD_TASK` | 5 | BOX |
| `TOGGLE_AGENDA` | 4 | BOX |
| `SET_LIFECYCLE` | 4 | BOX (`state.clients`) |
| `ADD_PILLAR` | 4 | BOX |
| `ADD_CONTENT_CARD` | 4 | BOX |
| `ADD_AGENDA` | 4 | BOX |
| `UPDATE_PREVIEW_POST` | 3 | BOX |
| `UPDATE_MAP_NODE` | 3 | BOX |
| `UPDATE_CONTENT_CARD` | 3 | BOX |
| `TOGGLE_TASK` | 3 | BOX |
| `EDIT_TASK` | 3 | BOX |
| `DELETE_REFERENCE` | 3 | BOX |
| `ADD_REFERENCE` | 3 | BOX |
| `ADD_OBSERVATION` | 3 | BOX |
| `ADD_CLIENT` | 3 | BOX |
| `ADD_ASSET_SET` | 3 | BOX |
| `ADD_ASSET_ITEM` | 3 | BOX |
| `UPDATE_PILLAR_CARD` | 2 | BOX |
| `UPDATE_PILLAR` | 2 | BOX |
| `UPDATE_LIST_ROW` | 2 | BOX |
| `UPDATE_COLD_CALL` | 2 | BOX |
| `UPDATE_BRAND_KIT` | 2 | BOX |
| `UPDATE_BRAIN_NODE` | 2 | BOX |
| `SYNC_FROM_SERVER` | 2 | **BOTH** (whole-state replace) |
| `SET_PLATFORMS` | 2 | BOX |
| `SET_DRIVE_FOLDER` | 2 | BOX |
| `MOVE_CARD` | 2 | BOX (frozen slice) |
| `DELETE_PILLAR` | 2 | BOX |
| `DELETE_CONTENT_CARD` | 2 | BOX |
| `DELETE_COLD_CALL` | 2 | BOX |
| `DELETE_ASSET_SET` | 2 | BOX |
| `DELETE_ASSET_ITEM` | 2 | BOX |
| `DELETE_AGENDA` | 2 | BOX |
| `ADD_PREVIEW_POST` | 2 | BOX |
| `ADD_MAP_NODE` | 2 | BOX |
| `ADD_LEAD_ANSWER` | 2 | BOX |
| `ADD_CHAT_MESSAGE` | 2 | BOX |
| 56 more types, 1 each | 56 | BOX (except `LOAD`, which is BOTH) |
| | **186** | |

**The single most important number: of the 186 action instances, 24 write the
cabinet (`SET_BODY`), 3 write both (`SYNC_FROM_SERVER` ×2, `LOAD` ×1), and the
remaining 159 write only boxes.**

### 2.2 Every `SET_BODY` call site (the cabinet writers)

`SET_BODY` is the only action whose reducer case touches `body`
(`AppContext.tsx:927-928`).

| File:line | Surface |
|---|---|
| `components/CostumeView.tsx:54` | costume resolution |
| `components/CurationView.tsx:36` | intake curation |
| `components/EngineRoomView.tsx:60` | engine room |
| `components/GateSetView.tsx:31` | gate set |
| `components/IntakeView.tsx:32` | intake |
| `components/ProfileBodyGate.tsx:43` | body gate |
| `components/StrategyDerivationView.tsx:33` | strategy derivation |
| `components/StrategyLockView.tsx:48` | strategy lock |
| `components/SwitchboardView.tsx:43` | switchboard |
| `components/creation/Logs.tsx:247` | log entry add |
| `components/creation/Logs.tsx:260` | log entry done |
| `components/creation/Logs.tsx:318` | note add (body present) |
| `components/intake/Curation.tsx:115` | curation |
| `components/intake/Documents.tsx:99` | intake documents |
| `components/intake/Rounds.tsx:45` | intake rounds |
| `components/mockup/MockupScreen.tsx:60` | profile mockup |
| `components/mockup/MockupScreen.tsx:171` | profile mockup |
| `components/shell/ClientWindows.tsx:142` | client windows |
| `components/shell/ClientWindows.tsx:161` | client windows |
| `components/shell/ClientWindows.tsx:244` | client windows |
| `components/strategy/Decide.tsx:52` | strategy decide |
| `components/strategy/Gates.tsx:42` | strategy gates |
| `components/strategy/Lock.tsx:87` | strategy lock |
| `components/strategy/Switches.tsx:61` | switches |

Note `components/creation/Logs.tsx:313-333`: the *same* user action (writing a
note) branches on whether the profile has a body — `SET_BODY` if it does
(`:318`), `ADD_OBSERVATION` into the box if it does not (`:325`). This is the
only place in the UI that chooses between the two representations.

### 2.3 Reducer cases and the slice each writes

`contexts/AppContext.tsx:204-1071`. 98 cases. Grouped by target:

**Cases that write `ClientData.body` — CABINET (1):**

- `SET_BODY` (`:927-928`) → `body`

**Cases that write the whole state — BOTH (2):**

- `LOAD` (`:212-236`) → every slice, plus a client-side migration that fills
  `contentCards` from `migrateToContentCards(cdata)` when it is `undefined`
  (`:224`). Note `body` passes through untouched via `...cdata`.
- `SYNC_FROM_SERVER` (`:268-269`) → every slice **except `chatLog`**, which is
  kept from local state. This is the action the chat uses to pull the cabinet
  back after `/api/desk-chat` writes it (`components/ChatWidget.tsx:293`,
  `components/shell/Shelf.tsx:158`).

**Cases that write `AppState`-level boxes (24):**

| Case | Line | Slice |
|---|---|---|
| `ADD_CLIENT` | `:238` | `clients`, `clientData` |
| `REMOVE_CLIENT` | `:271` | `clients`, `clientData` |
| `RENAME_CLIENT` | `:276` | `clients` |
| `SET_LIFECYCLE` | `:930` | `clients` |
| `ADD_OBSERVATION` | `:903` | `observations` |
| `UPDATE_OBSERVATION` | `:906` | `observations` |
| `DELETE_OBSERVATION` | `:914` | `observations` |
| `ADD_CHAT_MESSAGE` | `:920` | `chatLog` |
| `ADD_TASK` | `:941` | `personalTasks` |
| `EDIT_TASK` | `:944` | `personalTasks` |
| `TOGGLE_TASK` | `:952` | `personalTasks` |
| `DELETE_TASK` | `:970` | `personalTasks` |
| `ADD_BRAIN_NODE` | `:976` | `brainDump` |
| `UPDATE_BRAIN_NODE` | `:985` | `brainDump` |
| `DELETE_BRAIN_NODE` | `:996` | `brainDump` (cascades edges) |
| `ADD_BRAIN_EDGE` | `:1008` | `brainDump` |
| `DELETE_BRAIN_EDGE` | `:1021` | `brainDump` |
| `SEED_CONTAINER_MAP` | `:1030` | `containerMap` |
| `ADD_MAP_NODE` | `:1035` | `containerMap` |
| `UPDATE_MAP_NODE` | `:1041` | `containerMap` |
| `DELETE_MAP_NODE` | `:1051` | `containerMap` (cascades descendants) |
| `SHARE_PILLAR_CARD` | `:654` | `clientData` across **multiple profiles** |
| `SHARE_CONTENT_CARD` | `:790` | `clientData` across **multiple profiles** |
| `UPDATE_PILLAR_CARD` / `UPDATE_CONTENT_CARD` / `DELETE_PILLAR_CARD` / `DELETE_CONTENT_CARD` | `:605`, `:739`, `:627`, `:759` | own profile **plus every other profile holding a `collabId` twin** |

The last group is the only place a single dispatch writes more than one
profile's data. `changedScopes` handles it correctly (it iterates every profile
id, `scopes.ts:124`), but nothing equivalent exists in the cabinet — `Piece` has
no `collabId`.

**Cases that write `ClientData` boxes (71):** all remaining cases route through
the `updateClient` helper at `AppContext.tsx:206-209`, which spreads a
`Partial<ClientData>` patch onto `state.clientData[id]`. Slice by slice:

| Slice written | Cases |
|---|---|
| `cards` | `ADD_CARD` `:284`, `UPDATE_CARD` `:289`, `DELETE_CARD` `:296`, `MOVE_CARD` `:301` |
| `monthData` | `ADD_AGENDA` `:308`, `TOGGLE_AGENDA` `:317`, `DELETE_AGENDA` `:332`, `UPDATE_AGENDA_TEXT` `:344` |
| `references` | `ADD_REFERENCE` `:359`, `EDIT_REFERENCE` `:364`, `DELETE_REFERENCE` `:373`, `TOGGLE_PIN` `:378` |
| `brand` | `UPDATE_BRAND` `:385` |
| `postTarget` | `SET_POST_TARGET` `:388` |
| `customFields` | `ADD_FIELD` `:391`, `UPDATE_FIELD` `:396`, `DELETE_FIELD` `:403` |
| `evergreenIdeas` | `ADD_EVERGREEN` `:408`, `UPDATE_EVERGREEN` `:413`, `DELETE_EVERGREEN` `:420` |
| `studioCompositions` | `SAVE_STUDIO_COMP` `:425`, `DELETE_STUDIO_COMP` `:434` |
| `brandKit` | `UPDATE_BRAND_KIT` `:439` |
| `coldCalls` | `ADD_COLD_CALL` `:442`, `ADD_COLD_CALLS` `:447`, `UPDATE_COLD_CALL` `:452`, `DELETE_COLD_CALL` `:459` |
| `onboarding` | `SET_ONBOARDING` `:464`, `ADD_ONBOARDING_ITEM` `:467`, `UPDATE_ONBOARDING_ITEM` `:472`, `DELETE_ONBOARDING_ITEM` `:479` |
| `orders` | `ADD_ORDER` `:484`, `UPDATE_ORDER` `:489`, `DELETE_ORDER` `:496` |
| `catalogueCategories`, `catalogueItems` | `ADD_CATALOGUE_CATEGORY` `:501`, `DELETE_CATALOGUE_CATEGORY` `:506` (cascades items), `ADD_CATALOGUE_ITEM` `:514`, `DELETE_CATALOGUE_ITEM` `:519` |
| `assetSets`, `assetItems` | `ADD_ASSET_SET` `:524`, `RENAME_ASSET_SET` `:529`, `DELETE_ASSET_SET` `:536` (cascades items), `ADD_ASSET_ITEM` `:544`, `DELETE_ASSET_ITEM` `:549` |
| `driveFolderUrl` | `SET_DRIVE_FOLDER` `:554` |
| `instagram` | `UPDATE_INSTAGRAM` `:557` |
| `previewPosts` | `ADD_PREVIEW_POST` `:560`, `UPDATE_PREVIEW_POST` `:565`, `DELETE_PREVIEW_POST` `:572` |
| `pillars` (+ `pillarCards`, `contentCards` on delete) | `ADD_PILLAR` `:577`, `UPDATE_PILLAR` `:582`, `DELETE_PILLAR` `:589` |
| `pillarCards` | `ADD_PILLAR_CARD` `:600`, `UPDATE_PILLAR_CARD` `:605`, `DELETE_PILLAR_CARD` `:627`, `SHARE_PILLAR_CARD` `:654` |
| `leadAnswers` | `ADD_LEAD_ANSWER` `:717`, `UPDATE_LEAD_ANSWER` `:722`, `DELETE_LEAD_ANSWER` `:729` |
| `contentCards` | `ADD_CONTENT_CARD` `:734`, `UPDATE_CONTENT_CARD` `:739`, `DELETE_CONTENT_CARD` `:759`, `MOVE_CONTENT_CARD` `:783`, `SHARE_CONTENT_CARD` `:790` |
| `platforms` | `SET_PLATFORMS` `:855` |
| `lists`, `listRows` | `ADD_LIST` `:858`, `UPDATE_LIST` `:863`, `DELETE_LIST` `:868` (cascades rows), `ADD_LIST_ROW` `:874`, `UPDATE_LIST_ROW` `:879`, `DELETE_LIST_ROW` `:884` |
| `journey` | `UPDATE_JOURNEY` `:889` |
| `momentum` | `UPDATE_MOMENTUM` `:892` |
| `topics` | `ADD_TOPIC` `:895` |
| `goals` | `SET_GOALS` `:900` |

**Not one of these 71 cases touches `body`.** Every board move, every agenda
tick, every asset upload, every reference and every preview change writes the
box and leaves the cabinet exactly as migration left it.

### 2.4 API routes that persist

`writeState` is the single Supabase writer for app state
(`lib/supabaseServer.ts:39-45` — an `upsert` of the whole blob onto row
`'manmeet'`). Eight call sites:

| Route | Line | Scoped? | Writes |
|---|---|---|---|
| `app/api/state/route.ts:176` | first save when nothing is stored | No — `normalizeState(incoming)` wholesale | **BOTH** |
| `app/api/state/route.ts:214` | the normal door | Yes — `applyScopes(base, merged, paths)` (`:185`) | **BOTH** (whatever the client declared) |
| `app/api/desk-chat/route.ts:264` | via local `save()` (`:251-265`) | Yes — `checkScopes` `:252`, `applyScopes` `:255` | **CABINET** normally; **BOX** for previews (see below) |
| `app/api/migrate-profile/route.ts:85` | migration apply | Yes — `changedScopes` `:84`, `applyScopes` `:85` | **CABINET** (writes `body` at `:82`) plus one box field: `Client.suggestedSwitches` at `:81` |
| `app/api/intake/skip/route.ts:95` | client "come back to this" | Yes — one path, `:84-88` | **CABINET** (`context/intake`) |
| `app/api/analysis/verdict/route.ts:166` | verdict run | **No** — writes `next` directly, no `applyScopes`, no `checkScopes` | **CABINET** (`body` at `:154`) |
| `app/api/analysis/digest/route.ts:98` | digest publish | **No** — writes `next` directly | **CABINET** (`body` at `:93-95`) |
| `app/api/analysis/digest/route.ts:175` | digest run | **No** — writes `next` directly | **CABINET** (`body` at `:169`) |
| `app/api/share/route.ts:56` | Android share target | **No** — writes the whole blob | **BOX** (`references`, `:53`) |
| `app/api/whatsapp/route.ts:237` | WhatsApp inbox | **No** — writes the whole blob | **BOX** only (see below) |

The three unscoped `writeState` calls in `analysis/` and the two in
`share`/`whatsapp` bypass `applyScopes` entirely, which means they reintroduce
the whole-blob last-write-wins behaviour that `CLAUDE.md` gotcha 2 says was
closed. This is a finding, not part of the mapping question, but it is on the
list of write paths.

**WhatsApp writes only boxes.** `app/api/whatsapp/route.ts:203`/`:216` call
`decide` and then the appliers in `lib/whatsappInbox.ts`:

- `applyMyTask` → `state.personalTasks` (`lib/whatsappInbox.ts:130`)
- `applyClientTask` → `state.personalTasks` **and**
  `clientData[id].monthData[month].agenda` (`lib/whatsappInbox.ts:151`, `:156`)
- `applyObservation` → `state.observations` (`lib/whatsappInbox.ts:170`)
- `applyPhoto` → `clientData[id].assetSets` / `assetItems`
  (`lib/whatsappInbox.ts:200`)

Note this contradicts the declarations: `work-log/logs/tasks` lists
`pipe:whatsapp` in `fed_by` (`declarations.ts:465`) and
`work-log/logs/observations` does the same (`declarations.ts:533`), but the
WhatsApp route never writes either path.

**Routes that persist to other tables (not app state, listed for completeness):**
`app/api/metrics-sync/route.ts` (`:152`, `:180`, `:186`, `:229`, `:246`, `:254`,
`:278`, `:286`, `:326`, `:331`, `:369`, `:373`, `:405`, `:448`, `:504`, `:507`),
`app/api/ig-accounts/route.ts:84`/`:99`, `app/api/ig-tag/route.ts:332`/`:397`,
`app/api/migrate-tracking/route.ts:153`. These write the `ig_*` /
`platform_posts` / `post_observations` pipeline tables, which `CLAUDE.md` names
as the one sanctioned exception to the single-blob rule. Neither box nor cabinet.

Also: `lib/supabaseServer.ts:61` and `:68` write and delete the Canva OAuth row
in the same table under a different row id. Neither box nor cabinet.

### 2.5 `putEntry` / `amendEntry` / `commitBody` / `commitData` outside `lib/desk`

`putEntry` and `amendEntry` are defined at `lib/tree/body.ts:104` and `:154`.
`commitBody` and `commitData` are defined at `lib/desk/write.ts:230` and `:249`
and are called only from `lib/desk` (`write.ts:383`, `:440`, `:531`, `:635`,
`:697`, `:774`, `:814`; `preview.ts:229`) — **no `commitBody`/`commitData` call
exists outside `lib/desk`.**

`putEntry`/`amendEntry` outside `lib/desk`, all writing the **CABINET**:

| File | Lines |
|---|---|
| `lib/tree/migrate.ts` | `:92` (the single `write` helper used by all ~30 migration writes) |
| `lib/strategy/derivation.ts` | `:294`, `:300`, `:314`, `:348`, `:354`, `:411`, `:443`, `:617` |
| `lib/engine/resolve.ts` | `:309`, `:370`, `:533` |
| `lib/engine/handoff.ts` | `:112`, `:189`, `:219`, `:235` |
| `lib/engine/feedback.ts` | `:53`, `:176`, `:260`, `:267`, `:290`, `:345` |
| `lib/engine/recommendations.ts` | `:64` |
| `lib/engine/materials.ts` | `:137`, `:150` |
| `lib/engine/brief.ts` | `:584` |
| `lib/engine/gates.ts` | `:614` |
| `lib/engine/captures.ts` | `:68` |
| `lib/engine/seeds.ts` | `:98`, `:137` |
| `lib/engine/drafts.ts` | `:264`, `:281` |
| `lib/engine/runs.ts` | `:115` |
| `lib/engine/proposals.ts` | `:80` |
| `lib/creation/logs.ts` | `:410`, `:434`, `:519` |
| `lib/intake/curate.ts` | `:66` |
| `lib/intake/rounds.ts` | `:92`, `:97`, `:109`, `:131`, `:153`, `:176`, `:194` |
| `lib/intake/documents.ts` | `:411` |
| `lib/intake/form.ts` | `:314` |
| `lib/mockup/profile.ts` | `:438`, `:453` |
| `lib/analysis/digest.ts` | `:359` |
| `lib/analysis/verdict.ts` | `:369` |
| `lib/analysis/compare.ts` | `:309`, `:325` |
| **`components/SwitchboardView.tsx`** | **`:154`** |
| **`components/shell/ClientWindows.tsx`** | **`:232`, `:239`** |

The last two entries are the only `putEntry` calls **inside React components**.
Everything else in `lib/` returns a new `ProfileBody` that some caller hands to
`SET_BODY` or to a route; these two build the body inline in the component and
then dispatch it (`SwitchboardView.tsx:43` via an `onSave` prop,
`ClientWindows.tsx:244`).

### 2.6 The one place that writes a box through the cabinet's own door

`lib/desk/preview.ts:229` calls `commitData` rather than `commitBody`. Per
`lib/desk/write.ts:248-262`, `commitData` replaces the whole `ClientData` object
instead of just its `body`. So the chat's `make_preview` tool writes the legacy
`previewPosts` slice — a **BOX** — while declaring the cabinet scope path
`work-log/creation/review` (`lib/desk/write.ts:78`, `preview.ts:172`). It also
writes the cabinet in the same commit when it has to create the piece
(`preview.ts:187-191`). This is already noted in
`docs/audit/Chat Command Audit.md:46-48`.

### 2.7 The chat is the largest single drift generator

`components/ChatWidget.tsx` is the clearest illustration of the problem, because
the *same component* writes both representations from different code paths:

- Its own local intent handlers dispatch straight into boxes: `ADD_TASK` `:116`,
  `ADD_AGENDA` `:125`, `ADD_TASK` `:132`, `ADD_CONTENT_CARD` `:150`,
  `ADD_OBSERVATION` `:161`, `ADD_ASSET_SET` `:179`, `ADD_ASSET_ITEM` `:186`,
  `MOVE_CONTENT_CARD` `:200`, `ADD_CHAT_MESSAGE` `:104`.
- When the message routes to the desk instead, it POSTs to `/api/desk-chat`,
  which writes the **cabinet** through `lib/desk/write.ts`, and then pulls the
  result back with `SYNC_FROM_SERVER` (`ChatWidget.tsx:290-294`).

So "add a task for Divine Studio" produces a `monthData` agenda item **or** a
`work-log/logs/tasks` entry, depending on which branch of the widget caught it.
Nothing reconciles the two.

### 2.8 Ranked: the write paths to intercept first

Ranked by how much data actually flows through them. Numbers are the action
instance counts from §2.1.

1. **`updateClient` in `contexts/AppContext.tsx:206-209`.** One helper, 71 of the
   98 reducer cases, essentially every profile-level box write in the app. It is
   the single highest-leverage interception point in the codebase: a projection
   installed here would catch every board move, agenda tick, reference, asset,
   preview and pillar edit in one place, without touching a single component.
2. **`MOVE_CONTENT_CARD` + `ADD_CONTENT_CARD` + `UPDATE_CONTENT_CARD` +
   `DELETE_CONTENT_CARD` + `SHARE_CONTENT_CARD`** (7 + 4 + 3 + 2 + 1 = **17
   instances**, cases at `AppContext.tsx:734`, `:739`, `:759`, `:783`, `:790`).
   This is the daily-use board — the slice with the richest, most divergent
   cabinet counterpart (`Piece`, §1.3), and the one where the box overwrites in
   place while the cabinet is `append_only`. Every drag drifts.
3. **`ADD_AGENDA` + `TOGGLE_AGENDA` + `DELETE_AGENDA` + `UPDATE_AGENDA_TEXT`**
   (4 + 4 + 2 + 1 = **11 instances**, cases at `AppContext.tsx:308`, `:317`,
   `:332`, `:344`). `work-log/logs/tasks` is the one path the chat, the desk and
   the shelf all read (`declarations.ts:466`), so box drift here is immediately
   visible in three surfaces.
4. **`components/ChatWidget.tsx:104-200`** — nine box dispatches in a component
   that *also* drives the cabinet through `/api/desk-chat`. Fixing this one file
   removes the most confusing class of drift, where the same sentence lands in
   different places.
5. **`app/api/whatsapp/route.ts:237` via `lib/whatsappInbox.ts:130`, `:151`,
   `:156`, `:170`, `:200`** — four box writers on a server route with no
   `applyScopes` at all, feeding exactly the paths (`work-log/logs/tasks`,
   `work-log/logs/observations`) that already name `pipe:whatsapp` as a declared
   writer (`declarations.ts:465`, `:533`). The declaration is already in place;
   only the code is missing.
6. **`ADD_OBSERVATION` + `UPDATE_OBSERVATION` + `DELETE_OBSERVATION`** (3 + 1 +
   1 = **5 instances**, cases at `AppContext.tsx:903`, `:906`, `:914`). Small
   volume, but this is the one slice where a read-side merge already exists
   (`lib/creation/logs.ts:470-490`), so the projection has a working precedent
   to copy.
7. **`app/api/share/route.ts:56`** — one unscoped whole-blob write into
   `references`. Low volume, but it is the only write path that can land while
   no tab is open, so it can never be caught by a client-side projection.
8. **`ADD_TASK` + `EDIT_TASK` + `TOGGLE_TASK` + `DELETE_TASK`** (5 + 3 + 3 + 1 =
   **12 instances**) — high volume, but `personalTasks` maps to
   `shelf/today-strip`, declared "A view, never a store" with `history: 'none'`
   (`declarations.ts:26-30`). There is nowhere in the cabinet to project these
   until that declaration is resolved (§1.6). Ranked last for that reason, not
   for lack of traffic.
