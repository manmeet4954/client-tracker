// Which input each strategy parameter actually takes, and what its options are.
// Spec 34 §3.
//
// The diagnosis this file exists to fix: every one of the fourteen parameters
// was given the same form, two free text boxes with a required reason. But
// platforms is a choice from a list, cadence is a number, pillars are a set
// with shares that add up. The input follows the answer.
//
// Nothing here touches storage. A decision still goes through `writeStrategy`
// exactly as a typed one did: same record, same fields, same history. The only
// thing that changes is what she does with her hands to produce the value, and
// that the reason line is written for her wherever the choice is a pick.
//
// No React in this file. It is all data and pure functions, so it can be tested
// without a browser (tests/strategy.inputs.test.ts).

import { DERIVATION_MAP } from './derivation.ts';

// ── The kinds of input ───────────────────────────────────────────────────────

export type InputKind =
  | 'prose'
  | 'audience'
  | 'platforms'
  | 'pillars'
  | 'voice'
  | 'goals'
  | 'chips'
  | 'boundaries'
  | 'cadence'
  | 'working-mode'
  | 'obligations'
  | 'proof'
  | 'brand-kit';

export interface InputSpec {
  /** The declared strategy path. Unchanged, and never shown on screen. */
  path: string;
  /** Her word for it. */
  label: string;
  kind: InputKind;
  /**
   * The reason line stays only where the choice is genuinely arguable:
   * positioning, audience, funnel shape and working mode. Everywhere else the
   * record still carries a reason, written from the pick itself, because the
   * lock requires one and she should not have to justify a tick box.
   */
  reasonRequired: boolean;
  /** One plain line under the label when the row is open. */
  help: string;
}

const CS = 'context/content-strategy';

export const STRATEGY_INPUTS: InputSpec[] = [
  {
    path: `${CS}/positioning`, label: 'Positioning', kind: 'prose', reasonRequired: true,
    help: 'What this brand stands for, in your words.',
  },
  {
    path: `${CS}/platforms`, label: 'Platforms', kind: 'platforms', reasonRequired: false,
    help: 'Where this brand posts. Pick a platform, then tick the formats you will make.',
  },
  {
    path: `${CS}/pillars`, label: 'Pillars', kind: 'pillars', reasonRequired: false,
    help: 'Three to five. Each one has a job and a share of the mix.',
  },
  {
    path: `${CS}/voice`, label: 'Voice', kind: 'voice', reasonRequired: false,
    help: 'The words this brand sounds like, and the words it never says.',
  },
  {
    path: `${CS}/audience-decided`, label: 'Audience', kind: 'audience', reasonRequired: true,
    help: 'Who you are talking to, and how far along they already are.',
  },
  {
    path: `${CS}/goals`, label: 'Goals', kind: 'goals', reasonRequired: false,
    help: 'Pick the goal, its number, and how you will know it moved.',
  },
  {
    path: `${CS}/funnel-shape`, label: 'Funnel shape', kind: 'prose', reasonRequired: true,
    help: 'How someone gets from seeing a post to buying.',
  },
  {
    path: `${CS}/ctas`, label: 'CTAs', kind: 'chips', reasonRequired: false,
    help: 'The asks you will actually use.',
  },
  {
    path: `${CS}/visual-branding`, label: 'Visual branding', kind: 'brand-kit', reasonRequired: false,
    help: 'This one lives in Brand kit. Set the colours and the type there.',
  },
  {
    path: `${CS}/proof-library`, label: 'Proof library', kind: 'proof', reasonRequired: false,
    help: 'The wins you are allowed to show, each with where it lives.',
  },
  {
    path: `${CS}/boundaries`, label: 'Boundaries', kind: 'boundaries', reasonRequired: false,
    help: 'The lines nothing crosses.',
  },
  {
    path: `${CS}/cadence`, label: 'Cadence', kind: 'cadence', reasonRequired: false,
    help: 'How much goes out, and how often.',
  },
  {
    path: `${CS}/working-mode`, label: 'Working mode', kind: 'working-mode', reasonRequired: true,
    help: 'Who brings the ideas, and who presses post.',
  },
  {
    path: `${CS}/obligations`, label: 'Obligations', kind: 'obligations', reasonRequired: false,
    help: 'What they owe you, and what you owe them.',
  },
];

const BY_PATH = new Map(STRATEGY_INPUTS.map(s => [s.path, s]));

export function inputFor(path: string): InputSpec | null {
  return BY_PATH.get(path) ?? null;
}

/**
 * Every lockable strategy path has an input, and every input is a lockable
 * strategy path. A drift either way is a parameter she can never decide, or a
 * screen for something the lock does not count.
 */
export function inputCoverage(): string[] {
  const out: string[] = [];
  const lockable = DERIVATION_MAP.filter(r => r.lockable).map(r => r.path);
  for (const p of lockable) {
    if (!BY_PATH.has(p)) out.push(`${p} is lockable and has no input`);
  }
  for (const s of STRATEGY_INPUTS) {
    if (!lockable.includes(s.path)) out.push(`${s.path} has an input and is not lockable`);
  }
  return out;
}

// ── The option libraries ─────────────────────────────────────────────────────

export interface PlatformLibraryRow { platform: string; formats: string[] }

/**
 * The platforms she can pick, and what can be made on each. Instagram,
 * LinkedIn and YouTube are the three the switch registry already knows; the
 * rest resolve to a platform switch of their own when picked, which is exactly
 * what `switchesForProfile` was built to do.
 */
export const PLATFORM_LIBRARY: PlatformLibraryRow[] = [
  { platform: 'Instagram', formats: ['Reel', 'Carousel', 'Static post', 'Story', 'Live'] },
  { platform: 'LinkedIn', formats: ['Text post', 'Carousel', 'Video', 'Article', 'Newsletter'] },
  { platform: 'YouTube', formats: ['Long video', 'Short', 'Community post', 'Live'] },
  { platform: 'TikTok', formats: ['Video', 'Photo post', 'Live'] },
  { platform: 'Threads', formats: ['Text post', 'Photo', 'Video'] },
  { platform: 'Pinterest', formats: ['Pin', 'Idea pin', 'Video pin'] },
  { platform: 'WhatsApp', formats: ['Status', 'Broadcast'] },
  { platform: 'Newsletter', formats: ['Email issue'] },
  { platform: 'Website', formats: ['Blog post', 'Landing page'] },
];

export function formatsFor(platform: string): string[] {
  const hit = PLATFORM_LIBRARY.find(p => p.platform.toLowerCase() === platform.toLowerCase());
  return hit ? hit.formats : [];
}

export const PILLAR_JOBS = ['reach', 'trust', 'convert'] as const;
export type PillarJob = (typeof PILLAR_JOBS)[number];

export const AUDIENCE_STAGES = [
  'unaware', 'just found them', 'following', 'thinking about it', 'existing customer',
];

export const GOAL_PRESETS = [
  'get known', 'grow the following', 'get more leads', 'sell the offer',
  'get bookings', 'grow the list', 'build trust',
];

/** How a goal is measured. "by hand" is a real answer, not a blank. */
export const GOAL_MEASURES = [
  'reach', 'profile visits', 'saves', 'shares', 'new followers',
  'DMs started', 'link clicks', 'leads', 'sales', 'we check by hand each month',
];

export const GOAL_PERIODS = ['a week', 'a month', 'in six months'];

export const CTA_SUGGESTIONS = [
  'DM the word', 'link in bio', 'comment below', 'save this', 'share it',
  'book a call', 'sign up', 'buy it', 'no ask',
];

export const VOICE_SUGGESTIONS = {
  sounds_like: ['plain', 'warm', 'direct', 'funny', 'calm', 'sharp', 'kind', 'confident'],
  never_says: ['hustle', 'game changer', 'unlock', 'guru', 'crushing it', 'secret hack'],
};

export const BOUNDARY_GROUPS = [
  { id: 'never_claim', label: 'Never claim' },
  { id: 'never_promise', label: 'Never promise' },
  { id: 'not_for', label: 'Not for' },
] as const;

export type BoundaryGroup = (typeof BOUNDARY_GROUPS)[number]['id'];

export const WORKING_MODE_IDEAS = [
  { id: 'they-bring', label: 'They bring the ideas' },
  { id: 'she-leads', label: 'You lead it' },
] as const;

export const WORKING_MODE_POSTING = [
  { id: 'we-post', label: 'We post' },
  { id: 'they-post', label: 'They post' },
] as const;

// ── The value shapes ─────────────────────────────────────────────────────────

export interface PlatformPick { platform: string; formats: string[] }
export interface Pillar { name: string; job: PillarJob | null; share: number | null }
export interface VoiceValue { sounds_like: string[]; never_says: string[] }
export interface AudienceValue { who: string; stages: string[] }
export interface GoalItem { goal: string; number: number | null; period: string; measured: string }
export interface BoundariesValue { never_claim: string[]; never_promise: string[]; not_for: string[] }
export interface CadenceValue { count: number | null; per: 'week' | 'month' }
export interface WorkingModeValue {
  ideas: 'they-bring' | 'she-leads' | null;
  posting: 'we-post' | 'they-post' | null;
}
export interface ObligationsValue { theirs: string[]; ours: string[] }
export interface ProofItem { line: string; link: string }

export type InputValue =
  | string
  | PlatformPick[]
  | Pillar[]
  | VoiceValue
  | AudienceValue
  | GoalItem[]
  | string[]
  | BoundariesValue
  | CadenceValue
  | WorkingModeValue
  | ObligationsValue
  | ProofItem[];

export function emptyValue(kind: InputKind): InputValue {
  switch (kind) {
    case 'prose': return '';
    case 'audience': return { who: '', stages: [] };
    case 'platforms': return [];
    case 'pillars': return [];
    case 'voice': return { sounds_like: [], never_says: [] };
    case 'goals': return [];
    case 'chips': return [];
    case 'boundaries': return { never_claim: [], never_promise: [], not_for: [] };
    case 'cadence': return { count: null, per: 'week' };
    case 'working-mode': return { ideas: null, posting: null };
    case 'obligations': return { theirs: [], ours: [] };
    case 'proof': return [];
    case 'brand-kit': return '';
  }
}

// ── Reading what is already stored ───────────────────────────────────────────
//
// A profile decided before this screen existed holds a typed string. None of it
// is thrown away: a string is split back into the shape the new input works in,
// and anything that cannot be read as a list stays visible as a line she can
// keep or clear.

function words(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(v => String(v ?? '').trim()).filter(Boolean);
  if (typeof raw === 'string') {
    return raw.split(/[\n,;·]+/).map(s => s.trim()).filter(Boolean);
  }
  return [];
}

function isObject(raw: unknown): raw is Record<string, unknown> {
  return !!raw && typeof raw === 'object' && !Array.isArray(raw);
}

export function decodeValue(kind: InputKind, raw: unknown): InputValue {
  switch (kind) {
    case 'prose':
    case 'brand-kit':
      return typeof raw === 'string' ? raw : raw == null ? '' : String(raw);

    case 'audience': {
      if (isObject(raw)) {
        return { who: String(raw.who ?? ''), stages: words(raw.stages) };
      }
      return { who: typeof raw === 'string' ? raw : '', stages: [] };
    }

    case 'platforms': {
      if (Array.isArray(raw) && raw.every(isObject)) {
        return (raw as Record<string, unknown>[]).map(r => ({
          platform: String(r.platform ?? ''),
          formats: words(r.formats),
        })).filter(p => p.platform);
      }
      return words(raw).map(name => ({ platform: canonicalPlatform(name), formats: [] }));
    }

    case 'pillars': {
      if (Array.isArray(raw) && raw.every(isObject)) {
        return (raw as Record<string, unknown>[]).map(r => ({
          name: String(r.name ?? ''),
          job: (PILLAR_JOBS as readonly string[]).includes(String(r.job)) ? (r.job as PillarJob) : null,
          share: typeof r.share === 'number' ? r.share : null,
        })).filter(p => p.name);
      }
      return words(raw).map(name => ({ name, job: null, share: null }));
    }

    case 'voice': {
      if (isObject(raw)) {
        return { sounds_like: words(raw.sounds_like), never_says: words(raw.never_says) };
      }
      return { sounds_like: words(raw), never_says: [] };
    }

    case 'goals': {
      if (Array.isArray(raw) && raw.every(isObject)) {
        return (raw as Record<string, unknown>[]).map(r => ({
          goal: String(r.goal ?? ''),
          number: typeof r.number === 'number' ? r.number : null,
          period: String(r.period ?? ''),
          measured: String(r.measured ?? ''),
        })).filter(g => g.goal);
      }
      return words(raw).map(goal => ({ goal, number: null, period: '', measured: '' }));
    }

    case 'chips':
      return words(raw);

    case 'boundaries': {
      if (isObject(raw)) {
        return {
          never_claim: words(raw.never_claim),
          never_promise: words(raw.never_promise),
          not_for: words(raw.not_for),
        };
      }
      return { never_claim: words(raw), never_promise: [], not_for: [] };
    }

    case 'cadence': {
      if (isObject(raw)) {
        const n = Number(raw.count);
        return {
          count: Number.isFinite(n) && n > 0 ? n : null,
          per: raw.per === 'month' ? 'month' : 'week',
        };
      }
      const text = typeof raw === 'string' ? raw : '';
      const n = Number((text.match(/\d+(\.\d+)?/) ?? [])[0]);
      return {
        count: Number.isFinite(n) && n > 0 ? n : null,
        per: /month/i.test(text) ? 'month' : 'week',
      };
    }

    case 'working-mode': {
      if (isObject(raw)) {
        const ideas = raw.ideas === 'they-bring' || raw.ideas === 'she-leads' ? raw.ideas : null;
        const posting = raw.posting === 'we-post' || raw.posting === 'they-post' ? raw.posting : null;
        return { ideas, posting };
      }
      const text = typeof raw === 'string' ? raw.toLowerCase() : '';
      return {
        ideas: text.includes('they bring') ? 'they-bring' : text.includes('you lead') ? 'she-leads' : null,
        posting: text.includes('they post') ? 'they-post' : text.includes('we post') ? 'we-post' : null,
      };
    }

    case 'obligations': {
      if (isObject(raw)) return { theirs: words(raw.theirs), ours: words(raw.ours) };
      return { theirs: words(raw), ours: [] };
    }

    case 'proof': {
      if (Array.isArray(raw) && raw.every(isObject)) {
        return (raw as Record<string, unknown>[]).map(r => ({
          line: String(r.line ?? ''), link: String(r.link ?? ''),
        })).filter(p => p.line || p.link);
      }
      return words(raw).map(line => ({ line, link: '' }));
    }
  }
}

/** Matches a typed platform name back to the library's spelling. */
export function canonicalPlatform(name: string): string {
  const hit = PLATFORM_LIBRARY.find(p => p.platform.toLowerCase() === name.trim().toLowerCase());
  return hit ? hit.platform : name.trim();
}

// ── What the row says when it is closed ──────────────────────────────────────

function list(items: string[], max = 3): string {
  const shown = items.slice(0, max).join(', ');
  const rest = items.length - max;
  return rest > 0 ? `${shown} and ${rest} more` : shown;
}

/** The decision, in one line. Never a count of sources, never a path. */
export function summarize(kind: InputKind, value: InputValue): string {
  switch (kind) {
    case 'prose':
    case 'brand-kit': {
      const text = String(value ?? '').trim();
      return text.length > 90 ? `${text.slice(0, 87)}...` : text;
    }
    case 'audience': {
      const v = value as AudienceValue;
      const who = v.who.trim();
      const short = who.length > 60 ? `${who.slice(0, 57)}...` : who;
      return v.stages.length ? `${short} (${list(v.stages, 2)})` : short;
    }
    case 'platforms': {
      const v = value as PlatformPick[];
      return list(v.map(p => p.platform), 4);
    }
    case 'pillars': {
      const v = value as Pillar[];
      return list(v.map(p => (p.share == null ? p.name : `${p.name} ${p.share}%`)), 5);
    }
    case 'voice': {
      const v = value as VoiceValue;
      const a = v.sounds_like.length ? `sounds ${list(v.sounds_like, 3)}` : '';
      const b = v.never_says.length ? `never ${list(v.never_says, 2)}` : '';
      return [a, b].filter(Boolean).join('. ');
    }
    case 'goals': {
      const v = value as GoalItem[];
      return list(v.map(g => (g.number == null ? g.goal : `${g.goal}, ${g.number} ${g.period}`.trim())), 2);
    }
    case 'chips':
      return list(value as string[], 4);
    case 'boundaries': {
      const v = value as BoundariesValue;
      const all = [...v.never_claim, ...v.never_promise, ...v.not_for];
      return list(all, 3);
    }
    case 'cadence': {
      const v = value as CadenceValue;
      if (v.count == null) return '';
      const noun = v.count === 1 ? 'piece' : 'pieces';
      return `${v.count} ${noun} a ${v.per}`;
    }
    case 'working-mode': {
      const v = value as WorkingModeValue;
      const a = WORKING_MODE_IDEAS.find(o => o.id === v.ideas)?.label ?? '';
      const b = WORKING_MODE_POSTING.find(o => o.id === v.posting)?.label ?? '';
      return [a, b].filter(Boolean).join('. ');
    }
    case 'obligations': {
      const v = value as ObligationsValue;
      const parts: string[] = [];
      if (v.theirs.length) parts.push(`theirs: ${list(v.theirs, 2)}`);
      if (v.ours.length) parts.push(`ours: ${list(v.ours, 2)}`);
      return parts.join('. ');
    }
    case 'proof': {
      const v = value as ProofItem[];
      return list(v.map(p => p.line).filter(Boolean), 2);
    }
  }
}

// ── What is still wrong with it, in her words ────────────────────────────────

export const PILLARS_MIN = 3;
export const PILLARS_MAX = 5;

/** The share total, counted from the array it describes. */
export function pillarShareTotal(pillars: Pillar[]): number {
  return pillars.reduce((sum, p) => sum + (p.share ?? 0), 0);
}

/** The goals that have no way to be measured. S16, said on the screen. */
export function goalsWithoutMeasure(goals: GoalItem[]): string[] {
  return goals.filter(g => !g.measured.trim()).map(g => g.goal);
}

export function problems(kind: InputKind, value: InputValue): string[] {
  const out: string[] = [];
  switch (kind) {
    case 'platforms': {
      const v = value as PlatformPick[];
      if (v.length === 0) out.push('Pick at least one platform.');
      for (const p of v) {
        if (p.formats.length === 0) out.push(`${p.platform} has no formats ticked yet.`);
      }
      break;
    }
    case 'pillars': {
      const v = value as Pillar[];
      if (v.length < PILLARS_MIN) out.push(`Pillars come in threes to fives. You have ${v.length}.`);
      if (v.length > PILLARS_MAX) out.push(`That is ${v.length} pillars. Five is the most that works.`);
      for (const p of v) {
        if (!p.name.trim()) out.push('One pillar has no name.');
        else if (!p.job) out.push(`${p.name} has no job yet.`);
      }
      const total = pillarShareTotal(v);
      if (v.length > 0 && total !== 100) {
        out.push(`The shares add up to ${total}, not 100.`);
      }
      break;
    }
    case 'voice': {
      const v = value as VoiceValue;
      if (v.sounds_like.length === 0) out.push('Add at least one word it sounds like.');
      break;
    }
    case 'goals': {
      const v = value as GoalItem[];
      if (v.length === 0) out.push('Pick at least one goal.');
      for (const g of v) {
        if (g.number == null) out.push(`${g.goal} has no number yet.`);
      }
      const blocked = goalsWithoutMeasure(v);
      for (const g of blocked) {
        out.push(`${g} has no way to be measured, so Analysis stays off for it.`);
      }
      break;
    }
    case 'cadence': {
      const v = value as CadenceValue;
      if (v.count == null || v.count <= 0) out.push('Put a number on it.');
      break;
    }
    case 'working-mode': {
      const v = value as WorkingModeValue;
      if (!v.ideas) out.push('Say who brings the ideas.');
      if (!v.posting) out.push('Say who presses post.');
      break;
    }
    case 'chips': {
      if ((value as string[]).length === 0) out.push('Add at least one.');
      break;
    }
    case 'boundaries': {
      const v = value as BoundariesValue;
      const all = v.never_claim.length + v.never_promise.length + v.not_for.length;
      if (all === 0) out.push('Add at least one line.');
      break;
    }
    case 'obligations': {
      const v = value as ObligationsValue;
      if (v.theirs.length === 0 && v.ours.length === 0) out.push('Add at least one on either side.');
      break;
    }
    case 'proof': {
      const v = value as ProofItem[];
      if (v.length === 0) out.push('Add at least one piece of proof.');
      for (const p of v) if (!p.line.trim()) out.push('One item has no line.');
      break;
    }
    case 'prose':
    case 'audience': {
      const text = kind === 'prose' ? String(value ?? '') : (value as AudienceValue).who;
      if (!text.trim()) out.push('Write it in a line or two.');
      break;
    }
    case 'brand-kit':
      break;
  }
  return out;
}

/**
 * Whether it can be saved. Deliberately softer than `problems`: a share total
 * that is not 100 is worth saying out loud and not worth blocking a save on.
 * The lock is the gate, not this screen.
 */
export function isComplete(kind: InputKind, value: InputValue): boolean {
  switch (kind) {
    case 'prose': return String(value ?? '').trim().length > 0;
    case 'brand-kit': return true;
    case 'audience': return (value as AudienceValue).who.trim().length > 0;
    case 'platforms': return (value as PlatformPick[]).length > 0;
    case 'pillars': return (value as Pillar[]).filter(p => p.name.trim()).length > 0;
    case 'voice': return (value as VoiceValue).sounds_like.length > 0;
    case 'goals': return (value as GoalItem[]).length > 0;
    case 'chips': return (value as string[]).length > 0;
    case 'boundaries': {
      const v = value as BoundariesValue;
      return v.never_claim.length + v.never_promise.length + v.not_for.length > 0;
    }
    case 'cadence': {
      const v = value as CadenceValue;
      return v.count != null && v.count > 0;
    }
    case 'working-mode': {
      const v = value as WorkingModeValue;
      return !!v.ideas && !!v.posting;
    }
    case 'obligations': {
      const v = value as ObligationsValue;
      return v.theirs.length + v.ours.length > 0;
    }
    case 'proof': return (value as ProofItem[]).some(p => p.line.trim().length > 0);
  }
}

// ── The reason line, written from the pick ───────────────────────────────────
//
// The record still carries a reason on every decision, because the lock reads
// it and because a strategy has to be readable a year later. What dies is being
// ASKED for one beside a tick box. On a pick, the reason is the pick, said
// back plainly. On the four arguable ones she still writes it herself.

export function autoReason(kind: InputKind, value: InputValue): string {
  switch (kind) {
    case 'platforms': {
      const v = value as PlatformPick[];
      const parts = v.map(p => (p.formats.length ? `${p.platform} for ${p.formats.join(', ').toLowerCase()}` : p.platform));
      return parts.length ? `Picked ${parts.join('; ')}.` : 'No platform picked.';
    }
    case 'pillars': {
      const v = value as Pillar[];
      const parts = v.map(p => `${p.name}${p.job ? ` to ${p.job}` : ''}${p.share == null ? '' : ` at ${p.share}%`}`);
      return parts.length ? `The mix is ${parts.join(', ')}.` : 'No pillars set.';
    }
    case 'voice': {
      const v = value as VoiceValue;
      const a = v.sounds_like.length ? `Sounds ${v.sounds_like.join(', ')}` : '';
      const b = v.never_says.length ? `never ${v.never_says.join(', ')}` : '';
      const said = [a, b].filter(Boolean).join('. ');
      return said ? `${said}.` : 'No voice words set.';
    }
    case 'goals': {
      const v = value as GoalItem[];
      const parts = v.map(g => {
        const num = g.number == null ? '' : ` ${g.number}${g.period ? ` ${g.period}` : ''}`;
        const how = g.measured ? `, measured by ${g.measured}` : ', with no measure yet';
        return `${g.goal}${num}${how}`;
      });
      return parts.length ? `Going for ${parts.join('; ')}.` : 'No goal set.';
    }
    case 'chips': {
      const v = value as string[];
      return v.length ? `The asks are ${v.join(', ')}.` : 'No ask set.';
    }
    case 'boundaries': {
      const v = value as BoundariesValue;
      const parts: string[] = [];
      if (v.never_claim.length) parts.push(`never claim ${v.never_claim.join(', ')}`);
      if (v.never_promise.length) parts.push(`never promise ${v.never_promise.join(', ')}`);
      if (v.not_for.length) parts.push(`not for ${v.not_for.join(', ')}`);
      return parts.length ? `${parts.join('; ')}.` : 'No boundary set.';
    }
    case 'cadence': {
      const v = value as CadenceValue;
      if (v.count == null) return 'No cadence set.';
      const noun = v.count === 1 ? 'piece' : 'pieces';
      return `${v.count} ${noun} a ${v.per}, which is what they can keep up.`;
    }
    case 'obligations': {
      const v = value as ObligationsValue;
      const parts: string[] = [];
      if (v.theirs.length) parts.push(`they bring ${v.theirs.join(', ')}`);
      if (v.ours.length) parts.push(`we bring ${v.ours.join(', ')}`);
      return parts.length ? `${parts.join('; ')}.` : 'Nothing agreed yet.';
    }
    case 'proof': {
      const v = value as ProofItem[];
      const lines = v.map(p => p.line).filter(Boolean);
      return lines.length ? `Proof we may show: ${lines.join('; ')}.` : 'No proof filed.';
    }
    case 'brand-kit':
      return 'Set in Brand kit.';
    case 'prose':
    case 'audience':
    case 'working-mode':
      // These four ask her for the reason and never write one for her.
      return '';
  }
}

/**
 * The reason that goes into the record. Hers where the choice is arguable, the
 * pick said back plainly everywhere else. Never blank, because the lock counts
 * a blank reason as a failure.
 */
export function reasonFor(spec: InputSpec, value: InputValue, typed: string): string {
  if (spec.reasonRequired) return typed.trim();
  const written = autoReason(spec.kind, value).trim();
  return written || typed.trim();
}

/** Whether Save may fire. */
export function canSave(spec: InputSpec, value: InputValue, typed: string): boolean {
  if (spec.kind === 'brand-kit') return false;
  if (!isComplete(spec.kind, value)) return false;
  if (spec.reasonRequired && !typed.trim()) return false;
  return true;
}

// ── The row, closed ──────────────────────────────────────────────────────────

export interface RowStatus {
  decided: boolean;
  /** "decided" or "not yet", and the decision itself when there is one. */
  state: string;
  detail: string;
}

export function rowStatus(
  spec: InputSpec,
  decision: { value: unknown; not_applicable?: boolean } | null,
): RowStatus {
  if (!decision) return { decided: false, state: 'not yet', detail: '' };
  if (decision.not_applicable) return { decided: true, state: 'not used here', detail: '' };
  const detail = summarize(spec.kind, decodeValue(spec.kind, decision.value));
  return { decided: true, state: 'decided', detail };
}

/** "9 of 14 decided", counted from the array it describes. */
export function decidedLine(decidedCount: number, total: number): string {
  if (total === 0) return 'Nothing to decide yet.';
  if (decidedCount === 0) return `Nothing decided yet. ${total} to go.`;
  if (decidedCount === total) return `All ${total} decided.`;
  return `${decidedCount} of ${total} decided.`;
}

/** The S16 sentence, on the screen where she can see it. */
export const MEASUREMENT_LINE =
  'A goal with no way to measure it keeps Analysis switched off for that goal.';
