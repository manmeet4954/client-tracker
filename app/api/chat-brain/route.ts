import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { authConfigured, verifyToken, SESSION_COOKIE } from '@/lib/auth';

// The Dashboard chat's brain (spec 18 part C v4). Every non-shortcut message
// comes here: Claude reads it WITH context (her clients, her observation
// topics, the board's unposted cards, the recent conversation) and returns a
// LIST of actions — one per thing she asked for — plus an optional reply.
// The AI never touches state itself: the widget validates every id and
// executes each action. Design law (v4, her 07-22 feedback): DO the whole
// list in one message, don't interrogate; create real content cards; use
// sensible defaults instead of asking.
//
// Owner-only. Without an ANTHROPIC_API_KEY the answer is {fallback:true} and
// the widget uses the old hashtag rules, so the chat never breaks.

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
  if (!apiKey) return NextResponse.json({ fallback: true });

  const clients = (body.clients ?? []).slice(0, 30);
  const topics = (body.topics ?? []).slice(0, 50);
  const cards = (body.cards ?? []).slice(0, 80);
  const recent = (body.recent ?? []).slice(-8).map(r => ({
    who: r.who === 'me' ? 'Manmeet' : 'Dashboard',
    text: String(r.text).slice(0, 200),
  }));

  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  const prompt =
`You are the brain of Manmeet's dashboard chat. She runs a personal-branding studio; the dashboard tracks her clients, their content boards, her tasks, and her private observation notebook. She types short natural messages, often several things at once. Read the WHOLE message and turn EVERY thing she asks for into an action. Do the work. Do not interview her. Today is ${today}.

HER CLIENTS (the only valid clientId values):
${clients.map(c => `- ${c.id}: ${c.name}`).join('\n') || '(none)'}

HER OBSERVATION TOPICS so far (buckets in her notebook; a topic is a SUBJECT — a person, a client, or a theme; reuse one when it fits, new short ones are fine):
${topics.join(', ') || '(none yet)'}

UNPOSTED CONTENT CARDS already on the boards (the only valid cardId values for mark_posted):
${cards.map(k => `- ${k.cardId} [client ${k.clientId}, stage ${k.stage}]: ${k.title}`).join('\n') || '(none)'}

RECENT CONVERSATION (oldest first):
${recent.map(r => `${r.who}: ${r.text}`).join('\n') || '(none)'}

HER NEW MESSAGE${body.hasPhoto ? ' (a photo is attached)' : ''}:
${body.message || '(no text, photo only)'}

Return two things:
- "actions": an array with ONE entry per thing she asked for. Empty only if there is truly nothing to do.
- "reply": used ONLY to ask a question or answer one. Leave it "" when the actions speak for themselves.

Action types (the "type" field of each action):
- add_card — a piece of CONTENT to make or publish: a post, carousel, reel, story, video, anything that belongs on a client's content board. This is the right choice whenever she wants something created, designed, written, shot, or published for a client. Fields: clientId, text = the card's TITLE in her own words, contentType (Carousel / Reel / Static / Story / Video — only if she names one), stage (idea / writing / ready / scheduled / posted — default "idea"; use "posted" only if she says it is already live).
- add_client_task — an errand or reminder tied to a client that is NOT itself a piece of content: a shoot, a review, a call, a follow-up. Fields: clientId, text.
- add_my_task — a to-do for herself, no client. Fields: text.
- add_observation — something she noticed and wants remembered long-term. Fields: topic = the SUBJECT (e.g. "Shivansh", a client name, a theme — never "note"/"observation"), text = the observation with command words stripped.
- mark_posted — she says an existing post went live. Match it to a card from the list above. Fields: clientId, cardId.
- file_photo — only when a photo is attached and you can tell whose it is. Fields: clientId.

Rules that matter most:
1. DO, don't ask. Fill in sensible defaults instead of asking. A new card starts at "idea" and its title is whatever she called the post. NEVER ask which stage. NEVER ask for a title when she has already described the post. Put a question in "reply" (with the rest of the actions still filled in) ONLY when you genuinely cannot act — she names a client that is not in the list, or a request cannot be placed.
2. Never turn a category word into a title. If she says "it's a client task", "make it content", "it's a post", she is telling you the TYPE, not naming the thing — use her description of the actual content, never the words "task" / "content" / "post" / "client task" as a title or note.
3. One message is often many actions. "Add the Shourya carousel and a yoga reel to Divine, remind me to shoot for Sonia, mark ResumeGuru's post live" is FOUR actions — return all four (two add_card, one add_client_task, one mark_posted).
4. Every clientId and cardId MUST come from the lists above. If she means a client that is not there, ask in "reply" instead of guessing.
5. Answer plain questions (like "where did that go?") from the recent conversation, with actions empty.
6. "reply", when used, is one or two short plain lines, no jargon.`;

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
        max_tokens: 900,
        output_config: {
          format: {
            type: 'json_schema',
            schema: {
              type: 'object',
              properties: {
                actions: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      type: {
                        type: 'string',
                        enum: ['add_card', 'add_client_task', 'add_my_task', 'add_observation', 'mark_posted', 'file_photo'],
                      },
                      text: { type: 'string' },
                      clientId: { type: 'string' },
                      topic: { type: 'string' },
                      cardId: { type: 'string' },
                      contentType: { type: 'string' },
                      stage: { type: 'string' },
                    },
                    required: ['type'],
                    additionalProperties: false,
                  },
                },
                reply: { type: 'string' },
              },
              required: ['actions', 'reply'],
              additionalProperties: false,
            },
          },
        },
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) return NextResponse.json({ fallback: true });
    const data = await res.json();
    if (data.stop_reason === 'refusal') return NextResponse.json({ fallback: true });
    const block = (data.content ?? []).find((b: { type: string }) => b.type === 'text');
    if (!block?.text) return NextResponse.json({ fallback: true });
    const parsed = JSON.parse(block.text);
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json({ fallback: true });
  }
}
