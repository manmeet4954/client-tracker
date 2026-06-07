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
  postTarget: number; // monthly post target (e.g. 12), 0 = not set
  evergreenIdeas: EvergreenIdea[]; // standalone reusable content ideas, not linked to Kanban
  studioCompositions: StudioComposition[]; // saved freeform studio canvases
}

export interface Client {
  id: string;
  name: string;
  color: string;
  createdAt: string;
}

export interface AppState {
  clients: Client[];
  clientData: Record<string, ClientData>;
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
