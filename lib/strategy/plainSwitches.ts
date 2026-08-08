// Spec 34 §4 and §5 — the Switches screen and the Lock screen, without React.
//
// The diagnosis this file answers is one sentence: the Strategy corner renders
// the data model instead of the work. So this file holds the translation layer,
// and it holds it as DATA rather than as strings scattered through a component:
//
//   1. Every switch in the registry has a plain name and a plain line saying
//      what it does FOR THIS CLIENT. `missingPlainNames()` returns the ones
//      that do not, and a test fails on it. She never sees `intake.questionnaire`.
//   2. The three groups are the three questions a switch answers: what this
//      client gets, what we do for them, what they can see. Not the app the id
//      happens to start with.
//   3. Only what DIFFERS from the sensible default is open. The rest folds
//      behind one line with a count, and every count here is counted from the
//      array it describes, at call time.
//   4. The suggested/set distinction is GONE from the screen. It stays in the
//      data, where the migration needs it (spec 21 §9.6): a position she has
//      never touched still reads as `suggested` in the record, and the lock
//      still refuses until she has said yes. What changes is that the screen
//      stops apologising about it fourteen times and asks once, in one act.
//   5. The lock is re-presented, never recomputed. `lockViolations` stays the
//      only judge of what is missing; `composeLock` turns its answers into her
//      words and drops everything that is already done.
//
// Nothing here writes. The two components do the writing, through
// `setSwitchPosition` and `lockStrategy`, which are unchanged.

import type { PathState, SwitchConfig } from '../tree/contract.ts';
import { stateRank } from '../tree/contract.ts';
import {
  PLATFORM_SWITCH_PREFIX, TRACKING_SWITCH_PREFIX, SWITCHES,
  effectiveState, platformSwitchId, resolveSwitch, suggestedTrackingState,
  switchesForProfile, trackingSwitchId,
} from '../tree/switches.ts';
import type { LockFailure } from './derivation.ts';

// ── The three questions ──────────────────────────────────────────────────────

export type SwitchGroup = 'gets' | 'we-do' | 'they-see';

export interface GroupHeading {
  id: SwitchGroup;
  title: string;
}

/** In this order, because it is the order she thinks in: the client, then the
 *  work, then the doors. */
export const SWITCH_GROUPS: GroupHeading[] = [
  { id: 'gets', title: 'What this client gets' },
  { id: 'we-do', title: 'What we do for them' },
  { id: 'they-see', title: 'What they can see' },
];

export function groupTitle(id: SwitchGroup): string {
  return SWITCH_GROUPS.find(g => g.id === id)?.title ?? id;
}

// ── The map: one plain name and one plain line per switch ────────────────────

export interface PlainSwitch {
  /** What she calls it. Never an id, never a path. */
  name: string;
  /** What it does for THIS client, in one line. */
  line: string;
  group: SwitchGroup;
}

const P = (name: string, line: string, group: SwitchGroup): PlainSwitch => ({ name, line, group });

export const PLAIN_SWITCHES: Record<string, PlainSwitch> = {
  // Structure — always on, and named anyway, so nothing is a mystery.
  'spine.fixed': P('The profile itself',
    'Every profile keeps a context folder and a work log. This never moves.', 'we-do'),
  'strategy.fixed': P('Strategy',
    'This corner. Every profile has one and it cannot be turned off.', 'we-do'),
  'shelf.profiles': P('A place on your shelf',
    'This profile appears on the desk with the others.', 'we-do'),
  'shelf.add_profile': P('Making new profiles',
    'You can always start a new profile. Never off.', 'we-do'),
  'shelf.today_strip': P('Their slips in your day strip',
    'What has slipped here shows in your one strip across all profiles.', 'we-do'),
  'shelf.weekly_pulse': P('Their line in your weekly pulse',
    'This profile adds its week to the pulse on your desk.', 'we-do'),

  // Their door.
  'client_access.login': P('A login of their own',
    'They get their own way in to this profile.', 'they-see'),
  'client_access.mini_shelf': P('Their own profile picker',
    'Someone who holds more than one profile gets a picker for theirs.', 'they-see'),

  // Intake.
  'intake.questionnaire': P('Questions they answer',
    'They answer your questions in their own dashboard.', 'they-see'),
  'intake.finding_session': P('A call instead of a form',
    'The same questions, answered in a call you record and write up.', 'they-see'),
  'intake.documents': P('Documents they hand over',
    'They can give files, links or pasted text instead of typing answers.', 'they-see'),
  'intake.reminders': P('Chasing them',
    'A nudge when a round is sent and nothing comes back.', 'they-see'),
  'intake.rounds_reopen': P('Asking again later',
    'You can open a new round whenever something is still missing.', 'we-do'),
  'intake.curation': P('Your read of what they said',
    'Nothing they wrote reaches strategy until you have read it and written it up.', 'we-do'),

  // Strategy.
  'strategy.visual_branding': P('Their brand kit',
    'Colours, type and logos live with this profile.', 'gets'),
  'strategy.derivation': P('Deciding the strategy',
    'The decisions on the Decide screen.', 'we-do'),
  'strategy.gate_set': P('The checks',
    'The five checks a piece must pass, written from voice and positioning.', 'we-do'),
  'strategy.switchboard': P('This screen',
    'The switches themselves. Always here.', 'we-do'),
  'strategy.lock': P('Locking',
    'The lock that opens Creation for writing.', 'we-do'),

  // Platforms.
  'platforms.instagram': P('Instagram',
    'We work this client on Instagram, and its numbers come from there.', 'gets'),
  'platforms.linkedin': P('LinkedIn',
    'We work this client on LinkedIn, and its numbers come from there.', 'gets'),
  'platforms.youtube': P('YouTube',
    'We work this client on YouTube, and its numbers come from there.', 'gets'),

  // Creation.
  'creation.board': P('Their board',
    'Their pieces, from idea to posted.', 'gets'),
  'creation.engine': P('The engine room',
    'Where a thought becomes a seed and a seed becomes pieces.', 'we-do'),
  'creation.costume': P('Dressing a piece',
    'Choosing pillar, platform, format and angle before a piece is made.', 'we-do'),
  'creation.brief': P('Briefs written for you',
    'The machine writes the brief. Off means you write it yourself, and nothing else changes.', 'we-do'),
  'creation.format_overrides': P('Rules of their own',
    'This client can have format rules that differ from the standard ones.', 'we-do'),
  'creation.materials': P('Attaching their material',
    'Assets, references and proof can be attached to a piece.', 'we-do'),
  'creation.seed_extraction': P('Seeds found for you',
    'The machine reads a brain dump and pulls the ideas out. Off means you pick them yourself.', 'we-do'),
  'creation.seed_input_client': P('They bring ideas',
    'Intake asks them for their own ideas.', 'they-see'),
  'creation.making': P('Making the piece',
    'Drafting, checks, and everything between an idea and review.', 'we-do'),
  'creation.drafting': P('Drafts written for you',
    'The machine writes the first draft. Off means every draft is yours.', 'we-do'),
  'creation.gates': P('The seven checks run',
    'Nothing reaches review until all seven pass. Never off.', 'we-do'),
  'creation.rights_gate': P('The rights check',
    'Nothing publishes while the right to use something is missing. Never off.', 'we-do'),
  'creation.post_learning': P('One question after posting',
    'Anything you learned from this one. Optional, and never a chore.', 'we-do'),
  'creation.taste_rules': P('Your habits in their drafts',
    'Your standing habits go into this client’s drafts.', 'we-do'),
  'creation.making_handoff': P('Working in an outside tool',
    'A piece can leave for another tool and come back.', 'we-do'),
  'creation.review': P('They approve pieces',
    'Nothing goes out until they have seen it.', 'gets'),
  'creation.review_public_link': P('A preview link anyone can open',
    'A link to one piece that works without logging in.', 'they-see'),
  'creation.review_deeplink': P('Their link opens inside',
    'A client who is logged in lands on the piece in their own dashboard.', 'they-see'),
  'creation.review_perception': P('Asking how they felt about it',
    'One light question at review and at the monthly call.', 'they-see'),
  'creation.scheduling': P('Scheduling',
    'Pieces carry a date and a place in the month.', 'gets'),
  'creation.publishing': P('We post for them',
    'Pieces go out from their account without them touching it.', 'gets'),
  'creation.channels': P('Their accounts',
    'The accounts this profile posts from, and where the numbers come from.', 'gets'),
  'creation.funnel': P('What happens after a post',
    'Replies, leads, and the next step they take.', 'gets'),
  'creation.funnel_replies': P('Saved replies',
    'Ready answers for the messages that keep coming.', 'we-do'),

  // Assets and references.
  'assets.library': P('Their files',
    'Photos, video and everything else they hand over.', 'gets'),
  'assets.client_upload': P('They add files themselves',
    'They can put photos and video in without going through you.', 'they-see'),
  'assets.drive_videos': P('Video kept in Drive',
    'Long video opens in Drive instead of being uploaded twice.', 'we-do'),
  'assets.share_target': P('Sharing in from your phone',
    'The Android share sheet files straight into this profile.', 'we-do'),
  'assets.whatsapp_intake': P('Files by WhatsApp',
    'Not built: an inbox that files what they send on WhatsApp.', 'we-do'),
  'assets.catalogue_export': P('A catalogue to send out',
    'The same files, laid out as a product catalogue.', 'gets'),
  'references.our_vision': P('References you collect',
    'What you want this brand to look like.', 'we-do'),
  'references.from_client': P('References they send',
    'What they share as a reference.', 'they-see'),

  // Logs.
  'logs.tasks': P('Tasks',
    'What has to be done for this client.', 'we-do'),
  'logs.decisions': P('Decisions',
    'What was decided here, and when.', 'we-do'),
  'logs.requests': P('What they asked for',
    'Their requests, kept in one place.', 'gets'),
  'logs.changes': P('What changed',
    'A running record of changes on this profile.', 'we-do'),
  'logs.pipelines.lists': P('Lists of their own',
    'One-off lists only this client needs.', 'we-do'),
  'logs.pipelines.cold_calls': P('A calling list',
    'Who to call for this profile, and what came of it.', 'we-do'),
  'logs.pipelines.orders': P('Orders',
    'An order list, for a profile that sells things.', 'we-do'),
  'logs.effort_meter': P('Your hours on them',
    'How much time this profile takes. Your own profiles only.', 'we-do'),
  'logs.effort_money': P('What the hours are worth',
    'The money beside the hours. Your own profiles only.', 'we-do'),
  'logs.engine_runs': P('The machine’s own record',
    'Every run, what it was given and what it gave back. Never off.', 'we-do'),
  'logs.feedback': P('Feedback kept whole',
    'The original words and your decision on them, both kept. Never off.', 'we-do'),
  'logs.observations': P('Your notes',
    'Private notes on this profile. Only you.', 'we-do'),

  // Analysis.
  'analysis.tracking': P('Collecting the numbers',
    'Every day recorded. A day not recorded is gone for good.', 'we-do'),
  'analysis.tracking.instagram': P('Instagram numbers',
    'Collects this profile’s Instagram numbers every day.', 'we-do'),
  'analysis.tracking.linkedin': P('LinkedIn numbers',
    'Collects this profile’s LinkedIn numbers every day.', 'we-do'),
  'analysis.tracking.youtube': P('YouTube numbers',
    'Collects this profile’s YouTube numbers every day.', 'we-do'),
  'analysis.ai_tagging_fallback': P('Filling in a missing tag',
    'Used only where a piece carries no pillar or format of its own.', 'we-do'),
  'analysis.scorecard': P('The scorecard',
    'Each pillar judged against its own job.', 'gets'),
  'analysis.funnel': P('Funnel numbers',
    'What the funnel did, in numbers.', 'we-do'),
  'analysis.bifurcation': P('Slicing the numbers',
    'Read by pillar, format, hook, seed or platform.', 'we-do'),
  'analysis.goal_tracking': P('Goals tracked',
    'Progress against the goals you set. A goal with no measure is not tracked.', 'gets'),
  'analysis.compare': P('Comparing pieces',
    'Two pieces side by side at the same age.', 'we-do'),
  'analysis.digest_owner': P('Your monthly read',
    'What the month said, written for you.', 'we-do'),
  'analysis.digest_client': P('A monthly read for them',
    'The same month, written for them, after you approve it.', 'they-see'),
  'analysis.soft_signals': P('What people said',
    'Soft signals, kept beside the numbers and outside the maths.', 'we-do'),
  'analysis.market_research': P('What others are doing',
    'Notes on the rest of their market.', 'we-do'),
  'analysis.sync_health': P('Is the collecting working',
    'The runs, the gaps and the connection, in one place.', 'we-do'),
  'analysis.backfill': P('Picking up what was missed',
    'Fetches posts missed while collecting was down. It cannot bring the days back.', 'we-do'),
  'analysis.attributed_outcomes': P('Real outcomes',
    'Sales and enquiries tied back to the pieces that caused them.', 'we-do'),
  'analysis.always_live': P('This month so far',
    'The live read of the month, with coverage first.', 'we-do'),
  'analysis.verdicts': P('Verdicts',
    'What the numbers concluded, every thirty days and every quarter.', 'gets'),
  'analysis.verdict_words': P('The verdict in words',
    'The paragraph beside the numbers. Off leaves every number exactly as it is.', 'we-do'),
  'analysis.pulse_owner': P('Their weekly pulse',
    'This profile’s weekly lines, written into its own digests.', 'we-do'),
  'analysis.revisit_proposals': P('Make more of this',
    'A verdict can become the next seed.', 'we-do'),
  'analysis.costume_recommendations': P('What to dress it as',
    'The engine suggests format and angle from what has worked.', 'we-do'),
  'analysis.strategy_diffs': P('Suggested changes to the strategy',
    'The engine proposes, you decide. It never writes strategy itself.', 'we-do'),
  'analysis.client_publication': P('Sending them a report',
    'A report you approve first, then send.', 'they-see'),

  // Yours, across the practice.
  'owner.chat': P('Your chat',
    'Your chat, working exactly as it does today.', 'we-do'),
  'owner.taste_rules': P('Your habits, learned',
    'What you keep changing, kept as habits across every profile.', 'we-do'),
  'owner.whatsapp_inbox': P('WhatsApp inbox',
    'Parked. Registration never finished.', 'we-do'),

  // Dispositions.
  'frozen.legacy': P('Old data kept',
    'Kept and readable, never drawn, never deleted.', 'we-do'),
  'leaves.exported': P('Moved to the vault',
    'Exported to the vault and kept there.', 'we-do'),
};

/** Title Case a platform slug: `instagram` → `Instagram`, `x-threads` → `X Threads`. */
function platformName(slug: string): string {
  return slug.split('-').filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * The plain name for any switch, including the two families born with a
 * platform entry rather than listed in the registry (`platforms.<slug>` and
 * `analysis.tracking.<slug>`). A profile on a platform nobody has hard-coded
 * still gets a name and a line, never an id.
 */
export function plainSwitch(id: string): PlainSwitch | null {
  const named = PLAIN_SWITCHES[id];
  if (named) return named;
  if (id.startsWith(TRACKING_SWITCH_PREFIX)) {
    const p = platformName(id.slice(TRACKING_SWITCH_PREFIX.length));
    return P(`${p} numbers`, `Collects this profile’s ${p} numbers every day.`, 'we-do');
  }
  if (id.startsWith(PLATFORM_SWITCH_PREFIX)) {
    const p = platformName(id.slice(PLATFORM_SWITCH_PREFIX.length));
    return P(p, `We work this client on ${p}, and its numbers come from there.`, 'gets');
  }
  return null;
}

/** The name alone, for a sentence. Never falls back to the id. */
export function plainName(id: string): string {
  return plainSwitch(id)?.name ?? 'a switch with no plain name yet';
}

/**
 * Every registered switch that has no plain name. The test fails on a non-empty
 * answer, which is what keeps this map honest as switches are added: a new
 * switch without a name is caught before it can reach her screen as an id.
 */
export function missingPlainNames(platforms: string[] = []): string[] {
  return switchesForProfile(platforms)
    .map(s => s.id)
    .filter(id => !plainSwitch(id));
}

// ── Positions, in her words ──────────────────────────────────────────────────

export const STATE_WORDS: Record<PathState, string> = {
  active: 'on',
  history: 'off, keep what is there',
  hidden: 'off',
};

export function stateWords(state: PathState): string {
  return STATE_WORDS[state] ?? String(state);
}

// ── The Switches screen (§5) ─────────────────────────────────────────────────

export interface SwitchChoice {
  state: PathState;
  words: string;
  /** The position in force right now. */
  on: boolean;
}

export interface SwitchRow {
  id: string;
  name: string;
  line: string;
  group: SwitchGroup;
  /** What is in force: her position, or the suggestion behaving as itself. */
  position: PathState;
  positionWords: string;
  choices: SwitchChoice[];
  /** The sensible default for this profile. `null` where none exists. */
  sensible: PathState | null;
  /** Open on the screen: it differs from the default, or there is no default. */
  differs: boolean;
  /** She has never said yes to this one. The lock still needs that yes. */
  unconfirmed: boolean;
}

export interface SwitchGroupView {
  id: SwitchGroup;
  title: string;
  rows: SwitchRow[];
}

export interface SwitchboardView {
  /** Groups holding at least one row that differs. Empty groups never draw. */
  open: SwitchGroupView[];
  /** Everything sitting at its default, grouped the same way. */
  folded: SwitchGroupView[];
  /** Counts, taken from the arrays above at call time. */
  openCount: number;
  foldedCount: number;
  foldLine: string;
  /** Positions she has never confirmed. The one act the lock is waiting on. */
  unconfirmed: SwitchRow[];
  confirmLine: string;
}

export interface SwitchboardInput {
  config: SwitchConfig;
  /** The migration's suggestions for this profile, if it carries any. */
  suggested?: SwitchConfig;
  /** The platforms this profile actually works. */
  platforms: string[];
  /** The platforms with a channel connected, for the collectors' suggestion. */
  connected?: string[];
}

/**
 * The position this switch should sit at unless something about this client
 * says otherwise. `null` means there is no sensible answer, and a row with no
 * sensible answer is always open, because folding it behind "everything else is
 * as it should be" would be a claim nobody can make.
 *
 * The registry cannot answer for the two generated families, so this does:
 * a platform this profile does not work is off and that IS as it should be, and
 * a collector follows whether that platform has a channel connected, which is
 * exactly what `suggestedTrackingState` is for.
 */
function sensibleFor(id: string, input: SwitchboardInput): PathState | null {
  const fromMigration = input.suggested?.[id]?.state;
  if (fromMigration) return fromMigration;

  if (id.startsWith(PLATFORM_SWITCH_PREFIX)) {
    const worked = input.platforms.some(p => platformSwitchId(p) === id);
    return worked ? null : 'hidden';
  }
  if (id.startsWith(TRACKING_SWITCH_PREFIX)) {
    const platform = input.platforms.find(p => trackingSwitchId(p) === id);
    if (!platform) return 'hidden';
    return suggestedTrackingState(
      (input.connected ?? []).some(c => trackingSwitchId(c) === id),
    );
  }
  return resolveSwitch(id)?.suggested_default ?? null;
}

function rowFor(id: string, input: SwitchboardInput): SwitchRow {
  const dec = resolveSwitch(id)!;
  const plain = plainSwitch(id)!;
  const set = input.config[id];
  const sensible = sensibleFor(id, input);
  // A suggestion she has not touched simply behaves as the suggestion (§5).
  const position: PathState = set?.state ?? sensible ?? 'hidden';
  // `suggested: true` is the migration's own mark, and it means the same thing
  // as no record at all: she has not said yes yet (spec 22 §8.5).
  const unconfirmed = !set || set.suggested === true;
  return {
    id,
    name: plain.name,
    line: plain.line,
    group: plain.group,
    position,
    positionWords: stateWords(position),
    choices: dec.allowed_states.map(state => ({
      state, words: stateWords(state), on: state === position,
    })),
    sensible,
    differs: sensible === null || position !== sensible,
    unconfirmed,
  };
}

function grouped(rows: SwitchRow[]): SwitchGroupView[] {
  return SWITCH_GROUPS
    .map(g => ({ id: g.id, title: g.title, rows: rows.filter(r => r.group === g.id) }))
    .filter(g => g.rows.length > 0);
}

function count(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * The whole screen, composed. Fixed switches are left out: they are not
 * positions she holds, and a row she cannot move is a row that only takes up
 * space (spec 21 §5.4).
 */
export function composeSwitchboard(input: SwitchboardInput): SwitchboardView {
  const rows = switchesForProfile(input.platforms)
    .filter(s => !s.fixed)
    .filter(s => !!plainSwitch(s.id))
    .map(s => rowFor(s.id, input));

  const open = rows.filter(r => r.differs);
  const folded = rows.filter(r => !r.differs);
  const unconfirmed = rows.filter(r => r.unconfirmed);

  return {
    open: grouped(open),
    folded: grouped(folded),
    openCount: open.length,
    foldedCount: folded.length,
    foldLine: folded.length === 1
      ? 'One more is as it should be'
      : `${folded.length} more are as they should be`,
    unconfirmed,
    confirmLine: unconfirmed.length === 1
      ? 'One position here has never had your yes. This confirms it exactly as it stands.'
      : `${count(unconfirmed.length, 'position here has', 'positions here have')} never had your `
        + 'yes. This confirms them exactly as they stand.',
  };
}

/**
 * The one act that answers the lock's fourth condition: take every position she
 * has never confirmed and write it exactly as it already behaves.
 *
 * It resolves through `effectiveState` first, so a position can never be
 * written `active` on top of a prerequisite that is not — which is the same
 * settle the acceptance tests do by hand, and it keeps `validateSwitchConfig`
 * from refusing the lock over a contradiction this action created.
 */
export function positionsToConfirm(input: SwitchboardInput): { id: string; state: PathState }[] {
  const view = composeSwitchboard(input);
  const merged: SwitchConfig = { ...input.config };
  for (const r of view.unconfirmed) {
    merged[r.id] = { state: r.position, set_at: '', suggested: true };
  }
  return view.unconfirmed.map(r => {
    const dec = resolveSwitch(r.id)!;
    const resolved = effectiveState(r.id, merged);
    const state = dec.allowed_states.includes(resolved)
      ? resolved
      : dec.allowed_states[dec.allowed_states.length - 1];
    return { id: r.id, state };
  });
}

// ── Moving one switch (spec 28 §5.6, in her words) ───────────────────────────

export interface MoveView {
  /** The switch being moved, by name. */
  title: string;
  /** "Turning this to off". */
  kicker: string;
  /** True when the move takes something away. */
  takingAway: boolean;
  /** What goes with it, by name. Her side, then theirs. Empty when turning on. */
  hers: string[];
  theirs: string[];
  /** What survives the move. S9: turning something off never removes history. */
  survives: string;
  /** Turning something on that something else is holding down, said plainly. */
  held: string | null;
}

/**
 * The preview that opens BEFORE a move commits. The cascade set is generated
 * from `cascadeOf` through `cascadeTrace` and read out through the plain names,
 * so no id reaches her through this door either.
 *
 * The old sheet showed "what goes away" whichever way the switch was moving,
 * which was nonsense on the way up. Turning something ON takes nothing away, so
 * this says the one thing that IS worth saying there: whether something else is
 * holding it down anyway.
 */
export function composeMove(
  id: string, to: PathState, config: SwitchConfig, trace: { hers: { id: string }[]; theirs: { id: string }[]; survives: string },
): MoveView {
  const from = config[id]?.state ?? resolveSwitch(id)?.suggested_default ?? 'hidden';
  const takingAway = stateRank(to) < stateRank(from);

  const names = (lines: { id: string }[]) => {
    const seen = new Set<string>();
    return lines
      .map(l => plainSwitch(l.id)?.name)
      .filter((n): n is string => !!n && n !== plainName(id) && !seen.has(n) && (seen.add(n), true));
  };

  const next: SwitchConfig = { ...config, [id]: { state: to, set_at: '' } };
  const holding = to === 'active'
    ? (resolveSwitch(id)?.requires ?? []).filter(r => effectiveState(r, next) !== 'active')
    : [];

  return {
    title: plainName(id),
    kicker: `Turning this to ${stateWords(to)}`,
    takingAway,
    hers: takingAway ? names(trace.hers) : [],
    theirs: takingAway ? names(trace.theirs) : [],
    survives: takingAway
      ? trace.survives
      : 'Nothing is taken away by turning something on.',
    held: holding.length > 0
      ? `It stays off until ${listWords(holding.map(plainName))} is on.`
      : null,
  };
}

// ── The Lock screen (§4) ─────────────────────────────────────────────────────

/**
 * What locking DOES, said before she is asked to do it. Two lines, and neither
 * of them was anywhere on the screen before — which is why she asked what the
 * deep idea of it is.
 */
export const WHAT_LOCKING_DOES: [string, string] = [
  'Locking opens Creation. Until it happens, nothing can be written there.',
  'It freezes this version of the strategy, and every piece made from here on is judged against it.',
];

export type LockGo = 'decide' | 'gates' | 'switches' | 'channels';

export interface LockItem {
  /** Stable key for the list. */
  id: string;
  /** The missing thing, in her words. Never an id, never a path. */
  what: string;
  /** Where she goes to do it. */
  go: LockGo;
}

export interface LockView {
  does: [string, string];
  /** ONLY what is missing. Anything decided never appears. */
  missing: LockItem[];
  ready: boolean;
  /** The button. */
  action: string;
  /** What the button will change, in plain words. */
  actionLine: string;
  /** After the lock: changing something is possible, and it costs this. */
  changeTitle: string;
  changeLines: string[];
}

const GO_FOR: Record<LockFailure['fix'], LockGo> = {
  derivation: 'decide',
  gates: 'gates',
  switchboard: 'switches',
  channels: 'channels',
};

/**
 * Any sentence that came out of the validator, with every switch id in it
 * swapped for its plain name. The validator writes for a developer; she reads
 * the same finding without ever meeting an id.
 */
export function plainSentence(text: string): string {
  let out = text;
  const ids = [
    ...SWITCHES.map(s => s.id),
    ...Object.keys(PLAIN_SWITCHES),
  ].sort((a, b) => b.length - a.length);
  for (const id of ids) {
    if (!out.includes(id)) continue;
    out = out.split(id).join(plainName(id).toLowerCase());
  }
  return out;
}

function gateItem(f: LockFailure): string {
  if (f.why.includes('no gate set')) return 'The five checks a piece must pass are not written yet';
  const m = /^(\d+) brand gates of (\d+)/.exec(f.why);
  if (m) {
    const done = Number(m[1]);
    const all = Number(m[2]);
    return `${all - done} of the ${all} checks are still to write`;
  }
  if (f.why.includes('voice or positioning')) {
    return 'Voice and positioning have to be decided first: the checks come out of them';
  }
  return f.why;
}

export interface LockInputView {
  failures: LockFailure[];
  locked: boolean;
  version: number | null;
  /** How many decisions the lock will freeze. Counted by the caller, from the
   *  array of lockable parameters. */
  decisionCount: number;
}

/**
 * The lock screen, composed from `lockViolations`' answers. It re-presents,
 * it never recomputes: if the validator is silent about something, this screen
 * is silent about it too.
 */
export function composeLock(input: LockInputView): LockView {
  const missing: LockItem[] = [];

  for (const f of input.failures) {
    if (f.condition === 4) continue; // collapsed below, into one line
    if (f.condition === 1) {
      missing.push({ id: `d:${f.where}`, what: `${f.where}: not decided yet`, go: 'decide' });
      continue;
    }
    if (f.condition === 2) {
      missing.push({
        id: `r:${f.where}`,
        what: `${f.where}: decided, with no line saying why`,
        go: 'decide',
      });
      continue;
    }
    if (f.condition === 3) {
      missing.push({ id: `g:${f.where}:${f.why}`, what: gateItem(f), go: GO_FOR[f.fix] });
      continue;
    }
    if (f.condition === 5) {
      missing.push({
        id: `v:${f.where}:${f.why}`,
        what: `${plainName(f.where)}: ${plainSentence(f.why)}`,
        go: 'switches',
      });
      continue;
    }
    missing.push({
      id: `c:${f.where}`,
      what: `${f.where}: on, with no account recorded yet`,
      go: 'channels',
    });
  }

  // Condition 4 is fourteen, or sixty, identical sentences about switches with
  // no position. It is ONE thing to go and do, so it is one line, and the count
  // is taken from the array it describes.
  const unset = input.failures.filter(f => f.condition === 4);
  if (unset.length > 0) {
    const names = unset.map(f => plainName(f.where));
    missing.push({
      id: 'switches',
      what: unset.length <= 3
        ? `${listWords(names)} still need your yes`
        : `${unset.length} switches still need your yes`,
      go: 'switches',
    });
  }

  const next = (input.version ?? 0) + 1;
  const frozen = count(input.decisionCount, 'decision freezes', 'decisions freeze');

  return {
    does: WHAT_LOCKING_DOES,
    missing,
    ready: missing.length === 0,
    action: input.locked ? `Lock version ${next}` : 'Lock it and open Creation',
    actionLine: input.locked
      ? `${frozen} again as version ${next}. From then on the client sees this version, `
        + 'and pieces already made keep the version they were judged against.'
      : `Creation opens for writing, and ${frozen} as version ${next}.`,
    changeTitle: input.locked ? 'Changing it after the lock' : 'You can change it later',
    changeLines: input.locked
      ? [
        'Any decision can be changed right now. Nothing is ever sealed away from you.',
        'What it costs: the change is a working edit until you lock again. Until then the client '
          + 'keeps seeing the locked version, and every piece already made stays judged against '
          + 'the version it was born under.',
      ]
      : [
        'Any decision can be changed at any time, before the lock and after it.',
        'What it costs after the lock: a change is a working edit, so the client keeps seeing the '
          + 'locked version until you lock again, and every piece already made stays judged '
          + 'against the version it was born under.',
      ],
  };
}

/** `a`, `a and b`, `a, b and c`. */
export function listWords(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}
