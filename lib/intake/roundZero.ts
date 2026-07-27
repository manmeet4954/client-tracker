// The round-0 mapping pass — spec 22 §13.
//
// Spec 21's migration already turned a profile's legacy `onboarding[]` into
// ROUND 0: the round record, one question entry per item marked legacy, one
// answer entry per item, verbatim. This is the SECOND, separate pass.
//
// What it does: for each round-0 answer, PROPOSE the parameter it most likely
// belongs to and put the proposal in her queue. What it never does: write a
// curated value. A legacy question like "what's your Instagram?" maps to
// materials.existing-accounts; a rambling paragraph may map to three parameters
// or none. Anything unmapped is listed BY NAME, never dropped silently.

import type { ProfileBody } from '../tree/body.ts';
import { queueForHerSort, readPath } from '../tree/body.ts';
import { PARAMETERS, findParameter } from './parameters.ts';
import { readAnswers } from './rounds.ts';

/** Migration hints, not part of the inventory: words that a legacy question
 *  used which point at one of today's parameters. Deliberately small — a weak
 *  guess is better named than a confident wrong one. */
const HINTS: Record<string, string[]> = {
  'identity.name': ['known as', 'brand name', 'called'],
  'identity.one-line': ['what do you do', 'describe what you do', 'one line'],
  'identity.credentials': ['qualified', 'credentials', 'experience', 'taught'],
  'journey.origin': ['story', 'happened in her own life', 'why this'],
  'journey.why': ['why now', 'why did you start', 'why this'],
  'voice.natural-tone': ['tone', 'sound', 'voice', 'design style'],
  'voice.words-they-hate': ['never want to say', 'cringe', 'hate'],
  'ambitions.six-months': ['measure', 'six months', 'what will you measure'],
  'ambitions.known-or-sold': ['known or', 'money right now', 'about money'],
  'camera.face': ['on camera', 'show your face', 'face'],
  'camera.comfort': ['nervous to put online', 'comfortable filming'],
  'history.wins': ['most proud', 'past post', 'worked before'],
  'history.flops': ['embarrassed', 'flop'],
  'offers.list': ['what do you sell', 'services', 'offer'],
  'offers.hero': ['pays the bills', 'main offer', 'hero'],
  'market.usp': ['not get from any other', 'different', 'usp', 'compliment'],
  'market.competitors': ['competitor', 'others in your space'],
  'buying.next-step': ['next step', 'call to action'],
  'numbers.production': ['photos and videos', 'raw material', 'who shoots'],
  'audience.best-customer': ['who is this for', 'audience', 'best customer', 'person she most wants to help'],
  'audience.pain': ['problems', 'pain', 'struggle'],
  'audience.unwanted': ['not want as a customer', 'unwanted'],
  'materials.brand-book': ['brand book', 'brand guidelines'],
  'materials.logo-files': ['logo'],
  'materials.existing-accounts': ['instagram', 'linkedin', 'handle', 'accounts', 'account'],
  'materials.old-content': ['old content', 'past content'],
};

export interface MappingProposal {
  answer_id: string;
  question: string;
  /** Null where nothing matched. Named, never guessed at. */
  parameter_id: string | null;
  parameter_path: string | null;
  why: string;
}

export interface MappingResult {
  body: ProfileBody;
  proposals: MappingProposal[];
  unmapped: string[];
}

function propose(question: string): { id: string; hit: string } | null {
  const text = question.toLowerCase();
  let best: { id: string; hit: string } | null = null;
  for (const [id, words] of Object.entries(HINTS)) {
    for (const w of words) {
      if (!text.includes(w)) continue;
      if (!best || w.length > best.hit.length) best = { id, hit: w };
    }
  }
  return best;
}

const QUEUE_MARK = 'Round 0:';

/**
 * Run the pass. Idempotent: running it twice does not double her queue.
 * Nothing is auto-curated — every line below is a proposal she accepts, redirects
 * or ignores in the curation surface.
 */
export function mapRoundZero(body: ProfileBody, now = new Date().toISOString()): MappingResult {
  const questions = new Map(
    readPath(body, 'context/intake/questions').map(e => {
      const d = e.data as { text?: string; legacy?: boolean };
      return [e.id, { text: d.text ?? '', legacy: !!d.legacy }];
    }),
  );
  const answers = readAnswers(body).filter(a => a.round_version === 0);
  const already = new Set(
    body.sort_queue.filter(q => q.question.startsWith(QUEUE_MARK)).map(q => q.entry_id),
  );

  let next = body;
  const proposals: MappingProposal[] = [];
  const unmapped: string[] = [];

  for (const a of answers) {
    const legacyQuestion = questions.get(`q-${a.id.replace(/^a-/, '')}`)?.text
      ?? questions.get(a.id.replace(/^a-/, 'q-'))?.text
      ?? a.parameter_id
      ?? '';
    const hit = propose(legacyQuestion);
    const p = hit ? findParameter(hit.id) : null;

    proposals.push({
      answer_id: a.id,
      question: legacyQuestion,
      parameter_id: p?.id ?? null,
      parameter_path: p?.path ?? null,
      why: p ? `the old question says "${hit!.hit}"` : 'nothing in the old wording points at a parameter',
    });
    if (!p) unmapped.push(legacyQuestion || a.id);

    if (already.has(a.id)) continue;
    next = queueForHerSort(next, {
      entry_id: a.id,
      path: p?.path ?? 'context/intake/answers',
      question: p
        ? `${QUEUE_MARK} "${legacyQuestion}" looks like ${p.label} (${p.id}). Curate it there, or send it somewhere else. Nothing has been written.`
        : `${QUEUE_MARK} "${legacyQuestion}" does not match any parameter. It is kept, unmapped, until you place it.`,
    });
  }

  return { body: next, proposals, unmapped };
}

/** Every parameter the pass could propose. Used by the surface to show her the
 *  full picture rather than only the matches. */
export function mappableParameters(): string[] {
  return PARAMETERS.filter(p => !p.curates_to).map(p => p.id);
}
