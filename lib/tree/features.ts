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
  F({
    id: 'creation.engine_room', today: 'the Content Engine room (nothing built; spec 19 → PLAN §5.1)',
    writes: 'work-log/creation/topics', reads: ['context'], switch: 'creation.engine', state: 'declared',
  }),
  F({
    id: 'creation.client_seed_input', today: 'client bringing ideas (no code today)',
    writes: 'work-log/creation/topics', reads: [], switch: 'creation.seed_input_client', state: 'declared',
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
    id: 'analysis.ig_sync', today: 'app/api/ig-sync, vercel.json cron (9:00 IST)',
    writes: 'work-log/analysis/study-own-data', reads: ['work-log/creation/channels'],
    switch: 'analysis.tracking', state: 'active',
    note: 'Gains every S7 field. Recording does NOT wait for the restructure; the 2026-07-12 stall is fixed before it.',
  }),
  F({
    id: 'analysis.post_links', today: 'ig_post_links (spec 03)',
    writes: 'work-log/analysis/study-own-data', reads: ['work-log/creation'],
    switch: 'analysis.tracking', state: 'active',
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
    id: 'analysis.compare', today: 'compare / A-B (nothing built)',
    writes: 'work-log/analysis/comparisons', reads: ['work-log/analysis/study-own-data'],
    switch: 'analysis.compare', state: 'declared',
    note: 'PLAN §5.2 calls this the engine’s actual purpose.',
  }),
  F({
    id: 'analysis.digest', today: 'spec 07 monthly digest (specced, unbuilt)',
    writes: 'work-log/analysis/digests', reads: ['work-log/analysis'],
    switch: 'analysis.digest_owner', state: 'declared',
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
