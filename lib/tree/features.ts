// The address map — spec 21 §8, made machine-readable.
//
// Every slice of AppState / ClientData, every component, route, API endpoint and
// `ig_*` table alive in the dashboard today appears here exactly once, with the
// folder it writes, the folders it reads, the switch it registers, and its
// disposition. §8.11's orphan check re-runs as a build test: an undeclared slice
// fails the build (law 4).

import type { FeatureDeclaration } from './contract.ts';

const F = (f: FeatureDeclaration): FeatureDeclaration => f;

export const FEATURES: FeatureDeclaration[] = [
  // ── 8.1 Profiles and access ───────────────────────────────────────────────
  F({
    id: 'shelf.clients', today: 'clients[], app/clients (client list home)',
    writes: 'shelf/profiles', reads: [], switch: 'shelf.profiles', state: 'active',
    slices: ['state.clients'],
    note: 'Becomes the shelf (PLAN §2). Cards show status, never content.',
  }),
  F({
    id: 'profile.bodies', today: 'clientData{}', writes: null, reads: [],
    switch: 'spine.fixed', state: 'active', slices: ['state.clientData', 'clientData.body'],
    note: 'The container. Each profile’s path-addressed body lives at clientData[id].body.',
  }),
  F({
    id: 'access.resolver', today: 'lib/access.ts role filtering', writes: null,
    reads: ['context/content-strategy/toolset', 'shelf/profiles'],
    switch: 'spine.fixed', state: 'active', slices: ['state.bindings'],
    note: 'Rewritten (§6): derives from bindings + switch audience + client_door + lifecycle.',
  }),
  F({
    id: 'access.legacy_name_matchers', today: 'RESTRICTED_MATCHERS name regexes',
    writes: null, reads: [], switch: 'frozen.legacy', state: 'deleted',
    note: 'Deleted — access binds by profile id. The regexes survive only as one-time migration seed.',
  }),
  F({
    id: 'access.login', today: 'lib/auth.ts passcode + cookie', writes: null,
    reads: ['shelf/profiles'], switch: 'client_access.login', state: 'active',
    note: 'Per-profile revocation joins the lifecycle (S22).',
  }),
  F({
    id: 'myday.client_tasks', today: 'app/me My Day — client-task half',
    writes: 'work-log/logs/tasks', reads: ['work-log/logs/tasks'],
    switch: 'shelf.today_strip', state: 'active', slices: ['state.personalTasks'],
    note: 'The one cross-profile window (PLAN §2).',
  }),
  F({
    id: 'myday.personal', today: 'app/me My Day — personal half, day tracking',
    writes: 'leaves/my-day-personal', reads: [], switch: 'leaves.exported', state: 'leaves',
    note: 'PLAN §7. Frozen export bundle to the vault; removed only on her word.',
  }),

  // ── 8.2 context/intake ────────────────────────────────────────────────────
  F({
    id: 'intake.onboarding', today: 'onboarding[], OnboardingView, client/[id]/onboarding',
    writes: 'context/intake/answers', reads: ['context/intake/questions'],
    switch: 'intake.questionnaire', state: 'migrated', slices: ['clientData.onboarding'],
    note: 'Imported as round 0, immutable (S11); questions marked legacy, flagged for regeneration.',
  }),
  F({
    id: 'intake.parameter_questions', today: 'spec 08’s 16-question sheet (never built)',
    writes: 'context/intake/questions', reads: ['context/personal-details', 'context/business-details'],
    switch: 'intake.questionnaire', state: 'declared',
    note: 'The inventory is owed by her vocabulary session — spec 21 ships the contract only (Q4).',
  }),
  F({
    id: 'intake.finding_session', today: 'recorded meeting / Finding Session (no code today)',
    writes: 'context/intake/answers', reads: [], switch: 'intake.finding_session', state: 'declared',
  }),
  F({
    id: 'intake.rounds', today: '— (S10)', writes: 'context/intake', reads: [],
    switch: 'intake.rounds_reopen', state: 'declared',
  }),
  // ── Spec 22 — intake and context ──────────────────────────────────────────
  F({
    id: 'intake.inventory', today: 'lib/intake/parameters.ts, IntakeView',
    writes: 'context/intake/questions',
    reads: ['context/personal-details', 'context/business-details'],
    switch: 'intake.questionnaire', state: 'active',
    note: 'The 41-row parameter inventory (spec 22 §4), universal like the costume variables. Ships vocabulary: draft — no round reaches a client before her vocabulary pass.',
  }),
  F({
    id: 'intake.round_zero_mapping', today: 'lib/intake/roundZero.ts',
    writes: 'context/intake/answers',
    reads: ['context/intake/answers', 'context/intake/questions'],
    switch: 'intake.questionnaire', state: 'active',
    note: 'Proposes the parameter each legacy answer belongs to and queues it for her. It never writes a curated value (spec 22 §13).',
  }),
  F({
    id: 'intake.curation_surface', today: 'CurationView, client/[id]/curation',
    writes: 'context/personal-details',
    reads: ['context/intake/answers', 'context/business-details'],
    switch: 'intake.curation', state: 'active',
    note: 'Raw on the left, the curated value on the right, one parameter at a time. Every value carries S11 provenance or the write is refused.',
  }),
  F({
    id: 'intake.reminders', today: '— (declared, unbuilt)', writes: 'context/intake', reads: [],
    switch: 'intake.reminders', state: 'declared',
    note: 'She chases clients on WhatsApp today and that keeps working.',
  }),
  F({
    id: 'strategy.derivation_surface', today: 'StrategyDerivationView, client/[id]/strategy',
    writes: 'context/content-strategy',
    reads: ['context/personal-details', 'context/business-details', 'work-log/references/from-client'],
    switch: 'strategy.derivation', state: 'active',
    note: 'Sources, decision, reason. No AI writes here (PLAN §3.4: derived by her).',
  }),
  F({
    id: 'strategy.gate_set_surface', today: 'GateSetView',
    writes: 'context/content-strategy/gates',
    reads: ['context/content-strategy/voice', 'context/content-strategy/positioning'],
    switch: 'strategy.gate_set', state: 'active',
    note: 'Five brand gates derived from strategy, plus the two fixed operational gates (S14).',
  }),
  F({
    id: 'strategy.switchboard_surface', today: 'SwitchboardView',
    writes: 'context/content-strategy/toolset',
    reads: ['context/content-strategy/platforms', 'work-log/creation/channels'],
    switch: 'strategy.switchboard', state: 'active',
    note: 'Every switch with its suggested default, its cascade set, and the strategy decision it derives from.',
  }),
  F({
    id: 'strategy.lock_action', today: 'StrategyLockView, lib/strategy/derivation.ts',
    writes: 'context/content-strategy',
    reads: ['context/content-strategy/toolset', 'context/content-strategy/gates',
      'work-log/creation/channels'],
    switch: 'strategy.lock', state: 'active',
    note: 'One act, six refusal conditions, no partial lock. It opens creation (spec 22 §8.6, §8.7).',
  }),

  // ── 8.3 personal-details / business-details ───────────────────────────────
  F({
    id: 'context.curation', today: 'her curation (no code today)',
    writes: 'context/personal-details', reads: ['context/intake/answers'],
    switch: 'spine.fixed', state: 'declared',
    note: 'Every curated value carries S11 provenance.',
  }),
  F({
    id: 'business.offers', today: 'brand.services[] (Brand tab)',
    writes: 'context/business-details/offers', reads: [], switch: 'spine.fixed', state: 'migrated',
    slices: ['clientData.brand.services'],
  }),
  F({
    id: 'business.audience', today: 'brand.audience',
    writes: 'context/business-details/audience-raw',
    reads: [], switch: 'spine.fixed', state: 'migrated', slices: ['clientData.brand.audience'],
    note: 'Migrated with confidence: legacy-unverified — the raw/decided split does not exist in the old field.',
  }),

  // ── 8.4 context/content-strategy ──────────────────────────────────────────
  F({
    id: 'strategy.pillars', today: 'pillars[] (ContentPillar: name, color, job, targetPct, purpose)',
    writes: 'context/content-strategy/pillars', reads: [], switch: 'strategy.fixed', state: 'migrated',
    slices: ['clientData.pillars'],
    note: 'Migrated as entry folders (law 2). jobChangedAt becomes the job-regime version S15 snapshots.',
  }),
  F({
    id: 'strategy.platforms', today: 'platforms[] (string list), DEFAULT_PLATFORMS',
    writes: 'context/content-strategy/platforms', reads: [], switch: 'strategy.fixed', state: 'migrated',
    slices: ['clientData.platforms'],
    note: 'The cascade parents. Each platform becomes a folder with formats inside it.',
  }),
  F({
    id: 'strategy.formats', today: 'DEFAULT_CONTENT_TYPES, ContentCard.contentType',
    writes: 'context/content-strategy/platforms/*/formats', reads: [],
    switch: 'strategy.fixed', state: 'migrated',
    note: 'The global format list splits per platform; a piece resolves exactly one (S17).',
  }),
  F({
    id: 'strategy.visual_branding', today: 'brandKit (colors, fonts, logos), BrandView',
    writes: 'context/content-strategy/visual-branding', reads: [],
    switch: 'strategy.visual_branding', state: 'migrated', slices: ['clientData.brandKit'],
  }),
  F({
    id: 'strategy.positioning', today: 'brand.tagline, brand.strategy',
    writes: 'context/content-strategy/positioning',
    reads: ['context/personal-details', 'context/business-details'],
    switch: 'strategy.fixed', state: 'migrated',
    slices: ['clientData.brand.tagline', 'clientData.brand.strategy'],
    note: 'Migrated as legacy text pending derivation.',
  }),
  F({
    id: 'strategy.goals', today: 'goals[] (ClientGoal), brand.goals, journey.northStar/targetValue/targetDate',
    writes: 'context/content-strategy/goals', reads: [], switch: 'strategy.fixed', state: 'migrated',
    slices: ['clientData.goals', 'clientData.brand.goals', 'clientData.journey'],
    note: 'Each goal must carry an S16 metric declaration before analysis reads it.',
  }),
  F({
    id: 'strategy.cadence', today: 'postTarget', writes: 'context/content-strategy/cadence',
    reads: [], switch: 'strategy.fixed', state: 'migrated', slices: ['clientData.postTarget'],
  }),
  F({
    id: 'strategy.working_mode', today: 'working mode / posting ownership (no code today)',
    writes: 'context/content-strategy/working-mode', reads: [], switch: 'strategy.fixed',
    state: 'declared', note: 'Includes the S20 review configuration.',
  }),
  F({
    id: 'strategy.toolset', today: '— (the switch registry)',
    writes: 'context/content-strategy/toolset', reads: ['context/content-strategy'],
    switch: 'strategy.fixed', state: 'active',
  }),
  F({
    id: 'strategy.reserved', today: '— (declared by the plan, no code today)',
    writes: 'context/content-strategy', reads: [], switch: 'strategy.fixed', state: 'declared',
    note: 'proof-library, boundaries, ctas, funnel-shape, voice, obligations — addresses reserved so later specs cannot invent second homes.',
  }),
  F({
    id: 'strategy.gates', today: 'gate config (no code today)',
    writes: 'context/content-strategy/gates',
    reads: ['context/content-strategy/voice', 'context/content-strategy/positioning'],
    switch: 'strategy.fixed', state: 'declared', note: 'Versioned v1 gate set, locked with strategy (S14).',
  }),
  F({
    id: 'legacy.custom_fields', today: 'customFields[] / customValues{}',
    writes: 'frozen/custom-fields', reads: [], switch: 'frozen.legacy', state: 'frozen',
    slices: ['clientData.customFields'],
    note: 'Free-form per-client fields contradict law 2. Values stay readable.',
  }),

  // ── 8.5 creation — seeds and pieces ───────────────────────────────────────
  F({
    id: 'creation.topics', today: 'topics[] (Topic, spec 04)', writes: 'work-log/creation/topics',
    reads: [], switch: 'creation.engine', state: 'migrated', slices: ['clientData.topics'],
    note: 'Migrated as seed-capture INPUT, not as seeds (S24): draft shells awaiting her narration.',
  }),
  F({
    id: 'creation.evergreen', today: 'evergreenIdeas[], EvergreenView (route retired)',
    writes: 'work-log/creation/topics', reads: [], switch: 'creation.engine', state: 'migrated',
    slices: ['clientData.evergreenIdeas'],
  }),
  F({
    id: 'creation.pieces', today: 'contentCards[] (ContentCard), ContentView Board/Pillars/Table, CardEditor',
    writes: 'work-log/creation',
    reads: ['context/content-strategy/pillars', 'context/content-strategy/platforms',
      'context/content-strategy/voice', 'context/content-strategy/visual-branding',
      'work-log/assets/sets', 'work-log/references'],
    switch: 'creation.board', state: 'migrated', slices: ['clientData.contentCards'],
    note: 'THE canonical piece. Stages: idea→idea, writing(Making)→build, ready→approved, scheduled, posted. `review` has no legacy data.',
  }),
  F({
    id: 'legacy.kanban_cards', today: 'cards[] (KanbanCard), KanbanView, client/[id]/kanban',
    writes: 'frozen/legacy-cards', reads: [], switch: 'frozen.legacy', state: 'frozen',
    slices: ['clientData.cards'],
    note: 'The dormant 2026-07-10 safety copy. Do not read, do not migrate twice.',
  }),
  F({
    id: 'legacy.pillar_cards', today: 'pillarCards[] (PillarCard), PillarsView, client/[id]/pillars',
    writes: 'frozen/legacy-cards', reads: [], switch: 'frozen.legacy', state: 'frozen',
    slices: ['clientData.pillarCards'],
  }),
  F({
    id: 'creation.repurpose', today: 'ContentCard.topicId (Repurpose)',
    writes: 'work-log/creation', reads: ['work-log/creation/topics'],
    switch: 'creation.engine', state: 'migrated',
    note: 'Becomes the seed reference on the piece (S1: pieces reference seeds).',
  }),
  F({
    id: 'analysis.experiment_flag', today: 'ContentCard.experiment { hypothesis }',
    writes: 'work-log/analysis/comparisons', reads: [], switch: 'analysis.compare', state: 'migrated',
    note: 'Migrated to the S5 matched-comparison shape; unknown fields marked unknown, never inferred.',
  }),
  F({
    id: 'legacy.card_role', today: 'ContentCard.role (brand/value/general)',
    writes: 'frozen/card-role', reads: [], switch: 'frozen.legacy', state: 'frozen',
    note: 'Pillar jobs superseded it.',
  }),
  // ── Spec 23 — the Engine Room and the seed bank ───────────────────────────
  F({
    id: 'creation.engine_room', today: 'EngineRoomView, client/[id]/engine, lib/engine/seeds.ts',
    writes: 'work-log/creation/topics',
    reads: ['context', 'work-log/creation', 'work-log/creation/topics/captures'],
    switch: 'creation.engine', state: 'active',
    note: 'The brainstorm space (PLAN §3.10): the open box, the seed bank shelf, the seed sheet, the ladder and the six lock gates. It serves, it never rails.',
  }),
  F({
    id: 'creation.seed_captures', today: 'lib/engine/captures.ts, the capture box',
    writes: 'work-log/creation/topics/captures', reads: ['context/intake/answers'],
    switch: 'creation.engine', state: 'active',
    note: 'Append-only, verbatim, forever. Written BEFORE the model is called, so a failed run never loses what she said.',
  }),
  F({
    id: 'creation.seed_extraction', today: 'lib/engine/extraction.ts, app/api/engine/extract',
    writes: 'work-log/creation/topics/proposals',
    reads: ['context', 'work-log/creation/topics', 'work-log/creation/topics/captures'],
    switch: 'creation.seed_extraction', state: 'active',
    note: 'The claude-opus-5 call: the context packet, PROPOSAL_SCHEMA, and the six checks (spec 23 §5).',
  }),
  F({
    id: 'creation.seed_proposals', today: 'lib/engine/proposals.ts, the proposal cards',
    writes: 'work-log/creation/topics/proposals', reads: ['work-log/creation/topics'],
    switch: 'creation.engine', state: 'active',
    note: 'Marked ENGINE PROPOSED and untouchable until she picks them up, enforced at the write door (PLAN §5.2).',
  }),
  F({
    id: 'logs.engine_runs', today: 'lib/engine/runs.ts',
    writes: 'work-log/logs/engine-runs', reads: ['work-log/logs/feedback'],
    switch: 'logs.engine_runs', state: 'active',
    note: 'One entry per run — success, refusal or error. S12’s per-output log.',
  }),
  F({
    id: 'logs.feedback', today: 'lib/engine/feedback.ts',
    writes: 'work-log/logs/feedback', reads: [], switch: 'logs.feedback', state: 'active',
    note: 'Scoped and routed, never piled (S13). Below-the-bar marks and dismissal reasons.',
  }),
  F({
    id: 'creation.client_seed_input', today: 'the intake parameter "client-ideas"',
    writes: null, reads: ['context/intake/answers'],
    switch: 'creation.seed_input_client', state: 'active',
    note: 'Spec 23 §10: a working-mode flag, not a door. It writes nothing — the client’s idea lands at context/intake/answers and HER curation births the seed.',
  }),

  // ── Spec 24 — the costume, the brief, format rules, materials, handoffs ────
  F({
    id: 'creation.costume_surface',
    today: 'CostumeView, client/[id]/engine/costume/[seedId], lib/engine/costume.ts',
    writes: 'work-log/creation',
    reads: [
      'work-log/creation/topics', 'context/content-strategy/pillars',
      'context/content-strategy/platforms', 'context/content-strategy/ctas',
      'context/content-strategy/voice', 'context/content-strategy/proof-library',
    ],
    switch: 'creation.costume', state: 'active',
    note: 'The request layer of the Engine Room: twelve dimensions, multi-select everywhere, the variant grid. It enumerates freely and writes nothing until she confirms (PLAN §3.10).',
  }),
  F({
    id: 'creation.costume_resolve', today: 'lib/engine/resolve.ts',
    writes: 'work-log/creation',
    reads: ['work-log/creation/topics', 'context/content-strategy/pillars',
      'context/content-strategy/goals', 'context/content-strategy/gates'],
    switch: 'creation.costume', state: 'active',
    note: 'S4 resolution: one piece per confirmed row, at stage build, with the S15 birth snapshot that is never rewritten.',
  }),
  F({
    id: 'creation.format_rules', today: 'lib/engine/formats.ts',
    writes: 'context/content-strategy/platforms/*/rules',
    reads: ['context/content-strategy/platforms/*/formats'],
    switch: 'creation.format_overrides', state: 'active',
    note: 'The universal library plus resolveFormatRule. Override beats universal, FIELD BY FIELD, and the merged rule always reports which fields came from where (PLAN §5.1).',
  }),
  F({
    id: 'creation.brief', today: 'lib/engine/brief.ts, app/api/engine/brief',
    writes: 'work-log/creation/making/briefs',
    reads: ['context', 'work-log/creation', 'work-log/creation/topics'],
    switch: 'creation.brief', state: 'active',
    note: 'The claude-opus-5 call PLAN §5.1 puts BEFORE any copy. Every prose field carries a hard schema cap, which is what stops a brief becoming a draft (spec 24 §6.6).',
  }),
  F({
    id: 'creation.materials', today: 'lib/engine/materials.ts',
    writes: 'work-log/creation',
    reads: ['work-log/assets/sets', 'work-log/references',
      'context/content-strategy/proof-library'],
    switch: 'creation.materials', state: 'active',
    note: 'Attached by REFERENCE, never copied (PLAN §3.11). The S21 rights check runs at attachment, against the piece’s resolved platform.',
  }),
  F({
    id: 'creation.handoff', today: 'lib/engine/handoff.ts',
    writes: 'work-log/creation/making/handoffs',
    reads: ['work-log/creation', 'work-log/creation/making/briefs', 'work-log/assets/sets'],
    switch: 'creation.making_handoff', state: 'active',
    note: 'S18’s contract, manual route first and it is not a lesser route. Canva becomes its first API implementation, not a special case.',
  }),
  F({
    id: 'analysis.comparison_birth', today: 'lib/engine/resolve.ts (the matched-comparison offer)',
    writes: 'work-log/analysis/comparisons',
    reads: ['work-log/creation'],
    switch: 'analysis.compare', state: 'active',
    note: 'Spec 24 §5.6: held and changed variables are knowable only at resolve, so this is the only honest moment. Everything after birth is the Analysis family’s.',
  }),
  // Spec 24 §10 reserves the ADDRESS for analysis's costume recommendations and
  // builds no mechanism: a recommendation is a hint on a picker, never a
  // pre-selection, and it carries its cited verdict or it is refused at the
  // write door. Its own path is spec 25's law-4 addition
  // (`creation/costume-recommendations/`), so this spec does not pre-declare it —
  // a reserved address with no code and no store is prose, not a registry row.
  // What this spec DOES build is the pick-up half: spec 23's `revisit-seed`
  // proposal opens the costume surface on the named locked seed with the cited
  // costume pre-selected (`prefillFromRecommendation`, lib/engine/costume.ts).

  // ── Spec 25 — drafting, the seven gates, the feedback memory, taste ───────
  F({
    id: 'creation.drafting', today: 'lib/engine/drafting.ts, app/api/engine/draft',
    writes: 'work-log/creation/making',
    reads: ['context', 'work-log/creation', 'work-log/creation/topics',
      'work-log/creation/making/briefs', 'owner/taste-rules'],
    switch: 'creation.drafting', state: 'active',
    note: 'DRAFT_SCHEMA is a discriminated union on format family, so a carousel cannot BE an essay — her slide law is structural, not an instruction. Her hook, when present, survives verbatim or the draft is rejected and retried once.',
  }),
  F({
    id: 'creation.draft_versions', today: 'lib/engine/drafts.ts',
    writes: 'work-log/creation/making',
    reads: ['work-log/creation', 'work-log/creation/making/briefs'],
    switch: 'creation.making', state: 'active',
    note: 'Append-only versions. Her edit never overwrites version n; it creates n+1 with an edit delta, which is the byproduct the taste layer reads.',
  }),
  F({
    id: 'creation.gate_runs', today: 'lib/engine/gates.ts, app/api/engine/gate',
    writes: 'work-log/creation/making/gate-runs',
    reads: ['context/content-strategy/gates', 'context/content-strategy/boundaries',
      'context/content-strategy/voice', 'context/content-strategy/proof-library',
      'work-log/creation', 'work-log/creation/making'],
    switch: 'creation.gates', state: 'active',
    note: 'Machine checks first; if a hard one fails the model call is never made. The reviewer is a SEPARATE call — a model grading its own output in the same turn is not a check.',
  }),
  F({
    id: 'creation.rights_gate', today: 'lib/engine/gates.ts (rightsClearedAt)',
    writes: null,
    reads: ['work-log/assets/sets', 'context/content-strategy/proof-library',
      'work-log/creation/scheduling'],
    switch: 'creation.rights_gate', state: 'active',
    note: 'S21. Blocks approved → scheduled, never build → review, and judges expiry against the SCHEDULED date rather than today.',
  }),
  F({
    id: 'creation.client_preview', today: 'clientPreviewOf, lib/engine/drafts.ts',
    writes: null, reads: ['work-log/creation/making'],
    switch: 'creation.review', state: 'active',
    note: 'A server-side WHITELIST projection, never a copy (PLAN §3.11) and never a blacklist — a blacklist leaks the day someone adds a field and forgets.',
  }),
  F({
    id: 'creation.feedback_memory', today: 'lib/engine/feedback.ts',
    writes: 'work-log/logs/feedback',
    reads: ['work-log/creation/review', 'work-log/creation/making', 'work-log/creation/topics'],
    switch: 'logs.feedback', state: 'active',
    note: 'S13: five classes, her confirmation required before anything routes, every durable route a proposed diff she accepts or rejects. Nothing applies automatically, ever.',
  }),
  F({
    id: 'creation.post_learning', today: 'the one prompt on a posted piece',
    writes: 'work-log/logs/feedback', reads: ['work-log/creation'],
    switch: 'creation.post_learning', state: 'active',
    note: 'Optional, dismissible, never a chore. Most performance-class feedback lands here.',
  }),
  F({
    id: 'creation.costume_recommendations', today: 'lib/engine/recommendations.ts',
    writes: 'work-log/creation/costume-recommendations',
    reads: ['work-log/creation'],
    switch: 'creation.engine', state: 'active',
    note: 'Spec 25 §9.5 reserves the address and fixes the two rules the Analysis family must honour: evidence required at the write door for a verdict-sourced entry, and a recommendation never selects anything.',
  }),
  F({
    id: 'owner.taste_rules', today: 'lib/engine/taste.ts, tasteRules[]',
    writes: 'owner/taste-rules', reads: ['work-log/creation/making', 'work-log/logs/feedback'],
    switch: 'owner.taste_rules', state: 'active', slices: ['state.tasteRules'],
    note: 'Spec 10 re-cut with the leak guard the original did not have: what crosses a profile boundary is HER instruction, de-identified and accepted one at a time; a client’s data never crosses at all.',
  }),

  // ── 8.6 making, review, scheduling, distribution ──────────────────────────
  F({
    id: 'creation.drafts', today: 'draft body on the card (content, hook, link)',
    writes: 'work-log/creation/making',
    reads: ['context/content-strategy/voice', 'context/content-strategy/visual-branding',
      'work-log/assets/sets', 'work-log/references'],
    switch: 'creation.making', state: 'migrated',
    note: 'Versions are kept from now on; today they are overwritten.',
  }),
  F({
    id: 'creation.canva', today: 'lib/canva.ts, app/api/canva/* (parked)',
    writes: 'work-log/creation/making', reads: ['work-log/creation'],
    switch: 'creation.making_handoff', state: 'declared',
    note: 'The first implementation of the S18 handoff contract, not a special case.',
  }),
  F({
    id: 'legacy.studio', today: 'StudioComposition[], StudioView, StudioFreeform, StudioTemplates',
    writes: 'frozen/studio', reads: [], switch: 'frozen.legacy', state: 'frozen',
    slices: ['clientData.studioCompositions'],
  }),
  F({
    id: 'creation.previews', today: 'previewPosts[], PreviewsView, InstagramPost, app/p/[shareId], app/api/share',
    writes: 'work-log/creation/review', reads: ['work-log/creation', 'work-log/creation/channels'],
    switch: 'creation.review', state: 'migrated', slices: ['clientData.previewPosts'],
    note: 'Give-point 3. Public links survive behind creation.review_public_link (PLAN §11 Q2).',
  }),
  F({
    id: 'creation.review_verdict', today: 'client verdict (no structured capture today)',
    writes: 'work-log/creation/review', reads: ['context/content-strategy/working-mode'],
    switch: 'creation.review', state: 'declared',
    note: 'Out-of-scope asks auto-route to logs/changes (S20).',
  }),
  F({
    id: 'creation.review_perception', today: 'client perception note at review',
    writes: 'work-log/analysis/client-perception', reads: [],
    switch: 'creation.review_perception', state: 'declared',
  }),
  F({
    id: 'creation.scheduling', today: 'ContentCard.scheduledDate, calendar / My Day surfacing',
    writes: 'work-log/creation/scheduling',
    reads: ['context/content-strategy/cadence', 'context/content-strategy/goals'],
    switch: 'creation.scheduling', state: 'migrated',
  }),
  F({
    id: 'creation.publishing', today: 'spec 14B publish-from-dashboard (unbuilt)',
    writes: 'work-log/creation/scheduling', reads: ['work-log/creation/channels'],
    switch: 'creation.publishing', state: 'declared',
  }),
  F({
    id: 'creation.channels', today: 'instagram (InstagramProfile), ig_accounts identity, ConnectionsView, app/api/ig-accounts',
    writes: 'work-log/creation/channels', reads: [], switch: 'creation.channels', state: 'migrated',
    slices: ['clientData.instagram'],
    note: 'Splits into channel identity vs platform connection (S17).',
  }),
  F({
    id: 'creation.channel_notes', today: 'journey.channels[] (JourneyChannel)',
    writes: 'work-log/creation/channels', reads: [], switch: 'creation.channels', state: 'migrated',
  }),
  F({
    id: 'creation.lead_answers', today: 'leadAnswers[], AnswersView, lib/divineLeadSeed.ts',
    writes: 'work-log/creation/funnel/replies',
    reads: ['context/content-strategy/ctas', 'context/content-strategy/boundaries',
      'context/business-details/offers'],
    switch: 'creation.funnel_replies', state: 'migrated', slices: ['clientData.leadAnswers'],
    note: 'The scripts the body holds (PLAN §1). Not analytics (S23).',
  }),
  F({
    id: 'creation.funnel', today: 'funnel chaining (no code today)',
    writes: 'work-log/creation/funnel',
    reads: ['context/content-strategy/funnel-shape', 'context/content-strategy/ctas'],
    switch: 'creation.funnel', state: 'declared',
  }),
  F({
    id: 'analysis.post_link_join', today: 'lib/igShortcode.ts, spec 14A auto-mark-posted matcher',
    writes: 'work-log/creation', reads: ['work-log/analysis/study-own-data'],
    switch: 'analysis.tracking', state: 'active',
    note: 'The join that keeps ONE piece identity (S2).',
  }),

  // ── 8.7 assets and references ─────────────────────────────────────────────
  F({
    id: 'assets.library', today: 'assetSets[], assetItems[], AssetsView, app/api/upload, upload/sign',
    writes: 'work-log/assets/sets', reads: [], switch: 'assets.library', state: 'migrated',
    slices: ['clientData.assetSets', 'clientData.assetItems'],
    note: 'Every item gains the S21 rights record.',
  }),
  F({
    id: 'assets.drive_videos', today: 'driveFolderUrl (Videos tile)',
    writes: 'work-log/assets/sets', reads: [], switch: 'assets.drive_videos', state: 'migrated',
    slices: ['clientData.driveFolderUrl'],
  }),
  F({
    id: 'assets.share_target', today: 'app/share-target (Android share-to-save)',
    writes: 'work-log/assets/sets', reads: [], switch: 'assets.share_target', state: 'active',
  }),
  F({
    id: 'assets.whatsapp_photos', today: 'WhatsApp photo routing (lib/whatsappInbox.ts, parked)',
    writes: 'work-log/assets/sets', reads: [], switch: 'assets.whatsapp_intake', state: 'declared',
  }),
  F({
    id: 'assets.catalogue', today: 'catalogueCategories[], catalogueItems[], CatalogueView, PDF export',
    writes: 'work-log/assets/sets', reads: ['work-log/assets/sets'],
    switch: 'assets.catalogue_export', state: 'migrated',
    slices: ['clientData.catalogueCategories', 'clientData.catalogueItems'],
    note: 'PLAN §7: the catalogue becomes an assets use-case behind a switch — it does not die.',
  }),
  F({
    id: 'references.library', today: 'references[], ReferencesView',
    writes: 'work-log/references/our-vision', reads: [], switch: 'references.our_vision',
    state: 'migrated', slices: ['clientData.references'],
    note: 'Legacy rows carry no source signal: they migrate to our-vision marked source unknown, with a one-time sort queue. Never attributed to the client without evidence.',
  }),

  // ── 8.8 logs ──────────────────────────────────────────────────────────────
  F({
    id: 'logs.agenda', today: 'monthData[month].agenda[], DashboardView',
    writes: 'work-log/logs/tasks', reads: [], switch: 'logs.tasks', state: 'migrated',
    slices: ['clientData.monthData'],
  }),
  F({
    id: 'logs.task_sync', today: 'personalTasks with taskType client-task / content (spec 01)',
    writes: 'work-log/logs/tasks', reads: ['work-log/creation'], switch: 'logs.tasks', state: 'active',
    note: 'One truth, two views. A content task READS the piece’s stage, never copies it (S2).',
  }),
  F({
    id: 'logs.chat_task_route', today: 'chat / WhatsApp #client #task routing',
    writes: 'work-log/logs/tasks', reads: [], switch: 'logs.tasks', state: 'active',
  }),
  F({
    id: 'logs.decisions', today: 'decisions (no structured home today)',
    writes: 'work-log/logs/decisions', reads: [], switch: 'logs.decisions', state: 'declared',
  }),
  F({
    id: 'logs.requests', today: 'special demands / non-standing asks',
    writes: 'work-log/logs/requests', reads: [], switch: 'logs.requests', state: 'declared',
  }),
  F({
    id: 'logs.changes', today: 'standing-agreement changes; out-of-scope review asks (S20)',
    writes: 'work-log/logs/changes', reads: ['work-log/creation/review'],
    switch: 'logs.changes', state: 'declared',
  }),
  F({
    id: 'logs.lists', today: 'lists[], listRows[], ListsView, spec 12 sharing',
    writes: 'work-log/logs/pipelines/lists', reads: [], switch: 'logs.pipelines.lists',
    state: 'migrated', slices: ['clientData.lists', 'clientData.listRows'],
    note: 'The cross-profile share window keeps its server-side verification.',
  }),
  F({
    id: 'logs.cold_calls', today: 'coldCalls[], ColdCallsView',
    writes: 'work-log/logs/pipelines/cold-calls', reads: [],
    switch: 'logs.pipelines.cold_calls', state: 'migrated', slices: ['clientData.coldCalls'],
    note: 'Response notes are also a market signal read by business-details/market.',
  }),
  F({
    id: 'logs.orders', today: 'orders[], OrdersView (Sonia)',
    writes: 'work-log/logs/pipelines/orders', reads: [], switch: 'logs.pipelines.orders',
    state: 'migrated', slices: ['clientData.orders'],
  }),
  F({
    id: 'logs.effort', today: 'momentum (MomentumData, spec 11), MomentumMeter, app/api/momentum-read',
    writes: 'work-log/logs/effort', reads: ['work-log/creation'], switch: 'logs.effort_meter',
    state: 'migrated', slices: ['clientData.momentum'],
    note: 'Active ONLY where owner_kind is `hers` (PLAN §7).',
  }),
  F({
    id: 'logs.effort_money', today: 'momentum.monthlyValue, extraValue (spec 16)',
    writes: 'work-log/logs/effort', reads: ['work-log/logs/effort'], switch: 'logs.effort_money',
    state: 'migrated',
  }),
  F({
    id: 'logs.observations_tagged', today: 'observations[] — entries WITH a client tag',
    writes: 'work-log/logs/observations', reads: [], switch: 'logs.observations', state: 'migrated',
    slices: ['state.observations'],
  }),
  F({
    id: 'logs.observations_untagged', today: 'observations[] — entries with NO client tag',
    writes: 'frozen/observations-inbox', reads: [], switch: 'owner.chat', state: 'frozen',
    note: 'PLAN §11 Q1: HELD with the chat. Not migrated, not moved, still working as today.',
  }),

  // ── 8.9 analysis ──────────────────────────────────────────────────────────
  F({
    id: 'analysis.ig_sync', today: 'app/api/ig-sync — a thin redirect to /api/metrics-sync',
    writes: 'work-log/analysis/study-own-data', reads: ['work-log/creation/channels'],
    switch: 'analysis.tracking', state: 'history',
    note: 'Spec 26 §6.1: superseded by analysis.metrics_sync. The route stays for one release so the live cron entry cannot break mid-cutover; it forwards and writes nothing itself.',
  }),
  F({
    id: 'analysis.post_links', today: 'ig_post_links (spec 03) → post_links',
    writes: 'work-log/analysis/study-own-data/links', reads: ['work-log/creation'],
    switch: 'analysis.tracking', state: 'active',
    note: 'Spec 26 §8: re-keyed to the canonical piece identity, with `legacy-card` kept for profiles that have not migrated. Neither kind is ever guessed into the other.',
  }),
  F({
    id: 'analysis.ai_tags', today: 'ig_post_tags, app/api/ig-tag (spec 06)',
    writes: 'work-log/analysis/study-own-data', reads: ['work-log/analysis/study-own-data'],
    switch: 'analysis.ai_tagging_fallback', state: 'active',
    note: 'FALLBACK only — the piece’s own pillar and costume are the primary tag source.',
  }),
  F({
    id: 'analysis.views', today: 'app/api/ig-metrics, app/api/analytics, AnalyticsView, client/[id]/analytics',
    writes: null,
    reads: ['work-log/analysis/study-own-data', 'context/content-strategy/pillars',
      'context/content-strategy/goals'],
    switch: 'analysis.scorecard', state: 'active',
    note: 'Re-cut to these addresses by the Analysis Engine spec family.',
  }),
  F({
    id: 'analysis.goal_tracking', today: 'journey.checkIns[], JourneyView goal card',
    writes: 'work-log/analysis/goal-tracking', reads: ['context/content-strategy/goals'],
    switch: 'analysis.goal_tracking', state: 'migrated',
    note: 'Blocked per goal until that goal has its S16 declaration.',
  }),
  F({
    id: 'legacy.journey_next_steps', today: 'journey.nextSteps (plain text)',
    writes: 'frozen/journey-next-steps', reads: [], switch: 'frozen.legacy', state: 'frozen',
    note: 'Already rejected once — she wants data, not text sections.',
  }),
  F({
    id: 'analysis.mix', today: 'content mix vs pillar targets (computed)',
    writes: null, reads: ['context/content-strategy/pillars', 'work-log/creation'],
    switch: 'analysis.scorecard', state: 'active',
  }),
  F({
    id: 'analysis.compare', today: 'lib/analysis/compare.ts, components/analysis/CompareTab',
    writes: 'work-log/analysis/comparisons', reads: ['work-log/analysis/study-own-data'],
    switch: 'analysis.compare', state: 'active',
    note: 'PLAN §5.2 calls this the engine’s actual purpose. The screen says Compare; the machinery builds a matched comparison and calls `resolveComparison` unmodified (spec 27 §9).',
  }),
  F({
    id: 'analysis.digest', today: 'lib/analysis/digest.ts, app/api/analysis/digest',
    writes: 'work-log/analysis/digests', reads: ['work-log/analysis'],
    switch: 'analysis.digest_owner', state: 'active',
    note: 'Monthly per profile right after month-end, coverage first (spec 27 §13.1).',
  }),
  F({
    id: 'analysis.client_perception', today: 'client perception (no structured home today)',
    writes: 'work-log/analysis/client-perception', reads: [],
    switch: 'creation.review_perception', state: 'declared',
  }),
  F({
    id: 'analysis.soft_signals', today: 'DMs, inquiries, attribution counts, her remarks',
    writes: 'work-log/analysis/client-perception', reads: [], switch: 'analysis.soft_signals',
    state: 'declared', note: 'Recorded lightly, outside the engine’s math.',
  }),
  F({
    id: 'analysis.market_research', today: 'market research (nothing)',
    writes: 'work-log/analysis/market-research', reads: ['context/business-details/market'],
    switch: 'analysis.market_research', state: 'declared',
  }),

  // ── 8.10 capture routes and owner-level surfaces ──────────────────────────
  F({
    id: 'owner.chat', today: 'ChatWidget, chatLog[], app/api/chat-brain (v4 built, undeployed)',
    writes: 'frozen/chat-log',
    reads: ['work-log/logs/tasks', 'work-log/creation', 'work-log/logs/observations'],
    switch: 'owner.chat', state: 'frozen', slices: ['state.chatLog'],
    note: 'PLAN §11 Q1: the chat is HELD — it keeps working exactly as today, outside the tree, untouched by migration. Its own spec comes after the restructure.',
  }),
  F({
    id: 'owner.whatsapp', today: 'app/api/whatsapp, lib/whatsappInbox.ts, app/api/inbox-topic (spec 18B)',
    writes: 'frozen/chat-log', reads: [], switch: 'owner.whatsapp_inbox', state: 'frozen',
    note: 'Parked, unchanged (registration dead-ended at Meta’s PIN step).',
  }),
  F({
    id: 'leaves.brain_dump', today: 'brainDump, BrainDumpView, app/brain',
    writes: 'leaves/brain-dump', reads: [], switch: 'leaves.exported', state: 'leaves',
    slices: ['state.brainDump'],
  }),
  F({
    id: 'leaves.container_map', today: 'containerMap, ContainerMapView, app/map, lib/containerSeed.ts',
    writes: 'leaves/container-map', reads: [], switch: 'leaves.exported', state: 'leaves',
    slices: ['state.containerMap'],
  }),
  F({
    id: 'state.api', today: 'app/api/state', writes: null, reads: [], switch: 'spine.fixed',
    state: 'active', note: 'Rewritten as the path-scoped patch door (§3.4).',
  }),
  F({
    id: 'legacy.debug_preview', today: 'app/api/debug-preview', writes: 'frozen/debug', reads: [],
    switch: 'frozen.legacy', state: 'frozen',
  }),

  // ── spec 26 — the tracking store ──────────────────────────────────────────
  F({
    id: 'analysis.metrics_sync',
    today: 'app/api/metrics-sync, lib/platforms/index.ts, lib/platforms/instagram/*',
    writes: 'work-log/analysis/study-own-data/observations',
    reads: ['work-log/creation/channels', 'context/content-strategy/platforms',
      'context/content-strategy/toolset'],
    switch: 'analysis.tracking', state: 'active',
    note: 'The generalized collector: one connector per platform, the existing ig-sync logic MOVED not rewritten. Two runs a day, append-only, every row carrying its own age, timezone, definition version and run id.',
  }),
  F({
    id: 'analysis.sync_health',
    today: 'sync_runs, lib/tree/metrics.ts (coverage gaps with reasons)',
    writes: 'work-log/analysis/study-own-data/sync-health',
    reads: ['work-log/analysis/study-own-data/observations', 'work-log/creation/channels'],
    switch: 'analysis.sync_health', state: 'active',
    note: 'Runs, connection status, retry and backfill state. A gap’s reason is READ OFF the runs, never guessed (§5.6).',
  }),
  F({
    id: 'analysis.backfill', today: 'app/api/metrics-sync ?trigger=backfill',
    writes: 'work-log/analysis/study-own-data/observations',
    reads: ['work-log/analysis/study-own-data/sync-health'],
    switch: 'analysis.backfill', state: 'active',
    note: 'Fetches current lifetime totals for posts missed while the pipe was down, stamped `backfilled`. It closes no gap: the curve between the stall and the first successful run does not exist and will not exist (§6.4).',
  }),
  F({
    id: 'analysis.window_materialization', today: 'lib/tree/metrics.ts',
    writes: 'work-log/analysis/study-own-data/observations',
    reads: ['work-log/analysis/study-own-data/observations'],
    switch: 'analysis.tracking', state: 'active',
    note: 'S6’s three windows, materialized ONCE from a qualifying lifetime reading and never recomputed. Stores the ACTUAL age, and says too-early or unavailable rather than zero.',
  }),
  F({
    id: 'analysis.attributed_outcomes', today: 'lib/tree/metrics.ts (the S23 wall)',
    writes: 'work-log/analysis/attributed-outcomes',
    reads: ['work-log/analysis/study-own-data/observations'],
    switch: 'analysis.attributed_outcomes', state: 'active',
    note: 'S23: no code path may divide an attributed outcome by an observed metric unless event_source AND attribution_method are both declared. A store-level refusal, not a UI convention.',
  }),
  F({
    id: 'analysis.measurement_declarations', today: 'lib/tree/measurement.ts',
    writes: 'context/content-strategy/goals/*/measurement',
    reads: ['context/content-strategy/goals', 'context/content-strategy/pillars',
      'context/content-strategy/platforms/*/metrics'],
    switch: 'strategy.fixed', state: 'active',
    note: 'S16’s measuring stick, validated at strategy lock. It blocks ANALYSIS per subject and never blocks COLLECTION — recording is the first duty and does not wait for a decision (§9).',
  }),
  F({
    id: 'analysis.platform_metrics', today: 'lib/platforms/instagram/metrics.ts',
    writes: 'context/content-strategy/platforms/*/metrics',
    reads: ['context/content-strategy/platforms/*/formats'],
    switch: 'platforms.*', state: 'active',
    note: 'The code catalogue is the shelf (it describes the platform, not the client); the profile parameter is what this account actually reports. Override beats universal.',
  }),
  F({
    id: 'analysis.tracking_migration', today: 'lib/tree/migrateTracking.ts, app/api/migrate-tracking',
    writes: 'work-log/analysis/study-own-data/observations',
    reads: ['work-log/analysis/study-own-data/links'],
    switch: 'analysis.tracking', state: 'migrated',
    note: 'The ig_* history copied with count parity, definition_version 0 and fetch_time_precision day. No run records are invented; the pre-cutover gaps read `unknown`, which is what they are (§14).',
  }),

  // ── spec 27 §21 — the reading surfaces, on ONE computation layer ───────────
  F({
    id: 'analysis.read_layer', today: 'lib/analysis/read.ts, lib/analysis/compute.ts',
    writes: null,
    reads: [
      'work-log/analysis/study-own-data/observations',
      'work-log/analysis/study-own-data/sync-health',
      'work-log/analysis/study-own-data/links',
      'work-log/creation', 'work-log/creation/channels', 'work-log/creation/topics',
      'context/content-strategy/pillars', 'context/content-strategy/goals',
      'context/content-strategy/platforms', 'context/content-strategy/toolset',
    ],
    switch: 'analysis.tracking', state: 'active',
    note: 'read.ts is the ONLY reader of the store and exports no writer; compute.ts is pure. Every surface below is a window onto these two — no screen queries Supabase, and no screen has its own idea of what "typical" means (§4).',
  }),
  F({
    id: 'analysis.now', today: 'lib/analysis/digest.ts (period = month to date), components/analysis/NowTab',
    writes: null, reads: ['work-log/analysis/study-own-data/observations', 'work-log/creation'],
    switch: 'analysis.always_live', state: 'active',
    note: 'The always-live view. The same calculation as the monthly digest with a different period argument, which is why it cannot drift from it (§13.3).',
  }),
  F({
    id: 'analysis.bifurcation', today: 'lib/analysis/bifurcate.ts, components/analysis/SlicesTab',
    writes: null,
    reads: ['work-log/creation', 'work-log/analysis/study-own-data/observations',
      'context/content-strategy/pillars', 'context/content-strategy/platforms'],
    switch: 'analysis.bifurcation', state: 'active',
    note: 'Dimensions are GENERATED from the profile’s own declarations, so a fourth pillar or a new hook type carries the moment it exists, with nothing blank (law 3, test 5).',
  }),
  F({
    id: 'analysis.funnel_view', today: 'lib/analysis/funnel.ts, components/analysis/FunnelTab',
    writes: null,
    reads: ['work-log/analysis/study-own-data/observations', 'work-log/analysis/attributed-outcomes',
      'context/content-strategy/funnel-shape', 'context/content-strategy/ctas'],
    switch: 'analysis.funnel', state: 'active',
    note: 'Observed platform metrics only. Attributed outcomes render in a separate block behind the S23 wall, labelled unknown without a declared method (§8.3).',
  }),
  F({
    id: 'analysis.verdicts', today: 'lib/analysis/verdict.ts, app/api/analysis/verdict',
    writes: 'work-log/analysis/verdicts', reads: ['work-log/analysis/study-own-data/observations'],
    switch: 'analysis.verdicts', state: 'active',
    note: 'Numbers computed by code and stored WHOLE before any model is called (§11.2). Append-only: a re-run appends and the old verdict stays.',
  }),
  F({
    id: 'analysis.verdict_words', today: 'lib/analysis/words.ts',
    writes: null, reads: ['work-log/analysis/verdicts', 'context/content-strategy/voice'],
    switch: 'analysis.verdict_words', state: 'active',
    note: 'The one wording call, with four guards run before she sees a word. The number guard is what makes "AI can never invent a metric" mechanical rather than a promise (§12.4).',
  }),
  F({
    id: 'analysis.pulse', today: 'lib/analysis/digest.ts (weekly pulse)',
    writes: 'work-log/analysis/digests', reads: ['work-log/analysis/study-own-data/sync-health'],
    switch: 'analysis.pulse_owner', state: 'active',
    note: 'Each profile writes its OWN pulse entry; the shelf composes her one screen from them. Nothing is stored between profiles (§13.2, PLAN §5.3).',
  }),
  F({
    id: 'analysis.revisit_proposals', today: 'lib/analysis/verdict.ts → lib/engine/proposals.ts',
    writes: 'work-log/creation/topics/proposals', reads: ['work-log/analysis/verdicts'],
    switch: 'analysis.revisit_proposals', state: 'active',
    note: 'It never creates a seed — the seed already exists. Evidence is required at the write door: a revisit proposal with no cited verdict is refused, not warned (§15.1).',
  }),
  F({
    id: 'analysis.strategy_diffs', today: 'lib/analysis/verdict.ts → lib/engine/feedback.ts',
    writes: 'work-log/logs/feedback', reads: ['work-log/analysis/verdicts'],
    switch: 'analysis.strategy_diffs', state: 'active',
    note: 'The engine PROPOSES a diff against mix targets or pillar jobs; her acceptance writes strategy version N+1, dated, with the cited reason. Nothing updates strategy behind her back (§15.3).',
  }),
  F({
    id: 'analysis.costume_recommendations', today: 'lib/analysis/verdict.ts → lib/engine/recommendations.ts',
    writes: 'work-log/creation/costume-recommendations', reads: ['work-log/analysis/verdicts'],
    switch: 'analysis.costume_recommendations', state: 'active',
    note: 'A projection of sufficient patterns, carrying its evidence, drawn by Content Engine II. It never pre-selects anything (§15.2).',
  }),
  F({
    id: 'analysis.client_publication', today: 'lib/analysis/digest.ts, lib/access.ts publication gate',
    writes: 'work-log/analysis/digests', reads: ['work-log/analysis/verdicts'],
    switch: 'analysis.client_publication', state: 'active',
    note: 'The client’s analysis window renders the latest APPROVED publication, never a live query. The resolver enforces it server side: on an analysis path a non-owner receives published entries and nothing else (§14).',
  }),

  // ── spec 28 — the shell ───────────────────────────────────────────────────
  // Every feature registers its switch at birth (PLAN §6 rule 3). The shell
  // writes exactly one path — `shelf/profiles`, already declared by spec 21 —
  // and everything else it does is reading, routing and rendering (§12.3).
  F({
    id: 'shell.render_resolver', today: 'lib/tree/render.ts',
    writes: null, reads: ['context/content-strategy/toolset'],
    switch: 'spine.fixed', state: 'active',
    note: 'renderState(profile, switch, role): the cascade, the lifecycle, the audience and the door, most restrictive wins. The ONLY visibility authority — no component reads a switch position itself (§17.5).',
  }),
  F({
    id: 'shell.profile_frame', today: 'app/profile/[id], components/shell/Frame.tsx',
    writes: null, reads: ['shelf/profiles', 'context/content-strategy/visual-branding'],
    switch: 'spine.fixed', state: 'active',
    note: 'The three-app frame. Replaces the nine-tab bar and the cross-profile sidebar; leaving a profile means going back to the shelf, and there is no other exit (§5.7).',
  }),
  F({
    id: 'shell.shelf', today: 'app/shelf, components/shell/Shelf.tsx',
    writes: null,
    reads: ['shelf/profiles', 'work-log/creation', 'context/intake',
      'work-log/analysis/study-own-data/sync-health'],
    switch: 'shelf.profiles', state: 'active',
    note: 'The cards. Status never content: counts composed at read time from each profile’s own paths, and one attention line from a fixed vocabulary (§4.2).',
  }),
  F({
    id: 'shelf.add_profile', today: 'components/shell/Shelf.tsx add-profile',
    writes: 'shelf/profiles', reads: [],
    switch: 'shelf.add_profile', state: 'active',
    note: 'The shell’s ONE write. Name and colour; born at lifecycle setup with no switch positions and no strategy version (§4.5).',
  }),
  F({
    id: 'shelf.weekly_pulse', today: 'lib/shell/shelf.ts composeWeeklyPulse',
    writes: null, reads: ['work-log/analysis/digests'],
    switch: 'shelf.weekly_pulse', state: 'active',
    note: 'The composition, never the entries: each profile writes its own weekly-pulse entry into its own digests (spec 27 §13.2) and the shelf composes her one screen. Nothing cross-profile is stored (§4.4).',
  }),
  F({
    id: 'client_access.mini_shelf', today: 'components/shell/MiniShelf.tsx',
    writes: null, reads: ['shelf/profiles'],
    switch: 'client_access.mini_shelf', state: 'active',
    note: 'THEIR profiles only, never anyone else’s (PLAN §11 Q3). No strip, no pulse, no add-profile, and no count that comes from behind a door they do not hold (§7.2).',
  }),
  F({
    id: 'client_access.windows', today: 'lib/access.ts windowsForBinding',
    writes: null, reads: ['work-log/creation', 'work-log/creation/review',
      'work-log/analysis/digests', 'context/content-strategy'],
    switch: 'client_access.login', state: 'active',
    note: 'The ordered windows a binding grants, derived from doors + switches + lifecycle and asserted server side. It GRANTS nothing — it is a projection of what the filter already decided (§15.2).',
  }),
  F({
    id: 'creation.review_deeplink', today: 'lib/shell/deeplink.ts, app/p/[shareId]',
    writes: null, reads: ['work-log/creation/review', 'work-log/creation'],
    switch: 'creation.review_deeplink', state: 'active',
    note: 'The logged-in branch of a shared preview link. A delivery route into the review door, never a fifth door (§10, §14).',
  }),
  F({
    id: 'shell.route_map', today: 'lib/shell/routes.ts',
    writes: null, reads: [],
    switch: 'spine.fixed', state: 'active',
    note: 'Every route alive today with its fate. A route with no fate fails the build — the orphan check, applied to routes (§17.13).',
  }),
];

const BY_ID = new Map<string, FeatureDeclaration>();
for (const f of FEATURES) {
  if (BY_ID.has(f.id)) throw new Error(`[tree] duplicate feature: ${f.id}`);
  BY_ID.set(f.id, f);
}

export function findFeature(id: string): FeatureDeclaration | null {
  return BY_ID.get(id) ?? null;
}

/** Every AppState / ClientData key the address map claims. */
export function declaredSlices(): string[] {
  return FEATURES.flatMap(f => f.slices ?? []);
}
