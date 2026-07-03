import type { Metadata } from 'next';
import { Instagram } from 'lucide-react';
import { findPreviewPost } from '@/lib/supabaseServer';
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

async function lookup(shareId: string): Promise<Found | null> {
  return demoPost(shareId) ?? await findPreviewPost(shareId);
}

export async function generateMetadata({ params }: { params: { shareId: string } }): Promise<Metadata> {
  const found = await lookup(params.shareId);
  if (!found) return { title: 'Preview not found' };
  const handle = found.instagram.handle || 'Instagram';
  return {
    title: `@${handle} · post preview`,
    description: found.post.caption.slice(0, 150) || 'Instagram post preview',
    openGraph: { images: found.post.images[0] ? [found.post.images[0]] : [] },
  };
}

export default async function PreviewPage({ params }: { params: { shareId: string } }) {
  const found = await lookup(params.shareId);

  if (!found) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-14 h-14 rounded-full border-2 border-stone-300 flex items-center justify-center mb-4">
          <Instagram size={26} className="text-stone-400" />
        </div>
        <p className="font-semibold text-[#262626] mb-1">This preview isn&apos;t available</p>
        <p className="text-sm text-[#8e8e8e]">The link may be incorrect, or the post was removed.</p>
      </div>
    );
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
