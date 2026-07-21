import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { authConfigured, verifyToken, SESSION_COOKIE } from '@/lib/auth';

// Quick Add (spec 18 part C): picks the observation topic for an untagged
// note. AI reads it against her existing topics; without a key or on any
// failure the answer is "Inbox" and she sorts it later. Owner-only — the
// Quick Add screen is an owner surface.

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

function currentRole() {
  if (!authConfigured()) return 'owner';
  const token = cookies().get(SESSION_COOKIE)?.value;
  return verifyToken(token);
}

export async function POST(req: Request) {
  const role = currentRole();
  if (role !== 'owner') return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const text = String(body?.text ?? '').slice(0, 2000);
  const topics: string[] = Array.isArray(body?.topics) ? body.topics.slice(0, 50).map(String) : [];
  if (!text.trim()) return NextResponse.json({ error: 'empty' }, { status: 400 });

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return NextResponse.json({ topic: 'Inbox' });

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
    if (!res.ok) return NextResponse.json({ topic: 'Inbox' });
    const data = await res.json();
    if (data.stop_reason === 'refusal') return NextResponse.json({ topic: 'Inbox' });
    const block = (data.content ?? []).find((b: { type: string }) => b.type === 'text');
    const topic = block?.text ? String(JSON.parse(block.text).topic ?? '').trim() : '';
    return NextResponse.json({ topic: topic && topic.length <= 40 ? topic : 'Inbox' });
  } catch {
    return NextResponse.json({ topic: 'Inbox' });
  }
}
