// The switch cascade, applied — PLAN §3.4, her canonical trace.
//
// "A client goes Instagram-only → the LinkedIn folder is off for this profile →
//  LinkedIn's formats never appear in the seed picker, LinkedIn strategy is
//  never asked for, no LinkedIn channel, no LinkedIn column in analysis — for
//  her OR the client."
//
// Whatever a switch turns off is NOT RENDERED — never grayed out — and nothing
// is deleted: it sits at `history`, readable, or `hidden`, out of the way (S9).

import type { PathState, SwitchConfig } from './contract.ts';
import type { Channel } from './objects.ts';
import { pathState, platformSwitchId, effectiveState } from './switches.ts';

/** Does this path render at all right now? Same answer for her and the client. */
export function isRendered(path: string, config: SwitchConfig): boolean {
  return pathState(path, config) === 'active';
}

/** Readable but frozen: past work survives a platform being switched off (S9). */
export function isReadableHistory(path: string, config: SwitchConfig): boolean {
  return pathState(path, config) === 'history';
}

export function platformState(platform: string, config: SwitchConfig): PathState {
  return effectiveState(platformSwitchId(platform), config);
}

/** The formats the seed picker may offer — always FROM the chosen platform. */
export function visibleFormats(
  formatsByPlatform: Record<string, string[]>, config: SwitchConfig,
): { platform: string; format: string }[] {
  const out: { platform: string; format: string }[] = [];
  for (const [platform, formats] of Object.entries(formatsByPlatform)) {
    if (platformState(platform, config) !== 'active') continue;
    for (const f of formats) out.push({ platform, format: f });
  }
  return out;
}

/** Channels of a switched-off platform disappear; the channel record survives. */
export function visibleChannels(channels: Channel[], config: SwitchConfig): Channel[] {
  if (effectiveState('creation.channels', config) !== 'active') return [];
  return channels.filter(c => platformState(c.platform, config) === 'active');
}

/** One analysis column per live platform. A switched-off platform has none. */
export function visibleAnalysisColumns(platforms: string[], config: SwitchConfig): string[] {
  if (effectiveState('analysis.tracking', config) !== 'active') return [];
  return platforms.filter(p => platformState(p, config) === 'active');
}

/** The strategy questions a platform brings with it. Off = never asked. */
export function visibleStrategyQuestions(platforms: string[], config: SwitchConfig): string[] {
  const out: string[] = [];
  for (const p of platforms) {
    const key = p.toLowerCase();
    for (const sub of ['how-it-works', 'formats', 'rules', 'connection']) {
      const path = `context/content-strategy/platforms/${key}/${sub}`;
      if (pathState(path, config) === 'active') out.push(path);
    }
  }
  return out;
}
