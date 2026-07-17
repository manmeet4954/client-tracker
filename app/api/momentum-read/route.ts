import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { authConfigured, verifyToken, SESSION_COOKIE } from '@/lib/auth';

// Reads a Momentum diary entry and decides which effort chips it describes
// (spec 11 v1.1). AI does the reading (her decision, 2026-07-17); if the AI
// key is missing or the call fails, plain word matching takes over so the
// diary never breaks. Posting is never inferred here — the board counts it.

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const ACTION_IDS = ['story', 'engaged', 'dms', 'outreach', 'other'] as const;

// Fallback reader: obvious words only. Better to under-tick (she can tap)
// than to invent effort she did not log.
function wordMatch(text: string): string[] {
  const t = text.toLowerCase();
  const out = new Set<string>();
  if (/\bstor(y|ies)\b/.test(t)) out.add('story');
  if (/\b(comment|repl(y|ied|ies|ying)|engag)/.test(t)) out.add('engaged');
  if (/\bdm(s|ed|'d)?\b|direct message/.test(t)) out.add('dms');
  if (/\b(outreach|reached out|pitch|collab|emailed|cold)/.test(t)) out.add('outreach');
  if (out.size === 0 && t.trim().length > 0) out.add('other');
  return Array.from(out);
}

async function aiRead(text: string, apiKey: string): Promise<string[] | null> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-8',
      max_tokens: 256,
      output_config: {
        format: {
          type: 'json_schema',
          schema: {
            type: 'object',
            properties: {
              actions: {
                type: 'array',
                items: { type: 'string', enum: [...ACTION_IDS] },
              },
            },
            required: ['actions'],
            additionalProperties: false,
          },
        },
      },
      messages: [{
        role: 'user',
        content:
          `A content creator wrote a short diary entry about what she did today for her Instagram account. ` +
          `Decide which of these effort categories the entry actually describes doing:\n` +
          `- "story": posted or made Instagram stories\n` +
          `- "engaged": replied to comments, answered people, engaged with other accounts' posts\n` +
          `- "dms": sent or answered direct messages\n` +
          `- "outreach": reached out to people, pitched, emailed, cold contacted, worked on collabs\n` +
          `- "other": any other real work for the account (writing ideas, planning, designing, editing, research)\n\n` +
          `Only include categories the entry says she DID. Plans and intentions for tomorrow do not count. ` +
          `Publishing a post or reel is tracked elsewhere; never map it to these categories on its own. ` +
          `If the entry describes doing work that fits no specific category, use "other". ` +
          `If it describes no work at all, return an empty list.\n\n` +
          `The diary entry:\n${text}`,
      }],
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (data.stop_reason === 'refusal') return null;
  const textBlock = (data.content ?? []).find((b: { type: string }) => b.type === 'text');
  if (!textBlock?.text) return null;
  try {
    const parsed = JSON.parse(textBlock.text);
    if (!Array.isArray(parsed.actions)) return null;
    return parsed.actions.filter((a: string) => (ACTION_IDS as readonly string[]).includes(a));
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  if (authConfigured()) {
    const role = verifyToken(cookies().get(SESSION_COOKIE)?.value);
    if (role !== 'owner') return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const text = typeof body?.text === 'string' ? body.text.trim() : '';
  if (!text) return NextResponse.json({ actions: [], source: 'empty' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    try {
      const actions = await aiRead(text, apiKey);
      if (actions !== null) return NextResponse.json({ actions, source: 'ai' });
    } catch { /* fall through to word matching */ }
  }
  return NextResponse.json({ actions: wordMatch(text), source: 'words' });
}
