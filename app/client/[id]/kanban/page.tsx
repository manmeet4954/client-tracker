import { redirect } from 'next/navigation';

// Kanban merged into the unified Content tab (Board view).
export default function KanbanPage({ params }: { params: { id: string } }) {
  redirect(`/client/${params.id}/content`);
}
