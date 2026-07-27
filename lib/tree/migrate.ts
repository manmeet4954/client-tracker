// Migration — spec 21 §9. Ordered, versioned, and boring on purpose.
//
// Rules this file obeys, and the reasons they exist:
//  - Nothing is deleted. Legacy slices stay exactly where they are; the body is
//    written ALONGSIDE them, and the screens keep rendering what they render
//    today until the GUI spec moves over (§9.7, and PLAN §2's redesign is its
//    own spec).
//  - Nothing is guessed. A value with no source in the old data is written with
//    `confidence: legacy-unverified`, or it is not written at all and goes to
//    her sort queue instead.
//  - Switches are NOT set (§9.6). Migration only SUGGESTS positions from what
//    the profile actually has; she sets them after intake → curation → strategy.

import type { Client, ClientData, ContentCard, Observation } from '../../types/index.ts';
import type { PathState, SwitchConfig } from './contract.ts';
import type { ProfileBody, SortQueueItem } from './body.ts';
import { BODY_VERSION, emptyBody, putEntry, queueForHerSort } from './body.ts';
import type { Confidence, PieceStage, Provenance } from './objects.ts';
import { platformSwitchId } from './switches.ts';
import { formatFamilyOf, legacyDraftPayload } from '../engine/drafts.ts';

export interface MovedRow { path: string; count: number; from: string }
export interface RefusedRow { what: string; why: string }
export interface FrozenRow { slice: string; why: string }
export interface SuggestedRow { switchId: string; state: PathState; why: string }

export interface MigrationReport {
  profileId: string;
  profileName: string;
  ownerKind: 'client' | 'hers';
  at: string;
  bodyVersion: number;
  moved: MovedRow[];
  legacyUnverified: { path: string; entryId: string; why: string }[];
  needsHerSort: SortQueueItem[];
  frozen: FrozenRow[];
  refused: RefusedRow[];
  suggestedSwitches: SuggestedRow[];
  totals: { paths: number; entries: number };
}

export interface MigrationResult {
  body: ProfileBody;
  report: MigrationReport;
  /** Suggestions only. Stored separately from her real positions. */
  suggestedSwitches: SwitchConfig;
}

const CURATOR = 'migration:spec-21';

function slug(s: string): string {
  return (s || 'unnamed').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function legacy(source: string, confidence: Confidence = 'legacy-unverified', at = ''): Provenance {
  return { source_refs: [source], curator: CURATOR, at, confidence };
}

/** Stage mapping (§8.5). `ready` → `approved` is honest: today "ready" means she
 *  is done, and no client verdict was ever recorded. `review` has no legacy data. */
const STAGE_MAP: Record<ContentCard['stage'], PieceStage> = {
  idea: 'idea',
  writing: 'build',
  ready: 'approved',
  scheduled: 'scheduled',
  posted: 'posted',
};

export function migrateProfile(
  client: Client,
  data: ClientData,
  opts: { now?: string; observations?: Observation[] } = {},
): MigrationResult {
  const now = opts.now ?? new Date().toISOString();
  const ownerKind = client.ownerKind ?? 'client';
  let body = emptyBody(now);

  const moved: MovedRow[] = [];
  const legacyUnverified: MigrationReport['legacyUnverified'] = [];
  const frozen: FrozenRow[] = [];
  const refused: RefusedRow[] = [];
  const suggested: SuggestedRow[] = [];
  const suggestedSwitches: SwitchConfig = {};

  const write = (path: string, id: string, type: string, entryData: Record<string, unknown>, prov?: Provenance) => {
    body = putEntry(body, path, { id, type, data: entryData, provenance: prov }, { writer: 'owner', now });
  };
  const record = (path: string, count: number, from: string) => {
    if (count > 0) moved.push({ path, count, from });
  };
  const ask = (entryId: string, path: string, question: string) => {
    body = queueForHerSort(body, { entry_id: entryId, path, question });
  };
  const unverified = (path: string, entryId: string, why: string) => {
    legacyUnverified.push({ path, entryId, why });
  };
  const suggest = (switchId: string, state: PathState, why: string) => {
    suggested.push({ switchId, state, why });
    suggestedSwitches[switchId] = { state, set_at: now, suggested: true };
  };

  // ── context/intake — the legacy questionnaire becomes round 0 ─────────────
  if ((data.onboarding ?? []).length) {
    write('context/intake', 'round-0', 'intake_round', {
      version: 0,
      parameters: data.onboarding.map(o => o.id),
      delivery: 'dashboard-questionnaire',
      status: 'answered',
      curation: {},
      opened_at: now,
      legacy: true,
    }, legacy('onboarding[]', 'legacy-unverified', now));
    for (const item of data.onboarding) {
      write('context/intake/questions', `q-${item.id}`, 'question',
        { text: item.question, legacy: true, regenerate_from_parameters: true },
        legacy(`onboarding[${item.id}].question`, 'legacy-unverified', now));
      write('context/intake/answers', `a-${item.id}`, 'answer',
        { round: 0, question: item.question, answer: item.answer },
        legacy(`onboarding[${item.id}].answer`, 'confirmed', now));
    }
    record('context/intake/answers', data.onboarding.length, 'onboarding[]');
    record('context/intake/questions', data.onboarding.length, 'onboarding[] (legacy wording)');
    ask('round-0', 'context/intake/questions',
      'These questions were written by hand. They get regenerated from the detail folders’ parameters after your vocabulary session (PLAN §3.1).');
    suggest('intake.questionnaire', 'history', 'this profile answered a questionnaire already');
  }

  // ── context/business-details ──────────────────────────────────────────────
  for (const s of data.brand?.services ?? []) {
    write('context/business-details/offers', `offer-${s.id}`, 'curated_parameter',
      { key: 'offer', name: s.name, description: s.description, price: s.price, hero: false },
      legacy(`brand.services[${s.id}]`, 'legacy-unverified', now));
    unverified('context/business-details/offers', `offer-${s.id}`, 'no hero offer was ever marked');
  }
  record('context/business-details/offers', (data.brand?.services ?? []).length, 'brand.services[]');
  if ((data.brand?.services ?? []).length) {
    ask('offers', 'context/business-details/offers', 'Which of these is the hero offer?');
  }

  if (data.brand?.audience) {
    write('context/business-details/audience-raw', 'audience-legacy', 'curated_parameter',
      { key: 'audience', value: data.brand.audience },
      legacy('brand.audience', 'legacy-unverified', now));
    write('context/content-strategy/audience-decided', 'audience-legacy', 'strategy_parameter',
      { key: 'audience', value: data.brand.audience, stage_lens: null },
      legacy('brand.audience', 'legacy-unverified', now));
    unverified('context/content-strategy/audience-decided', 'audience-legacy',
      'the raw/decided split does not exist in the old field — one value was copied to both');
    record('context/business-details/audience-raw', 1, 'brand.audience');
    ask('audience-legacy', 'context/content-strategy/audience-decided',
      'The old dashboard had one audience field. Which part of this is what they said, and which part is what you decided?');
  }

  // ── context/content-strategy ──────────────────────────────────────────────
  if (data.brand?.tagline || data.brand?.strategy) {
    write('context/content-strategy/positioning', 'positioning-legacy', 'strategy_parameter',
      { tagline: data.brand?.tagline ?? '', strategy: data.brand?.strategy ?? '', derived: false },
      legacy('brand.tagline + brand.strategy', 'legacy-unverified', now));
    unverified('context/content-strategy/positioning', 'positioning-legacy',
      'legacy free text, kept as written, pending derivation from the detail folders');
    record('context/content-strategy/positioning', 1, 'brand.tagline, brand.strategy');
  }

  const kit = data.brandKit;
  if (kit && ((kit.colors ?? []).length || (kit.fonts ?? []).length || (kit.logos ?? []).length)) {
    write('context/content-strategy/visual-branding', 'brand-kit', 'strategy_parameter',
      { colors: kit.colors ?? [], fonts: kit.fonts ?? [], logos: kit.logos ?? [] },
      legacy('brandKit', 'confirmed', now));
    record('context/content-strategy/visual-branding', 1, 'brandKit');
  }

  // pillars — each pillar becomes an entry FOLDER with its own parameters (law 2)
  for (const p of data.pillars ?? []) {
    const key = slug(p.name) || p.id;
    const root = `context/content-strategy/pillars/${key}`;
    write(root, p.id, 'pillar', { name: p.name, color: p.color, legacy_id: p.id, created_at: p.createdAt },
      legacy(`pillars[${p.id}]`, 'confirmed', now));
    if (p.job) {
      write(`${root}/job`, `${p.id}-job`, 'pillar_parameter',
        { job: p.job, purpose: p.purpose ?? '', regime_since: p.jobChangedAt ?? p.createdAt },
        legacy(`pillars[${p.id}].job`, 'confirmed', now));
    } else {
      ask(p.id, `${root}/job`, `Pillar "${p.name}" has no job yet — is it reach, trust or convert? Analysis cannot judge it until it has one.`);
    }
    if (typeof p.targetPct === 'number') {
      write(`${root}/mix-target`, `${p.id}-mix`, 'pillar_parameter', { target_pct: p.targetPct },
        legacy(`pillars[${p.id}].targetPct`, 'confirmed', now));
    }
    if (p.purpose) {
      write(`${root}/description`, `${p.id}-desc`, 'pillar_parameter', { text: p.purpose },
        legacy(`pillars[${p.id}].purpose`, 'confirmed', now));
    }
  }
  record('context/content-strategy/pillars/*', (data.pillars ?? []).length, 'pillars[]');

  // platforms — each becomes a folder; formats live INSIDE it
  const platforms = (data.platforms ?? []).length ? data.platforms! : ['Instagram'];
  const formatsUsed = new Map<string, Set<string>>();
  for (const card of data.contentCards ?? []) {
    const plat = card.platform || platforms[0];
    if (!card.contentType) continue;
    const set = formatsUsed.get(plat) ?? new Set<string>();
    set.add(card.contentType);
    formatsUsed.set(plat, set);
  }
  for (const platform of platforms) {
    const key = slug(platform);
    write(`context/content-strategy/platforms/${key}`, key, 'platform',
      { name: platform }, legacy('platforms[]', 'confirmed', now));
    const formats = [...(formatsUsed.get(platform) ?? [])];
    for (const f of formats) {
      write(`context/content-strategy/platforms/${key}/formats`, `${key}-${slug(f)}`, 'format',
        { name: f }, legacy('ContentCard.contentType (observed on this platform)', 'confirmed', now));
    }
    if (!formats.length) {
      ask(key, `context/content-strategy/platforms/${key}/formats`,
        `No content has been made for ${platform} yet — which formats does this profile use there?`);
    }
    if (key === 'instagram' && data.instagram?.handle) {
      write(`context/content-strategy/platforms/${key}/connection`, `${key}-conn`, 'platform_parameter',
        { handle: data.instagram.handle, api_status: 'see ig_accounts', linked: true },
        legacy('instagram', 'confirmed', now));
    }
    suggest(platformSwitchId(platform), 'active', `this profile has content or an account on ${platform}`);
  }
  record('context/content-strategy/platforms/*', platforms.length, 'platforms[] + DEFAULT_PLATFORMS');
  // A format the old global list offered but this profile never used is NOT
  // assigned to a platform on a guess.
  const unusedGlobalFormats = ['Static', 'Carousel', 'Reel', 'Poster', 'Banner', 'PDF', 'Presentation']
    .filter(f => ![...formatsUsed.values()].some(set => set.has(f)));
  if (unusedGlobalFormats.length) {
    ask('formats', 'context/content-strategy/platforms',
      `These formats existed in the old global list but this profile never used them: ${unusedGlobalFormats.join(', ')}. Which platforms should offer them?`);
  }
  for (const p of ['Instagram', 'LinkedIn', 'YouTube']) {
    if (!platforms.includes(p)) {
      suggest(platformSwitchId(p), 'hidden', `nothing in this profile touches ${p}`);
    }
  }

  if (typeof data.postTarget === 'number' && data.postTarget > 0) {
    write('context/content-strategy/cadence', 'cadence-legacy', 'strategy_parameter',
      { posts_per_month: data.postTarget },
      legacy('postTarget', 'confirmed', now));
    record('context/content-strategy/cadence', 1, 'postTarget');
  }

  // goals — every goal needs an S16 metric declaration before analysis reads it
  const goalRows: { id: string; label: string; from: string }[] = [];
  for (const g of data.goals ?? []) goalRows.push({ id: `goal-${g}`, label: g, from: 'goals[]' });
  for (const g of data.brand?.goals ?? []) goalRows.push({ id: `goal-${slug(g)}`, label: g, from: 'brand.goals[]' });
  if (data.journey?.northStar) {
    goalRows.push({ id: 'goal-north-star', label: data.journey.northStar, from: 'journey.northStar' });
  }
  for (const g of goalRows) {
    write('context/content-strategy/goals', g.id, 'goal', {
      label: g.label,
      north_star: g.id === 'goal-north-star',
      target_value: g.id === 'goal-north-star' ? data.journey?.targetValue ?? null : null,
      target_date: g.id === 'goal-north-star' ? data.journey?.targetDate ?? null : null,
      metric_declaration: null,
    }, legacy(g.from, 'confirmed', now));
    unverified('context/content-strategy/goals', g.id, 'no S16 metric declaration — analysis stays blocked on this goal');
    ask(g.id, 'context/content-strategy/goals',
      `Goal "${g.label}" has no metric declaration yet: which metric, which direction, which window, which target? Analysis will not read it until it does (S16).`);
  }
  record('context/content-strategy/goals', goalRows.length, 'goals[], brand.goals[], journey.northStar');

  // ── work-log/creation — seeds first, then the one canonical piece ─────────
  const seedShells = [
    ...(data.topics ?? []).map(t => ({ id: t.id, name: t.name, raw: t.name, from: `topics[${t.id}]` })),
    ...(data.evergreenIdeas ?? []).map(e => ({
      id: e.id, name: e.title, raw: [e.title, e.notes].filter(Boolean).join(' — '), from: `evergreenIdeas[${e.id}]`,
    })),
  ];
  for (const s of seedShells) {
    write('work-log/creation/topics', s.id, 'seed', {
      name: s.name,
      raw_thought: '',
      raw_material: [{ at: now, source: s.from, text: s.raw }],
      status: 'draft',
      origin: 'hers',
      possible_pillars: [],
      possible_angles: [],
    }, legacy(s.from, 'legacy-unverified', now));
    unverified('work-log/creation/topics', s.id,
      'a topic is capture INPUT, not a seed (S24) — it has no raw thought until she narrates it');
    ask(s.id, 'work-log/creation/topics',
      `"${s.name}" came over as a subject, not a seed. Talk it out once and the engine can build from it; until then it cannot be locked.`);
  }
  record('work-log/creation/topics', seedShells.length, 'topics[] + evergreenIdeas[] (as draft seed shells)');

  const seedIds = new Set(seedShells.map(s => s.id));
  let makingCount = 0;
  let scheduleCount = 0;
  const comparisons: string[] = [];

  for (const card of data.contentCards ?? []) {
    const stage = STAGE_MAP[card.stage];
    const platform = card.platform || platforms[0];
    // The piece: ONE identity, owned by creation/ (S2).
    write('work-log/creation', card.id, 'piece', {
      seed_id: card.topicId && seedIds.has(card.topicId) ? card.topicId : null,
      title: card.title,
      hook: card.hook ?? '',
      stage,
      costume: {
        pillar_id: card.pillarId || null,
        platform,
        format: card.contentType || null,
      },
      // S15: a birth record only where there was really a birth. A card still
      // in idea stage never had one, and we do not invent it.
      birth: stage === 'posted' || stage === 'scheduled' ? {
        at: card.createdAt,
        costume: { pillar_id: card.pillarId, platform, format: card.contentType },
        pillar_job: (data.pillars ?? []).find(p => p.id === card.pillarId)?.job ?? null,
        goal_mapping: [],
        gate_version: null,
        strategy_version: null,
      } : null,
      channel_id: platform === 'Instagram' && data.instagram?.handle ? `ch-${slug(data.instagram.handle)}` : null,
      scheduled_date: card.scheduledDate || null,
      live_link: card.postUrl || null,
      created_month: card.createdMonth,
      notes: card.notes ?? '',
    }, legacy(`contentCards[${card.id}]`, 'confirmed', now));

    if (stage === 'posted' || stage === 'scheduled') {
      unverified('work-log/creation', card.id,
        'the birth snapshot was reconstructed from the card, not recorded at build time — gate and strategy versions are unknown');
    }

    // The draft body becomes version 1 in making/ — from here versions are kept.
    //
    // Spec 25 §13.1: it migrates as draft version 1 with `origin: 'hers'` and
    // `engine_run_id: null`. Nothing is attributed to the engine that the engine
    // did not write, and `gate_set_version: null` is honest — this text predates
    // the gate set entirely, and no piece is ever retro-gated.
    if (card.content || card.hook || card.link) {
      const family = formatFamilyOf(card.contentType ?? '', platform);
      write('work-log/creation/making', `${card.id}-v1`, 'draft_version', {
        piece_id: card.id, version: 1, origin: 'hers',
        brief_version: 0, gate_set_version: null, strategy_version: null,
        format_rules_resolution: 'legacy', format_rules_version: 0,
        format_family: family,
        content: legacyDraftPayload({ family, hook: card.hook ?? '', text: card.content ?? '' }),
        claims: [], proof_refs: [], asset_refs: [],
        engine_run_id: null, gate_run_id: null,
        link: card.link ?? '',
      }, legacy(`contentCards[${card.id}].content`, 'confirmed', now));
      makingCount++;
    }
    if (card.scheduledDate) {
      write('work-log/creation/scheduling', `${card.id}-sched`, 'schedule_record', {
        piece_id: card.id, date: card.scheduledDate, channel_id: platform === 'Instagram' ? `ch-${slug(data.instagram?.handle ?? 'instagram')}` : null,
      }, legacy(`contentCards[${card.id}].scheduledDate`, 'confirmed', now));
      scheduleCount++;
    }
    if (card.experiment?.hypothesis) {
      const id = `cmp-${card.id}`;
      write('work-log/analysis/comparisons', id, 'matched_comparison', {
        hypothesis: card.experiment.hypothesis,
        piece_ids: [card.id],
        held_variables: [],
        changed_variable: 'unknown',
        posting_windows: [],
        confounders: [],
        window: '7d',
        state: 'not-enough-comparable-data',
      }, legacy(`contentCards[${card.id}].experiment`, 'legacy-unverified', now));
      unverified('work-log/analysis/comparisons', id,
        'the old experiment flag recorded only a hypothesis — held and changed variables are unknown and are NOT inferred (S5)');
      comparisons.push(id);
      ask(id, 'work-log/analysis/comparisons',
        `This test recorded a hypothesis but not what was held and what changed. Which one variable was different?`);
    }
    if (card.role) {
      // Superseded by pillar jobs — read the frozen note, do not migrate.
    }
  }
  record('work-log/creation', (data.contentCards ?? []).length, 'contentCards[] (the canonical piece)');
  record('work-log/creation/making', makingCount, 'the draft body on each card');
  record('work-log/creation/scheduling', scheduleCount, 'ContentCard.scheduledDate');
  record('work-log/analysis/comparisons', comparisons.length, 'ContentCard.experiment');

  // review — previews were never linked to a card, so the link is not invented
  for (const pv of data.previewPosts ?? []) {
    write('work-log/creation/review', pv.id, 'review_record', {
      piece_id: null,
      share_id: pv.shareId,
      name: pv.name,
      post_type: pv.postType,
      images: pv.images,
      caption: pv.caption,
      verdict: null,
    }, legacy(`previewPosts[${pv.id}]`, 'legacy-unverified', now));
    unverified('work-log/creation/review', pv.id,
      'previews were never linked to a content card, and no client verdict was ever recorded');
    ask(pv.id, 'work-log/creation/review', `Which piece is the preview "${pv.name}" for?`);
  }
  record('work-log/creation/review', (data.previewPosts ?? []).length, 'previewPosts[]');

  // channels — identity and posting permission, split from the platform (S17)
  if (data.instagram?.handle) {
    const id = `ch-${slug(data.instagram.handle)}`;
    write('work-log/creation/channels', id, 'channel', {
      platform: 'Instagram',
      account_handle: data.instagram.handle,
      ownership: 'unknown',
      connection: 'connected',
      timezone: null,
      posting_permission: 'unknown',
    }, legacy('instagram', 'legacy-unverified', now));
    unverified('work-log/creation/channels', id, 'ownership, timezone and posting permission were never recorded');
    ask(id, 'work-log/creation/channels',
      `For @${data.instagram.handle}: whose account is it, what timezone does it report in, and do we post or do they? Metrics cannot be read by age without the timezone (S7).`);
    record('work-log/creation/channels', 1, 'instagram');
    suggest('creation.channels', 'active', 'this profile has a connected account');
  }
  for (const jc of data.journey?.channels ?? []) {
    write('work-log/creation/channels', `jc-${jc.id}`, 'channel', {
      platform: jc.name, account_handle: '', ownership: 'unknown', connection: 'never-connected',
      timezone: null, posting_permission: 'unknown', note: jc.note,
    }, legacy(`journey.channels[${jc.id}]`, 'legacy-unverified', now));
  }
  record('work-log/creation/channels', (data.journey?.channels ?? []).length, 'journey.channels[]');

  // the reply scripts the body holds
  for (const la of data.leadAnswers ?? []) {
    write('work-log/creation/funnel/replies', la.id, 'reply_script', {
      category: la.category, question: la.question, reply: la.reply, rule: la.rule ?? '',
    }, legacy(`leadAnswers[${la.id}]`, 'confirmed', now));
  }
  record('work-log/creation/funnel/replies', (data.leadAnswers ?? []).length, 'leadAnswers[]');
  if ((data.leadAnswers ?? []).length) suggest('creation.funnel_replies', 'active', 'this profile has reply scripts');

  // ── assets and references ────────────────────────────────────────────────
  for (const set of data.assetSets ?? []) {
    write('work-log/assets/sets', set.id, 'asset_set', { name: set.name, created_at: set.createdAt, source: 'assets' },
      legacy(`assetSets[${set.id}]`, 'confirmed', now));
    for (const item of (data.assetItems ?? []).filter(i => i.setId === set.id)) {
      write(`work-log/assets/sets/${set.id}`, item.id, 'asset', {
        url: item.url, thumb_url: item.thumbUrl, file_name: item.fileName, size: item.size,
        uploaded_by: item.uploadedBy,
        rights: {
          ownership: 'unknown', consent: 'unknown', permitted_platforms: [], permitted_uses: [],
          expiry: null, attribution_required: null, subject_releases: [], restriction: 'none',
        },
      }, legacy(`assetItems[${item.id}]`, 'confirmed', now));
      unverified(`work-log/assets/sets/${set.id}`, item.id,
        'no rights were ever recorded — a gate blocks publication until they are (S21)');
    }
  }
  record('work-log/assets/sets', (data.assetSets ?? []).length, 'assetSets[]');
  record('work-log/assets/sets/*', (data.assetItems ?? []).length, 'assetItems[]');
  if ((data.assetItems ?? []).length) {
    ask('assets', 'work-log/assets/sets',
      'None of the existing photos carry rights (who owns them, what they may be used for). Publication gates need them (S21).');
    suggest('assets.library', 'active', 'this profile has assets');
  }
  if (data.driveFolderUrl) {
    write('work-log/assets/sets', 'drive-videos', 'asset_set',
      { name: 'Videos (Drive)', external_url: data.driveFolderUrl, source: 'drive' },
      legacy('driveFolderUrl', 'confirmed', now));
    suggest('assets.drive_videos', 'active', 'this profile has a Drive video folder');
  }
  for (const cat of data.catalogueCategories ?? []) {
    write('work-log/assets/sets', `cat-${cat.id}`, 'asset_set',
      { name: cat.name, source: 'catalogue', created_at: cat.createdAt },
      legacy(`catalogueCategories[${cat.id}]`, 'confirmed', now));
    for (const item of (data.catalogueItems ?? []).filter(i => i.categoryId === cat.id)) {
      write(`work-log/assets/sets/cat-${cat.id}`, item.id, 'asset', {
        url: item.imageUrl, thumb_url: item.imageUrl, file_name: '', size: 0, uploaded_by: 'owner',
        rights: {
          ownership: 'unknown', consent: 'unknown', permitted_platforms: [], permitted_uses: [],
          expiry: null, attribution_required: null, subject_releases: [], restriction: 'none',
        },
      }, legacy(`catalogueItems[${item.id}]`, 'confirmed', now));
    }
  }
  record('work-log/assets/sets (catalogue)', (data.catalogueCategories ?? []).length, 'catalogueCategories[]');
  if ((data.catalogueItems ?? []).length) suggest('assets.catalogue_export', 'active', 'this profile uses the catalogue');

  for (const ref of data.references ?? []) {
    write('work-log/references/our-vision', ref.id, 'reference', {
      type: ref.type, content: ref.content, title: ref.title, pinned: ref.pinned, source: 'unknown',
    }, legacy(`references[${ref.id}]`, 'legacy-unverified', now));
    unverified('work-log/references/our-vision', ref.id,
      'legacy references carry no source signal — never attributed to the client without evidence');
  }
  record('work-log/references/our-vision', (data.references ?? []).length, 'references[]');
  if ((data.references ?? []).length) {
    ask('references', 'work-log/references/our-vision',
      'Which of these references came FROM the client, and which are ours? They all landed in our-vision because the old data never said.');
  }

  // ── logs ─────────────────────────────────────────────────────────────────
  let agendaCount = 0;
  for (const [month, md] of Object.entries(data.monthData ?? {})) {
    for (const item of md.agenda ?? []) {
      write('work-log/logs/tasks', item.id, 'task', {
        text: item.text, due_date: item.dueDate, done: item.done, month,
      }, legacy(`monthData[${month}].agenda[${item.id}]`, 'confirmed', now));
      agendaCount++;
    }
  }
  record('work-log/logs/tasks', agendaCount, 'monthData[].agenda[]');

  for (const list of data.lists ?? []) {
    write('work-log/logs/pipelines/lists', list.id, 'pipeline', {
      name: list.name, stages: list.stages, shared_with: list.sharedWith ?? [],
    }, legacy(`lists[${list.id}]`, 'confirmed', now));
    for (const row of (data.listRows ?? []).filter(r => r.listId === list.id)) {
      write(`work-log/logs/pipelines/lists/${list.id}`, row.id, 'pipeline_row', {
        stage_id: row.stageId, name: row.name, link: row.link ?? '', note: row.note ?? '',
      }, legacy(`listRows[${row.id}]`, 'confirmed', now));
    }
  }
  record('work-log/logs/pipelines/lists', (data.lists ?? []).length, 'lists[]');
  record('work-log/logs/pipelines/lists/*', (data.listRows ?? []).length, 'listRows[]');

  for (const cc of data.coldCalls ?? []) {
    write('work-log/logs/pipelines/cold-calls', cc.id, 'pipeline', {
      name: cc.name, phone: cc.phone, location: cc.location, status: cc.status,
      response: cc.response, notes: cc.notes,
    }, legacy(`coldCalls[${cc.id}]`, 'confirmed', now));
  }
  record('work-log/logs/pipelines/cold-calls', (data.coldCalls ?? []).length, 'coldCalls[]');
  if ((data.coldCalls ?? []).length) suggest('logs.pipelines.cold_calls', 'active', 'this profile runs cold calls');

  for (const o of data.orders ?? []) {
    write('work-log/logs/pipelines/orders', o.id, 'pipeline', {
      name: o.name, items: o.items, amount: o.amount, order_type: o.orderType,
      payment_status: o.paymentStatus, delivery_status: o.deliveryStatus,
    }, legacy(`orders[${o.id}]`, 'confirmed', now));
  }
  record('work-log/logs/pipelines/orders', (data.orders ?? []).length, 'orders[]');
  if ((data.orders ?? []).length) suggest('logs.pipelines.orders', 'active', 'this profile takes orders');

  // the effort and money meters live only in her own profiles (PLAN §7)
  if (data.momentum) {
    if (ownerKind === 'hers') {
      write('work-log/logs/effort', 'effort-log', 'effort_day', {
        start_date: data.momentum.startDate,
        monthly_value: data.momentum.monthlyValue ?? null,
        entries: data.momentum.entries,
      }, legacy('momentum', 'confirmed', now));
      record('work-log/logs/effort', 1, 'momentum');
      suggest('logs.effort_meter', 'active', 'this is one of her own profiles and it has an effort log');
      if (data.momentum.monthlyValue) {
        suggest('logs.effort_money', 'active', 'the money mode is already set up here');
      }
    } else {
      refused.push({
        what: 'momentum (effort + money meter)',
        why: 'PLAN §7: these survive only inside her own profiles. Left in place, not migrated, not rendered.',
      });
    }
  }

  // her observations for THIS profile. Untagged ones are HELD with the chat.
  const tagged = (opts.observations ?? []).filter(o => o.clientId === client.id);
  for (const o of tagged) {
    write('work-log/logs/observations', o.id, 'observation', {
      topic: o.topic, text: o.text, created_at: o.createdAt,
    }, legacy(`observations[${o.id}]`, 'confirmed', now));
  }
  record('work-log/logs/observations', tagged.length, 'observations[] with this profile’s tag');

  // ── analysis ─────────────────────────────────────────────────────────────
  for (const ci of data.journey?.checkIns ?? []) {
    write('work-log/analysis/goal-tracking', `checkin-${ci.month}`, 'goal_progress', {
      month: ci.month, value: ci.value, goal_id: 'goal-north-star', metric_declared: false,
    }, legacy(`journey.checkIns[${ci.month}]`, 'confirmed', now));
  }
  record('work-log/analysis/goal-tracking', (data.journey?.checkIns ?? []).length, 'journey.checkIns[]');

  // ── what stays behind, said out loud ─────────────────────────────────────
  if ((data.cards ?? []).length || (data.pillarCards ?? []).length) {
    frozen.push({
      slice: `cards[${(data.cards ?? []).length}], pillarCards[${(data.pillarCards ?? []).length}]`,
      why: 'the dormant 2026-07-10 safety copy — already migrated into contentCards once, never twice',
    });
  }
  if ((data.studioCompositions ?? []).length) {
    frozen.push({ slice: `studioCompositions[${data.studioCompositions.length}]`, why: 'an in-dashboard design canvas is not the direction (PLAN §3.10)' });
  }
  if ((data.customFields ?? []).length) {
    frozen.push({ slice: `customFields[${data.customFields.length}]`, why: 'free-form per-client fields contradict law 2; values stay readable' });
  }
  if (data.journey?.nextSteps) {
    frozen.push({ slice: 'journey.nextSteps', why: 'already rejected once — she wants data, not text sections' });
  }
  if ((data.contentCards ?? []).some(c => c.role)) {
    frozen.push({ slice: 'ContentCard.role', why: 'pillar jobs superseded it' });
  }

  const entries = Object.values(body.paths).reduce((n, list) => n + list.length, 0);

  return {
    body,
    suggestedSwitches,
    report: {
      profileId: client.id,
      profileName: client.name,
      ownerKind,
      at: now,
      bodyVersion: BODY_VERSION,
      moved,
      legacyUnverified,
      needsHerSort: body.sort_queue,
      frozen,
      refused,
      suggestedSwitches: suggested,
      totals: { paths: Object.keys(body.paths).length, entries },
    },
  };
}

/** The report as something she can read without opening a JSON file. */
export function reportToText(r: MigrationReport): string {
  const lines: string[] = [];
  lines.push(`Migration report — ${r.profileName} (${r.profileId})`);
  lines.push(`${r.at} · body version ${r.bodyVersion} · ${r.totals.entries} entries across ${r.totals.paths} addresses`);
  lines.push('');
  lines.push('MOVED');
  for (const m of r.moved) lines.push(`  ${m.count.toString().padStart(4)} → ${m.path}   (from ${m.from})`);
  if (r.refused.length) {
    lines.push('');
    lines.push('NOT MOVED, ON PURPOSE');
    for (const x of r.refused) lines.push(`  ${x.what}: ${x.why}`);
  }
  lines.push('');
  lines.push('LEFT WHERE IT IS (frozen, still readable)');
  for (const f of r.frozen) lines.push(`  ${f.slice}: ${f.why}`);
  lines.push('');
  lines.push(`MARKED UNVERIFIED (${r.legacyUnverified.length}) — carried over, but nobody confirmed it`);
  for (const u of r.legacyUnverified.slice(0, 12)) lines.push(`  ${u.path} · ${u.entryId}: ${u.why}`);
  if (r.legacyUnverified.length > 12) lines.push(`  … and ${r.legacyUnverified.length - 12} more`);
  lines.push('');
  lines.push(`NEEDS YOU (${r.needsHerSort.length})`);
  for (const q of r.needsHerSort) lines.push(`  ${q.path}: ${q.question}`);
  lines.push('');
  lines.push('SUGGESTED SWITCH POSITIONS — suggestions only, nothing is set');
  for (const s of r.suggestedSwitches) lines.push(`  ${s.switchId} → ${s.state}   (${s.why})`);
  return lines.join('\n');
}
