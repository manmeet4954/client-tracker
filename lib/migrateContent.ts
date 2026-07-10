import { ClientData, ContentCard, ContentStage, KanbanCard, PillarCard } from '@/types';

// One-time migration: fold the legacy split (KanbanCard timeline + PillarCard
// content) into unified ContentCards. Runs client-side on LOAD only when a
// client has no `contentCards` array yet. Legacy arrays are left untouched as
// a dormant safety copy — the new UI never writes to them.

const STAGE_ORDER: ContentStage[] = ['idea', 'writing', 'ready', 'scheduled', 'posted'];

function later(a: ContentStage, b: ContentStage): ContentStage {
  return STAGE_ORDER.indexOf(a) >= STAGE_ORDER.indexOf(b) ? a : b;
}

function pillarStage(s: PillarCard['status']): ContentStage {
  if (s === 'done') return 'posted';
  return s; // idea | writing | ready map 1:1
}

function kanbanStage(c: KanbanCard): ContentStage {
  switch (c.columnId) {
    case 'raw': return 'idea';
    case 'in-progress': return 'writing';
    case 'done': return 'ready';
    case 'scheduled': {
      // The old column mixed "scheduled" and "posted". A post link, or a
      // go-live date that has passed, means it's out in the world.
      const today = new Date().toISOString().slice(0, 10);
      if (c.postUrl?.trim()) return 'posted';
      if (c.scheduledDate && c.scheduledDate <= today) return 'posted';
      return 'scheduled';
    }
  }
}

function monthOf(iso: string): string {
  return iso?.slice(0, 7) ?? '';
}

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function migrateToContentCards(data: ClientData): ContentCard[] {
  const kanban = data.cards ?? [];
  const pillar = data.pillarCards ?? [];
  const out: ContentCard[] = [];
  const usedKanban = new Set<string>();

  // Pillar cards lead (they hold the written content). If a kanban card has
  // the same title, it's the same post entered twice — merge the two.
  for (const p of pillar) {
    const match = kanban.find(k => !usedKanban.has(k.id) && norm(k.name) === norm(p.title) && p.title.trim());
    if (match) usedKanban.add(match.id);
    out.push({
      id: p.id,
      pillarId: p.pillarId,
      title: p.title,
      hook: p.hook,
      content: p.content,
      link: p.link,
      stage: match ? later(pillarStage(p.status), kanbanStage(match)) : pillarStage(p.status),
      contentType: match?.contentType ?? '',
      role: '',
      scheduledDate: match?.scheduledDate ?? '',
      postUrl: match?.postUrl ?? '',
      notes: match?.notes ?? '',
      customValues: match?.customValues ?? {},
      createdMonth: match?.createdMonth || monthOf(p.createdAt),
      collabId: p.collabId,
      collabWith: p.collabWith,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    });
  }

  // Remaining kanban cards had no written twin — they come over as unsorted.
  for (const k of kanban) {
    if (usedKanban.has(k.id)) continue;
    out.push({
      id: k.id,
      pillarId: '',
      title: k.name,
      hook: '',
      content: '',
      stage: kanbanStage(k),
      contentType: k.contentType ?? '',
      role: '',
      scheduledDate: k.scheduledDate ?? '',
      postUrl: k.postUrl ?? '',
      notes: k.notes ?? '',
      customValues: k.customValues ?? {},
      createdMonth: k.createdMonth || monthOf(k.createdAt),
      createdAt: k.createdAt,
      updatedAt: k.createdAt,
    });
  }

  return out;
}
