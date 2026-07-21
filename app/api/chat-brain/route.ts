import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { authConfigured, verifyToken, SESSION_COOKIE } from '@/lib/auth';

// The Dashboard chat's brain (spec 18 part C v3). Every non-shortcut message
// comes here: Claude reads it WITH context (her clients, her observation
// topics, the board's unposted cards, the recent conversation) and returns
// ONE structured decision the widget then executes. The AI never touches
// state itself — the widget validates every id against real data first.
//
// Owner-only. Without an ANTHROPIC_API_KEY the answer is {action:'fallback'}
// and the widget uses the old hashtag rules, so the chat never breaks.

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

function currentRole() {
  if (!authConfigured()) return 'owner';
  const token = cookies().get(SESSION_COOKIE)?.value;
  return verifyToken(token);
}

interface BrainRequest {
  message: string;
  hasPhoto: boolean;
  clients: { id: string; name: string }[];
  topics: string[];
  cards: { clientId: string; cardId: string; title: string; stage: string }[];
  recent: { who: string; text: string }[];
}

export async function POST(req: Request) {
  const role = currentRole();
  if (role !== 'owner') return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as BrainRequest | null;
  if (!body?.message && !body?.hasPhoto) return NextResponse.json({ error: 'empty' }, { status: 400 });

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return NextResponse.json({ action: 'fallback' });

  const clients = (body.clients ?? []).slice(0, 30);
  const topics = (body.topics ?? []).slice(0, 50);
  const cards = (body.cards ?? []).slice(0, 80);
  const recent = (body.recent ?? []).slice(-8).map(r => ({
    who: r.who === 'me' ? 'Manmeet' : 'Dashboard',
    text: String(r.text).slice(0, 200),
  }));

  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  const prompt =
`You are the brain of Manmeet's dashboard chat. She runs a personal-branding studio; the dashboard tracks her clients, content boards, tasks, and her private observation notebook. She types short natural messages; you decide the ONE thing to do and write the one-line reply she sees. Today is ${today}.

HER CLIENTS (the only valid clientId values):
${clients.map(c => `- ${c.id}: ${c.name}`).join('\n') || '(none)'}

HER OBSERVATION TOPICS so far (buckets in her notebook; prefer reusing one; new short topics are allowed — a topic is the SUBJECT observed: a person, client, or theme):
${topics.join(', ') || '(none yet)'}

UNPOSTED CONTENT CARDS on the boards (the only valid cardId values for mark_posted):
${cards.map(k => `- ${k.cardId} [client ${k.clientId}, stage ${k.stage}]: ${k.title}`).join('\n') || '(none)'}

RECENT CONVERSATION (oldest first):
${recent.map(r => `${r.who}: ${r.text}`).join('\n') || '(none)'}

HER NEW MESSAGE${body.hasPhoto ? ' (a photo is attached)' : ''}:
${body.message || '(no text, photo only)'}

Pick exactly one action:
- add_my_task: a to-do for herself. text = the task, cleaned.
- add_client_task: a to-do/instruction for one client's agenda. clientId + text.
- add_observation: something she noticed and wants recorded long-term. topic = the SUBJECT (person like "Shivansh", a client name, or a theme like "Reels" — never words like "observation"/"note"). text = the observation itself, command words stripped ("save this as..." dropped), her meaning kept in plain words.
- file_photo: only when a photo is attached and you can tell which client it belongs to. clientId.
- mark_posted: she says some content went live / is posted. Pick the matching card from the list above (match by title words and client). clientId + cardId.
- reply: everything else — answering her question (use the recent conversation), asking ONE short clarifying question when you cannot safely act (wrong/missing client, no matching card, ambiguous), or honestly saying what you cannot do yet.

Rules:
- Never invent a clientId or cardId that is not in the lists. When unsure, use reply and ask.
- reply text is ALWAYS required: one or two short plain lines, no jargon. For actions, phrase it like "Done - noted under Shivansh." / "Marked 'title' as posted on X's board." For questions/clarifications just answer or ask.
- Questions like "where?" refer to the conversation above - answer from it.
- You can only do the actions listed. If she asks for anything else (edit, delete, schedule, analyze), say plainly that you cannot do that from the chat yet and where she can do it.`;

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
        max_tokens: 400,
        output_config: {
          format: {
            type: 'json_schema',
            schema: {
              type: 'object',
              properties: {
                action: {
                  type: 'string',
                  enum: ['add_my_task', 'add_client_task', 'add_observation', 'file_photo', 'mark_posted', 'reply'],
                },
                text: { type: 'string' },
                clientId: { type: 'string' },
                topic: { type: 'string' },
                cardId: { type: 'string' },
                reply: { type: 'string' },
              },
              required: ['action', 'reply'],
              additionalProperties: false,
            },
          },
        },
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) return NextResponse.json({ action: 'fallback' });
    const data = await res.json();
    if (data.stop_reason === 'refusal') return NextResponse.json({ action: 'fallback' });
    const block = (data.content ?? []).find((b: { type: string }) => b.type === 'text');
    if (!block?.text) return NextResponse.json({ action: 'fallback' });
    const parsed = JSON.parse(block.text);
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json({ action: 'fallback' });
  }
}
