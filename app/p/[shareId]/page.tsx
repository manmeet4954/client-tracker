import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Instagram } from 'lucide-react';
import { findPreviewPost, readState } from '@/lib/supabaseServer';
import { authConfigured, verifyToken, SESSION_COOKIE } from '@/lib/auth';
import { normalizeState, type Role } from '@/lib/access';
import { resolveDeepLink } from '@/lib/shell/deeplink';
import InstagramPost from '@/components/InstagramPost';
import type { InstagramProfile, PreviewPost } from '@/types';

export const dynamic = 'force-dynamic';

type Found = { post: PreviewPost; instagram: InstagramProfile };

// Dev-only sample so the page can be exercised without live Supabase data.
function demoPost(shareId: string): Found | null {
  if (process.env.NODE_ENV !== 'development' || shareId !== 'demo') return null;
  return {
    post: {
      id: 'demo', shareId: 'demo', name: 'Demo', postType: 'carousel',
      images: Array.from({ length: 8 }, (_, i) => `https://picsum.photos/seed/ig-demo-${i}/1080/1350`),
      caption: 'Your new favourite morning flow is here. Eight slides of everything we cover in the 6am class: breathwork, sun salutations, and the cool-down everyone asks about.\n\nSave this for your next practice.',
      createdAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
    },
    instagram: { handle: 'divinestudio.in', avatarUrl: 'https://picsum.photos/seed/ig-avatar/200/200' },
  };
}

async function lookup(shareId: string): Promise<{ found: Found | null; dbError: boolean }> {
  const demo = demoPost(shareId);
  if (demo) return { found: demo, dbError: false };
  try {
    const found = await findPreviewPost(shareId);
    return { found, dbError: false };
  } catch (e) {
    console.error('[PreviewPage] findPreviewPost threw:', e);
    return { found: null, dbError: true };
  }
}

export async function generateMetadata({ params }: { params: { shareId: string } }): Promise<Metadata> {
  const { found } = await lookup(params.shareId);
  if (!found) return { title: 'Preview not found' };
  const handle = found.instagram.handle || 'Instagram';
  return {
    title: `@${handle} · post preview`,
    description: found.post.caption.slice(0, 150) || 'Instagram post preview',
    openGraph: { images: found.post.images[0] ? [found.post.images[0]] : [] },
  };
}

/** Whose session is holding this request, if anyone's (§10 branch 3). */
function sessionRole(): Role | null {
  if (!authConfigured()) return 'owner';   // open mode, local dev
  return verifyToken(cookies().get(SESSION_COOKIE)?.value);
}

export default async function PreviewPage({ params }: { params: { shareId: string } }) {
  const { found, dbError } = await lookup(params.shareId);

  // ── Spec 28 §10 — the five-branch resolution, server side, in order ────────
  //
  // The public page's own rendering is unchanged. What changes is only WHO ends
  // up looking at it: a session that holds a door lands inside the platform at
  // the piece instead, which is her PLAN §11 Q2 ask, and everyone else gets
  // exactly what they got before.
  if (found) {
    const raw = await readState().catch(() => null);
    const branch = resolveDeepLink({
      state: raw ? normalizeState(raw) : null,
      shareId: params.shareId,
      role: sessionRole(),
      previewExists: true,
    });
    if (branch.branch === 'inside') redirect(branch.to);
    if (branch.branch === 'revoked') return <NotAvailable dbError={false} />;
  }

  if (!found) return <NotAvailable dbError={dbError} />;

  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col items-center sm:py-8">
      <main className="w-full sm:max-w-[470px]">
        <InstagramPost post={found.post} instagram={found.instagram} />
      </main>
      <p className="text-[11px] text-stone-400 py-4">Design preview</p>
    </div>
  );
}

/**
 * One page for two cases, on purpose: a link that never existed and a link whose
 * public switch is off look identical from outside. Nothing here names a profile
 * or hints that a session would have seen more.
 */
function NotAvailable({ dbError }: { dbError: boolean }) {
  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-14 h-14 rounded-full border-2 border-stone-300 flex items-center justify-center mb-4">
        <Instagram size={26} className="text-stone-400" />
      </div>
      <p className="font-semibold text-[#262626] mb-1">This preview isn&apos;t available</p>
      <p className="text-sm text-[#8e8e8e]">
        {dbError
          ? 'Could not connect to the database. Please try again in a moment.'
          : 'The link may be incorrect, or the post was removed.'}
      </p>
    </div>
  );
}
