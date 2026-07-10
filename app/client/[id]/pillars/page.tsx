import { redirect } from 'next/navigation';

// Pillars merged into the unified Content tab (Pillars view).
export default function PillarsPage({ params }: { params: { id: string } }) {
  redirect(`/client/${params.id}/content`);
}
