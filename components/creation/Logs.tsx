'use client';

// Creation → Logs — the restructure handoff, "CREATION → Logs".
//
//   "The profile's memory of everything that is not content."
//
// Five screens on one segmented control: Tasks · Decisions · Requests ·
// Pipelines · Notes. Five things that used to be their own tab in the old
// thirteen-tab bar land in exactly one of them — the Dashboard agenda, Lists,
// Cold calls, Orders, Saved replies, Observations — and Pipelines is the drawer
// that swallows every per-client one-off list.
//
// Measurements are the prototype's and are not negotiable:
//   dot     8px, flush with the first line of the title (margin-top 7px)
//   title   15px/600 · sub-line 12.5px #9b95a1 · when 12px tabular #9b95a1
//   row     padding 15px 18px, separated by 1px rgba(23,21,26,.07)
//   card    white, hairline, radius 18, shadow 0 1px 2px rgba(23,21,26,.04)
//   footnote 12.5px #9b95a1, one plain line per tab
//
// Chrome is ink. The profile's hue is not used here at all: a log is a list of
// facts, not an identity surface.
//
// Nothing in this file decides what is countable, orderable or writable. All of
// that is in lib/creation/logs.ts, which has no React in it and is tested.

import { useState } from 'react';
import { Check, Plus } from 'lucide-react';
import { useApp, useClient } from '@/contexts/AppContext';
import { generateId } from '@/lib/utils';
import { renderProfile, accentFor, shellRole } from '@/lib/shell/profile';
import { renderState } from '@/lib/tree/render';
import type { PathState } from '@/lib/tree/contract';
import { Segmented } from '@/components/shell/Screen';
import ListsView from '@/components/ListsView';
import ColdCallsView from '@/components/ColdCallsView';
import OrdersView from '@/components/OrdersView';
import AnswersView from '@/components/AnswersView';
import MomentumMeter from '@/components/MomentumMeter';
import {
  LOG_FOOTNOTES, addLogEntry, addNote, counted, decisionRows, liveLogTabs,
  livePipelines, markLogEntryDone, noteRows, requestRows, taskRows,
  type LogRow, type LogTabId,
} from '@/lib/creation/logs';

export interface LogsProps {
  profileId: string;
  /**
   * A hard read-only, for the page that already shows the lock banner. Each tab
   * also goes read-only on its own when its switch resolves to `history`.
   */
  readOnly?: boolean;
}

/** yyyy-mm-dd for the machine's today. The pure module never decides this. */
function todayKey(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export default function Logs({ profileId, readOnly = false }: LogsProps) {
  const { state, role, selectedMonth: month } = useApp();
  const { client, data } = useClient(profileId);
  const [tab, setTab] = useState<LogTabId | null>(null);
  const [pipeline, setPipeline] = useState<string | null>(null);

  const kind = shellRole(state, role, profileId);
  const profile = renderProfile(state, profileId, role);
  const resolve = (switchId: string): PathState => renderState(profile, switchId, kind);

  const tabs = liveLogTabs(resolve);
  const pipelines = livePipelines(resolve);
  const effortState = resolve('logs.effort_meter');

  // Off means absent: if nothing here is switched on, there is no strip, no
  // empty card and no "not available for this client" line.
  const current = tabs.find(t => t.item.id === tab) ?? tabs[0];
  if (!current) {
    return <p className="p-8 text-sm text-faint">Nothing in the log is switched on for this profile.</p>;
  }

  const id = current.item.id;
  const locked = readOnly || current.state === 'history';
  const today = todayKey();
  const body = data.body;

  return (
    <div className="flex flex-col gap-3.5">
      <Segmented
        segments={tabs.map(t => ({ id: t.item.id, label: t.item.label }))}
        active={id}
        onSelect={next => { setTab(next as LogTabId); setPipeline(null); }}
      />

      {id === 'tasks' && (
        <TasksTab
          profileId={profileId} month={month} today={today} locked={locked}
          effort={effortState !== 'hidden'
            ? <MomentumMeter clientId={profileId} accent={accentFor(client, data)} />
            : null}
        />
      )}

      {id === 'decisions' && (
        <EntriesTab
          kind="decisions" profileId={profileId} locked={locked}
          rows={decisionRows(body)}
          noun="decision"
          empty="Nothing has been written down as a decision yet."
          titlePlaceholder="What was agreed"
          notePlaceholder="Where it was agreed (optional)"
        />
      )}

      {id === 'requests' && (
        <EntriesTab
          kind="requests" profileId={profileId} locked={locked}
          rows={requestRows(body, today)}
          noun="request"
          empty="You are not waiting on anything from them."
          titlePlaceholder="What you are waiting on"
          notePlaceholder="How you asked (optional)"
        />
      )}

      {id === 'pipelines' && pipelines.length > 0 && (() => {
        const open = pipelines.find(p => p.item.id === pipeline) ?? pipelines[0];
        return (
          <>
            {pipelines.length > 1 && (
              <Segmented
                segments={pipelines.map(p => ({ id: p.item.id, label: p.item.label }))}
                active={open.item.id}
                onSelect={setPipeline}
              />
            )}
            <div className="-mx-4 md:-mx-7">
              {open.item.id === 'lists' && <ListsView clientId={profileId} />}
              {open.item.id === 'cold-calls' && <ColdCallsView clientId={profileId} />}
              {open.item.id === 'orders' && <OrdersView clientId={profileId} />}
              {open.item.id === 'replies' && <AnswersView clientId={profileId} />}
            </div>
          </>
        );
      })()}

      {id === 'notes' && (
        <NotesTab profileId={profileId} locked={locked} />
      )}

      <p className="text-[12.5px] leading-[1.5] text-faint">{LOG_FOOTNOTES[id]}</p>
    </div>
  );
}

// ── Tasks ────────────────────────────────────────────────────────────────────

function TasksTab({ profileId, month, today, locked, effort }: {
  profileId: string;
  month: string;
  today: string;
  locked: boolean;
  effort: React.ReactNode;
}) {
  const { state, dispatch } = useApp();
  const { data } = useClient(profileId);
  const [text, setText] = useState('');
  const [due, setDue] = useState('');

  const agenda = (data.monthData?.[month] ?? { agenda: [] }).agenda;
  const rows = taskRows({
    profileId, month, today,
    agenda,
    personalTasks: state.personalTasks ?? [],
  });

  function add() {
    const t = text.trim();
    if (!t) return;
    dispatch({
      type: 'ADD_AGENDA',
      payload: { clientId: profileId, month, item: { id: generateId(), text: t, dueDate: due, done: false } },
    });
    setText('');
    setDue('');
  }

  return (
    <>
      <RowCard
        rows={rows}
        empty="Nothing on this profile's list this month."
        onDone={locked ? undefined : row => {
          if (!row.agendaItemId) return;
          dispatch({
            type: 'TOGGLE_AGENDA',
            payload: { clientId: profileId, month, itemId: row.agendaItemId },
          });
        }}
      />
      {!locked && (
        <AddBar onAdd={add} disabled={!text.trim()}>
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && add()}
            placeholder="Add a task"
            className={FIELD}
          />
          <input
            type="date"
            value={due}
            onChange={e => setDue(e.target.value)}
            className={`${FIELD} tnum max-w-[10.5rem]`}
          />
        </AddBar>
      )}
      {effort && <div className="-mx-4 md:-mx-7">{effort}</div>}
    </>
  );
}

// ── Decisions and Requests ───────────────────────────────────────────────────

function EntriesTab({ kind, profileId, locked, rows, noun, empty, titlePlaceholder, notePlaceholder }: {
  kind: 'decisions' | 'requests';
  profileId: string;
  locked: boolean;
  rows: LogRow[];
  noun: string;
  empty: string;
  titlePlaceholder: string;
  notePlaceholder: string;
}) {
  const { dispatch } = useApp();
  const { data } = useClient(profileId);
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [problem, setProblem] = useState('');

  const body = data.body;

  function add() {
    if (!body || !title.trim()) return;
    try {
      const next = addLogEntry(body, kind, { id: generateId(), title, note });
      dispatch({ type: 'SET_BODY', payload: { clientId: profileId, body: next } });
      setTitle('');
      setNote('');
      setProblem('');
    } catch (e) {
      setProblem(e instanceof Error ? e.message : 'That could not be written.');
    }
  }

  function done(row: LogRow) {
    if (!body || !row.entryId) return;
    try {
      const next = markLogEntryDone(body, kind, row.entryId);
      if (next !== body) dispatch({ type: 'SET_BODY', payload: { clientId: profileId, body: next } });
    } catch (e) {
      setProblem(e instanceof Error ? e.message : 'That could not be written.');
    }
  }

  return (
    <>
      <RowCard rows={rows} empty={empty} onDone={locked || !body ? undefined : done} />
      {!locked && body && (
        <AddBar onAdd={add} disabled={!title.trim()}>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && add()}
            placeholder={titlePlaceholder}
            className={FIELD}
          />
          <input
            value={note}
            onChange={e => setNote(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && add()}
            placeholder={notePlaceholder}
            className={FIELD}
          />
        </AddBar>
      )}
      {!locked && !body && <NotMovedYet />}
      {problem && <p className="text-[12.5px] text-overdue">{problem}</p>}
      {rows.length > 0 && (
        // Both figures come off the array drawn above, at render time.
        <p className="tnum text-[12.5px] text-muted">
          {rows.filter(r => !r.done).length} of {counted(rows.length, noun)} still open
        </p>
      )}
    </>
  );
}

// ── Notes ────────────────────────────────────────────────────────────────────

function NotesTab({ profileId, locked }: { profileId: string; locked: boolean }) {
  const { state, dispatch } = useApp();
  const { data } = useClient(profileId);
  const [text, setText] = useState('');
  const [topic, setTopic] = useState('');

  const body = data.body;
  const rows = noteRows({
    profileId, body,
    observations: state.observations ?? [],
  });

  function add() {
    const t = text.trim();
    if (!t) return;
    if (body) {
      // A profile that has moved keeps its notes in its own body.
      dispatch({
        type: 'SET_BODY',
        payload: { clientId: profileId, body: addNote(body, { id: generateId(), text: t, topic }) },
      });
    } else {
      // One that has not keeps writing to the notebook, tagged to this profile.
      const now = new Date().toISOString();
      dispatch({
        type: 'ADD_OBSERVATION',
        payload: {
          observation: {
            id: generateId(), topic: topic.trim() || 'About this profile',
            text: t, clientId: profileId, createdAt: now, updatedAt: now,
          },
        },
      });
    }
    setText('');
  }

  return (
    <>
      <RowCard rows={rows} empty="No notes on this profile yet." />
      {!locked && (
        <AddBar onAdd={add} disabled={!text.trim()}>
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && add()}
            placeholder="What did you notice?"
            className={FIELD}
          />
          <input
            value={topic}
            onChange={e => setTopic(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && add()}
            placeholder="Topic"
            className={`${FIELD} max-w-[11rem]`}
          />
        </AddBar>
      )}
    </>
  );
}

// ── The furniture ────────────────────────────────────────────────────────────

// `min-w-[9rem]` is what keeps the add bar predictable at 392: two fields sit on
// one line and the button drops to the next, rather than three squeezed items.
const FIELD =
  'min-w-[9rem] flex-1 rounded-[13px] border border-hairline bg-white px-4 py-3 text-sm ' +
  'text-text placeholder:text-faint outline-none focus:border-accent';

/**
 * The design's row list. The empty line says what empty MEANS on this tab,
 * because a blank card and a card whose data never arrived look the same.
 */
function RowCard({ rows, empty, onDone }: {
  rows: LogRow[];
  empty: string;
  onDone?: (row: LogRow) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-card border border-hairline bg-white px-[18px] py-[15px] shadow-card">
        <p className="text-[13px] text-faint">{empty}</p>
      </div>
    );
  }
  return (
    <div className="divide-y divide-divider overflow-hidden rounded-card border border-hairline bg-white shadow-card">
      {rows.map(row => (
        <div key={row.id} className="flex items-start gap-3.5 px-[18px] py-[15px]">
          <span
            className="mt-[7px] h-2 w-2 flex-none rounded-full"
            style={{ background: row.dot }}
          />
          <span className="min-w-0 flex-1">
            <span className={`block text-[15px] font-semibold leading-[1.35] ${
              row.done ? 'text-faint line-through' : 'text-text'}`}>
              {row.title}
            </span>
            <span className="mt-[3px] block text-[12.5px] leading-[1.4] text-faint">{row.sub}</span>
          </span>
          <span className="tnum mt-[1px] whitespace-nowrap text-[12px] text-faint">{row.when}</span>
          {onDone && !row.done && (
            <button
              type="button"
              onClick={() => onDone(row)}
              title="Mark this done"
              aria-label={`Mark "${row.title}" done`}
              className="mt-[-1px] flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full border border-hairline text-faint hover:border-ink hover:text-ink"
            >
              <Check size={13} strokeWidth={2.2} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

/** One line, two fields at most, one dark button. The same on every tab. */
function AddBar({ children, onAdd, disabled }: {
  children: React.ReactNode;
  onAdd: () => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {children}
      <button
        type="button"
        onClick={onAdd}
        disabled={disabled}
        className="flex items-center gap-1.5 whitespace-nowrap rounded-xl bg-ink px-[18px] py-3 text-[13.5px] font-semibold text-white disabled:opacity-30"
      >
        <Plus size={15} strokeWidth={2.2} /> Add
      </button>
    </div>
  );
}

/**
 * Decisions and requests live in the profile's own body, at the addresses spec
 * 21 §8.8 gave them. A profile that has not been moved across has no body to
 * write into, so it reads and does not write. Saying that plainly beats a
 * button that silently does nothing.
 */
function NotMovedYet() {
  return (
    <p className="text-[12.5px] leading-[1.5] text-muted">
      This profile has not been moved into the new structure yet, so nothing new can be written
      here. Move it across first and this starts working.
    </p>
  );
}
