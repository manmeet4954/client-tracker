import { type ClassValue, clsx } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function generateId(): string {
  return Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
}

/** True if a media URL points at a video (so previews render <video>, not <img>). */
export function isVideoUrl(url: string): boolean {
  return /\.(mp4|mov|webm|m4v)(\?|#|$)/i.test(url);
}

/** Long unguessable token for public share links (the link itself is the secret). */
export function generateShareId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

export function formatMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** The month a content card belongs to, everywhere (Board, Dashboard target,
 *  Journey map): the go-live date wins; only dateless cards fall back to the
 *  month they were created in. */
export function contentMonth(card: { scheduledDate?: string; createdMonth?: string }): string {
  if (card.scheduledDate?.trim()) return card.scheduledDate.slice(0, 7);
  return card.createdMonth ?? '';
}

export function parseMonthKey(key: string): Date {
  const [year, month] = key.split('-').map(Number);
  return new Date(year, month - 1, 1);
}

export function formatMonthLabel(key: string): string {
  const date = parseMonthKey(key);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function prevMonth(key: string): string {
  const date = parseMonthKey(key);
  date.setMonth(date.getMonth() - 1);
  return formatMonthKey(date);
}

export function nextMonth(key: string): string {
  const date = parseMonthKey(key);
  date.setMonth(date.getMonth() + 1);
  return formatMonthKey(date);
}

export function formatDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export const CLIENT_COLORS = [
  '#8B5CF6',
  '#10B981',
  '#F43F5E',
  '#F97316',
  '#0EA5E9',
  '#EC4899',
  '#6366F1',
  '#14B8A6',
  '#EAB308',
  '#84CC16',
];
