'use client';

import { useRef, useState } from 'react';
import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal, ChevronLeft, ChevronRight, Instagram } from 'lucide-react';
import { PreviewPost, InstagramProfile } from '@/types';

/** Replica of an Instagram post: header, snap-scrolling carousel with the
 *  slide counter and dots, action row, caption with "more", and timestamp. */
export default function InstagramPost({ post, instagram }: {
  post: PreviewPost;
  instagram: InstagramProfile;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [burst, setBurst] = useState(false);
  // Carousels lock every slide to the first image's aspect ratio, clamped to
  // Instagram's limits (4:5 portrait … 1.91:1 landscape). Posts are produced
  // at 1080x1350, so 4:5 is the default before the first image loads.
  const [ratio, setRatio] = useState(1.25);

  const images = post.images;
  const total = images.length;
  const handle = instagram.handle || 'username';

  function onScroll() {
    const el = scroller.current;
    if (!el) return;
    setIdx(Math.min(total - 1, Math.max(0, Math.round(el.scrollLeft / el.clientWidth))));
  }

  function goTo(i: number) {
    const el = scroller.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
  }

  function onFirstImageLoad(img: HTMLImageElement) {
    if (!img.naturalWidth) return;
    const r = img.naturalHeight / img.naturalWidth;
    setRatio(Math.min(1.25, Math.max(0.5236, r))); // 4:5 … 1.91:1
  }

  function doubleTapLike() {
    setLiked(true);
    setBurst(true);
    setTimeout(() => setBurst(false), 900);
  }

  return (
    <article className="w-full bg-white sm:border sm:border-[#dbdbdb] sm:rounded-lg overflow-hidden select-none">
      {/* Header */}
      <header className="flex items-center gap-2.5 px-3 py-2.5">
        <PostAvatar url={instagram.avatarUrl} />
        <span className="text-sm font-semibold text-[#262626]">{handle}</span>
        <MoreHorizontal size={20} className="ml-auto text-[#262626]" />
      </header>

      {/* Media */}
      <div
        className="relative bg-black group"
        style={{ aspectRatio: `1 / ${ratio}` }}
        onDoubleClick={doubleTapLike}
      >
        <div
          ref={scroller}
          onScroll={onScroll}
          className="flex h-full w-full overflow-x-auto snap-x snap-mandatory no-scrollbar"
        >
          {images.map((url, i) => (
            <div key={`${url}-${i}`} className="w-full h-full shrink-0 snap-start">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`Slide ${i + 1} of ${total}`}
                draggable={false}
                onLoad={i === 0 ? e => onFirstImageLoad(e.currentTarget) : undefined}
                className="w-full h-full object-cover"
              />
            </div>
          ))}
        </div>

        {/* Slide counter */}
        {total > 1 && (
          <span className="absolute top-3 right-3 bg-[#262626]/80 text-white text-xs font-medium rounded-full px-2.5 py-1 pointer-events-none">
            {idx + 1}/{total}
          </span>
        )}

        {/* Desktop arrows */}
        {total > 1 && idx > 0 && (
          <button
            onClick={() => goTo(idx - 1)}
            className="hidden sm:flex absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 items-center justify-center rounded-full bg-white/90 shadow text-[#262626] opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="Previous slide"
          >
            <ChevronLeft size={18} />
          </button>
        )}
        {total > 1 && idx < total - 1 && (
          <button
            onClick={() => goTo(idx + 1)}
            className="hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 items-center justify-center rounded-full bg-white/90 shadow text-[#262626] opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="Next slide"
          >
            <ChevronRight size={18} />
          </button>
        )}

        {/* Double-tap heart burst */}
        {burst && (
          <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <Heart size={96} className="text-white fill-white drop-shadow-lg heart-burst" />
          </span>
        )}
      </div>

      {/* Action row */}
      <div className="relative flex items-center px-3 pt-2.5 pb-1.5">
        <div className="flex items-center gap-4">
          <button onClick={() => setLiked(l => !l)} aria-label="Like" className="active:scale-90 transition-transform">
            <Heart size={24} strokeWidth={1.8} className={liked ? 'text-[#ff3040] fill-[#ff3040]' : 'text-[#262626]'} />
          </button>
          <button aria-label="Comment">
            <MessageCircle size={24} strokeWidth={1.8} className="text-[#262626] -scale-x-100" />
          </button>
          <button aria-label="Share">
            <Send size={24} strokeWidth={1.8} className="text-[#262626]" />
          </button>
        </div>

        {/* Dots — centered over the whole row */}
        {total > 1 && (
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1">
            <Dots total={total} idx={idx} />
          </div>
        )}

        <button onClick={() => setSaved(s => !s)} aria-label="Save" className="ml-auto active:scale-90 transition-transform">
          <Bookmark size={24} strokeWidth={1.8} className={saved ? 'text-[#262626] fill-[#262626]' : 'text-[#262626]'} />
        </button>
      </div>

      {/* Caption */}
      <div className="px-3 pb-1">
        <Caption handle={handle} text={post.caption} />
      </div>

      {/* Timestamp */}
      <p className="px-3 pb-4 text-[11px] text-[#8e8e8e] uppercase tracking-wide">{timeAgo(post.createdAt)}</p>

      <style jsx global>{`
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        @keyframes heartBurst {
          0% { transform: scale(0); opacity: 0; }
          15% { transform: scale(1.15); opacity: 0.95; }
          30% { transform: scale(1); opacity: 0.95; }
          70% { transform: scale(1); opacity: 0.95; }
          100% { transform: scale(0.4); opacity: 0; }
        }
        .heart-burst { animation: heartBurst 0.9s ease forwards; }
      `}</style>
    </article>
  );
}

function PostAvatar({ url }: { url: string }) {
  return (
    <span className="w-8 h-8 rounded-full overflow-hidden bg-stone-200 flex items-center justify-center shrink-0 ring-1 ring-black/5">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="w-full h-full object-cover" />
      ) : (
        <Instagram size={15} className="text-stone-400" />
      )}
    </span>
  );
}

/** Instagram-style dot indicator: at most 5 dots visible, the window slides
 *  with the active slide and edge dots shrink when more slides exist beyond. */
function Dots({ total, idx }: { total: number; idx: number }) {
  const WINDOW = 5;
  const start = Math.min(Math.max(0, idx - 2), Math.max(0, total - WINDOW));
  const end = Math.min(total, start + WINDOW);
  const dots = [];
  for (let i = start; i < end; i++) {
    const isEdge = (i === start && start > 0) || (i === end - 1 && end < total);
    dots.push(
      <span
        key={i}
        className={`rounded-full transition-all duration-150 ${i === idx ? 'bg-[#0095f6]' : 'bg-[#c7c7c7]'}`}
        style={{ width: isEdge ? 4 : 6, height: isEdge ? 4 : 6 }}
      />
    );
  }
  return <>{dots}</>;
}

function Caption({ handle, text }: { handle: string; text: string }) {
  const [expanded, setExpanded] = useState(false);
  if (!text.trim()) return null;

  // Truncate like Instagram: cut long captions (or many lines) behind "more".
  const LIMIT = 125;
  let short = text;
  const lines = text.split('\n');
  if (lines.length > 2) short = lines.slice(0, 2).join('\n');
  if (short.length > LIMIT) short = short.slice(0, LIMIT).replace(/\s+\S*$/, '');
  const truncated = short.length < text.length;

  return (
    <p className="text-sm text-[#262626] whitespace-pre-wrap leading-[18px]">
      <span className="font-semibold mr-1.5">{handle}</span>
      {expanded || !truncated ? text : short}
      {truncated && !expanded && (
        <>
          {'... '}
          <button onClick={() => setExpanded(true)} className="text-[#8e8e8e]">more</button>
        </>
      )}
    </p>
  );
}

function timeAgo(iso: string): string {
  const seconds = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} week${weeks === 1 ? '' : 's'} ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}
