// The navigation map — spec 28 §5.1, §5.2, §5.3, §5.5.
//
// The three apps, and only the three apps. Every item here names the switches
// its content is governed by; nothing here invents a switch, because every app,
// tab, panel and picker the shell renders is governed by the switch its owning
// spec already registered. That is what makes the cascade trace complete (§5.6).
//
// The container rule runs over this map: a container renders when at least one
// of its children renders, and a container with no rendering children is NOT
// rendered — no empty app, no empty tab, no shell with nothing in it.

import type { PathState } from '../tree/contract.ts';
import type { RenderProfile, ShellRole } from '../tree/render.ts';
import { containerState, renderState } from '../tree/render.ts';

export interface NavNode {
  id: string;
  label: string;
  /** The switches this node's content is governed by. Any one rendering is enough. */
  switches: string[];
  children?: NavNode[];
}

/** §5.2 — Creation's five sub-tabs. Five, in that order, no sixth. */
export const CREATION_TABS: NavNode[] = [
  {
    id: 'board', label: 'Board',
    switches: ['creation.board', 'creation.review', 'creation.scheduling',
      'creation.publishing', 'creation.funnel'],
  },
  {
    id: 'assets', label: 'Assets',
    switches: ['assets.library', 'assets.drive_videos', 'assets.catalogue_export',
      'assets.share_target'],
  },
  {
    id: 'references', label: 'References',
    switches: ['references.from_client', 'references.our_vision'],
  },
  {
    id: 'logs', label: 'Logs',
    // The saved replies moved here with phase 2: the handoff puts "every
    // per-client one-off list - Orders, Cold calls, Saved replies, Leads" under
    // Logs → Pipelines, so the switch is addressed where the screen now is.
    switches: ['logs.tasks', 'logs.decisions', 'logs.requests', 'logs.changes',
      'logs.pipelines.lists', 'logs.pipelines.cold_calls', 'logs.pipelines.orders',
      'creation.funnel_replies',
      'logs.observations', 'logs.effort_meter', 'logs.effort_money'],
  },
  {
    id: 'engine', label: 'Engine',
    switches: ['creation.engine', 'creation.seed_extraction', 'creation.costume',
      'creation.brief', 'creation.drafting', 'creation.making'],
  },
];

/** §5.3 — spec 27's eight tabs, exactly as spec 27 §5 defines them. */
export const ANALYSIS_TABS: NavNode[] = [
  { id: 'now', label: 'Now', switches: ['analysis.always_live'] },
  { id: 'slices', label: 'Slices', switches: ['analysis.bifurcation'] },
  { id: 'scorecard', label: 'Scorecard', switches: ['analysis.scorecard'] },
  { id: 'funnel', label: 'Funnel', switches: ['analysis.funnel'] },
  { id: 'compare', label: 'Compare', switches: ['analysis.compare'] },
  { id: 'goals', label: 'Goals', switches: ['analysis.goal_tracking'] },
  { id: 'verdicts', label: 'Verdicts', switches: ['analysis.verdicts'] },
  { id: 'health', label: 'Health', switches: ['analysis.sync_health'] },
];

/** §5.5 — the owner corner. Owner, always, in every position of every switch. */
export const CORNER_PANELS: NavNode[] = [
  // 2026-08-11, and the reason this list shrank rather than grew.
  //
  // Her count on the day: "the first thing you see is positioning, audience,
  // voice, pillars, cadence... when you go to strategy, the same questions you
  // have to answer... there is this brand thing that has that same thing
  // again... Decide: same thing again." Four screens asking one set of
  // questions, and the fifth I added as a "draft" was a fifth copy.
  //
  // So: ONE page holds the brand's answers. Facts is gone (it was the same
  // eight boxes with fewer of them). Decide is gone from the rail and survives
  // only as the editor a row on The brand opens, which is what it always
  // really was. Gates went with the Engine she parked; it exists to police
  // machine drafts and polices nothing while the Engine is unused. Switches
  // went because it is plumbing, and "What they see" is the half of it she
  // actually wants, in her words.
  { id: 'brand-document', label: 'The brand', switches: ['strategy.fixed'] },
  { id: 'brand', label: 'Brand book', switches: ['strategy.visual_branding'] },
  { id: 'profile-mockup', label: 'Profile mockup', switches: ['strategy.profile_mockup'] },
  { id: 'channels', label: 'Channels', switches: ['creation.channels'] },
  { id: 'lock', label: 'Lock', switches: ['strategy.lock'] },
];

/**
 * Settings, kept apart from the brand work — her instruction: "what they see
 * should be in the settings feature... intake history, lifecycle, is also
 * something that maybe can be managed in a separate settings section."
 *
 * These are about how the profile is RUN, not about what the brand says, and
 * mixing the two is most of why the rail read as a pile.
 */
export const SETTINGS_PANELS: NavNode[] = [
  // "What they see" LEFT this rail on 2026-08-11. She asked whether settings
  // should live outside the app, and whether it was still needed here too. It
  // is not: access is about PEOPLE, not about one brand's strategy, and
  // keeping both copies would repeat the duplication she had just caught. It
  // lives at /settings, and `ClientAccess` is rendered there.
  { id: 'lifecycle', label: 'Lifecycle', switches: ['strategy.switchboard'] },
  { id: 'intake-history', label: 'Intake history', switches: ['intake.rounds_reopen'] },
];

/** Everything the room can draw, both groups. Routing reads this. */
export const ROOM_PANELS: NavNode[] = [...CORNER_PANELS, ...SETTINGS_PANELS];

/** §5.1 — the three apps, in the order the landing rule reads them. */
export const APPS: NavNode[] = [
  { id: 'intake', label: 'Intake', switches: ['intake.questionnaire', 'intake.finding_session'] },
  { id: 'creation', label: 'Creation', switches: [], children: CREATION_TABS },
  { id: 'analysis', label: 'Analysis', switches: [], children: ANALYSIS_TABS },
];

export interface RenderedNode extends NavNode {
  state: PathState;
  children?: RenderedNode[];
}

/** One node's state: its own switches, plus its children's (the container rule). */
export function nodeState(node: NavNode, profile: RenderProfile, role: ShellRole): PathState {
  const own = node.switches.map(s => renderState(profile, s, role));
  const kids = (node.children ?? []).map(c => nodeState(c, profile, role));
  return containerState([...own, ...kids]);
}

/** The nodes that render, with their state. A hidden node is simply absent. */
export function rendered(nodes: NavNode[], profile: RenderProfile, role: ShellRole): RenderedNode[] {
  const out: RenderedNode[] = [];
  for (const n of nodes) {
    const state = nodeState(n, profile, role);
    if (state === 'hidden') continue;
    const children = n.children ? rendered(n.children, profile, role) : undefined;
    out.push({ ...n, state, children });
  }
  return out;
}

/**
 * §5.1's landing rule: `/profile/<id>` goes to the first rendering app, in the
 * order Intake → Creation → Analysis. If none render, the interior opens on the
 * Strategy corner with one line naming what is owed. There is no profile home
 * screen: a fourth landing page would be a fourth thing to navigate.
 */
export function landingPath(profileId: string, profile: RenderProfile, role: ShellRole): string {
  const apps = rendered(APPS, profile, role);
  const first = apps[0];
  if (!first) return `/profile/${profileId}/strategy`;
  if (first.id === 'intake') return `/profile/${profileId}/intake`;
  const tab = first.children?.[0];
  return tab ? `/profile/${profileId}/${first.id}/${tab.id}` : `/profile/${profileId}/${first.id}`;
}
