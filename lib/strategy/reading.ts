// The three reading sections of the Strategy room — spec 34 §6, §7 and §8.
//
// Spec 34 §1, and it is one sentence: the Strategy corner renders the DATA
// MODEL instead of the work. Channels drew a list of stored channel records and
// never said what a channel is for. Gates drew the word "gate", a coloured dot
// and a pill, and never showed the sentence a piece is actually checked
// against. Brand kit drew its content in a different visual language from the
// rest of the room.
//
// This file is the part of the fix that is not React: every line of copy those
// three screens put on screen, computed from the stored records. It holds to
// four things:
//
// 1. NOTHING HERE WRITES. Reading only. The stored records are spec 22's and
//    stay exactly as they are: a strategy decided through the new screens is
//    the same record a typed one made (§9.7).
// 2. EVERY COUNT IS COUNTED from the array it describes, at call time. No
//    number is ever typed into a sentence.
// 3. NOT CONNECTED IS NOT AN ERROR (§6). A channel with no account says, in one
//    line, what stays unavailable while it is that way. There is no failure
//    language, no red, and nothing to apologise for.
// 4. WHERE THERE IS NOTHING YET, IT SAYS WHAT WILL PRODUCE ONE (§7) rather than
//    drawing an empty list. An empty list is the data model showing through.
//
// No switch id, no path and no count of sources ever leaves this file (§9.1).

import type { ProfileBody } from '../tree/body.ts';
import { readPath } from '../tree/body.ts';
import { OPERATIONAL_GATES } from '../tree/objects.ts';
import { CHANNELS_PATH, gateSources, readGateSet, readStrategy } from './derivation.ts';

const CS = 'context/content-strategy';

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

// ─────────────────────────────────────────────────────────────────────────────
// §6 Channels — say what it is for
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The one line at the top. Her words back to her: what this screen is, and why
 * connecting an account is not an optional tidy-up.
 */
export const CHANNELS_PURPOSE =
  'This is where this brand posts, and where the numbers come from. Connecting an account is what makes Analysis work at all.';

/**
 * Which platforms this app can actually pull numbers from today. Instagram is
 * the only one: `app/api/ig-sync` is the whole collection layer that exists.
 *
 * Naming it here rather than assuming it keeps the screen honest. A LinkedIn
 * row does not get to imply a connect button that would do nothing.
 */
export const COLLECTABLE_PLATFORMS = ['instagram'];

export function collectable(platform: string): boolean {
  return COLLECTABLE_PLATFORMS.includes(platform.trim().toLowerCase());
}

/** A stored channel record, as the body holds it. */
export interface ChannelRecord {
  id: string;
  platform: string;
  handle?: string;
  timezone?: string;
  posting_permission?: string;
}

/** An account the connection machinery has, already narrowed to this profile. */
export interface ConnectedAccount {
  id: string;
  username: string;
}

export interface ChannelRow {
  key: string;
  /** "Instagram". Always a name, never an id. */
  platform: string;
  /** "@resumeguru.ai", or empty where no account has been named. */
  account: string;
  connected: boolean;
  /**
   * The state, in words. A platform this app cannot collect from does not read
   * "not connected", because there is nothing there to connect and saying so
   * would be inventing a fault out of a fact.
   */
  state: 'Connected' | 'Not connected' | 'By hand';
  /** Who puts the post up. Plain words, never the stored token. */
  posting: string;
  /** What connecting gets her. One line, present whether it is connected or not. */
  gets: string;
  /** ONE line on what stays unavailable while it is not connected. Empty
   *  wherever that line would only repeat what `gets` already said. */
  without: string;
  /** False where this app has no way to collect from this platform at all. */
  collectable: boolean;
}

function tidyHandle(handle: string | undefined): string {
  const h = (handle ?? '').trim();
  if (!h) return '';
  return h.startsWith('@') ? h : `@${h}`;
}

function sameHandle(a: string, b: string): boolean {
  const norm = (s: string) => s.trim().toLowerCase().replace(/^@/, '');
  return norm(a) !== '' && norm(a) === norm(b);
}

function stateWord(isCollectable: boolean, isConnected: boolean): ChannelRow['state'] {
  if (!isCollectable) return 'By hand';
  return isConnected ? 'Connected' : 'Not connected';
}

function postingWords(permission: string | undefined): string {
  if (permission === 'we-post') return 'We post here';
  if (permission === 'client-posts') return 'They post here';
  return 'Nobody has said who posts here';
}

/** Every channel record this profile holds. */
export function channelRecords(body: ProfileBody | undefined): ChannelRecord[] {
  if (!body) return [];
  return readPath(body, CHANNELS_PATH)
    .filter(e => e.state === 'active')
    .map(e => {
      const d = e.data as { platform?: string; handle?: string; timezone?: string; posting_permission?: string };
      return {
        id: e.id,
        platform: (d.platform ?? '').trim(),
        handle: d.handle,
        timezone: d.timezone,
        posting_permission: d.posting_permission,
      };
    })
    .filter(c => c.platform !== '');
}

/**
 * The platforms she decided on, whatever shape that decision is stored in.
 *
 * Decide is being rebuilt in the same spec so that Platforms is a pick from a
 * list rather than an essay (§3). The stored record is unchanged either way, so
 * this reads BOTH: the array a pick-list writes, and the prose a typed one left
 * behind. A prose value is split on the separators a person actually types.
 */
export function decidedPlatforms(body: ProfileBody | undefined): string[] {
  if (!body) return [];
  const decision = readStrategy(body, `${CS}/platforms`);
  if (!decision || decision.not_applicable) return [];
  const value = decision.value;
  const raw: string[] = Array.isArray(value)
    ? value.map(v => String(v))
    : typeof value === 'string'
      ? value.split(/[,\n;/]+| and /i)
      : [];
  const out: string[] = [];
  for (const item of raw) {
    const name = item.trim();
    if (!name) continue;
    if (!out.some(o => o.toLowerCase() === name.toLowerCase())) out.push(name);
  }
  return out;
}

function getsLine(platform: string, isCollectable: boolean, isConnected: boolean): string {
  if (!isCollectable) {
    return `Numbers are not pulled in from ${platform}. What gets posted here is recorded by hand, and Analysis reads what is recorded.`;
  }
  if (isConnected) {
    return 'The numbers arrive on their own every night: reach, saves, follows, and which piece did it. That is what Analysis reads.';
  }
  return 'Connect the account and the numbers arrive on their own every night: reach, saves, follows, and which piece did it.';
}

/**
 * The one line about what stays unavailable. Only where there is genuinely
 * something to connect: on a platform this app cannot collect from, `gets`
 * already said the whole truth and a second line would only repeat it.
 */
function withoutLine(platform: string, isCollectable: boolean): string {
  if (!isCollectable) return '';
  return `Until it is connected, Analysis has nothing to read for ${platform}. Everything else on this profile works as normal.`;
}

/**
 * One row per channel this profile has, plus one per platform she decided on
 * that has no record yet — because a platform decided and never set up is
 * exactly the thing she needs to see here, and it is invisible if the screen
 * only lists stored records.
 */
export function buildChannelRows(input: {
  channels: ChannelRecord[];
  platforms: string[];
  accounts: ConnectedAccount[];
}): ChannelRow[] {
  const rows: ChannelRow[] = [];

  for (const c of input.channels) {
    const isCollectable = collectable(c.platform);
    const handle = tidyHandle(c.handle);
    const match = isCollectable
      ? input.accounts.find(a => (handle ? sameHandle(handle, a.username) : true))
      : undefined;
    const connected = !!match;
    rows.push({
      key: c.id,
      platform: c.platform,
      account: connected && match ? tidyHandle(match.username) : handle,
      connected,
      state: stateWord(isCollectable, connected),
      posting: postingWords(c.posting_permission),
      gets: getsLine(c.platform, isCollectable, connected),
      without: connected ? '' : withoutLine(c.platform, isCollectable),
      collectable: isCollectable,
    });
  }

  for (const p of input.platforms) {
    if (rows.some(r => r.platform.toLowerCase() === p.toLowerCase())) continue;
    const isCollectable = collectable(p);
    rows.push({
      key: `platform:${p.toLowerCase()}`,
      platform: p,
      account: '',
      connected: false,
      state: stateWord(isCollectable, false),
      posting: 'Nobody has said who posts here',
      gets: getsLine(p, isCollectable, false),
      without: withoutLine(p, isCollectable),
      collectable: isCollectable,
    });
  }

  return rows;
}

/**
 * The summary line, counted from the rows it describes.
 *
 * "None connected" is measured against the channels that CAN be connected, not
 * against all of them. A profile posting to LinkedIn by hand is not two thirds
 * unfinished, and a line that says so is the data model talking again.
 */
export function channelSummary(rows: ChannelRow[]): string {
  if (rows.length === 0) return 'No channel here yet.';
  const channels = `${rows.length} ${plural(rows.length, 'channel', 'channels')}`;
  const connectable = rows.filter(r => r.collectable);
  const connected = connectable.filter(r => r.connected).length;
  if (connectable.length === 0) return `${channels}, all recorded by hand.`;
  if (connected === 0) return `${channels}, nothing connected yet.`;
  if (connected === connectable.length) return `${channels}, everything that can be connected is.`;
  return `${channels}, ${connected} of ${connectable.length} connected.`;
}

/**
 * The line under the rows, where at least one of them is a platform this app
 * cannot collect from. It names the limit once. It does not re-list the
 * platforms, because every one of those rows has already said it about itself.
 */
export function channelsNote(rows: ChannelRow[]): string {
  if (rows.every(r => r.collectable)) return '';
  return 'Instagram is the only platform numbers are collected from today.';
}

/** Whether the connect box has anything to offer. Nothing to connect, no box. */
export function canConnectHere(rows: ChannelRow[]): boolean {
  return rows.some(r => r.collectable && !r.connected);
}

// ─────────────────────────────────────────────────────────────────────────────
// §7 Gates — the checks, written out
// ─────────────────────────────────────────────────────────────────────────────

export const GATES_PURPOSE =
  'These are the sentences every piece is checked against before it can go to review.';

/**
 * Why the two operational gates never vary. §7 asks for them to be shown as
 * fixed AND to say why; "fixed" without a reason is just another pill.
 */
export const FIXED_GATE_WHY: Record<string, string> = {
  accuracy: 'This one is the same for every brand. A claim that is not true is not a matter of taste.',
  format: 'This one is the same for every brand. A piece that breaks on its platform has already failed.',
};

export interface GateLine {
  id: string;
  name: string;
  /** The sentence a piece has to answer yes to. */
  sentence: string;
}

export interface FixedGateLine extends GateLine {
  why: string;
}

export interface GateReading {
  /** The five that come out of this brand. Empty until a set is written. */
  brand: GateLine[];
  /** The two that never vary. Always both, always shown. */
  fixed: FixedGateLine[];
  /** The version of the written set, or null where none exists. */
  version: number | null;
  /** The headline, counted from the two arrays above. */
  headline: string;
  /** What must happen before a set can exist. Empty once one does. */
  missing: string[];
  /** One line naming what will produce a set. Empty once one exists. */
  whatProduces: string;
  /** The decided voice, as she wrote it. Null where it is not decided. */
  voice: string | null;
  /** The decided positioning. Null where it is not decided. */
  positioning: string | null;
}

function decisionText(value: unknown): string | null {
  if (value == null) return null;
  if (Array.isArray(value)) {
    const words = value.map(v => String(v).trim()).filter(Boolean);
    return words.length ? words.join(', ') : null;
  }
  const text = String(value).trim();
  return text ? text : null;
}

/**
 * The gate set as sentences, plus what is standing between her and having one.
 *
 * The brand gates are read out of the written set exactly as `buildGateSet`
 * assembled it — that function is the authority on what a set contains, and
 * this reads its output rather than deriving a second version of it. The two
 * operational gates come from `OPERATIONAL_GATES`, which is where they are
 * declared once for the whole app.
 */
export function readGates(body: ProfileBody | undefined): GateReading {
  const fixed: FixedGateLine[] = OPERATIONAL_GATES.map(g => ({
    id: g.id,
    name: g.name,
    sentence: g.question,
    why: FIXED_GATE_WHY[g.id] ?? 'This one is the same for every brand.',
  }));

  if (!body) {
    return {
      brand: [], fixed, version: null,
      headline: gatesHeadline([], fixed),
      missing: ['Nothing has been set up on this profile yet'],
      whatProduces: 'Decide the voice and the positioning first. The checks are written from those two.',
      voice: null, positioning: null,
    };
  }

  const sources = gateSources(body);
  const voice = sources.voice && !sources.voice.not_applicable ? decisionText(sources.voice.value) : null;
  const positioning = sources.positioning && !sources.positioning.not_applicable
    ? decisionText(sources.positioning.value) : null;

  const set = readGateSet(body);
  const brand: GateLine[] = (set?.gates ?? [])
    .filter(g => g.kind === 'brand')
    .map(g => ({ id: g.id, name: g.name, sentence: g.question }));

  const missing: string[] = [];
  if (!voice) missing.push('The voice is not decided yet');
  if (!positioning) missing.push('The positioning is not decided yet');
  if (brand.length === 0 && missing.length === 0) missing.push('The five checks have not been written yet');

  return {
    brand, fixed, version: set?.version ?? null,
    headline: gatesHeadline(brand, fixed),
    missing: brand.length > 0 ? [] : missing,
    whatProduces: brand.length > 0 ? '' : whatProducesGates(voice, positioning),
    voice, positioning,
  };
}

/** Counted from both arrays. Never a typed seven. */
export function gatesHeadline(brand: GateLine[], fixed: FixedGateLine[]): string {
  const total = brand.length + fixed.length;
  if (brand.length === 0) {
    return `${fixed.length} ${plural(fixed.length, 'check', 'checks')} so far, and they are the two that never change.`;
  }
  return `${total} ${plural(total, 'check', 'checks')}: ${brand.length} for this brand, ${fixed.length} that never change.`;
}

/** §7: where no set exists, say what will produce one. */
export function whatProducesGates(voice: string | null, positioning: string | null): string {
  if (!voice && !positioning) {
    return 'The checks are written from the voice and the positioning. Decide those two and this screen fills itself.';
  }
  if (!voice) return 'The positioning is decided. Decide the voice too, and the checks can be written from both.';
  if (!positioning) return 'The voice is decided. Decide the positioning too, and the checks can be written from both.';
  return 'The voice and the positioning are both decided, so the five checks can be written now.';
}

/** Can she write the set at all? Voice and positioning have to exist first. */
export function gatesWritable(reading: GateReading): boolean {
  return !!reading.voice && !!reading.positioning;
}

// ─────────────────────────────────────────────────────────────────────────────
// §8 Brand kit — the same rhythm as the rest of the room
// ─────────────────────────────────────────────────────────────────────────────
//
// She said the content is fine (§8). Nothing here changes what it holds or how
// it is stored; this is the counting and the copy that lets the layout match
// the other sections.

export interface BrandKitCounts {
  colors: number;
  fonts: number;
  logos: number;
}

export const BRAND_KIT_PURPOSE =
  'The colours, the type and the logo files this brand is made from. Anyone working on a piece takes them from here.';

/** Counted from the arrays, every time. */
export function brandKitCounts(kit: {
  colors?: unknown[]; fonts?: unknown[]; logos?: unknown[];
} | undefined): BrandKitCounts {
  return {
    colors: kit?.colors?.length ?? 0,
    fonts: kit?.fonts?.length ?? 0,
    logos: kit?.logos?.length ?? 0,
  };
}

export function brandKitSummary(counts: BrandKitCounts): string {
  const parts: string[] = [];
  if (counts.colors) parts.push(`${counts.colors} ${plural(counts.colors, 'colour', 'colours')}`);
  if (counts.fonts) parts.push(`${counts.fonts} ${plural(counts.fonts, 'font', 'fonts')}`);
  if (counts.logos) parts.push(`${counts.logos} ${plural(counts.logos, 'logo', 'logos')}`);
  if (parts.length === 0) return 'Nothing in the kit yet.';
  if (parts.length === 1) return `${parts[0]}.`;
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}.`;
}

/** The empty line for one section of the kit. Plain, and never a scolding. */
export function brandKitEmpty(section: 'colors' | 'fonts' | 'logos'): string {
  if (section === 'colors') return 'No colours yet. Add the ones this brand actually uses.';
  if (section === 'fonts') return 'No type yet. Add the faces this brand sets its words in.';
  return 'No logo files yet. Put them here once and nobody has to ask for them again.';
}
