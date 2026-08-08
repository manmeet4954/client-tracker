// The switch registry — spec 21 §5, amendments S8 and S9, PLAN §3.4.
//
// Her law: EVERY feature registers its switch at birth. So this registry is
// exhaustive, including the things that can never be turned off — those carry
// `fixed: true` and `allowed_states: ['active']` rather than escaping the list.
//
// Defaults here are SUGGESTIONS. Migration never sets a position (spec 21 §9.6);
// she sets them after intake → curation → strategy, and a migrated profile keeps
// rendering exactly what it renders today until she does.

import type { ClientDoor, PathState, SwitchConfig, SwitchDeclaration } from './contract.ts';
import { minState, stateRank } from './contract.ts';
import { DECLARATIONS, findDeclaration } from './declarations.ts';
// spec 26 §9 — the S16 gate is enforced at strategy lock, inside this file's
// validator, because that is where every other contradiction refuses activation.
import type { MeasurementDeclaration } from './objects.ts';
import { validateMeasurementDeclaration } from './measurement.ts';

const S = (s: SwitchDeclaration): SwitchDeclaration => s;

/** The wildcard platform switch. One real switch per platform entry. */
export const PLATFORM_SWITCH_PREFIX = 'platforms.';

export function platformSwitchId(platform: string): string {
  return PLATFORM_SWITCH_PREFIX + platform.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

// spec 26 §11 — one collector switch per platform entry, generated the same way
// `platforms.<platform>` is. It exists so the platform switch can depend on ITS
// platform's tracking only: turning LinkedIn off must not drag the whole
// tracking switch and stop Instagram collecting.
export const TRACKING_SWITCH_PREFIX = 'analysis.tracking.';

export function trackingSwitchId(platform: string): string {
  return TRACKING_SWITCH_PREFIX + platform.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

export const SWITCHES: SwitchDeclaration[] = [
  // ── Structural: fixed, but still on the list (spec 21 §5.4) ───────────────
  S({
    id: 'spine.fixed', owns: ['context', 'work-log', 'work-log/logs'], requires: [], dependents: [],
    audience: 'owner', allowed_states: ['active'], suggested_default: 'active', fixed: true,
    note: 'The frozen spine (law 1). Never moves.',
  }),
  S({
    id: 'strategy.fixed', owns: ['context/content-strategy'], requires: [], dependents: [],
    audience: 'both', allowed_states: ['active'], suggested_default: 'active', fixed: true,
    note: 'Strategy is not a switch — it is the always-on layer that OWNS the switchboard.',
  }),
  S({
    id: 'shelf.profiles', owns: ['shelf/profiles'], requires: [], dependents: [],
    audience: 'owner', allowed_states: ['active'], suggested_default: 'active', fixed: true,
  }),
  S({
    id: 'client_access.login', owns: [], requires: [], dependents: [
      'creation.review', 'creation.review_perception', 'assets.client_upload',
      'intake.questionnaire', 'references.from_client', 'creation.seed_input_client',
      'analysis.digest_client',
    ],
    audience: 'client', allowed_states: ['active', 'hidden'], suggested_default: 'hidden',
    derived_from: 'profile lifecycle + working-mode',
    note: 'A client login exists for this profile. Revoked at the `closing` lifecycle state (S22).',
  }),
  S({
    id: 'shelf.today_strip', owns: ['shelf/today-strip'], requires: ['logs.tasks'], dependents: [],
    audience: 'owner', allowed_states: ['active', 'hidden'], suggested_default: 'active',
    note: 'Her one cross-profile window (PLAN §2).',
  }),
  // ── spec 28 §13.2 — the shell's three new switches (the fourth sits with
  // review, below). The shell adds no switch to anything that already had one:
  // every app, tab and panel it renders is governed by the switch its owning
  // spec already registered, which is what makes the cascade trace complete.
  S({
    // `owns: []` follows spec 22 §9.2's precedent: the per-profile pulse ENTRIES
    // stay governed by `analysis.pulse_owner`, whose declaration names their
    // path. This switch owns the composition on the shelf, and nothing else.
    id: 'shelf.weekly_pulse', owns: [], requires: ['shelf.profiles'], dependents: [],
    audience: 'owner', allowed_states: ['active', 'hidden'], suggested_default: 'active',
    derived_from: 'spec 28 §13.2',
    note: 'The pulse block on the shelf — the composition, never the entries. Each profile writes its own weekly-pulse entry into its own digests (spec 27 §13.2); the shelf composes her one screen from them and stores nothing between profiles.',
  }),
  S({
    id: 'shelf.add_profile', owns: ['shelf/profiles'], requires: ['shelf.profiles'], dependents: [],
    audience: 'owner', allowed_states: ['active'], suggested_default: 'active', fixed: true,
    derived_from: 'structural (spec 28 §13.2)',
    note: 'The add-profile tile and the shell’s one write. Fixed: a dashboard whose owner can be locked out of creating a workspace is broken, not configured.',
  }),
  S({
    id: 'client_access.mini_shelf', owns: [], requires: ['client_access.login'], dependents: [],
    audience: 'client', allowed_states: ['active'], suggested_default: 'active', fixed: true,
    derived_from: 'structural: it renders exactly when a person holds more than one live binding',
    note: 'The multi-binding picker (spec 28 §7.2) — their own profiles only, never anyone else’s. Fixed: there is no honest position in which a single binding should show a picker.',
  }),

  // ── Intake ────────────────────────────────────────────────────────────────
  S({
    id: 'intake.questionnaire',
    owns: ['context/intake', 'context/intake/questions', 'context/intake/answers'],
    requires: [], dependents: [],
    audience: 'both', allowed_states: ['active', 'history', 'hidden'], suggested_default: 'active',
    derived_from: 'delivery mode chosen per client',
    note: 'Retires from the client’s navigation once Context is curated; history stays (S10). Curating the last parameter writes this to hidden, and reopening writes it back.',
  }),
  S({
    id: 'intake.finding_session', owns: ['context/intake/answers'], requires: ['intake.questionnaire'],
    dependents: [], audience: 'both', allowed_states: ['active', 'history', 'hidden'],
    suggested_default: 'hidden', derived_from: 'delivery mode chosen per client',
    note: 'The recorded meeting route. Same fields, different door.',
  }),
  S({
    // Spec 33 §2. The third route: a document is another way the same answers
    // travel, so it sits beside the questionnaire and the meeting rather than
    // opening a door of its own. It is give-point 1, which already exists — no
    // fifth door (S19).
    id: 'intake.documents', owns: ['context/intake/answers'], requires: ['intake.questionnaire'],
    dependents: [], audience: 'both', allowed_states: ['active', 'history', 'hidden'],
    suggested_default: 'active', derived_from: 'delivery mode chosen per client',
    note: 'Files, links and pasted text handed over during intake. Read in curation beside typed answers.',
  }),
  S({
    id: 'intake.rounds_reopen', owns: ['context/intake'], requires: [],
    dependents: [], audience: 'owner', allowed_states: ['active', 'hidden'], suggested_default: 'active',
    // It USED to require `intake.questionnaire`, which was backwards: retiring
    // Intake would have hidden the one door that brings it back, at exactly the
    // moment that door is needed. S10 says a retired intake stays reopenable, so
    // reopen cannot depend on intake being open. It stands on its own.
    note: 'Owner-triggered versioned reopen for selected parameters (S10). Deliberately independent of intake.questionnaire: reopening is how a RETIRED intake comes back.',
  }),
  // Spec 22 §9.2. Owner-side surface switches carry `owns: []` and name what
  // they govern in their note: the governing switch of a PATH stays the one its
  // declaration names, so nothing is re-pointed.
  S({
    id: 'intake.curation', owns: [], requires: ['spine.fixed'], dependents: [],
    audience: 'owner', allowed_states: ['active'], suggested_default: 'active', fixed: true,
    derived_from: 'structural: her pass is the only writer of the detail folders',
    note: 'The curation workspace (spec 22 §7).',
  }),
  S({
    id: 'intake.reminders', owns: [], requires: ['intake.questionnaire', 'client_access.login'],
    dependents: [], audience: 'client', allowed_states: ['active', 'hidden'], suggested_default: 'hidden',
    derived_from: 'working-mode: does this client need chasing',
    note: 'Nudging a client whose round is sent. DECLARED, UNBUILT — she chases on WhatsApp today and that keeps working.',
  }),

  // ── Strategy-owned parameters ─────────────────────────────────────────────
  S({
    id: 'strategy.visual_branding', owns: ['context/content-strategy/visual-branding'],
    requires: ['strategy.fixed'], dependents: [], audience: 'both',
    allowed_states: ['active'], suggested_default: 'active', fixed: true,
  }),
  // Spec 22 §9.2 — the four strategy surfaces. Structural: strategy is not a
  // switch (PLAN §3.10), it is the always-on layer that owns the switchboard.
  S({
    id: 'strategy.derivation', owns: [], requires: ['strategy.fixed'],
    dependents: ['strategy.gate_set', 'strategy.switchboard', 'strategy.lock'],
    audience: 'owner', allowed_states: ['active'], suggested_default: 'active', fixed: true,
    derived_from: 'structural (PLAN §3.10)',
    note: 'The derivation workspace: sources, decision, reason (spec 22 §8.2).',
  }),
  S({
    id: 'strategy.gate_set', owns: [], requires: ['strategy.derivation'], dependents: [],
    audience: 'owner', allowed_states: ['active'], suggested_default: 'active', fixed: true,
    derived_from: 'structural',
    note: 'The v1 gate set surface (S14). Five brand gates from voice and positioning.',
  }),
  S({
    id: 'strategy.switchboard', owns: [], requires: ['strategy.derivation'], dependents: [],
    audience: 'owner', allowed_states: ['active'], suggested_default: 'active', fixed: true,
    derived_from: 'structural',
    note: 'The switch-setting step (PLAN §3.4). Suggestions are shown as suggestions.',
  }),
  S({
    id: 'strategy.lock', owns: [],
    requires: ['strategy.derivation', 'strategy.gate_set', 'strategy.switchboard'],
    dependents: ['creation.board'],
    audience: 'owner', allowed_states: ['active'], suggested_default: 'active', fixed: true,
    derived_from: 'structural',
    note: 'The lock action and its validation. Creation cannot be active where strategy has not locked (spec 22 §8.7).',
  }),

  // ── Platforms — the cascade parents ───────────────────────────────────────
  // One switch per platform entry; created for a profile from its platform list.
  ...['Instagram', 'LinkedIn', 'YouTube'].map(p =>
    S({
      id: platformSwitchId(p),
      owns: [`context/content-strategy/platforms/${p.toLowerCase()}`],
      requires: ['strategy.fixed'],
      // Spec 26 §11's cascade refinement: `analysis.tracking` here was coarse —
      // turning LinkedIn off would have dragged the whole tracking switch, and
      // with it Instagram's collection. The platform now depends on ITS
      // platform's collector only.
      dependents: ['creation.channels', trackingSwitchId(p)],
      audience: 'both', allowed_states: ['active', 'history', 'hidden'],
      suggested_default: null,
      derived_from: 'the platforms this profile actually publishes on',
      note: `Turning ${p} off removes its formats, its strategy questions, its channel, and its analysis column — both sides.`,
    })),

  // ── Creation ──────────────────────────────────────────────────────────────
  S({
    id: 'creation.board', owns: ['work-log/creation'], requires: ['strategy.fixed'],
    dependents: ['creation.making', 'creation.review', 'creation.scheduling'],
    audience: 'both', allowed_states: ['active', 'history', 'hidden'], suggested_default: 'active',
  }),
  S({
    id: 'creation.engine',
    owns: [
      'work-log/creation/topics',
      'work-log/creation/topics/captures',
      'work-log/creation/topics/proposals',
    ],
    requires: ['creation.board'],
    dependents: ['creation.seed_extraction', 'creation.costume'], audience: 'owner',
    allowed_states: ['active', 'history', 'hidden'], suggested_default: 'active',
    note: 'The Engine Room, the seed bank, the captures and the proposals. Hidden removes all four on her side; nothing is deleted (S9).',
  }),
  // ── Spec 24 §12.2 — the costume surface, the brief, and the two owner-side
  // surfaces that govern no path of their own.
  S({
    id: 'creation.costume', owns: [], requires: ['creation.engine', 'creation.board'],
    dependents: ['creation.brief'], audience: 'owner',
    allowed_states: ['active', 'history', 'hidden'], suggested_default: 'active',
    derived_from: 'spec 24 §12',
    note: 'The costume surface and the resolve step. Hidden takes the "Make a piece from this" door with it; every existing piece, brief, handoff and comparison stays readable (S9). The pieces it writes are governed by creation.board, whose declaration names it.',
  }),
  S({
    id: 'creation.brief', owns: ['work-log/creation/making/briefs'], requires: ['creation.costume'],
    dependents: [], audience: 'owner', allowed_states: ['active', 'hidden'],
    suggested_default: 'active', derived_from: 'spec 24 §12',
    note: 'The brief path and the model call behind it. Hidden alone leaves the whole costume surface working and stops only the spend — she writes briefs by hand. It mirrors creation.seed_extraction exactly.',
  }),
  S({
    id: 'creation.format_overrides', owns: [], requires: ['strategy.fixed'], dependents: [],
    audience: 'owner', allowed_states: ['active', 'hidden'], suggested_default: 'active',
    derived_from: 'spec 24 §12',
    note: 'The per-profile format-rule editor. The PATH stays governed by platforms.* — its declaration names that switch and nothing is re-pointed (spec 22 §9.2’s precedent).',
  }),
  S({
    id: 'creation.materials', owns: [], requires: ['creation.board', 'assets.library'], dependents: [],
    audience: 'owner', allowed_states: ['active', 'hidden'], suggested_default: 'active',
    derived_from: 'spec 24 §12',
    note: 'Attaching assets, references and proof to a piece. The paths stay governed by assets.library, references.* and strategy.fixed — nothing is re-pointed.',
  }),
  S({
    id: 'creation.seed_extraction', owns: [], requires: ['creation.engine'], dependents: [],
    audience: 'owner', allowed_states: ['active', 'hidden'], suggested_default: 'active',
    derived_from: 'spec 23 §12',
    note: 'The model call, and only the model call. The proposals path is governed by creation.engine (spec 27’s accepted correction) so cost-free analysis proposals survive with extraction off. Hidden leaves the whole bank working by hand.',
  }),
  // Spec 23 §10: corrected. Registered with owns: ['work-log/creation/topics'],
  // which read literally implied a client write into the seed bank — S19 forbids
  // it and the path's `audience: owner` already blocks it.
  S({
    id: 'creation.seed_input_client', owns: [],
    requires: ['creation.engine', 'client_access.login'], dependents: [],
    audience: 'client', allowed_states: ['active', 'hidden'], suggested_default: 'hidden',
    derived_from: 'working-mode: does this client bring ideas',
    note: 'A WORKING-MODE FLAG, not a write grant. It governs the intake parameter "client-ideas" (does this client bring ideas), and its only effect is that the intake round asks for them. It opens no door into work-log/creation/topics — that path is audience: owner (S19, spec 23 §10).',
  }),
  S({
    id: 'creation.making', owns: ['work-log/creation/making'], requires: ['creation.board'],
    dependents: ['creation.making_handoff', 'creation.drafting', 'creation.gates'],
    audience: 'owner',
    allowed_states: ['active', 'history', 'hidden'], suggested_default: 'active',
    note: 'Hidden removes drafting, gates and the whole making surface on her side; existing drafts and gate runs move to history and stay readable — nothing is deleted (S9).',
  }),
  // ── Spec 25 §11 — drafting, the gates, rights, the post-learning prompt and
  // the per-profile taste consent. `creation.drafting` mirrors
  // `creation.seed_extraction` and `creation.brief` exactly: it owns the model
  // CALL, and the path it writes stays governed by `creation.making`, whose
  // declaration names it. Nothing is re-pointed (spec 22 §9.2's precedent).
  S({
    id: 'creation.drafting', owns: [], requires: ['creation.making'], dependents: [],
    audience: 'owner', allowed_states: ['active', 'hidden'], suggested_default: 'active',
    derived_from: 'spec 25 §11',
    note: 'The drafting model call, and only the call. Hidden alone leaves gates, review and the board fully working: the honest off-switch for a profile where she writes every draft herself.',
  }),
  S({
    id: 'creation.gates', owns: ['work-log/creation/making/gate-runs'],
    requires: ['creation.making'], dependents: [], audience: 'owner',
    allowed_states: ['active'], suggested_default: 'active', fixed: true,
    derived_from: 'PLAN §5.1: nothing reaches review until all seven pass',
    note: 'The seven-gate run and its record. Fixed: a switch that could turn this off would make the plan’s own sentence a lie.',
  }),
  S({
    id: 'creation.rights_gate', owns: [], requires: ['creation.making'], dependents: [],
    audience: 'owner', allowed_states: ['active'], suggested_default: 'active', fixed: true,
    derived_from: 'S21: gates block publication when required rights are absent',
    note: 'The publication block. Fixed, for the same reason: a rights gate that can be switched off is not a gate.',
  }),
  S({
    id: 'creation.post_learning', owns: [], requires: ['creation.board'], dependents: [],
    audience: 'owner', allowed_states: ['active', 'hidden'], suggested_default: 'active',
    derived_from: 'spec 25 §8.1',
    note: 'The one light prompt on a posted piece: "Anything you learned from this one?" Optional, dismissible, never a chore. It writes through logs.feedback, which its declaration governs.',
  }),
  S({
    id: 'creation.taste_rules', owns: [],
    requires: ['creation.drafting', 'owner.taste_rules'], dependents: [],
    audience: 'owner', allowed_states: ['active', 'hidden'], suggested_default: 'active',
    derived_from: 'spec 25 §9.3 rule 5',
    note: 'Whether THIS profile’s drafting packets carry her standing habits. A client whose brand is deliberately unlike her defaults gets it off, and nothing about the store changes. It cannot be more active than owner.taste_rules, which starts hidden — the cascade resolver enforces that, and no second check exists.',
  }),
  S({
    id: 'creation.making_handoff',
    owns: ['work-log/creation/making', 'work-log/creation/making/handoffs'],
    requires: ['creation.making'],
    dependents: [], audience: 'owner', allowed_states: ['active', 'history', 'hidden'],
    suggested_default: 'hidden',
    note: 'The outside-tool round-trip contract (S18). Canva stays parked until its OAuth app exists.',
  }),
  S({
    id: 'creation.review', owns: ['work-log/creation/review'], requires: ['creation.board'],
    dependents: ['creation.review_public_link', 'creation.review_perception'],
    audience: 'both', allowed_states: ['active', 'history', 'hidden'], suggested_default: 'active',
    derived_from: 'working-mode: does the client approve, or does she have full authority',
  }),
  S({
    id: 'creation.review_public_link', owns: ['work-log/creation/review'], requires: ['creation.review'],
    dependents: [], audience: 'client', allowed_states: ['active', 'history', 'hidden'],
    suggested_default: 'active',
    derived_from: 'PLAN §11 Q2 — her answer',
    note: 'Her ruling: public preview links SURVIVE, default on for clients without logins. A client WITH a binding should land inside their review window instead (spec 28 §10). Spec 28 §15.3: the suggested default is `active` — a SUGGESTION, like every other. Hidden serves nothing to an unauthenticated viewer; a bound client still deep-links, because their access comes from their door.',
  }),
  S({
    // §13.2's table names `creation.review_public_link` as a prerequisite, and
    // §10 says in the same spec that with the public link hidden "a bound client
    // hitting the same URL STILL deep-links, because their access comes from
    // their door, not from the public link". Both cannot be true: `requires`
    // means never-more-active-than, so the public link at hidden would drag the
    // deep link down and close the door §10 keeps open.
    //
    // §10 is the behaviour she asked for (PLAN §11 Q2) and the plan outranks the
    // spec's own table, so the prerequisite is the DOOR the link delivers into —
    // `creation.review` — plus a login to deliver it to. §13.3's check is intact:
    // a deep link into a profile nobody can log into is still refused.
    id: 'creation.review_deeplink', owns: [],
    requires: ['creation.review', 'client_access.login'], dependents: [],
    audience: 'client', allowed_states: ['active', 'hidden'], suggested_default: 'active',
    derived_from: 'spec 28 §13.2 (PLAN §11 Q2)',
    note: 'The logged-in branch of /p/<shareId>: a bound client lands in their review window at that piece instead of the public page. Hidden is the honest off-switch for a client who prefers a link that never asks them to log in — everyone gets the public page. It opens no fifth door (§14).',
  }),
  S({
    id: 'creation.review_perception', owns: ['work-log/analysis/client-perception'],
    requires: ['creation.review'], dependents: [], audience: 'client',
    allowed_states: ['active', 'history', 'hidden'], suggested_default: 'active',
    note: 'Give-point 4, captured at review and at the monthly call.',
  }),
  S({
    id: 'creation.scheduling', owns: ['work-log/creation/scheduling'], requires: ['creation.board'],
    dependents: ['creation.publishing'], audience: 'both',
    allowed_states: ['active', 'history', 'hidden'], suggested_default: 'active',
    derived_from: 'deliverables: do we schedule for this client',
  }),
  S({
    id: 'creation.publishing', owns: ['work-log/creation/scheduling'],
    requires: ['creation.scheduling', 'creation.channels'], dependents: [],
    audience: 'owner', allowed_states: ['active', 'hidden'], suggested_default: 'hidden',
    derived_from: 'posting ownership: we post or they post',
    note: 'Refused where the client posts, or where the channel carries no posting permission (S17).',
  }),
  S({
    id: 'creation.channels', owns: ['work-log/creation/channels'], requires: ['strategy.fixed'],
    dependents: [], audience: 'owner', allowed_states: ['active', 'history', 'hidden'],
    suggested_default: 'active',
  }),
  S({
    id: 'creation.funnel', owns: ['work-log/creation/funnel'], requires: ['creation.board'],
    dependents: ['creation.funnel_replies'], audience: 'owner',
    allowed_states: ['active', 'history', 'hidden'], suggested_default: 'hidden',
  }),
  S({
    id: 'creation.funnel_replies', owns: ['work-log/creation/funnel/replies'], requires: [],
    dependents: [], audience: 'owner', allowed_states: ['active', 'history', 'hidden'],
    suggested_default: 'hidden',
    note: 'On for Divine Studio today (Lead Answers). Off elsewhere until asked for.',
  }),

  // ── Assets and references ─────────────────────────────────────────────────
  S({
    id: 'assets.library', owns: ['work-log/assets', 'work-log/assets/sets'], requires: [],
    dependents: ['assets.client_upload', 'assets.drive_videos', 'assets.share_target',
      'assets.whatsapp_intake', 'assets.catalogue_export'],
    audience: 'both', allowed_states: ['active', 'history', 'hidden'], suggested_default: 'active',
  }),
  S({
    id: 'assets.client_upload', owns: ['work-log/assets/sets'],
    requires: ['assets.library', 'client_access.login'], dependents: [],
    audience: 'client', allowed_states: ['active', 'hidden'], suggested_default: 'active',
    note: 'Give-point 2.',
  }),
  S({
    id: 'assets.drive_videos', owns: ['work-log/assets/sets'], requires: ['assets.library'],
    dependents: [], audience: 'both', allowed_states: ['active', 'hidden'], suggested_default: 'active',
  }),
  S({
    id: 'assets.share_target', owns: ['work-log/assets/sets'], requires: ['assets.library'],
    dependents: [], audience: 'owner', allowed_states: ['active', 'hidden'], suggested_default: 'active',
    note: 'Android only (CLAUDE.md gotcha 4).',
  }),
  S({
    id: 'assets.whatsapp_intake', owns: ['work-log/assets/sets'],
    requires: ['assets.library', 'owner.whatsapp_inbox'], dependents: [],
    audience: 'owner', allowed_states: ['active', 'hidden'], suggested_default: 'hidden',
    note: 'Parked with spec 18B.',
  }),
  S({
    id: 'assets.catalogue_export', owns: ['work-log/assets/sets'], requires: ['assets.library'],
    dependents: [], audience: 'owner', allowed_states: ['active', 'hidden'], suggested_default: 'hidden',
    note: 'PLAN §7: the catalogue becomes an assets use-case behind a switch. On for Sonia.',
  }),
  S({
    id: 'references.our_vision', owns: ['work-log/references', 'work-log/references/our-vision'],
    requires: [], dependents: ['references.from_client'], audience: 'owner',
    allowed_states: ['active', 'history', 'hidden'], suggested_default: 'active',
  }),
  S({
    id: 'references.from_client', owns: ['work-log/references/from-client'],
    requires: ['references.our_vision'], dependents: [], audience: 'client',
    allowed_states: ['active', 'hidden'], suggested_default: 'active',
  }),

  // ── Logs ──────────────────────────────────────────────────────────────────
  S({
    id: 'logs.tasks', owns: ['work-log/logs/tasks'], requires: [], dependents: ['shelf.today_strip'],
    audience: 'both', allowed_states: ['active', 'history', 'hidden'], suggested_default: 'active',
  }),
  S({
    id: 'logs.decisions', owns: ['work-log/logs/decisions'], requires: [], dependents: [],
    audience: 'owner', allowed_states: ['active', 'history', 'hidden'], suggested_default: 'active',
  }),
  S({
    id: 'logs.requests', owns: ['work-log/logs/requests'], requires: [], dependents: [],
    audience: 'both', allowed_states: ['active', 'history', 'hidden'], suggested_default: 'active',
  }),
  S({
    id: 'logs.changes', owns: ['work-log/logs/changes'], requires: [], dependents: [],
    audience: 'owner', allowed_states: ['active', 'history', 'hidden'], suggested_default: 'active',
  }),
  S({
    id: 'logs.pipelines.lists', owns: ['work-log/logs/pipelines', 'work-log/logs/pipelines/lists'],
    requires: [], dependents: [], audience: 'owner',
    allowed_states: ['active', 'history', 'hidden'], suggested_default: 'active',
  }),
  S({
    id: 'logs.pipelines.cold_calls', owns: ['work-log/logs/pipelines/cold-calls'], requires: [],
    dependents: [], audience: 'owner', allowed_states: ['active', 'history', 'hidden'],
    suggested_default: 'hidden',
  }),
  S({
    id: 'logs.pipelines.orders', owns: ['work-log/logs/pipelines/orders'], requires: [],
    dependents: [], audience: 'owner', allowed_states: ['active', 'history', 'hidden'],
    suggested_default: 'hidden',
  }),
  S({
    id: 'logs.effort_meter', owns: ['work-log/logs/effort'], requires: [],
    dependents: ['logs.effort_money'], audience: 'owner',
    allowed_states: ['active', 'history', 'hidden'], suggested_default: 'hidden',
    derived_from: 'PLAN §7: her own profiles only',
    note: 'Refused on any profile whose owner_kind is `client`.',
  }),
  S({
    id: 'logs.effort_money', owns: ['work-log/logs/effort'], requires: ['logs.effort_meter'],
    dependents: [], audience: 'owner', allowed_states: ['active', 'history', 'hidden'],
    suggested_default: 'hidden', derived_from: 'PLAN §7: her own profiles only',
  }),
  // Spec 23 §12: two FIXED records. S12 requires the model, the packet and the
  // context version logged per output; S13 requires the original feedback and
  // her decision both preserved. They carry allowed_states: ['active'] rather
  // than escaping the registry, so it stays exhaustive (her law).
  S({
    id: 'logs.engine_runs', owns: ['work-log/logs/engine-runs'], requires: ['creation.engine'],
    dependents: [], audience: 'owner', allowed_states: ['active'], suggested_default: 'active',
    fixed: true,
    note: 'The run log. Fixed: a switch that could turn it off would make S12 a lie.',
  }),
  S({
    id: 'logs.feedback', owns: ['work-log/logs/feedback'], requires: [], dependents: [],
    audience: 'owner', allowed_states: ['active'], suggested_default: 'active', fixed: true,
    note: 'The feedback record. Fixed: S13 requires the original and her decision both preserved.',
  }),
  S({
    id: 'logs.observations', owns: ['work-log/logs/observations'], requires: [], dependents: [],
    audience: 'owner', allowed_states: ['active', 'history', 'hidden'], suggested_default: 'active',
  }),

  // ── Analysis ──────────────────────────────────────────────────────────────
  S({
    id: 'analysis.tracking', owns: ['work-log/analysis/study-own-data'], requires: ['creation.channels'],
    dependents: ['analysis.scorecard', 'analysis.funnel', 'analysis.bifurcation',
      'analysis.compare', 'analysis.ai_tagging_fallback', 'analysis.digest_owner'],
    audience: 'owner', allowed_states: ['active', 'history'], suggested_default: 'active',
    note: 'Recording is the engine’s first duty. Every day not recorded is gone.',
  }),
  S({
    id: 'analysis.ai_tagging_fallback', owns: ['work-log/analysis/study-own-data'],
    requires: ['analysis.tracking'], dependents: [], audience: 'owner',
    allowed_states: ['active', 'hidden'], suggested_default: 'active',
    note: 'FALLBACK only — the piece’s own pillar and costume are the primary tag source.',
  }),
  S({
    id: 'analysis.scorecard', owns: ['work-log/analysis'], requires: ['analysis.tracking'],
    dependents: [], audience: 'both', allowed_states: ['active', 'history', 'hidden'],
    suggested_default: 'active',
    note: 'Each pillar judged only on its job’s metrics.',
  }),
  S({
    id: 'analysis.funnel', owns: ['work-log/analysis'], requires: ['analysis.tracking'],
    dependents: [], audience: 'owner', allowed_states: ['active', 'history', 'hidden'],
    suggested_default: 'hidden',
  }),
  S({
    id: 'analysis.bifurcation', owns: ['work-log/analysis'], requires: ['analysis.tracking'],
    dependents: [], audience: 'owner', allowed_states: ['active', 'history', 'hidden'],
    suggested_default: 'active',
    note: 'Every birth parameter is a filter — no tagging chore.',
  }),
  S({
    id: 'analysis.goal_tracking', owns: ['work-log/analysis/goal-tracking'], requires: [],
    dependents: [], audience: 'both', allowed_states: ['active', 'history', 'hidden'],
    suggested_default: 'active',
    note: 'Blocked per goal until that goal carries its S16 metric declaration.',
  }),
  S({
    id: 'analysis.compare', owns: ['work-log/analysis/comparisons'], requires: ['analysis.tracking'],
    dependents: [], audience: 'owner', allowed_states: ['active', 'history', 'hidden'],
    suggested_default: 'active',
    note: 'Matched comparisons only, at equivalent ages (S5, S6).',
  }),
  S({
    id: 'analysis.digest_owner', owns: ['work-log/analysis/digests'], requires: ['analysis.tracking'],
    dependents: ['analysis.digest_client'], audience: 'owner',
    allowed_states: ['active', 'history', 'hidden'], suggested_default: 'active',
  }),
  S({
    id: 'analysis.digest_client', owns: ['work-log/analysis/digests'],
    requires: ['analysis.digest_owner', 'client_access.login'], dependents: [],
    audience: 'client', allowed_states: ['active', 'hidden'], suggested_default: 'hidden',
    note: 'Drafted by the engine, approved or edited by her first (CLAUDE.md rule 1).',
  }),
  S({
    id: 'analysis.soft_signals', owns: ['work-log/analysis/client-perception', 'work-log/logs/observations'],
    requires: [], dependents: [], audience: 'owner',
    allowed_states: ['active', 'history', 'hidden'], suggested_default: 'active',
    note: 'Recorded lightly, outside the engine’s math.',
  }),
  S({
    id: 'analysis.market_research', owns: ['work-log/analysis/market-research'], requires: [],
    dependents: [], audience: 'owner', allowed_states: ['active', 'history', 'hidden'],
    suggested_default: 'hidden',
  }),

  // ── spec 26 §11 — the tracking store's switches ───────────────────────────
  // All four are `audience: owner`, so none of them can open a fifth door (S19).
  // The client's eventual view of analysis arrives through `analysis.digest_client`
  // and `see:analysis`, both of which already exist and are spec 27's to feed.
  ...['Instagram', 'LinkedIn', 'YouTube'].map(p =>
    S({
      id: trackingSwitchId(p),
      // The path stays governed by `analysis.tracking`, whose declaration names
      // it — spec 22 §9.2's established pattern for a switch over a surface or a
      // job rather than a path.
      owns: [],
      requires: [platformSwitchId(p), 'analysis.tracking', 'creation.channels'],
      dependents: [], audience: 'owner',
      // `hidden` is here because the suggested position for a platform with no
      // connected channel IS hidden. Neither `history` nor `hidden` deletes
      // anything, and every past observation stays readable in both (S9).
      allowed_states: ['active', 'history', 'hidden'],
      suggested_default: null,
      derived_from: 'whether a channel on this platform is connected',
      note: `The collector for ${p}. Suggested active where a channel on ${p} is connected, hidden otherwise — see suggestedTrackingState. At history or hidden the stretch reads "switched-off": a decision, never a fault.`,
    })),
  S({
    id: 'analysis.sync_health', owns: ['work-log/analysis/study-own-data/sync-health'],
    requires: ['analysis.tracking'], dependents: [], audience: 'owner',
    allowed_states: ['active', 'history', 'hidden'], suggested_default: 'active',
    derived_from: 'spec 26 §11',
    note: 'The runs, the connection status, the retry and backfill state, the gaps. Hidden stops the surface, never the recording.',
  }),
  S({
    id: 'analysis.backfill', owns: [], requires: ['analysis.tracking'], dependents: [],
    audience: 'owner', allowed_states: ['active', 'hidden'], suggested_default: 'active',
    derived_from: 'spec 26 §11',
    note: 'The owner-triggered retry and backfill action. Backfill fetches current lifetime totals for posts missed while the pipe was down; it can never reconstruct the missing days, and a backfilled row closes no gap (§6.4).',
  }),
  S({
    id: 'analysis.attributed_outcomes', owns: ['work-log/analysis/attributed-outcomes'],
    requires: [], dependents: [], audience: 'owner',
    allowed_states: ['active', 'history', 'hidden'], suggested_default: 'hidden',
    derived_from: 'spec 26 §11',
    note: 'Suggested hidden: nothing is declared yet, and an empty outcomes surface invites guessing.',
  }),

  // ── spec 27 §18.2 — the reading layer's switches ──────────────────────────
  // All eight are `audience: owner`. The client's sight of analysis arrives
  // through `analysis.digest_client` and `see:analysis`, both of which already
  // exist — and no switch, in any position, grants anything more (§14, §19).
  //
  // Four carry `owns: []` and name what they govern in their note, following
  // spec 22 §9.2's precedent: the governing switch of a PATH stays the one its
  // declaration names, so nothing is re-pointed.
  S({
    id: 'analysis.always_live', owns: [], requires: ['analysis.tracking'], dependents: [],
    audience: 'owner', allowed_states: ['active', 'hidden'], suggested_default: 'active',
    derived_from: 'spec 27 §18.2',
    note: 'The Now tab — this month so far, coverage first. It is the same computation layer with period = month to date, so it cannot drift from the digest (§13.3).',
  }),
  S({
    id: 'analysis.verdicts', owns: ['work-log/analysis/verdicts'],
    requires: ['analysis.tracking', 'analysis.scorecard'],
    dependents: ['analysis.revisit_proposals', 'analysis.strategy_diffs', 'analysis.costume_recommendations'],
    audience: 'owner', allowed_states: ['active', 'history', 'hidden'], suggested_default: 'active',
    derived_from: 'spec 27 §18.2',
    note: 'The 30-day and quarter cycles and the path they land at. At history every past verdict stays readable and nothing new computes (S9).',
  }),
  S({
    id: 'analysis.verdict_words', owns: [], requires: ['analysis.verdicts'], dependents: [],
    audience: 'owner', allowed_states: ['active', 'hidden'], suggested_default: 'active',
    derived_from: 'spec 27 §18.2',
    note: 'The model call that WORDS a verdict or a digest, and only the call. Hidden leaves every number, band, refusal and comparison verdict computing exactly as before; only the strategist’s paragraph goes away. It mirrors creation.seed_extraction exactly.',
  }),
  S({
    id: 'analysis.pulse_owner', owns: [], requires: ['analysis.tracking'], dependents: [],
    audience: 'owner', allowed_states: ['active', 'hidden'], suggested_default: 'active',
    derived_from: 'spec 27 §18.2',
    note: 'This profile’s weekly pulse entry, written into its OWN digests path; the shelf composes her one screen from them. Hidden removes exactly this profile’s lines and stores nothing between profiles (§13.2).',
  }),
  S({
    id: 'analysis.revisit_proposals', owns: [],
    requires: ['analysis.verdicts', 'creation.engine'], dependents: [],
    audience: 'owner', allowed_states: ['active', 'hidden'], suggested_default: 'active',
    derived_from: 'spec 27 §18.2',
    note: 'The "make more of this" write door into work-log/creation/topics/proposals, whose declaration governs that path. A revisit proposal with no cited verdict is refused, not warned (§15.1).',
  }),
  S({
    id: 'analysis.costume_recommendations', owns: [],
    requires: ['analysis.verdicts', 'creation.engine'], dependents: [],
    audience: 'owner', allowed_states: ['active', 'hidden'], suggested_default: 'active',
    derived_from: 'spec 27 §18.2',
    note: 'The recommendations block inside the engine room. Computed from the verdicts at read time — no new store — and it never pre-selects anything (§15.2).',
  }),
  S({
    id: 'analysis.strategy_diffs', owns: [], requires: ['analysis.verdicts'], dependents: [],
    audience: 'owner', allowed_states: ['active', 'hidden'], suggested_default: 'active',
    derived_from: 'spec 27 §18.2',
    note: 'Engine-proposed diffs against mix targets and pillar jobs, written as feedback items at work-log/logs/feedback. The engine never writes strategy; her acceptance does (§15.3).',
  }),
  S({
    id: 'analysis.client_publication', owns: [], requires: ['analysis.digest_client'],
    dependents: [], audience: 'owner', allowed_states: ['active', 'hidden'],
    suggested_default: 'hidden',
    derived_from: 'spec 27 §18.2',
    note: 'The draft-and-approve flow for a client publication. Suggested hidden: nothing publishes until she has one to approve, and approval is a deliberate act with a date and her name on it (§14).',
  }),

  // ── Owner-level capture routes ────────────────────────────────────────────
  S({
    id: 'owner.chat', owns: ['frozen/chat-log', 'frozen/observations-inbox'], requires: [],
    dependents: ['owner.whatsapp_inbox'], audience: 'owner',
    allowed_states: ['active', 'history'], suggested_default: 'active',
    note: 'HELD by her ruling (PLAN §11 Q1): the chat keeps working exactly as today, outside the tree, until its own spec.',
  }),
  // Spec 25 §11, owner level. The taste STORE and its screen, across her whole
  // practice. Suggested hidden: it has nothing to say until roughly three
  // months of edits exist, and flipping it on later changes no stored data.
  S({
    id: 'owner.taste_rules', owns: ['owner/taste-rules'], requires: [],
    dependents: ['creation.taste_rules'], audience: 'owner',
    allowed_states: ['active', 'hidden'], suggested_default: 'hidden',
    derived_from: 'spec 25 §9.2',
    note: 'Her standing habits, distilled from her own edits and decisions. Hidden until the deltas exist; the store keeps filling either way.',
  }),
  S({
    id: 'owner.whatsapp_inbox', owns: [], requires: ['owner.chat'], dependents: [],
    audience: 'owner', allowed_states: ['active', 'hidden'], suggested_default: 'hidden',
    note: 'Parked: registration dead-ended at Meta’s PIN step.',
  }),

  // ── Dispositions ──────────────────────────────────────────────────────────
  S({
    id: 'frozen.legacy', owns: [], requires: [], dependents: [], audience: 'owner',
    allowed_states: ['history'], suggested_default: 'history', fixed: true,
    note: 'Retained, read-only, not rendered, not migrated. Nothing is deleted.',
  }),
  S({
    id: 'leaves.exported', owns: [], requires: [], dependents: [], audience: 'owner',
    allowed_states: ['history'], suggested_default: 'history', fixed: true,
    note: 'PLAN §7: exported to the vault, then removed only on her word.',
  }),
];

// ── Lookup and resolution ────────────────────────────────────────────────────

const BY_ID = new Map<string, SwitchDeclaration>();
for (const s of SWITCHES) {
  if (BY_ID.has(s.id)) throw new Error(`[tree] duplicate switch: ${s.id}`);
  BY_ID.set(s.id, s);
}

export function findSwitch(id: string): SwitchDeclaration | null {
  return BY_ID.get(id) ?? null;
}

export function switchExists(id: string): boolean {
  if (BY_ID.has(id)) return true;
  // Platform switches are born with their platform entry (law 3), and so is that
  // platform's collector switch (spec 26 §11).
  return id.startsWith(PLATFORM_SWITCH_PREFIX) || id.startsWith(TRACKING_SWITCH_PREFIX);
}

/**
 * A declaration for any switch id, including the two families that are born with
 * their entry rather than listed above: `platforms.<platform>` and
 * `analysis.tracking.<platform>`. One resolver, used everywhere a switch is
 * looked up, so a generated switch behaves exactly like a registered one.
 */
export function resolveSwitch(id: string): SwitchDeclaration | null {
  const registered = findSwitch(id);
  if (registered) return registered;
  if (id.startsWith(TRACKING_SWITCH_PREFIX)) return trackingSwitch(id.slice(TRACKING_SWITCH_PREFIX.length));
  if (id.startsWith(PLATFORM_SWITCH_PREFIX)) return platformSwitch(id.slice(PLATFORM_SWITCH_PREFIX.length));
  return null;
}

/** The switch that governs a CONCRETE path (wildcards resolved to the entry). */
export function switchForPath(path: string): string | null {
  const dec = findDeclaration(path);
  if (!dec) return null;
  if (dec.switch !== 'platforms.*') return dec.switch;
  const parts = path.split('/');
  const i = parts.indexOf('platforms');
  const entry = i >= 0 ? parts[i + 1] : undefined;
  return entry && entry !== '*' ? platformSwitchId(entry) : 'platforms.*';
}

/** A switch declaration for a platform that exists on this profile. */
export function platformSwitch(platform: string): SwitchDeclaration {
  const id = platformSwitchId(platform);
  return findSwitch(id) ?? {
    id,
    owns: [`context/content-strategy/platforms/${platform.toLowerCase()}`],
    requires: ['strategy.fixed'],
    dependents: ['creation.channels', trackingSwitchId(platform)],
    audience: 'both',
    allowed_states: ['active', 'history', 'hidden'],
    suggested_default: null,
    derived_from: 'the platforms this profile actually publishes on',
  };
}

/** spec 26 §11 — the collector switch for a platform that exists on this profile. */
export function trackingSwitch(platform: string): SwitchDeclaration {
  const id = trackingSwitchId(platform);
  return findSwitch(id) ?? {
    id,
    owns: [],
    requires: [platformSwitchId(platform), 'analysis.tracking', 'creation.channels'],
    dependents: [],
    audience: 'owner',
    allowed_states: ['active', 'history', 'hidden'],
    suggested_default: null,
    derived_from: 'whether a channel on this platform is connected',
    note: `The collector for ${platform}.`,
  };
}

/**
 * §11's suggested position, as a function rather than a constant, because it
 * depends on something the registry cannot know: whether a channel on that
 * platform is actually connected. A SUGGESTION — she finalizes every position.
 */
export function suggestedTrackingState(hasConnectedChannel: boolean): PathState {
  return hasConnectedChannel ? 'active' : 'hidden';
}

/**
 * Effective state (spec 21 §5.2): the MINIMUM of a switch's own position and
 * every prerequisite's effective state, computed transitively.
 * A switch with no position set is treated as its suggested default; a switch
 * with neither is `hidden` — nothing renders on a guess.
 */
export function effectiveState(id: string, config: SwitchConfig): PathState {
  return resolve(id, config, new Set());
}

function resolve(id: string, config: SwitchConfig, seen: Set<string>): PathState {
  if (seen.has(id)) return 'hidden'; // a cycle can never be trusted into `active`
  seen.add(id);
  const dec = resolveSwitch(id);
  if (!dec) return 'hidden';
  const own = config[id]?.state ?? dec.suggested_default ?? 'hidden';
  let state: PathState = own;
  for (const req of dec.requires) {
    state = minState(state, resolve(req, config, new Set(seen)));
  }
  return state;
}

/** Is this concrete path live for this profile right now? */
export function pathState(path: string, config: SwitchConfig): PathState {
  const id = switchForPath(path);
  if (!id) throw new Error(`[tree] no address: "${path}" is not declared (PLAN law 4)`);
  const dec = findDeclaration(path)!;
  const eff = effectiveState(id, config);
  // A path can never be more active than its own declaration allows.
  return dec.states.includes(eff) ? eff : minState(eff, dec.states[dec.states.length - 1]);
}

/**
 * The cascade set: everything that goes away with this switch (PLAN §3.4).
 * Returns switch ids and the concrete paths they own — her side and the
 * client's, because connections carry activation as well as data.
 */
export function cascadeOf(id: string): { switches: string[]; paths: string[] } {
  const switches = new Set<string>();
  const walk = (sid: string) => {
    const dec = resolveSwitch(sid);
    if (!dec) return;
    for (const d of dec.dependents) {
      if (switches.has(d)) continue;
      switches.add(d);
      walk(d);
    }
  };
  walk(id);
  // Anything that REQUIRES this switch cannot outlive it either.
  for (const s of SWITCHES) {
    if (s.requires.includes(id)) switches.add(s.id);
  }
  const paths = new Set<string>();
  const own = resolveSwitch(id);
  for (const p of own?.owns ?? []) paths.add(p);
  for (const sid of switches) {
    const s = findSwitch(sid);
    for (const p of s?.owns ?? []) paths.add(p);
  }
  return { switches: [...switches], paths: [...paths] };
}

/**
 * What disappears when a PLATFORM is turned off — the plan's canonical trace,
 * kept as a function so the cascade test reads like her sentence (PLAN §3.4).
 */
export function platformCascade(platform: string): {
  switchId: string;
  formats: string;
  strategyQuestions: string[];
  channels: string;
  analysisColumn: string;
} {
  const key = platform.toLowerCase();
  return {
    switchId: platformSwitchId(platform),
    formats: `context/content-strategy/platforms/${key}/formats`,
    strategyQuestions: [
      `context/content-strategy/platforms/${key}/how-it-works`,
      `context/content-strategy/platforms/${key}/rules`,
      `context/content-strategy/platforms/${key}/connection`,
    ],
    channels: 'work-log/creation/channels',
    analysisColumn: 'work-log/analysis/study-own-data',
  };
}

// ── Validation at strategy lock (S8, spec 21 §5.3) ───────────────────────────

export interface SwitchValidationContext {
  config: SwitchConfig;
  /** `hers` unlocks the effort and money meters (PLAN §7). */
  owner_kind: 'client' | 'hers';
  /** Channels with their platform and whether we may post from them (S17). */
  channels?: { id: string; platform: string; canPost: boolean }[];
  /** Goals that carry an S16 metric declaration. */
  goalsWithMetricDeclaration?: string[];
  goals?: string[];
  /**
   * Spec 26 §9: the declaration is a real validated object now, not a boolean.
   * Pass the goal's or pillar job's declaration and the check validates it
   * field by field — a `calculation: rate` with no denominator is rejected here,
   * at strategy lock, rather than surfacing as a wrong number later.
   *
   * Keyed by subject: `goal:<id>` and `pillar-job:<pillar id>`.
   * `undefined` means "not asserted here" and leaves the older boolean check in
   * charge, so nothing that already locks stops locking.
   */
  measurementDeclarations?: Record<string, Partial<MeasurementDeclaration> | undefined>;
  /** The pillars switched ON. PLAN §5.2's scorecard judges each on its job's metrics. */
  pillars?: string[];
  /** Which platforms are switched on, for validating that a metric is reportable. */
  platforms?: string[];
  /** working-mode: does the client post, or do we? */
  postingOwnership?: 'we-post' | 'client-posts';
  clientAccess?: boolean;
  /**
   * Spec 22 §11.1: client access is scoped by lifecycle, not boolean. Pass the
   * doors this profile's lifecycle opens and the check becomes door-aware — a
   * profile at `setup` may run intake and nothing else.
   */
  clientDoors?: ClientDoor[];
  /**
   * Spec 23 §12: `creation.seed_extraction` cannot be active on a profile whose
   * content-strategy has never locked — extraction there would be grounded on
   * nothing and would miss the intelligence bar by construction.
   *
   * `undefined` means "not asserted here" and skips the check. The one-act lock
   * (spec 22 §8.6) deliberately does not assert it: the lock IS what locks the
   * strategy, so by the time these positions apply the strategy is locked. The
   * check bites where it can actually be false — the extraction door itself.
   */
  strategyEverLocked?: boolean;
  /**
   * Spec 24 §12: `creation.brief` cannot be active on a profile with no locked
   * gate set — a brief written toward gates that do not exist misses the bar by
   * construction. `undefined` means "not asserted here" and skips the check,
   * exactly like `strategyEverLocked`: the one-act lock is what locks the gate
   * set, so the check bites where it can actually be false (the brief door).
   */
  gateSetLocked?: boolean;
}

/** Which door a client-audience switch reaches through. Anything not listed is
 *  a switch that opens no client door on its own. */
export const SWITCH_DOOR: Record<string, ClientDoor> = {
  'intake.questionnaire': 'give:intake',
  'intake.finding_session': 'give:intake',
  // Spec 33 §2: handing over a document is give-point 1, the door the client
  // already holds. A third ROUTE in, never a fifth door (S19).
  'intake.documents': 'give:intake',
  'intake.reminders': 'give:intake',
  'creation.seed_input_client': 'give:intake',
  'assets.client_upload': 'give:assets',
  'references.from_client': 'give:assets',
  'creation.review': 'give:review',
  'creation.review_public_link': 'give:review',
  // Spec 28 §14: the deep link is a DELIVERY ROUTE into the review door, not a
  // fifth door. It reaches through the door the client already holds.
  'creation.review_deeplink': 'give:review',
  'creation.review_perception': 'give:perception',
  'analysis.digest_client': 'see:analysis',
};

export interface SwitchViolation {
  switch: string;
  reason: string;
}

/** Contradictions refuse activation — the strategy cannot lock with them present. */
export function validateSwitchConfig(ctx: SwitchValidationContext): SwitchViolation[] {
  const out: SwitchViolation[] = [];
  const stateOf = (id: string): PathState =>
    ctx.config[id]?.state ?? findSwitch(id)?.suggested_default ?? 'hidden';

  for (const id of Object.keys(ctx.config)) {
    const dec = resolveSwitch(id);
    if (!dec) { out.push({ switch: id, reason: 'not in the switch registry' }); continue; }
    const own = ctx.config[id].state;
    if (!dec.allowed_states.includes(own)) {
      out.push({ switch: id, reason: `state "${own}" is not allowed for this switch` });
    }
    if (dec.fixed && own !== (dec.suggested_default ?? 'active')) {
      out.push({ switch: id, reason: 'this switch is structural and cannot be moved' });
    }
    // No `active` switch with a non-`active` prerequisite.
    if (own === 'active') {
      for (const req of dec.requires) {
        if (stateOf(req) !== 'active') {
          out.push({ switch: id, reason: `requires "${req}", which is ${stateOf(req)}` });
        }
      }
    }
  }

  // No channel active on a hidden platform.
  if (stateOf('creation.channels') === 'active') {
    for (const ch of ctx.channels ?? []) {
      const ps = stateOf(platformSwitchId(ch.platform));
      if (ps !== 'active') {
        out.push({ switch: 'creation.channels', reason: `channel "${ch.id}" is on platform ${ch.platform}, which is ${ps}` });
      }
    }
  }

  // No client-audience switch active while its door is shut (S22, spec 22 §11.1).
  if (ctx.clientAccess === false || ctx.clientDoors) {
    const doors = ctx.clientAccess === false ? [] : (ctx.clientDoors ?? []);
    for (const s of SWITCHES) {
      if (s.audience !== 'client' || stateOf(s.id) !== 'active') continue;
      // Spec 28 §13.2: a FIXED structural switch is not a position she can hold
      // wrongly. `client_access.mini_shelf` renders exactly when a person holds
      // more than one live binding, and the cascade already keeps it no more
      // active than `client_access.login`. Flagging it here would refuse every
      // lock on a profile with no client login, for a switch nobody can move.
      if (s.fixed) continue;
      const door = SWITCH_DOOR[s.id];
      if (!door || !doors.includes(door)) {
        out.push({
          switch: s.id,
          reason: door
            ? `client-facing switch is active while this profile's lifecycle does not open ${door}`
            : 'client-facing switch is active while this profile has no client access',
        });
      }
    }
  }

  // No analysis switch active for a goal with no metric declaration (S16).
  // Per-goal blocking, not all-or-nothing (spec 21 §8.9).
  const declarationCtx = { platforms: ctx.platforms ?? [] };
  if (stateOf('analysis.goal_tracking') === 'active') {
    const declared = new Set(ctx.goalsWithMetricDeclaration ?? []);
    for (const g of ctx.goals ?? []) {
      if (ctx.measurementDeclarations) {
        // Spec 26 §9: the declaration is validated, not merely counted.
        const violations = validateMeasurementDeclaration(
          ctx.measurementDeclarations[`goal:${g}`] ?? ctx.measurementDeclarations[g], declarationCtx,
        );
        for (const v of violations) {
          out.push({ switch: 'analysis.goal_tracking', reason: `goal "${g}": ${v.field} — ${v.reason}` });
        }
      } else if (!declared.has(g)) {
        out.push({ switch: 'analysis.goal_tracking', reason: `goal "${g}" has no metric declaration (S16)` });
      }
    }
  }

  // And the same check for pillar jobs: PLAN §5.2's scorecard judges each pillar
  // ONLY on its job's metrics, so a job with no measuring stick has nothing to
  // be judged against (spec 26 §9).
  if (stateOf('analysis.scorecard') === 'active' && ctx.measurementDeclarations) {
    for (const p of ctx.pillars ?? []) {
      const violations = validateMeasurementDeclaration(
        ctx.measurementDeclarations[`pillar-job:${p}`], declarationCtx,
      );
      for (const v of violations) {
        out.push({ switch: 'analysis.scorecard', reason: `pillar "${p}" job: ${v.field} — ${v.reason}` });
      }
    }
  }

  // No publishing where the client posts, or where no channel may post (S17).
  if (stateOf('creation.publishing') === 'active') {
    if (ctx.postingOwnership === 'client-posts') {
      out.push({ switch: 'creation.publishing', reason: 'working-mode says the client posts' });
    }
    if ((ctx.channels ?? []).length > 0 && !(ctx.channels ?? []).some(c => c.canPost)) {
      out.push({ switch: 'creation.publishing', reason: 'no channel carries posting permission' });
    }
  }

  // No model call on a profile whose strategy has never locked (spec 23 §12).
  if (ctx.strategyEverLocked === false && stateOf('creation.seed_extraction') === 'active') {
    out.push({
      switch: 'creation.seed_extraction',
      reason: 'this profile has never locked a strategy, so extraction would be grounded on nothing',
    });
  }

  // Spec 24 §12: the costume surface cannot be active where strategy has never
  // locked. This is §2.4 expressed at the switch level, and it is the same shape
  // as spec 22's strategy.lock → creation.board dependency.
  if (ctx.strategyEverLocked === false && stateOf('creation.costume') === 'active') {
    out.push({
      switch: 'creation.costume',
      reason: 'this profile has never locked a strategy, so nothing can be written into creation',
    });
  }

  // And the brief cannot be active with no locked gate set: it is written TOWARD
  // the gates it will be judged by, and gates that do not exist judge nothing.
  if (ctx.gateSetLocked === false && stateOf('creation.brief') === 'active') {
    out.push({
      switch: 'creation.brief',
      reason: 'this profile has no locked gate set, so a brief would be written toward nothing',
    });
  }

  // Spec 25 §11: a draft grounded on nothing misses the bar by construction.
  // The second check that section names — creation.taste_rules cannot outlive
  // owner.taste_rules — is the prerequisite loop above, and is deliberately NOT
  // repeated here, so nobody adds a second one.
  if (ctx.strategyEverLocked === false && stateOf('creation.drafting') === 'active') {
    out.push({
      switch: 'creation.drafting',
      reason: 'this profile has never locked a strategy, so a draft would be grounded on nothing',
    });
  }

  // Spec 27 §18.4, check 1: a verdict against no declared measuring stick would
  // be a number with no meaning, so verdicts cannot be active on a profile whose
  // content-strategy has never locked. Same shape as spec 23's extraction check.
  if (ctx.strategyEverLocked === false && stateOf('analysis.verdicts') === 'active') {
    out.push({
      switch: 'analysis.verdicts',
      reason: 'this profile has never locked a strategy, so a verdict would be judged against nothing',
    });
  }

  // Check 2: the publication flow cannot be active while the door it publishes
  // through is shut. The prerequisite loop above catches a hidden
  // `analysis.digest_client`; this catches client access being off entirely.
  if (stateOf('analysis.client_publication') === 'active') {
    if (ctx.clientAccess === false) {
      out.push({
        switch: 'analysis.client_publication',
        reason: 'this profile has no client access, so there is nobody to publish to',
      });
    }
    if (stateOf('analysis.digest_client') !== 'active') {
      out.push({
        switch: 'analysis.client_publication',
        reason: `the client digest is ${stateOf('analysis.digest_client')}, so a publication would have no door`,
      });
    }
  }

  // Spec 28 §13.3: a deep link into a profile nobody can log into is a redirect
  // to a login wall, which is worse than the public page it replaced.
  //
  // It bites on a position SHE set, not on the suggestion — the same discipline
  // as every other check in this function ("not asserted here" skips). The lock's
  // condition 4 already refuses while any non-fixed switch has no position, so
  // by the time a configuration can lock, this has been asserted.
  if (ctx.config['creation.review_deeplink']?.state === 'active'
      && stateOf('client_access.login') !== 'active') {
    out.push({
      switch: 'creation.review_deeplink',
      reason: 'this profile has no client login, so the deep link would land on a login wall',
    });
  }

  // The effort and money meters live only in her own profiles (PLAN §7).
  if (ctx.owner_kind === 'client') {
    for (const id of ['logs.effort_meter', 'logs.effort_money']) {
      if (stateOf(id) === 'active') {
        out.push({ switch: id, reason: 'PLAN §7: this lives only in her own profiles' });
      }
    }
  }

  return out;
}

/**
 * Spec 28 §3.2, the door half of the render resolver: which client door a switch
 * reaches through. Taken from the explicit map where one exists, otherwise
 * DERIVED from the declarations of the paths the switch owns — so a screen whose
 * switch forgets to name its door still cannot be rendered to a client through a
 * door nobody granted. A switch with no door reaches no client at all.
 */
export function doorsForSwitch(id: string): ClientDoor[] {
  const out = new Set<ClientDoor>();
  const named = SWITCH_DOOR[id];
  if (named) out.add(named);
  const dec = resolveSwitch(id);
  for (const p of dec?.owns ?? []) {
    const d = findDeclaration(p);
    if (d?.client_door) out.add(d.client_door);
  }
  // The paths whose own declaration names this switch (spec 22 §9.2's pattern:
  // a surface switch carries `owns: []` and the PATH keeps naming its governor).
  for (const d of DECLARATIONS) {
    if (d.switch === id && d.client_door) out.add(d.client_door);
  }
  return [...out];
}

/** Every switch a profile needs a position for, given its platforms. */
export function switchesForProfile(platforms: string[]): SwitchDeclaration[] {
  const extra: SwitchDeclaration[] = [];
  for (const p of platforms) {
    // Both switches are born with the platform entry (law 3): the platform
    // itself, and — spec 26 §11 — its collector.
    if (!findSwitch(platformSwitchId(p))) extra.push(platformSwitch(p));
    if (!findSwitch(trackingSwitchId(p))) extra.push(trackingSwitch(p));
  }
  return [...SWITCHES, ...extra];
}

/** Every declared path that names a switch, for the registry integrity check. */
export function pathsBySwitch(): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const d of DECLARATIONS) {
    const list = m.get(d.switch) ?? [];
    list.push(d.path);
    m.set(d.switch, list);
  }
  return m;
}

export { stateRank };
