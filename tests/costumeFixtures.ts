// Shared fixtures for spec 24's acceptance tests.
//
// §2.4's wall is real: the costume surface does not open on a profile until its
// strategy locks. So every fixture here walks a migrated profile THROUGH that
// wall rather than around it — strategy written, gate set locked,
// `strategy_version` set — and only then dresses a locked seed.

import { fixtureState } from './fixtures.ts';
import { migrateProfile } from '../lib/tree/migrate.ts';
import { putEntry, type ProfileBody } from '../lib/tree/body.ts';
import { buildGateSet, writeGateSet } from '../lib/strategy/derivation.ts';
import { platformSwitchId } from '../lib/tree/switches.ts';
import type { PathState, SwitchConfig } from '../lib/tree/contract.ts';
import { amendSeed, writeSeed } from '../lib/engine/seeds.ts';
import { enumerateVariants, formatSelectionKey, type Selection, type VariantRow } from '../lib/engine/costume.ts';
import { resolveVariants } from '../lib/engine/resolve.ts';

export const NOW = '2026-07-27T10:00:00.000Z';
export const PROFILE = 'resumeguru';

export function migratedBody(): ProfileBody {
  const state = fixtureState();
  const rg = state.clients.find(c => c.id === PROFILE)!;
  return migrateProfile(rg, state.clientData[PROFILE], { now: NOW }).body;
}

/** Every switch this profile needs, all the way active — the everyday case. */
export function allActive(extra: Record<string, PathState> = {}): SwitchConfig {
  const ids = [
    'spine.fixed', 'strategy.fixed', 'creation.board', 'creation.engine', 'creation.costume',
    'creation.brief', 'creation.making', 'creation.making_handoff', 'creation.materials',
    'creation.format_overrides', 'assets.library', 'references.our_vision',
    'logs.engine_runs', 'logs.feedback', 'analysis.tracking', 'analysis.compare',
    'creation.channels',
    platformSwitchId('Instagram'), platformSwitchId('LinkedIn'),
  ];
  const config: SwitchConfig = {};
  for (const id of ids) config[id] = { state: 'active', set_at: NOW };
  for (const [id, state] of Object.entries(extra)) config[id] = { state, set_at: NOW };
  return config;
}

/** The pilot shape: migrated, locked, and holding one locked seed to dress. */
export function costumeBody(): ProfileBody {
  let body = migratedBody();

  const write = (path: string, id: string, type: string, data: Record<string, unknown>) => {
    body = putEntry(body, path, { id, type, data }, { writer: 'owner', now: NOW });
  };

  write('context/content-strategy/boundaries', 'bounds', 'strategy_parameter', {
    value: 'no guaranteed placement',
    never_promises: ['guaranteed placement', 'guaranteed job'],
    strategy_version: 1,
  });
  write('context/content-strategy/voice', 'voice-plain', 'strategy_parameter', {
    name: 'Plain and direct', value: 'plain and direct',
    never_words: ['hustle', 'grind'], strategy_version: 1,
  });
  write('context/content-strategy/positioning', 'pos', 'strategy_parameter', {
    value: 'the hiring system, explained', strategy_version: 1,
  });
  write('context/content-strategy/audience-decided', 'aud', 'strategy_parameter', {
    value: 'students applying for their first real job', strategy_version: 1,
  });
  write('context/content-strategy/ctas', 'cta-signup', 'strategy_parameter', {
    name: 'Try CareerOS', value: 'Link in bio, it is free to start.', strategy_version: 1,
  });
  write('context/content-strategy/ctas', 'cta-comment', 'strategy_parameter', {
    name: 'Comment RESUME', value: 'Comment RESUME and I will send it.', strategy_version: 1,
  });
  write('context/content-strategy/proof-library', 'proof-numbers', 'strategy_parameter', {
    name: '41 to 58 signups in a month', kind: 'number',
    evidences: 'that the system moves the needle',
    rights: {
      ownership: 'krnl', consent: 'given', permitted_platforms: [],
      permitted_uses: ['social'], expiry: null, attribution_required: null,
      subject_releases: [], restriction: 'none',
    },
  });
  write('context/content-strategy/proof-library', 'proof-linkedin-only', 'strategy_parameter', {
    name: 'The Infosys case study', kind: 'case-study',
    evidences: 'that it works for campus hiring',
    rights: {
      ownership: 'client', consent: 'given', permitted_platforms: ['LinkedIn'],
      permitted_uses: ['social'], expiry: null, attribution_required: null,
      subject_releases: [], restriction: 'none',
    },
  });
  write('context/content-strategy/goals', 'goal-signups', 'goal', {
    label: '300 signups',
    measurement: { metric: 'signups', direction: 'up', pillar_job: 'convert' },
    strategy_version: 1,
  });
  write('context/content-strategy/goals', 'goal-reach', 'goal', {
    label: 'be known', strategy_version: 1,     // no S16 declaration: never matched
  });

  body = writeGateSet(body, buildGateSet([
    { id: 'coach', name: 'Coach', question: 'Does it teach rather than perform?', from: 'voice' },
    { id: 'hook', name: 'Hook', question: 'Would a stranger stop?', from: 'positioning' },
    { id: 'value', name: 'Value', question: 'Do they get something without buying?', from: 'positioning' },
    { id: 'stance', name: 'Stance', question: 'Does it take a position?', from: 'voice' },
    { id: 'friend', name: 'Friend', question: 'Does it sound like a person?', from: 'voice' },
  ], 1, 1, NOW), NOW);

  body = { ...body, strategy_version: 1, context_version: 3 };

  body = writeSeed(body, {
    id: 'seed-salary', name: 'the salary anchor',
    raw_thought: 'they ask about salary to anchor you, not because they have a budget',
    fields: {
      core_message: 'They ask to anchor you.',
      reframe: 'It is an anchoring move, not a budget question.',
      audience_value: 'You can answer it without naming a number.',
      prohibited_interpretation: 'Never read as "lie about your salary".',
      nuance: 'Some companies genuinely do have a band.',
      possible_pillars: ['p-trust', 'p-ai'],
      possible_angles: ['contrarian', 'mistake'],
      proof_required: ['41 to 58 signups in a month', 'a hiring manager saying it out loud'],
    },
  }, NOW);
  body = amendSeed(body, 'seed-salary', { status: 'locked' }, { at: NOW, by: 'owner', note: 'lock' });

  return body;
}

/** Her override: ResumeGuru's carousels run shorter, and never convert. */
export function withCarouselOverride(body: ProfileBody): ProfileBody {
  return putEntry(body, 'context/content-strategy/platforms/instagram/rules', {
    id: 'rule-carousel', type: 'platform_parameter',
    data: {
      format: 'Carousel',
      length_bands: ['5 slides', '6 slides', '7 slides'],
      never: [
        { when: { objective: 'conversion' }, says: 'never use carousel as the convert format' },
      ],
      version: 2,
    },
  }, { writer: 'owner', now: NOW });
}

/** One fully dressed costume, every dimension resolved. */
export const FULL: Selection = {
  pillar_id: ['p-trust'],
  objective: ['trust'],
  audience_stage: ['problem-aware'],
  angle: ['contrarian'],
  hook_type: ['direct claim'],
  platform: ['Instagram'],
  format: [formatSelectionKey('Instagram', 'Carousel')],
  length: ['8 to 10 slides'],
  product_intensity: ['light mention'],
  cta: ['cta-signup'],
  voice: ['voice-plain'],
  proof: ['proof-numbers'],
};

export function rowsFrom(body: ProfileBody, selection: Selection): VariantRow[] {
  return enumerateVariants(body, allActive(), selection);
}

export function confirm(rows: VariantRow[], overrideReason?: string) {
  return rows.map((row, i) => ({
    row, piece_id: `piece-${i + 1}`, title: `Variant ${i + 1}`,
    ...(overrideReason ? { override_reason: overrideReason } : {}),
  }));
}

/** A profile holding exactly one resolved piece at `build`. */
export function bodyWithOnePiece(overrides: Partial<Selection> = {}): { body: ProfileBody; piece_id: string } {
  const base = costumeBody();
  const rows = rowsFrom(base, { ...FULL, ...overrides });
  const { body } = resolveVariants({
    body: base, seed_id: 'seed-salary', batch_id: 'b', rows: confirm(rows), now: NOW, by: 'owner',
  });
  return { body, piece_id: 'piece-1' };
}
