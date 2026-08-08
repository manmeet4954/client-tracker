// The desk chat's tool registry and dispatcher — spec 30 §3.
//
// This file is the seam between a model and her data, and it is deliberately
// boring. It declares what the chat may do, in one list, and it executes each
// call against real functions. It contains no cleverness of its own: the reads
// are `lib/desk/read.ts`, the writes are `lib/desk/write.ts` and
// `lib/desk/preview.ts`, and both were built to be right without a model
// anywhere near them.
//
// TWO THINGS THIS FILE EXISTS TO GUARANTEE (spec 30 §2):
//
// 1. The model can only reach what is on this list. There is no free-form
//    escape hatch, no "run this query", no path parameter it can bend. A tool
//    that is not here does not exist as far as the chat is concerned.
// 2. The model never receives raw arrays to count. Every tool returns numbers
//    that are already final. Her rule, in her words: "the calculative thing is
//    something that matters."
//
// Pure and Node-runnable: no fetch, no clock, no React. `now` and `today` are
// injected by the route so the tests can pin them.

import type { AppState } from '@/types';
import {
  acrossProfiles, findPieces, findProfile, findSeeds, findTasks, profileStatus,
} from './read.ts';
import {
  addNote, addPiece, addSeedCapture, addTask, movePiece, schedulePiece, updateTask,
  type IdSource, type WriteContext,
} from './write.ts';
import { makePreview } from './preview.ts';

/** What the loop is allowed to spend on one message (spec 30 §3). */
export const MAX_TOOL_CALLS = 12;
export const MAX_WRITES = 6;

export interface ToolDef {
  name: string;
  /** Reads may run freely; writes are counted against MAX_WRITES. */
  kind: 'read' | 'write';
  description: string;
  input_schema: Record<string, unknown>;
}

const S = (description: string) => ({ type: 'string', description });

/**
 * The tool list, as the model sees it.
 *
 * The descriptions are written for a reader who knows nothing about this
 * dashboard, because that is exactly the model's situation. Where a tool refuses
 * in a case worth anticipating, the description says so, so the model asks her
 * instead of trying the same thing three ways.
 */
export const TOOLS: ToolDef[] = [
  {
    name: 'find_profile',
    kind: 'read',
    description:
      'Resolve a brand or client name she typed to one profile. Call this FIRST whenever she names a brand. '
      + 'If two profiles match it returns both and does not choose: ask her which, do not guess.',
    input_schema: {
      type: 'object',
      properties: { name: S('The name as she typed it.') },
      required: ['name'],
    },
  },
  {
    name: 'profile_status',
    kind: 'read',
    description:
      'The whole "where are we" answer for ONE profile: how many pieces are posted this month, scheduled, '
      + 'in review, in build and waiting as ideas; the posting target and what is left against it; each '
      + 'content pillar with its target share and its actual share; whether strategy is locked; and what was '
      + 'posted last. Every number here is already counted. Use these numbers exactly as given and never do '
      + 'arithmetic of your own on them.',
    input_schema: {
      type: 'object',
      properties: { profile_id: S('From find_profile.') },
      required: ['profile_id'],
    },
  },
  {
    name: 'find_pieces',
    kind: 'read',
    description:
      'Pieces of content on one profile, filtered by stage, pillar, platform, format, month, date range, or '
      + 'having no date. Returns the rows plus a true count, which stays true even when the rows are trimmed.',
    input_schema: {
      type: 'object',
      properties: {
        profile_id: S('From find_profile.'),
        stage: S('One of: idea, build, review, approved, scheduled, posted.'),
        pillar_id: S('Optional.'),
        platform: S('Optional, e.g. Instagram.'),
        format: S('Optional, e.g. Carousel or Reel.'),
        month: S('Optional, YYYY-MM.'),
        undated: { type: 'boolean', description: 'Only pieces with no date.' },
      },
      required: ['profile_id'],
    },
  },
  {
    name: 'find_tasks',
    kind: 'read',
    description:
      'Tasks, on one profile or across all of them. Overdue is separated from due today, already counted.',
    input_schema: {
      type: 'object',
      properties: {
        profile_id: S('Leave empty for every profile.'),
        scope: S('due (overdue and today), week, open, or all. Defaults to due.'),
      },
    },
  },
  {
    name: 'find_seeds',
    kind: 'read',
    description:
      'Seeds in one profile\'s seed bank, optionally by status (draft, discussed, validated, locked). '
      + 'A seed with no raw thought is really a subject that was migrated in, and the row says which.',
    input_schema: {
      type: 'object',
      properties: { profile_id: S('From find_profile.'), status: S('Optional.') },
      required: ['profile_id'],
    },
  },
  {
    name: 'across_profiles',
    kind: 'read',
    description:
      'The standing questions that span every profile: what needs her today, what is stuck waiting on a '
      + 'client yes, which profiles have no locked strategy, which have gone quiet, and how last week went. '
      + 'Use this for anything not about one named brand.',
    input_schema: { type: 'object', properties: {} },
  },

  {
    name: 'add_task',
    kind: 'write',
    description: 'Add a task to a profile. Give a due date only if she said one.',
    input_schema: {
      type: 'object',
      properties: {
        profile: S('Profile id or name.'),
        text: S('The task, in her words.'),
        due_date: S('Optional, YYYY-MM-DD.'),
      },
      required: ['profile', 'text'],
    },
  },
  {
    name: 'update_task',
    kind: 'write',
    description: 'Change a task that already exists: its words, its date, or tick it done.',
    input_schema: {
      type: 'object',
      properties: {
        profile: S('Profile id or name.'),
        task_id: S('From find_tasks.'),
        text: S('Optional new wording.'),
        due_date: S('Optional, YYYY-MM-DD.'),
        done: { type: 'boolean', description: 'Optional.' },
      },
      required: ['profile', 'task_id'],
    },
  },
  {
    name: 'add_piece',
    kind: 'write',
    description:
      'Put a new piece of content on a profile\'s board. It starts as an idea unless she says otherwise. '
      + 'Set pillar, platform and format only where she actually named them: leave them empty rather than '
      + 'choosing for her.',
    input_schema: {
      type: 'object',
      properties: {
        profile: S('Profile id or name.'),
        title: S('What she called it. A category word like "carousel" is never a title.'),
        hook: S('Optional.'),
        pillar_id: S('Optional.'),
        platform: S('Optional.'),
        format: S('Optional, e.g. Carousel or Reel.'),
        stage: S('Optional, defaults to idea.'),
        scheduled_date: S('Optional, YYYY-MM-DD.'),
      },
      required: ['profile', 'title'],
    },
  },
  {
    name: 'move_piece',
    kind: 'write',
    description:
      'Move a piece to another stage. This is how "I posted this today" is recorded: move it to posted, and '
      + 'pass the live link and the date if she gave them.',
    input_schema: {
      type: 'object',
      properties: {
        profile: S('Profile id or name.'),
        piece_id: S('From find_pieces.'),
        to: S('idea, build, review, approved, scheduled or posted.'),
        live_link: S('Optional.'),
        posted_on: S('Optional, YYYY-MM-DD. Only when she said the day.'),
      },
      required: ['profile', 'piece_id', 'to'],
    },
  },
  {
    name: 'schedule_piece',
    kind: 'write',
    description: 'Put a go-live date on a piece. An empty date clears it.',
    input_schema: {
      type: 'object',
      properties: {
        profile: S('Profile id or name.'),
        piece_id: S('From find_pieces.'),
        date: S('YYYY-MM-DD, or empty to clear.'),
      },
      required: ['profile', 'piece_id', 'date'],
    },
  },
  {
    name: 'add_seed_capture',
    kind: 'write',
    description:
      'File something she narrated into the seed bank, kept EXACTLY as she said it. This does not create a '
      + 'finished seed and never invents its parts: only she locks a seed. Use this when she is thinking out '
      + 'loud about a topic rather than asking for a post.',
    input_schema: {
      type: 'object',
      properties: {
        profile: S('Profile id or name.'),
        text: S('Her words, verbatim. Do not tidy, trim or summarize them.'),
        seed_id: S('Optional, when she is adding to a seed that exists.'),
      },
      required: ['profile', 'text'],
    },
  },
  {
    name: 'add_note',
    kind: 'write',
    description: 'Add one of her private notes to a profile. Hers only, never client facing.',
    input_schema: {
      type: 'object',
      properties: {
        profile: S('Profile id or name.'),
        text: S('The note.'),
        topic: S('Optional subject to file it under.'),
      },
      required: ['profile', 'text'],
    },
  },
  {
    name: 'make_preview',
    kind: 'write',
    description:
      'Turn links she pasted into a client preview and hand back a shareable link. Give piece_id when the '
      + 'piece is already on the board; otherwise give new_piece and it is created and attached. '
      + 'Image links work. A Canva link is refused with the reason, because that connection is not set up '
      + 'yet: report the refusal, do not try another way.',
    input_schema: {
      type: 'object',
      properties: {
        profile: S('Profile id or name.'),
        piece_id: S('Optional, when the piece exists.'),
        new_piece_title: S('Optional, when it does not.'),
        links: { type: 'array', items: { type: 'string' }, description: 'The links she pasted, in order.' },
        caption: S('Optional caption under the slides.'),
      },
      required: ['profile', 'links'],
    },
  },
];

export const TOOL_NAMES = TOOLS.map(t => t.name);

/** Everything the dispatcher needs. `now`/`today` injected; nothing reads a clock. */
export interface LoopContext {
  state: AppState;
  now: string;
  today: string;
  ids: IdSource;
  /** True only when a Canva OAuth app is configured (spec 30 §3.3). */
  canvaConfigured: boolean;
}

export interface ToolOutcome {
  /** What goes back to the model, as JSON. Never prose it did not ask for. */
  result: unknown;
  /** Set only by a write that changed something. */
  state?: AppState;
  paths?: string[];
  /** One plain line for the confirmation she reads. */
  summary?: string;
  /** True when the tool refused. A refusal is a RESULT, never an exception. */
  refused: boolean;
}

function writeCtx(ctx: LoopContext): WriteContext {
  return { state: ctx.state, now: ctx.now, ids: ctx.ids };
}

/**
 * A write's return value, folded into one shape the loop understands.
 *
 * The write tools return several different success shapes — some carry a new
 * piece id, one carries a share path — so this reads them structurally rather
 * than by type. It is the one place that is loose about types, and it is loose
 * in exactly one direction: it can only ever read fields, never write them.
 */
function fromWrite(result: { ok: boolean } | { ok: false; refusal: string }): ToolOutcome {
  const r = result as {
    ok: boolean; refusal?: string; state?: AppState; paths?: string[];
    summary?: string; sharePath?: string;
  };
  if (!r.ok) return { result: { ok: false, refusal: r.refusal }, refused: true };
  return {
    result: { ok: true, done: r.summary, ...(r.sharePath ? { share_path: r.sharePath } : {}) },
    state: r.state,
    paths: r.paths,
    summary: r.summary,
    refused: false,
  };
}

const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v : undefined);

/**
 * Run one tool call.
 *
 * A tool NEVER throws for a foreseeable problem: an unknown profile, a locked
 * profile, a piece that is not there. Those come back as refusals, in her words,
 * so the model can tell her rather than trying the same thing a different way.
 * A genuine bug still throws, and the route turns it into one honest line.
 */
export function runTool(ctx: LoopContext, name: string, input: Record<string, unknown>): ToolOutcome {
  const p = str(input.profile_id) ?? str(input.profile) ?? '';

  switch (name) {
    case 'find_profile':
      return { result: findProfile(ctx.state, String(input.name ?? '')), refused: false };

    case 'profile_status':
      return { result: profileStatus(ctx.state, p, ctx.today), refused: false };

    case 'find_pieces':
      return {
        result: findPieces(ctx.state, p, {
          stage: str(input.stage) as never,
          pillar_id: str(input.pillar_id),
          platform: str(input.platform),
          format: str(input.format),
          month: str(input.month),
          undated: input.undated === true || undefined,
        }),
        refused: false,
      };

    case 'find_tasks':
      return {
        result: findTasks(ctx.state, str(input.profile_id) ?? null, {
          today: ctx.today,
          scope: (str(input.scope) as never) ?? 'due',
        }),
        refused: false,
      };

    case 'find_seeds':
      return { result: findSeeds(ctx.state, p, str(input.status) as never), refused: false };

    case 'across_profiles':
      return { result: acrossProfiles(ctx.state, ctx.today), refused: false };

    case 'add_task':
      return fromWrite(addTask(writeCtx(ctx), {
        profile: p, text: String(input.text ?? ''), dueDate: str(input.due_date),
      }));

    case 'update_task':
      return fromWrite(updateTask(writeCtx(ctx), {
        profile: p,
        taskId: String(input.task_id ?? ''),
        text: str(input.text),
        dueDate: str(input.due_date),
        done: typeof input.done === 'boolean' ? input.done : undefined,
      }));

    case 'add_piece':
      return fromWrite(addPiece(writeCtx(ctx), {
        profile: p,
        title: String(input.title ?? ''),
        hook: str(input.hook),
        pillarId: str(input.pillar_id),
        platform: str(input.platform),
        format: str(input.format),
        stage: str(input.stage),
        scheduledDate: str(input.scheduled_date),
      }));

    case 'move_piece':
      return fromWrite(movePiece(writeCtx(ctx), {
        profile: p,
        pieceId: String(input.piece_id ?? ''),
        to: String(input.to ?? ''),
        liveLink: str(input.live_link),
        postedOn: str(input.posted_on),
      }));

    case 'schedule_piece':
      return fromWrite(schedulePiece(writeCtx(ctx), {
        profile: p, pieceId: String(input.piece_id ?? ''), date: String(input.date ?? ''),
      }));

    case 'add_seed_capture':
      return fromWrite(addSeedCapture(writeCtx(ctx), {
        profile: p, text: String(input.text ?? ''), seedId: str(input.seed_id),
      }));

    case 'add_note':
      return fromWrite(addNote(writeCtx(ctx), {
        profile: p, text: String(input.text ?? ''), topic: str(input.topic),
      }));

    case 'make_preview': {
      const title = str(input.new_piece_title);
      return fromWrite(makePreview(writeCtx(ctx), {
        profile: p,
        pieceId: str(input.piece_id),
        newPiece: title ? { title } : undefined,
        links: Array.isArray(input.links) ? input.links.map(String) : [],
        caption: str(input.caption),
        canvaConfigured: ctx.canvaConfigured,
      }));
    }

    default:
      return {
        result: { ok: false, refusal: `There is no tool called ${name}.` },
        refused: true,
      };
  }
}

/** Is this tool a write? Used to hold the loop to MAX_WRITES. */
export function isWrite(name: string): boolean {
  return TOOLS.find(t => t.name === name)?.kind === 'write';
}

/**
 * The system prompt.
 *
 * Short on purpose. Everything it does NOT have to say is enforced somewhere it
 * cannot be talked out of: what the chat may touch is the tool list, where a
 * thing goes is the tree, whether a write is allowed is the write door, and
 * every number is computed before it ever gets here.
 */
export function systemPrompt(today: string, profiles: { id: string; name: string }[]): string {
  return [
    "You are the desk of Manmeet's dashboard. She runs a personal branding studio and this is where she works.",
    `Today is ${today}.`,
    '',
    'Her profiles, by id and name:',
    ...profiles.map(p => `- ${p.id}: ${p.name}`),
    '',
    'HOW TO WORK',
    '- Do the whole message. One message is often several things: do all of them.',
    '- Use the tools. Never answer a question about her work from memory or from what you assume.',
    '- Look things up before you act. Resolve a name to a profile before you write to it.',
    '- Numbers come from tools already counted. Never add up, estimate or round anything yourself.',
    '- When a tool refuses, tell her what it said and stop. Do not try the same thing another way.',
    '- If two profiles match a name, ask her which one. Never pick.',
    '',
    'HOW TO SPEAK',
    '- Plain, short lines. No jargon, no em dashes, no bullet lists unless she asked for a list.',
    '- Say what you did, not how the system works.',
    '- If you did nothing, say that plainly and say why.',
  ].join('\n');
}
