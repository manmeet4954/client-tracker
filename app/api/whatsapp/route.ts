import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { readState, writeStateScoped, uploadToStorage } from '@/lib/supabaseServer';
import { changedScopes } from '@/lib/tree/scopes';
import { normalizeState } from '@/lib/access';
import {
  decide, applyMyTask, applyClientTask, applyObservation, applyPhoto,
  existingTopics, type Applied,
} from '@/lib/whatsappInbox';
import type { AppState } from '@/types';

// The WhatsApp inbox (Spec 18 part B). Meta's WhatsApp Business platform
// forwards every message sent to the Dashboard's dedicated number here.
// Routing lives in lib/whatsappInbox.ts; this file only does the Meta I/O.
//
// Security model:
// - GET is Meta's one-time webhook verification (shared verify token).
// - POST payloads are checked against the app-secret signature when
//   WHATSAPP_APP_SECRET is set (recommended — see docs/spec-18-setup.md).
// - Only senders listed in WHATSAPP_OWNER_NUMBERS are heard. Anyone else
//   texting the number is ignored completely: no reply, no state touch.
// - Tokens live in env vars server-side, never in the browser (house rule,
//   same as the Instagram tokens).

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const GRAPH = 'https://graph.facebook.com/v23.0';

function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
}

/** Digits-only comparison so "+91 98..." and "9198..." match. */
function isOwnerNumber(from: string): boolean {
  const allowed = (env('WHATSAPP_OWNER_NUMBERS') ?? '').split(',');
  const f = from.replace(/\D/g, '');
  return allowed.some(a => {
    const digits = a.replace(/\D/g, '');
    return digits.length > 0 && f === digits;
  });
}

// ── Meta webhook verification (GET) ─────────────────────────────────────────

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');
  const expected = env('WHATSAPP_VERIFY_TOKEN');
  if (mode === 'subscribe' && expected && token === expected && challenge) {
    return new Response(challenge, { status: 200 });
  }
  return NextResponse.json({ error: 'verification-failed' }, { status: 403 });
}

// ── Incoming messages (POST) ────────────────────────────────────────────────

interface MetaMessage {
  id: string;
  from: string;
  type: string;
  text?: { body: string };
  image?: { id: string; caption?: string; mime_type?: string };
}

function extractMessages(payload: unknown): MetaMessage[] {
  const out: MetaMessage[] = [];
  const entries = (payload as { entry?: unknown[] })?.entry ?? [];
  for (const entry of entries) {
    const changes = (entry as { changes?: unknown[] })?.changes ?? [];
    for (const change of changes) {
      const value = (change as { value?: { messages?: MetaMessage[] } })?.value;
      for (const m of value?.messages ?? []) out.push(m);
      // value.statuses (delivery receipts) are deliberately ignored.
    }
  }
  return out;
}

async function sendReply(to: string, body: string): Promise<void> {
  const token = env('WHATSAPP_ACCESS_TOKEN');
  const phoneId = env('WHATSAPP_PHONE_NUMBER_ID');
  if (!token || !phoneId) return;
  await fetch(`${GRAPH}/${phoneId}/messages`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body } }),
  }).catch(e => console.error('[whatsapp] reply failed:', e));
}

/** Download a WhatsApp media object and re-host it in the assets bucket. */
async function fetchAndHostMedia(mediaId: string, mime: string): Promise<{ url: string; size: number } | null> {
  const token = env('WHATSAPP_ACCESS_TOKEN');
  if (!token) return null;
  const meta = await fetch(`${GRAPH}/${mediaId}`, {
    headers: { authorization: `Bearer ${token}` },
  }).then(r => (r.ok ? r.json() : null)).catch(() => null);
  if (!meta?.url) return null;
  const bytes = await fetch(meta.url, { headers: { authorization: `Bearer ${token}` } })
    .then(r => (r.ok ? r.arrayBuffer() : null)).catch(() => null);
  if (!bytes) return null;
  const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
  try {
    const url = await uploadToStorage('assets', bytes, mime, ext);
    return { url, size: bytes.byteLength };
  } catch (e) {
    console.error('[whatsapp] media upload failed:', e);
    return null;
  }
}

/** Ask Claude which observation topic an untagged note belongs to. Existing
 *  topics are the preferred choices; a new short topic is allowed when none
 *  fit. No key or any failure → "Inbox" (she sorts it later). */
async function aiPickTopic(text: string, topics: string[]): Promise<string> {
  const apiKey = env('ANTHROPIC_API_KEY');
  if (!apiKey) return 'Inbox';
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 128,
        output_config: {
          format: {
            type: 'json_schema',
            schema: {
              type: 'object',
              properties: { topic: { type: 'string' } },
              required: ['topic'],
              additionalProperties: false,
            },
          },
        },
        messages: [{
          role: 'user',
          content:
            `A designer keeps a private notebook of observations, filed under topic buckets. ` +
            `Her existing topics: ${topics.length ? topics.join(', ') : '(none yet)'}.\n\n` +
            `File this new note under the best-fitting EXISTING topic. Only if none fit, ` +
            `invent one short new topic name (1-3 plain words, Title Case). Never invent ` +
            `when an existing topic fits.\n\nThe note:\n${text}`,
        }],
      }),
    });
    if (!res.ok) return 'Inbox';
    const data = await res.json();
    if (data.stop_reason === 'refusal') return 'Inbox';
    const block = (data.content ?? []).find((b: { type: string }) => b.type === 'text');
    const topic = block?.text ? String(JSON.parse(block.text).topic ?? '').trim() : '';
    return topic && topic.length <= 40 ? topic : 'Inbox';
  } catch {
    return 'Inbox';
  }
}

export async function POST(req: Request) {
  const raw = await req.text();

  // Signature check (when the app secret is configured).
  const secret = env('WHATSAPP_APP_SECRET');
  if (secret) {
    const header = req.headers.get('x-hub-signature-256') ?? '';
    const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(raw).digest('hex');
    const a = Buffer.from(header);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return NextResponse.json({ error: 'bad-signature' }, { status: 401 });
    }
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: true }); // not for us; never make Meta retry
  }

  const messages = extractMessages(payload).filter(m => isOwnerNumber(m.from));
  if (messages.length === 0) return NextResponse.json({ ok: true });

  let state = await readState();
  // The untouched copy the CAS write diffs against (2026-08-09).
  const stateAsRead = state;
  if (!state) {
    // Nothing to write into — say so instead of silently dropping her note.
    await sendReply(messages[0].from, 'The dashboard could not be reached. Your message was NOT saved — try again in a bit.');
    return NextResponse.json({ ok: true });
  }
  state = normalizeState(state);
  let dirty = false;

  for (const m of messages) {
    let applied: Applied | null = null;
    let reply = '';

    if (m.type === 'text' && m.text?.body) {
      const d = decide(state, m.text.body, false);
      if (d.kind === 'ask') reply = d.reply;
      else if (d.kind === 'my-task') applied = applyMyTask(state, d.text);
      else if (d.kind === 'client-task') applied = applyClientTask(state, d.client, d.text);
      else if (d.kind === 'observation') applied = applyObservation(state, d.topic, d.text, d.clientId);
      else if (d.kind === 'needs-ai-topic') {
        const topic = await aiPickTopic(d.text, existingTopics(state));
        applied = applyObservation(state, topic, d.text, undefined);
        applied.reply = topic === 'Inbox'
          ? 'Noted under Inbox — tag it with a topic later.'
          : `Noted under ${topic}.`;
      }
    } else if (m.type === 'image' && m.image?.id) {
      const d = decide(state, m.image.caption ?? '', true);
      if (d.kind === 'ask') reply = d.reply;
      else if (d.kind === 'photo') {
        const hosted = await fetchAndHostMedia(m.image.id, m.image.mime_type ?? 'image/jpeg');
        if (!hosted) reply = 'The photo could not be pulled from WhatsApp. It was NOT saved — try sending it again.';
        else applied = applyPhoto(state, d.client, hosted.url, hosted.size, d.caption);
      }
    } else {
      reply = 'Only text and photos land in the dashboard for now.';
    }

    if (applied) {
      state = applied.state;
      dirty = true;
      reply = applied.reply;
    }
    if (reply) await sendReply(m.from, reply);
  }

  if (dirty) {
    try {
      await writeStateScoped(state, changedScopes(stateAsRead, state));
    } catch (e) {
      console.error('[whatsapp] writeState failed:', e);
      await sendReply(messages[0].from, 'Saving failed on the dashboard side. Your last message was NOT saved.');
    }
  }
  return NextResponse.json({ ok: true });
}
