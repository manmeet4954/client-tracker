import type { ClientGoal, ContentStage, PillarJob } from '@/types';

// Shapes shared between /api/analytics (which computes every number, server
// side) and AnalyticsView (which only renders them). Nothing in here ever
// carries a token or another client's data.

export type PillarVerdict =
  | 'earning'    // typical post clearly above this account's own baseline
  | 'steady'     // around baseline
  | 'dragging'   // typical post clearly below baseline
  | 'too-early'  // fewer than the minimum linked posts in the window
  | 'no-job'     // pillar has no job assigned yet
  | 'no-goals';  // convert pillar, but the client's goals are not chosen yet

export interface MetricReading {
  key: string;
  label: string;           // plain name, e.g. "Saves per view"
  explainer: string;       // one plain line a client understands
  ratio: number | null;    // typical vs comparison point; 1 = the same
  postCount: number;       // posts that actually produced this reading
  vs: 'baseline' | 'previous'; // compared with account baseline, or the weeks before
  note?: string;           // honesty note, e.g. "collecting since 2026-07-14"
}

export interface PillarScore {
  pillarId: string;
  name: string;
  color: string;
  job: PillarJob | null;
  purpose: string;
  postedInWindow: number;    // linked posted cards in the window, experiments included
  experimentCount: number;   // of those, flagged experiments (judged separately)
  judgedPostCount: number;   // posts that entered verdict math
  mixActualPct: number | null;
  mixTargetPct: number | null;
  verdict: PillarVerdict;
  metrics: MetricReading[];
  howJudged: string;         // the show-its-work sentence
}

export interface FunnelMonth {
  month: string;               // yyyy-MM
  posts: number;               // posted cards that month (her record)
  reach: number | null;        // sum of latest reach of the account's posts that month
  profileVisits: number | null;
  linkTaps: number | null;
  followerChange: number | null;
  northStar: number | null;    // the Journey check-in for that month
}

export interface FunnelData {
  months: FunnelMonth[];          // oldest first
  northStarLabel: string;         // '' when no goal set in Journey
  profileVisitsSince: string | null; // first date collected; null = not yet
  linkTapsSince: string | null;
  goals: ClientGoal[];
}

export interface ExpressionNumbers {
  views: number | null;
  reach: number | null;
  likes: number | null;
  comments: number | null;
  saves: number | null;
  shares: number | null;
  savesPerView: number | null;
  sharesPerView: number | null;
}

// Spec 06: what the reading layer says about one post. Values come from the
// locked tag list; null means not tagged (yet) or not determinable.
export interface PostTags {
  topicType: string | null;     // how-to | story | myth-busting | fear-based | listicle | proof-win | trend | other
  hookType: string | null;      // question | bold-claim | story-open | statistic | pain-point | other
  closeType: string | null;     // cta-close | punchline | summary | open-loop | other
  ctaType: string | null;       // comment | dm | link | save-share | follow | none
  captionStyle: string | null;  // short | long | storytelling | list
  hasFace: boolean | null;
  trendingAudio: boolean | null;
  summary: string | null;       // one plain line: what the post is about
  corrected: string[];          // snake_case field names the owner corrected (sticky)
}

export interface ExpressionStat {
  cardId: string;
  title: string;
  format: string;        // contentType on the card
  pillarName: string;
  pillarColor: string;
  stage: ContentStage;
  postedAt: string | null;  // from the linked Instagram post
  numbers: ExpressionNumbers | null; // null until the card is linked to a live post
  igMediaId: string | null;  // the linked Instagram post, needed to save tag corrections
  tags: PostTags | null;     // null until the reading layer has tagged the post
}

export interface TopicGroup {
  topicId: string;
  name: string;
  expressions: ExpressionStat[];
}

export interface ExperimentStat {
  cardId: string;
  title: string;
  hypothesis: string;
  stage: ContentStage;
  pillarName: string;
  numbers: ExpressionNumbers | null;
}

// Spec 06: a topic type x format x pillar combination seen in the window.
// The sentence is built server side in plain words; the numbers behind it are
// code-computed medians, never AI output.
export interface PatternInsight {
  topicType: string;
  format: string;          // reel | carousel | image
  pillarName: string;
  postCount: number;       // occurrences in the window
  medianRatio: number | null; // median per-post ratio vs the account's own baseline; null = no usable numbers
  sentence: string;        // e.g. "How-to carousels under Value: usually above your average, based on 4 posts."
}

export interface PatternsData {
  taggedPostCount: number;     // linked window posts that carry tags
  patterns: PatternInsight[];      // combinations with 3+ occurrences
  earlySignals: PatternInsight[];  // combinations seen fewer than 3 times
  ctaFlags: string[];          // code-computed goal vs CTA mismatch lines
}

export interface ComparisonData {
  topics: TopicGroup[];
  experiments: ExperimentStat[];
  patterns: PatternsData;
}

export interface AnalyticsPayload {
  connected: boolean;            // an Instagram account is linked to this client
  accountUsername: string | null;
  windowDays: number;            // the scorecard window (70 days ≈ 10 weeks)
  minPostsForVerdict: number;
  baselinePostCount: number;     // account posts behind the baseline medians
  scorecard: PillarScore[];
  funnel: FunnelData;
  comparison: ComparisonData | null; // owner window only
  generatedAt: string;
}
