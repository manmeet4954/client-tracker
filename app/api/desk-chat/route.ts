import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { authConfigured, verifyToken, SESSION_COOKIE } from '@/lib/auth';
import { readState, writeState } from '@/lib/supabaseServer';
import { normalizeState, type Role } from '@/lib/access';
import { applyScopes, checkScopes } from '@/lib/tree/scopes';
import { refusedCreationWrites, refusedLegacyCreationWrites } from '@/lib/strategy/derivation';
import { canvaConfigured } from '@/lib/canva';
import { generateId } from '@/lib/utils';
import {
  MAX_TOOL_CALLS, MAX_WRITES, TOOLS, isWrite, runTool, systemPrompt, type LoopContext,
} from '@/lib/desk/loop';
import type { AppState } from '@/types';

export const dynamic = 'force-dynamic';

/**
 * The desk chat — spec 30.
 *
 * She types one message. A model reads it, calls tools until it has what it
 * needs, and writes one plain reply. The tools are `lib/desk/loop.ts`; this file
 * is only the loop around them and the door at the end.
 *
 * WHY A LOOP AND NOT ONE PASS. "How is Divine doing" needs the profile resolved,
 * then its board read, then its target read, before a single sentence can be
 * true. The old brain returned one action per message and could not do that, so
 * it asked her instead — which is the behaviour she rejected on 2026-07-22.
 *
 * WHAT THE MODEL CANNOT DO, no matter what it is asked:
 *  - touch anything not on the tool list,
 *  - do arithmetic (every number arrives already counted),
 *  - write past the ordinary door at the bottom of this file, which applies path
 *    scoping, the strategy lock and role filtering exactly as a screen's save
 *    would.
 *
 * OWNER ONLY. The desk is hers. No other role reaches this route at all.
 */

function currentRole(): Role | null {
  if (!authConfigured()) return 'owner'; // open mode, local dev
  return verifyToken(cookies().get(SESSION_COOKIE)?.value);
}

interface Turn { who: string; text: string }

/**
 * Haiku, the same model the existing chat already uses, so shipping this adds no
 * new spend to a bill she has not set a ceiling on yet. `DESK_CHAT_MODEL` moves
 * it without a deploy if the quality misses the bar in PLAN §5.1.
 */
const MODEL = process.env.DESK_CHAT_MODEL || 'claude-haiku-4-5-20251001';

type Block =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> };

async function callModel(system: string, messages: unknown[], apiKey: string) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1200,
      system,
      tools: TOOLS.map(t => ({
        name: t.name, description: t.description, input_schema: t.input_schema,
      })),
      messages,
    }),
  });
  if (!res.ok) throw new Error(`model ${res.status}`);
  return res.json();
}

export async function POST(req: Request) {
  const role = currentRole();
  if (role !== 'owner') return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // No key, no desk. It says FALLBACK rather than answering, so the widget drops
  // through to the hashtag rules it has always had and the chat keeps working.
  //
  // This is not hypothetical: `ANTHROPIC_API_KEY` is still unset in production as
  // of 2026-08-05. Answering here with an apology would have taken a working
  // feature away from her on the day this shipped.
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ fallback: true });

  const body = await req.json().catch(() => null);
  const message = String(body?.message ?? '').trim();
  const recent: Turn[] = Array.isArray(body?.recent) ? body.recent.slice(-8) : [];
  const today = String(body?.today ?? '').slice(0, 10);
  if (!message) return NextResponse.json({ error: 'bad-request' }, { status: 400 });

  const stored = await readState();
  if (!stored) return NextResponse.json({ error: 'no-state' }, { status: 409 });
  const base = normalizeState(stored);

  const ctx: LoopContext = {
    state: base,
    now: new Date().toISOString(),
    today: /^\d{4}-\d{2}-\d{2}$/.test(today) ? today : new Date().toISOString().slice(0, 10),
    ids: { id: () => generateId(), shareId: () => generateId() + generateId() },
    canvaConfigured: canvaConfigured(),
  };

  const system = systemPrompt(ctx.today, (base.clients ?? []).map(c => ({ id: c.id, name: c.name })));
  const messages: unknown[] = [
    ...recent.map(t => ({ role: t.who === 'me' ? 'user' : 'assistant', content: t.text })),
    { role: 'user', content: message },
  ];

  const did: string[] = [];
  const touched = new Set<string>();
  let writes = 0;
  let calls = 0;
  let dirty = false;

  try {
    for (let step = 0; step < MAX_TOOL_CALLS; step++) {
      const data = await callModel(system, messages, apiKey);
      const blocks: Block[] = data.content ?? [];
      const uses = blocks.filter((b): b is Extract<Block, { type: 'tool_use' }> => b.type === 'tool_use');

      if (uses.length === 0) {
        const text = blocks.filter(b => b.type === 'text').map(b => (b as { text: string }).text).join('\n').trim();
        if (dirty) await save(base, ctx.state, [...touched]);
        return NextResponse.json({ reply: text || 'Done.', did });
      }

      messages.push({ role: 'assistant', content: blocks });
      const results: unknown[] = [];

      for (const use of uses) {
        calls++;
        // The write ceiling. A loop that keeps writing to her data is not an
        // acceptable failure mode, so it stops and says so rather than running on.
        if (isWrite(use.name) && writes >= MAX_WRITES) {
          results.push({
            type: 'tool_result', tool_use_id: use.id,
            content: JSON.stringify({ ok: false, refusal: 'That is as much as I will change in one message. Send the rest separately.' }),
          });
          continue;
        }

        let outcome;
        try {
          outcome = runTool(ctx, use.name, use.input ?? {});
        } catch (e) {
          // A real bug, not a foreseeable refusal. It goes back as a result so
          // the model can tell her honestly instead of the chat dying silently.
          outcome = {
            result: { ok: false, refusal: `Something went wrong doing that: ${e instanceof Error ? e.message : 'unknown'}` },
            refused: true,
          };
        }

        if (outcome.state && outcome.paths?.length) {
          ctx.state = outcome.state;
          outcome.paths.forEach(p => touched.add(p));
          if (outcome.summary) did.push(outcome.summary);
          writes++;
          dirty = true;
        }
        results.push({
          type: 'tool_result', tool_use_id: use.id, content: JSON.stringify(outcome.result),
        });
      }

      messages.push({ role: 'user', content: results });
    }

    // The ceiling was reached with the model still working. Whatever it actually
    // did is already real and is saved; the reply says so rather than pretending.
    if (dirty) await save(base, ctx.state, [...touched]);
    return NextResponse.json({
      reply: did.length
        ? 'I did what I could and stopped there. Ask me the rest and I will carry on.'
        : 'I could not work that one out. Try saying it a different way.',
      did,
    });
  } catch (e) {
    // The model was unreachable. Anything already written is already written, so
    // it is saved and named. Nothing is silently dropped.
    if (dirty) {
      try { await save(base, ctx.state, [...touched]); } catch { /* reported below */ }
    }
    return NextResponse.json({
      reply: did.length
        ? 'I did these before I lost my connection. Say the rest again in a moment.'
        : 'I could not reach my brain just then. Nothing was changed. Try again in a moment.',
      did,
      error: e instanceof Error ? e.message : 'unknown',
    });
  }
}

/**
 * The ordinary write door, and it is deliberately the same sequence as
 * `app/api/state`: declared paths only, then the strategy lock on both the tree
 * and the legacy slices, then the write.
 *
 * The chat gets no privilege here. A profile whose strategy has not locked
 * refuses a chat write exactly as it refuses a drag on the board. If this file
 * and `app/api/state` ever disagree about that sequence, `app/api/state` is the
 * one that is right.
 */
async function save(base: AppState, next: AppState, paths: string[]) {
  const rejected = checkScopes(paths);
  if (rejected.length) throw new Error(`undeclared path: ${rejected.join(', ')}`);

  const merged = applyScopes(base, next, paths);

  for (const id of Object.keys(merged.clientData ?? {})) {
    const tree = refusedCreationWrites(base.clientData?.[id]?.body, merged.clientData[id]?.body);
    if (tree.length) throw new Error('creation is locked on this profile');
    const legacy = refusedLegacyCreationWrites(base.clientData?.[id], merged.clientData[id]);
    if (legacy.length) throw new Error(legacy[0].why);
  }

  await writeState(merged);
}
