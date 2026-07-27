// The measuring sticks — spec 26 §9, amendment S16.
//
// "Before analysis enables for a job or goal, it must declare metric ids,
// direction, calculation, denominator, observation window, target, platform
// availability, and not-measurable fallback."
//
// The declaration lives WITH its subject, as a parameter inside the goal's or
// the pillar's own entry folder, because the measuring stick IS the strategy
// (PLAN §5.2). A separate measurements folder would be a second home for a
// strategy decision.
//
// The one thing to keep straight while reading this file: a missing declaration
// blocks ANALYSIS, never COLLECTION. Recording is the engine's first duty and
// does not wait for a decision (§9).

import type { MeasurementDeclaration, MetricKind, ObservationWindow } from './objects.ts';
import { availableMetrics, connectorFor, metricDefinition } from '../platforms/index.ts';

export interface DeclarationViolation {
  field: string;
  reason: string;
}

const WINDOWS: ObservationWindow[] = ['first-24h', '7d', '30d', 'lifetime'];

/**
 * §9's legality table, and the one line it turns on: "a rate over a `level`
 * metric is refused." Followers are a stock as of a moment; a rate over one is
 * not a smaller truth, it is a different and false statement.
 */
const LEGAL_CALCULATIONS: Record<MetricKind, MeasurementDeclaration['calculation'][]> = {
  cumulative: ['count', 'rate', 'difference'],
  // A count for one day sums; differencing it is meaningless (§5.4).
  interval: ['count', 'rate'],
  // A stock never sums; growth is a difference, and a rate over it is refused.
  level: ['count', 'difference'],
};

export interface DeclarationContext {
  /** The platforms switched ON for this profile. */
  platforms: string[];
  /** Per-profile overrides at `platforms/<platform>/metrics`, if any. */
  overrides?: Record<string, { metric_id: string; available: boolean }[]>;
}

/** Which of the switched-on platforms report a metric, per §9's stored field. */
export function computePlatformAvailability(
  metricIds: string[], ctx: DeclarationContext,
): Record<string, 'available' | 'unavailable'> {
  const out: Record<string, 'available' | 'unavailable'> = {};
  for (const platform of ctx.platforms) {
    const key = platform.toLowerCase();
    const reported = new Set(availableMetrics(key, ctx.overrides?.[key] ?? []));
    out[key] = metricIds.length && metricIds.every(id => reported.has(id)) ? 'available' : 'unavailable';
  }
  return out;
}

/** Does any switched-on platform report this metric at all? */
function anyPlatformReports(metricId: string, ctx: DeclarationContext): boolean {
  return ctx.platforms.some(p => {
    const key = p.toLowerCase();
    if (!connectorFor(key)) return false;
    return availableMetrics(key, ctx.overrides?.[key] ?? []).includes(metricId);
  });
}

function kindOf(metricId: string, ctx: DeclarationContext): MetricKind | null {
  for (const p of ctx.platforms) {
    const def = metricDefinition(p.toLowerCase(), metricId);
    if (def) return def.kind;
  }
  return null;
}

/**
 * One declaration, checked on its own — so the gate can be proven to bite.
 * An empty list means it is a real, validated object rather than a boolean.
 */
export function validateMeasurementDeclaration(
  declaration: Partial<MeasurementDeclaration> | undefined | null,
  ctx: DeclarationContext,
): DeclarationViolation[] {
  const out: DeclarationViolation[] = [];
  if (!declaration) {
    return [{ field: 'declaration', reason: 'no measurement declaration (S16)' }];
  }
  const d = declaration;

  if (!d.subject || !/^(goal:|pillar-job:).+/.test(d.subject)) {
    out.push({ field: 'subject', reason: 'a subject is `goal:<id>` or `pillar-job:<pillar id>`' });
  }

  const ids = d.metric_ids ?? [];
  if (!ids.length) {
    out.push({ field: 'metric_ids', reason: 'at least one metric id from the platform catalogue' });
  }
  for (const id of ids) {
    if (!anyPlatformReports(id, ctx)) {
      out.push({
        field: 'metric_ids',
        reason: `"${id}" is reported by no platform this profile has switched on`,
      });
    }
  }

  if (d.direction !== 'up-is-better' && d.direction !== 'down-is-better') {
    out.push({ field: 'direction', reason: 'no metric may be declared without a direction' });
  }

  const calc = d.calculation;
  if (calc !== 'count' && calc !== 'rate' && calc !== 'difference') {
    out.push({ field: 'calculation', reason: 'one of count, rate or difference' });
  } else {
    for (const id of ids) {
      const kind = kindOf(id, ctx);
      if (!kind) continue;                                   // unknown metric already reported
      if (!LEGAL_CALCULATIONS[kind].includes(calc)) {
        out.push({
          field: 'calculation',
          reason: `"${calc}" is not legal for "${id}", which is a ${kind} metric (§5.4)`,
        });
      }
    }
  }

  if (calc === 'rate') {
    if (!d.denominator) {
      out.push({ field: 'denominator', reason: 'a rate needs a denominator (saves per view, not saves per nothing)' });
    } else if (!anyPlatformReports(d.denominator, ctx)) {
      out.push({
        field: 'denominator',
        reason: `"${d.denominator}" must itself be a catalogue metric this profile's platforms report`,
      });
    }
  }

  if (!d.window || !WINDOWS.includes(d.window)) {
    out.push({ field: 'window', reason: 'one of first-24h, 7d, 30d or lifetime' });
  }

  if (d.target === undefined || d.target === null || (d.target as unknown) === '') {
    out.push({
      field: 'target',
      reason: 'a value with a period, or the explicit token `direction-only`. ' +
        '"No target" must be a decision, not an omission',
    });
  } else if (d.target !== 'direction-only') {
    const t = d.target as { value?: unknown; period?: unknown };
    if (typeof t.value !== 'number' || !t.period) {
      out.push({ field: 'target', reason: 'a target is a value plus a period' });
    }
  }

  if (!d.not_measurable_fallback) {
    out.push({
      field: 'not_measurable_fallback',
      reason: 'declare the fallback: not-measurable-on-this-platform, proxy:<metric id>, ' +
        'manual-checkin, or none — and `none` means analysis stays off for this subject',
    });
  } else if (typeof d.not_measurable_fallback === 'string'
    && d.not_measurable_fallback.startsWith('proxy:')) {
    const proxy = d.not_measurable_fallback.slice('proxy:'.length);
    if (!anyPlatformReports(proxy, ctx)) {
      out.push({ field: 'not_measurable_fallback', reason: `proxy metric "${proxy}" is not reported by any switched-on platform` });
    }
  }

  if (!d.platform_availability) {
    out.push({
      field: 'platform_availability',
      reason: 'computed from the catalogue and STORED, so a later platform change is visibly a change',
    });
  }

  return out;
}

export function declarationIsValid(
  declaration: Partial<MeasurementDeclaration> | undefined | null, ctx: DeclarationContext,
): boolean {
  return validateMeasurementDeclaration(declaration, ctx).length === 0;
}

/**
 * §9: `none` means analysis stays OFF for that subject — a decision, not a
 * failure. A valid declaration whose metrics no platform reports and whose
 * fallback is `none` is complete AND switched off, and both facts are true.
 */
export function analysisEnabledFor(
  declaration: MeasurementDeclaration | undefined | null, ctx: DeclarationContext,
): boolean {
  if (!declaration || !declarationIsValid(declaration, ctx)) return false;
  if (declaration.not_measurable_fallback === 'none') {
    return Object.values(computePlatformAvailability(declaration.metric_ids, ctx))
      .some(v => v === 'available');
  }
  return true;
}

/** The subjects blocking a lock, named one by one. Per-goal, never all-or-nothing. */
export function subjectsMissingDeclaration(
  subjects: string[],
  declarations: Record<string, Partial<MeasurementDeclaration> | undefined>,
  ctx: DeclarationContext,
): { subject: string; violations: DeclarationViolation[] }[] {
  const out: { subject: string; violations: DeclarationViolation[] }[] = [];
  for (const s of subjects) {
    const v = validateMeasurementDeclaration(declarations[s], ctx);
    if (v.length) out.push({ subject: s, violations: v });
  }
  return out;
}

/** A ready-made declaration skeleton for her sort queue: every field named, none guessed. */
export function declarationPrompt(subject: string): string {
  return `${subject}: which metrics, which direction, count / rate / difference, ` +
    'the denominator if it is a rate, which window, a target or "direction-only", ' +
    'and what happens where the platform cannot measure it.';
}
