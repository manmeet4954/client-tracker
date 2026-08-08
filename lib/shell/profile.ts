// The profile, as the shell sees it — spec 28 §3.4, §16.3.
//
// Two jobs, and no third: build the RenderProfile the resolver needs, and answer
// the one question the whole cutover turns on — is this profile in the new shell
// yet? That answer is DERIVED (§12.3 candidate 3, refused): a migrated body and
// a locked strategy ARE readiness, and a flag would be a third statement of a
// fact already stated twice, free to drift from both.
//
// Relative, extensioned imports: this module also runs under plain Node in the
// acceptance tests, where the `@/` alias does not exist.

import type { AppState, Client, ClientData } from '@/types';
import type { ClientDoor } from '../tree/contract.ts';
import type { Lifecycle } from '../tree/objects.ts';
import { doorsOpenAt } from '../tree/objects.ts';
import type { RenderProfile, ShellRole } from '../tree/render.ts';
import { switchConfigFromBody } from '../strategy/derivation.ts';
import { BODY_VERSION } from '../tree/body.ts';

/** Spec 21 shipped body version 21; a profile migrated for real carries it. */
export const CUTOVER_BODY_VERSION = BODY_VERSION;

/**
 * §16.3 shipped this as a GATE: a profile entered the new shell only once its
 * body was migrated AND its strategy had locked. Seven of the eight failed it,
 * so seven profiles kept opening the old tab bar and the app carried two whole
 * navigations at once. That was the single biggest complaint about the product.
 *
 * **Her decision, 2026-08-04 (the restructure handoff, phase 1): the gate is
 * dropped.** Every profile enters the new shell now, with the screens that
 * already exist mounted inside it, exactly as the handoff's phase 1 asks.
 *
 * Nothing about the LOCK changed. A write under `work-log/creation/` is still
 * refused server side until strategy locks (spec 22 §8.7), and an unlocked
 * profile's Creation renders READ-ONLY rather than disappearing — see
 * `renderState` step 4. The lock still gates; it no longer decides which shell
 * she is looking at.
 *
 * Kept as a function, and kept honest, so the one place this is decided stays
 * one place. `staysOnLegacy` is untouched: §19's open question about the intern
 * and Sonia is hers, and it is the only legacy door left.
 */
export function isCutOver(_data: ClientData | undefined): boolean {
  return true;
}

/**
 * §19's interim ruling, built explicitly rather than left to drift: a profile's
 * cutover moves the OWNER and CLIENT logins to the new shell. A STAFF binding —
 * the intern, who works inside her side — and Sonia's binding, whose daily
 * surfaces are Orders and the catalogue (both `audience: owner`, and PLAN §4
 * permits no fifth door), keep the legacy workspace for that profile until she
 * answers. Two shells coexist on one profile for as long as that takes.
 */
export function staysOnLegacy(role: string, bindingKind: string | undefined): boolean {
  if (bindingKind === 'staff') return true;
  return role === 'sonia';
}

/** Which login shape is this role, on this profile? */
export function shellRole(state: AppState, role: string, profileId: string): ShellRole {
  if (role === 'owner') return 'owner';
  const b = (state.bindings ?? []).find(x => x.role === role && x.profileId === profileId);
  return b?.kind === 'staff' ? 'staff' : 'client';
}

/** The doors this login holds on this profile, after the lifecycle scopes them. */
export function doorsFor(state: AppState, role: string, profileId: string): ClientDoor[] {
  if (role === 'owner') return [];
  const client = (state.clients ?? []).find(c => c.id === profileId);
  return doorsOpenAt(client?.lifecycle);
}

/** The one place a RenderProfile is built. Nothing else may assemble one. */
export function renderProfile(state: AppState, profileId: string, role: string): RenderProfile {
  const client = (state.clients ?? []).find(c => c.id === profileId);
  const data = state.clientData?.[profileId];
  const body = data?.body;
  return {
    id: profileId,
    config: body ? switchConfigFromBody(body) : {},
    lifecycle: (client?.lifecycle ?? 'active') as Lifecycle,
    owner_kind: client?.ownerKind === 'hers' ? 'hers' : 'client',
    strategy_locked: typeof body?.strategy_version === 'number',
    doors: role === 'owner' ? undefined : doorsFor(state, role, profileId),
  };
}

// ── The skin (§3.4) ──────────────────────────────────────────────────────────
//
// A profile is LIGHTLY skinned in its brand colour. The accent is CHROME ONLY:
// the header band, the active nav item, focus rings, primary buttons, the shelf
// card's edge. Content surfaces stay neutral — a client's carousel must look
// like their carousel, not like their carousel wearing a tint.

const DEFAULT_ACCENT = '#ea4711';

/** The existing pickAccent logic, kept: brand kit primary, else the stored colour. */
export function pickAccent(
  brandColors: { hex: string; role?: string }[] | undefined, fallback: string,
): string {
  if (!brandColors?.length) return fallback;
  const primary = brandColors.find(c => /primary|accent/i.test(c.role ?? ''));
  return primary?.hex ?? brandColors[0]?.hex ?? fallback;
}

export function accentFor(client: Client | undefined, data: ClientData | undefined): string {
  return pickAccent(data?.brandKit?.colors, client?.color ?? DEFAULT_ACCENT);
}

/**
 * The profile's HUE — its identity colour, and nothing else.
 *
 * Her decision, 2026-08-04: chrome is ink everywhere, and a profile's colour is
 * identity only. It draws the dot beside the name, the avatar square, the left
 * edge of a card, a chip on the month grid. It never paints a rail, a tab, a
 * button or a header band. Eight profiles used to mean eight coloured chromes,
 * which is most of why the app read as noise.
 *
 * The hue is the profile's own stored colour, not the brand kit's primary:
 * identity should not move when a client changes their palette. `accentFor`
 * stays for the legacy screens that still paint with the brand kit.
 */
export function hueFor(client: Client | undefined): string {
  return client?.color ?? DEFAULT_ACCENT;
}

/** Her own profiles first, then clients, then archived — the shelf's grouping. */
export function shelfGroupOf(client: Client): 'hers' | 'clients' | 'archived' {
  if (client.lifecycle === 'archived') return 'archived';
  return client.ownerKind === 'hers' ? 'hers' : 'clients';
}
