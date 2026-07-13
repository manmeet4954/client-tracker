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

export interface BrandKit {
  colors: BrandColor[];
  fonts: BrandFont[];
  logos?: BrandLogo[];
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

export interface ContentPillar {
  id: string;
  name: string;
  color: string;      // hex accent for the column header
  targetPct?: number; // strategy mix target (e.g. ResumeGuru AI lane = 40) — Journey compares actual vs this
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

export type ContentStage = 'idea' | 'writing' | 'ready' | 'scheduled' | 'posted';

export const CONTENT_STAGES: { id: ContentStage; label: string; color: string; bg: string }[] = [
  { id: 'idea',      label: 'Idea',      color: '#7c3aed', bg: '#ede9fe' },
  // id stays 'writing' (no migration); label is "Making" — covers get-content + creation.
  { id: 'writing',   label: 'Making',    color: '#d97706', bg: '#fef3c7' },
  { id: 'ready',     label: 'Ready',     color: '#0284c7', bg: '#e0f2fe' },
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
  collabId?: string;
  collabWith?: CollabRef[];
  createdAt: string;
  updatedAt: string;
}

export interface ClientData {
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
}

export interface Client {
  id: string;
  name: string;
  color: string;
  createdAt: string;
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

export interface AppState {
  clients: Client[];
  clientData: Record<string, ClientData>;
  personalTasks: PersonalTask[];
  brainDump: BrainDump;
  containerMap: ContainerMap;
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
