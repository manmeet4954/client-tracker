import { redirect } from 'next/navigation';

// Spec 28 §11.1: the client list home BECOMES the shelf (spec 21 §8.1 already
// named it). This address permanently redirects.
//
// It is safe on day one because a shelf card can open either destination: a
// profile that has not cut over opens its legacy workspace, unchanged (§16.3).
// `components/ClientsView.tsx` stays in the repo, unimported, until the legacy
// routes are removed (§16.6) — nothing is deleted by this spec.
export default function ClientsPage() {
  redirect('/shelf');
}
