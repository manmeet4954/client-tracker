// The path namespace — every folder in PLAN §3, declared once (laws 3 and 4).
//
// Reading order: PLAN.md §3 is the floor plan, spec 21 §4 is the contract, this
// file is the wiring. Every path carries its two connection lines (fed_by /
// read_by) so anything added inside inherits them automatically, and the switch
// that governs it, so nothing renders without a position being set.
//
// Paths are profile-relative: `context/...` and `work-log/...` exist once per
// profile. Owner-zone paths (`shelf/...`) exist once for her. A `*` segment is
// a wildcard for an entry's own name (law 2's nesting: platforms/<platform>/...).

import type { PathDeclaration } from './contract.ts';

const D = (d: PathDeclaration): PathDeclaration => d;

export const DECLARATIONS: PathDeclaration[] = [
  // ── Her side: the shelf (PLAN §2) ──────────────────────────────────────────
  D({
    path: 'shelf/profiles', zone: 'owner', kind: 'variable', entry_type: 'profile',
    fed_by: ['owner'], read_by: ['shelf', 'access-resolver'],
    switch: 'shelf.profiles', states: ['active'], history: 'mutable_with_supersession',
    audience: 'owner',
    note: 'Profile cards show status only — nothing from inside a profile leaks onto the shelf.',
  }),
  D({
    path: 'shelf/today-strip', zone: 'owner', kind: 'variable', entry_type: 'task-view',
    fed_by: ['owner', 'path:work-log/logs/tasks'], read_by: ['shelf'],
    switch: 'shelf.today_strip', states: ['active', 'hidden'], history: 'none',
    audience: 'owner',
    note: 'The ONE cross-profile window: client tasks due across profiles. A view, never a store.',
  }),

  // ── context/ ───────────────────────────────────────────────────────────────
  D({
    path: 'context', zone: 'tree', kind: 'variable', entry_type: 'folder',
    fed_by: ['owner'], read_by: ['work-log', 'engine:content', 'engine:analysis'],
    switch: 'spine.fixed', states: ['active'], history: 'none', audience: 'owner',
    note: 'Know this before touching anything. Frozen spine (law 1).',
  }),

  // context/intake — the ROUTE only: how information travels (PLAN §3.1)
  D({
    path: 'context/intake', zone: 'tree', kind: 'variable', entry_type: 'intake_round',
    fed_by: ['owner'], read_by: ['owner'],
    switch: 'intake.questionnaire', states: ['active', 'history', 'hidden'], history: 'versioned',
    audience: 'both', client_door: 'give:intake',
    note: 'Intake is HOW, never WHAT. Rounds are versioned and reopenable (S10).',
  }),
  D({
    path: 'context/intake/questions', zone: 'tree', kind: 'variable', entry_type: 'question',
    fed_by: ['path:context/personal-details', 'path:context/business-details'],
    read_by: ['context/intake', 'client'],
    switch: 'intake.questionnaire', states: ['active', 'history', 'hidden'], history: 'versioned',
    audience: 'both', client_door: 'give:intake',
    note: 'GENERATED from the detail folders’ parameters, never authored here.',
  }),
  D({
    path: 'context/intake/answers', zone: 'tree', kind: 'variable', entry_type: 'answer',
    fed_by: ['client', 'owner'],
    read_by: ['context/personal-details', 'context/business-details'],
    switch: 'intake.questionnaire', states: ['active', 'history', 'hidden'], history: 'append_only',
    audience: 'both', client_door: 'give:intake',
    note: 'Raw answers, untouched, forever (S11). Give-point 1.',
  }),

  // context/personal-details (PLAN §3.2)
  D({
    path: 'context/personal-details', zone: 'tree', kind: 'variable', entry_type: 'curated_parameter',
    fed_by: ['owner'], read_by: ['context/content-strategy', 'engine:content'],
    switch: 'spine.fixed', states: ['active'], history: 'mutable_with_supersession',
    audience: 'owner', note: 'Curated by her from intake answers, only.',
  }),
  ...['identity', 'journey', 'voice-of-the-person', 'ambitions', 'camera', 'history'].map(sub =>
    D({
      path: `context/personal-details/${sub}`, zone: 'tree', kind: 'parameter',
      entry_type: 'curated_parameter',
      fed_by: ['owner'], read_by: ['context/content-strategy', 'engine:content'],
      switch: 'spine.fixed', states: ['active'], history: 'mutable_with_supersession',
      audience: 'owner',
    })),

  // context/business-details (PLAN §3.3)
  D({
    path: 'context/business-details', zone: 'tree', kind: 'variable', entry_type: 'curated_parameter',
    fed_by: ['owner'], read_by: ['context/content-strategy', 'work-log/analysis/market-research'],
    switch: 'spine.fixed', states: ['active'], history: 'mutable_with_supersession',
    audience: 'owner',
  }),
  ...['offers', 'buying-route', 'market', 'numbers', 'pains', 'audience-raw'].map(sub =>
    D({
      path: `context/business-details/${sub}`, zone: 'tree', kind: 'parameter',
      entry_type: 'curated_parameter',
      fed_by: ['owner'], read_by: ['context/content-strategy', 'work-log/analysis/market-research'],
      switch: 'spine.fixed', states: ['active'], history: 'mutable_with_supersession',
      audience: 'owner',
      note: sub === 'offers' ? 'Each offer an entry; one marked hero.' : undefined,
    })),

  // context/content-strategy — the decision layer (PLAN §3.4)
  D({
    path: 'context/content-strategy', zone: 'tree', kind: 'variable', entry_type: 'strategy_parameter',
    fed_by: ['owner', 'engine:analysis'],
    read_by: ['work-log', 'engine:content', 'engine:analysis', 'client'],
    switch: 'strategy.fixed', states: ['active'], history: 'versioned',
    audience: 'both', client_door: 'see:strategy',
    note: 'DERIVED, never collected. Locked before creation opens. Strategy is not a switch.',
  }),
  ...[
    'positioning', 'voice', 'audience-decided', 'funnel-shape', 'ctas',
    'proof-library', 'boundaries', 'cadence', 'obligations',
  ].map(sub =>
    D({
      path: `context/content-strategy/${sub}`, zone: 'tree', kind: 'parameter',
      entry_type: 'strategy_parameter',
      fed_by: ['owner', 'engine:analysis'], read_by: ['work-log', 'engine:content'],
      switch: 'strategy.fixed', states: ['active'], history: 'versioned',
      audience: sub === 'obligations' ? 'both' : 'owner',
      client_door: sub === 'obligations' ? 'see:obligations' : undefined,
      note: sub === 'proof-library' ? 'Real results, quotes, BTS, case studies. Carries rights (S21).'
        : sub === 'boundaries' ? 'Prohibited claims, never-promises, the unwanted audience.'
        : undefined,
    })),
  D({
    path: 'context/content-strategy/visual-branding', zone: 'tree', kind: 'parameter',
    entry_type: 'strategy_parameter',
    fed_by: ['owner'], read_by: ['work-log/creation/making', 'client'],
    switch: 'strategy.visual_branding', states: ['active'], history: 'versioned',
    audience: 'both', client_door: 'see:strategy',
  }),
  D({
    path: 'context/content-strategy/goals', zone: 'tree', kind: 'variable', entry_type: 'goal',
    fed_by: ['owner', 'engine:analysis'],
    read_by: ['work-log/analysis/goal-tracking', 'work-log/creation/scheduling'],
    switch: 'strategy.fixed', states: ['active'], history: 'versioned',
    audience: 'both', client_door: 'see:strategy',
    note: 'Each goal carries an S16 metric declaration before analysis may read it.',
  }),
  D({
    path: 'context/content-strategy/working-mode', zone: 'tree', kind: 'parameter',
    entry_type: 'strategy_parameter',
    fed_by: ['owner'], read_by: ['work-log/creation/review', 'work-log/creation/topics'],
    switch: 'strategy.fixed', states: ['active'], history: 'versioned',
    audience: 'both', client_door: 'see:obligations',
    note: 'Collaboration mode, posting ownership, and the S20 review configuration.',
  }),
  D({
    path: 'context/content-strategy/toolset', zone: 'tree', kind: 'variable', entry_type: 'switch_setting',
    fed_by: ['owner'], read_by: ['work-log', 'access-resolver', 'engine:content', 'engine:analysis'],
    switch: 'strategy.fixed', states: ['active'], history: 'versioned',
    audience: 'owner',
    note: 'THE switchboard. Every work-log tool checks it before it shows itself.',
  }),

  // platforms — each platform its own folder (law 2 nesting, PLAN §3.4)
  D({
    path: 'context/content-strategy/platforms', zone: 'tree', kind: 'variable', entry_type: 'platform',
    fed_by: ['owner'],
    read_by: ['work-log/creation/topics', 'work-log/creation/channels', 'work-log/creation/scheduling', 'work-log/analysis'],
    switch: 'strategy.fixed', states: ['active'], history: 'versioned', audience: 'both',
    client_door: 'see:strategy',
    note: 'The cascade parents. A format has no existence outside its platform.',
  }),
  D({
    path: 'context/content-strategy/platforms/*', zone: 'tree', kind: 'entry', entry_type: 'platform',
    fed_by: ['owner'], read_by: ['work-log/creation', 'work-log/analysis'],
    switch: 'platforms.*', states: ['active', 'history', 'hidden'], history: 'versioned',
    audience: 'both', client_door: 'see:strategy',
  }),
  ...['how-it-works', 'formats', 'rules', 'connection'].map(sub =>
    D({
      path: `context/content-strategy/platforms/*/${sub}`, zone: 'tree', kind: 'parameter',
      entry_type: sub === 'formats' ? 'format' : 'platform_parameter',
      fed_by: sub === 'rules' ? ['owner', 'engine:content'] : ['owner'],
      read_by: sub === 'formats'
        ? ['work-log/creation/topics', 'work-log/creation', 'work-log/analysis']
        : ['work-log/creation', 'work-log/analysis'],
      switch: 'platforms.*', states: ['active', 'history', 'hidden'], history: 'versioned',
      audience: 'both', client_door: 'see:strategy',
      note: sub === 'rules' ? 'Per-client overrides beat the universal format rules, always.' : undefined,
    })),

  // pillars — each pillar its own folder
  D({
    path: 'context/content-strategy/pillars', zone: 'tree', kind: 'variable', entry_type: 'pillar',
    fed_by: ['owner', 'engine:analysis'],
    read_by: ['work-log/creation/topics', 'work-log/creation', 'work-log/analysis/study-own-data'],
    switch: 'strategy.fixed', states: ['active'], history: 'versioned',
    audience: 'both', client_door: 'see:strategy',
    note: 'Add a pillar and the seed picker, the mix math, and the scorecard know it instantly.',
  }),
  D({
    path: 'context/content-strategy/pillars/*', zone: 'tree', kind: 'entry', entry_type: 'pillar',
    fed_by: ['owner', 'engine:analysis'], read_by: ['work-log/creation', 'work-log/analysis'],
    switch: 'strategy.fixed', states: ['active', 'history'], history: 'versioned',
    audience: 'both', client_door: 'see:strategy',
  }),
  ...['job', 'mix-target', 'description', 'seed-examples'].map(sub =>
    D({
      path: `context/content-strategy/pillars/*/${sub}`, zone: 'tree', kind: 'parameter',
      entry_type: 'pillar_parameter',
      fed_by: ['owner', 'engine:analysis'], read_by: ['work-log/creation', 'work-log/analysis'],
      switch: 'strategy.fixed', states: ['active', 'history'], history: 'versioned',
      audience: 'both', client_door: 'see:strategy',
      note: sub === 'job' ? 'Reach / Trust / Convert. Analysis judges a pillar only against its job.' : undefined,
    })),

  // gate set (S14) — derived from strategy, locked with it
  D({
    path: 'context/content-strategy/gates', zone: 'tree', kind: 'variable', entry_type: 'gate_set',
    fed_by: ['owner'],
    read_by: ['work-log/creation/making', 'work-log/creation/review'],
    switch: 'strategy.fixed', states: ['active', 'history'], history: 'versioned',
    audience: 'owner',
    note: 'Five brand gates derived from voice/ and positioning/, plus accuracy and format.',
  }),

  // ── work-log/ ──────────────────────────────────────────────────────────────
  D({
    path: 'work-log', zone: 'tree', kind: 'variable', entry_type: 'folder',
    fed_by: ['owner'], read_by: ['owner'],
    switch: 'spine.fixed', states: ['active'], history: 'none', audience: 'owner',
    note: 'The living, daily side. Frozen spine (law 1).',
  }),

  // creation — the Content Engine's home (PLAN §3.5)
  D({
    path: 'work-log/creation', zone: 'tree', kind: 'variable', entry_type: 'piece',
    fed_by: ['owner', 'engine:content'],
    read_by: [
      'work-log/creation/making', 'work-log/creation/review', 'work-log/creation/scheduling',
      'work-log/analysis/study-own-data', 'shelf/today-strip', 'client',
    ],
    switch: 'creation.board', states: ['active', 'history', 'hidden'], history: 'append_only',
    audience: 'both', client_door: 'see:upcoming',
    note: 'THE canonical piece identity (S2). making/review/scheduling are views over it.',
  }),
  D({
    path: 'work-log/creation/topics', zone: 'tree', kind: 'variable', entry_type: 'seed',
    fed_by: ['owner', 'engine:content', 'engine:analysis'],
    read_by: ['work-log/creation', 'engine:content'],
    switch: 'creation.engine', states: ['active', 'history', 'hidden'], history: 'append_only',
    audience: 'owner',
    note: 'The seed bank. Seeds never have stages (S1); loose subjects are capture input only (S24). A client who brings ideas gives them at intake (give-point 1); her curation makes them seeds — never a fifth door (S19).',
  }),
  D({
    path: 'work-log/creation/making', zone: 'tree', kind: 'variable', entry_type: 'draft_version',
    fed_by: ['owner', 'engine:content'],
    read_by: ['work-log/creation/review', 'work-log/creation'],
    switch: 'creation.making', states: ['active', 'history', 'hidden'], history: 'append_only',
    audience: 'owner',
    note: 'Versions are kept. Outside-tool handoffs live here with their contract (S18).',
  }),
  D({
    path: 'work-log/creation/review', zone: 'tree', kind: 'variable', entry_type: 'review_record',
    fed_by: ['owner', 'client'],
    read_by: ['work-log/creation', 'work-log/analysis/client-perception', 'work-log/logs/changes'],
    switch: 'creation.review', states: ['active', 'history', 'hidden'], history: 'append_only',
    audience: 'both', client_door: 'give:review',
    note: 'Give-point 3. Verdicts attach to the piece, never to a copy.',
  }),
  D({
    path: 'work-log/creation/scheduling', zone: 'tree', kind: 'variable', entry_type: 'schedule_record',
    fed_by: ['owner'], read_by: ['work-log/creation', 'shelf/today-strip', 'client'],
    switch: 'creation.scheduling', states: ['active', 'history', 'hidden'], history: 'append_only',
    audience: 'both', client_door: 'see:upcoming',
  }),
  D({
    path: 'work-log/creation/channels', zone: 'tree', kind: 'variable', entry_type: 'channel',
    fed_by: ['owner'],
    read_by: ['work-log/creation/scheduling', 'work-log/analysis/study-own-data'],
    switch: 'creation.channels', states: ['active', 'history', 'hidden'], history: 'mutable_with_supersession',
    audience: 'owner',
    note: 'Each channel is tied to exactly one platform and carries its posting permissions (S17).',
  }),
  D({
    path: 'work-log/creation/funnel', zone: 'tree', kind: 'variable', entry_type: 'funnel_step',
    fed_by: ['owner'], read_by: ['work-log/creation', 'work-log/analysis/study-own-data'],
    switch: 'creation.funnel', states: ['active', 'history', 'hidden'], history: 'versioned',
    audience: 'owner',
  }),
  D({
    path: 'work-log/creation/funnel/replies', zone: 'tree', kind: 'variable', entry_type: 'reply_script',
    fed_by: ['owner'], read_by: ['work-log/creation/funnel', 'owner'],
    switch: 'creation.funnel_replies', states: ['active', 'history', 'hidden'], history: 'mutable_with_supersession',
    audience: 'owner',
    note: 'Law-4 addition ratified into PLAN §3: the reply scripts the body holds.',
  }),

  // assets and references (PLAN §3.6)
  D({
    path: 'work-log/assets', zone: 'tree', kind: 'variable', entry_type: 'asset_set',
    fed_by: ['owner', 'client'], read_by: ['work-log/creation/making'],
    switch: 'assets.library', states: ['active', 'history', 'hidden'], history: 'append_only',
    audience: 'both', client_door: 'give:assets',
  }),
  D({
    path: 'work-log/assets/sets', zone: 'tree', kind: 'variable', entry_type: 'asset_set',
    fed_by: ['owner', 'client', 'pipe:whatsapp', 'pipe:share-target'],
    read_by: ['work-log/creation/making', 'work-log/assets'],
    switch: 'assets.library', states: ['active', 'history', 'hidden'], history: 'append_only',
    audience: 'both', client_door: 'give:assets',
    note: 'Give-point 2. Originals never recompressed; every item carries a rights record (S21).',
  }),
  D({
    path: 'work-log/assets/sets/*', zone: 'tree', kind: 'entry', entry_type: 'asset',
    fed_by: ['owner', 'client', 'pipe:whatsapp', 'pipe:share-target'],
    read_by: ['work-log/creation/making', 'work-log/assets'],
    switch: 'assets.library', states: ['active', 'history', 'hidden'], history: 'append_only',
    audience: 'both', client_door: 'give:assets',
    note: 'A set is an entry folder; its items live inside it (law 2). Each carries its rights record (S21).',
  }),
  D({
    path: 'work-log/references', zone: 'tree', kind: 'variable', entry_type: 'reference',
    fed_by: ['owner'], read_by: ['work-log/creation/making', 'context/content-strategy'],
    switch: 'references.our_vision', states: ['active', 'history', 'hidden'], history: 'append_only',
    audience: 'owner',
  }),
  D({
    path: 'work-log/references/from-client', zone: 'tree', kind: 'variable', entry_type: 'reference',
    fed_by: ['client', 'owner'], read_by: ['work-log/creation/making', 'context/content-strategy'],
    switch: 'references.from_client', states: ['active', 'history', 'hidden'], history: 'append_only',
    audience: 'both', client_door: 'give:assets',
  }),
  D({
    path: 'work-log/references/our-vision', zone: 'tree', kind: 'variable', entry_type: 'reference',
    fed_by: ['owner'], read_by: ['work-log/creation/making', 'context/content-strategy'],
    switch: 'references.our_vision', states: ['active', 'history', 'hidden'], history: 'append_only',
    audience: 'owner',
  }),

  // logs (PLAN §3.7)
  D({
    path: 'work-log/logs', zone: 'tree', kind: 'variable', entry_type: 'folder',
    fed_by: ['owner'], read_by: ['owner'],
    switch: 'spine.fixed', states: ['active'], history: 'none', audience: 'owner',
  }),
  D({
    path: 'work-log/logs/tasks', zone: 'tree', kind: 'variable', entry_type: 'task',
    fed_by: ['owner', 'pipe:chat', 'pipe:whatsapp'],
    read_by: ['shelf/today-strip', 'work-log/creation', 'owner', 'client'],
    switch: 'logs.tasks', states: ['active', 'history', 'hidden'], history: 'append_only',
    audience: 'both', client_door: 'see:obligations',
    note: 'One truth, two views: her day view and the profile agenda read the same task.',
  }),
  D({
    path: 'work-log/logs/decisions', zone: 'tree', kind: 'variable', entry_type: 'decision',
    fed_by: ['owner'], read_by: ['owner', 'context/content-strategy'],
    switch: 'logs.decisions', states: ['active', 'history', 'hidden'], history: 'append_only',
    audience: 'owner',
  }),
  D({
    path: 'work-log/logs/requests', zone: 'tree', kind: 'variable', entry_type: 'request',
    fed_by: ['owner', 'path:work-log/creation/review'], read_by: ['owner', 'client'],
    switch: 'logs.requests', states: ['active', 'history', 'hidden'], history: 'append_only',
    audience: 'both', client_door: 'see:obligations',
    note: 'The special-demands lane. A client ask ARRIVES through one of the four doors (or through her) and is written here by us — never a fifth workflow (S19).',
  }),
  D({
    path: 'work-log/logs/changes', zone: 'tree', kind: 'variable', entry_type: 'change_record',
    fed_by: ['owner', 'path:work-log/creation/review'], read_by: ['owner'],
    switch: 'logs.changes', states: ['active', 'history', 'hidden'], history: 'append_only',
    audience: 'owner',
    note: 'Alterations to the standing agreement; out-of-scope review asks auto-route here (S20).',
  }),
  D({
    path: 'work-log/logs/pipelines', zone: 'tree', kind: 'variable', entry_type: 'pipeline',
    fed_by: ['owner', 'collaborator'], read_by: ['owner'],
    switch: 'logs.pipelines.lists', states: ['active', 'history', 'hidden'], history: 'mutable_with_supersession',
    audience: 'owner',
    note: 'Law-4 addition ratified into PLAN §3.',
  }),
  D({
    path: 'work-log/logs/pipelines/lists', zone: 'tree', kind: 'variable', entry_type: 'pipeline',
    fed_by: ['owner', 'collaborator'], read_by: ['owner'],
    switch: 'logs.pipelines.lists', states: ['active', 'history', 'hidden'], history: 'mutable_with_supersession',
    audience: 'owner',
    note: 'Shared lists (spec 12): she shares ONE list into another workspace. The collaborator writes rows only, verified against the authoritative state — not a client door.',
  }),
  D({
    path: 'work-log/logs/pipelines/lists/*', zone: 'tree', kind: 'entry', entry_type: 'pipeline_row',
    fed_by: ['owner', 'collaborator'], read_by: ['owner'],
    switch: 'logs.pipelines.lists', states: ['active', 'history', 'hidden'], history: 'mutable_with_supersession',
    audience: 'owner',
    note: 'A list is an entry folder; its rows live inside it (law 2).',
  }),
  D({
    path: 'work-log/logs/pipelines/cold-calls', zone: 'tree', kind: 'variable', entry_type: 'pipeline',
    fed_by: ['owner'], read_by: ['owner', 'context/business-details/market'],
    switch: 'logs.pipelines.cold_calls', states: ['active', 'history', 'hidden'], history: 'mutable_with_supersession',
    audience: 'owner',
  }),
  D({
    path: 'work-log/logs/pipelines/orders', zone: 'tree', kind: 'variable', entry_type: 'pipeline',
    fed_by: ['owner'], read_by: ['owner'],
    switch: 'logs.pipelines.orders', states: ['active', 'history', 'hidden'], history: 'mutable_with_supersession',
    audience: 'owner',
  }),
  D({
    path: 'work-log/logs/effort', zone: 'tree', kind: 'variable', entry_type: 'effort_day',
    fed_by: ['owner', 'path:work-log/creation'], read_by: ['owner'],
    switch: 'logs.effort_meter', states: ['active', 'history', 'hidden'], history: 'append_only',
    audience: 'owner',
    note: 'Law-4 addition. HER PROFILES ONLY (PLAN §7) — absent from client profiles entirely.',
  }),
  D({
    path: 'work-log/logs/observations', zone: 'tree', kind: 'variable', entry_type: 'observation',
    fed_by: ['owner', 'pipe:chat', 'pipe:whatsapp'], read_by: ['owner'],
    switch: 'logs.observations', states: ['active', 'history', 'hidden'], history: 'append_only',
    audience: 'owner',
    note: 'Law-4 addition. Her private notes. Soft signals — never the engine’s math.',
  }),

  // analysis (PLAN §3.8)
  D({
    path: 'work-log/analysis', zone: 'tree', kind: 'variable', entry_type: 'analysis_record',
    fed_by: ['engine:analysis'], read_by: ['owner', 'client'],
    switch: 'analysis.scorecard', states: ['active', 'history', 'hidden'], history: 'append_only',
    audience: 'both', client_door: 'see:analysis',
  }),
  D({
    path: 'work-log/analysis/study-own-data', zone: 'tree', kind: 'variable', entry_type: 'metric_observation',
    fed_by: ['pipe:ig-sync', 'pipe:platform-metrics'],
    read_by: ['engine:analysis', 'work-log/creation/topics'],
    switch: 'analysis.tracking', states: ['active', 'history'], history: 'append_only',
    audience: 'owner',
    note: 'BODY-owned, immutable observations (S3). Coverage gaps stay visible (S7).',
  }),
  D({
    path: 'work-log/analysis/goal-tracking', zone: 'tree', kind: 'variable', entry_type: 'goal_progress',
    fed_by: ['owner', 'engine:analysis'], read_by: ['owner', 'client'],
    switch: 'analysis.goal_tracking', states: ['active', 'history', 'hidden'], history: 'append_only',
    audience: 'both', client_door: 'see:analysis',
    note: 'Reads content-strategy/goals; blocked per goal until that goal has its S16 declaration.',
  }),
  D({
    path: 'work-log/analysis/client-perception', zone: 'tree', kind: 'variable', entry_type: 'perception_note',
    fed_by: ['client', 'owner'], read_by: ['owner'],
    switch: 'creation.review_perception', states: ['active', 'history', 'hidden'], history: 'append_only',
    audience: 'both', client_door: 'give:perception',
    note: 'Give-point 4. Recorded, never fed into the engine’s verdict math.',
  }),
  D({
    path: 'work-log/analysis/market-research', zone: 'tree', kind: 'variable', entry_type: 'research_note',
    fed_by: ['owner', 'engine:analysis'], read_by: ['owner', 'context/content-strategy'],
    switch: 'analysis.market_research', states: ['active', 'history', 'hidden'], history: 'append_only',
    audience: 'owner',
    note: 'Parameters deliberately open until the first real need (law 4).',
  }),
  D({
    path: 'work-log/analysis/comparisons', zone: 'tree', kind: 'variable', entry_type: 'matched_comparison',
    fed_by: ['owner', 'engine:analysis'], read_by: ['owner'],
    switch: 'analysis.compare', states: ['active', 'history', 'hidden'], history: 'append_only',
    audience: 'owner',
    note: 'Matched comparisons (S5): hypothesis, held/changed variables, windows, baseline.',
  }),
  D({
    path: 'work-log/analysis/digests', zone: 'tree', kind: 'variable', entry_type: 'digest',
    fed_by: ['engine:analysis'], read_by: ['owner', 'client'],
    switch: 'analysis.digest_owner', states: ['active', 'history', 'hidden'], history: 'append_only',
    audience: 'both', client_door: 'see:analysis',
    note: 'Her digest displays automatically; a client digest is hers to approve or edit first.',
  }),

  // ── Frozen: retained, read-only, not rendered, not migrated ────────────────
  D({
    path: 'frozen/chat-log', zone: 'frozen', kind: 'variable', entry_type: 'chat_message',
    fed_by: ['owner'], read_by: ['owner'],
    switch: 'owner.chat', states: ['history'], history: 'none', audience: 'owner',
    note: 'PLAN §11 Q1: the chat is HELD. It keeps working exactly as today, outside the tree.',
  }),
  D({
    path: 'frozen/observations-inbox', zone: 'frozen', kind: 'variable', entry_type: 'observation',
    fed_by: ['owner'], read_by: ['owner'],
    switch: 'owner.chat', states: ['history'], history: 'none', audience: 'owner',
    note: 'PLAN §11 Q1: untagged observations are HELD with the chat. Not migrated.',
  }),
  D({
    path: 'frozen/legacy-cards', zone: 'frozen', kind: 'variable', entry_type: 'legacy',
    fed_by: [], read_by: [], switch: 'frozen.legacy', states: ['history'], history: 'none',
    audience: 'owner',
    note: 'The 2026-07-10 safety copy (cards, pillarCards). Migrated once already — never twice.',
  }),
  D({
    path: 'frozen/studio', zone: 'frozen', kind: 'variable', entry_type: 'legacy',
    fed_by: [], read_by: [], switch: 'frozen.legacy', states: ['history'], history: 'none',
    audience: 'owner',
    note: 'An in-dashboard design canvas is not the direction (PLAN §3.10).',
  }),
  D({
    path: 'frozen/custom-fields', zone: 'frozen', kind: 'variable', entry_type: 'legacy',
    fed_by: [], read_by: [], switch: 'frozen.legacy', states: ['history'], history: 'none',
    audience: 'owner',
    note: 'Free-form per-client fields contradict law 2. Values stay readable; new ones must be declared.',
  }),
  D({
    path: 'frozen/journey-next-steps', zone: 'frozen', kind: 'variable', entry_type: 'legacy',
    fed_by: [], read_by: [], switch: 'frozen.legacy', states: ['history'], history: 'none',
    audience: 'owner',
    note: 'Already rejected once — she wants data, not text sections.',
  }),
  D({
    path: 'frozen/card-role', zone: 'frozen', kind: 'variable', entry_type: 'legacy',
    fed_by: [], read_by: [], switch: 'frozen.legacy', states: ['history'], history: 'none',
    audience: 'owner',
    note: 'Pillar jobs superseded ContentCard.role.',
  }),
  D({
    path: 'frozen/debug', zone: 'frozen', kind: 'variable', entry_type: 'legacy',
    fed_by: [], read_by: [], switch: 'frozen.legacy', states: ['history'], history: 'none',
    audience: 'owner',
  }),

  // ── Leaves: exits the dashboard (PLAN §7) ─────────────────────────────────
  D({
    path: 'leaves/my-day-personal', zone: 'leaves', kind: 'variable', entry_type: 'legacy',
    fed_by: [], read_by: [], switch: 'leaves.exported', states: ['history'], history: 'none',
    audience: 'owner',
    note: 'Personal tasks and day tracking leave. Exported to the vault, removed only on her word.',
  }),
  D({
    path: 'leaves/brain-dump', zone: 'leaves', kind: 'variable', entry_type: 'legacy',
    fed_by: [], read_by: [], switch: 'leaves.exported', states: ['history'], history: 'none',
    audience: 'owner',
  }),
  D({
    path: 'leaves/container-map', zone: 'leaves', kind: 'variable', entry_type: 'legacy',
    fed_by: [], read_by: [], switch: 'leaves.exported', states: ['history'], history: 'none',
    audience: 'owner',
  }),
];

// ── Lookup ───────────────────────────────────────────────────────────────────

const BY_PATH = new Map<string, PathDeclaration>();
for (const d of DECLARATIONS) {
  if (BY_PATH.has(d.path)) throw new Error(`[tree] duplicate declaration: ${d.path}`);
  BY_PATH.set(d.path, d);
}

/** Turn a concrete path into its declared form (entry names → `*`). */
export function declaredForm(path: string): string | null {
  if (BY_PATH.has(path)) return path;
  const parts = path.split('/');
  // Try replacing each segment with `*`, deepest entry name first. Two wildcard
  // levels is as deep as law 2 goes (variable → entry → parameter).
  for (let i = parts.length - 1; i >= 0; i--) {
    const candidate = [...parts.slice(0, i), '*', ...parts.slice(i + 1)].join('/');
    if (BY_PATH.has(candidate)) return candidate;
  }
  return null;
}

export function findDeclaration(path: string): PathDeclaration | null {
  const form = declaredForm(path);
  return form ? BY_PATH.get(form)! : null;
}

export function isDeclared(path: string): boolean {
  return declaredForm(path) !== null;
}

/**
 * Law 4, at runtime: a read or write against an undeclared path throws.
 * Nothing in the app addresses data any other way.
 */
export function assertDeclared(path: string, op: 'read' | 'write' = 'read'): PathDeclaration {
  const dec = findDeclaration(path);
  if (!dec) throw new Error(`[tree] no address, no ${op}: "${path}" is not declared (PLAN law 4)`);
  return dec;
}

/**
 * Law 3: connections belong to the FOLDER. Anything added inside inherits them,
 * so a fourth pillar or a new platform is wired the moment it exists — the
 * readers are read off the declaration, never re-registered per entry.
 */
export function readersOf(path: string): string[] {
  const readers = new Set<string>();
  const parts = path.split('/');
  for (let i = parts.length; i > 0; i--) {
    const dec = findDeclaration(parts.slice(0, i).join('/'));
    for (const r of dec?.read_by ?? []) readers.add(r);
  }
  return [...readers];
}

export function writersOf(path: string): string[] {
  const writers = new Set<string>();
  const parts = path.split('/');
  for (let i = parts.length; i > 0; i--) {
    const dec = findDeclaration(parts.slice(0, i).join('/'));
    for (const w of dec?.fed_by ?? []) writers.add(w);
  }
  return [...writers];
}

export function declarationsUnder(prefix: string): PathDeclaration[] {
  return DECLARATIONS.filter(d => d.path === prefix || d.path.startsWith(prefix + '/'));
}

export const TREE_PATHS = DECLARATIONS.filter(d => d.zone === 'tree').map(d => d.path);
