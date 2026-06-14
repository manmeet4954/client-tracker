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

export interface AppState {
  clients: Client[];
  clientData: Record<string, ClientData>;
  personalTasks: PersonalTask[];
  brainDump: BrainDump;
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
