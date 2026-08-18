import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Instagram } from 'lucide-react';
import { findPreviewPost, previewDebugLine, readState } from '@/lib/supabaseServer';
import { authConfigured, verifyToken, SESSION_COOKIE } from '@/lib/auth';
import { normalizeState, type Role } from '@/lib/access';
import { resolveDeepLink } from '@/lib/shell/deeplink';
import InstagramPost from '@/components/InstagramPost';
import Phone from '@/components/mockup/Phone';
import Compare from '@/components/mockup/Compare';
import { THEMES, findMockupByShareId, type ProfileMockupRecord } from '@/lib/mockup/profile';
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

/**
 * Spec 35 §5 promised the mockup shares through this same page, and until
 * 2026-08-10 that was a promise only: "Copy the link" handed out URLs nothing
 * served. She found it the way she finds everything real - by sending one.
 */
async function lookupMockup(shareId: string): Promise<ProfileMockupRecord | null> {
  if (!shareId) return null;
  try {
    const state = await readState();
    if (!state) return null;
    for (const data of Object.values(state.clientData ?? {})) {
      if (!data.body) continue;
      const m = findMockupByShareId(data.body, shareId);
      if (m) return m;
    }
  } catch (e) {
    console.error('[PreviewPage] mockup lookup threw:', e);
  }
  return null;
}

export async function generateMetadata({ params }: { params: { shareId: string } }): Promise<Metadata> {
  const { found } = await lookup(params.shareId);
  if (!found) {
    const mockup = await lookupMockup(params.shareId);
    if (mockup) {
      return {
        title: `@${mockup.username || 'profile'} · profile mockup`,
        description: 'How the profile will look.',
      };
    }
    return { title: 'Preview not found' };
  }
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

export default async function PreviewPage({ params, searchParams }: {
  params: { shareId: string };
  searchParams?: { view?: string };
}) {
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

  if (!found) {
    const mockup = await lookupMockup(params.shareId);
    if (mockup) {
      const bg = THEMES[mockup.theme]?.bg ?? '#000';

      // TWO LINKS, ONE MOCKUP (2026-08-17, her request: "when i copy the link
      // for client to preview it only shows the new or optimized view, it
      // should also show comparison version, like make 2 versions - just new
      // one solo, and comparison").
      //
      // `?view=compare` is the only difference between them. Not two records,
      // not two shareIds: one mockup, shown two ways, so editing it updates
      // both links at once and neither can go stale against the other.
      //
      // The comparison falls back to the solo view when there is no screenshot
      // yet, because a comparison with one side missing is not a comparison.
      const wantsCompare = searchParams?.view === 'compare' && !!mockup.beforeImageUrl;

      if (wantsCompare) {
        // Read-only is the SAME component with the handlers left off (spec 35):
        // no upload, no size control, no editing affordance in any state.
        return (
          <div className="min-h-screen bg-paper px-4 py-6 sm:py-10">
            <main className="mx-auto w-full max-w-[980px]">
              <Compare mockup={mockup} />
            </main>
            <p className="pt-6 text-center text-[11px] text-stone-400">Profile mockup</p>
          </div>
        );
      }

      // Read-only is the SAME component with the handlers left off (spec 35):
      // no editing affordance exists on this render, in any state.
      return (
        <div className="min-h-screen flex flex-col items-center sm:py-8" style={{ background: bg }}>
          <main className="w-full sm:max-w-[470px]">
            <Phone mockup={mockup} />
          </main>
          <p className="py-4 text-[11px] text-stone-400">Profile mockup</p>
        </div>
      );
    }

    // Owner-only truth line (2026-08-09): when the person looking at a dead
    // link is HER, signed in, the page reports what the store actually holds
    // instead of the shrug the public sees. The public page is unchanged.
    if (sessionRole() === 'owner') {
      const raw = await readState().catch(() => null);
      const lines: string[] = [];
      if (!raw) lines.push('Could not read the database at all.');
      else {
        for (const [cid, cd] of Object.entries(raw.clientData ?? {})) {
          const pp = (cd as { previewPosts?: { shareId?: string; updatedAt?: string }[] }).previewPosts ?? [];
          if (pp.length) lines.push(`${cid}: ${pp.length} previews, newest ${pp[pp.length - 1]?.updatedAt?.slice(0, 16) ?? '?'}`);
        }
        if (lines.length === 0) lines.push('No profile in the store holds any preview at all.');
        lines.push(`This link (…${params.shareId.slice(-6)}) is not among them.`);
      }
      return (
        <div className="min-h-screen bg-[#fafafa] flex flex-col items-center justify-center p-6 text-center">
          <p className="font-semibold text-[#262626] mb-1">This preview isn&apos;t available</p>
          <p className="text-sm text-[#8e8e8e] mb-4">Only you can see the lines below. Screenshot them.</p>
          {lines.map((l, i) => <p key={i} className="text-xs font-mono text-[#555]">{l}</p>)}
        </div>
      );
    }
    return <NotAvailable dbError={dbError} debug={await previewDebugLine(params.shareId)} />;
  }

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
function NotAvailable({ dbError, debug }: { dbError: boolean; debug?: string }) {
  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-14 h-14 rounded-full border-2 border-stone-300 flex items-center justify-center mb-4">
        <Instagram size={26} className="text-stone-400" />
      </div>
      <p className="font-semibold text-[#262626] mb-1">This preview isn&apos;t available</p>
      <p className="text-sm text-[#8e8e8e]">
        {dbError
          ? 'This preview could not be loaded. Please try again in a moment.'
          : 'The link may be incorrect, or the post was removed.'}
      </p>
      {/* Counts and clock times only: the invisible fact line that ended the
          guessing of 2026-08-09. Harmless to the public, gold in a curl. */}
      {debug && <span data-d={debug} className="hidden" />}
    </div>
  );
}
