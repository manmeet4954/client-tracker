import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { authConfigured, verifyToken, SESSION_COOKIE } from '@/lib/auth';
import type { Role } from '@/lib/access';

// Next caches fetch() by URL and supabase-js rides on fetch; long-lived query
// URLs get served from the data cache at random. That one behavior ate previews
// for eight days (see lib/supabaseServer.ts). Every server client pins no-store.
const noStoreFetch: typeof fetch = (input, init) => fetch(input, { ...init, cache: 'no-store' });


// Spec 06: the reading layer. Reads each fetched Instagram post's actual
// content (carousel slides + caption; reel cover + caption) and tags it with
// the locked tag list. Runs after the nightly sync (see vercel.json), or
// manually with ?secret=CRON_SECRET.
//
// Trust rules baked in:
// - the AI only tags and summarizes content; it never touches metrics
// - owner corrections are sticky: a re-run NEVER overwrites a corrected field
// - no faked transcripts: reels get transcript null with a 'no-transcript'
//   marker, because there is no audio transcription path here (honesty rule)
// - cost is bounded: already-tagged posts are skipped, each run tags at most
//   a small batch, one Claude call per post, capped image count

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const GRAPH = 'https://graph.instagram.com/v23.0';

// Model choice: claude-sonnet-5. This is cost-sensitive batch work
// (classification + short summary per post, run nightly), not deep reasoning,
// so the Sonnet tier is the right price point and it is vision-capable.
const MODEL = 'claude-sonnet-5';

// Cost bounds per run.
const DEFAULT_BATCH = 6;   // posts tagged per run by default (fits the 60s limit)
const MAX_BATCH = 20;      // hard cap, even when ?limit= asks for more
const MAX_IMAGES = 6;      // carousel slides sent to the model per post
const MAX_TOKENS = 1500;   // output cap per call (tags + slide text + summary)

// The LOCKED tag list (Manmeet, 2026-07-13). Do not add or rename values.
const TAG_OPTIONS: Record<string, string[]> = {
  topic_type: ['how-to', 'story', 'myth-busting', 'fear-based', 'listicle', 'proof-win', 'trend', 'other'],
  hook_type: ['question', 'bold-claim', 'story-open', 'statistic', 'pain-point', 'other'],
  close_type: ['cta-close', 'punchline', 'summary', 'open-loop', 'other'],
  cta_type: ['comment', 'dm', 'link', 'save-share', 'follow', 'none'],
  caption_style: ['short', 'long', 'storytelling', 'list'],
};
const BOOLEAN_FIELDS = ['has_face', 'trending_audio'];
const CORRECTABLE_FIELDS = [...Object.keys(TAG_OPTIONS), ...BOOLEAN_FIELDS];

// Structured output schema: the model must answer with exactly this shape.
const TAG_SCHEMA = {
  type: 'object',
  properties: {
    topic_type: { type: 'string', enum: TAG_OPTIONS.topic_type },
    hook_type: { type: 'string', enum: TAG_OPTIONS.hook_type },
    close_type: { type: 'string', enum: TAG_OPTIONS.close_type },
    cta_type: { type: 'string', enum: TAG_OPTIONS.cta_type },
    caption_style: { type: 'string', enum: TAG_OPTIONS.caption_style },
    has_face: { anyOf: [{ type: 'boolean' }, { type: 'null' }] },
    trending_audio: { anyOf: [{ type: 'boolean' }, { type: 'null' }] },
    transcript: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    summary: { type: 'string' },
  },
  required: ['topic_type', 'hook_type', 'close_type', 'cta_type', 'caption_style',
    'has_face', 'trending_audio', 'transcript', 'summary'],
  additionalProperties: false,
};

const SYSTEM_PROMPT = `You tag Instagram posts for a content dashboard. You classify how a post is built: its topic type, how it opens (the hook), how it ends (the close), and what it asks the viewer to do (the CTA). You describe only what is actually in the caption and images given to you. You never guess at anything you cannot see or hear, and you never invent numbers, metrics, or performance claims. Answer with the JSON object only.`;

// Lazy so a missing env var can never crash the build, only this route at
// runtime (same pattern as ig-sync). Service role key required: ig_* tables
// keep RLS on with no policies.
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase env vars missing');
  return createClient(url, key, { global: { fetch: noStoreFetch } });
}

// Same lazy never-crash-the-build pattern for the Anthropic client.
function getAnthropic(): Anthropic | null {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  return new Anthropic({ apiKey: key });
}

function currentRole(): Role | null {
  if (!authConfigured()) return 'owner'; // open mode
  const token = cookies().get(SESSION_COOKIE)?.value;
  return verifyToken(token);
}

// ── media fetching ───────────────────────────────────────────────────────────

type PostRow = {
  id: string; account_id: string; caption: string | null;
  media_type: string | null; media_product_type: string | null; posted_at: string | null;
};

type FetchedImage = { media_type: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'; data: string };

function isReel(p: PostRow): boolean {
  return p.media_product_type === 'REELS' || p.media_type === 'VIDEO';
}

function formatWord(p: PostRow): 'reel' | 'carousel' | 'image' {
  if (isReel(p)) return 'reel';
  if (p.media_type === 'CAROUSEL_ALBUM') return 'carousel';
  return 'image';
}

// The sync pipe does not store media URLs (they expire), so the tagging job
// asks the Graph API for them at tag time using the account's stored token.
async function mediaImageUrls(post: PostRow, token: string): Promise<string[]> {
  const url = new URL(`${GRAPH}/${post.id}`);
  url.searchParams.set('fields', 'media_type,media_url,thumbnail_url,children{media_type,media_url,thumbnail_url}');
  url.searchParams.set('access_token', token);
  const data = await fetch(url, { cache: 'no-store' }).then(r => r.json());
  if (data.error) throw new Error(`media fields: ${data.error.message}`);

  const urls: string[] = [];
  if (data.children?.data?.length) {
    for (const child of data.children.data) {
      // Video slides only have a thumbnail; image slides have media_url.
      const u = child.media_type === 'VIDEO' ? child.thumbnail_url : child.media_url;
      if (u) urls.push(u);
    }
  } else {
    const u = data.media_type === 'VIDEO' ? data.thumbnail_url : data.media_url;
    if (u) urls.push(u);
  }
  return urls.slice(0, MAX_IMAGES);
}

// Download each image and base64 it for the vision call. Failures are
// skipped, not fatal: the model can still tag from the caption.
async function fetchImages(urls: string[]): Promise<FetchedImage[]> {
  const out: FetchedImage[] = [];
  for (const u of urls) {
    try {
      const res = await fetch(u, { cache: 'no-store' });
      if (!res.ok) continue;
      const ct = res.headers.get('content-type') ?? '';
      const media_type = ct.includes('png') ? 'image/png'
        : ct.includes('webp') ? 'image/webp'
        : ct.includes('gif') ? 'image/gif'
        : 'image/jpeg';
      const buf = Buffer.from(await res.arrayBuffer());
      out.push({ media_type, data: buf.toString('base64') });
    } catch { /* skip this image */ }
  }
  return out;
}

// ── the tagging call ─────────────────────────────────────────────────────────

type TagResult = {
  topic_type: string | null; hook_type: string | null; close_type: string | null;
  cta_type: string | null; caption_style: string | null;
  has_face: boolean | null; trending_audio: boolean | null;
  transcript: string | null; summary: string | null;
};

function buildUserText(post: PostRow, imageCount: number): string {
  const format = formatWord(post);
  const lines: string[] = [];
  lines.push(`Post format: ${format}.`);
  if (format === 'reel') {
    lines.push(`You are given only the reel's cover image${imageCount === 0 ? ' (unavailable this time)' : ''} and its caption. You cannot see the video or hear the audio.`);
    lines.push('Because you cannot hear the reel: set transcript to null (do NOT reconstruct or guess a script), and set trending_audio to null unless the caption itself explicitly names the audio as trending or original.');
  } else if (format === 'carousel') {
    lines.push(`You are given the carousel slides in order (${imageCount} image${imageCount === 1 ? '' : 's'}) and the caption.`);
    lines.push('Read the slides. Set transcript to the text written on the slides, in order, one slide per paragraph. If the slides carry no readable text, set transcript to null.');
    lines.push('trending_audio does not apply to carousels: set it to null.');
  } else {
    lines.push('You are given the post image and its caption.');
    lines.push('If the image carries readable text, set transcript to that text; otherwise null.');
    lines.push('trending_audio does not apply: set it to null.');
  }
  lines.push('has_face: true if a human face is clearly visible in the images, false if clearly not, null if you cannot tell (for example, no images were provided).');
  lines.push('Judge the hook from how the content OPENS (first slide or first caption line), the close from how it ENDS, and cta_type from what the post explicitly asks the viewer to do (comment, DM, tap the link, save or share, follow); use "none" when it asks nothing.');
  lines.push('caption_style describes the caption only: short (a few lines), long (extended), storytelling (narrative), or list (bullet or numbered).');
  lines.push('summary: one plain sentence saying what the post is about.');
  lines.push('');
  lines.push(post.caption ? `Caption:\n${post.caption}` : 'Caption: (none)');
  return lines.join('\n');
}

async function tagPost(
  anthropic: Anthropic, post: PostRow, images: FetchedImage[],
): Promise<TagResult> {
  const content: Anthropic.ContentBlockParam[] = images.map(img => ({
    type: 'image' as const,
    source: { type: 'base64' as const, media_type: img.media_type, data: img.data },
  }));
  content.push({ type: 'text', text: buildUserText(post, images.length) });

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    // Thinking off: this is a bounded classification task; keeping thinking
    // disabled keeps per-post cost and latency low. (Sonnet 5 rejects
    // non-default temperature, so determinism is steered by the prompt and
    // the strict output schema instead.)
    thinking: { type: 'disabled' },
    output_config: { format: { type: 'json_schema', schema: TAG_SCHEMA } },
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content }],
  });

  if (response.stop_reason === 'refusal') throw new Error('model declined to tag this post');
  const text = response.content.find(b => b.type === 'text');
  if (!text || text.type !== 'text') throw new Error('no text in model response');
  const raw = JSON.parse(text.text) as Record<string, unknown>;

  // Validate against the locked list; anything off-list becomes null rather
  // than polluting the table.
  const pick = (field: string): string | null => {
    const v = raw[field];
    return typeof v === 'string' && TAG_OPTIONS[field].includes(v) ? v : null;
  };
  const bool = (field: string): boolean | null =>
    typeof raw[field] === 'boolean' ? (raw[field] as boolean) : null;

  const result: TagResult = {
    topic_type: pick('topic_type'),
    hook_type: pick('hook_type'),
    close_type: pick('close_type'),
    cta_type: pick('cta_type'),
    caption_style: pick('caption_style'),
    has_face: bool('has_face'),
    trending_audio: bool('trending_audio'),
    transcript: typeof raw.transcript === 'string' && raw.transcript.trim() ? raw.transcript : null,
    summary: typeof raw.summary === 'string' && raw.summary.trim() ? raw.summary : null,
  };

  // Honesty guard: there is no audio transcription path, so a reel can never
  // carry a transcript, whatever the model returned.
  if (isReel(post)) result.transcript = null;
  return result;
}

// ── GET: the tagging run (cron secret) ───────────────────────────────────────

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');
  const qs = req.nextUrl.searchParams.get('secret');
  if (!secret || (auth !== `Bearer ${secret}` && qs !== secret)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const anthropic = getAnthropic();
  if (!anthropic) {
    return NextResponse.json({ status: 'tagging not configured', hint: 'set ANTHROPIC_API_KEY' });
  }

  const requested = Number(req.nextUrl.searchParams.get('limit')) || DEFAULT_BATCH;
  const batch = Math.min(Math.max(1, requested), MAX_BATCH);

  const supabase = getSupabase();
  const errors: string[] = [];

  // 1. Which posts already have tags? (Idempotent: tagged posts are skipped.)
  const { data: taggedRows, error: taggedErr } = await supabase
    .from('ig_post_tags').select('ig_media_id');
  if (taggedErr) return NextResponse.json({ error: `read tags: ${taggedErr.message}` }, { status: 500 });
  const tagged = new Set((taggedRows ?? []).map(r => r.ig_media_id));

  // 2. Newest untagged posts first, up to the batch cap.
  const { data: postRows, error: postErr } = await supabase
    .from('ig_posts')
    .select('id, account_id, caption, media_type, media_product_type, posted_at')
    .order('posted_at', { ascending: false });
  if (postErr) return NextResponse.json({ error: `read posts: ${postErr.message}` }, { status: 500 });
  const todo = ((postRows ?? []) as PostRow[]).filter(p => !tagged.has(p.id)).slice(0, batch);

  if (!todo.length) {
    return NextResponse.json({ tagged: 0, remaining: 0, errors });
  }

  // 3. Account tokens for media URL lookups.
  const { data: accounts, error: accErr } = await supabase
    .from('ig_accounts').select('id, access_token');
  if (accErr) return NextResponse.json({ error: `read accounts: ${accErr.message}` }, { status: 500 });
  const tokenByAccount = new Map((accounts ?? []).map(a => [a.id, a.access_token as string]));

  // 4. One post at a time: fetch media, one Claude call, upsert. A failure on
  //    one post never blocks the rest.
  let done = 0;
  for (const post of todo) {
    try {
      const token = tokenByAccount.get(post.account_id);
      let images: FetchedImage[] = [];
      if (token) {
        try {
          images = await fetchImages(await mediaImageUrls(post, token));
        } catch (e: any) {
          errors.push(`${post.id} media: ${e.message}`);
        }
      } else {
        errors.push(`${post.id}: no token for account ${post.account_id}`);
      }

      const tags = await tagPost(anthropic, post, images);
      const transcript_source = tags.transcript
        ? 'carousel-text'
        : 'no-transcript';

      // Sticky corrections: if a row exists (a deliberate re-run), fields the
      // owner corrected keep their corrected values.
      const { data: existing } = await supabase
        .from('ig_post_tags')
        .select('*')
        .eq('ig_media_id', post.id)
        .maybeSingle();

      const row: Record<string, unknown> = {
        ig_media_id: post.id,
        ...tags,
        transcript_source,
        corrected: existing?.corrected ?? [],
        model: MODEL,
        tagged_at: new Date().toISOString(),
      };
      if (existing && Array.isArray(existing.corrected)) {
        for (const field of existing.corrected) {
          if (typeof field === 'string' && field in row) row[field] = existing[field];
        }
      }

      const { error: upErr } = await supabase.from('ig_post_tags').upsert(row);
      if (upErr) errors.push(`${post.id} upsert: ${upErr.message}`);
      else done++;
    } catch (e: any) {
      errors.push(`${post.id}: ${e.message}`);
    }
  }

  const remaining = (postRows ?? []).length - tagged.size - done;
  return NextResponse.json({ tagged: done, remaining, model: MODEL, errors });
}

// ── POST: owner correction (sticky) ──────────────────────────────────────────
// Body: { action: 'correct', igMediaId, field, value }
// Role-checked server side, exactly like app/api/ig-accounts: only the owner
// can correct a tag. The corrected field name is recorded so re-runs of the
// tagging job never overwrite it.

export async function POST(req: Request) {
  const role = currentRole();
  if (!role) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (role !== 'owner') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (!body || body.action !== 'correct') {
    return NextResponse.json({ error: 'bad-request' }, { status: 400 });
  }

  const { igMediaId, field, value } = body as { igMediaId?: string; field?: string; value?: unknown };
  if (typeof igMediaId !== 'string' || !igMediaId || typeof field !== 'string'
    || !CORRECTABLE_FIELDS.includes(field)) {
    return NextResponse.json({ error: 'bad-request' }, { status: 400 });
  }

  // Value must be on the locked list (or null to clear), never free text.
  let clean: string | boolean | null;
  if (value === null) {
    clean = null;
  } else if (BOOLEAN_FIELDS.includes(field)) {
    if (typeof value !== 'boolean') return NextResponse.json({ error: 'bad-value' }, { status: 400 });
    clean = value;
  } else {
    if (typeof value !== 'string' || !TAG_OPTIONS[field].includes(value)) {
      return NextResponse.json({ error: 'bad-value' }, { status: 400 });
    }
    clean = value;
  }

  try {
    const supabase = getSupabase();
    const { data: existing, error: readErr } = await supabase
      .from('ig_post_tags')
      .select('ig_media_id, corrected')
      .eq('ig_media_id', igMediaId)
      .maybeSingle();
    if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 });
    if (!existing) return NextResponse.json({ error: 'not-found' }, { status: 404 });

    const corrected: string[] = Array.isArray(existing.corrected)
      ? existing.corrected.filter((f: unknown): f is string => typeof f === 'string')
      : [];
    if (!corrected.includes(field)) corrected.push(field);

    const { error: upErr } = await supabase
      .from('ig_post_tags')
      .update({ [field]: clean, corrected })
      .eq('ig_media_id', igMediaId);
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

    return NextResponse.json({ ok: true, field, value: clean, corrected });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'correction failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
