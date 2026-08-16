// What a client would see if they logged in right now — 2026-08-11.
//
// HER QUESTION: "I have to properly share the access of this tool with my
// clients and make sure or see they are able to do what they need to see."
// Until now the only way to SEE it was to log in with the client's own code,
// which is how a link gets sent and the empty screen gets discovered by the
// client instead of by her.
//
// THE ONE RULE THIS FILE LIVES BY: it never re-implements access. The open
// list comes from `windowsForBinding`, the same function the server uses to
// grant a real client their windows, called against a temporary binding. If
// the preview and reality ever disagree, reality wins by construction, because
// the preview IS reality asked politely.
//
// The reasons for closed windows are advisory sentences layered on top; they
// explain, they never grant.
//
// Pure: no React, no clock.

import type { AppState } from '../../types/index.ts';
import {
  normalizeState, windowsForBinding, type ClientWindow, type Role,
} from '../access.ts';
import { switchConfigFromBody } from '../strategy/derivation.ts';
import { WINDOW_CHOICES, windowsOn, type WindowKey } from './windowChoice.ts';
import type { PathState } from '../tree/contract.ts';

/** Namespaced like an invite so no legacy-role rule ever catches it. */
const PREVIEW_ROLE = 'guest:__preview__' as Role;

export interface ClosedWindow {
  key: WindowKey;
  label: string;
  /** Why the client would not see it, in a sentence she can act on. */
  why: string;
}

export interface ClientView {
  /** What they can actually open, by the real rules. */
  open: ClientWindow[];
  closed: ClosedWindow[];
  /** True when nothing at all would render for them. */
  nothing: boolean;
}

export function clientView(state: AppState, profileId: string): ClientView {
  const norm = normalizeState(state);

  // The temporary binding: a client-kind login bound to exactly this profile.
  // Everything else about the state is real.
  const withPreview: AppState = {
    ...norm,
    bindings: [
      ...(norm.bindings ?? []),
      { role: PREVIEW_ROLE, profileId, kind: 'client' as const },
    ],
  };
  const open = windowsForBinding(withPreview, PREVIEW_ROLE, profileId);
  const openIds = new Set(open.map(w => w.id));

  const client = norm.clients.find(c => c.id === profileId);
  const lifecycle = client?.lifecycle ?? 'active';
  const body = norm.clientData?.[profileId]?.body;
  const positions: Record<string, PathState | undefined> = body
    ? Object.fromEntries(Object.entries(switchConfigFromBody(body)).map(([id, v]) => [id, v.state]))
    : {};
  const ticked = windowsOn(positions);

  const closed: ClosedWindow[] = [];
  for (const w of WINDOW_CHOICES) {
    if (openIds.has(w.key)) continue;
    closed.push({ key: w.key, label: w.label, why: whyClosed(w.key, {
      hasBody: !!body, lifecycle, ticked,
    }) });
  }

  return { open, closed, nothing: open.length === 0 };
}

function whyClosed(key: WindowKey, ctx: {
  hasBody: boolean;
  lifecycle: string;
  ticked: WindowKey[];
}): string {
  // The setup-only and needs-a-lock reasons LIVED HERE and are gone with the
  // rules themselves (2026-08-11, her order). What remains is everything that
  // can still close a window: no body, a resting lifecycle, or her switch.
  if (!ctx.hasBody) return 'This profile is not in the new structure yet.';
  if (['paused', 'closing', 'archived'].includes(ctx.lifecycle)) {
    return `The profile is ${ctx.lifecycle}, which closes every client door.`;
  }
  if (!ctx.ticked.includes(key)) return 'Switched off above.';
  return 'Not open in this lifecycle.';
}
