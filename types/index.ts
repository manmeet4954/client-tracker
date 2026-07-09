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

export interface BrandKit {
  colors: BrandColor[];
  fonts: BrandFont[];
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
  createdAt: string;
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

export interface PersonalTask {
  id: string;
  text: string;
  bucket: TaskBucket;
  clientId?: string;     // optional — which client this is for
  dueDate?: string;      // optional ISO date (yyyy-mm-dd)
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
