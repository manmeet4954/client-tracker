// Instagram's metric catalogue — spec 26 §5.4.
//
// It lives in CODE because it describes the PLATFORM, not the client: the
// universal-engine layer of PLAN §5.1. What THIS account actually reports is a
// per-profile parameter at `context/content-strategy/platforms/instagram/metrics`,
// and an override there beats this shelf, always.
//
// A metric is not its name. Instagram has already renamed and redefined its
// reach/impressions family once; a chart that graphs across that boundary is
// drawing a fiction. So every entry carries a `definition_version`, every
// observation stamps it, and two observations of the same id with different
// versions are marked not-comparable.
//
// Version 1 is this registry. Migrated history carries version 0 — pre-registry,
// and it never claims to have been measured under today's definitions.

import type { MetricDefinition } from '../../tree/objects.ts';

export const IG_DEFINITION_VERSION = 1;

const M = (m: MetricDefinition): MetricDefinition => m;

/** Per-post metrics. Every one is a LIFETIME running total: never summed across
 *  days, and a per-day figure is a DIFFERENCE of two observations (§5.4). */
export const IG_POST_METRICS: MetricDefinition[] = [
  M({
    metric_id: 'views', platform: 'instagram', api_field: 'views', kind: 'cumulative',
    unit: 'count', available_for: [], introduced_at: '2026-01-01', superseded_by: null,
    definition_version: IG_DEFINITION_VERSION,
    note: 'The successor to the old impressions/plays family. The rename is exactly why definition_version exists.',
  }),
  M({
    metric_id: 'reach', platform: 'instagram', api_field: 'reach', kind: 'cumulative',
    unit: 'people', available_for: [], introduced_at: null, superseded_by: null,
    definition_version: IG_DEFINITION_VERSION,
  }),
  M({
    metric_id: 'likes', platform: 'instagram', api_field: 'likes', kind: 'cumulative',
    unit: 'count', available_for: [], introduced_at: null, superseded_by: null,
    definition_version: IG_DEFINITION_VERSION,
  }),
  M({
    metric_id: 'comments', platform: 'instagram', api_field: 'comments', kind: 'cumulative',
    unit: 'count', available_for: [], introduced_at: null, superseded_by: null,
    definition_version: IG_DEFINITION_VERSION,
  }),
  M({
    metric_id: 'saved', platform: 'instagram', api_field: 'saved', kind: 'cumulative',
    unit: 'count', available_for: [], introduced_at: null, superseded_by: null,
    definition_version: IG_DEFINITION_VERSION,
  }),
  M({
    metric_id: 'shares', platform: 'instagram', api_field: 'shares', kind: 'cumulative',
    unit: 'count', available_for: [], introduced_at: null, superseded_by: null,
    definition_version: IG_DEFINITION_VERSION,
  }),
  M({
    metric_id: 'total_interactions', platform: 'instagram', api_field: 'total_interactions',
    kind: 'cumulative', unit: 'count', available_for: [], introduced_at: null, superseded_by: null,
    definition_version: IG_DEFINITION_VERSION,
  }),
];

/** Account metrics. Followers and media count are LEVELS — a stock as of that
 *  moment, never summed; growth is a difference. Profile visits and website taps
 *  are INTERVALS — a count for one day, summed, never differenced. */
export const IG_ACCOUNT_METRICS: MetricDefinition[] = [
  M({
    metric_id: 'followers', platform: 'instagram', api_field: 'followers_count', kind: 'level',
    unit: 'people', available_for: [], introduced_at: null, superseded_by: null,
    definition_version: IG_DEFINITION_VERSION,
  }),
  M({
    metric_id: 'media_count', platform: 'instagram', api_field: 'media_count', kind: 'level',
    unit: 'count', available_for: [], introduced_at: null, superseded_by: null,
    definition_version: IG_DEFINITION_VERSION,
  }),
  M({
    metric_id: 'profile_views', platform: 'instagram', api_field: 'profile_views', kind: 'interval',
    unit: 'count', available_for: [], introduced_at: '2026-07-13', superseded_by: null,
    definition_version: IG_DEFINITION_VERSION,
    note: 'Spec 05. Null before its ship date, which is the honest "collecting since".',
  }),
  M({
    metric_id: 'website_clicks', platform: 'instagram', api_field: 'website_clicks',
    kind: 'interval', unit: 'count', available_for: [], introduced_at: '2026-07-13',
    superseded_by: null, definition_version: IG_DEFINITION_VERSION,
  }),
];

export const IG_METRICS: MetricDefinition[] = [...IG_POST_METRICS, ...IG_ACCOUNT_METRICS];

/** The three insight sets ig-sync falls back through, kept exactly as they are:
 *  metric availability differs by media type, and a smaller set is better than
 *  an empty one. Moved, not rewritten (§6.1). */
export const IG_INSIGHT_SETS = [
  'views,reach,likes,comments,saved,shares,total_interactions',
  'reach,saved,shares',
  'reach',
];
