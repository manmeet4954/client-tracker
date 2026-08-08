// The desk chat's WRITE tools — spec 30 §3.2. What the chat can DO.
//
// THE TWO LAWS, and every function here obeys both.
//
// 1. Nothing is written without an address. Every tool resolves to a declared
//    path in the tree (`lib/tree/`) and goes through the ordinary door
//    (`putEntry` / `amendEntry`), which refuses an undeclared path, an
//    undeclared writer, and the wrong entry type. No tool invents a field, and
//    no tool reaches a folder this profile has switched off.
//
// 2. Every number is computed by code; the model only words it. Nothing here
//    returns raw data for a model to count. A tool returns the next state, the
//    scopes it touched, and one plain sentence.
//
// WHAT A TOOL IS. A pure function: current state plus an intent in, either the
// next state or a refusal out. It never mutates in place and it NEVER SAVES.
// The route saves, through the ordinary write door, so path scoping, the lock
// and role filtering all still apply exactly as they do for a screen.
//
// THE REFUSAL RULE. A tool refuses, in her words, and does nothing at all when:
//   - the strategy is not locked and the write lands in creation,
//   - the switch governing that path is not active on that profile,
//   - the piece, task or profile named does not exist,
//   - the name is ambiguous between two profiles.
// Never half a thing reported as done. Never a refused write retried a second
// way.
//
// Pure. No React, no fetch, no clock read, no randomness: `now` and the id
// makers are injected. Only type imports use `@/`; everything at runtime is a
// relative, extensioned import, so this file runs under plain Node in the tests.

import type { AppState, Client, ClientData } from '@/types';
import type { ProfileBody } from '../tree/body.ts';
import { putEntry, amendEntry } from '../tree/body.ts';
import type { Piece, PieceStage, Seed } from '../tree/objects.ts';
import { PIECE_STAGES } from '../tree/objects.ts';
import { findDeclaration } from '../tree/declarations.ts';
import { scopeKey } from '../tree/scopes.ts';
import { renderState } from '../tree/render.ts';
import { renderProfile } from '../shell/profile.ts';
import { CREATION_PREFIX, strategyLocked } from '../strategy/derivation.ts';
import { PIECE_PATH, canMotherPieces, resolveSeed } from '../engine/seeds.ts';
import { resolvePiece } from '../engine/resolve.ts';
import { writeCapture, type CaptureArrival } from '../engine/captures.ts';
import { OBSERVATIONS_PATH, addNote as writeNote, foldEntry } from '../creation/logs.ts';

// ── The shape every tool returns ─────────────────────────────────────────────

export type ToolResult =
  | { ok: true; state: AppState; paths: string[]; summary: string }
  | { ok: false; refusal: string };

/**
 * The ids the app already uses, injected rather than imported.
 *
 * `lib/utils.ts` owns both generators (`generateId`, `generateShareId`) and the
 * route passes them straight in. Injecting them is what keeps this module
 * deterministic under test without a second id scheme existing anywhere.
 */
export interface IdSource {
  id(): string;
  shareId(): string;
}

/** Everything a tool needs that is not the intent itself. */
export interface WriteContext {
  state: AppState;
  /** An ISO timestamp. This module never reads a clock. */
  now: string;
  ids: IdSource;
}

// ── The paths these tools write, and what each is called in plain words ──────

export const TASKS_PATH = 'work-log/logs/tasks';
export const CAPTURES_PATH = 'work-log/creation/topics/captures';
export const NOTES_PATH = OBSERVATIONS_PATH;
export const PREVIEWS_PATH = 'work-log/creation/review';
export const SCHEDULING_PATH = 'work-log/creation/scheduling';

/** How each address is named when a refusal has to say what is switched off. */
const PLAIN_NAME: Record<string, string> = {
  [PIECE_PATH]: 'The board',
  [TASKS_PATH]: 'Tasks',
  [CAPTURES_PATH]: 'The seed bank',
  [NOTES_PATH]: 'Notes',
  [PREVIEWS_PATH]: 'Previews',
  [SCHEDULING_PATH]: 'Scheduling',
};

function plainName(path: string): string {
  return PLAIN_NAME[path] ?? `"${path}"`;
}

/**
 * `pipe:chat` where the path declares it, `owner` where it does not.
 *
 * Tasks and notes name the chat as a writer by declaration; creation does not,
 * and the chat acting there is her acting. Read off the declaration rather than
 * hard-coded, so a later declaration change moves this with it.
 */
export function writerFor(path: string): 'pipe:chat' | 'owner' {
  const dec = findDeclaration(path);
  return dec?.fed_by.includes('pipe:chat') ? 'pipe:chat' : 'owner';
}

// ── Resolving the profile she named ──────────────────────────────────────────

export interface ResolvedProfile {
  id: string;
  name: string;
  client: Client;
  data: ClientData;
  body: ProfileBody;
}

export type Resolution =
  | { ok: true; profile: ResolvedProfile }
  | { ok: false; refusal: string };

function nameOf(state: AppState, id: string): string {
  return (state.clients ?? []).find(c => c.id === id)?.name ?? id;
}

/**
 * One name to one profile, or a refusal that says which two it could be.
 *
 * Exact id first, then exact name, then a single containing match. Two matches
 * is a question, never a guess: a wrong guess writes a client's work onto
 * another client's board.
 */
export function resolveProfile(state: AppState, ref: string | undefined): Resolution {
  const query = (ref ?? '').trim();
  if (!query) {
    return { ok: false, refusal: 'Which profile is this for? Name it and I will do it.' };
  }

  const clients = state.clients ?? [];
  const lower = query.toLowerCase();

  let hits = clients.filter(c => c.id === query);
  if (hits.length === 0) hits = clients.filter(c => c.name.toLowerCase() === lower);
  if (hits.length === 0) hits = clients.filter(c => c.name.toLowerCase().includes(lower));

  if (hits.length === 0) {
    return { ok: false, refusal: `I cannot find a profile called "${query}". Nothing was written.` };
  }
  if (hits.length > 1) {
    const names = hits.map(c => c.name).join(' and ');
    return {
      ok: false,
      refusal: `"${query}" matches ${hits.length} profiles: ${names}. `
        + 'Tell me which one and I will do it.',
    };
  }

  const client = hits[0];
  const data = state.clientData?.[client.id];
  if (!data) {
    return { ok: false, refusal: `${client.name} has no data on it yet. Nothing was written.` };
  }
  if (!data.body) {
    return {
      ok: false,
      refusal: `${client.name} has not moved into the new structure yet, `
        + 'so I cannot write to it from here. Nothing was written.',
    };
  }
  return { ok: true, profile: { id: client.id, name: client.name, client, data, body: data.body } };
}

// ── The address guard: the lock, then the switch ─────────────────────────────

/**
 * May this profile be written at this address right now?
 *
 * The lock first, because the lock is the reason she will hear most often and
 * it deserves its own sentence. Then the switch that the DECLARATION names for
 * that path, resolved through the one visibility authority (`renderState`), so
 * nothing here re-implements a switch position.
 *
 * Returns a refusal string, or null when the door is open.
 */
export function guardPath(state: AppState, profile: ResolvedProfile, path: string): string | null {
  const dec = findDeclaration(path);
  if (!dec) {
    return `"${path}" is not a place anything lives, so I did not write it.`;
  }

  const locked = strategyLocked(profile.body);
  const inCreation = path === CREATION_PREFIX || path.startsWith(CREATION_PREFIX + '/');
  if (inCreation && !locked) return lockRefusal(profile);

  const rp = renderProfile(state, profile.id, 'owner');
  const rendered = renderState(rp, dec.switch, 'owner');
  if (rendered === 'active') return null;

  // Which of the two is it? The resolver gates whole families behind the lock,
  // not just creation, and "switched off" would be the wrong sentence for a
  // profile whose strategy simply has not locked. So the same authority is
  // asked the counterfactual: would this render if the strategy were locked?
  // Nothing here re-implements the rule; it asks the one function that owns it.
  if (!locked && renderState({ ...rp, strategy_locked: true }, dec.switch, 'owner') === 'active') {
    return lockRefusal(profile);
  }

  return `${plainName(path)} is switched off on ${profile.name}, `
    + 'so I cannot write there. Nothing was written.';
}

function lockRefusal(profile: ResolvedProfile): string {
  return `Strategy is not locked on ${profile.name} yet, so nothing can be written there. `
    + 'Lock it from the Strategy corner and I will do this. Nothing was written.';
}

// ── Committing: the next state, and the scopes it touched ────────────────────

/**
 * The next state with this profile's body replaced, and the scope keys the save
 * must declare. Nothing is saved here: the route posts `{ state, paths }`
 * through the ordinary door.
 */
export function commitBody(
  ctx: WriteContext, profile: ResolvedProfile, body: ProfileBody,
  paths: string[], summary: string,
): ToolResult {
  return {
    ok: true,
    state: {
      ...ctx.state,
      clientData: {
        ...ctx.state.clientData,
        [profile.id]: { ...profile.data, body },
      },
    },
    paths: paths.map(p => scopeKey(profile.id, p)),
    summary,
  };
}

/** The same, for a legacy slice that carries its own address (previews). */
export function commitData(
  ctx: WriteContext, profile: ResolvedProfile, data: ClientData,
  paths: string[], summary: string,
): ToolResult {
  return {
    ok: true,
    state: {
      ...ctx.state,
      clientData: { ...ctx.state.clientData, [profile.id]: data },
    },
    paths: paths.map(p => scopeKey(profile.id, p)),
    summary,
  };
}

// ── Small shared checks ──────────────────────────────────────────────────────

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** yyyy-mm-dd or nothing. A half-written date is refused, never stored. */
export function checkDay(value: string | undefined, what: string): string | null {
  if (value === undefined || value === '') return null;
  if (!DAY.test(value)) {
    return `"${value}" is not a date I can use for ${what}. Give it as 2026-08-12. Nothing was written.`;
  }
  return null;
}

/**
 * The words she uses for a stage, mapped to the six the system has.
 *
 * A stage the ladder does not have is refused rather than invented, which is
 * the same rule the seed ladder follows. `ready` is the LEGACY board's word for
 * `approved` and is accepted as that, not as a seventh stage.
 */
const STAGE_WORDS: Record<string, PieceStage> = {
  idea: 'idea', ideas: 'idea', backlog: 'idea',
  build: 'build', building: 'build', writing: 'build', draft: 'build', drafting: 'build',
  review: 'review', reviewing: 'review',
  approved: 'approved', ready: 'approved', approve: 'approved',
  scheduled: 'scheduled', schedule: 'scheduled',
  posted: 'posted', post: 'posted', live: 'posted', published: 'posted',
};

export function normalizeStage(word: string | undefined): PieceStage | null {
  const key = (word ?? '').trim().toLowerCase();
  return STAGE_WORDS[key] ?? null;
}

// ── update_task ──────────────────────────────────────────────────────────────

export interface UpdateTaskIntent {
  profile: string;
  taskId: string;
  /** Only the fields she actually named. An absent field is left alone. */
  text?: string;
  dueDate?: string;
  done?: boolean;
  /** The piece this task is about, when she says so. */
  pieceId?: string;
}

/**
 * Rename, re-date, complete or re-point a task. Her example 1.
 *
 * `work-log/logs/tasks` is append-only, so the birth record stays exactly as it
 * was written and the change arrives as a dated amendment on top of it. That is
 * also what gives the task a trail for free.
 */
export function updateTask(ctx: WriteContext, intent: UpdateTaskIntent): ToolResult {
  const found = resolveProfile(ctx.state, intent.profile);
  if (!found.ok) return found;
  const profile = found.profile;

  const blocked = guardPath(ctx.state, profile, TASKS_PATH);
  if (blocked) return { ok: false, refusal: blocked };

  const entry = (profile.body.paths?.[TASKS_PATH] ?? []).find(e => e.id === intent.taskId);
  if (!entry) {
    return {
      ok: false,
      refusal: `There is no task with that id on ${profile.name}. Nothing was written.`,
    };
  }

  const badDay = checkDay(intent.dueDate, 'that task');
  if (badDay) return { ok: false, refusal: badDay };

  const current = foldEntry(entry).data as {
    text?: string; due_date?: string; done?: boolean; piece_id?: string;
  };
  const changed: Record<string, unknown> = {};
  const said: string[] = [];

  const text = intent.text?.trim();
  if (text !== undefined && text !== '' && text !== current.text) {
    changed.text = text;
    said.push('renamed it');
  }
  if (intent.dueDate !== undefined && intent.dueDate !== current.due_date) {
    changed.due_date = intent.dueDate;
    said.push(intent.dueDate ? `moved it to ${intent.dueDate}` : 'took the date off it');
  }
  if (intent.done !== undefined && intent.done !== (current.done === true)) {
    changed.done = intent.done;
    said.push(intent.done ? 'ticked it off' : 'put it back');
  }
  if (intent.pieceId !== undefined && intent.pieceId !== current.piece_id) {
    if (intent.pieceId && !(profile.body.paths?.[PIECE_PATH] ?? []).some(e => e.id === intent.pieceId)) {
      return {
        ok: false,
        refusal: `There is no piece with that id on ${profile.name}, `
          + 'so I did not point the task at it. Nothing was written.',
      };
    }
    changed.piece_id = intent.pieceId;
    said.push('pointed it at that piece');
  }

  if (Object.keys(changed).length === 0) {
    return {
      ok: false,
      refusal: 'That task already says exactly that, so I left it alone.',
    };
  }

  const body = amendEntry(profile.body, TASKS_PATH, intent.taskId, {
    at: ctx.now,
    by: writerFor(TASKS_PATH),
    note: said.join(', '),
    changed,
  });

  const title = String(changed.text ?? current.text ?? 'that task');
  return commitBody(ctx, profile, body, [TASKS_PATH], `On ${profile.name} I ${said.join(', ')} on "${title}".`);
}

// ── add_task ─────────────────────────────────────────────────────────────────

export interface AddTaskIntent {
  profile: string;
  text: string;
  dueDate?: string;
  pieceId?: string;
}

/**
 * A new task on a profile.
 *
 * A PERSONAL task has no home here and is refused rather than filed somewhere
 * plausible: the personal half left the dashboard (PLAN §7) and the today strip
 * reads each profile's own tasks and nothing else. That refusal is the whole
 * point of law 1 — no address, no write.
 */
export function addTask(ctx: WriteContext, intent: AddTaskIntent): ToolResult {
  const text = intent.text?.trim();
  if (!text) {
    return { ok: false, refusal: 'A task needs something written in it. Nothing was written.' };
  }

  const found = resolveProfile(ctx.state, intent.profile);
  if (!found.ok) return found;
  const profile = found.profile;

  const blocked = guardPath(ctx.state, profile, TASKS_PATH);
  if (blocked) return { ok: false, refusal: blocked };

  const badDay = checkDay(intent.dueDate, 'that task');
  if (badDay) return { ok: false, refusal: badDay };

  if (intent.pieceId && !(profile.body.paths?.[PIECE_PATH] ?? []).some(e => e.id === intent.pieceId)) {
    return {
      ok: false,
      refusal: `There is no piece with that id on ${profile.name}. Nothing was written.`,
    };
  }

  const due = intent.dueDate ?? '';
  const body = putEntry(profile.body, TASKS_PATH, {
    id: ctx.ids.id(),
    type: 'task',
    data: {
      text,
      due_date: due,
      done: false,
      month: (due || ctx.now).slice(0, 7),
      ...(intent.pieceId ? { piece_id: intent.pieceId } : {}),
    },
  }, { writer: writerFor(TASKS_PATH), now: ctx.now });

  const when = due ? ` due ${due}` : ' with no date on it';
  return commitBody(ctx, profile, body, [TASKS_PATH], `Added "${text}" to ${profile.name},${when}.`);
}

// ── add_piece ────────────────────────────────────────────────────────────────

export interface AddPieceIntent {
  profile: string;
  title: string;
  hook?: string;
  /** Only what she actually named. Nothing is filled in for her. */
  pillarId?: string;
  platform?: string;
  format?: string;
  stage?: string;
  seedId?: string;
  scheduledDate?: string;
  notes?: string;
}

export interface AddPieceResult {
  ok: true;
  state: AppState;
  paths: string[];
  summary: string;
  pieceId: string;
}

/**
 * A piece on a profile's board, born with pillar, platform and format where she
 * named them and with nothing invented where she did not.
 *
 * Two guards beyond the address: only a LOCKED seed may mother a piece (S1), so
 * a seed she names that is not locked refuses the whole write; and no birth
 * snapshot is taken, because a piece born at `idea` never had a birth and
 * inventing one would be a lie in the record analysis reads (S15).
 */
export function addPiece(ctx: WriteContext, intent: AddPieceIntent): AddPieceResult | { ok: false; refusal: string } {
  const title = intent.title?.trim();
  if (!title) {
    return { ok: false, refusal: 'A piece needs a title. Nothing was written.' };
  }

  const found = resolveProfile(ctx.state, intent.profile);
  if (!found.ok) return found;
  const profile = found.profile;

  const blocked = guardPath(ctx.state, profile, PIECE_PATH);
  if (blocked) return { ok: false, refusal: blocked };

  const stage = intent.stage === undefined ? 'idea' : normalizeStage(intent.stage);
  if (!stage) {
    return {
      ok: false,
      refusal: `"${intent.stage}" is not a stage a piece can be at. `
        + `The stages are ${PIECE_STAGES.join(', ')}. Nothing was written.`,
    };
  }

  const badDay = checkDay(intent.scheduledDate, 'that piece');
  if (badDay) return { ok: false, refusal: badDay };

  let seedId: string | null = null;
  if (intent.seedId) {
    const seedRefusal = checkSeed(profile, intent.seedId);
    if (seedRefusal) return { ok: false, refusal: seedRefusal };
    seedId = intent.seedId;
  }

  const costume: Piece['costume'] = {};
  if (intent.pillarId) costume.pillar_id = intent.pillarId;
  if (intent.platform) costume.platform = intent.platform;
  if (intent.format) costume.format = intent.format;

  const id = ctx.ids.id();
  const piece: Piece = {
    id,
    seed_id: seedId,
    title,
    ...(intent.hook?.trim() ? { hook: intent.hook.trim() } : {}),
    stage,
    costume,
    birth: null,
    ...(intent.scheduledDate ? { scheduled_date: intent.scheduledDate } : {}),
    created_month: (intent.scheduledDate || ctx.now).slice(0, 7),
    ...(intent.notes?.trim() ? { notes: intent.notes.trim() } : {}),
  };

  const body = putEntry(profile.body, PIECE_PATH, {
    id, type: 'piece', data: piece as unknown as Record<string, unknown>,
  }, { writer: writerFor(PIECE_PATH), now: ctx.now });

  const committed = commitBody(
    ctx, profile, body, [PIECE_PATH],
    `Put "${title}" on ${profile.name}'s board at ${stage}.`,
  );
  if (!committed.ok) return committed;
  return { ...committed, pieceId: id };
}

/** Only a locked seed may mother a piece (S1, spec 23 §9.1). Reused, not restated. */
function checkSeed(profile: ResolvedProfile, seedId: string): string | null {
  const entry = (profile.body.paths?.['work-log/creation/topics'] ?? []).find(e => e.id === seedId);
  const seed: Seed | null = entry ? resolveSeed(entry) : null;
  if (!seed) {
    return `That seed is not in ${profile.name}'s bank. Nothing was written.`;
  }
  if (!canMotherPieces(seed)) {
    return `"${seed.name}" is at ${seed.status}, and only a locked seed can make pieces. `
      + 'Nothing was written.';
  }
  return null;
}

// ── move_piece ───────────────────────────────────────────────────────────────

export interface MovePieceIntent {
  profile: string;
  pieceId: string;
  /** Her word for the stage. Mapped, never invented. */
  to: string;
  /** "I posted this today" carries a link often enough to be first class. */
  liveLink?: string;
  /** The day it went out, when she says today. Never guessed from a clock. */
  postedOn?: string;
}

/**
 * A stage change, including "I posted this today". Her example 3, first half.
 *
 * `work-log/creation` is append-only: the move is a dated amendment and the
 * piece's birth record is never touched. `resolvePiece` is the one function
 * that reads a piece with its amendments folded in, and it is what this checks
 * the current stage against.
 */
export function movePiece(ctx: WriteContext, intent: MovePieceIntent): ToolResult {
  const found = resolveProfile(ctx.state, intent.profile);
  if (!found.ok) return found;
  const profile = found.profile;

  const blocked = guardPath(ctx.state, profile, PIECE_PATH);
  if (blocked) return { ok: false, refusal: blocked };

  const entry = (profile.body.paths?.[PIECE_PATH] ?? []).find(e => e.id === intent.pieceId);
  if (!entry) {
    return {
      ok: false,
      refusal: `There is no piece with that id on ${profile.name}. Nothing was written.`,
    };
  }

  const to = normalizeStage(intent.to);
  if (!to) {
    return {
      ok: false,
      refusal: `"${intent.to}" is not a stage a piece can be at. `
        + `The stages are ${PIECE_STAGES.join(', ')}. Nothing was written.`,
    };
  }

  const badDay = checkDay(intent.postedOn, 'the day it went out');
  if (badDay) return { ok: false, refusal: badDay };

  const piece = resolvePiece(entry);
  const link = intent.liveLink?.trim() ?? '';

  const changed: Record<string, unknown> = {};
  const said: string[] = [];

  if (piece.stage !== to) {
    changed.stage = to;
    said.push(`moved it to ${to}`);
  }
  if (link && link !== piece.live_link) {
    changed.live_link = link;
    said.push('put the live link on it');
  }
  if (intent.postedOn && intent.postedOn !== piece.scheduled_date) {
    changed.scheduled_date = intent.postedOn;
    said.push(`dated it ${intent.postedOn}`);
  }

  if (Object.keys(changed).length === 0) {
    return {
      ok: false,
      refusal: `"${piece.title}" is already at ${piece.stage}, so I left it alone.`,
    };
  }

  const body = amendEntry(profile.body, PIECE_PATH, intent.pieceId, {
    at: ctx.now,
    by: writerFor(PIECE_PATH),
    note: said.join(', '),
    changed,
  });

  return commitBody(
    ctx, profile, body, [PIECE_PATH],
    `On ${profile.name} I ${said.join(', ')} for "${piece.title}".`,
  );
}

// ── schedule_piece ───────────────────────────────────────────────────────────

export interface SchedulePieceIntent {
  profile: string;
  pieceId: string;
  /** yyyy-mm-dd. Empty clears the date. */
  date: string;
}

/**
 * Puts a date on a piece.
 *
 * TWO switches are checked, on purpose. The date lands on the piece, so the
 * board's switch governs the write; but scheduling is the feature being used,
 * and a profile that does not schedule should not receive dates from a chat.
 * Both have to be active, and each refuses in its own words.
 */
export function schedulePiece(ctx: WriteContext, intent: SchedulePieceIntent): ToolResult {
  const found = resolveProfile(ctx.state, intent.profile);
  if (!found.ok) return found;
  const profile = found.profile;

  const onBoard = guardPath(ctx.state, profile, PIECE_PATH);
  if (onBoard) return { ok: false, refusal: onBoard };
  const onScheduling = guardPath(ctx.state, profile, SCHEDULING_PATH);
  if (onScheduling) return { ok: false, refusal: onScheduling };

  const badDay = checkDay(intent.date, 'that piece');
  if (badDay) return { ok: false, refusal: badDay };

  const entry = (profile.body.paths?.[PIECE_PATH] ?? []).find(e => e.id === intent.pieceId);
  if (!entry) {
    return {
      ok: false,
      refusal: `There is no piece with that id on ${profile.name}. Nothing was written.`,
    };
  }

  const piece = resolvePiece(entry);
  const date = intent.date ?? '';
  if (date === (piece.scheduled_date ?? '')) {
    return {
      ok: false,
      refusal: date
        ? `"${piece.title}" is already set for ${date}, so I left it alone.`
        : `"${piece.title}" already has no date, so I left it alone.`,
    };
  }

  const body = amendEntry(profile.body, PIECE_PATH, intent.pieceId, {
    at: ctx.now,
    by: writerFor(PIECE_PATH),
    note: date ? `Set to go live ${date}` : 'Took the date off it',
    changed: { scheduled_date: date },
  });

  return commitBody(
    ctx, profile, body, [PIECE_PATH],
    date
      ? `"${piece.title}" goes live ${date} on ${profile.name}.`
      : `Took the date off "${piece.title}" on ${profile.name}.`,
  );
}

// ── add_seed_capture ─────────────────────────────────────────────────────────

export interface AddSeedCaptureIntent {
  profile: string;
  /** Exactly as she said it. Never trimmed, never tidied, never summarized. */
  text: string;
  arrival?: CaptureArrival;
  sourceRef?: string;
  /** Set when she is talking more about a seed that already exists. */
  seedId?: string;
}

export interface AddSeedCaptureResult {
  ok: true;
  state: AppState;
  paths: string[];
  summary: string;
  captureId: string;
}

/**
 * Files raw narration as seed-capture INPUT.
 *
 * It never creates a seed and never invents a seed's fields. Only she locks a
 * seed (PLAN §5.1 item 4), and the engine's own surface is where a capture
 * becomes one. This tool's whole job is that what she said is in the bank,
 * verbatim, at the right address, before anything else happens to it.
 */
export function addSeedCapture(
  ctx: WriteContext, intent: AddSeedCaptureIntent,
): AddSeedCaptureResult | { ok: false; refusal: string } {
  if (!intent.text || !intent.text.trim()) {
    return { ok: false, refusal: 'There is nothing to capture. Nothing was written.' };
  }

  const found = resolveProfile(ctx.state, intent.profile);
  if (!found.ok) return found;
  const profile = found.profile;

  const blocked = guardPath(ctx.state, profile, CAPTURES_PATH);
  if (blocked) return { ok: false, refusal: blocked };

  if (intent.seedId) {
    const known = (profile.body.paths?.['work-log/creation/topics'] ?? [])
      .some(e => e.id === intent.seedId);
    if (!known) {
      return {
        ok: false,
        refusal: `That seed is not in ${profile.name}'s bank. Nothing was written.`,
      };
    }
  }

  const id = ctx.ids.id();
  let body: ProfileBody;
  try {
    body = writeCapture(profile.body, {
      id,
      // The text goes in byte for byte. No trim: a capture is kept exactly as
      // it was given, forever.
      text: intent.text,
      arrival: intent.arrival ?? 'typed',
      source_ref: intent.sourceRef,
      seed_id: intent.seedId,
    }, ctx.now);
  } catch (e) {
    return { ok: false, refusal: refusalFrom(e) };
  }

  const committed = commitBody(
    ctx, profile, body, [CAPTURES_PATH],
    `Filed what you said into ${profile.name}'s seed bank. `
    + 'It is capture input, so no seed is made from it until you make one.',
  );
  if (!committed.ok) return committed;
  return { ...committed, captureId: id };
}

// ── add_note ─────────────────────────────────────────────────────────────────

export interface AddNoteIntent {
  profile: string;
  text: string;
  topic?: string;
}

/** An observation on a profile. Her private notes, at their own address. */
export function addNote(ctx: WriteContext, intent: AddNoteIntent): ToolResult {
  const text = intent.text?.trim();
  if (!text) {
    return { ok: false, refusal: 'A note needs something written in it. Nothing was written.' };
  }

  const found = resolveProfile(ctx.state, intent.profile);
  if (!found.ok) return found;
  const profile = found.profile;

  const blocked = guardPath(ctx.state, profile, NOTES_PATH);
  if (blocked) return { ok: false, refusal: blocked };

  let body: ProfileBody;
  try {
    body = writeNote(profile.body, {
      id: ctx.ids.id(), text, topic: intent.topic, now: ctx.now,
    });
  } catch (e) {
    return { ok: false, refusal: refusalFrom(e) };
  }

  return commitBody(ctx, profile, body, [NOTES_PATH], `Noted that on ${profile.name}.`);
}

// ── The door's own refusals, said plainly ────────────────────────────────────

/**
 * `putEntry` and its neighbours throw with a developer's sentence in them. A
 * refusal she reads should not carry a path and a rule number, so the thrown
 * text is kept for the log and one plain line goes to her.
 */
export function refusalFrom(e: unknown): string {
  const text = e instanceof Error ? e.message : String(e);
  if (text.includes('append-only')) {
    return 'That record is kept exactly as it was written, so I could not change it in place. '
      + 'Nothing was written.';
  }
  if (text.includes('no address')) {
    return 'There is nowhere that belongs, so I did not file it anywhere. Nothing was written.';
  }
  return 'The write door refused that, so nothing was written.';
}
