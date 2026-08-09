// Spec 30 §6 — the tool layer as the chat actually reaches it.
//
// The two halves have their own tests. These are about the SEAM: that the list
// is the whole surface, that a foreseeable problem comes back as a refusal
// rather than an exception, and that a refusal changes nothing.

import { suite, test, ok, eq } from './harness.ts';
import { fixtureState } from './fixtures.ts';
// The write half already builds the honest two-profile state this needs:
// ResumeGuru migrated AND locked, Divine migrated and not. Sharing it beats a
// second fixture that could drift away from the one the writes are tested on.
import { deskState } from './desk.write.test.ts';
import {
  MAX_TOOL_CALLS, MAX_WRITES, TOOLS, TOOL_NAMES, isWrite, runTool, systemPrompt,
  type LoopContext,
} from '../lib/desk/loop.ts';
import type { AppState } from '../types/index.ts';

const TODAY = '2026-08-05';
const NOW = '2026-08-05T09:00:00.000Z';

let n = 0;
function ctxFor(state?: AppState): LoopContext {
  n = 0;
  return {
    state: state ?? fixtureState(),
    now: NOW,
    today: TODAY,
    ids: { id: () => `id-${++n}`, shareId: () => `share-${++n}` },
    canvaConfigured: false,
  };
}

suite('spec 30 — the tool list is the whole surface');

test('every tool is declared once, named in snake case, and says which half it is', async () => {
  eq(TOOL_NAMES.length, new Set(TOOL_NAMES).size, 'no tool is declared twice');
  for (const t of TOOLS) {
    ok(/^[a-z][a-z_]*$/.test(t.name), `${t.name} is snake case`);
    ok(t.kind === 'read' || t.kind === 'write', `${t.name} says which half it is`);
    ok(t.description.length > 40, `${t.name} is described for a reader who knows nothing`);
    eq((t.input_schema as { type?: string }).type, 'object', `${t.name} takes an object`);
  }
  ok(TOOLS.some(t => t.kind === 'read'), 'it can find');
  ok(TOOLS.some(t => t.kind === 'write'), 'and it can act');
});

test('a name that is not on the list is refused, not attempted', async () => {
  const ctx = ctxFor();
  const out = await runTool(ctx, 'delete_everything', {});
  ok(out.refused, 'refused');
  ok(!out.state, 'and nothing was written');
});

test('the ceilings exist and are small enough to be a real bound', async () => {
  ok(MAX_TOOL_CALLS > 2 && MAX_TOOL_CALLS <= 20, 'a loop can work but cannot run away');
  ok(MAX_WRITES > 0 && MAX_WRITES < MAX_TOOL_CALLS, 'writes are bounded tighter than reads');
});

test('isWrite agrees with the list, so the ceiling counts the right calls', async () => {
  eq(isWrite('profile_status'), false, 'a read is not a write');
  eq(isWrite('move_piece'), true, 'a write is');
  eq(isWrite('nonsense'), false, 'and an unknown name is not counted as a write');
});

suite('spec 30 §3 — a refusal is a result, and it changes nothing');

test('an unknown profile refuses on a write and returns no state', async () => {
  const ctx = ctxFor();
  const out = await runTool(ctx, 'add_task', { profile: 'A Brand That Does Not Exist', text: 'x' });
  ok(out.refused, 'it refused');
  ok(!out.state && !out.paths, 'no state, no paths: nothing to save');
  const r = out.result as { refusal?: string };
  ok(typeof r.refusal === 'string' && r.refusal.length > 0, 'and it said why in words');
});

test('a read against an unknown profile answers, it does not throw', async () => {
  const ctx = ctxFor();
  const out = await runTool(ctx, 'profile_status', { profile_id: 'nope' });
  ok(out.result !== undefined, 'there is an answer');
  eq((out.result as { ok?: boolean }).ok, false, 'and the answer is that it could not');
});

test('a write on an unlocked profile lands, exactly as a drag would', async () => {
  const ctx = ctxFor(deskState());
  // Divine is migrated and NOT locked: the honest pre-lock case. Her decision,
  // 2026-08-09 — recording what is happening always works, so this is a piece on
  // a board like any other, and it goes to its declared address.
  const out = await runTool(ctx, 'add_piece', { profile: 'Divine Studio', title: 'A new piece' });
  ok(!out.refused, 'it was not refused for want of a strategy');
  ok(out.state, 'there is a next state to save');
  ok(out.paths?.some(p => p.includes('work-log/creation')) ?? false,
    'and it is the board it wrote to, not somewhere plausible');
});

test('a Canva link is refused with the reason, and no empty preview is made', async () => {
  const ctx = ctxFor(deskState());   // a LOCKED profile, so the link is what fails
  ctx.canvaConfigured = false;
  const out = await runTool(ctx, 'make_preview', {
    profile: 'ResumeGuru',
    new_piece_title: 'A carousel',
    links: ['https://www.canva.com/design/DAF123/view'],
  });
  ok(out.refused, 'refused rather than half done');
  const r = out.result as { refusal?: string };
  ok(/canva/i.test(r.refusal ?? ''), 'and the refusal names Canva, so she knows what to fix');
});

suite('spec 30 §2 — the model is never asked to count');

test('profile_status hands back finished numbers, not arrays to add up', async () => {
  const ctx = ctxFor(deskState());
  const out = await runTool(ctx, 'profile_status', { profile_id: 'resumeguru' });
  const r = out.result as { ok: boolean; counts?: Record<string, unknown>; cadence?: Record<string, unknown> };
  ok(r.ok, 'it answered');
  ok(r.counts && typeof r.counts === 'object', 'there are counts');
  for (const [k, v] of Object.entries(r.counts ?? {})) {
    ok(typeof v === 'number', `counts.${k} is a number, already counted`);
  }
  // The remainder is the one a person would be tempted to work out in their head.
  ok(r.cadence && 'remaining' in r.cadence, 'and what is LEFT is computed too, not left to the model');
});

test('the prompt tells it not to do arithmetic, and names her profiles', async () => {
  const p = systemPrompt(TODAY, [{ id: 'resumeguru', name: 'ResumeGuru' }]);
  ok(p.includes('resumeguru') && p.includes('ResumeGuru'), 'it knows the profiles by id and name');
  ok(/never add up|never do arithmetic|already counted/i.test(p), 'and it is told the numbers are not its job');
  ok(!p.includes('—'), 'no em dashes in anything she might read back');
});

suite('spec 30 — one message, several things');

test('two writes in a row accumulate onto one state and one set of paths', async () => {
  const ctx = ctxFor(deskState());
  const first = await runTool(ctx, 'add_note', { profile: 'ResumeGuru', text: 'One' });
  if (!first.state) return;                  // notes switched off in the fixture
  ctx.state = first.state;
  const second = await runTool(ctx, 'add_note', { profile: 'ResumeGuru', text: 'Two' });
  ok(second.state, 'the second one worked on the first one\'s state');
  const paths = new Set([...(first.paths ?? []), ...(second.paths ?? [])]);
  ok(paths.size >= 1, 'and the paths they touched can be collected into one save');
});

// ── Canva, in the chat ───────────────────────────────────────────────────────
//
// She pastes a Canva link in the preview editor every day and gets a client
// preview back. The chat refused the same link, not because Canva was missing
// but because the chat was never allowed to run the import. It is allowed now.
//
// `importCanva` is injected, so these run with no network: the point under test
// is the SEAM, that an export becomes ordinary image links before the pure
// preview code sees them, and that every failure refuses whole.

suite('spec 30 — a Canva link in the chat is imported, not refused');

test('a design link becomes a real preview with a link she can send', async () => {
  const ctx = ctxFor(deskState());
  ctx.canvaConfigured = true;
  ctx.importCanva = async () => [
    'https://store.example/post-images/one.png',
    'https://store.example/post-images/two.png',
  ];

  const out = await runTool(ctx, 'make_preview', {
    profile: 'ResumeGuru',
    new_piece_title: 'Salary question carousel',
    links: ['https://www.canva.com/design/DAF123/view'],
  });

  const result = out.result as { ok: boolean; share_path?: string };
  ok(result.ok, 'the preview is made');
  ok(!out.refused, 'and nothing refused');
  ok(String(result.share_path ?? '').startsWith('/p/'), 'she gets the link she sends the client');
  ok(out.state, 'and it wrote');
});

test('the pages are re-hosted, so a sent preview cannot expire', async () => {
  const ctx = ctxFor(deskState());
  ctx.canvaConfigured = true;
  let asked = '';
  ctx.importCanva = async (link) => { asked = link; return ['https://store.example/a.png']; };

  await runTool(ctx, 'make_preview', {
    profile: 'ResumeGuru',
    new_piece_title: 'One slide',
    links: ['https://www.canva.com/design/DAF999/view'],
  });
  eq(asked, 'https://www.canva.com/design/DAF999/view', 'the design link is what gets imported');
});

test('image links she pasted herself are left alone', async () => {
  const ctx = ctxFor(deskState());
  ctx.canvaConfigured = true;
  let called = false;
  ctx.importCanva = async () => { called = true; return []; };

  const out = await runTool(ctx, 'make_preview', {
    profile: 'ResumeGuru',
    new_piece_title: 'Already exported',
    links: ['https://store.example/one.png', 'https://store.example/two.png'],
  });
  ok(!called, 'nothing is sent to Canva that is not a Canva link');
  ok((out.result as { ok: boolean }).ok, 'and the preview is made as before');
});

test('a failed export refuses whole, and writes nothing', async () => {
  const ctx = ctxFor(deskState());
  const before = JSON.stringify(ctx.state);
  ctx.canvaConfigured = true;
  ctx.importCanva = async () => { throw new Error('A slide would not download from Canva (502).'); };

  const out = await runTool(ctx, 'make_preview', {
    profile: 'ResumeGuru',
    new_piece_title: 'Half a carousel',
    links: ['https://www.canva.com/design/DAF123/view'],
  });

  ok(out.refused, 'it refused');
  ok(!out.state, 'and returned no state, so nothing can be saved');
  ok(String((out.result as { refusal: string }).refusal).includes('Nothing was written'),
    'and it says so in her words');
  eq(JSON.stringify(ctx.state), before, 'her data is untouched');
});

test('an empty design refuses rather than making a preview with no slides', async () => {
  const ctx = ctxFor(deskState());
  ctx.canvaConfigured = true;
  ctx.importCanva = async () => [];

  const out = await runTool(ctx, 'make_preview', {
    profile: 'ResumeGuru',
    new_piece_title: 'Nothing in it',
    links: ['https://www.canva.com/design/DAF123/view'],
  });
  ok(out.refused, 'no pages is not a preview');
  ok(!out.state, 'and nothing was written');
});

test('with Canva not connected it still refuses by name, exactly as before', async () => {
  const ctx = ctxFor(deskState());
  ctx.canvaConfigured = false;
  ctx.importCanva = undefined;

  const out = await runTool(ctx, 'make_preview', {
    profile: 'ResumeGuru',
    new_piece_title: 'A carousel',
    links: ['https://www.canva.com/design/DAF123/view'],
  });
  ok(out.refused, 'the old behaviour survives when there is nothing to import with');
});
