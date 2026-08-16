import type { ProfileBody } from '@/lib/tree/body';
import type { SwitchConfig } from '@/lib/tree/contract';
import type { Lifecycle, TasteRule } from '@/lib/tree/objects';

export type ColumnId = 'raw' | 'in-progress' | 'done' | 'scheduled';
export type ReferenceType = 'link' | 'image' | 'text';
export type FieldType = 'single' | 'multi';

export const COLUMNS: { id: ColumnId; label: string }[] = [
  { id: 'raw', label: 'Raw Ideas' },
  { id: 'in-progress', label: 'In Progress' },
  { id: 'done', label: 'Done' },
  { id: 'scheduled', label: 'Scheduled / Posted' },
];

export const DEFAULT_CONTENT_TYPES = ['Static', 'Carousel', 'Reel', 'Poster', 'Banner', 'PDF', 'Presentation'];
export const DEFAULT_CATEGORIES = ['One-time', 'Evergreen'];

export interface CustomFieldDef {
  id: string;
  name: string;
  type: FieldType;
  options: string[];
}

export interface KanbanCard {
  id: string;
  columnId: ColumnId;
  name: string;
  date: string;
  contentType: string;
  category: string;
  notes: string;
  scheduledDate: string;
  postUrl: string;
  createdMonth: string;
  customValues: Record<string, string | string[]>;
  createdAt: string;
}

export interface AgendaItem {
  id: string;
  text: string;
  dueDate: string;
  done: boolean;
}

export interface Reference {
  id: string;
  type: ReferenceType;
  content: string;
  title: string;
  pinned: boolean;
  createdAt: string;
}

export interface BrandService {
  id: string;
  name: string;
  description: string;
  price: string;
}

export interface BrandOverview {
  tagline: string;
  goals: string[];
  strategy: string;
  audience: string;
  /** What they sound like, in plain words. Optional: profiles from before this
   *  field simply have none, and a blank box is a blank box, never an error. */
  voice?: string;
  services: BrandService[];
}

export interface BrandColor {
  id: string;
  name: string;    // e.g. "Brand Blue"
  hex: string;     // e.g. "#25B763"
  role?: string;   // e.g. "Primary" — drives accent color in the UI
}

export interface BrandFont {
  id: string;
  name: string;    // e.g. "Manrope"
  role: string;    // e.g. "Headlines"
  weights: string; // e.g. "Light, Regular, Medium"
}

export interface BrandLogo {
  id: string;
  name: string;   // e.g. "Primary logo", "White version"
  url: string;    // public storage URL — clients download it themselves
}

/**
 * Anything else that belongs to the brand: a PDF brand guide, a Canva link, a
 * font licence, a deck. Her words, 2026-08-11: "this one option of uploading a
 * PDF file or adding a link to the Canva file, or any sort of file that is
 * associated with the brand". A LINK is a first-class member, not a lesser
 * case: half of what she has is in Canva and cannot be uploaded at all.
 */
export interface BrandFile {
  id: string;
  name: string;
  url: string;
  kind: 'file' | 'link';
  addedAt: string;
}

export interface BrandKit {
  colors: BrandColor[];
  fonts: BrandFont[];
  logos?: BrandLogo[];
  files?: BrandFile[];
}

export interface MonthData {
  agenda: AgendaItem[];
}

export interface EvergreenIdea {
  id: string;
  title: string;
  format: string;
  notes: string;
  createdAt: string;
}

// ── Catalogue (Sonia's Crochet) ─────────────────────────────────────────────

export interface CatalogueCategory {
  id: string;
  name: string;
  createdAt: string;
}

export interface CatalogueItem {
  id: string;
  categoryId: string;
  imageUrl: string;
  createdAt: string;
}

// ── Orders (Sonia's Crochet) ────────────────────────────────────────────────

export type OrderPaymentStatus = 'received' | 'not-received' | 'partial';
export type OrderDeliveryStatus = 'delivered' | 'yet-to-deliver' | 'in-process';

export interface SoniaOrder {
  id: string;
  name: string;            // customer name
  items: string;           // what was ordered
  amount: number;          // price
  orderType: string;       // e.g. advance, full payment, balance
  paymentStatus: OrderPaymentStatus;
  deliveryStatus: OrderDeliveryStatus;
  createdAt: string;
}

// ── Cold Calls (lead tracker — Divine Studio) ────────────────────────────────

export type ColdCallStatus = 'open' | 'reached-out' | 'in-review' | 'closed' | 'not-interested';

export const COLD_CALL_STATUSES: { id: ColdCallStatus; label: string; color: string; bg: string }[] = [
  { id: 'open',           label: 'Open',           color: '#0284c7', bg: '#e0f2fe' },
  { id: 'reached-out',    label: 'Reached Out',    color: '#7c3aed', bg: '#ede9fe' },
  { id: 'in-review',      label: 'In Review',      color: '#d97706', bg: '#fef3c7' },
  { id: 'closed',         label: 'Closed',         color: '#059669', bg: '#d1fae5' },
  { id: 'not-interested', label: 'Not Interested', color: '#dc2626', bg: '#fee2e2' },
];

export interface ColdCall {
  id: string;
  name: string;       // client's name
  phone: string;      // number
  location: string;   // client location
  status: ColdCallStatus;
  response: string;   // what they said
  notes: string;
  createdAt: string;
}

// ── Lead Answers (Divine Studio) ─────────────────────────────────────────────
// Ready-to-paste DM replies for leads, grouped by topic. `reply` is what gets
// copied and sent; `rule` is optional internal guidance (what to do / not do,
// when to escalate) that is never part of the copied text.

export const LEAD_ANSWER_STARTER_CATEGORIES = [
  'Gym membership', 'Yoga batch', 'Personal training', 'Workshops', 'Trial visit', 'Discounts',
];

export interface LeadAnswer {
  id: string;
  category: string;
  question: string;   // how the lead asks it
  reply: string;      // paste-ready text reply
  rule?: string;      // internal: do's/don'ts, escalation — never sent
  createdAt: string;
  updatedAt: string;
}

// ── Canva Connect (server-side only) ─────────────────────────────────────────
// OAuth token for pulling design slides straight into previews. Stored in a
// dedicated Supabase row, never sent to the browser.
export interface CanvaToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;   // epoch ms — when the access token stops working
  scope: string;
}

// ── Onboarding questionnaire (per client) ────────────────────────────────────

export interface OnboardingItem {
  id: string;
  question: string;
  answer: string;
}

// ── Instagram post previews (per client) ─────────────────────────────────────

export type PreviewPostType = 'static' | 'carousel';

/** Instagram identity shown in the header of every preview for this client. */
export interface InstagramProfile {
  handle: string;     // e.g. "divinestudio.in" (no @)
  avatarUrl: string;  // profile picture URL
}

export interface PreviewPost {
  id: string;
  shareId: string;            // long random token — the public link is /p/[shareId]
  // The piece this preview shows. A preview is the REVIEW STATE of a piece, not
  // a thing of its own (spec 21 §7.2, amendment S2: one canonical piece
  // identity, owned by creation/). Optional because every preview made before
  // this field existed has none; those are listed on the board as unattached
  // rather than deleted, and the piece panel is where one gets attached.
  cardId?: string;
  name: string;               // internal label, not shown to clients
  postType: PreviewPostType;
  images: string[];           // ordered slide URLs (1 for static, up to 20 for carousel)
  caption: string;
  createdAt: string;
  updatedAt: string;
}

export const MAX_CAROUSEL_SLIDES = 20;

// ── Asset Vault (per client) ─────────────────────────────────────────────────
// The collection point where clients drop their photos. Originals are stored
// untouched in the `assets` bucket (no resize, no recompression) plus a small
// browser-generated thumbnail for fast grids. Videos never live here — they
// live in the client's Google Drive folder, reached through the Videos tile.

export interface AssetSet {
  id: string;
  name: string;       // e.g. "March shoot", "Products"
  createdAt: string;
}

export interface AssetItem {
  id: string;
  setId: string;
  url: string;        // public URL of the untouched original
  thumbUrl: string;   // small webp preview (falls back to `url` if generation failed)
  fileName: string;   // original filename, kept for download
  size: number;       // bytes
  uploadedBy: string; // role that uploaded it
  createdAt: string;
}

// ── Content Pillars (per client) ─────────────────────────────────────────────
// A pillar is a content theme (a column). Each pillar holds topic cards; a
// card is a ready-to-produce post: title/hook + full content, so the work can
// be handed to someone who just copies it out.

// A pillar's job decides which metrics it is judged on (Spec 04). Fixed small
// vocabulary so pillars compare across brands; names stay fully custom.
export type PillarJob = 'reach' | 'trust' | 'convert';

export const PILLAR_JOBS: { id: PillarJob; label: string; sub: string }[] = [
  { id: 'reach',   label: 'Reach',   sub: 'Bring new people in' },
  { id: 'trust',   label: 'Trust',   sub: 'Make people trust the brand' },
  { id: 'convert', label: 'Convert', sub: 'Get people to act: tap, DM, buy' },
];

export interface ContentPillar {
  id: string;
  name: string;
  color: string;      // hex accent for the column header
  targetPct?: number; // strategy mix target (e.g. ResumeGuru AI lane = 40) — Journey compares actual vs this
  job?: PillarJob;       // what this pillar is judged on (reach / trust / convert)
  purpose?: string;      // one plain line: what this pillar is for (client-facing later)
  jobChangedAt?: string; // stamped whenever job is set or changed — analysis never mixes regimes
  createdAt: string;
}

// ── Lists (pipelines, per client) ────────────────────────────────────────────
// A reusable list maker where each list defines its own stages, so a list IS
// a pipeline: colleges move not-contacted → reached-out → agreed → conducted.
// Covers collaborators, workshops, locations — one feature, endless lists.

export interface ListStage {
  id: string;
  name: string;
}

export interface TrackList {
  id: string;
  name: string;          // e.g. "Colleges & Workshops"
  stages: ListStage[];   // ordered, user-defined
  createdAt: string;
  // Shared lists (spec 12): ONE list, windows into it from other workspaces.
  sharedWith?: CollabRef[];  // owner-set: which other workspaces see this list
  sharedFrom?: CollabRef;    // present ONLY in role-filtered payloads — marks an
                             // injected window onto another client's list. Never
                             // stored (normalizeState strips it).
}

export interface ListRow {
  id: string;
  listId: string;
  stageId: string;
  name: string;          // person / college / place
  link?: string;         // profile, website, contact
  note?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Journey (per client) ─────────────────────────────────────────────────────
// The strategy-meets-progress layer: one goal, channel statuses, monthly
// check-in numbers. Content mix is computed from contentCards, not stored.

export interface JourneyCheckIn {
  month: string;   // yyyy-MM
  value: number;   // the north-star number that month (signups, leads...)
}

export interface JourneyChannel {
  id: string;
  name: string;    // Instagram / YouTube / LinkedIn / SEO...
  note: string;    // where it stands, next move
}

export interface JourneyData {
  northStar: string;      // e.g. "Signups" — empty until she sets it
  targetValue?: number;   // e.g. 300
  targetDate?: string;    // yyyy-MM
  startMonth?: string;    // when the journey began (defaults to first post month)
  checkIns: JourneyCheckIn[];
  channels: JourneyChannel[];
  nextSteps: string;      // the ordered 3-5 moves, plain text
}

// ── Momentum meter (per client — ResumeGuru first) ──────────────────────────
// Tracks EFFORT, the one thing she controls. The meter value is computed from
// the log on every render; only the log entries are stored. Posting is never
// logged by hand — it is derived from contentCards hitting the posted stage.

export interface MomentumEntry {
  date: string;        // yyyy-mm-dd
  actions: string[];   // ids from MOMENTUM_ACTIONS
  note?: string;       // optional one-liner: what she did that day
  extraValue?: number; // extra dollars for a day that deserved more (spec 16)
}

export interface MomentumData {
  startDate: string;   // yyyy-mm-dd — the day the meter started counting
  entries: MomentumEntry[];
  // Money mode (spec 16): the month's work value in dollars. A full work day
  // earns monthlyValue / days-in-month; earned money never decreases. Unset =
  // the card stays in the original points mode.
  monthlyValue?: number;
}

// Weights: a full day of work adds up to +8; a skipped day costs −3 (about
// half a worked day, per her decision 2026-07-17). Posted cards add +4 each,
// derived from the board.
export const MOMENTUM_ACTIONS: { id: string; label: string; points: number }[] = [
  { id: 'story',    label: 'Story',              points: 2 },
  { id: 'engaged',  label: 'Comments & replies', points: 2 },
  { id: 'dms',      label: 'DMs',                points: 2 },
  { id: 'outreach', label: 'Outreach',           points: 2 },
  { id: 'other',    label: 'Other work',         points: 1 },
];

export const MOMENTUM_POSTED_POINTS = 4;
export const MOMENTUM_DAY_CAP = 8;
export const MOMENTUM_SKIP_PENALTY = 3;

export type PillarCardStatus = 'idea' | 'writing' | 'ready' | 'done';

export const PILLAR_CARD_STATUSES: { id: PillarCardStatus; label: string; color: string; bg: string }[] = [
  { id: 'idea',    label: 'Idea',    color: '#78716c', bg: '#f5f5f4' },
  { id: 'writing', label: 'Writing', color: '#d97706', bg: '#fef3c7' },
  { id: 'ready',   label: 'Ready',   color: '#0284c7', bg: '#e0f2fe' },
  { id: 'done',    label: 'Done',    color: '#059669', bg: '#d1fae5' },
];

// A collaboration link: a topic can live on more than one account's board.
// Linked twin cards share a `collabId`; each card also carries `collabWith` —
// the OTHER accounts it's shared with — so the badge renders without needing
// those accounts' data (client logins never receive it). Title/hook/content/
// link stay in sync across the set; each account keeps its own bucket + status.
export interface CollabRef {
  clientId: string;
  clientName: string;
}

export interface PillarCard {
  id: string;
  pillarId: string;
  title: string;      // post title or working name
  hook: string;       // the opening hook / first line
  content: string;    // full body content, ready to copy-paste
  link?: string;      // reference link (doc, Canva, reel) instead of / alongside text
  status: PillarCardStatus;
  collabId?: string;         // shared id linking twin cards across accounts
  collabWith?: CollabRef[];  // the other accounts this topic is shared with
  createdAt: string;
  updatedAt: string;
}

// ── Unified Content cards ────────────────────────────────────────────────────
// ONE card per post, from idea to live. Replaces the old split where the same
// post lived twice (a PillarCard for its content + a KanbanCard for its
// timeline). The Content tab renders these in three views: Board (by stage),
// Pillars (by theme), Table. Legacy `cards`/`pillarCards` are migrated into
// this on first load and kept dormant as a safety copy.

// SIX stages, not five (the restructure, phase 2). Review was always a real step
// of the work — the client saying yes — but it lived on its own Previews screen,
// which made the preview a SECOND copy of a piece that was already on the board.
// It is a stage now, so review is a state of the one piece (spec 21 §7.2, S2).
//
// The ids of the five that already existed are UNCHANGED, deliberately. Spec 21
// §8.5 maps `writing`→Build and `ready`→Approved, and those are the labels here;
// renaming the stored ids would mean migrating every card on every board to buy
// nothing but tidier spelling. The precedent is the line this replaces: `writing`
// has been labelled "Making" since 2026-07-10 without ever being renamed.
//
// `review` is the one genuinely new id, and it has no legacy data by definition:
// nothing before today ever recorded a client verdict.

export type ContentStage = 'idea' | 'writing' | 'review' | 'rejected' | 'ready' | 'scheduled' | 'posted';

export const CONTENT_STAGES: { id: ContentStage; label: string; color: string; bg: string }[] = [
  { id: 'idea',      label: 'Idea',      color: '#7c3aed', bg: '#ede9fe' },
  // id stays 'writing' (no migration); label is "Build" — covers get-content + creation.
  { id: 'writing',   label: 'Build',     color: '#d97706', bg: '#fef3c7' },
  { id: 'review',    label: 'Review',    color: '#b8551f', bg: '#fdece4' },
  // 2026-08-11, hers: "if something is in review and gets rejected in the
  // review, it gets rejected." An outcome, not a stop on the happy path: the
  // column only draws once something is actually in it.
  { id: 'rejected',  label: 'Rejected',  color: '#b91c1c', bg: '#fee2e2' },
  // id stays 'ready'; "Approved" is what it has always meant — she is done with it.
  { id: 'ready',     label: 'Approved',  color: '#0284c7', bg: '#e0f2fe' },
  { id: 'scheduled', label: 'Scheduled', color: '#0891b2', bg: '#cffafe' },
  { id: 'posted',    label: 'Posted',    color: '#059669', bg: '#d1fae5' },
];

// Content role — feeds the monthly mix assessment. Optional, one tap.
export type ContentRole = 'brand' | 'value' | 'general';
export const CONTENT_ROLES: { id: ContentRole; label: string }[] = [
  { id: 'brand',   label: 'Brand story' },
  { id: 'value',   label: 'Value' },
  { id: 'general', label: 'General' },
];

export const DEFAULT_PLATFORMS = ['Instagram', 'LinkedIn', 'YouTube'];

// ── Topics (the seed layer, Spec 04) ─────────────────────────────────────────
// A topic groups the cards that express the same idea in different formats.
// Cards join a topic ONLY through the Repurpose action (or a deliberate group
// action later) — never through a mandatory dropdown at card creation.

export interface Topic {
  id: string;
  name: string;
  createdAt: string;
}

// ── Client goals (Spec 04) ───────────────────────────────────────────────────
// What content should do for this account. Any 0-3 of the three; empty means
// not chosen yet. Declared by Manmeet on the Journey tab. Kept as a string
// list (not a locked enum shape) so a real fourth goal can be added later.

/**
 * 2026-08-11: a goal is any short string of hers. It was a closed union of
 * three, and her note on seeing the chips was "give me more options, let me
 * add options". The three below remain as SUGGESTIONS with explanations, not
 * as the boundary of what success is allowed to look like. Everything that
 * reads goals only ever counts or lists them, so widening breaks no reader.
 */
export type ClientGoal = string;

export const CLIENT_GOALS: { id: ClientGoal; label: string; sub: string }[] = [
  { id: 'links',         label: 'Get link taps',  sub: 'People tap the link in bio' },
  { id: 'conversations', label: 'Get DMs',        sub: 'People message to ask or book' },
  { id: 'followers',     label: 'Grow followers', sub: 'More people follow the account' },
];

export interface ContentCard {
  id: string;
  pillarId: string;          // '' = unsorted (no theme yet)
  title: string;
  hook: string;
  content: string;           // full post body, ready to copy
  link?: string;             // reference link (doc, Canva draft, reel)
  stage: ContentStage;
  contentType: string;       // Static / Carousel / Reel / ...
  role?: ContentRole | '';   // brand / value / general (assessment fuel)
  platform?: string;         // only meaningful for multi-platform clients
  scheduledDate: string;     // the go-live date (drives My Day + calendar)
  postUrl: string;           // final live link
  notes: string;
  customValues: Record<string, string | string[]>;
  createdMonth: string;      // yyyy-MM bucket for month filtering
  topicId?: string;          // set via Repurpose — sibling cards share one topic
  experiment?: { hypothesis: string }; // flagged tests, kept out of pillar verdict math
  collabId?: string;
  collabWith?: CollabRef[];
  createdAt: string;
  updatedAt: string;
}

export interface ClientData {
  /** Spec 21: this profile's path-addressed body. Absent until it is migrated;
   *  the legacy slices below stay the rendering source until the GUI spec moves
   *  over, so a migrated profile keeps looking exactly like it does today. */
  body?: ProfileBody;
  cards: KanbanCard[];
  customFields: CustomFieldDef[];
  monthData: Record<string, MonthData>;
  references: Reference[];
  brand: BrandOverview;
  brandKit: BrandKit;  // colors + fonts for this client
  postTarget: number;
  evergreenIdeas: EvergreenIdea[];
  studioCompositions: StudioComposition[];
  coldCalls: ColdCall[];
  onboarding: OnboardingItem[];
  orders: SoniaOrder[];
  catalogueCategories: CatalogueCategory[];
  catalogueItems: CatalogueItem[];
  instagram: InstagramProfile;
  previewPosts: PreviewPost[];
  pillars: ContentPillar[];
  pillarCards: PillarCard[];
  assetSets: AssetSet[];
  assetItems: AssetItem[];
  driveFolderUrl: string;  // the client's Google Drive video folder (the Videos tile)
  leadAnswers: LeadAnswer[];
  contentCards: ContentCard[];
  platforms?: string[];    // enabled platforms; UI shows a platform picker only when >1
  lists: TrackList[];
  listRows: ListRow[];
  journey?: JourneyData;
  momentum?: MomentumData;
  topics: Topic[];
  goals?: ClientGoal[];    // 0-3 of links / conversations / followers; empty = not chosen yet
}

// A Client IS a profile (spec 21 §6, PLAN §2). Her own workspaces live here on
// the same terms as clients — she is client zero — with `ownerKind` marking the
// difference, because two features (the effort and money meters) exist only in
// her own profiles (PLAN §7).
export type ProfileOwnerKind = 'client' | 'hers';

export interface Client {
  id: string;
  name: string;
  color: string;
  createdAt: string;
  /** Absent = not yet classified; treated as `client` (the safer reading). */
  ownerKind?: ProfileOwnerKind;
  /** S22. Absent = `active` for everything that exists today. */
  lifecycle?: Lifecycle;
  /** When the current lifecycle state was set. The shelf's chip says "Paused
   *  since 3 June" from this; with no date it just says "Paused" (spec 28 §4.6). */
  lifecycleAt?: string;
  /** Her switch positions for this profile. Migration never sets these. */
  switches?: SwitchConfig;
  /** What migration suggested, kept separate so a suggestion is never mistaken
   *  for her decision (PLAN §3.4: she is the only one who finalizes). */
  suggestedSwitches?: SwitchConfig;
}

// ── Profile bindings (spec 21 §6) ────────────────────────────────────────────
// Access binds by profile ID, never by name. Renaming a profile can no longer
// silently open or cut off a login. A binding is a (person, profile) pair; one
// person may hold several, and then they get a picker limited to THEIR profiles
// (PLAN §11, control-room ruling on Q3).

export interface ProfileBinding {
  role: string;        // the login this binding belongs to
  profileId: string;
  /** S20: a delegated approver may act on review without being the client. */
  kind?: 'client' | 'delegated-approver' | 'staff';
  createdAt?: string;
}

// ── Personal ("My Day") tasks ───────────────────────────────────────────────

export type TaskBucket = 'today' | 'week' | 'todo';

export const TASK_BUCKETS: { id: TaskBucket; label: string; sub: string }[] = [
  { id: 'today', label: 'Today',     sub: "What you're doing today" },
  { id: 'week',  label: 'This Week', sub: 'Goals for the week' },
  { id: 'todo',  label: 'To-Do',     sub: 'Everything pending' },
];

export type TaskRepeat = '' | 'weekly' | 'monthly';

// A My Day task is one of three kinds. Content and client tasks are pointers
// into client data (a content card / an agenda item); personal is standalone.
export type TaskType = 'content' | 'client-task' | 'personal';

export interface PersonalTask {
  id: string;
  text: string;
  bucket: TaskBucket;    // legacy — sections are computed from dates now
  taskType: TaskType;    // content | client-task | personal (migrated: old tasks = personal)
  clientIds: string[];   // which clients this is for (replaces the old single clientId)
  clientId?: string;     // legacy — kept readable; migrated into clientIds
  dueDate?: string;      // optional ISO date (yyyy-mm-dd)
  repeat?: TaskRepeat;   // recurring: recreates itself on completion
  pinnedOn?: string;     // yyyy-mm-dd — manually pulled into Today for that day
  // Content tasks point at one content card per chosen client. The task's
  // status is READ from these cards' stage, never copied.
  linkedCards?: { clientId: string; cardId: string }[];
  // Client tasks point at one agenda item per chosen client's Dashboard.
  linkedAgenda?: { clientId: string; month: string; itemId: string }[];
  done: boolean;
  completedAt?: string;  // ISO timestamp when checked off
  createdAt: string;
}

// ── Brain Dump (mind map) ────────────────────────────────────────────────────

export type BrainNodeKind = 'thought' | 'idea';

export interface BrainNode {
  id: string;
  text: string;
  x: number;
  y: number;
  w?: number;            // optional custom width (px)
  h?: number;            // optional custom height (px)
  kind: BrainNodeKind;
  clientId?: string;     // optional — tag for clarity (personal if absent)
  createdAt: string;
}

export interface BrainEdge {
  id: string;
  from: string;          // node id
  to: string;            // node id
}

export interface BrainDump {
  nodes: BrainNode[];
  edges: BrainEdge[];
}

// ── Container Map (project mind map) ─────────────────────────────────────────

export interface MapNode {
  id: string;
  parentId?: string;     // absent = the root node
  label: string;
  note?: string;         // optional small note under the label
  detail?: string;       // full brief shown in the detail panel — plain text with line breaks
  checkable?: boolean;   // build items that can be ticked off
  done?: boolean;
  collapsed?: boolean;   // branch nodes: hide children
  color?: string;        // branch accent; leaves inherit visually
  order: number;         // sibling sort
  createdAt: string;
}

export interface ContainerMap {
  nodes: MapNode[];
}

// ── Observations (owner-only private notebook, Spec 18) ─────────────────────
// Her private observation log. Topics are free text and exist only through
// use — no topic management, no mandatory dropdown. The optional clientId is
// a tag for later reading (the analytics qualitative layer), never required.
// The slice is stripped for every non-owner role, same as personalTasks.

export interface Observation {
  id: string;
  topic: string;       // free-text bucket, e.g. "Reels", "Client calls"
  text: string;        // the observation itself
  clientId?: string;   // optional client tag
  createdAt: string;
  updatedAt: string;
}

// ── Dashboard chat (owner-only floating chat, Spec 18 part C) ───────────────
// The capture chat that floats on every page. Her messages and the
// dashboard's one-line answers ("Done — ...", "Not done — ...") both live
// here so the thread survives reloads. Capped at the last 100 messages —
// the filed items themselves live in their real homes (tasks, agenda,
// observations, assets), so old chat lines are safe to drop.

/**
 * One line of the chat, and there is only ONE chat.
 *
 * The desk and the floating bubble are the same conversation seen from two
 * places (spec 30 §4). Until 2026-08-08 the desk kept its thread in component
 * state and nothing else, so refreshing the page threw the conversation away —
 * which is what she reported, and it was not a save bug: nothing was ever
 * being saved.
 */
export interface ChatMessage {
  id: string;
  who: 'me' | 'dash';
  text: string;
  ok?: boolean;      // dash replies: false marks a "Not done" answer
  createdAt: string;
  /**
   * The walk-into rows a desk answer carried, kept AS THEY WERE SAID.
   *
   * They are deliberately stored rather than recomputed on reload. Re-running
   * the query would silently rewrite history: an answer that said three pieces
   * were waiting would quietly become two, and she would have no way of knowing
   * the line had changed under her. What was true when it was said stays what
   * the line says.
   */
  rows?: ChatRow[];
  /** The line under the rows, when the answer had one. */
  note?: string;
}

/** A row inside a desk answer. Mirrors `DeskRow`, stored so it survives. */
export interface ChatRow {
  key: string;
  profile_id: string;
  title: string;
  profile_name: string;
  when: string;
  late: boolean;
  hue: string;
  href: string;
}

export interface AppState {
  clients: Client[];
  clientData: Record<string, ClientData>;
  personalTasks: PersonalTask[];
  brainDump: BrainDump;
  containerMap: ContainerMap;
  observations: Observation[];
  chatLog: ChatMessage[];
  /** Spec 21 §6: who may open which profile. Replaces the client-NAME regexes. */
  bindings: ProfileBinding[];
  /**
   * 2026-08-11: people she invited, rather than logins written into the code.
   * See lib/access/invites.ts. An invite grants through `bindings` like every
   * other login, so nothing downstream had to learn a new idea.
   */
  invites?: import('../lib/access/invites').Invite[];
  /**
   * Spec 25 §9.2: the owner-zone taste store at `owner/taste-rules`. It sits on
   * AppState rather than inside a profile body for the reason the spec gives —
   * these rules are hers across her whole practice, and a copy per profile would
   * be five copies of one truth. Owner-only, in every direction.
   */
  tasteRules: TasteRule[];
}

// ── Studio types ──────────────────────────────────────────────────────────

export type LType = 'text' | 'icon' | 'shape' | 'image';

export interface StudioLayer {
  id: string;
  type: LType;
  x: number;
  y: number;
  w: number;
  h: number;
  rot: number;
  opacity: number;
  // text
  text?: string;
  font?: string;
  size?: number;
  weight?: number;
  align?: 'left' | 'center' | 'right';
  color?: string;
  // icon / shape
  fill?: boolean;
  icon?: string;     // lucide icon name
  shape?: 'circle' | 'rect' | 'ring' | 'line';
  // image
  src?: string;
  frame?: 'none' | 'browser' | 'phone';
}

export interface StudioComposition {
  id: string;
  name: string;
  aspectKey: string;
  bg: string;
  layers: StudioLayer[];
  createdAt: string;
  updatedAt: string;
}
